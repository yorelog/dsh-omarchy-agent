/**
 * General-purpose Omarchy capabilities for DeepSeek Harness: read-only state
 * tools, a command catalog, theme and Hyprland control, diagnostics, a
 * package-ownership guard, and model-facing conventions.
 *
 * @module dsh-omarchy-agent
 */
import type { Context } from '@deepseek-ai/cordis';
import { Config } from './config.js';
export { Config };
/** Cordis plugin name. */
export declare const name = "dsh-omarchy-agent";
/** Services this plugin requires before `apply` runs. */
export declare const inject: string[];
/**
 * Install every Omarchy contribution: tools, the safety guard, and the prompt
 * conventions section.
 * @param ctx - plugin context with `tools` and `systemPrompt` available.
 * @param config - configuration validated by {@link Config}.
 */
export declare function apply(ctx: Context, config: Config): void;
