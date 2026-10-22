import Schema from '@deepseek-ai/schemastery'

/** Default package-owned tree: the running session's Omarchy checkout, else the packaged path. */
const DEFAULT_PROTECTED_PATH = (process.env.OMARCHY_PATH ?? '').trim().replace(/\/+$/, '') || '/usr/share/omarchy'

/** Plugin configuration for the Omarchy agent bundle. */
export interface Config {
  /** The Omarchy command binary to invoke. */
  omarchyBin: string
  /** Package-owned Omarchy tree; reads stay allowed and omarchy_source searches it. */
  protectedPath: string
  /**
   * Command tokens that require explicit user approval before dispatch.
   *
   * Empty by default: Omarchy launches its default agents with full access, so
   * gating privileged commands here would only block what the launcher
   * promised. Set a list to opt back into approval for those tokens.
   */
  privilegedTokens: string[]
  /** Timeout for one spawned Omarchy or hyprctl command, in milliseconds. */
  commandTimeoutMs: number
}

/** Runtime schema; defaults apply when a profile row omits `config`. */
export const Config: Schema<Config> = Schema.object({
  omarchyBin: Schema.string().default('omarchy'),
  protectedPath: Schema.string().default(DEFAULT_PROTECTED_PATH),
  privilegedTokens: Schema.array(Schema.string()).default([]),
  commandTimeoutMs: Schema.number().default(15000),
})
