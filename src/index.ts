/**
 * General-purpose Omarchy capabilities for DeepSeek Harness: read-only state
 * tools, a command catalog, theme and Hyprland control, diagnostics, a
 * package-ownership guard, and model-facing conventions.
 *
 * @module dsh-omarchy-agent
 */
import type { Context } from '@deepseek-ai/cordis'
import { Config } from './config.js'
import { applyGuard } from './guard.js'
import { applyPrompt } from './prompt.js'
import { startPromptBroker } from './prompt-broker.js'
import { applyTools } from './tools.js'

export { Config }

/** Cordis plugin name. */
export const name = 'dsh-omarchy-agent'

/** Services this plugin requires before `apply` runs. */
export const inject = ['tools', 'systemPrompt']

/**
 * Install every Omarchy contribution: tools, the safety guard, and the prompt
 * conventions section.
 * @param ctx - plugin context with `tools` and `systemPrompt` available.
 * @param config - configuration validated by {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  // The broker is a live-host concern; small test harnesses have no effect
  // scope, and binding a real loopback port there would also keep them open.
  if (typeof ctx.effect === 'function') {
    const broker = startPromptBroker()
    ctx.effect(() => () => broker.close(), 'omarchy: prompt broker')
  }
  applyTools(ctx, config)
  applyGuard(ctx, config)
  applyPrompt(ctx, config)
}
