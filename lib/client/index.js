import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/** Services the client plugin needs before `apply` runs. */
export const inject = ['slots'];
const TOOLS = [
    'omarchy_status',
    'omarchy_catalog',
    'omarchy_theme',
    'omarchy_hypr',
    'omarchy_diagnose',
];
const LABELS = {
    omarchy_status: 'Omarchy status',
    omarchy_catalog: 'Omarchy commands',
    omarchy_theme: 'Omarchy theme',
    omarchy_hypr: 'Hyprland',
    omarchy_diagnose: 'Omarchy diagnostics',
};
/**
 * Register one view per tool name. A name that is not registered keeps the
 * generic tool card, so this stays additive.
 * @param ctx - client root context with `slots` available.
 */
export function apply(ctx) {
    for (const tool of TOOLS) {
        ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: tool }, OmarchyToolRow));
    }
}
function asRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function str(value) {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
function num(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function parseJson(text) {
    if (text.length === 0)
        return undefined;
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
function resultText(content) {
    const parts = [];
    for (const item of content) {
        const block = asRecord(item);
        if (block?.type === 'text' && typeof block.text === 'string')
            parts.push(block.text);
    }
    return parts.join('\n').trim();
}
function OmarchyToolRow(props) {
    const label = LABELS[props.toolName] ?? props.toolName;
    if (props.phase !== 'result') {
        return (_jsx(Card, { label: label, summary: "running\u2026", children: _jsx("div", { style: muted, children: "Reading Omarchy state\u2026" }) }));
    }
    const block = props.block;
    if (block.isError || block.error !== undefined) {
        const reason = block.error?.reason ?? block.error?.name ?? 'The tool failed.';
        return (_jsx(Card, { label: label, summary: block.error?.code ?? 'failed', tone: "error", children: _jsx("div", { style: muted, children: reason }) }));
    }
    const text = resultText(block.content);
    const value = parseJson(text);
    return (_jsx(Card, { label: label, summary: summaryOf(props.toolName, value), children: _jsx(Body, { tool: props.toolName, value: value, text: text }) }));
}
function summaryOf(tool, value) {
    const v = asRecord(value);
    if (v === undefined)
        return undefined;
    switch (tool) {
        case 'omarchy_status': {
            const theme = str(v.theme);
            const monitors = asArray(v.monitors).length;
            return [theme, monitors > 0 ? `${monitors} display${monitors === 1 ? '' : 's'}` : undefined]
                .filter((part) => part !== undefined)
                .join(' · ') || undefined;
        }
        case 'omarchy_catalog': {
            const count = num(v.count) ?? asArray(v.commands).length;
            return `${count} command${count === 1 ? '' : 's'}`;
        }
        case 'omarchy_theme': {
            if (str(v.action) === 'set')
                return str(v.theme) ?? (v.changed === true ? 'changed' : 'not changed');
            if (str(v.action) === 'list')
                return `${asArray(v.themes).length} themes`;
            return str(v.theme);
        }
        case 'omarchy_hypr': {
            const target = str(v.target) ?? 'state';
            const data = asArray(v.data);
            return data.length > 0 ? `${target} · ${data.length}` : target;
        }
        case 'omarchy_diagnose': {
            const crashes = asArray(v.crashes).length;
            const failed = asArray(v.systemUnits).length + asArray(v.userUnits).length;
            return `${crashes} crash${crashes === 1 ? '' : 'es'} · ${failed} failed unit${failed === 1 ? '' : 's'}`;
        }
        default:
            return undefined;
    }
}
function Body({ tool, value, text }) {
    const v = asRecord(value);
    if (v === undefined) {
        return text.length > 0 ? _jsx("pre", { style: pre, children: text }) : _jsx("div", { style: muted, children: "No result data." });
    }
    switch (tool) {
        case 'omarchy_status': {
            const active = asRecord(v.activeWindow);
            const failed = asArray(v.failedUserUnits);
            return (_jsxs(_Fragment, { children: [_jsx(Rows, { rows: [
                            ['Theme', str(v.theme)],
                            ['Hyprland', firstLine(str(v.hyprland))],
                            ['Displays', asArray(v.monitors).length],
                            ['Workspaces', asArray(v.workspaces).length],
                            ['Active window', str(active?.title) ?? str(active?.class)],
                            ['Failed user units', failed.length],
                        ] }), _jsx(Raw, { value: v })] }));
        }
        case 'omarchy_theme': {
            const themes = asArray(v.themes).map((theme) => str(theme)).filter((theme) => theme !== undefined);
            if (themes.length > 0) {
                return (_jsxs(_Fragment, { children: [_jsx("div", { style: chips, children: themes.map((theme) => (_jsx("span", { style: chip, children: theme }, theme))) }), _jsx(Raw, { value: v })] }));
            }
            return (_jsxs(_Fragment, { children: [_jsx(Rows, { rows: [['Action', str(v.action)], ['Theme', str(v.theme)], ['Changed', v.changed === true]] }), _jsx(Raw, { value: v })] }));
        }
        case 'omarchy_catalog': {
            const commands = asArray(v.commands).map(asRecord).filter((command) => command !== undefined);
            return (_jsxs(_Fragment, { children: [commands.length === 0 ? _jsx("div", { style: muted, children: "No matching commands." }) : null, commands.slice(0, 8).map((command) => (_jsxs("div", { style: row, children: [_jsx("code", { style: code, children: str(command.route) ?? '?' }), _jsx("span", { style: muted, children: str(command.summary) ?? '' })] }, str(command.route) ?? JSON.stringify(command)))), _jsx(Raw, { value: v })] }));
        }
        case 'omarchy_hypr': {
            return (_jsxs(_Fragment, { children: [_jsx(Rows, { rows: [['Target', str(v.target)], ['Entries', asArray(v.data).length]] }), _jsx(Raw, { value: v })] }));
        }
        case 'omarchy_diagnose': {
            const crashes = asArray(v.crashes).map((crash) => str(crash)).filter((crash) => crash !== undefined);
            const units = [...asArray(v.systemUnits), ...asArray(v.userUnits)]
                .map((unit) => str(unit))
                .filter((unit) => unit !== undefined);
            return (_jsxs(_Fragment, { children: [_jsx(Rows, { rows: [['Crashes', crashes.length], ['Failed units', units.length]] }), crashes.slice(0, 4).map((crash) => (_jsx("div", { style: muted, children: crash }, crash))), units.slice(0, 4).map((unit) => (_jsx("div", { style: muted, children: _jsx("code", { style: code, children: unit }) }, unit))), _jsx(Raw, { value: v })] }));
        }
        default:
            return _jsx(Raw, { value: v });
    }
}
function Rows({ rows }) {
    const visible = rows.filter(([, value]) => value !== undefined && value !== '');
    if (visible.length === 0)
        return null;
    return (_jsx("div", { style: grid, children: visible.map(([name, value]) => (_jsx(Row, { name: name, value: String(value) }, name))) }));
}
function Row({ name, value }) {
    return (_jsxs("div", { style: row, children: [_jsx("span", { style: muted, children: name }), _jsx("span", { style: { minWidth: 0, overflowWrap: 'anywhere' }, children: value })] }));
}
function Raw({ value }) {
    return (_jsxs("details", { style: { marginTop: 6 }, children: [_jsx("summary", { style: summaryStyle, children: "Raw JSON" }), _jsx("pre", { style: pre, children: JSON.stringify(value, null, 2) })] }));
}
function firstLine(value) {
    return value?.split('\n')[0];
}
function Card({ label, summary, tone, children, }) {
    return (_jsxs("div", { style: { ...card, ...(tone === 'error' ? { borderColor: 'rgba(255, 99, 99, 0.55)' } : {}) }, children: [_jsxs("div", { style: header, children: [_jsx("span", { style: {
                            ...dot,
                            background: tone === 'error' ? '#ff6363' : 'currentColor',
                            opacity: tone === 'error' ? 1 : 0.55,
                        } }), _jsx("span", { style: { fontWeight: 600 }, children: label }), summary !== undefined && summary.length > 0 ? _jsx("span", { style: muted, children: summary }) : null] }), children] }));
}
const card = {
    border: '1px solid rgba(127, 127, 127, 0.28)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    lineHeight: 1.45,
    overflow: 'hidden',
};
const header = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 };
const dot = { width: 7, height: 7, borderRadius: 999, flex: '0 0 auto' };
const muted = { opacity: 0.7, fontSize: 12 };
const grid = { display: 'grid', gap: 2 };
const row = { display: 'flex', gap: 8, minWidth: 0, justifyContent: 'space-between' };
const code = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 };
const pre = {
    margin: '6px 0 0',
    padding: 8,
    borderRadius: 6,
    background: 'rgba(127, 127, 127, 0.12)',
    fontSize: 11,
    lineHeight: 1.4,
    overflow: 'auto',
    maxHeight: 240,
};
const summaryStyle = { cursor: 'pointer', fontSize: 12, opacity: 0.7 };
const chips = { display: 'flex', flexWrap: 'wrap', gap: 4 };
const chip = {
    border: '1px solid rgba(127, 127, 127, 0.28)',
    borderRadius: 999,
    padding: '1px 8px',
    fontSize: 12,
};
