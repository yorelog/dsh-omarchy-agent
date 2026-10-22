import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
/** Directories searched when the caller does not name one. */
const DEFAULT_ROOTS = ['docs', 'agents/skills', 'default/agents/skills', 'shell', 'manual', 'config'];
/** Source-like files worth searching; binary assets and fonts are skipped. */
const TEXT_EXTENSIONS = new Set([
    '.md',
    '.mdx',
    '.txt',
    '.qml',
    '.js',
    '.mjs',
    '.ts',
    '.json',
    '.jsonc',
    '.toml',
    '.sh',
    '.bash',
    '.py',
    '.conf',
    '.ini',
    '.yml',
    '.yaml',
    '.css',
    '.html',
]);
/** Directories that never hold useful Omarchy source for an agent. */
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', 'dist', 'build', 'target', 'assets', 'fonts']);
const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES = 5000;
const MAX_DEPTH = 12;
const MAX_EXCERPT = 4000;
const MAX_ERRORS = 10;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
function isInside(root, candidate) {
    const rel = relative(root, candidate);
    return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
function isTextFile(name) {
    const extension = extname(name).toLowerCase();
    return extension === '' || TEXT_EXTENSIONS.has(extension);
}
function compileGlob(glob) {
    const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const pattern = escaped
        .replace(/\*\*/g, '\u0000')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
        .replace(/\u0000/g, '.*');
    return new RegExp(`^${pattern}$`);
}
function globMatches(glob, file) {
    return glob.test(file) || glob.test(basename(file));
}
function pushError(errors, message) {
    if (errors.length < MAX_ERRORS)
        errors.push(message);
}
async function* walkFiles(dir, depth, state) {
    if (depth > MAX_DEPTH || state.filesSeen >= MAX_FILES) {
        state.truncated = true;
        return;
    }
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    }
    catch (error) {
        pushError(state.errors, `${dir}: ${error instanceof Error ? error.message : String(error)}`);
        return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        if (state.signal?.aborted)
            return;
        if (entry.isSymbolicLink())
            continue;
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name))
                continue;
            yield* walkFiles(full, depth + 1, state);
            continue;
        }
        if (!entry.isFile() || !isTextFile(entry.name))
            continue;
        let info;
        try {
            info = await stat(full);
        }
        catch (error) {
            pushError(state.errors, `${full}: ${error instanceof Error ? error.message : String(error)}`);
            continue;
        }
        if (info.size > MAX_FILE_BYTES)
            continue;
        state.filesSeen += 1;
        if (state.filesSeen > MAX_FILES) {
            state.truncated = true;
            return;
        }
        yield { path: full, size: info.size };
    }
}
/**
 * Search Omarchy's package-owned docs, skills, and shell source without
 * executing anything. Paths are resolved beneath `root`, symlinks are skipped,
 * and only small text files are read.
 * @param options - root, optional path/query/glob, and result limits.
 * @returns matches (or a file listing when no query is given) plus any errors.
 */
export async function searchSource(options) {
    const result = {
        root: options.root,
        path: options.path ?? '',
        query: options.query ?? '',
        glob: options.glob ?? '',
        files: [],
        matches: [],
        scanned: 0,
        truncated: false,
        errors: [],
    };
    const context = clamp(options.context ?? 1, 0, 5);
    const limit = clamp(options.limit ?? 20, 1, 50);
    const query = options.query?.trim() ?? '';
    const glob = options.glob?.trim() ? compileGlob(options.glob.trim()) : undefined;
    let root;
    try {
        root = await realpath(options.root);
    }
    catch (error) {
        pushError(result.errors, `${options.root}: ${error instanceof Error ? error.message : String(error)}`);
        return result;
    }
    result.root = root;
    const targets = [];
    if (options.path?.trim()) {
        const requested = resolve(root, options.path.trim());
        if (!isInside(root, requested)) {
            pushError(result.errors, `${options.path}: path escapes ${root}`);
            return result;
        }
        let target;
        try {
            target = await realpath(requested);
        }
        catch (error) {
            pushError(result.errors, `${options.path}: ${error instanceof Error ? error.message : String(error)}`);
            return result;
        }
        if (!isInside(root, target)) {
            pushError(result.errors, `${options.path}: path escapes ${root}`);
            return result;
        }
        let info;
        try {
            info = await stat(target);
        }
        catch (error) {
            pushError(result.errors, `${options.path}: ${error instanceof Error ? error.message : String(error)}`);
            return result;
        }
        if (info.isFile()) {
            if (!isTextFile(target)) {
                pushError(result.errors, `${options.path}: not a text file`);
                return result;
            }
            if (info.size > MAX_FILE_BYTES) {
                pushError(result.errors, `${options.path}: file is larger than ${MAX_FILE_BYTES} bytes`);
                return result;
            }
            targets.push({ file: target });
        }
        else if (info.isDirectory()) {
            targets.push({ dir: target });
        }
        else {
            pushError(result.errors, `${options.path}: not a file or directory`);
            return result;
        }
    }
    else {
        for (const candidate of DEFAULT_ROOTS) {
            const target = resolve(root, candidate);
            try {
                const real = await realpath(target);
                if (isInside(root, real) && (await stat(real)).isDirectory())
                    targets.push({ dir: real });
            }
            catch {
                // A released Omarchy may not ship every tree; search what exists.
            }
        }
        if (targets.length === 0) {
            pushError(result.errors, `${root}: no docs, skills, shell, or manual tree found`);
            return result;
        }
    }
    const state = { errors: result.errors, filesSeen: 0, truncated: false, signal: options.signal };
    let scanned = 0;
    const consider = async (file, size) => {
        const rel = relative(root, file);
        if (glob !== undefined && !globMatches(glob, rel))
            return false;
        if (query === '') {
            if (result.files.length >= limit) {
                result.truncated = true;
                return true;
            }
            result.files.push({ path: rel, size });
            return result.files.length >= limit;
        }
        scanned += 1;
        let text;
        try {
            text = await readFile(file, 'utf8');
        }
        catch (error) {
            pushError(state.errors, `${rel}: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
        const lines = text.split(/\r?\n/);
        const needle = query.toLowerCase();
        const pathMatch = rel.toLowerCase().includes(needle);
        let matchedContent = false;
        let lastEnd = -1;
        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index] ?? '';
            if (!line.toLowerCase().includes(needle) || index <= lastEnd)
                continue;
            matchedContent = true;
            const start = Math.max(0, index - context);
            const end = Math.min(lines.length, index + context + 1);
            const excerpt = lines
                .slice(start, end)
                .map((value, offset) => `${start + offset + 1}: ${value}`)
                .join('\n')
                .slice(0, MAX_EXCERPT);
            result.matches.push({ file: rel, line: index + 1, excerpt });
            lastEnd = end - 1;
            if (result.matches.length >= limit) {
                result.truncated = true;
                return true;
            }
        }
        // A file whose name matches is worth returning even when the term never
        // appears inside it: agents ask for BarIconButton.qml, not its body.
        if (pathMatch && !matchedContent) {
            const end = Math.min(lines.length, context + 1);
            const excerpt = lines
                .slice(0, end)
                .map((value, offset) => `${offset + 1}: ${value}`)
                .join('\n')
                .slice(0, MAX_EXCERPT);
            result.matches.push({ file: rel, line: 1, excerpt });
            if (result.matches.length >= limit) {
                result.truncated = true;
                return true;
            }
        }
        return false;
    };
    const candidates = [];
    for (const target of targets) {
        if (target.file !== undefined) {
            try {
                const info = await stat(target.file);
                candidates.push({ path: target.file, size: info.size });
            }
            catch (error) {
                pushError(result.errors, `${options.path}: ${error instanceof Error ? error.message : String(error)}`);
            }
            continue;
        }
        if (target.dir === undefined)
            continue;
        for await (const entry of walkFiles(target.dir, 0, state)) {
            if (state.signal?.aborted)
                break;
            candidates.push({ path: entry.path, size: entry.size });
            if (candidates.length >= MAX_FILES) {
                state.truncated = true;
                break;
            }
        }
        if (state.signal?.aborted || state.truncated)
            break;
    }
    // A file whose name matches is usually the definition an agent asked for, so
    // return it before matches in unrelated bodies.
    if (query !== '') {
        const needle = query.toLowerCase();
        candidates.sort((left, right) => {
            const leftName = relative(root, left.path).toLowerCase().includes(needle) ? 0 : 1;
            const rightName = relative(root, right.path).toLowerCase().includes(needle) ? 0 : 1;
            return leftName - rightName || left.path.localeCompare(right.path);
        });
    }
    for (const candidate of candidates) {
        if (state.signal?.aborted)
            break;
        if (await consider(candidate.path, candidate.size))
            break;
    }
    result.scanned = query === '' ? candidates.length : scanned;
    result.truncated = result.truncated || state.truncated;
    return result;
}
/**
 * Register the read-only `omarchy_source` tool.
 * @param ctx - plugin context with `tools` injected.
 * @param config - resolved plugin configuration; its protected path is the root.
 */
export function registerSource(ctx, config) {
    ctx.tools.register(defineTool({
        name: 'omarchy_source',
        description: 'Search Omarchy documentation, agent skills, and shell source with file paths, line numbers, and excerpts. Read-only: use it (and the read tool) before guessing Omarchy internals or shelling out to readers like sed. Paths are relative to the Omarchy root; symlinks and binary assets are skipped.',
        parameters: {
            query: { type: 'string', description: 'Case-insensitive text to find. Omit to list files instead.' },
            path: {
                type: 'string',
                description: 'File or directory under the Omarchy root. Defaults to docs/, agents/skills/, default/agents/skills/, shell/, manual/, and config/.',
            },
            glob: { type: 'string', description: 'Optional glob filter, for example "*.md" or "**/agents/*.md".' },
            context: { type: 'integer', description: 'Lines of context around each match, 0-5. Defaults to 1.' },
            limit: { type: 'integer', description: 'Maximum files or matches to return, 1-50. Defaults to 20.' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    root: { type: 'string' },
                    path: { type: 'string' },
                    query: { type: 'string' },
                    glob: { type: 'string' },
                    files: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: { path: { type: 'string' }, size: { type: 'integer' } },
                        },
                    },
                    matches: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                file: { type: 'string' },
                                line: { type: 'integer' },
                                excerpt: { type: 'string' },
                            },
                        },
                    },
                    scanned: { type: 'integer' },
                    truncated: { type: 'boolean' },
                    errors: { type: 'array', items: { type: 'string' } },
                },
            },
            render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
        },
        async execute(args, exec) {
            return searchSource({
                root: config.protectedPath,
                path: args.path,
                query: args.query,
                glob: args.glob,
                context: args.context ?? 1,
                limit: args.limit ?? 20,
                signal: exec.signal,
            });
        },
    }));
}
