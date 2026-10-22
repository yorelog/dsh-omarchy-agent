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

  property string themeName: ""
  property int monitorCount: 0
  property int workspaceCount: 0
  property int failedUnits: 0
  property string defaultAgent: ""
  property string dshVersion: ""
  property int sessionCount: 0
  property var deepseek: null

  property string lastError: ""
  property bool pendingOpen: false
  property bool pendingStart: false
  property int pendingTicks: 0

  onOpenedChanged: {
    if (opened) {
      refresh()
      pendingTicks = 0
    }
  }

  function refresh() {
    probe(statusProc)
    probe(portProc)
    probe(themeProc)
    probe(monitorsProc)
    probe(workspacesProc)
    probe(unitsProc)
    probe(agentProc)
    probe(usageProc)
    probe(cliProc)
    probe(sessionsProc)
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
    if (portOpen) {
      if (!pendingOpen) lastError = "dsh web is already running on port " + port
      return
    }
    // A fresh port probe decides whether the server is really absent. Without
    // it, a click before the first refresh can start a second dsh web on 3080.
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
    contentHeight: panel.fittedContentHeight(column.implicitHeight, Style.space(760))

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
          detail: "profile web"
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
            value: root.serverLabel()
            detail: root.serverDetail()
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "DSH CLI"
            value: root.cliLabel()
          }
        }

        Row {
          width: parent.width
          spacing: Style.space(8)

          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "DEFAULT AGENT"
            value: root.defaultAgent !== "" ? root.defaultAgent : "—"
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "PERMISSION"
            value: root.permissionLabel()
          }
        }

        Row {
          width: parent.width
          spacing: Style.space(8)

          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "WORKDIR"
            value: root.shortWorkDir()
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "SESSIONS"
            value: String(root.sessionCount)
          }
        }

        PanelSectionHeader {
          text: "DEEPSEEK"
          foreground: root.foreground
          fontFamily: root.fontFamily
        }

        Row {
          width: parent.width
          spacing: Style.space(8)

          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "BALANCE"
            value: root.balanceLabel()
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "TODAY"
            value: root.todayLabel()
          }
        }

        Row {
          width: parent.width
          spacing: Style.space(8)

          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "PLAN"
            value: root.planLabel()
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "USAGE STATUS"
            value: root.usageStatus()
          }
        }

        Text {
          visible: root.deepseek === null
          width: parent.width
          text: "DeepSeek usage fills in once Omarchy's agents collector writes a record."
          color: root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          textFormat: Text.PlainText
          wrapMode: Text.WordWrap
        }

        PanelSectionHeader {
          text: "OMARCHY"
          foreground: root.foreground
          fontFamily: root.fontFamily
        }

        Row {
          width: parent.width
          spacing: Style.space(8)

          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "THEME"
            value: root.themeName !== "" ? root.themeName : "—"
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "DISPLAYS"
            value: root.monitorCount > 0 ? String(root.monitorCount) : "—"
          }
        }

        Row {
          width: parent.width
          spacing: Style.space(8)

          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "WORKSPACES"
            value: root.workspaceCount > 0 ? String(root.workspaceCount) : "—"
          }
          StatCard {
            width: (parent.width - parent.spacing) / 2
            label: "FAILED UNITS"
            value: String(root.failedUnits)
          }
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

    implicitHeight: cardColumn.implicitHeight + Style.space(16)
    radius: Style.cornerRadius
    color: Qt.rgba(root.foreground.r, root.foreground.g, root.foreground.b, 0.05)

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
      if (!root.unitActive) root.startProc.running = true
    }
  }

  Process {
    id: themeProc
    command: ["omarchy", "theme", "current"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.themeName = String(text).trim()
    }
  }

  Process {
    id: monitorsProc
    command: ["hyprctl", "monitors", "-j"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        try {
          var list = JSON.parse(String(text))
          root.monitorCount = Array.isArray(list) ? list.length : 0
        } catch (error) {
          root.monitorCount = 0
        }
      }
    }
  }

  Process {
    id: workspacesProc
    command: ["hyprctl", "workspaces", "-j"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        try {
          var list = JSON.parse(String(text))
          root.workspaceCount = Array.isArray(list) ? list.length : 0
        } catch (error) {
          root.workspaceCount = 0
        }
      }
    }
  }

  Process {
    id: unitsProc
    command: ["bash", "-c", "systemctl --user --failed --no-legend 2>/dev/null | wc -l"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var count = parseInt(String(text).trim(), 10)
        root.failedUnits = isNaN(count) ? 0 : count
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
    id: startProc
    command: [
      "systemd-run", "--user", "--collect", "--unit=dsh-web",
      "--working-directory=" + root.workDir,
      "--setenv=DSH_PERMISSION_MODE=" + root.permissionMode,
      "--", "bash", "-c",
      "d=$(command -v dsh || echo \"$HOME/.local/share/mise/shims/dsh\"); [ -r \"$HOME/.config/dsh/web.env\" ] && . \"$HOME/.config/dsh/web.env\"; exec \"$d\" web --no-open"
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
    id: terminalProc
    command: [
      "omarchy-launch-tui", "--app-id=org.omarchy.agent",
      "bash", "-lc", "dsh --help 2>/dev/null || true; exec bash"
    ]
  }
}
