import Schema from '@deepseek-ai/schemastery'

/** Plugin configuration for the Omarchy agent bundle. */
export interface Config {
  /** The Omarchy command binary to invoke. */
  omarchyBin: string
  /** Package-owned path the agent must never modify; reads stay allowed. */
  protectedPath: string
  /** Command tokens that require explicit user approval before dispatch. */
  privilegedTokens: string[]
  /** Timeout for one spawned Omarchy or hyprctl command, in milliseconds. */
  commandTimeoutMs: number
}

/** Runtime schema; defaults apply when a profile row omits `config`. */
export const Config: Schema<Config> = Schema.object({
  omarchyBin: Schema.string().default('omarchy'),
  protectedPath: Schema.string().default('/usr/share/omarchy'),
  privilegedTokens: Schema.array(Schema.string()).default([
    'sudo',
    'pkexec',
    'pacman',
    'yay',
    'paru',
    'makepkg',
  ]),
  commandTimeoutMs: Schema.number().default(15000),
})
