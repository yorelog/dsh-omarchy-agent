import { Config } from './config.js';
import { applyGuard } from './guard.js';
import { applyPrompt } from './prompt.js';
import { applyTools } from './tools.js';
export { Config };
/** Cordis plugin name. */
export const name = 'dsh-omarchy-agent';
/** Services this plugin requires before `apply` runs. */
export const inject = ['tools', 'systemPrompt'];
/**
 * Install every Omarchy contribution: tools, the safety guard, and the prompt
 * conventions section.
 * @param ctx - plugin context with `tools` and `systemPrompt` available.
 * @param config - configuration validated by {@link Config}.
 */
export function apply(ctx, config) {
    applyTools(ctx, config);
    applyGuard(ctx, config);
    applyPrompt(ctx, config);
}
