# AGENTS.md

Guidance for AI coding agents (dsh, pi, Claude Code, etc.) working on this
repository. Follow this before changing code, tests, or release metadata.

## What this repository is

`dsh-omarchy-agent` teaches [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
(`dsh`) to use an [Omarchy](https://omarchy.org/) desktop. It ships two halves:

1. **A dsh bundle** (Cordis plugin) — `src/` compiled to committed `lib/`,
   registered into a profile by `cordis.patch.yml`. This is what gives dsh the
   Omarchy tools, the safety guard, and the conventions prompt.
2. **An Omarchy bar panel** — `integration/DshPanel.qml` (the widget) plus
   `manifest.json` (Omarchy plugin metadata). Installed separately with
   `omarchy plugin add`.

The bundle is read-only by design: tools inspect the desktop, the guard
protects `/usr/share/omarchy`, and the prompt teaches boundaries. The only
mutating actions are `omarchy_theme set` and `omarchy_hypr reload`.

## Layout

```
src/                      TypeScript source of the dsh bundle
  index.ts                Cordis plugin entry (name, inject, apply)
  config.ts               plugin Config schema (omarchyBin, protectedPath, ...)
  tools.ts                registers the 10 Omarchy tools
  guard.ts                tools/pre-execute gate (package ownership + opt-in approvals)
  prompt.ts               system-prompt conventions section
  source.ts               omarchy_source read-only source search
  inspect.ts              omarchy_agent / omarchy_plugin / omarchy_shell / omarchy_panel
  exec.ts                 run() helper (no shell, bounded outcome)
  client/                 browser half (web cards)
lib/                      COMMITTED build output; must match src/
integration/              Omarchy bar widget
  DshPanel.qml            the bar icon + panel (web/CLI lifecycle, signals)
  DshMark.qml             icon glyph
scripts/                  build + keyless smoke tests + version sync
cordis.patch.yml          bundle patch: inserts `omarchy-agent` into a profile
manifest.json             Omarchy plugin manifest (bar-widget)
install.sh / uninstall.sh installer (adds the bundle to a dsh profile)
.github/workflows/        ci.yml (checks) + publish.yml (staged publish)
```

## Commands

```sh
mise run install      # npm install
mise run build        # tsc + client bundle -> lib/
mise run typecheck    # tsc --noEmit
mise run test         # build + smoke-test + source-test + smoke-client
```

`mise run test` is the gate; run it before committing. The three tests are
keyless — they load the built `lib/` and verify registration, guard decisions,
source search, and client wiring without a model or an installed Omarchy.

## Invariants (CI enforces these; do not break them)

- **`lib/` is committed and must match `src/`.** `ci.yml` runs
  `git diff --exit-code -- lib` after a rebuild. Always run the build and
  commit the regenerated `lib/` with any `src/` change.
- **`package.json` and `manifest.json` versions stay in sync.**
  `scripts/bump-manifest.mjs` (the `version` lifecycle script) copies the
  version, but see the release gotcha below — it is not committed automatically.
- **No service entry point.** The smoke test asserts
  `manifest.kinds === ['bar-widget']` and no `entryPoints.service`; the plugin
  must not mount a service on load.
- **Exactly 10 tools, 1 prompt section, 1 guard.** The smoke test asserts the
  tool list in order: `omarchy_status`, `omarchy_catalog`, `omarchy_theme`,
  `omarchy_hypr`, `omarchy_diagnose`, `omarchy_source`, `omarchy_agent`,
  `omarchy_plugin`, `omarchy_shell`, `omarchy_panel`.

## Safety boundary

Never edit `/usr/share/omarchy/` — it is package-owned and overwritten on
update. The guard denies writes into it (and read-only shell one-liners that
invoke `sed`/`awk`/`python`/`node`/`perl`), routing agents to `omarchy_source`
and the `read` tool. User changes go under `~/.config/omarchy` and
`~/.config/hypr`.

When the request is *end-user Omarchy customization*, load the Omarchy skill
(`/usr/share/omarchy/default/agents/skills/omarchy/`); it is the authoritative
procedure. This repository is the plugin's source, not the Omarchy source.

## The tools (what each contributes)

| Tool | Purpose |
|---|---|
| `omarchy_status` | distro, theme, Hyprland version, monitors/workspaces/activewindow, failed units |
| `omarchy_catalog` | search `omarchy commands --json`; drill into a route's `--help --json` |
| `omarchy_theme` | list / current / set themes |
| `omarchy_hypr` | read Hyprland state as JSON; reload + `hyprctl configerrors` |
| `omarchy_diagnose` | coredumpctl, failed units, and the `omarchy-debug` log |
| `omarchy_source` | search Omarchy docs, skills, and shell source with line numbers |
| `omarchy_agent` | default agent, dsh support/install, usage records |
| `omarchy_plugin` | list / validate shell plugins |
| `omarchy_shell` | shell IPC: plugins, config, bar geometry |
| `omarchy_panel` | the bar panel's signals and clickable cards |

The prompt section (`dsh-omarchy-agent:conventions`) teaches the read-only
boundary, "use the catalog/source before guessing", the package-ownership rule,
and Hyprland reload+validate and unbind-before-rebind.

## Commit and release

Conventional commits, matching existing history: `feat(scope)`, `fix(scope)`,
`docs`, and `chore(release): X.Y.Z` for the version commit.

Release steps (version `X.Y.Z`):

```sh
mise run test
npm version X.Y.Z -m "chore(release): %s"

# Gotcha 1: `npm version` commits package.json + package-lock.json but NOT
# manifest.json (bump-manifest.mjs runs during `version`, after the stage list
# is fixed). Amend it in:
git add manifest.json && git commit --amend --no-edit

# Gotcha 2: amending moves the commit, so the tag npm version created now
# points at the pre-amend commit. Re-point it:
git tag -f vX.Y.Z

git push origin main --tags
```

Then verify the Publish workflow actually ran — it did not, in practice, when
the tag was force-moved and pushed together with `main`:

```sh
gh run list --workflow=Publish --limit 3
```

If there is no `Publish` run for `vX.Y.Z`, re-push the tag to fire the event:

```sh
git push origin :refs/tags/vX.Y.Z && git push origin vX.Y.Z
```

### Publishing is two-phase

`publish.yml` runs `npm stage publish --provenance`, which only **stages** the
package (deferring the 2FA proof-of-presence). The stage log prints an id; the
package is not live until a human approves it:

```sh
npm stage approve <stage-id> --registry=https://registry.npmjs.org
```

(Or approve under the package's "staged versions" on npmjs.com.) Do not expect
`npm view` against `registry.npmmirror.com` to reflect the new version
immediately — query `https://registry.npmjs.org/dsh-omarchy-agent` directly.
