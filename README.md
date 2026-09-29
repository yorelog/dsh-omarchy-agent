# dsh-omarchy-agent

Turn the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
(`dsh`) into a general-purpose, Omarchy-aware agent: a selectable
**Omarchy General** agent preset, first-class Omarchy tools, a safety guard for
package-owned files, and one-command desktop integration for
[Omarchy](https://omarchy.org/) (Arch Linux + Hyprland).

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
dsh-agent                          # opens the dsh web UI
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
2. Creates the `omarchy` dsh profile (from the shipped `web` template) and
   installs this bundle into it.
3. Creates an `omarchy-headless` profile for one-shot prompts.
4. Installs the `dsh-agent` launcher to `~/.local/bin`.
5. Adds a **DeepSeek Harness** row to the Omarchy agent picker.
6. Sets **dsh** as the Omarchy default agent.
7. Overrides the `a` shell alias and the Agent keybinding so both reach dsh.

Every step is idempotent, and each can be disabled:
`--no-default`, `--no-menu`, `--no-alias`, `--no-keybind`, `--no-headless`.

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
dsh-agent                      # interactive web UI for the `omarchy` profile
dsh-agent --inline             # same, in the current terminal
dsh-agent --prompt "reload hyprland and set Tokyo Night"   # one-shot
dsh-agent --pick               # open the Omarchy agent picker
dsh-agent --set pi             # switch the default agent back to pi
```

In the dsh web UI, choose **Omarchy General** in the session's agent-preset
selector. The Omarchy tools, guard, and conventions are registered globally in
the profile, so every preset in it inherits them.

## Omarchy integration details

All integration lives under `$HOME`:

| File | Purpose |
|---|---|
| `~/.local/bin/dsh-agent` | Launcher that mirrors `omarchy-agent` and supports dsh. |
| `~/.config/omarchy/extensions/omarchy-menu.jsonc` | Adds the **DeepSeek Harness** row to the agent picker. |
| `~/.config/omarchy/defaults/agent` | Stores `dsh` as the default agent. |
| `~/.config/hypr/bindings.lua` | Rebinds `SUPER + SHIFT + CTRL + A` to `dsh-agent`. |
| `~/.bashrc` | Overrides the `a` alias to `dsh-agent --inline`. |

Why a wrapper? `/usr/bin/omarchy-agent` and `/usr/bin/omarchy-default-agent`
hardcode their agent list and reject unknown names, so dsh cannot register
itself there without editing package-owned files. `dsh-agent` bridges that gap
and delegates every other agent back to the stock launcher.

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
- **`dsh plugin` says pnpm was not found** — `mise use -g pnpm@latest`.

## Uninstall

```sh
./uninstall.sh          # removes the bundle, launcher, menu row, alias, keybind
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
  `standard` preset of `@deepseek-ai/dsh-web-app@0.1.7-rc.2`. dsh is a developer
  preview with breaking changes; update the snapshot when you bump the version.
- **Stock launcher** — `omarchy agent` / `omarchy default agent dsh` still fail;
  use the keybinding, the Omarchy menu, or `dsh-agent`.
- **No TUI** — dsh's interactive UI is the browser web app; launching opens it
  and serves `127.0.0.1:3080`.

## License

MIT
