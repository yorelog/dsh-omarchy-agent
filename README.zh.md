<p align="center"><img src="https://raw.githubusercontent.com/yorelog/dsh-omarchy-agent/main/icon.svg" width="96" height="96" alt="dsh-omarchy-agent icon"></p>

# dsh-omarchy-agent

[English](https://github.com/yorelog/dsh-omarchy-agent/blob/main/README.md) | 中文

**让 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 真正会用你的 Omarchy 桌面。**

coding agent 很会写代码，却看不见桌面。这个插件把实时桌面、真实的 Omarchy 命令、它们背后的文档与源码，以及一个顶栏面板交给 `dsh`。

<p align="center"><img src="https://raw.githubusercontent.com/yorelog/dsh-omarchy-agent/main/docs/topbar.png" width="560" alt="Omarchy 顶栏里的 DeepSeek Harness 面板"></p>

## 你会得到

- **它读得懂现场。** 最近的报错、系统负荷与内存、你最近用过的程序，以及当前项目，都是实时读取。
- **它找得到真正的命令。** `omarchy_catalog` 搜索 `omarchy commands --json`，用真实存在的路由，而不是编一个。
- **它读得到 Omarchy 的源码。** `omarchy_source` 在文档、agent skill、shell 源码和配置里带行号检索，再用 `read` 打开文件。
- **它把 harness 放在手边。** 顶栏面板显示 dsh web 状态、CLI 版本、默认 agent、权限模式、工作目录、会话数、DeepSeek 用量，以及上面这些实时信号。
- **它只查看，不接管。** 桌面、插件、agent 和用量的检查都是只读的；安装 dsh、选择默认 agent、启用插件仍由你决定。
- **卡片，不是 JSON。** 工具结果在 dsh web 会话里显示成小的 Omarchy 卡片。

## 安装

`dsh` 必须已经在 `PATH` 上。安装和选择由 Omarchy 负责；如果当前 Omarchy 还不认识 dsh，先自己安装：

```sh
mise use -g npm:@deepseek-ai/dsh@latest
```

然后把插件装进 `web` profile：

```sh
mise use -g npm:dsh-omarchy-agent
dsh-omarchy-agent-install
```

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

## 安全

- 检查类工具只读。`omarchy_theme set` 和 `omarchy_hypr reload` 是仅有的桌面变更。
- `/usr/share/omarchy` 属于系统包，dsh 不会修改它；你的改动留在 `~/.config`。
- bar 插件加载时不会安装 dsh bundle，也不会在后台跑网络安装。
- `dsh web` 只监听 `127.0.0.1`。不要把它暴露到公网。
- DeepSeek 在使用官方模型 API 时默认上传 session log；在 Web UI 的 _Settings → General → Upload Session Log_ 里关闭。反馈遥测是另一条通道：`DSH_TELEMETRY_MODE=DISABLED` 关闭 OTel 导出，`DSH_TELEMETRY_DISABLED` 让整个进程退出遥测。

## 兼容性

- **Omarchy 4.0.4 及更早** — `omarchy default agent` 里还没有 dsh，也没有 DeepSeek 用量采集器。手动安装 dsh；面板的用量区会显示“Waiting for collector”。
- **quattro / 原生 dsh 支持** — dsh 是 default agent，并有 Omarchy 用量采集器。同一套只读工具会报告这些能力，DeepSeek 用量会自动出现在面板里。

插件按机器实际具备的能力工作，而不是假设某个版本。

## 故障排查

- **找不到 `dsh`** — 运行 `mise use -g npm:@deepseek-ai/dsh@latest`，然后开新 shell。
- **没有工具** — `dsh --profile web --dump-config | grep dsh-omarchy-agent`，然后重启 `dsh web`。
- **升级后面板还是旧的** — bar 会保留已经实例化的 widget；`omarchy plugin update` 后运行 `omarchy restart shell`。
- **Start dsh web 报 `EADDRINUSE`** — 旧版本用 `curl -f` 探测，把已运行 dsh web 的 401 当成“未运行”。升级到最新版本；新版本把任何 HTTP 响应都视为端口已占用。
- **读取 `/usr/share/omarchy` 被拒绝** — 用 `read` 工具或 `omarchy_source`；包含 `sed`、`awk`、`python`、`node`、`perl` 的 shell 命令即使只读也会被当作写入。
- **顶栏没有图标** — 安装 Omarchy 插件，然后运行 `omarchy plugin enable dsh-omarchy-agent right`。
- **用量为空** — 已发布的 Omarchy 没有 DeepSeek 采集器；等原生支持落地后由 Omarchy agents 面板填入。
- **`omarchy agent` 打不开 dsh** — 已发布的 Omarchy 还不认识 dsh；用 `dsh web` 或顶栏面板。

## 开发

agent 插件在 `src/`；web 卡片在 `src/client/`。`lib/` 已提交，CI 会校验它与源码一致。

```sh
mise run install   # npm install
mise run build     # 构建 host 插件和 web client
mise run test      # smoke tests
```

发布在 GitHub Actions 里完成；见 [RELEASING.md](https://github.com/yorelog/dsh-omarchy-agent/blob/main/RELEASING.md)。

## 许可证

MIT
