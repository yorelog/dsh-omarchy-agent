import { readFile } from 'node:fs/promises';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { lines, parseJson, run } from './exec.js';
const OS_RELEASE = '/etc/os-release';
function opts(config, exec) {
    return { signal: exec.signal, timeoutMs: config.commandTimeoutMs };
}
function jsonText(value) {
    return JSON.stringify(value, null, 2);
}
function readOsField(text, key) {
    const match = text.match(new RegExp(`^${key}="?([^"\\n]+)"?$`, 'm'));
    return match?.[1]?.trim();
}
/**
 * Register the Omarchy model-facing tools on the calling context's tool registry.
 * @param ctx - plugin context with `tools` injected.
 * @param config - resolved plugin configuration.
 */
export function applyTools(ctx, config) {
    registerStatus(ctx, config);
    registerCatalog(ctx, config);
    registerTheme(ctx, config);
    registerHypr(ctx, config);
    registerDiagnose(ctx, config);
}
function registerStatus(ctx, config) {
    ctx.tools.register(defineTool({
        name: 'omarchy_status',
        description: 'Read the current Omarchy machine state: distro build, active theme, Hyprland version, monitors, workspaces, the active window, and failed user units. Read-only; call it before proposing desktop changes.',
        parameters: {},
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    distro: { type: 'string' },
                    build: { type: 'string' },
                    theme: { type: 'string' },
                    hyprland: { type: 'string' },
                    monitors: { type: 'json' },
                    workspaces: { type: 'json' },
                    activeWindow: { type: 'json' },
                    failedUserUnits: { type: 'array', items: { type: 'string' } },
                    errors: { type: 'array', items: { type: 'string' } },
                },
            },
            render: (_args, value) => [{ type: 'text', text: jsonText(value) }],
        },
        async execute(_args, exec) {
            const o = opts(config, exec);
            const [osText, theme, version, monitors, workspaces, activeWindow, failedUnits] = await Promise.all([
                readFile(OS_RELEASE, 'utf8').catch(() => ''),
                run(config.omarchyBin, ['theme', 'current'], o),
                run('hyprctl', ['version'], o),
                run('hyprctl', ['monitors', '-j'], o),
                run('hyprctl', ['workspaces', '-j'], o),
                run('hyprctl', ['activewindow', '-j'], o),
                run('systemctl', ['--user', '--failed', '--no-legend'], o),
            ]);
            const errors = [];
            for (const [label, outcome] of [
                ['theme', theme],
                ['hyprctl version', version],
                ['hyprctl monitors', monitors],
                ['hyprctl workspaces', workspaces],
                ['hyprctl activewindow', activeWindow],
                ['systemctl --user --failed', failedUnits],
            ]) {
                if (!outcome.ok)
                    errors.push(`${label}: ${outcome.stderr}`);
            }
            return {
                distro: readOsField(osText, 'PRETTY_NAME') ?? readOsField(osText, 'NAME') ?? 'unknown',
                build: readOsField(osText, 'BUILD_ID') ?? '',
                theme: theme.ok ? theme.stdout : '',
                hyprland: version.ok ? (version.stdout.split('\n')[0] ?? '') : '',
                monitors: monitors.ok ? (parseJson(monitors.stdout) ?? []) : [],
                workspaces: workspaces.ok ? (parseJson(workspaces.stdout) ?? []) : [],
                activeWindow: activeWindow.ok ? (parseJson(activeWindow.stdout) ?? null) : null,
                failedUserUnits: failedUnits.ok ? lines(failedUnits.stdout) : [],
                errors,
            };
        },
    }));
}
function registerCatalog(ctx, config) {
    ctx.tools.register(defineTool({
        name: 'omarchy_catalog',
        description: 'Search the Omarchy command catalog. Returns matching routes with their summary, argument usage, and whether they need sudo. Use it to discover first-class Omarchy commands instead of hand-editing configuration.',
        parameters: {
            query: { type: 'string', description: 'Case-insensitive substring matched against route, summary, and group.' },
            all: { type: 'boolean', description: 'Include hidden commands. Defaults to false.' },
            requiresSudoOnly: { type: 'boolean', description: 'Return only commands declared as requiring sudo.' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    count: { type: 'integer' },
                    commands: { type: 'json' },
                },
            },
            render: (_args, value) => [{ type: 'text', text: jsonText(value) }],
        },
        async execute(args, exec) {
            const argv = ['commands', '--json'];
            if (args.all === true)
                argv.splice(1, 0, '--all');
            const outcome = await run(config.omarchyBin, argv, opts(config, exec));
            const parsed = parseJson(outcome.stdout);
            const source = parsed !== null && typeof parsed === 'object' && Array.isArray(parsed.commands)
                ? parsed.commands
                : [];
            const query = args.query?.toLowerCase();
            const filtered = source.filter((entry) => {
                if (args.requiresSudoOnly === true && entry.requires_sudo !== true)
                    return false;
                if (query === undefined)
                    return true;
                const haystack = `${String(entry.route ?? '')} ${String(entry.summary ?? '')} ${String(entry.group ?? '')}`.toLowerCase();
                return haystack.includes(query);
            });
            const commands = filtered.slice(0, 100).map((entry) => ({
                route: entry.route ?? null,
                summary: entry.summary ?? null,
                args: entry.args ?? null,
                requires_sudo: entry.requires_sudo === true,
                examples: entry.examples ?? null,
            }));
            return { count: commands.length, commands };
        },
    }));
}
function registerTheme(ctx, config) {
    ctx.tools.register(defineTool({
        name: 'omarchy_theme',
        description: 'List available Omarchy themes, read the current theme, or apply a theme by its displayed name (for example "Tokyo Night"). Applying a theme reloads the desktop; it is reversible and needs no approval.',
        parameters: {
            action: { type: 'string', enum: ['list', 'current', 'set'], required: true, description: 'Operation to perform.' },
            name: { type: 'string', description: 'Display name of the theme to apply when action is "set".' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    action: { type: 'string' },
                    theme: { type: 'string' },
                    themes: { type: 'array', items: { type: 'string' } },
                    changed: { type: 'boolean' },
                    output: { type: 'string' },
                    error: { type: 'string' },
                },
            },
            render: (_args, value) => [{ type: 'text', text: jsonText(value) }],
        },
        async execute(args, exec) {
            const o = opts(config, exec);
            if (args.action === 'current') {
                const outcome = await run(config.omarchyBin, ['theme', 'current'], o);
                return outcome.ok ? { action: 'current', theme: outcome.stdout } : { action: 'current', error: outcome.stderr };
            }
            if (args.action === 'list') {
                const outcome = await run(config.omarchyBin, ['theme', 'list'], o);
                return outcome.ok ? { action: 'list', themes: lines(outcome.stdout) } : { action: 'list', error: outcome.stderr };
            }
            const name = args.name?.trim();
            if (!name)
                return { action: 'set', error: 'name is required when action is "set".' };
            const listing = await run(config.omarchyBin, ['theme', 'list'], o);
            if (!listing.ok)
                return { action: 'set', error: listing.stderr };
            const available = lines(listing.stdout);
            const match = available.find((entry) => entry.toLowerCase() === name.toLowerCase());
            if (!match)
                return { action: 'set', error: `Unknown theme "${name}".`, themes: available };
            const applied = await run(config.omarchyBin, ['theme', 'set', match], o);
            return applied.ok
                ? { action: 'set', theme: match, changed: true, output: applied.stdout }
                : { action: 'set', theme: match, changed: false, error: applied.stderr };
        },
    }));
}
const HYPR_TARGETS = ['monitors', 'workspaces', 'clients', 'activewindow', 'binds', 'devices', 'layers'];
function registerHypr(ctx, config) {
    ctx.tools.register(defineTool({
        name: 'omarchy_hypr',
        description: 'Read live Hyprland state as JSON (monitors, workspaces, clients, activewindow, binds, devices, layers) or reload the Hyprland configuration after editing files under ~/.config/hypr.',
        parameters: {
            action: { type: 'string', enum: ['get', 'reload'], required: true, description: 'Read state or reload configuration.' },
            target: { type: 'string', enum: [...HYPR_TARGETS], description: 'State to read when action is "get". Defaults to monitors.' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    action: { type: 'string' },
                    target: { type: 'string' },
                    data: { type: 'json' },
                    reloaded: { type: 'boolean' },
                    output: { type: 'string' },
                    error: { type: 'string' },
                },
            },
            render: (_args, value) => [{ type: 'text', text: jsonText(value) }],
        },
        async execute(args, exec) {
            const o = opts(config, exec);
            if (args.action === 'reload') {
                const outcome = await run('hyprctl', ['reload'], o);
                return outcome.ok
                    ? { action: 'reload', reloaded: true, output: outcome.stdout }
                    : { action: 'reload', reloaded: false, error: outcome.stderr };
            }
            const target = args.target ?? 'monitors';
            const outcome = await run('hyprctl', [target, '-j'], o);
            return outcome.ok
                ? { action: 'get', target, data: parseJson(outcome.stdout) ?? outcome.stdout }
                : { action: 'get', target, error: outcome.stderr };
        },
    }));
}
function registerDiagnose(ctx, config) {
    ctx.tools.register(defineTool({
        name: 'omarchy_diagnose',
        description: 'Gather Omarchy diagnostics: recent crashes from coredumpctl and failed system and user units. Read-only; use it when asked why an application, the bar, or a session misbehaved.',
        parameters: {
            scope: { type: 'string', enum: ['crashes', 'units', 'all'], description: 'Which diagnostics to collect. Defaults to all.' },
            limit: { type: 'integer', description: 'Maximum crash records to return. Defaults to 10.' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    scope: { type: 'string' },
                    crashes: { type: 'array', items: { type: 'string' } },
                    systemUnits: { type: 'array', items: { type: 'string' } },
                    userUnits: { type: 'array', items: { type: 'string' } },
                    errors: { type: 'array', items: { type: 'string' } },
                },
            },
            render: (_args, value) => [{ type: 'text', text: jsonText(value) }],
        },
        async execute(args, exec) {
            const o = opts(config, exec);
            const scope = args.scope ?? 'all';
            const limit = Math.min(Math.max(args.limit ?? 10, 1), 100);
            const errors = [];
            const crashes = [];
            const systemUnits = [];
            const userUnits = [];
            if (scope === 'crashes' || scope === 'all') {
                const outcome = await run('coredumpctl', ['list', '--no-pager', '-n', String(limit)], o);
                if (outcome.ok)
                    crashes.push(...lines(outcome.stdout));
                else
                    errors.push(`coredumpctl: ${outcome.stderr}`);
            }
            if (scope === 'units' || scope === 'all') {
                const systemOutcome = await run('systemctl', ['--failed', '--no-pager', '--no-legend'], o);
                if (systemOutcome.ok)
                    systemUnits.push(...lines(systemOutcome.stdout));
                else
                    errors.push(`systemctl --failed: ${systemOutcome.stderr}`);
                const userOutcome = await run('systemctl', ['--user', '--failed', '--no-pager', '--no-legend'], o);
                if (userOutcome.ok)
                    userUnits.push(...lines(userOutcome.stdout));
                else
                    errors.push(`systemctl --user --failed: ${userOutcome.stderr}`);
            }
            return { scope, crashes, systemUnits, userUnits, errors };
        },
    }));
}
