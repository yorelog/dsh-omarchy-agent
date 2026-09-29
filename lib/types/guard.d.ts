import type { Context } from '@deepseek-ai/cordis';
import type { Config } from './config.js';
/**
 * Register the Omarchy safety gate on the tool pre-execute waterfall.
 *
 * The gate denies mutations of the package-owned Omarchy tree and routes
 * privileged or system-mutating shell commands through the approval service.
 * It never rewrites a call; it only allows, denies, or asks.
 * @param ctx - plugin context with `tools` injected.
 * @param config - resolved plugin configuration.
 */
export declare function applyGuard(ctx: Context, config: Config): void;
