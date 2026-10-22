/** Fixed loopback port shared by the panel and the client plugin. */
export declare const PROMPT_PORT = 3081;
/** The live broker handle. */
export interface PromptBroker {
    /** The port that actually bound, or the requested port before `ready`. */
    readonly port: number;
    /** Resolves true once listening, false if the port could not be bound. */
    readonly ready: Promise<boolean>;
    /** Stop accepting prompts. */
    close(): void;
}
/**
 * Store one pending prompt for the dsh web client.
 * @param port - loopback port; pass 0 in tests for an OS-assigned port.
 * @returns the broker handle; callers close it on plugin disposal.
 */
export declare function startPromptBroker(port?: number): PromptBroker;
