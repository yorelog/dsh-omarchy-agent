<p align="center"><img src="https://raw.githubusercontent.com/yorelog/dsh-omarchy-agent/main/docs/banner.png" width="100%" alt="The Dsh Omarchy Agent Banner"></p>

<p align="center"><img src="https://raw.githubusercontent.com/yorelog/dsh-omarchy-agent/main/icon.svg" width="96" height="96" alt="dsh-omarchy-agent icon"></p>

# dsh-omarchy-agent

[![Build](https://github.com/yorelog/dsh-omarchy-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/yorelog/dsh-omarchy-agent/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/dsh-omarchy-agent)](https://www.npmjs.com/package/dsh-omarchy-agent)
[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/yorelog/dsh-omarchy-agent)


English | [中文](https://github.com/yorelog/dsh-omarchy-agent/blob/main/README.zh.md)

**Teach [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) to use your Omarchy desktop.**

Your coding agent can write code all day, but it can't see the desktop around it. This plugin gives `dsh` the live desktop, the right Omarchy commands, the docs and source behind them, and one bar panel for the harness itself.

## What you get

- **It reads the room.** Recent errors, system load and memory, the apps you've been using, and the project you're in, read live instead of guessed.
- **It finds the real command.** `omarchy_catalog` searches `omarchy commands --json`, so dsh uses a command that actually exists instead of inventing one.
- **It reads Omarchy's source.** `omarchy_source` searches docs, agent skills, shell source, and config with line numbers, then the `read` tool opens the file.
- **It keeps the harness in reach.** The bar panel shows the dsh web server, CLI version, default agent, permission mode, working directory, session count, DeepSeek usage, and those live signals.
- **The panel is readable both ways.** `omarchy_panel` gives dsh the same cards; clicking one copies its context and opens a fresh dsh web window.
- **It stays out of the way.** Inspecting the desktop, plugins, agents, and usage is read-only. Installing dsh, choosing a default agent, and enabling plugins stay with you.
- **Cards instead of JSON.** Tool results become small Omarchy cards inside a dsh web session.

## Install

Install the plugin package, then run its installer:

```sh
mise use -g npm:dsh-omarchy-agent
dsh-omarchy-agent-install
```

The installer adds the bundle to the `web` profile. If `dsh` is not on your `PATH`, it looks up the newest published dsh version — including the current `rc` releases, which have no stable `latest` — and asks before installing it:

```text
dsh is not installed. Install the newest published version (0.2.1-rc.3) with mise? [Y/n]
```

Answer yes, or pass `--yes` for a non-interactive install. Use `--no-install-dsh` if you want the installer to fail instead, and `--dsh-version <version>` to pin a version. Omarchy still owns selecting dsh as the default agent.

Want the bar panel too? Install it as an Omarchy plugin:

```sh
omarchy plugin add https://github.com/yorelog/dsh-omarchy-agent --enable
omarchy plugin enable dsh-omarchy-agent right   # put it on the right
```

The bar plugin and the dsh bundle are separate: enabling the panel does not install the bundle, so run both steps.

If `dsh web` is already running, restart it once so it loads the new plugin.

## Use it

Ask inside dsh web:

```text
what is failing on my desktop right now?
why did the bar crash?
which Omarchy commands change the wallpaper?
where is BarIconButton documented?
what is my default agent?
how do I move the agents widget to the right?
```

Or click the DeepSeek Harness icon in the bar:

- **Left click** opens the harness panel.
- **Right click** opens the dsh web UI.
- **Middle click** opens a terminal with the dsh CLI.

The panel opens under its icon. If another `dsh web` already owns the port, it shows **External** and disables its own Start/Stop instead of starting a second server.

Every card is clickable. Click **Load**, **Errors**, **Recent apps**, **Project**, or any other card and the panel copies that signal's context to the clipboard and opens a new dsh web window. Paste it with `Win+V` (or your clipboard shortcut), edit it, and send when ready. The panel never sends for you.

## Settings

The panel reads a few settings from `shell.json`:

| Setting | Default | What it does |
|---|---|---|
| `port` | `3080` | Web UI port. |
| `permissionMode` | `danger-full-access` | Permission mode for the managed server. |
| `workingDirectory` | `~/Work` | Where new sessions start. |
| `refreshIntervalSec` | `10` | How often the panel refreshes while open. |

To change the plugin config, edit `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- id: omarchy-agent
  config:
    privilegedTokens: [sudo, pacman]
```

`privilegedTokens` is empty by default because Omarchy launches agents with full access.

## Safety

- The inspection tools are read-only. `omarchy_theme set` and `omarchy_hypr reload` are the only desktop changes.
- `/usr/share/omarchy` is package-owned and never modified by dsh; user changes stay in `~/.config`.
- The bar plugin does not install the dsh bundle or start network installs when it loads.
- `dsh web` listens on `127.0.0.1` only. Do not expose it to the internet.
- DeepSeek uploads session logs by default when you use its official model API; turn that off under _Settings → General → Upload Session Log_. Feedback telemetry is separate: `DSH_TELEMETRY_MODE=DISABLED` disables the OTel export, while `DSH_TELEMETRY_DISABLED` opts the process out entirely.

## Compatibility

- **Omarchy 4.0.4 and earlier** — dsh is not in `omarchy default agent` yet and there is no DeepSeek usage collector. Install dsh manually; the panel shows “Waiting for collector” for usage.
- **quattro / native dsh support** — dsh is a default agent with an Omarchy usage collector. The same read-only tools report it, and DeepSeek usage appears in the panel automatically.

The plugin adapts to what the machine has instead of assuming a version.

## Troubleshooting

- **`dsh` not found** — re-run `dsh-omarchy-agent-install`; it looks up the newest published pre-release and offers to install it. To install manually, pass the version it prints to `mise use -g npm:@deepseek-ai/dsh@<version>`, then open a new shell.
- **Start dsh web does nothing** — run `dsh-omarchy-agent-install` first so `dsh` is on `PATH`, then check `systemctl --user status dsh-web` and `journalctl --user -t omarchy-shell -n 50`. The panel starts dsh web as a transient user unit.
- **Tools missing** — `dsh --profile web --dump-config | grep dsh-omarchy-agent`, then restart `dsh web`.
- **Old panel after an update** — the bar keeps its instantiated widget; run `omarchy restart shell` after `omarchy plugin update` if the panel still shows the old layout.
- **Start dsh web failed with `EADDRINUSE`** — older builds used `curl -f`, which read the 401 from a running dsh web as “not running”. Update to the latest release; it treats any HTTP response as an occupied port.
- **Read denied under `/usr/share/omarchy`** — use the `read` tool or `omarchy_source`; shell commands that also invoke `sed`, `awk`, `python`, `node`, or `perl` are treated as writes even when they only read.
- **Bar icon missing** — install the Omarchy plugin, then run `omarchy plugin enable dsh-omarchy-agent right`.
- **Usage is empty** — released Omarchy has no DeepSeek collector. The Omarchy agents panel fills it in once native support lands.
- **`omarchy agent` does not open dsh** — released Omarchy does not list dsh yet; use `dsh web` or the bar panel.

## Development

The agent plugin lives in `src/`; the web cards live in `src/client/`. `lib/` is committed, and CI checks it matches the source.

```sh
mise run install   # npm install
mise run build     # build the host plugin and the web client
mise run test      # smoke tests
```

Releases run in GitHub Actions; see [RELEASING.md](https://github.com/yorelog/dsh-omarchy-agent/blob/main/RELEASING.md).

## License

MIT
