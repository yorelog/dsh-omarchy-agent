import type { Context } from '@deepseek-ai/cordis';
import type { Config } from './config.js';
/**
 * Register the Omarchy safety gate on the tool pre-execute waterfall.
 *
 * The gate always denies mutations of the package-owned Omarchy tree; in
 * `danger-full-access` there is no sandbox left to catch that write. It routes
 * privileged or system-mutating shell commands through the approval service
 * only when `privilegedTokens` is non-empty, because Omarchy launches its
 * default agents with full access and an `ask` without an approval service
 * degrades to deny. It never rewrites a call; it only allows, denies, or asks.
 * @param ctx - plugin context with `tools` injected.
 * @param config - resolved plugin configuration.
 */
export declare function applyGuard(ctx: Context, config: Config): void;
