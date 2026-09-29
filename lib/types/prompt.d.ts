import type { Context } from '@deepseek-ai/cordis';
import type { Config } from './config.js';
/** Stable section name; a second registration with this name in the same scope throws. */
export declare const SECTION_NAME = "dsh-omarchy-agent:conventions";
/** Order places these conventions just after the persona and before tool guidance. */
export declare const SECTION_ORDER = 40;
/**
 * Register the Omarchy conventions section on the system-prompt registry.
 * @param ctx - plugin context with `systemPrompt` injected.
 * @param config - resolved plugin configuration.
 */
export declare function applyPrompt(ctx: Context, config: Config): void;
