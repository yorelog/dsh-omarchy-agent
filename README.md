<p align="center"><img src="icon.svg" width="96" height="96" alt="dsh-omarchy-agent icon"></p>

# dsh-omarchy-agent

English | [中文](README.zh.md)

**Teach [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) to use your Omarchy desktop.**

Coding agents are good at code and blind to the desktop around it. This plugin
gives `dsh` five tools for the live desktop, a guard that keeps Omarchy's own
files safe, and a top-bar panel for running it.

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
- **It cannot break Omarchy.** `/usr/share/omarchy` is read-only to the agent;
  your changes stay in `~/.config`.
- **One icon controls the rest.** Start or stop `dsh web`, open the web UI or
  CLI, and watch the server, theme, displays, and DeepSeek usage from the top
  bar.
- **Cards instead of JSON.** Tool results render as small Omarchy cards inside a
  dsh web session.

## Install

`dsh` must be on your `PATH`. If it is missing, the installer adds it with mise.

**Main way: npm**

```sh
mise use -g npm:dsh-omarchy-agent
dsh-omarchy-agent-install
```

That adds the plugin to the `web` profile used by `dsh web`. Add `--headless`
for one-shot runs, or `--dry-run` to see the plan first.

Already have `dsh` and `pnpm`? Skip the installer:

```sh
dsh plugin --profile web add dsh-omarchy-agent
```

**Want the top-bar panel?** Install the Omarchy plugin too:

```sh
omarchy plugin add https://github.com/yorelog/dsh-omarchy-agent --enable
omarchy plugin enable dsh-omarchy-agent right   # put it on the right
```

**From a checkout:** `dsh plugin --profile web add .`

Restart `dsh web` if it is already running.

## Use it

In a dsh web session, just ask:

```text
what theme am I on, and which monitors are connected?
list the Omarchy commands for changing the wallpaper
switch to Tokyo Night and reload Hyprland
why did the bar crash?
```

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

- The guard blocks writes to `/usr/share/omarchy`; reads are fine.
- It is not a sandbox: tools run with your user permissions.
- `dsh web` listens on `127.0.0.1` only. Do not expose it to the internet.

## Troubleshooting

- **`dsh` not found** — `mise use -g npm:@deepseek-ai/dsh@latest`, then open a
  new shell.
- **Tools missing** — `dsh --profile web --dump-config | grep dsh-omarchy-agent`,
  then restart `dsh web`.
- **Bar icon missing** — install the Omarchy plugin (see above), then run
  `omarchy plugin enable dsh-omarchy-agent right`.
- **Port 3080 in use** — a `dsh web` is already running; open its URL instead.
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

## Notes

- `dsh` has no stable release yet; every version is an alpha or rc.
- `dsh` ships no terminal UI. `dsh web` is the interactive app;
  `dsh --profile headless "task"` is one-shot.
- DeepSeek uploads session logs by default. Turn that off in the web UI under
  _Settings → General → Upload Session Log_.

## License

MIT
