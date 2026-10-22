import type { Context } from '@deepseek-ai/cordis';
import type { Config } from './config.js';
/**
 * Read the coding-agent surface without changing it: the selected default,
 * whether dsh is listed and installed, and the records the Omarchy agents panel
 * consumes. No command here selects, installs, or launches an agent.
 * @param ctx - plugin context with `tools` injected.
 * @param config - resolved plugin configuration.
 */
export declare function registerInspectTools(ctx: Context, config: Config): void;
