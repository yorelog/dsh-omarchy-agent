import Schema from '@deepseek-ai/schemastery';
/** Runtime schema; defaults apply when a profile row omits `config`. */
export const Config = Schema.object({
    omarchyBin: Schema.string().default('omarchy'),
    protectedPath: Schema.string().default('/usr/share/omarchy'),
    privilegedTokens: Schema.array(Schema.string()).default([
        'sudo',
        'pkexec',
        'pacman',
        'yay',
        'paru',
        'makepkg',
    ]),
    commandTimeoutMs: Schema.number().default(15000),
});
