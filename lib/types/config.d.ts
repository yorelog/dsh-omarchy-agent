import Schema from '@deepseek-ai/schemastery';
/** Plugin configuration for the Omarchy agent bundle. */
export interface Config {
    /** The Omarchy command binary to invoke. */
    omarchyBin: string;
    /** Package-owned path the agent must never modify; reads stay allowed. */
    protectedPath: string;
    /** Command tokens that require explicit user approval before dispatch. */
    privilegedTokens: string[];
    /** Timeout for one spawned Omarchy or hyprctl command, in milliseconds. */
    commandTimeoutMs: number;
}
/** Runtime schema; defaults apply when a profile row omits `config`. */
export declare const Config: Schema<Config>;
