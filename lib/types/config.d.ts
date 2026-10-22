import Schema from '@deepseek-ai/schemastery';
/** Plugin configuration for the Omarchy agent bundle. */
export interface Config {
    /** The Omarchy command binary to invoke. */
    omarchyBin: string;
    /** Package-owned path the agent must never modify; reads stay allowed. */
    protectedPath: string;
    /**
     * Command tokens that require explicit user approval before dispatch.
     *
     * Empty by default: Omarchy launches its default agents with full access, so
     * gating privileged commands here would only block what the launcher
     * promised. Set a list to opt back into approval for those tokens.
     */
    privilegedTokens: string[];
    /** Timeout for one spawned Omarchy or hyprctl command, in milliseconds. */
    commandTimeoutMs: number;
}
/** Runtime schema; defaults apply when a profile row omits `config`. */
export declare const Config: Schema<Config>;
