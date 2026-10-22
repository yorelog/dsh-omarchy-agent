<p align="center"><img src="https://raw.githubusercontent.com/yorelog/dsh-omarchy-agent/main/icon.svg" width="96" height="96" alt="dsh-omarchy-agent 图标"></p>

# dsh-omarchy-agent

[English](https://github.com/yorelog/dsh-omarchy-agent/blob/main/README.md) | 中文

**让 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 真正会用你的 Omarchy 桌面。**

coding agent 很会写代码，却看不见桌面。这个插件给 `dsh` 操作实时桌面和源码的工具、
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
- **它找得到源码。** `omarchy_source` 在 Omarchy 文档、skill、shell 源码里
  带行号检索——不会撞上 shell 读取的 guard。
- **它只查看，不接管。** `omarchy_plugin`、`omarchy_shell`、`omarchy_agent`
  只读地查看插件、bar 状态、默认 agent 和用量记录；安装、选择、启用仍由你决定。
- **它弄不坏 Omarchy。** `/usr/share/omarchy` 对 agent 只读；你的改动留在
  `~/.config`。
- **一个图标控制全部。** 在顶栏启动/停止 `dsh web`、打开 Web UI 或 CLI，查看
  server、主题、显示器、失败单元和当前默认 agent。面板会开在图标下方。
- **卡片，不是 JSON。** 工具结果在 dsh web 会话里显示成小的 Omarchy 卡片。

## 边界

dsh 是 Omarchy 的 default agent 之一，不是管理员。检查类工具只读：dsh 可以读桌面
状态、命令、文档、插件和用量记录，但不会安装 dsh、选择默认 agent、启停插件或改
遥测；这些由你或 Omarchy 决定。

## 工具

| 工具 | 读什么 / 做什么 |
|---|---|
| `omarchy_status` | 主题、显示器、工作区、活动窗口、失败的用户单元。 |
| `omarchy_catalog` | 搜索 `omarchy commands --json`，包括 alias、routes 和单命令 help。 |
| `omarchy_theme` | 列出/读取主题，或应用主题（`set` 会改桌面）。 |
| `omarchy_hypr` | Hyprland 状态，或重载配置（`reload` 会改桌面）。 |
| `omarchy_diagnose` | 最近的崩溃和失败的系统/用户单元。 |
| `omarchy_source` | 只读检索 Omarchy 文档、skill、shell 源码和配置。 |
| `omarchy_agent` | 只读查看默认 agent、dsh 可用性和用量记录。 |
| `omarchy_plugin` | 只读查看插件列表和校验结果。 |
| `omarchy_shell` | 只读查看插件、配置和 bar 几何。 |

只有 `omarchy_theme set` 和 `omarchy_hypr reload` 会改桌面；
`omarchy_agent`、`omarchy_plugin`、`omarchy_shell`、`omarchy_source` 全部只读。

## 安装

`dsh` 必须已经在 `PATH` 上。安装和选择由 Omarchy 负责；如果当前 Omarchy 还不认识
dsh，先自己安装：`mise use -g npm:@deepseek-ai/dsh@latest`，然后开新 shell。

**主要方式：npm**

```sh
mise use -g npm:dsh-omarchy-agent
dsh-omarchy-agent-install
```

这会把插件装进 `dsh web` 使用的 `web` profile。加 `--headless` 也装一次性
profile；加 `--dry-run` 先看计划。

mise 默认会隐藏 24 小时内发布的 npm 版本，只写包名可能装到旧版。要固定版本：

```sh
mise use -g npm:dsh-omarchy-agent@<version>
dsh-omarchy-agent-install --version <version>
```

已经有 `dsh` 和 `pnpm`？可以跳过安装器：

```sh
dsh plugin --profile web add dsh-omarchy-agent
# 或固定版本：
dsh plugin --profile web add dsh-omarchy-agent@<version>
```

**想要顶栏面板？** 再装 Omarchy 插件：

```sh
omarchy plugin add https://github.com/yorelog/dsh-omarchy-agent --enable
omarchy plugin enable dsh-omarchy-agent right   # 放到右侧
```

启用面板不会安装 dsh bundle；bar 插件和 dsh bundle 是分开的，上面的安装器也要跑。

**从 checkout 安装：** `dsh plugin --profile web add .`

如果 `dsh web` 已经在运行，重启它。

## 使用

在 dsh web 会话里直接问：

```text
我现在是什么主题？接了哪些显示器？
列出 Omarchy 换壁纸的命令
切到 Tokyo Night 并重载 Hyprland
bar 为什么崩了？
BarIconButton 的文档在哪？
我的默认 agent 是谁？
装了哪些 Omarchy 插件？
怎么把 agents 小组件移到右边？
```

最后一个只会返回 `omarchy bar move` 命令，dsh 不会替你启用或移动小组件。

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

- 检查类工具只读。`omarchy_theme set` 和 `omarchy_hypr reload` 是仅有的桌面变更。
- Omarchy 插件加载时不再自动跑安装器；需要 dsh bundle 时显式运行
  `dsh-omarchy-agent-install`。
- 守卫阻止写入 `/usr/share/omarchy`。读取请用 `read` 工具、`cat`、`head` 或 `rg`；包含 `sed`、`awk`、`python`、`node`、`perl` 的 shell 命令即使只读也会被当作写入。
- 它不是沙箱：工具以你的用户权限运行。
- `dsh web` 只监听 `127.0.0.1`。不要把它暴露到公网。

## 兼容性

| Omarchy | 行为 |
|---|---|
| 4.0.4 及更早 | `omarchy default agent` 里没有 dsh，也没有 DeepSeek collector；需要手动安装 dsh，`omarchy_agent` 会如实报告。 |
| quattro / #14040 | dsh 是 default agent，并有 DeepSeek 用量 collector；只读工具会报告这些能力，用量由 Omarchy agents 面板负责。 |

## 故障排查

- **找不到 `dsh`** — `mise use -g npm:@deepseek-ai/dsh@latest`，然后开新 shell。
- **没有工具** — `dsh --profile web --dump-config | grep dsh-omarchy-agent`，
  然后重启 `dsh web`。
- **读取 `/usr/share/omarchy` 被拒绝** — 守卫把 `sed`、`awk`、`python`、`node`、
  `perl` 当作写入（即使只读）；改用 `read` 工具、`cat`、`head` 或 `rg`。
- **顶栏没有图标** — 安装上面的 Omarchy 插件，然后
  `omarchy plugin enable dsh-omarchy-agent right`。
- **3080 端口被占用** — 已经有 `dsh web` 在运行，打开它的 URL。
- **用量为空** — 已发布的 Omarchy 没有 DeepSeek collector；quattro/#14040 之后由
  Omarchy agents 面板负责，`omarchy_agent` 会说明当前哪一边可用。
- **Stop dsh web 是灰色的** — 端口被另一个 `dsh web` 占用；去它启动的地方停，
  而不是从面板停。
- **Start dsh web 报 `EADDRINUSE`** — 0.4.1 用 `curl -f` 探测，把已运行 dsh web
  的 401 当成未运行，于是又启动一个。升级到 0.4.2；它把任何 HTTP 响应都视为
  端口已占用。
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

发布在 GitHub Actions 里完成；见
[RELEASING.md](https://github.com/yorelog/dsh-omarchy-agent/blob/main/RELEASING.md)。

## 说明

- `dsh` 还没有稳定版，所有版本都是 alpha 或 rc。
- `dsh` 没有终端 UI。`dsh web` 是交互界面；`dsh --profile headless "task"`
  是一次性执行。
- DeepSeek 在使用官方模型 API 时默认上传 session log。在 Web UI 的
  _Settings → General → Upload Session Log_ 里关闭。
- 反馈遥测是另一条通道：`DSH_TELEMETRY_MODE=DISABLED` 关闭 OTel 反馈导出，
  `DSH_TELEMETRY_DISABLED` 让整个进程退出遥测。

## 版本说明

- **0.4.2** — 面板把 `127.0.0.1:3080` 的任何 HTTP 响应都视为服务器正在运行。
  dsh web 的 `/` 返回 401，0.4.1 的 `curl -f` 探测因此误判并启动第二个实例，
  报 `EADDRINUSE`。
- **0.4.1** — 面板改为开在顶栏图标下方，不再按整条 bar 居中。
- **0.4.0** — 新增只读的 `omarchy_source`、`omarchy_agent`、`omarchy_plugin`、
  `omarchy_shell`；明确 default agent 边界；移除加载即安装的 service；用量交给
  Omarchy agents 面板；为 Qt 6.12 限定 palette 颜色，并把图标适配 12px 目标。

## 许可证

MIT
