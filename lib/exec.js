import { execFile } from 'node:child_process';
/**
 * Run one command without a shell and resolve its bounded outcome. Never throws
 * for a non-zero exit or spawn failure; callers inspect {@link CommandOutcome.ok}.
 * @param bin - executable name or absolute path.
 * @param args - literal argv entries; never interpolated into a shell string.
 * @param options - cancellation, timeout, and optional working directory.
 * @returns the command outcome.
 */
export function run(bin, args, options) {
    return new Promise((resolve) => {
        execFile(bin, [...args], {
            signal: options.signal,
            cwd: options.cwd,
            timeout: options.timeoutMs,
            maxBuffer: 8 * 1024 * 1024,
            encoding: 'utf8',
        }, (error, stdout, stderr) => {
            const out = stdout.trim();
            const err = stderr.trim();
            if (error) {
                const code = typeof error.code === 'number' ? error.code : -1;
                resolve({ ok: false, stdout: out, stderr: err || error.message, code });
                return;
            }
            resolve({ ok: true, stdout: out, stderr: err, code: 0 });
        });
    });
}
/**
 * Parse a JSON command result, returning `undefined` on malformed output instead
 * of throwing into the tool body.
 * @param text - raw command stdout.
 * @returns the parsed value, or `undefined`.
 */
export function parseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
/** Non-empty, trimmed lines of one command output. */
export function lines(text) {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}
