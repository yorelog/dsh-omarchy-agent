pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Commons as Commons
import qs.Ui

// One AI icon in the bar, one panel: start/stop the dsh web server, open the
// web UI or a terminal with the dsh CLI, and read the local Omarchy state.
//
// The server runs as a transient systemd user unit rather than a Quickshell
// Process, so a shell restart (theme change, update) does not kill it. The
// unit is collected automatically when it exits.
Panel {
  id: root
  moduleName: "dsh-omarchy-agent"
  ipcTarget: "dsh-omarchy-agent"
  manageIpc: false

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  readonly property string home: Quickshell.env("HOME") || ""
  readonly property string workDir: {
    var configured = String(setting("workingDirectory", ""))
    return configured !== "" ? configured : root.home + "/Work"
  }
  readonly property int port: Number(setting("port", 3080))
  readonly property string permissionMode: String(setting("permissionMode", "danger-full-access"))
  readonly property int refreshIntervalSec: Number(setting("refreshIntervalSec", 10))

  readonly property color foreground: bar ? bar.foreground : Commons.Color.foreground
  readonly property color dim: Qt.darker(foreground, 1.55)
  readonly property color urgent: bar ? bar.urgent : Commons.Color.urgent
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  property bool unitActive: false
  property bool portOpen: false
  readonly property bool serverRunning: unitActive || portOpen
  readonly property bool externalServer: portOpen && !unitActive

  property int failedUnits: 0
  property string failedUnitName: ""
  property string defaultAgent: ""
  property string dshVersion: ""
  property int sessionCount: 0
  property var deepseek: null

  property real load1: 0
  property int cpuCount: 0
  property real memUsed: 0
  property real memTotal: 0
  property int recentErrors: 0
  property string lastErrorLine: ""
  property string recentApps: ""
  property string projectName: ""
  property string gitBranch: ""
  property int gitDirty: 0

  property string lastError: ""
  property bool pendingOpen: false
  property bool pendingStart: false
  property int pendingTicks: 0
  property bool pendingNewWindow: false

  onOpenedChanged: {
    if (opened) {
      refresh()
      pendingTicks = 0
    }
  }

  function refresh() {
    probe(statusProc)
    probe(portProc)
    probe(unitsProc)
    probe(agentProc)
    probe(usageProc)
    probe(cliProc)
    probe(sessionsProc)
    probe(loadProc)
    probe(memProc)
    probe(errorsProc)
    probe(appsProc)
    probe(projectProc)
  }

  function probe(process) {
    if (!process.running) process.running = true
  }

  function startServer() {
    if (startProc.running || pendingStart) return
    if (externalServer) {
      lastError = "dsh web is already running outside the panel on port " + port
      return
    }
    // A fresh port probe decides whether the server is really absent. The
    // cached `portOpen` is not trusted here: the server may have stopped since
    // the last refresh, or `port` may have changed under it.
    lastError = ""
    pendingTicks = 0
    pendingStart = true
    if (!portProc.running) portProc.running = true
  }

  function stopServer() {
    if (stopProc.running || !unitActive) return
    stopProc.running = true
  }

  function toggleServer() {
    if (serverRunning) stopServer()
    else startServer()
  }

  function launchWeb() {
    pendingOpen = false
    pendingTicks = 0
    if (pendingNewWindow) {
      pendingNewWindow = false
      launchNewWindow()
      return
    }
    if (!openProc.running) openProc.running = true
    close()
  }

  function openWeb() {
    if (serverRunning) {
      launchWeb()
      return
    }
    pendingOpen = true
    startServer()
  }

  function launchNewWindow() {
    if (newWebProc.running) return
    newWebProc.command = ["omarchy-launch-webapp", "http://127.0.0.1:" + port + "/?panel=" + Date.now()]
    newWebProc.running = true
    close()
  }

  function openTerminal() {
    if (!terminalProc.running) terminalProc.running = true
    close()
  }

  function serverLabel() {
    return serverRunning ? (externalServer ? "External" : "Running") : "Stopped"
  }

  function serverDetail() {
    return externalServer ? "outside the panel · :" + port : "127.0.0.1:" + port
  }

  function shortWorkDir() {
    var path = workDir
    return path.indexOf(home + "/") === 0 ? "~" + path.slice(home.length) : path
  }

  function permissionLabel() {
    return permissionMode === "danger-full-access" ? "Full access" : "Workspace"
  }

  function cliLabel() {
    return dshVersion !== "" ? "v" + dshVersion : "not found"
  }

  function formatTokens(count) {
    if (typeof count !== "number" || !isFinite(count) || count <= 0) return "—"
    if (count >= 1000000) return (count / 1000000).toFixed(1) + "M"
    if (count >= 1000) return (count / 1000).toFixed(1) + "k"
    return String(Math.round(count))
  }

  function balanceLabel() {
    var record = deepseek
    if (!record || !record.balance || typeof record.balance.remaining !== "number") return "—"
    var value = Number(record.balance.remaining).toFixed(2)
    var currency = record.balance.currency ? " " + String(record.balance.currency) : ""
    return (record.balance.estimated === true ? "~" : "") + value + currency
  }

  function todayLabel() {
    var record = deepseek
    if (!record) return "—"
    var prompts = typeof record.todayPrompts === "number" ? record.todayPrompts : 0
    return prompts + " prompts · " + formatTokens(record.todayTotalTokens)
  }

  function planLabel() {
    return deepseek && deepseek.tierLabel ? String(deepseek.tierLabel) : "—"
  }

  function usageStatus() {
    var record = deepseek
    if (!record) return "No usage record"
    return record.usageStatusText ? String(record.usageStatusText) : "Ready"
  }

  function loadLabel() {
    return load1.toFixed(2)
  }

  function cpuLabel() {
    return cpuCount > 0 ? cpuCount + " cores" : "—"
  }

  function memoryPercent() {
    if (memTotal <= 0) return "—"
    return Math.round((memUsed / memTotal) * 100) + "%"
  }

  function memoryLabel() {
    if (memTotal <= 0) return "—"
    return (memUsed / 1073741824).toFixed(1) + " / " + (memTotal / 1073741824).toFixed(1) + " GB"
  }

  function projectValue() {
    if (gitBranch !== "") return projectName !== "" ? projectName : shortWorkDir()
    return shortWorkDir()
  }

  function projectDetail() {
    var parts = []
    if (gitBranch !== "") parts.push(gitBranch)
    if (gitDirty > 0) parts.push(gitDirty + " changes")
    return parts.length > 0 ? parts.join(" · ") : "not a git repository"
  }

  function appsValue() {
    return recentApps !== "" ? recentApps : "—"
  }

  function prettyApp(name) {
    if (name.indexOf("chrome-127.0.0.1") === 0) return ""
    if (name === "org.omarchy.agent" || name === "com.yorelog.dsh-omarchy-agent") return "dsh terminal"
    if (name === "com.microsoft.VSCode" || name === "code" || name === "code-oss") return "VSCode"
    if (name === "chromium") return "Chromium"
    if (name === "google-chrome" || name === "chrome") return "Chrome"
    return name
  }

  function errorsDetail() {
    return lastErrorLine !== "" ? lastErrorLine : "no errors in the last hour"
  }

  function failedUnitsDetail() {
    return failedUnitName !== "" ? failedUnitName : ""
  }

  function cardPrompt(id) {
    var lines = ["From the DeepSeek Harness bar panel:"]
    switch (id) {
    case "web":
      lines.push("The dsh web server is " + serverLabel() + " on 127.0.0.1:" + port + ".")
      lines.push("Explain what this means and what I should check before using it.")
      break
    case "cli":
      lines.push("The dsh CLI is " + cliLabel() + "; the default agent is " + (defaultAgent !== "" ? defaultAgent : "not selected") + ".")
      lines.push("Help me verify the CLI and pick the right way to start a session.")
      break
    case "agent":
      lines.push("My Omarchy default agent is " + (defaultAgent !== "" ? defaultAgent : "not selected") + "; dsh is " + cliLabel() + ".")
      lines.push("Help me decide whether dsh should be the default and what I need to run.")
      break
    case "permission":
      lines.push("dsh is running with permission mode " + permissionMode + ".")
      lines.push("Explain the risk of this mode and when I should use workspace-write instead.")
      break
    case "workdir":
      lines.push("My dsh working directory is " + workDir + ".")
      lines.push("Check what project is there and suggest the next useful step.")
      break
    case "sessions":
      lines.push("I have " + sessionCount + " dsh sessions on this machine.")
      lines.push("Help me find the most relevant one and summarize what I was working on.")
      break
    case "usage":
      lines.push("DeepSeek usage from Omarchy: balance " + balanceLabel() + ", today " + todayLabel() + ", plan " + planLabel() + ", status " + usageStatus() + ".")
      lines.push("Explain what this means and how I can keep usage under control.")
      break
    case "load":
      lines.push("System load is " + loadLabel() + " on " + cpuLabel() + ".")
      lines.push("Check what is consuming CPU and suggest what I should do.")
      break
    case "memory":
      lines.push("Memory is " + memoryPercent() + " (" + memoryLabel() + ").")
      lines.push("Check what is consuming memory and whether I should act.")
      break
    case "errors":
      lines.push("There were " + recentErrors + " user journal errors in the last hour; the last was: " + (lastErrorLine !== "" ? lastErrorLine : "none") + ".")
      lines.push("There are " + failedUnits + " failed user units. Diagnose the cause and give me the next command.")
      break
    case "failed-units":
      lines.push("There are " + failedUnits + " failed user units.")
      lines.push("Run a diagnosis and explain what failed and what I should do next.")
      break
    case "recent-apps":
      lines.push("I have recently used: " + (recentApps !== "" ? recentApps : "no tracked apps") + ".")
      lines.push("Help me pick up where I left off or check the state of these apps.")
      break
    case "project":
      lines.push("My project is " + projectValue() + " in " + shortWorkDir() + " (" + projectDetail() + ").")
      lines.push("Check the project state and suggest the next useful step.")
      break
    default:
      return ""
    }
    return lines.join("\n")
  }

  function copyPrompt(text) {
    if (text === "") return
    copyProc.command = ["bash", "-c", "printf '%s' \"$1\" | wl-copy", "_", String(text).trim()]
    copyProc.running = true
  }

  function askCard(id) {
    var text = cardPrompt(id)
    if (text === "") return false
    copyPrompt(text)
    if (serverRunning) {
      launchNewWindow()
      return true
    }
    pendingNewWindow = true
    pendingOpen = true
    startServer()
    return true
  }

  function activateCard(id) {
    return askCard(id)
  }

  function panelSignals() {
    return {
      server: {
        running: serverRunning,
        managed: unitActive,
        external: externalServer,
        port: port
      },
      harness: {
        cli: dshVersion,
        defaultAgent: defaultAgent,
        permission: permissionMode,
        workdir: workDir,
        sessions: sessionCount
      },
      usage: deepseek === null ? null : {
        balance: balanceLabel(),
        today: todayLabel(),
        plan: planLabel(),
        status: usageStatus()
      },
      signals: {
        load: loadLabel(),
        cores: cpuCount,
        memoryPercent: memoryPercent(),
        memory: memoryLabel(),
        errors: recentErrors,
        lastError: lastErrorLine,
        failedUnits: failedUnits,
        recentApps: recentApps,
        project: projectName,
        branch: gitBranch,
        dirty: gitDirty
      },
      cards: [
        { id: "web", label: "Web UI", value: serverLabel() },
        { id: "cli", label: "dsh CLI", value: cliLabel() },
        { id: "agent", label: "Default agent", value: defaultAgent !== "" ? defaultAgent : "Not selected" },
        { id: "permission", label: "Permission", value: permissionLabel() },
        { id: "workdir", label: "Workdir", value: shortWorkDir() },
        { id: "sessions", label: "Sessions", value: String(sessionCount) },
        { id: "usage", label: "DeepSeek usage", value: usageStatus() },
        { id: "load", label: "Load", value: loadLabel() },
        { id: "memory", label: "Memory", value: memoryPercent() },
        { id: "errors", label: "Errors (1h)", value: String(recentErrors) },
        { id: "failed-units", label: "Failed units", value: String(failedUnits) },
        { id: "recent-apps", label: "Recent apps", value: recentApps },
        { id: "project", label: "Project", value: projectName }
      ]
    }
  }

  // Read-only from the shell's point of view apart from the two dsh-web
  // lifecycle calls this panel owns; Omarchy's plugin and agent choices stay
  // outside this target.
  IpcHandler {
    target: root.ipcTarget

    function open(): void { root.open() }
    function close(): void { root.close() }
    function toggle(): void { root.toggle() }
    function start(): string { root.startServer(); return "ok" }
    function stop(): string { root.stopServer(); return "ok" }
    function refresh(): string { root.refresh(); return "ok" }
    function signals(): string { return JSON.stringify(root.panelSignals()) }
    function activate(id: string): string { return root.activateCard(id) ? "ok" : "unknown" }
    function status(): string {
      return JSON.stringify({
        running: root.serverRunning,
        managed: root.unitActive,
        external: root.externalServer,
        port: root.port
      })
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    // The harness bolts shut while the server runs: an outline fitting at rest,
    // a solid one when live, so the bar reads the state without a label.
    iconComponent: Component {
      DshMark {
        color: button.foreground
        filled: root.serverRunning
      }
    }
    tooltipText: "DeepSeek Harness"
    onPressed: function(buttonCode) {
      if (buttonCode === Qt.RightButton) root.openWeb()
      else if (buttonCode === Qt.MiddleButton) root.openTerminal()
      else root.toggle()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    // Anchor under the bar icon; centering on the whole bar would detach the
    // panel from the widget that opened it.
    centerOnBar: false
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(380))
    contentHeight: panel.fittedContentHeight(column.implicitHeight, Style.space(900))

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onActivateRequested: root.openWeb()

      Column {
        id: column
        width: parent.width
        spacing: Style.space(12)

        PanelHero {
          width: parent.width
          iconComponent: heroIcon
          title: "DeepSeek Harness"
          meta: root.serverRunning ? "Web UI running" : "Web UI stopped"
          detail: "web profile · 127.0.0.1:" + root.port
          foreground: root.foreground
          fontFamily: root.fontFamily
        }

        PanelSeparator { foreground: root.foreground }

        Column {
          width: parent.width
          spacing: Style.space(6)

          Button {
            width: parent.width
            text: "Open web UI"
            iconText: "󰖟"
            tooltipText: "Open or focus the dsh web UI"
            foreground: root.foreground
            fontFamily: root.fontFamily
            bordered: true
            onClicked: root.openWeb()
          }

          Button {
            width: parent.width
            text: root.externalServer
              ? "dsh web running outside the panel"
              : (root.serverRunning ? "Stop dsh web" : "Start dsh web")
            iconText: root.serverRunning ? "󰓛" : "󰐊"
            tooltipText: root.externalServer
              ? "Another dsh web owns this port; stop it outside the panel"
              : (root.serverRunning ? "Stop the dsh web server" : "Start the dsh web server")
            foreground: root.foreground
            fontFamily: root.fontFamily
            bordered: true
            enabled: !root.externalServer
            onClicked: root.toggleServer()
          }

          Button {
            width: parent.width
            text: "Open terminal (dsh CLI)"
            iconText: "󰆍"
            tooltipText: "Open a terminal with the dsh CLI"
            foreground: root.foreground
            fontFamily: root.fontFamily
            bordered: true
            onClicked: root.openTerminal()
          }
        }

        PanelSectionHeader {
          text: "HARNESS"
          foreground: root.foreground
          fontFamily: root.fontFamily
        }

        Row {
          width: parent.width
          spacing: Style.space(8)

          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "WEB UI"
            actionId: "web"
            onActivated: root.activateCard("web")
            value: root.serverLabel()
            detail: root.serverDetail()
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "DSH CLI"
            actionId: "cli"
            onActivated: root.activateCard("cli")
            value: root.cliLabel()
          }
        }

        Row {
          width: parent.width
          spacing: Style.space(8)

          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "DEFAULT AGENT"
            actionId: "agent"
            onActivated: root.activateCard("agent")
            value: root.defaultAgent !== "" ? root.defaultAgent : "Not selected"
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "PERMISSION"
            actionId: "permission"
            onActivated: root.activateCard("permission")
            value: root.permissionLabel()
          }
        }

        Row {
          width: parent.width
          spacing: Style.space(8)

          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "WORKDIR"
            actionId: "workdir"
            onActivated: root.activateCard("workdir")
            value: root.shortWorkDir()
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "SESSIONS"
            actionId: "sessions"
            onActivated: root.activateCard("sessions")
            value: String(root.sessionCount)
          }
        }

        PanelSectionHeader {
          text: "DEEPSEEK"
          foreground: root.foreground
          fontFamily: root.fontFamily
        }

        Row {
          visible: root.deepseek !== null
          width: parent.width
          spacing: Style.space(8)

          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "BALANCE"
            actionId: "usage"
            onActivated: root.activateCard("usage")
            value: root.balanceLabel()
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "TODAY"
            actionId: "usage"
            onActivated: root.activateCard("usage")
            value: root.todayLabel()
          }
        }

        Row {
          visible: root.deepseek !== null
          width: parent.width
          spacing: Style.space(8)

          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "PLAN"
            actionId: "usage"
            onActivated: root.activateCard("usage")
            value: root.planLabel()
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "USAGE STATUS"
            actionId: "usage"
            onActivated: root.activateCard("usage")
            value: root.usageStatus()
          }
        }

        StatCard {
          visible: root.deepseek === null
          width: parent.width
          label: "USAGE"
          actionId: "usage"
          onActivated: root.activateCard("usage")
          value: "Waiting for collector"
          detail: "Omarchy's agents panel fills this in."
        }

        PanelSectionHeader {
          text: "SIGNALS"
          foreground: root.foreground
          fontFamily: root.fontFamily
        }

        Row {
          width: parent.width
          spacing: Style.space(8)

          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "LOAD"
            actionId: "load"
            onActivated: root.activateCard("load")
            value: root.loadLabel()
            detail: root.cpuLabel()
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "MEMORY"
            actionId: "memory"
            onActivated: root.activateCard("memory")
            value: root.memoryPercent()
            detail: root.memoryLabel()
          }
        }

        Row {
          width: parent.width
          spacing: Style.space(8)

          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "ERRORS (1H)"
            actionId: "errors"
            onActivated: root.activateCard("errors")
            value: String(root.recentErrors)
            detail: root.errorsDetail()
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "FAILED UNITS"
            actionId: "failed-units"
            onActivated: root.activateCard("failed-units")
            value: String(root.failedUnits)
            detail: root.failedUnitsDetail()
          }
        }

        StatCard {
          width: parent.width
          label: "RECENT APPS"
          actionId: "recent-apps"
          onActivated: root.activateCard("recent-apps")
          value: root.appsValue()
        }

        StatCard {
          width: parent.width
          label: "PROJECT"
          actionId: "project"
          onActivated: root.activateCard("project")
          value: root.projectValue()
          detail: root.projectDetail()
        }

        Text {
          visible: root.lastError !== ""
          width: parent.width
          text: root.lastError
          color: root.urgent
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          textFormat: Text.PlainText
          wrapMode: Text.WordWrap
        }
      }
    }
  }

  Component {
    id: heroIcon

    Item {
      width: Style.font.display
      height: Style.font.display

      DshMark {
        anchors.fill: parent
        color: root.foreground
        gradient: true
      }
    }
  }

  component StatCard: Rectangle {
    id: card
    property string label: ""
    property string value: ""
    property string detail: ""
    property string actionId: ""

    signal activated()

    implicitHeight: cardColumn.implicitHeight + Style.space(16)
    radius: Style.cornerRadius
    color: card.actionId !== "" && cardMouse.containsMouse
      ? Qt.rgba(root.foreground.r, root.foreground.g, root.foreground.b, 0.12)
      : Qt.rgba(root.foreground.r, root.foreground.g, root.foreground.b, 0.05)

    Behavior on color {
      ColorAnimation { duration: 120 }
    }

    Column {
      id: cardColumn
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      anchors.leftMargin: Style.space(10)
      anchors.rightMargin: Style.space(10)
      spacing: Style.space(2)

      Text {
        width: parent.width
        text: card.label
        color: root.dim
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
        textFormat: Text.PlainText
        elide: Text.ElideRight
      }
      Text {
        width: parent.width
        text: card.value
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.title
        font.bold: true
        textFormat: Text.PlainText
        elide: Text.ElideRight
      }
      Text {
        visible: card.detail !== ""
        width: parent.width
        text: card.detail
        color: root.dim
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        textFormat: Text.PlainText
        elide: Text.ElideRight
      }
    }

    Text {
      visible: card.actionId !== ""
      text: "›"
      anchors.right: parent.right
      anchors.rightMargin: Style.space(8)
      anchors.top: parent.top
      anchors.topMargin: Style.space(4)
      color: root.dim
      font.family: root.fontFamily
      font.pixelSize: Style.font.title
    }

    MouseArea {
      id: cardMouse
      anchors.fill: parent
      enabled: card.actionId !== ""
      hoverEnabled: card.actionId !== ""
      cursorShape: card.actionId !== "" ? Qt.PointingHandCursor : Qt.ArrowCursor
      onClicked: card.activated()
    }
  }

  Timer {
    interval: Math.max(3, root.refreshIntervalSec) * 1000
    running: root.opened
    repeat: true
    onTriggered: root.refresh()
  }

  Timer {
    interval: 500
    repeat: true
    running: root.pendingOpen
    onTriggered: {
      root.pendingTicks += 1
      root.probe(portProc)
      if (root.portOpen) root.launchWeb()
      else if (root.pendingTicks >= 60) {
        root.pendingOpen = false
        root.lastError = "dsh web did not answer on port " + root.port
      }
    }
  }

  Process {
    id: statusProc
    command: ["systemctl", "--user", "is-active", "dsh-web"]
    onExited: function(exitCode) {
      root.unitActive = exitCode === 0
    }
  }

  Process {
    id: portProc
    // dsh web answers 401 on / without a session, so -f would report a live
    // server as down. Any HTTP response means the port is already in use.
    command: ["bash", "-c", "curl -s --max-time 2 -o /dev/null http://127.0.0.1:" + root.port]
    onExited: function(exitCode) {
      root.portOpen = exitCode === 0
      if (!root.pendingStart) return
      root.pendingStart = false
      if (root.portOpen) {
        if (!root.pendingOpen) root.lastError = "dsh web is already running on port " + root.port
        return
      }
      // `startProc` is an id in this component, not a property of `root`, so
      // qualify-free lookup is the one that resolves.
      if (!root.unitActive) startProc.running = true
    }
  }

  Process {
    id: unitsProc
    command: ["bash", "-c", "systemctl --user --failed --no-legend --no-pager 2>/dev/null | awk 'NR==1{first=($1 ~ /\\./ ? $1 : $2)} {n++} END{printf \"%d|%s\\n\", n, first}'"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var parts = String(text).trim().split("|")
        var count = parseInt(parts[0], 10)
        root.failedUnits = isNaN(count) ? 0 : count
        root.failedUnitName = (parts[1] || "").trim()
      }
    }
  }

  Process {
    id: agentProc
    command: [
      "bash", "-c",
      "cat \"$HOME/.config/omarchy/defaults/agent\" 2>/dev/null || omarchy-default-agent 2>/dev/null || true"
    ]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.defaultAgent = String(text).trim()
    }
  }

  Process {
    id: usageProc
    command: ["bash", "-c", "cat \"$HOME/.local/state/omarchy/agents/usage/deepseek.json\" 2>/dev/null || true"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var raw = String(text).trim()
        if (raw === "") {
          root.deepseek = null
          return
        }
        try {
          root.deepseek = JSON.parse(raw)
        } catch (error) {
          root.deepseek = null
        }
      }
    }
  }

  Process {
    id: cliProc
    command: ["dsh", "--version"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var first = String(text).trim().split("\n")[0] || ""
        root.dshVersion = first
      }
    }
    onExited: function(exitCode) {
      if (exitCode !== 0) root.dshVersion = ""
    }
  }

  Process {
    id: sessionsProc
    command: [
      "bash", "-c",
      "find \"${DSH_HOME:-$HOME/.dsh}/sessions\" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l"
    ]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var count = parseInt(String(text).trim(), 10)
        root.sessionCount = isNaN(count) ? 0 : count
      }
    }
  }

  Process {
    id: copyProc
    command: []
  }

  Process {
    id: loadProc
    command: ["bash", "-c", "awk '{print $1}' /proc/loadavg; nproc"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var parts = String(text).trim().split("\n")
        root.load1 = parseFloat(parts[0]) || 0
        var cores = parseInt(parts[1], 10)
        root.cpuCount = isNaN(cores) ? 0 : cores
      }
    }
  }

  Process {
    id: memProc
    command: [
      "bash", "-c",
      "awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{printf \"%d %d\\n\", t*1024, (t-a)*1024}' /proc/meminfo"
    ]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var parts = String(text).trim().split(/\s+/)
        root.memTotal = parseFloat(parts[0]) || 0
        root.memUsed = parseFloat(parts[1]) || 0
      }
    }
  }

  Process {
    id: errorsProc
    command: [
      "bash", "-c",
      "journalctl --user -p 3 --since \"1 hour ago\" --no-pager -o cat 2>/dev/null | tail -n 200"
    ]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var lines = String(text).trim().split("\n").filter(function(line) { return line.trim() !== "" })
        root.recentErrors = lines.length
        var last = lines.length > 0 ? lines[lines.length - 1].trim() : ""
        root.lastErrorLine = last.length > 110 ? last.slice(0, 107) + "…" : last
      }
    }
  }

  Process {
    id: appsProc
    command: ["bash", "-c", "hyprctl clients -j 2>/dev/null"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        try {
          var clients = JSON.parse(String(text))
          if (!Array.isArray(clients)) {
            root.recentApps = ""
            return
          }
          clients.sort(function(left, right) {
            return (left.focusHistoryID || 0) - (right.focusHistoryID || 0)
          })
          var names = []
          for (var i = 0; i < clients.length && names.length < 3; i++) {
            var name = root.prettyApp(String(clients[i].class || clients[i].initialClass || "").trim())
            if (name !== "" && names.indexOf(name) < 0) names.push(name)
          }
          root.recentApps = names.join(" · ")
        } catch (error) {
          root.recentApps = ""
        }
      }
    }
  }

  Process {
    id: projectProc
    command: [
      "bash", "-c",
      "d=\"$1\"; top=\"$d\"; " +
      "if git -C \"$d\" rev-parse --show-toplevel >/dev/null 2>&1; then top=\"$(git -C \"$d\" rev-parse --show-toplevel)\"; " +
      "else found=\"$(find \"$d\" -mindepth 2 -maxdepth 4 -name .git -printf '%T@ %h\\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)\"; [ -n \"$found\" ] && top=\"$found\"; fi; " +
      "printf '%s|%s|%s\\n' \"$(basename \"$top\")\" \"$(git -C \"$top\" rev-parse --abbrev-ref HEAD 2>/dev/null)\" \"$(git -C \"$top\" status --porcelain 2>/dev/null | wc -l)\"",
      "_", root.workDir
    ]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var parts = String(text).trim().split("|")
        root.projectName = (parts[0] || "").trim()
        root.gitBranch = (parts[1] || "").trim()
        var dirty = parseInt(parts[2], 10)
        root.gitDirty = isNaN(dirty) ? 0 : dirty
      }
    }
  }

  Process {
    id: startProc
    // Run as a transient user unit so a shell restart does not take the server
    // down. The command is passed as argv, not spliced into a shell string, so
    // a work directory with spaces survives. dsh web is told the panel's port
    // explicitly; without it a non-default `port` setting would start on 3080
    // while the panel probes the configured port.
    command: [
      "systemd-run", "--user", "--collect", "--unit=dsh-web",
      "--setenv=DSH_PERMISSION_MODE=" + root.permissionMode,
      "--", "bash", "-c",
      "PATH=\"$HOME/.local/bin:$HOME/.local/share/mise/shims:$PATH\"; export PATH; " +
      "cd \"$1\" 2>/dev/null || cd \"$HOME\" || exit 1; " +
      "d=$(command -v dsh) || { echo 'dsh not found on PATH; run dsh-omarchy-agent-install' >&2; exit 127; }; " +
      "[ -r \"$HOME/.config/dsh/web.env\" ] && . \"$HOME/.config/dsh/web.env\"; " +
      "exec \"$d\" web --no-open --host 127.0.0.1 --port \"$2\"",
      "_", root.workDir, String(root.port)
    ]
    onExited: function(exitCode) {
      if (exitCode === 0) {
        root.unitActive = true
        root.probe(portProc)
      } else {
        root.pendingOpen = false
        root.lastError = "Could not start dsh web (systemd-run exited " + exitCode + ")"
      }
    }
  }

  Process {
    id: stopProc
    command: ["systemctl", "--user", "stop", "dsh-web"]
    onExited: function(exitCode) {
      root.unitActive = false
      root.probe(portProc)
    }
  }

  Process {
    id: openProc
    command: ["omarchy-launch-or-focus-webapp", "DeepSeek", "http://127.0.0.1:" + root.port]
  }

  Process {
    id: newWebProc
    command: []
  }

  Process {
    id: terminalProc
    command: [
      "omarchy-launch-tui", "--app-id=com.yorelog.dsh-omarchy-agent",
      "bash", "-lc", "dsh --help 2>/dev/null || true; exec bash"
    ]
  }
}
