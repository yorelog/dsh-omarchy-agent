/**
 * Browser half of dsh-omarchy-agent: compact cards for the Omarchy tools.
 *
 * Registered into the dsh web client's keyed `tool.call.toolview` slot. The
 * host half registers the tools and owns their execution; this file only
 * presents a settled result, with the raw JSON behind a disclosure.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'

/** Services the client plugin needs before `apply` runs. */
export const inject = ['slots']

const TOOLS = [
  'omarchy_status',
  'omarchy_catalog',
  'omarchy_theme',
  'omarchy_hypr',
  'omarchy_diagnose',
  'omarchy_source',
  'omarchy_agent',
  'omarchy_plugin',
  'omarchy_shell',
  'omarchy_panel',
] as const

const LABELS: Record<string, string> = {
  omarchy_status: 'Omarchy status',
  omarchy_catalog: 'Omarchy commands',
  omarchy_theme: 'Omarchy theme',
  omarchy_hypr: 'Hyprland',
  omarchy_diagnose: 'Omarchy diagnostics',
  omarchy_source: 'Omarchy source',
  omarchy_agent: 'Omarchy agents',
  omarchy_plugin: 'Omarchy plugins',
  omarchy_shell: 'Omarchy shell',
  omarchy_panel: 'Harness panel',
}

/**
 * Register one view per tool name. A name that is not registered keeps the
 * generic tool card, so this stays additive.
 * @param ctx - client root context with `slots` available.
 */
export function apply(ctx: Context): void {
  for (const tool of TOOLS) {
    ctx.slots.inject('tool.call.toolview', () =>
      ctx.slots.register({ name: 'tool.call.toolview', key: tool }, OmarchyToolRow),
    )
  }
  installPromptBridge()
}

const PROMPT_PARAM = 'dsh-prompt'
const PROMPT_HASH = '#dsh-prompt='

/**
 * The bar panel opens dsh web with ?dsh-prompt=... after a card click. Put that
 * text into the composer, then drop the parameter so an edit or reload never
 * re-inserts it. This only fills the input; it never sends.
 */
function installPromptBridge(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const url = new URL(window.location.href)
  let prompt = url.searchParams.get(PROMPT_PARAM)
  if (url.hash.startsWith(PROMPT_HASH)) {
    try {
      prompt = decodeURIComponent(url.hash.slice(PROMPT_HASH.length))
    } catch {
      prompt = null
    }
    url.hash = ''
  }
  if (prompt === null || prompt.trim() === '') return
  url.searchParams.delete(PROMPT_PARAM)
  const cleanUrl = url.pathname + (url.search === '' ? '' : url.search) + url.hash
  let attempts = 0
  const timer = window.setInterval(() => {
    attempts += 1
    if (insertComposerText(prompt)) {
      window.clearInterval(timer)
      window.history.replaceState(null, '', cleanUrl)
    } else if (attempts >= 40) {
      window.clearInterval(timer)
    }
  }, 250)
}

/**
 * Insert plain text at the end of the visible composer. The dsh composer is a
 * Lexical contenteditable; execCommand is the narrowest supported way to make
 * the edit participate in its input state.
 */
function insertComposerText(text: string): boolean {
  const editors = Array.from(document.querySelectorAll<HTMLElement>('[data-lexical-editor="true"]')).filter(
    (editor) => editor.isContentEditable && editor.getClientRects().length > 0,
  )
  if (editors.length === 0) return false
  const editor = editors.reduce((best, candidate) =>
    candidate.getBoundingClientRect().bottom > best.getBoundingClientRect().bottom ? candidate : best,
  )
  editor.focus()
  const selection = window.getSelection()
  if (selection === null) return false
  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
  return document.execCommand('insertText', false, text)
}

type Json = Record<string, unknown>

function asRecord(value: unknown): Json | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : undefined
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseJson(text: string): unknown {
  if (text.length === 0) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function resultText(content: readonly unknown[]): string {
  const parts: string[] = []
  for (const item of content) {
    const block = asRecord(item)
    if (block?.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n').trim()
}

function OmarchyToolRow(props: ToolCallViewProps) {
  const label = LABELS[props.toolName] ?? props.toolName

  if (props.phase !== 'result') {
    return (
      <Card label={label} summary="running…">
        <div style={muted}>Reading Omarchy state…</div>
      </Card>
    )
  }

  const block = props.block
  if (block.isError || block.error !== undefined) {
    const reason = block.error?.reason ?? block.error?.name ?? 'The tool failed.'
    return (
      <Card label={label} summary={block.error?.code ?? 'failed'} tone="error">
        <div style={muted}>{reason}</div>
      </Card>
    )
  }

  const text = resultText(block.content)
  const value = parseJson(text)
  return (
    <Card label={label} summary={summaryOf(props.toolName, value)}>
      <Body tool={props.toolName} value={value} text={text} />
    </Card>
  )
}

function summaryOf(tool: string, value: unknown): string | undefined {
  const v = asRecord(value)
  if (v === undefined) return undefined
  switch (tool) {
    case 'omarchy_status': {
      const theme = str(v.theme)
      const monitors = asArray(v.monitors).length
      return [theme, monitors > 0 ? `${monitors} display${monitors === 1 ? '' : 's'}` : undefined]
        .filter((part) => part !== undefined)
        .join(' · ') || undefined
    }
    case 'omarchy_catalog': {
      const count = num(v.count) ?? asArray(v.commands).length
      return `${count} command${count === 1 ? '' : 's'}`
    }
    case 'omarchy_theme': {
      if (str(v.action) === 'set') return str(v.theme) ?? (v.changed === true ? 'changed' : 'not changed')
      if (str(v.action) === 'list') return `${asArray(v.themes).length} themes`
      return str(v.theme)
    }
    case 'omarchy_hypr': {
      const target = str(v.target) ?? 'state'
      const data = asArray(v.data)
      return data.length > 0 ? `${target} · ${data.length}` : target
    }
    case 'omarchy_diagnose': {
      const crashes = asArray(v.crashes).length
      const failed = asArray(v.systemUnits).length + asArray(v.userUnits).length
      return `${crashes} crash${crashes === 1 ? '' : 'es'} · ${failed} failed unit${failed === 1 ? '' : 's'}`
    }
    case 'omarchy_source': {
      const matches = asArray(v.matches).length
      if (matches > 0) return `${matches} match${matches === 1 ? '' : 'es'}`
      const files = asArray(v.files).length
      return `${files} file${files === 1 ? '' : 's'}`
    }
    case 'omarchy_agent': {
      if (str(v.action) === 'usage') {
        const count = num(v.count) ?? asArray(v.records).length
        return `${count} usage record${count === 1 ? '' : 's'}`
      }
      const agent = str(v.defaultAgent) || 'none'
      return `default: ${agent} · dsh ${v.supportsDsh === true ? 'supported' : 'not listed'}`
    }
    case 'omarchy_plugin': {
      if (str(v.action) === 'validate') return v.ok === true ? 'valid' : 'invalid'
      const count = num(v.count) ?? asArray(v.plugins).length
      return `${count} plugin${count === 1 ? '' : 's'}`
    }
    case 'omarchy_shell':
      return str(v.action)
    case 'omarchy_panel':
      return str(v.action) === 'activate' ? `activate ${str(v.id) ?? ''}` : 'panel signals'
    default:
      return undefined
  }
}

function Body({ tool, value, text }: { tool: string; value: unknown; text: string }) {
  const v = asRecord(value)
  if (v === undefined) {
    return text.length > 0 ? <pre style={pre}>{text}</pre> : <div style={muted}>No result data.</div>
  }

  switch (tool) {
    case 'omarchy_status': {
      const active = asRecord(v.activeWindow)
      const failed = asArray(v.failedUserUnits)
      return (
        <>
          <Rows
            rows={[
              ['Theme', str(v.theme)],
              ['Hyprland', firstLine(str(v.hyprland))],
              ['Displays', asArray(v.monitors).length],
              ['Workspaces', asArray(v.workspaces).length],
              ['Active window', str(active?.title) ?? str(active?.class)],
              ['Failed user units', failed.length],
            ]}
          />
          <Raw value={v} />
        </>
      )
    }
    case 'omarchy_theme': {
      const themes = asArray(v.themes).map((theme) => str(theme)).filter((theme) => theme !== undefined)
      if (themes.length > 0) {
        return (
          <>
            <div style={chips}>
              {themes.map((theme) => (
                <span key={theme} style={chip}>
                  {theme}
                </span>
              ))}
            </div>
            <Raw value={v} />
          </>
        )
      }
      return (
        <>
          <Rows rows={[['Action', str(v.action)], ['Theme', str(v.theme)], ['Changed', v.changed === true]]} />
          <Raw value={v} />
        </>
      )
    }
    case 'omarchy_catalog': {
      const commands = asArray(v.commands).map(asRecord).filter((command): command is Json => command !== undefined)
      return (
        <>
          {commands.length === 0 ? <div style={muted}>No matching commands.</div> : null}
          {commands.slice(0, 8).map((command) => (
            <div key={str(command.route) ?? JSON.stringify(command)} style={row}>
              <code style={code}>{str(command.route) ?? '?'}</code>
              <span style={muted}>{str(command.summary) ?? ''}</span>
            </div>
          ))}
          <Raw value={v} />
        </>
      )
    }
    case 'omarchy_hypr': {
      return (
        <>
          <Rows rows={[['Target', str(v.target)], ['Entries', asArray(v.data).length]]} />
          <Raw value={v} />
        </>
      )
    }
    case 'omarchy_diagnose': {
      const crashes = asArray(v.crashes).map((crash) => str(crash)).filter((crash) => crash !== undefined)
      const units = [...asArray(v.systemUnits), ...asArray(v.userUnits)]
        .map((unit) => str(unit))
        .filter((unit) => unit !== undefined)
      return (
        <>
          <Rows rows={[['Crashes', crashes.length], ['Failed units', units.length]]} />
          {crashes.slice(0, 4).map((crash) => (
            <div key={crash} style={muted}>
              {crash}
            </div>
          ))}
          {units.slice(0, 4).map((unit) => (
            <div key={unit} style={muted}>
              <code style={code}>{unit}</code>
            </div>
          ))}
          <Raw value={v} />
        </>
      )
    }
    case 'omarchy_source': {
      const matches = asArray(v.matches).map(asRecord).filter((match): match is Json => match !== undefined)
      const files = asArray(v.files).map(asRecord).filter((file): file is Json => file !== undefined)
      return (
        <>
          {matches.slice(0, 8).map((match) => (
            <div key={`${str(match.file)}:${num(match.line)}`} style={muted}>
              <code style={code}>
                {str(match.file) ?? '?'}:{num(match.line) ?? 0}
              </code>
            </div>
          ))}
          {files.slice(0, 8).map((file) => (
            <div key={str(file.path) ?? '?'} style={muted}>
              <code style={code}>{str(file.path) ?? '?'}</code>
            </div>
          ))}
          <Raw value={v} />
        </>
      )
    }
    case 'omarchy_agent': {
      const records = asArray(v.records).map(asRecord).filter((record): record is Json => record !== undefined)
      return (
        <>
          <Rows
            rows={[
              ['Default', str(v.defaultAgent) || 'none'],
              ['dsh listed', v.supportsDsh === true],
              ['dsh installed', v.dshInstalled === true],
              ['Usage collector', v.usageCollector === true],
              ['Agents panel', v.agentsPanel === true],
            ]}
          />
          {records.slice(0, 8).map((record) => (
            <div key={str(record.id) ?? '?'} style={row}>
              <code style={code}>{str(record.id) ?? '?'}</code>
              <span style={muted}>{str(record.usageStatusText) || str(record.tierLabel) || ''}</span>
            </div>
          ))}
          <Raw value={v} />
        </>
      )
    }
    case 'omarchy_plugin': {
      const plugins = asArray(v.plugins).map(asRecord).filter((plugin): plugin is Json => plugin !== undefined)
      return (
        <>
          {str(v.action) === 'validate' ? (
            <Rows rows={[['Valid', v.ok === true], ['Path', str(v.path)]]} />
          ) : (
            plugins.slice(0, 8).map((plugin) => (
              <div key={str(plugin.id) ?? '?'} style={row}>
                <code style={code}>{str(plugin.id) ?? '?'}</code>
                <span style={muted}>{plugin.enabled === true ? 'enabled' : 'disabled'}</span>
              </div>
            ))
          )}
          <Raw value={v} />
        </>
      )
    }
    case 'omarchy_shell': {
      const data = v.data
      return (
        <>
          <Rows
            rows={[
              ['Action', str(v.action)],
              ['Entries', Array.isArray(data) ? data.length : undefined],
            ]}
          />
          <Raw value={v} />
        </>
      )
    }
    default:
      return <Raw value={v} />
  }
}

function Rows({ rows }: { rows: Array<[string, unknown]> }) {
  const visible = rows.filter(([, value]) => value !== undefined && value !== '')
  if (visible.length === 0) return null
  return (
    <div style={grid}>
      {visible.map(([name, value]) => (
        <Row key={name} name={name} value={String(value)} />
      ))}
    </div>
  )
}

function Row({ name, value }: { name: string; value: string }) {
  return (
    <div style={row}>
      <span style={muted}>{name}</span>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  )
}

function Raw({ value }: { value: unknown }) {
  return (
    <details style={{ marginTop: 6 }}>
      <summary style={summaryStyle}>Raw JSON</summary>
      <pre style={pre}>{JSON.stringify(value, null, 2)}</pre>
    </details>
  )
}

function firstLine(value: string | undefined): string | undefined {
  return value?.split('\n')[0]
}

function Card({
  label,
  summary,
  tone,
  children,
}: {
  label: string
  summary?: string | undefined
  tone?: 'error' | undefined
  children: ReactNode
}) {
  return (
    <div style={{ ...card, ...(tone === 'error' ? { borderColor: 'rgba(255, 99, 99, 0.55)' } : {}) }}>
      <div style={header}>
        <span
          style={{
            ...dot,
            background: tone === 'error' ? '#ff6363' : 'currentColor',
            opacity: tone === 'error' ? 1 : 0.55,
          }}
        />
        <span style={{ fontWeight: 600 }}>{label}</span>
        {summary !== undefined && summary.length > 0 ? <span style={muted}>{summary}</span> : null}
      </div>
      {children}
    </div>
  )
}

const card: CSSProperties = {
  border: '1px solid rgba(127, 127, 127, 0.28)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  lineHeight: 1.45,
  overflow: 'hidden',
}

const header: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }

const dot: CSSProperties = { width: 7, height: 7, borderRadius: 999, flex: '0 0 auto' }

const muted: CSSProperties = { opacity: 0.7, fontSize: 12 }

const grid: CSSProperties = { display: 'grid', gap: 2 }

const row: CSSProperties = { display: 'flex', gap: 8, minWidth: 0, justifyContent: 'space-between' }

const code: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }

const pre: CSSProperties = {
  margin: '6px 0 0',
  padding: 8,
  borderRadius: 6,
  background: 'rgba(127, 127, 127, 0.12)',
  fontSize: 11,
  lineHeight: 1.4,
  overflow: 'auto',
  maxHeight: 240,
}

const summaryStyle: CSSProperties = { cursor: 'pointer', fontSize: 12, opacity: 0.7 }

const chips: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 4 }

const chip: CSSProperties = {
  border: '1px solid rgba(127, 127, 127, 0.28)',
  borderRadius: 999,
  padding: '1px 8px',
  fontSize: 12,
}
