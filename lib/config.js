import Schema from '@deepseek-ai/schemastery';
/** Default package-owned tree: the running session's Omarchy checkout, else the packaged path. */
const DEFAULT_PROTECTED_PATH = (process.env.OMARCHY_PATH ?? '').trim().replace(/\/+$/, '') || '/usr/share/omarchy';
/** Runtime schema; defaults apply when a profile row omits `config`. */
export const Config = Schema.object({
    omarchyBin: Schema.string().default('omarchy'),
    protectedPath: Schema.string().default(DEFAULT_PROTECTED_PATH),
    privilegedTokens: Schema.array(Schema.string()).default([]),
    commandTimeoutMs: Schema.number().default(15000),
});
