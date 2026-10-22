import { access, readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { parseJson, run } from './exec.js';
const DEFAULT_AGENT_FILE = join(homedir(), '.config', 'omarchy', 'defaults', 'agent');
const USAGE_DIR = join(homedir(), '.local', 'state', 'omarchy', 'agents', 'usage');
function opts(config, exec) {
    return { signal: exec.signal, timeoutMs: config.commandTimeoutMs };
}
function jsonText(value) {
    return JSON.stringify(value, null, 2);
}
function asRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
}
function asString(value) {
    return typeof value === 'string' ? value : '';
}
function asNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function commandPath(name, config, exec) {
    return run('bash', ['-lc', `command -v ${name} 2>/dev/null`], opts(config, exec)).then((outcome) => outcome.ok ? outcome.stdout.trim() : '');
}
async function accessible(path) {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
}
function summarize(record, fallbackId) {
    return {
        id: asString(record.id) || fallbackId,
        name: asString(record.name),
        ready: record.ready === true,
        tierLabel: asString(record.tierLabel),
        usageStatusText: asString(record.usageStatusText),
        limitsStale: record.limitsStale === true,
        updatedAt: asString(record.updatedAt),
        balance: record.balance ?? null,
        limits: record.limits ?? null,
        todayPrompts: asNumber(record.todayPrompts),
        todayTotalTokens: asNumber(record.todayTotalTokens),
        totalPrompts: asNumber(record.totalPrompts),
    };
}
/**
 * Read the coding-agent surface without changing it: the selected default,
 * whether dsh is listed and installed, and the records the Omarchy agents panel
 * consumes. No command here selects, installs, or launches an agent.
 * @param ctx - plugin context with `tools` injected.
 * @param config - resolved plugin configuration.
 */
export function registerInspectTools(ctx, config) {
    ctx.tools.register(defineTool({
        name: 'omarchy_agent',
        description: 'Read the Omarchy coding-agent surface without changing it: the current default agent, whether dsh is a listed launcher and installed, and the agents-panel usage records. Read-only; installation, selection, launch, and account changes stay with the user.',
        parameters: {
            action: {
                type: 'string',
                enum: ['status', 'usage'],
                description: 'Read the default/install surface or the agents-panel usage records. Defaults to status.',
            },
            agent: { type: 'string', description: 'For usage, filter records by id or name (for example "deepseek").' },
            full: { type: 'boolean', description: 'For usage, return complete records instead of summaries. Defaults to false.' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    action: { type: 'string' },
                    defaultAgent: { type: 'string' },
                    supportsDsh: { type: 'boolean' },
                    dshInstalled: { type: 'boolean' },
                    usageCollector: { type: 'boolean' },
                    usageRecord: { type: 'boolean' },
                    agentsPanel: { type: 'boolean' },
                    directory: { type: 'string' },
                    count: { type: 'integer' },
                    records: { type: 'json' },
                    errors: { type: 'array', items: { type: 'string' } },
                },
            },
            render: (_args, value) => [{ type: 'text', text: jsonText(value) }],
        },
        async execute(args, exec) {
            const action = args.action ?? 'status';
            const errors = [];
            const usageDir = USAGE_DIR;
            if (action === 'usage') {
                let entries;
                try {
                    entries = await readdir(usageDir, { withFileTypes: true });
                }
                catch (error) {
                    return {
                        action,
                        directory: usageDir,
                        count: 0,
                        records: [],
                        errors: [`${usageDir}: ${error instanceof Error ? error.message : String(error)}`],
                    };
                }
                const target = args.agent?.trim().toLowerCase() ?? '';
                const records = [];
                for (const entry of entries) {
                    if (!entry.isFile() || !entry.name.endsWith('.json'))
                        continue;
                    const file = join(usageDir, entry.name);
                    let parsed;
                    try {
                        parsed = JSON.parse(await readFile(file, 'utf8'));
                    }
                    catch (error) {
                        errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
                        continue;
                    }
                    const record = asRecord(parsed);
                    if (record === undefined) {
                        errors.push(`${file}: not a JSON object`);
                        continue;
                    }
                    const id = asString(record.id) || basename(entry.name, '.json');
                    const name = asString(record.name);
                    if (target !== '' &&
                        id.toLowerCase() !== target &&
                        name.toLowerCase() !== target &&
                        basename(entry.name, '.json').toLowerCase() !== target) {
                        continue;
                    }
                    records.push(args.full === true
                        ? record
                        : summarize(record, id));
                }
                records.sort((left, right) => {
                    const leftId = asString(asRecord(left)?.id);
                    const rightId = asString(asRecord(right)?.id);
                    return leftId.localeCompare(rightId);
                });
                return { action, directory: usageDir, count: records.length, records, errors };
            }
            let defaultAgent = '';
            try {
                defaultAgent = (await readFile(DEFAULT_AGENT_FILE, 'utf8')).trim();
            }
            catch {
                // No selection file: the launcher's own read is the fallback.
            }
            if (defaultAgent === '') {
                const outcome = await run('omarchy-default-agent', [], opts(config, exec));
                if (outcome.ok)
                    defaultAgent = outcome.stdout.trim();
                else
                    errors.push(`omarchy-default-agent: ${outcome.stderr}`);
            }
            const launcher = await commandPath('omarchy-default-agent', config, exec);
            let supportsDsh = false;
            if (launcher !== '') {
                try {
                    supportsDsh = /\bdsh\b/.test(await readFile(launcher, 'utf8'));
                }
                catch (error) {
                    errors.push(`${launcher}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            const dsh = await commandPath('dsh', config, exec);
            return {
                action,
                defaultAgent,
                supportsDsh,
                dshInstalled: dsh !== '',
                usageCollector: await accessible(join(config.protectedPath, 'bin', 'omarchy-agent-usage-deepseek')),
                usageRecord: await accessible(join(usageDir, 'deepseek.json')),
                agentsPanel: await accessible(join(config.protectedPath, 'shell', 'plugins', 'agents')),
                errors,
            };
        },
    }));
    ctx.tools.register(defineTool({
        name: 'omarchy_plugin',
        description: 'List installed Omarchy shell plugins or validate a plugin folder. Read-only; adding, updating, enabling, and disabling plugins stay with the user or omarchy plugin commands.',
        parameters: {
            action: { type: 'string', enum: ['list', 'validate'], required: true, description: 'Inspect or validate.' },
            path: { type: 'string', description: 'Plugin folder to validate when action is "validate".' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    action: { type: 'string' },
                    path: { type: 'string' },
                    ok: { type: 'boolean' },
                    count: { type: 'integer' },
                    plugins: { type: 'json' },
                    output: { type: 'string' },
                    error: { type: 'string' },
                },
            },
            render: (_args, value) => [{ type: 'text', text: jsonText(value) }],
        },
        async execute(args, exec) {
            const o = opts(config, exec);
            if (args.action === 'list') {
                const outcome = await run(config.omarchyBin, ['plugin', 'list', '--json'], o);
                if (!outcome.ok)
                    return { action: 'list', ok: false, error: outcome.stderr };
                const parsed = parseJson(outcome.stdout);
                const plugins = Array.isArray(parsed) ? parsed : [];
                return { action: 'list', ok: true, count: plugins.length, plugins };
            }
            const path = args.path?.trim() ?? '';
            if (path === '')
                return { action: 'validate', ok: false, error: 'path is required when action is "validate".' };
            const outcome = await run(config.omarchyBin, ['plugin', 'validate', path], o);
            return {
                action: 'validate',
                path,
                ok: outcome.ok,
                output: outcome.stdout,
                ...(outcome.ok ? {} : { error: outcome.stderr }),
            };
        },
    }));
    const shellActions = {
        plugins: ['shell', 'listPlugins'],
        config: ['shell', 'listShellConfig'],
        barGeometry: ['shell', 'debugBarGeometry'],
    };
    ctx.tools.register(defineTool({
        name: 'omarchy_shell',
        description: 'Read the running Omarchy shell through its IPC: discovered bar plugins, the effective shell configuration, and bar geometry. Read-only; summoning, hiding, rescanning, and enabling widgets stay with the user.',
        parameters: {
            action: {
                type: 'string',
                enum: ['plugins', 'config', 'barGeometry'],
                required: true,
                description: 'Which read-only shell view to fetch.',
            },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    action: { type: 'string' },
                    data: { type: 'json' },
                    error: { type: 'string' },
                },
            },
            render: (_args, value) => [{ type: 'text', text: jsonText(value) }],
        },
        async execute(args, exec) {
            const argv = shellActions[args.action];
            const outcome = await run('omarchy-shell', [...argv], opts(config, exec));
            if (!outcome.ok)
                return { action: args.action, error: outcome.stderr };
            return { action: args.action, data: parseJson(outcome.stdout) ?? outcome.stdout };
        },
    }));
    ctx.tools.register(defineTool({
        name: 'omarchy_panel',
        description: "Read the DeepSeek Harness bar panel's current signals, or activate one of its clickable cards by id. Signals cover the server, harness, usage, load, memory, errors, recent apps, and project. Activation opens the matching UI or focuses the most recent app; it does not change Omarchy configuration.",
        parameters: {
            action: { type: 'string', enum: ['signals', 'activate'], required: true, description: 'Read the panel or activate a card.' },
            id: { type: 'string', description: 'Card id for action "activate", such as web, cli, usage, errors, or project.' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    action: { type: 'string' },
                    id: { type: 'string' },
                    data: { type: 'json' },
                    error: { type: 'string' },
                },
            },
            render: (_args, value) => [{ type: 'text', text: jsonText(value) }],
        },
        async execute(args, exec) {
            const o = opts(config, exec);
            if (args.action === 'activate') {
                const id = args.id?.trim() ?? '';
                if (!/^[a-z-]+$/.test(id)) {
                    return { action: 'activate', id, error: 'id must be a card id such as "web", "errors", or "project".' };
                }
                const outcome = await run('omarchy-shell', ['dsh-omarchy-agent', 'activate', id], o);
                return outcome.ok
                    ? { action: 'activate', id, data: parseJson(outcome.stdout) ?? outcome.stdout }
                    : { action: 'activate', id, error: outcome.stderr };
            }
            const outcome = await run('omarchy-shell', ['dsh-omarchy-agent', 'signals'], o);
            return outcome.ok
                ? { action: 'signals', data: parseJson(outcome.stdout) ?? outcome.stdout }
                : { action: 'signals', error: outcome.stderr };
        },
    }));
}
