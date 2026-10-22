<p align="center"><img src="https://raw.githubusercontent.com/yorelog/dsh-omarchy-agent/main/icon.svg" width="96" height="96" alt="dsh-omarchy-agent icon"></p>

# dsh-omarchy-agent

English | [中文](https://github.com/yorelog/dsh-omarchy-agent/blob/main/README.zh.md)

**Teach [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) to use your Omarchy desktop.**

Coding agents are good at code and blind to the desktop around it. This plugin
gives `dsh` tools for the live desktop and its source, a guard that keeps
Omarchy's own files safe, and a top-bar panel for running it.

It is a `dsh` plugin, not an installer. Omarchy is taking over installing,
launching, and selecting `dsh` ([#14455][pr14455], [#14040][pr14040]); this
plugin adds the Omarchy knowledge the agent needs.

[pr14455]: https://github.com/omacom/omarchy/pull/14455
[pr14040]: https://github.com/omacom/omarchy/pull/14040

## What you get

- **It sees what you see.** Theme, monitors, workspaces, the active window, and
  failed units — live, not guessed.
- **It finds the real command.** Instead of inventing an Omarchy route, it
  searches `omarchy commands --json` and uses the one that exists.
- **It finds the source.** `omarchy_source` searches Omarchy docs, skills, and
  shell source with line numbers — no shell-reader guard collisions.
- **It looks without taking over.** `omarchy_plugin`, `omarchy_shell`, and
  `omarchy_agent` inspect plugins, bar state, the default agent, and usage
  records read-only; installing, selecting, and enabling stay with you.
- **It cannot break Omarchy.** `/usr/share/omarchy` is read-only to the agent;
  your changes stay in `~/.config`.
- **One icon controls the rest.** Start or stop `dsh web`, open the web UI or
  CLI, and watch the server, theme, displays, failed units, and current default
  agent from the top bar. The panel opens under its icon.
- **Cards instead of JSON.** Tool results render as small Omarchy cards inside a
  dsh web session.

## The boundary

dsh is one of Omarchy's default agents, not its administrator. The inspection
tools are read-only: dsh can read desktop state, commands, docs, plugins, and
usage records, but it does not install dsh, select the default agent,
enable/disable plugins, or change telemetry. Those stay with you or Omarchy.

## Tools

| Tool | What it reads or does |
|---|---|
| `omarchy_status` | Theme, monitors, workspaces, active window, failed user units. |
| `omarchy_catalog` | Search `omarchy commands --json`, including aliases, routes, and per-route help. |
| `omarchy_theme` | List/read themes, or apply one (`set` changes the desktop). |
| `omarchy_hypr` | Hyprland state, or reload the config (`reload` changes the desktop). |
| `omarchy_diagnose` | Recent crashes and failed system/user units. |
| `omarchy_source` | Read-only search over Omarchy docs, skills, shell source, and config. |
| `omarchy_agent` | Read-only default agent, dsh availability, and usage records. |
| `omarchy_plugin` | Read-only plugin list and validation. |
| `omarchy_shell` | Read-only plugins, config, and bar geometry. |

Only `omarchy_theme set` and `omarchy_hypr reload` change the desktop. Every
`omarchy_agent`, `omarchy_plugin`, `omarchy_shell`, and `omarchy_source` call
is read-only.

## Install

`dsh` must already be on your `PATH`. Omarchy owns installing and selecting it;
on a released Omarchy that does not list dsh yet, install it yourself with
`mise use -g npm:@deepseek-ai/dsh@latest`, then open a new shell.

**Main way: npm**

```sh
mise use -g npm:dsh-omarchy-agent
dsh-omarchy-agent-install
```

That adds the plugin to the `web` profile used by `dsh web`. Add `--headless`
for one-shot runs, or `--dry-run` to see the plan first.

mise hides npm releases newer than 24 hours by default, so a bare package can
pick an old release. To pin one:

```sh
mise use -g npm:dsh-omarchy-agent@<version>
dsh-omarchy-agent-install --version <version>
```

Already have `dsh` and `pnpm`? Skip the installer:

```sh
dsh plugin --profile web add dsh-omarchy-agent
# or pin:
dsh plugin --profile web add dsh-omarchy-agent@<version>
```

**Want the top-bar panel?** Install the Omarchy plugin too:

```sh
omarchy plugin add https://github.com/yorelog/dsh-omarchy-agent --enable
omarchy plugin enable dsh-omarchy-agent right   # put it on the right
```

Enabling the panel does not install the dsh bundle; the bar plugin and the dsh
bundle are separate, so run the installer above as well.

**From a checkout:** `dsh plugin --profile web add .`

Restart `dsh web` if it is already running.

## Use it

In a dsh web session, just ask:

```text
what theme am I on, and which monitors are connected?
list the Omarchy commands for changing the wallpaper
switch to Tokyo Night and reload Hyprland
why did the bar crash?
where is BarIconButton documented?
what is my default agent?
which Omarchy plugins are installed?
how do I move the agents widget to the right?
```

The last question returns the `omarchy bar move` command; dsh does not enable or
move the widget for you.

Or use the bar panel:

- **Left click** — open the panel.
- **Right click** — open the web UI.
- **Middle click** — open a terminal with the dsh CLI.

The panel's **Start dsh web** runs a small systemd user unit (`dsh-web`), so the
server survives a shell restart. Check it with
`systemctl --user status dsh-web`.

If you keep your key in an environment variable, put it in
`~/.config/dsh/web.env`. Otherwise sign in once in the web UI.

## Settings

The panel has a few settings in `shell.json`:

| Setting | Default | What it does |
|---|---|---|
| `port` | `3080` | Web UI port. |
| `permissionMode` | `danger-full-access` | Permission mode for the server. |
| `workingDirectory` | `~/Work` | Where new sessions start. |
| `refreshIntervalSec` | `10` | How often the cards refresh. |

To change the plugin config (for example, turn command approval back on), edit
`~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- id: omarchy-agent
  config:
    privilegedTokens: [sudo, pacman]
```

`privilegedTokens` is empty by default because Omarchy launches agents with full
access.

## Safety

- The inspection tools are read-only. `omarchy_theme set` and
  `omarchy_hypr reload` are the only desktop mutations.
- The Omarchy plugin no longer runs an installer when it loads; run
  `dsh-omarchy-agent-install` explicitly when you want the dsh bundle.
- The guard blocks writes to `/usr/share/omarchy`. Read it with the `read` tool, `cat`, `head`, or `rg`; shell commands that also invoke `sed`, `awk`, `python`, `node`, or `perl` are treated as writes even when they only read.
- It is not a sandbox: tools run with your user permissions.
- `dsh web` listens on `127.0.0.1` only. Do not expose it to the internet.

## Compatibility

| Omarchy | Behavior |
|---|---|
| 4.0.4 and earlier | dsh is not in `omarchy default agent` and there is no DeepSeek collector; install dsh manually, and `omarchy_agent` reports the gap. |
| quattro / #14040 | dsh is a default agent with a DeepSeek usage collector; the read-only tools report it, and the Omarchy agents panel owns usage. |

## Troubleshooting

- **`dsh` not found** — `mise use -g npm:@deepseek-ai/dsh@latest`, then open a
  new shell.
- **Tools missing** — `dsh --profile web --dump-config | grep dsh-omarchy-agent`,
  then restart `dsh web`.
- **Read denied under `/usr/share/omarchy`** — the guard flags `sed`, `awk`,
  `python`, `node`, and `perl` as writes even for reads; use the `read` tool,
  `cat`, `head`, or `rg` instead.
- **Bar icon missing** — install the Omarchy plugin (see above), then run
  `omarchy plugin enable dsh-omarchy-agent right`.
- **Old panel after an update** — the bar keeps its instantiated widget; run
  `omarchy restart shell` after `omarchy plugin update` if the panel still shows
  the old layout or status.
- **Port 3080 in use** — a `dsh web` is already running; open its URL instead.
- **Usage missing** — released Omarchy has no DeepSeek collector. After
  quattro/#14040 the Omarchy agents panel owns usage; `omarchy_agent` reports
  which side is available.
- **Stop dsh web is disabled** — another `dsh web` owns the port; stop it where
  it started instead of from the panel.
- **Start dsh web failed with `EADDRINUSE`** — 0.4.1's `curl -f` probe read the
  401 from an already-running dsh web as down, so it started a second one.
  Update to 0.4.2; it treats any HTTP response as an occupied port.
- **`omarchy agent` does not open dsh** — released Omarchy does not list dsh yet;
  use `dsh web` or the bar panel.

## Uninstall

```sh
dsh-omarchy-agent-uninstall
```

If you installed the Omarchy plugin:

```sh
cd ~/.config/omarchy/plugins/dsh-omarchy-agent && ./uninstall.sh
omarchy plugin remove dsh-omarchy-agent
```

## Development

```sh
mise run install   # npm install
mise run build     # build the host plugin and the web client
mise run test      # smoke tests
```

The agent plugin lives in `src/`; the web cards in `src/client/`. `lib/` is
committed, and CI checks it matches the source.

Releases run in GitHub Actions; see
[RELEASING.md](https://github.com/yorelog/dsh-omarchy-agent/blob/main/RELEASING.md).

## Notes

- `dsh` has no stable release yet; every version is an alpha or rc.
- `dsh` ships no terminal UI. `dsh web` is the interactive app;
  `dsh --profile headless "task"` is one-shot.
- DeepSeek uploads session logs by default when you use its official model API.
  Turn that off in the web UI under _Settings → General → Upload Session Log_.
- Feedback telemetry is a separate channel: `DSH_TELEMETRY_MODE=DISABLED`
  disables the OTel feedback export, while `DSH_TELEMETRY_DISABLED` opts the
  process out of telemetry entirely.

## Release notes

- **0.4.2** — The panel now treats any HTTP response from `127.0.0.1:3080` as a
  running server. dsh web answers 401 on `/`, so 0.4.1's `curl -f` probe started
  a second server and failed with `EADDRINUSE`.
- **0.4.1** — The panel opens under its bar icon instead of the center of the bar.
- **0.4.0** — Added read-only `omarchy_source`, `omarchy_agent`,
  `omarchy_plugin`, and `omarchy_shell`; stated the default-agent boundary;
  removed the install-on-load service; delegated usage to the Omarchy agents
  panel; qualified palette colors for Qt 6.12 and fitted the mark to the 12px
  bar target.

## License

MIT
