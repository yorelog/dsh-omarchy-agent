import { homedir } from 'node:os';
/** Tool names whose `path` argument is a filesystem mutation target. */
const PATH_MUTATING_TOOLS = new Set(['write', 'edit', 'str_replace_editor', 'apply_patch', 'notebook_edit']);
/**
 * Tokens that, when they appear in a shell command, look like a write.
 *
 * Output redirection is deliberately not part of this list: a bare `>` is not a
 * write by itself, so it is resolved against its actual target by
 * {@link redirectTargets} instead.
 */
const WRITE_HINTS = /\b(rm|mv|cp|chmod|chown|truncate|tee|dd|install|touch|mkdir|ln|patch|sed|perl|python3?|ruby|node|awk)\b/;
const PRIVILEGED = /\b(sudo|pkexec|pacman|yay|paru|makepkg)\b/;
const OMARCHY_UPDATE = /\bomarchy\s+update\b/;
const SYSTEM_MUTATION = /\bsystemctl\b[^|;&]*(start|stop|restart|enable|disable|mask|unmask|daemon-reload)\b/;
const POWER = /\b(reboot|shutdown|poweroff|halt)\b/;
function normalize(candidate) {
    let value = candidate.trim();
    if (value.startsWith('~/'))
        value = `${homedir()}${value.slice(1)}`;
    return value.replace(/\/{2,}/g, '/');
}
function isProtected(candidate, protectedPath) {
    if (candidate.length === 0)
        return false;
    const value = normalize(candidate);
    const root = normalize(protectedPath).replace(/\/+$/, '');
    return value === root || value.startsWith(`${root}/`) || value.includes(`${root}/`);
}
/** Whether a command or a redirect target names the protected tree. */
function namesProtectedTree(candidate, protectedPath) {
    if (isProtected(candidate, protectedPath))
        return true;
    return /\$\{?OMARCHY_PATH\}?/.test(candidate);
}
/** Characters that end an unquoted shell word. */
const WORD_BREAK = /[\s|&;()<>]/;
/** Read one shell word, unquoting it; `end` is the index just past the word. */
function readWord(command, start) {
    let index = start;
    let value = '';
    while (index < command.length) {
        const char = command[index];
        if (char === '\\') {
            const escaped = command[index + 1];
            if (escaped === undefined)
                break;
            value += escaped;
            index += 2;
            continue;
        }
        if (char === "'" || char === '"') {
            const quoted = readQuoted(command, index);
            value += quoted.value;
            index = quoted.end;
            continue;
        }
        if (WORD_BREAK.test(char))
            break;
        value += char;
        index += 1;
    }
    return { value, end: index };
}
/** Read a quoted span, returning its contents and the index just past the quote. */
function readQuoted(command, start) {
    const quote = command[start];
    let index = start + 1;
    let value = '';
    while (index < command.length) {
        const char = command[index];
        if (quote === '"' && char === '\\') {
            const escaped = command[index + 1];
            if (escaped === undefined)
                break;
            value += escaped;
            index += 2;
            continue;
        }
        if (char === quote)
            return { value, end: index + 1 };
        value += char;
        index += 1;
    }
    return { value, end: index };
}
/**
 * Collect the file targets of every real output redirection in a shell command.
 *
 * Only redirects that name a file count. `>&2`, `2>&1`, and `>&-` duplicate a
 * file descriptor rather than writing to one, and a `>` inside quotes or behind
 * a backslash is string data rather than shell syntax, so all of them are
 * skipped. Quoted targets are still resolved, so `>"$P/x"` names `$P/x`.
 * @param command - raw shell command text.
 * @returns the unquoted target of each file redirection, in order.
 */
function redirectTargets(command) {
    const targets = [];
    let index = 0;
    while (index < command.length) {
        const char = command[index];
        if (char === '\\') {
            index += 2;
            continue;
        }
        if (char === "'" || char === '"') {
            index = readQuoted(command, index).end;
            continue;
        }
        if (char !== '>') {
            index += 1;
            continue;
        }
        let next = index + 1;
        if (command[next] === '>')
            next += 1;
        if (command[next] === '&') {
            next += 1;
            while (next < command.length && /[0-9-]/.test(command[next]))
                next += 1;
            index = next;
            continue;
        }
        while (next < command.length && /[ \t]/.test(command[next]))
            next += 1;
        const word = readWord(command, next);
        if (word.value.length > 0)
            targets.push(word.value);
        index = word.end > next ? word.end : next;
    }
    return targets;
}
function stringArg(args, keys) {
    if (args === null || typeof args !== 'object')
        return '';
    const record = args;
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string')
            return value;
    }
    return '';
}
/**
 * Register the Omarchy safety gate on the tool pre-execute waterfall.
 *
 * The gate denies mutations of the package-owned Omarchy tree and routes
 * privileged or system-mutating shell commands through the approval service.
 * It never rewrites a call; it only allows, denies, or asks.
 * @param ctx - plugin context with `tools` injected.
 * @param config - resolved plugin configuration.
 */
export function applyGuard(ctx, config) {
    ctx.on('tools/pre-execute', async (exec, next) => {
        const name = exec.name;
        if (PATH_MUTATING_TOOLS.has(name)) {
            const target = stringArg(exec.arguments, ['path', 'file_path', 'filePath', 'notebook_path']);
            if (isProtected(target, config.protectedPath)) {
                return {
                    kind: 'deny',
                    reason: `${config.protectedPath} is package-owned and is overwritten on update. Put user changes under ~/.config/omarchy instead.`,
                };
            }
            return next();
        }
        if (name !== 'bash' && name !== 'pwsh')
            return next();
        const command = stringArg(exec.arguments, ['command', 'cmd']);
        if (command.length === 0)
            return next();
        if (namesProtectedTree(command, config.protectedPath)) {
            const looksLikeWrite = WRITE_HINTS.test(command) ||
                redirectTargets(command).some((target) => namesProtectedTree(target, config.protectedPath));
            if (looksLikeWrite) {
                return {
                    kind: 'deny',
                    reason: `${config.protectedPath} is package-owned and is overwritten on update. Read it freely, but write user changes under ~/.config/omarchy.`,
                };
            }
        }
        const privilegedToken = config.privilegedTokens.find((token) => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(command));
        if (privilegedToken !== undefined ||
            PRIVILEGED.test(command) ||
            OMARCHY_UPDATE.test(command) ||
            SYSTEM_MUTATION.test(command) ||
            POWER.test(command)) {
            return {
                kind: 'ask',
                reason: `Privileged or system-mutating command requires approval: ${command.slice(0, 200)}`,
                displayReason: {
                    en: 'The Omarchy agent wants to run a privileged or system-mutating command. Allow it?',
                },
            };
        }
        return next();
    });
}
