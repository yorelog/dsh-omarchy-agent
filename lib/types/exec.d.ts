import type { JsonValue } from '@deepseek-ai/dsh-util-values';
/** One spawned command's bounded outcome. */
export interface CommandOutcome {
    /** Whether the process exited zero. */
    ok: boolean;
    /** Trimmed standard output. */
    stdout: string;
    /** Trimmed standard error, or the process error message. */
    stderr: string;
    /** Exit code, or `-1` when the process failed before exit. */
    code: number;
}
/** Options for one {@link run} invocation. */
export interface RunOptions {
    /** Caller cancellation forwarded to the child process. */
    signal: AbortSignal;
    /** Per-command wall-clock budget in milliseconds. */
    timeoutMs: number;
    /** Working directory; defaults to the Harness process directory. */
    cwd?: string;
}
/**
 * Run one command without a shell and resolve its bounded outcome. Never throws
 * for a non-zero exit or spawn failure; callers inspect {@link CommandOutcome.ok}.
 * @param bin - executable name or absolute path.
 * @param args - literal argv entries; never interpolated into a shell string.
 * @param options - cancellation, timeout, and optional working directory.
 * @returns the command outcome.
 */
export declare function run(bin: string, args: readonly string[], options: RunOptions): Promise<CommandOutcome>;
/**
 * Parse a JSON command result, returning `undefined` on malformed output instead
 * of throwing into the tool body.
 * @param text - raw command stdout.
 * @returns the parsed value, or `undefined`.
 */
export declare function parseJson(text: string): JsonValue | undefined;
/** Non-empty, trimmed lines of one command output. */
export declare function lines(text: string): string[];
