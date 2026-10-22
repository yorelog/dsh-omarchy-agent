<p align="center"><img src="icon.svg" width="96" height="96" alt="dsh-omarchy-agent 图标"></p>

# dsh-omarchy-agent

[English](README.md) | 中文

**为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供 Omarchy 能力。**

一个 `dsh` 插件，不是 Omarchy 桌面安装器：5 个直接操作实时桌面的工具、一条对
Omarchy 包目录的硬性保护规则、一段简短的约定提示词。没有 shim，不改 `PATH`，
不重写 shell 或 Hyprland 配置。

## 亮点

- **让 agent 去查，而不是靠猜。** `omarchy_catalog` 检索
  `omarchy commands --json`，拿到真实路由、参数和 sudo 要求；`omarchy_status`
  和 `omarchy_hypr` 直接返回 `omarchy` / `hyprctl` 的实时 JSON。
- **在 full-access 下仍然有效的一条安全规则。** Omarchy 以
  `DSH_PERMISSION_MODE=danger-full-access` 启动 agent，此时没有沙箱兜底。守卫
  仍然拒绝写入 `/usr/share/omarchy`（`omarchy update` 会覆盖的目录），读取不受
  限制。
- **零侵入。** 没有 shim，不改 `PATH`，不写 `~/.bashrc`、fish、
  `environment.d`、Hyprland、菜单或默认 agent 文件。agent bundle 是一个 npm
  包加一条命令；顶栏 widget 由 Omarchy 插件提供。
- **顺应 Omarchy 的原生 dsh 支持，而不是对抗它。** bundle 装进 `dsh web`
  启动的 `web` profile，启动器、选择器、用量面板仍由 Omarchy 负责。
- **在 dsh web 里也有展示。** 同样的工具在 web 会话中渲染成紧凑的 Omarchy 卡片，
  原始 JSON 收在折叠项里，不再是通用 JSON 卡片。
- **顶栏图标就是控制台。** Omarchy 顶栏 widget 可以启动/停止 `dsh web`、打开
  Web UI 或 dsh CLI，并展示 server、主题、显示器、工作区、失败单元和 DeepSeek
  用量的实时卡片。
- **小而可审计。** 5 个工具、1 个 hook、1 段提示词；没有需要跟随 dsh 版本
  同步的 preset 快照；`lib/` 已提交，CI 校验它与 `src/` 一致。

## 状态：Omarchy 的原生 dsh 支持仍在评审

[#14455][pr14455] 把 dsh 加为 coding agent，[#14040][pr14040] 把它与其余 agent
一起整合。在尚未包含这两个 PR 的已发布 Omarchy 上，dsh 还不在 agent 列表里：
用 mise 安装，并用 `dsh web` 启动。合并之后，Omarchy 会负责安装 lazy mise
工具、添加菜单行、启动 `dsh web`、在 agents 面板统计 dsh。无论哪种情况，下面
的工具都来自这个 bundle。

[pr14455]: https://github.com/omacom/omarchy/pull/14455
[pr14040]: https://github.com/omacom/omarchy/pull/14040

## 提供什么

| 贡献 | 类型 | 作用 |
|---|---|---|
| `omarchy_status` | 工具 | 发行版构建、主题、Hyprland 版本、显示器、工作区、活动窗口、失败的用户单元。 |
| `omarchy_catalog` | 工具 | 检索 `omarchy commands --json`，返回路由、用法和 sudo 要求。 |
| `omarchy_theme` | 工具 | 列出主题、读取当前主题，或应用某个主题。 |
| `omarchy_hypr` | 工具 | 以 JSON 读取实时 Hyprland 状态，或重载配置。 |
| `omarchy_diagnose` | 工具 | 最近的崩溃（`coredumpctl`）和失败的系统/用户单元。 |
| 守卫 | `tools/pre-execute` | 拒绝写入 `/usr/share/omarchy`；读取仍然允许。 |
| 约定 | 系统提示词 | 先读状态再改、优先使用 Omarchy 工具、用户改动留在 `~/.config`。 |
| 顶栏 widget | Omarchy `bar-widget` | 右上角 AI 图标：启动/停止 `dsh web`、打开 Web UI 或 CLI、查看 Omarchy 状态。随 Omarchy 插件提供，不在 npm bundle 里。 |

安装 bundle 后，profile 里的每个 agent 都会获得这些能力，不需要再选择额外的
preset。

## 安装

主要分发方式是 npm 包：`dsh-omarchy-agent`。

`dsh` 必须在 `PATH` 上。缺失时安装器会用 mise 安装（加 `--no-install-dsh`
则直接报错）。Omarchy 的原生 dsh 支持（[#14455][pr14455] / [#14040][pr14040]）
合并后，`omarchy default agent dsh` 也会通过 Omarchy 安装它。

### 推荐：npm 包

```sh
mise use -g npm:dsh-omarchy-agent
dsh-omarchy-agent-install
```

安装器会确保 `dsh` 和 `pnpm` 可用，然后把 bundle 装进 `web` profile。
`--headless` 同时装入一次性 profile，`--profile <name>` 指定其他 profile，
`--dry-run` 先打印计划。npm 包只安装 agent 能力；顶栏 widget 属于下面的
Omarchy shell 插件。

`dsh` 和 `pnpm` 已在 `PATH` 上时，也可以直接把 npm 包装进 profile：

```sh
dsh plugin --profile web add dsh-omarchy-agent
```

没有 mise 时，普通 `npm install -g dsh-omarchy-agent` 也可以。

### 从 checkout 安装

```sh
dsh plugin --profile web add .
```

本地改动即时生效。安装器对 checkout 使用路径，对 npm 安装副本使用包名，因此
profile 持有自己的副本，不会被包管理器清理打断。重新运行安装器（或
`dsh plugin --profile web update dsh-omarchy-agent`）即可刷新 profile 里的副本。

### 作为 Omarchy shell 插件

```sh
omarchy plugin add https://github.com/yorelog/dsh-omarchy-agent --enable
```

插件的 service 会在后台运行一次 npm 安装器。顶栏 widget 和面板也由这个插件安装。

目标是 `web` profile，因为 `dsh web` 启动它（Omarchy 的启动器也是运行
`dsh web`）。加 `--headless` 可同时装入 `headless` profile，用于
`dsh --profile headless "run the tests"`。

启动：

```sh
dsh web         # 现在
omarchy agent   # Omarchy 列出 dsh 之后；SUPER + SHIFT + CTRL + A 同理
```

已运行的 profile 保持启动时的 bundle 集合：安装后重启 `dsh web`。

## 配置

在 profile 的 `cordis.patch.yml`（`~/.dsh/profiles/web/cordis.patch.yml`）里
覆盖 bundle 行：

```yaml
- id: omarchy-agent
  config:
    omarchyBin: omarchy
    protectedPath: /usr/share/omarchy
    privilegedTokens: []
    commandTimeoutMs: 30000
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `omarchyBin` | `omarchy` | 调用 Omarchy 命令使用的二进制。 |
| `protectedPath` | `/usr/share/omarchy` | 禁止修改的包管理目录。 |
| `privilegedTokens` | `[]` | 触发审批门的 token；留空则不启用。 |
| `commandTimeoutMs` | `15000` | 单次 Omarchy/hyprctl 命令的超时。 |

## 安全

- 守卫是纵深防御，不是沙箱。工具以 Harness 进程的 OS 权限运行。
- 读取 `/usr/share/omarchy` 允许；通过 `write`、`edit`、`str_replace_editor`、
  `apply_patch` 或 `bash`/`pwsh` 写入会被拒绝。在
  `DSH_PERMISSION_MODE=danger-full-access` 下没有沙箱兜底，这条规则是唯一仍然
  有效的保护。
- `privilegedTokens` 默认为空，因为 Omarchy 以 full-access 启动默认 agent；没有
  审批服务时 `ask` 会退化为拒绝，反而让 dsh 比其他 agent 更弱。设为
  `[sudo, pkexec, pacman, yay, paru, makepkg]` 可重新启用审批。
- 守卫不检查 PTC `run_code` 里执行的任意代码；介意的话请使用沙箱 shell 或关闭
  PTC 模式。

## 与 Omarchy 原生 dsh 支持的分工

| 职责 | 归属 |
|---|---|
| 安装 `dsh`（lazy mise 工具，支持 prerelease） | Omarchy |
| 选择默认 agent、菜单行、图标 | Omarchy |
| 启动（`omarchy agent`、快捷键、`agent prompt`） | Omarchy |
| agents 面板里的 DeepSeek 余额和 dsh 会话用量 | Omarchy |
| **Omarchy 工具、守卫、约定** | **本 bundle** |
| **把 bundle 装进 `web` profile** | **本 bundle** |

前四行在 [#14455][pr14455] / [#14040][pr14040] 合并后归 Omarchy；在尚未包含它们
的已发布 Omarchy 上，请用 mise 安装 dsh 并用 `dsh web` 启动。后两行始终属于本
bundle。

这里不会修改 `/usr/share/omarchy`、`~/.bashrc`、fish 配置、`environment.d`、
Hyprland 绑定、Omarchy 菜单或默认 agent 文件。旧版本曾这样做；`uninstall.sh`
会清理这些残留。

## 在 dsh web 中使用

bundle 装进 `web` profile，因此同样的工具在 dsh web 会话里也可用。直接提出需求，
agent 调用工具，结果会渲染成一张紧凑的 Omarchy 卡片，原始 JSON 收在“Raw JSON”
折叠项里：

```text
我现在是什么主题？接了哪些显示器？
列出 Omarchy 换壁纸的命令
切到 Tokyo Night 并重载 Hyprland
看看最近的崩溃和失败的单元
```

**Plugins** 页会显示这个 bundle，并允许开关 `omarchy-agent` 这一行。详细配置仍在
profile 的 `cordis.patch.yml` 里（`~/.dsh/profiles/web/cordis.patch.yml`）；
目前还没有 Web 配置表单。

## 顶栏图标

`omarchy plugin add` 还会安装一个顶栏 widget，把同样的控制放到右上角：

- **左键**：打开面板——启动/停止 `dsh web`、打开 Web UI、打开带 dsh CLI 的
  终端，查看本机 Omarchy 状态
- **右键**：直接打开/聚焦 Web UI
- **中键**：打开带 dsh CLI 的终端

`Start dsh web` 通过 transient systemd user unit（`dsh-web`）运行，而不是
Quickshell 进程，所以重启 shell 不会杀掉 server：

```sh
systemctl --user status dsh-web
systemctl --user stop dsh-web
```

面板卡片显示：Web UI 状态/端口、当前主题、显示器/工作区数量、失败的用户单元，
以及 `omarchy-agent-usage-deepseek` 写出记录后的 DeepSeek 余额/用量。`port`、
`workingDirectory`、`permissionMode`、`refreshIntervalSec` 是 `shell.json` 里的
widget 设置。server 的凭据来自 dsh 自己的
`~/.dsh/.credentials.yaml`；如果习惯用环境变量，也可以放在
`~/.config/dsh/web.env`，启动命令会 source 它。npm bundle 不安装这个 widget；
它只随 Omarchy 插件提供。如果已安装但不在顶栏，用
`omarchy plugin enable dsh-omarchy-agent right` 或顶栏设置把它放上去。

## 使用这些工具

在 dsh 会话里直接提出需求，工具即可用：

```text
我现在是什么主题，接了哪些显示器？
列出 Omarchy 里更换壁纸的命令
切换到 Tokyo Night 并重载 Hyprland
看看最近的崩溃和失败的单元
```

模型也可以通过 `omarchy_catalog` 自行发现命令，不必猜路由。

## 故障排查

- **找不到 `dsh`** — 用 `mise use -g npm:@deepseek-ai/dsh@latest` 安装（或者，
  在 Omarchy 列出 dsh 之后用 `omarchy default agent dsh`），然后打开新 shell。
- **会话里没有工具** — 用
  `dsh --profile web --dump-config | grep dsh-omarchy-agent` 确认 bundle 已安装，
  然后重启 profile（`dsh plugin` 的变更在下次启动时生效）。
- **3080 端口被占用** — 已经有一个 `dsh web` 在运行，打开它的 URL，不要再启动
  一个。
- **顶栏没有图标** — widget 随 Omarchy shell 插件提供，不在 npm bundle 里。用
  `omarchy plugin add ... --enable` 安装/更新，再用
  `omarchy plugin enable dsh-omarchy-agent right` 放到顶栏。
- **`omarchy agent` 没有打开 dsh** — 不含 [#14455][pr14455] / [#14040][pr14040]
  的已发布 Omarchy 还不认识 dsh，请用 `dsh web`；支持之后用
  `omarchy default agent dsh` 选中它。
- **`dsh plugin` 提示找不到 pnpm** — `mise use -g pnpm@latest`。
- **`mise use -g npm:dsh-omarchy-agent` 提示 "no versions found"** — mise 会隐藏
  24 小时内发布的 npm 版本（`minimum_release_age`）。请固定版本：
  `mise use -g npm:dsh-omarchy-agent@<version>`。

## 卸载

```sh
dsh-omarchy-agent-uninstall
```

或者从 checkout：

```sh
./uninstall.sh
```

这会从 `web`、`headless` 以及旧版本创建的 profile 里移除 bundle，并删除旧版本
写下的 shim、启动器、shell 配置块和菜单行。它保留 `dsh`，也不改默认 agent；
切换请用 `omarchy default agent <name>`。加 `--remove-dsh` 可同时删除
mise 安装的 dsh。

如果是以 Omarchy 插件方式安装的，先在插件目录运行卸载器，再移除插件：

```sh
cd ~/.config/omarchy/plugins/dsh-omarchy-agent && ./uninstall.sh
omarchy plugin remove dsh-omarchy-agent
```

## 开发

```sh
mise run install       # npm install
mise run build         # tsc -> lib/，并构建浏览器端 lib/client.js
mise run test          # build + 无密钥 smoke test（host 和 client）
mise run pack          # 查看 npm tarball 内容
```

这是一个标准 Cordis 插件：`src/index.ts` 导出 `name`、`inject`、`Config` 和
`apply`，并注册工具、守卫和提示词 section。`src/client/index.tsx` 是浏览器端：
通过 dsh web client 的 slot 系统，为每个工具注册一个 `tool.call.toolview` 视图。
`lib/` 已提交；CI 会校验它与 `src/` 一致。

## 模型体验

bundle 注册 5 个工具和 1 个系统提示词 section。工具 schema 和约定文本对模型
可见，并会记录在会话日志里。

- **Token 影响** — 有条件：工具可见时增加固定 token；约定 section 每次请求都
  增加一小段固定文本。
- **KV Cache 影响** — 只追加。section 文本只在插件配置变化时改变；工具不会
  重写之前的请求 token。

## 已知限制

- **依赖 developer preview** — dsh 还没有稳定版（已发布的版本全是 alpha 或
  rc）。bundle 的 peer 范围不锁版本且标记为可选，构建期 dev 依赖固定在 bundle
  所针对的版本（`0.2.0-rc.2`）。dsh 破坏插件 API 时一起升级。
- **没有终端 UI** — dsh 本身不提供。`dsh web` 是交互界面；
  `dsh --profile headless "task"` 是一次性执行，打印答案后退出。
- **dsh 默认上传 session log**，且不受 `DSH_TELEMETRY_MODE` 控制。在浏览器 UI
  的 _Settings → General → Upload Session Log_ 里关闭；`DSH_TELEMETRY_MODE=DISABLED`
  只覆盖 OTel。
- **`danger-full-access`** — Omarchy 以无审批模式启动 agent。守卫只保证包管理
  目录只读，其他都不设围栏。

## 许可证

MIT
