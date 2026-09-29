# dsh-omarchy-agent

Turn the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
(`dsh`) into a general-purpose, Omarchy-aware agent: a selectable
**Omarchy General** agent preset, first-class Omarchy tools, a safety guard for
package-owned files, and one-command desktop integration for
[Omarchy](https://omarchy.org/) (Arch Linux + Hyprland).

It wires the dsh terminal UI into Omarchy's default-agent system, so
`omarchy agent`, the Agent keybinding, and the picker all open the dsh TUI.
The browser web UI stays one flag away (`dsh-agent --web`).

No file under `/usr/share/omarchy` is ever modified.

## Quickstart

Install as an Omarchy shell plugin (one command; the plugin's service runs the
same installer once, asynchronously):

```sh
omarchy plugin add https://github.com/yorelog/dsh-omarchy-agent --enable
```

Or run the installer directly from a checkout:

```sh
git clone https://github.com/yorelog/dsh-omarchy-agent.git
cd dsh-omarchy-agent
./install.sh
```

Then set your key and launch:

```sh
export DEEPSEEK_API_KEY=sk-...     # or configure it in the dsh Models page
dsh-agent                          # opens the dsh TUI
```

Press **SUPER + SHIFT + CTRL + A** or run
`omarchy menu summon setup.default.agent` and pick **DeepSeek Harness**.

Prefer to see the changes first? `./install.sh --dry-run`.

The Omarchy plugin path installs the plugin to
`~/.config/omarchy/plugins/dsh-omarchy-agent/`. Its service detects that the
agent integration is missing and runs the bundled `install.sh --yes` in the
background, logging to `~/.local/state/dsh-omarchy-agent/install.log` and
sending a notification when it finishes. It never repeats on later shell
starts. Remove it again with `omarchy plugin remove dsh-omarchy-agent` **after**
running `./uninstall.sh` from the plugin directory.

## What the installer does

1. Checks for `dsh` and `pnpm`, installing them with `mise` if needed.
2. Creates the `omarchy` web profile (from the shipped `web` template) and
   installs this bundle into it.
3. Creates an `omarchy-headless` profile for one-shot prompts.
4. Creates the `tui` profile (`@deepseek-ai/dsh-base` + a TUI bundle) and
   installs this bundle into it too.
5. Installs the `dsh-agent` launcher to `~/.local/bin`.
6. Installs user-owned `omarchy` shims so `omarchy agent` and
   `omarchy default agent dsh` reach dsh.
7. Adds a **DeepSeek Harness** row to the Omarchy agent picker.
8. Sets **dsh** as the Omarchy default agent.
9. Overrides the `a` shell alias and the Agent keybinding so both reach dsh.

Every step is idempotent, and each can be disabled:
`--no-default`, `--no-menu`, `--no-alias`, `--no-keybind`, `--no-headless`,
`--no-tui`, `--no-shim`.

## What you get

| Contribution | Kind | Effect |
|---|---|---|
| `omarchy_status` | Tool | Distro build, theme, Hyprland version, monitors, workspaces, active window, failed user units. |
| `omarchy_catalog` | Tool | Searches `omarchy commands --json` for routes, usage, and sudo requirements. |
| `omarchy_theme` | Tool | Lists themes, reads the current theme, or applies one. |
| `omarchy_hypr` | Tool | Reads live Hyprland state as JSON or reloads the configuration. |
| `omarchy_diagnose` | Tool | Recent crashes and failed system/user units. |
| Guard | `tools/pre-execute` | Denies writes under `/usr/share/omarchy`; asks approval for privileged or system-mutating shell commands. |
| Conventions | System prompt | Prefer Omarchy tooling, read before changing, keep user changes under `~/.config`. |
| `omarchy-general` | Agent preset | A general-purpose coding agent with an Omarchy-aware persona. |

## Using the agent

```sh
dsh-agent                      # opens the dsh TUI for the `tui` profile
dsh-agent --inline             # same, in the current terminal
dsh-agent --web                # browser web UI for the `omarchy` profile
dsh-agent --prompt "reload hyprland and set Tokyo Night"   # one-shot
dsh-agent --pick               # open the Omarchy agent picker
dsh-agent --set pi             # switch the default agent back to pi

omarchy agent                  # the same TUI launch through the Omarchy command
omarchy default agent dsh      # select dsh as the Omarchy default
omarchy agent crash <pid>      # crash diagnosis reaches dsh too
```

In the dsh TUI or web UI, choose **Omarchy General** in the session's agent
preset selector. The Omarchy tools, guard, and conventions are registered
globally in both profiles, so every preset inherits them.

## Omarchy integration details

All integration lives under `$HOME`:

| File | Purpose |
|---|---|
| `~/.local/bin/dsh-agent` | Launcher that mirrors `omarchy-agent` and supports dsh; opens the TUI, or `--web` for the browser. |
| `~/.dsh/profiles/tui/` | TUI profile: `@deepseek-ai/dsh-base` + the TUI bundle + this bundle. |
| `~/.local/share/dsh-omarchy-agent/bin/` | `omarchy`, `omarchy-agent`, `omarchy-default-agent` shims that teach the stock commands dsh. |
| `~/.config/omarchy/extensions/omarchy-menu.jsonc` | Adds the **DeepSeek Harness** row to the agent picker. |
| `~/.config/omarchy/defaults/agent` | Stores `dsh` as the default agent. |
| `~/.config/environment.d/50-dsh-omarchy-agent.conf` | Prepends the shim directory to the session `PATH`. |
| `~/.config/fish/conf.d/dsh-omarchy-agent.fish` | Prepends the shim directory to fish's `PATH`. |
| `~/.config/hypr/bindings.lua` | Rebinds `SUPER + SHIFT + CTRL + A` to `dsh-agent`. |
| `~/.bashrc` | Prepends the shim directory and overrides the `a` alias to `dsh-agent --inline`. |

Why a wrapper? `/usr/bin/omarchy-agent` and `/usr/bin/omarchy-default-agent`
hardcode their agent list and reject unknown names, and the `omarchy` router
resolves subcommands from its own directory rather than `PATH`. dsh therefore
cannot register itself there without editing package-owned files. The installer
puts three user-owned shims ahead of the packaged commands on `PATH`:
`omarchy` intercepts `omarchy agent` and `omarchy default agent dsh` and
delegates everything else to the stock router; `omarchy-agent` and
`omarchy-default-agent` add dsh to the direct-call paths (`omarchy agent crash`,
`omarchy agent prompt`, the picker). `dsh-agent` remains the underlying
launcher and delegates every other agent back to the stock commands unchanged.
The session `PATH` comes from `~/.config/environment.d/`, so it applies after
the next login; new interactive shells pick it up immediately.

## Manual install

If you only want the bundle (e.g. for an existing profile):

```sh
dsh plugin --profile omarchy add ./dsh-omarchy-agent
dsh --profile omarchy --dump-config | grep dsh-omarchy-agent   # verify
```

Install the launcher and menu row yourself by copying
`assets/dsh-agent` into `~/.local/bin` and running
`python3 scripts/merge-omarchy-menu.py`.

## Configuration

Override the bundle row in the profile's `cordis.patch.yml`
(`$DSH_HOME/profiles/omarchy/cordis.patch.yml`):

```yaml
- id: omarchy-agent
  config:
    omarchyBin: omarchy
    protectedPath: /usr/share/omarchy
    commandTimeoutMs: 30000
    privilegedTokens: [sudo, pkexec, pacman, yay, paru, makepkg]
```

| Field | Default | Meaning |
|---|---|---|
| `omarchyBin` | `omarchy` | Binary used for Omarchy commands. |
| `protectedPath` | `/usr/share/omarchy` | Package-owned tree that mutations are denied against. |
| `privilegedTokens` | `[sudo, pkexec, pacman, yay, paru, makepkg]` | Shell tokens that require approval. |
| `commandTimeoutMs` | `15000` | Per-command timeout for spawned Omarchy/hyprctl commands. |

## Safety

- The guard is defense-in-depth, not a sandbox. Tools run with the Harness
  process's OS permissions.
- Reads of `/usr/share/omarchy` are allowed; writes through `write`, `edit`,
  `str_replace_editor`, `apply_patch`, or `bash`/`pwsh` are denied.
- `sudo`, `pkexec`, package managers, `omarchy update`, mutating `systemctl`,
  and power actions return an `ask` decision through dsh's approval service.
  Without an approval service, `ask` degrades to deny.
- The guard does not inspect arbitrary code run through PTC `run_code`; use a
  sandboxed shell or disable PTC mode if that matters.

## Troubleshooting

- **The agent does not answer** — set `DEEPSEEK_API_KEY` or configure it in the
  dsh Models page; dsh keeps its own credentials, separate from other agents.
- **Port 3080 already in use** — a dsh web profile is already running. Close it
  or open the printed URL instead of launching a second one.
- **The keybinding does nothing** — check `hyprctl configerrors` and confirm the
  `-- dsh-omarchy-agent: begin` block is present in `~/.config/hypr/bindings.lua`.
- **`dsh-agent` not found in a shell** — `~/.local/bin` must be on `PATH`
  (Omarchy adds it; open a new shell after install).
- **`omarchy agent` still hits the stock launcher** — a shell already running
  before the install keeps its old `PATH`; open a new terminal, or run
  `exec fish` once. Confirm with `command -v omarchy`, which must name
  `~/.local/share/dsh-omarchy-agent/bin/omarchy`. For Hyprland/the menu, the
  installer pushes the shim into the systemd user and D-Bus environments, but a
  full session only gets it on the next login via
  `~/.config/environment.d/50-dsh-omarchy-agent.conf`.
- **`dsh plugin` says pnpm was not found** — `mise use -g pnpm@latest`.

## Uninstall

```sh
./uninstall.sh          # removes the bundle, launcher, shims, menu row, alias, keybind
```

Profiles and the dsh install are left in place.

## Development

```sh
mise run install       # npm install
mise run build         # tsc -> lib/
mise run test          # build + keyless smoke test
mise run pack          # show the npm tarball contents
```

The bundle is a standard Cordis plugin: `src/index.ts` exports `name`, `inject`,
`Config`, and `apply`, and registers tools, the guard, and the prompt section.

## Model Experience

The bundle registers five tools and one system-prompt section. Tool schemas and
the conventions text are model-visible and are logged by the session.

- **Token effect** — conditional: tool schemas add fixed tokens while visible,
  and the conventions section adds a short fixed block to every request.
- **KV Cache effect** — append-only. The section text changes only with plugin
  configuration; the tools do not rewrite earlier request tokens.

## Known Limitations

- **Preset snapshot** — `presets/omarchy-general.patch.yml` mirrors the shipped
  `standard` preset of the dsh release in use. dsh is a developer preview with
  breaking changes; keep the snapshot in sync with the [deepseek-harness
  `master`](https://github.com/deepseek-ai/deepseek-harness) source you run.
  The bundle's DSH peer ranges are unversioned (`*`) so the plugin loads on
  either a published dsh or a source build from `master`.
- **Stock launcher** — the user-owned `omarchy` shims make `omarchy agent` and
  `omarchy default agent dsh` work. Skip them with `./install.sh --no-shim`; in
  that case use the keybinding, the Omarchy menu, or `dsh-agent`.
- **TUI bundle** — dsh ships no terminal UI of its own, so `omarchy agent` can
  only open one when a TUI app bundle is installed. The project installs
  `DSH_OMARCHY_TUI_PACKAGE` (default `github:deepseek-harness/turtle-ui`, the
  official TUI, which requires access to that repository) into the `tui`
  profile. Point the variable at a local checkout or another published bundle,
  or skip the profile with `--no-tui`. If the bundle cannot be fetched, the
  install warns and `dsh-agent` falls back to the web UI. The bundle runs with
  the same OS permissions as any dsh plugin.

## License

MIT
