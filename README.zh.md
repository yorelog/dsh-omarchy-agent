<p align="center"><img src="https://raw.githubusercontent.com/yorelog/dsh-omarchy-agent/main/icon.svg" width="96" height="96" alt="dsh-omarchy-agent 图标"></p>

# dsh-omarchy-agent

[English](https://github.com/yorelog/dsh-omarchy-agent/blob/main/README.md) | 中文

**让 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 真正会用你的 Omarchy 桌面。**

coding agent 很会写代码，却看不见桌面。这个插件给 `dsh` 5 个操作实时桌面的工具、
一条保护 Omarchy 自身文件的守卫，以及一个在顶栏运行它的面板。

它是 `dsh` 插件，不是安装器。安装、启动、选择 `dsh` 正由 Omarchy 接管
（[#14455][pr14455]、[#14040][pr14040]）；这个插件只补上 agent 需要的 Omarchy
知识。

[pr14455]: https://github.com/omacom/omarchy/pull/14455
[pr14040]: https://github.com/omacom/omarchy/pull/14040

## 你会得到

- **它看得见你的桌面。** 主题、显示器、工作区、活动窗口、失败单元——实时读取，
  不是猜的。
- **它找得到真正的命令。** 不编 Omarchy 路由，而是搜索
  `omarchy commands --json`，用真实存在的命令。
- **它弄不坏 Omarchy。** `/usr/share/omarchy` 对 agent 只读；你的改动留在
  `~/.config`。
- **一个图标控制全部。** 在顶栏启动/停止 `dsh web`、打开 Web UI 或 CLI，查看
  server、主题、显示器、DeepSeek 用量。
- **卡片，不是 JSON。** 工具结果在 dsh web 会话里显示成小的 Omarchy 卡片。

## 安装

`dsh` 必须在 `PATH` 上。没有的话，安装器会用 mise 装上。

**主要方式：npm**

```sh
mise use -g npm:dsh-omarchy-agent
dsh-omarchy-agent-install
```

这会把插件装进 `dsh web` 使用的 `web` profile。加 `--headless` 也装一次性
profile；加 `--dry-run` 先看计划。

已经有 `dsh` 和 `pnpm`？可以跳过安装器：

```sh
dsh plugin --profile web add dsh-omarchy-agent
```

**想要顶栏面板？** 再装 Omarchy 插件：

```sh
omarchy plugin add https://github.com/yorelog/dsh-omarchy-agent --enable
omarchy plugin enable dsh-omarchy-agent right   # 放到右侧
```

**从 checkout 安装：** `dsh plugin --profile web add .`

如果 `dsh web` 已经在运行，重启它。

## 使用

在 dsh web 会话里直接问：

```text
我现在是什么主题？接了哪些显示器？
列出 Omarchy 换壁纸的命令
切到 Tokyo Night 并重载 Hyprland
bar 为什么崩了？
```

或者用顶栏面板：

- **左键** — 打开面板。
- **右键** — 打开 Web UI。
- **中键** — 打开带 dsh CLI 的终端。

面板里的 **Start dsh web** 会运行一个小的 systemd user unit（`dsh-web`），所以
重启 shell 不会杀掉 server。用 `systemctl --user status dsh-web` 查看。

如果你习惯把 key 放在环境变量里，写到 `~/.config/dsh/web.env`；否则在 Web UI 里
登录一次即可。

## 设置

面板在 `shell.json` 里有几个设置：

| 设置 | 默认值 | 作用 |
|---|---|---|
| `port` | `3080` | Web UI 端口。 |
| `permissionMode` | `danger-full-access` | server 的权限模式。 |
| `workingDirectory` | `~/Work` | 新会话的起始目录。 |
| `refreshIntervalSec` | `10` | 卡片刷新间隔。 |

要改插件配置（比如重新打开命令审批），编辑
`~/.dsh/profiles/web/cordis.patch.yml`：

```yaml
- id: omarchy-agent
  config:
    privilegedTokens: [sudo, pacman]
```

`privilegedTokens` 默认为空，因为 Omarchy 以 full access 启动 agent。

## 安全

- 守卫阻止写入 `/usr/share/omarchy`；读取没问题。
- 它不是沙箱：工具以你的用户权限运行。
- `dsh web` 只监听 `127.0.0.1`。不要把它暴露到公网。

## 故障排查

- **找不到 `dsh`** — `mise use -g npm:@deepseek-ai/dsh@latest`，然后开新 shell。
- **没有工具** — `dsh --profile web --dump-config | grep dsh-omarchy-agent`，
  然后重启 `dsh web`。
- **顶栏没有图标** — 安装上面的 Omarchy 插件，然后
  `omarchy plugin enable dsh-omarchy-agent right`。
- **3080 端口被占用** — 已经有 `dsh web` 在运行，打开它的 URL。
- **`omarchy agent` 打不开 dsh** — 已发布的 Omarchy 还不认识 dsh；用 `dsh web`
  或顶栏面板。

## 卸载

```sh
dsh-omarchy-agent-uninstall
```

如果装过 Omarchy 插件：

```sh
cd ~/.config/omarchy/plugins/dsh-omarchy-agent && ./uninstall.sh
omarchy plugin remove dsh-omarchy-agent
```

## 开发

```sh
mise run install   # npm install
mise run build     # 构建 host 插件和 web client
mise run test      # smoke tests
```

agent 插件在 `src/`；web 卡片在 `src/client/`。`lib/` 已提交，CI 会校验它与源码
一致。

## 说明

- `dsh` 还没有稳定版，所有版本都是 alpha 或 rc。
- `dsh` 没有终端 UI。`dsh web` 是交互界面；`dsh --profile headless "task"`
  是一次性执行。
- DeepSeek 默认上传 session log。在 Web UI 的
  _Settings → General → Upload Session Log_ 里关闭。

## 许可证

MIT
