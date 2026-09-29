import type { Context } from '@deepseek-ai/cordis';
import type { Config } from './config.js';
/**
 * Register the Omarchy model-facing tools on the calling context's tool registry.
 * @param ctx - plugin context with `tools` injected.
 * @param config - resolved plugin configuration.
 */
export declare function applyTools(ctx: Context, config: Config): void;
