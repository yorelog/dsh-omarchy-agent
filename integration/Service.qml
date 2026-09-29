import QtQuick
import Quickshell
import Quickshell.Io

// Runs the integration installer once, asynchronously, when this plugin is
// enabled. The heavy work happens outside the shell process; the service only
// checks state and reports the result. Setup is idempotent and guarded by
// ~/.local/state/dsh-omarchy-agent, so a failed or completed run never repeats
// on the next shell start.
Item {
  id: root

  property var shell: null

  readonly property string home: Quickshell.env("HOME")
  readonly property string pluginDir: root.home + "/.config/omarchy/plugins/dsh-omarchy-agent"
  readonly property string script: root.pluginDir + "/scripts/plugin-integrate.sh"
  readonly property string stateDir: root.home + "/.local/state/dsh-omarchy-agent"

  Component.onCompleted: Qt.callLater(root.detect)

  function detect() {
    if (check.running) return
    check.command = ["bash", root.script, "--check"]
    check.running = true
  }

  function install() {
    if (installer.running) return
    installer.command = ["bash", root.script, "--run"]
    installer.running = true
  }

  function notify(exitCode) {
    notifyProcess.command = exitCode === 0
      ? ["omarchy-notification-send", "-u", "normal", "-g", "󰚩", "DeepSeek Harness ready",
         "The Omarchy agent is installed. Launch it with SUPER + SHIFT + CTRL + A or dsh-agent."]
      : ["omarchy-notification-send", "-u", "critical", "-g", "󰚩", "DeepSeek Harness setup failed",
         "See " + root.stateDir + "/install.log, then run " + root.pluginDir + "/install.sh"]
    notifyProcess.running = true
  }

  Process {
    id: check
    onExited: function (exitCode) {
      if (exitCode !== 0) root.install()
    }
  }

  Process {
    id: installer
    onExited: function (exitCode) {
      root.notify(exitCode)
    }
  }

  Process {
    id: notifyProcess
  }
}
