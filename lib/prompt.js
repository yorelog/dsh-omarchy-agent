/** Stable section name; a second registration with this name in the same scope throws. */
export const SECTION_NAME = 'dsh-omarchy-agent:conventions';
/** Order places these conventions just after the persona and before tool guidance. */
export const SECTION_ORDER = 40;
/**
 * Register the Omarchy conventions section on the system-prompt registry.
 * @param ctx - plugin context with `systemPrompt` injected.
 * @param config - resolved plugin configuration.
 */
export function applyPrompt(ctx, config) {
    const section = {
        name: SECTION_NAME,
        order: SECTION_ORDER,
        text: () => [
            'This machine runs Omarchy (Arch Linux with Hyprland).',
            'Prefer first-class Omarchy tooling over hand-editing files: discover commands with the omarchy_catalog tool, and read state with omarchy_status, omarchy_hypr, and omarchy_theme before proposing changes.',
            'User configuration lives under ~/.config/omarchy and ~/.config/hypr; themes and background selection are managed with the omarchy theme commands.',
            `Never modify anything under ${config.protectedPath}: it is package-owned and is overwritten on update. Editing it is denied.`,
            'Privileged operations (sudo, pkexec, package managers, omarchy update, power actions) require explicit user approval; explain what a command changes before running it.',
            'Hyprland configuration edits should be followed by an omarchy_hypr reload.',
        ].join('\n'),
    };
    ctx.systemPrompt.section(section);
}
