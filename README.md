<p align="center"><img src="icon.svg" width="96" height="96" alt="dsh-omarchy-agent icon"></p>

# dsh-omarchy-agent

English | [中文](README.zh.md)

**Omarchy capabilities for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).**

A `dsh` plugin, not an Omarchy desktop installer: five tools over the live
desktop, a hard guard on Omarchy's package-owned tree, and a short conventions
prompt. No shims, no `PATH` edits, no shell or Hyprland rewrites.

## Highlights

- **The agent looks things up instead of guessing.** `omarchy_catalog` searches
  `omarchy commands --json`, so it discovers real routes, arguments, and sudo
  requirements. `omarchy_status` and `omarchy_hypr` return live JSON from
  `omarchy` and `hyprctl`.
- **One safety rule that survives full access.** Omarchy launches agents with
  `DSH_PERMISSION_MODE=danger-full-access`, where no sandbox is left. The guard
  still denies writes to `/usr/share/omarchy`, the tree `omarchy update`
  overwrites, while leaving reads free.
- **Zero intrusion.** No shims, no `PATH` edits, no `~/.bashrc`, fish,
  `environment.d`, Hyprland, menu, or default-agent writes. Install is one npm
  package and one command; uninstall is one more.
- **Built for Omarchy's native dsh support, not against it.** The bundle lands
  in the `web` profile that `dsh web` boots, so Omarchy keeps owning the
  launcher, the picker, and the usage panel.
- **Small and auditable.** Five tools, one hook, one prompt section. There is no
  preset snapshot to resync on every dsh release; `lib/` is committed and CI
  checks it against `src/`.

## Status: Omarchy's native dsh support is in review

[#14455][pr14455] adds dsh as a coding agent, and [#14040][pr14040] consolidates
it with the rest of the agent roster. On a released Omarchy without either,
dsh is not in the agent list yet: install it with mise and launch `dsh web`.
Once they land, Omarchy installs the lazy mise tool, adds the menu row, launches
`dsh web`, and counts dsh in the agents panel. Either way, the tools below come
from this bundle.

[pr14455]: https://github.com/omacom/omarchy/pull/14455
[pr14040]: https://github.com/omacom/omarchy/pull/14040

## What it adds

| Contribution | Kind | Effect |
|---|---|---|
| `omarchy_status` | Tool | Distro build, theme, Hyprland version, monitors, workspaces, active window, failed user units. |
| `omarchy_catalog` | Tool | Searches `omarchy commands --json` for routes, usage, and sudo requirements. |
| `omarchy_theme` | Tool | Lists themes, reads the current theme, or applies one. |
| `omarchy_hypr` | Tool | Reads live Hyprland state as JSON or reloads the configuration. |
| `omarchy_diagnose` | Tool | Recent crashes from `coredumpctl` and failed system/user units. |
| Guard | `tools/pre-execute` | Denies writes under `/usr/share/omarchy`; reads stay allowed. |
| Conventions | System prompt | Read state before changing it, prefer Omarchy tooling, keep user changes under `~/.config`. |

Installing the bundle adds these to every agent in the profile. There is no
separate preset to select.

## Install

The npm package is the primary distribution: `dsh-omarchy-agent`.

`dsh` must be on `PATH`. The installer installs it with mise when it is missing
(pass `--no-install-dsh` to fail instead). Once Omarchy's dsh support lands
([#14455][pr14455] / [#14040][pr14040]), `omarchy default agent dsh` installs it
through Omarchy too.

### Recommended: npm package

```sh
mise use -g npm:dsh-omarchy-agent
dsh-omarchy-agent-install
```

The installer ensures `dsh` and `pnpm`, then adds the bundle to the `web`
profile. `--headless` also installs into the one-shot profile, `--profile
<name>` targets another profile, and `--dry-run` prints the plan first.

With `dsh` and `pnpm` already on `PATH`, the npm package can go straight into
the profile:

```sh
dsh plugin --profile web add dsh-omarchy-agent
```

Plain `npm install -g dsh-omarchy-agent` works when mise is not present.

### From a checkout

```sh
dsh plugin --profile web add .
```

Local edits stay live. The installer detects a checkout and adds it by path; an
npm-installed copy is added by package name, so the profile keeps its own copy
that a package-manager prune cannot break. Re-running the installer (or `dsh
plugin --profile web update dsh-omarchy-agent`) refreshes the profile's copy.

### As an Omarchy shell plugin

```sh
omarchy plugin add https://github.com/yorelog/dsh-omarchy-agent --enable
```

The plugin's service runs the npm installer once, in the background.

The target is the `web` profile because `dsh web` boots it (and Omarchy's
launcher runs `dsh web`). Add `--headless` for
`dsh --profile headless "run the tests"`.

Launch it:

```sh
dsh web         # today
omarchy agent   # once Omarchy lists dsh; SUPER + SHIFT + CTRL + A does the same
```

A running profile keeps its bundle set from when it started: restart `dsh web`
after installing.

## Configuration

Override the bundle row in the profile's `cordis.patch.yml`
(`~/.dsh/profiles/web/cordis.patch.yml`):

```yaml
- id: omarchy-agent
  config:
    omarchyBin: omarchy
    protectedPath: /usr/share/omarchy
    privilegedTokens: []
    commandTimeoutMs: 30000
```

| Field | Default | Meaning |
|---|---|---|
| `omarchyBin` | `omarchy` | Binary used for Omarchy commands. |
| `protectedPath` | `/usr/share/omarchy` | Package-owned tree that mutations are denied against. |
| `privilegedTokens` | `[]` | Tokens that trigger the approval gate. Empty gates nothing. |
| `commandTimeoutMs` | `15000` | Per-command timeout for spawned Omarchy/hyprctl commands. |

## Safety

- The guard is defense-in-depth, not a sandbox. Tools run with the Harness
  process's OS permissions.
- Reads of `/usr/share/omarchy` are allowed; writes through `write`, `edit`,
  `str_replace_editor`, `apply_patch`, or `bash`/`pwsh` are denied. This is the
  one rule that still matters under `DSH_PERMISSION_MODE=danger-full-access`,
  where no sandbox is left to catch the write.
- `privilegedTokens` is empty by default because Omarchy launches its default
  agents with full access; an `ask` without an approval service degrades to
  deny, which would make dsh less capable than the other agents. Set the list
  (`[sudo, pkexec, pacman, yay, paru, makepkg]`) to opt back into approval.
- The guard does not inspect arbitrary code run through PTC `run_code`; use a
  sandboxed shell or disable PTC mode if that matters.

## Relationship to Omarchy's native dsh support

| Concern | Owner |
|---|---|
| Install `dsh` (lazy mise tool, prerelease-aware) | Omarchy |
| Select the default agent, menu row, icon | Omarchy |
| Launch (`omarchy agent`, keybinding, `agent prompt`) | Omarchy |
| DeepSeek balance and dsh session usage in the panel | Omarchy |
| **Omarchy tools, guard, conventions** | **this bundle** |
| **Adding the bundle to the `web` profile** | **this bundle** |

The first four rows are Omarchy's once [#14455][pr14455] / [#14040][pr14040]
merge; on a released Omarchy without them, install dsh with mise and launch
`dsh web`. The last two rows are always this bundle.

Nothing here edits `/usr/share/omarchy`, `~/.bashrc`, fish config,
`environment.d`, Hyprland bindings, the Omarchy menu, or the default-agent file.
Older versions of this project did; `uninstall.sh` removes those leftovers.

## Using the tools

In a dsh session, ask for what you want and the tools are available:

```text
what theme am I on, and which monitors are connected?
list Omarchy commands for changing the wallpaper
switch to Tokyo Night and reload Hyprland
read the last crash and the failed user units
```

The model can also discover commands itself with `omarchy_catalog`, so it does
not have to guess routes.

## Troubleshooting

- **`dsh` not found** — install it with `mise use -g npm:@deepseek-ai/dsh@latest`
  (or, once Omarchy lists dsh, `omarchy default agent dsh`), then open a new
  shell.
- **The tools are missing in a session** — confirm the bundle is installed with
  `dsh --profile web --dump-config | grep dsh-omarchy-agent`, then restart the
  profile (`dsh plugin` changes apply at the next start).
- **Port 3080 already in use** — a `dsh web` profile is already running. Open
  its URL instead of launching a second one.
- **`omarchy agent` does not open dsh** — a released Omarchy without
  [#14455][pr14455] / [#14040][pr14040] does not list dsh yet; use `dsh web`.
  Once it does, select it with `omarchy default agent dsh`.
- **`dsh plugin` says pnpm was not found** — `mise use -g pnpm@latest`.
- **`mise use -g npm:dsh-omarchy-agent` reports "no versions found"** — mise
  hides npm releases newer than 24 hours (`minimum_release_age`). Pin the
  version: `mise use -g npm:dsh-omarchy-agent@<version>`.

## Uninstall

```sh
dsh-omarchy-agent-uninstall
```

or, from a checkout:

```sh
./uninstall.sh
```

This removes the bundle from `web`, `headless`, and the profiles older versions
created, and deletes the shims, launcher, shell blocks, and menu row those
versions wrote. It leaves `dsh` installed and does not change the default agent;
switch with `omarchy default agent <name>`. Pass `--remove-dsh` to remove a
mise-installed dsh too.

If you installed it as an Omarchy plugin, run the uninstaller from the plugin
directory first, then remove the plugin:

```sh
cd ~/.config/omarchy/plugins/dsh-omarchy-agent && ./uninstall.sh
omarchy plugin remove dsh-omarchy-agent
```

## Development

```sh
mise run install       # npm install
mise run build         # tsc -> lib/
mise run test          # build + keyless smoke test (tools, section, guard)
mise run pack          # show the npm tarball contents
```

The bundle is a standard Cordis plugin: `src/index.ts` exports `name`, `inject`,
`Config`, and `apply`, and registers tools, the guard, and the prompt section.
`lib/` is committed; CI checks that it matches `src/`.

## Model Experience

The bundle registers five tools and one system-prompt section. Tool schemas and
the conventions text are model-visible and are logged by the session.

- **Token effect** — conditional: tool schemas add fixed tokens while visible,
  and the conventions section adds a short fixed block to every request.
- **KV Cache effect** — append-only. The section text changes only with plugin
  configuration; the tools do not rewrite earlier request tokens.

## Known limitations

- **Developer-preview dependency** — dsh has no stable release yet (every
  published version is an alpha or rc). The bundle's peer ranges are unversioned
  and optional, and the build-time dev dependencies are pinned to the release
  the bundle is built against (`0.2.0-rc.2`). Bump them together when dsh breaks
  a plugin API.
- **No terminal UI** — dsh ships none. `dsh web` is the interactive surface;
  `dsh --profile headless "task"` is one-shot and exits after printing the
  answer.
- **Session-log upload is on by default in dsh** and is separate from
  `DSH_TELEMETRY_MODE`. Turn it off under _Settings → General → Upload Session
  Log_ in the browser UI; `DSH_TELEMETRY_MODE=DISABLED` covers OTel only.
- **`danger-full-access`** — Omarchy starts agents with no approval. The guard
  keeps the package-owned tree read-only, but nothing else is fenced.

## License

MIT
