import { homedir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './config.js'

/** Tool names whose `path` argument is a filesystem mutation target. */
const PATH_MUTATING_TOOLS = new Set(['write', 'edit', 'str_replace_editor', 'apply_patch', 'notebook_edit'])

/** Tokens that, when they appear in a shell command, look like a write. */
const WRITE_HINTS = /\b(rm|mv|cp|chmod|chown|truncate|tee|dd|install|touch|mkdir|ln|patch|sed|perl|python3?|ruby|node|awk)\b|>>?/

const PRIVILEGED = /\b(sudo|pkexec|pacman|yay|paru|makepkg)\b/
const OMARCHY_UPDATE = /\bomarchy\s+update\b/
const SYSTEM_MUTATION = /\bsystemctl\b[^|;&]*(start|stop|restart|enable|disable|mask|unmask|daemon-reload)\b/
const POWER = /\b(reboot|shutdown|poweroff|halt)\b/

function normalize(candidate: string): string {
  let value = candidate.trim()
  if (value.startsWith('~/')) value = `${homedir()}${value.slice(1)}`
  return value.replace(/\/{2,}/g, '/')
}

function isProtected(candidate: string, protectedPath: string): boolean {
  if (candidate.length === 0) return false
  const value = normalize(candidate)
  const root = normalize(protectedPath).replace(/\/+$/, '')
  return value === root || value.startsWith(`${root}/`) || value.includes(`${root}/`)
}

function shellReferencesProtected(command: string, protectedPath: string): boolean {
  if (isProtected(command, protectedPath)) return true
  return /\$\{?OMARCHY_PATH\}?/.test(command)
}

function stringArg(args: unknown, keys: readonly string[]): string {
  if (args === null || typeof args !== 'object') return ''
  const record = args as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string') return value
  }
  return ''
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
export function applyGuard(ctx: Context, config: Config): void {
  ctx.on('tools/pre-execute', async (exec, next) => {
    const name = exec.name
    if (PATH_MUTATING_TOOLS.has(name)) {
      const target = stringArg(exec.arguments, ['path', 'file_path', 'filePath', 'notebook_path'])
      if (isProtected(target, config.protectedPath)) {
        return {
          kind: 'deny',
          reason: `${config.protectedPath} is package-owned and is overwritten on update. Put user changes under ~/.config/omarchy instead.`,
        }
      }
      return next()
    }

    if (name !== 'bash' && name !== 'pwsh') return next()

    const command = stringArg(exec.arguments, ['command', 'cmd'])
    if (command.length === 0) return next()

    if (shellReferencesProtected(command, config.protectedPath)) {
      const looksLikeWrite = WRITE_HINTS.test(command) || />{1,2}/.test(command)
      if (looksLikeWrite) {
        return {
          kind: 'deny',
          reason: `${config.protectedPath} is package-owned and is overwritten on update. Read it freely, but write user changes under ~/.config/omarchy.`,
        }
      }
    }

    const privilegedToken = config.privilegedTokens.find((token) =>
      new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(command),
    )
    if (
      privilegedToken !== undefined ||
      PRIVILEGED.test(command) ||
      OMARCHY_UPDATE.test(command) ||
      SYSTEM_MUTATION.test(command) ||
      POWER.test(command)
    ) {
      return {
        kind: 'ask',
        reason: `Privileged or system-mutating command requires approval: ${command.slice(0, 200)}`,
        displayReason: {
          en: 'The Omarchy agent wants to run a privileged or system-mutating command. Allow it?',
        },
      }
    }

    return next()
  })
}
