<p align="center"><img src="https://raw.githubusercontent.com/yorelog/dsh-omarchy-agent/main/docs/banner.png" width="100%" alt="The Dsh Omarchy Agent Banner"></p>

<p align="center"><img src="https://raw.githubusercontent.com/yorelog/dsh-omarchy-agent/main/icon.svg" width="96" height="96" alt="dsh-omarchy-agent icon"></p>

# dsh-omarchy-agent

[![Build](https://github.com/yorelog/dsh-omarchy-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/yorelog/dsh-omarchy-agent/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/dsh-omarchy-agent)](https://www.npmjs.com/package/dsh-omarchy-agent)
[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/yorelog/dsh-omarchy-agent)


[English](https://github.com/yorelog/dsh-omarchy-agent/blob/main/README.md) | 中文

**让 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 真正会用你的 Omarchy 桌面。**

coding agent 很会写代码，却看不见桌面。这个插件把实时桌面、真实的 Omarchy 命令、它们背后的文档与源码，以及一个顶栏面板交给 `dsh`。

## 你会得到

- **它读得懂现场。** 最近的报错、系统负荷与内存、你最近用过的程序，以及当前项目，都是实时读取。
- **它找得到真正的命令。** `omarchy_catalog` 搜索 `omarchy commands --json`，用真实存在的路由，而不是编一个。
- **它读得到 Omarchy 的源码。** `omarchy_source` 在文档、agent skill、shell 源码和配置里带行号检索，再用 `read` 打开文件。
- **它把 harness 放在手边。** 顶栏面板显示 dsh web 状态、CLI 版本、默认 agent、权限模式、工作目录、会话数、DeepSeek 用量，以及上面这些实时信号。
- **面板双向可读。** `omarchy_panel` 把同一组卡片交给 dsh；点卡片会复制上下文并打开一个新的 dsh web 窗口。
- **它只查看，不接管。** 桌面、插件、agent 和用量的检查都是只读的；安装 dsh、选择默认 agent、启用插件仍由你决定。
- **卡片，不是 JSON。** 工具结果在 dsh web 会话里显示成小的 Omarchy 卡片。

## 安装

先安装插件包，再运行它的安装脚本：

```sh
mise use -g npm:dsh-omarchy-agent
dsh-omarchy-agent-install
```

安装脚本会把 bundle 加进 `web` profile。如果 `dsh` 不在 `PATH` 上，它会查询 npm 上最新的已发布版本（包括当前的 `rc` 版本；dsh 目前还没有稳定的 `latest`），并在安装前询问：

```text
dsh is not installed. Install the newest published version (0.2.1-rc.3) with mise? [Y/n]
```

回答 `y`，或用 `--yes` 非交互安装。若希望 dsh 缺失时直接失败，加 `--no-install-dsh`；用 `--dsh-version <version>` 可以固定版本。选择 dsh 为默认 agent 仍由 Omarchy 负责。

还想要顶栏面板？把它作为 Omarchy 插件安装：

```sh
omarchy plugin add https://github.com/yorelog/dsh-omarchy-agent --enable
omarchy plugin enable dsh-omarchy-agent right   # 放到右侧
```

bar 插件和 dsh bundle 是分开的：启用面板不会安装 bundle，所以两步都要做。

如果 `dsh web` 已经在运行，重启一次让它加载新插件。

## 使用

在 dsh web 里直接问：

```text
现在桌面上什么在报错？
bar 为什么崩了？
Omarchy 换壁纸用哪些命令？
BarIconButton 的文档在哪？
我的默认 agent 是谁？
怎么把 agents 小组件移到右边？
```

或者点顶栏的 DeepSeek Harness 图标：

- **左键** 打开 harness 面板。
- **右键** 打开 dsh web UI。
- **中键** 打开带 dsh CLI 的终端。

面板会开在图标下方。如果端口已经被另一个 `dsh web` 占用，它会显示 **External**，并禁用自己的 Start/Stop，而不是再启动一个服务器。

面板里的卡片都能点。点 **Load**、**Errors**、**Recent apps**、**Project** 或任意卡片，面板会把该信号的上下文复制到剪贴板，并新建一个 dsh web 窗口。用 `Win+V`（或你的剪贴板快捷键）粘贴，改完再发送。面板不会替你发送。

## 设置

面板会读取 `shell.json` 里的几个设置：

| 设置 | 默认值 | 作用 |
|---|---|---|
| `port` | `3080` | Web UI 端口。 |
| `permissionMode` | `danger-full-access` | 托管 server 的权限模式。 |
| `workingDirectory` | `~/Work` | 新会话的起始目录。 |
| `refreshIntervalSec` | `10` | 面板打开时的刷新间隔。 |

要改插件配置，编辑 `~/.dsh/profiles/web/cordis.patch.yml`：

```yaml
- id: omarchy-agent
  config:
    privilegedTokens: [sudo, pacman]
```

`privilegedTokens` 默认为空，因为 Omarchy 以 full access 启动 agent。

## 许可证

MIT
