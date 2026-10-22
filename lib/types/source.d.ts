import type { Context } from '@deepseek-ai/cordis';
import type { Config } from './config.js';
/** One file found by {@link searchSource}. */
export interface SourceFile {
    /** Path relative to the Omarchy root. */
    path: string;
    /** File size in bytes. */
    size: number;
}
/** One matching line with its surrounding context. */
export interface SourceMatch {
    /** Path relative to the Omarchy root. */
    file: string;
    /** 1-based line number of the match. */
    line: number;
    /** Context lines, each prefixed with its line number. */
    excerpt: string;
}
/** Result of one read-only source search. */
export interface SourceResult {
    root: string;
    path: string;
    query: string;
    glob: string;
    files: SourceFile[];
    matches: SourceMatch[];
    scanned: number;
    truncated: boolean;
    errors: string[];
}
/** Inputs for {@link searchSource}. */
export interface SearchOptions {
    root: string;
    path?: string;
    query?: string;
    glob?: string;
    context?: number;
    limit?: number;
    signal?: AbortSignal;
}
/**
 * Search Omarchy's package-owned docs, skills, and shell source without
 * executing anything. Paths are resolved beneath `root`, symlinks are skipped,
 * and only small text files are read.
 * @param options - root, optional path/query/glob, and result limits.
 * @returns matches (or a file listing when no query is given) plus any errors.
 */
export declare function searchSource(options: SearchOptions): Promise<SourceResult>;
/**
 * Register the read-only `omarchy_source` tool.
 * @param ctx - plugin context with `tools` injected.
 * @param config - resolved plugin configuration; its protected path is the root.
 */
export declare function registerSource(ctx: Context, config: Config): void;
