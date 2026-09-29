#!/usr/bin/env bash
# Integration hook used by the Omarchy shell plugin service (integration/Service.qml).
#
#   --check   exit 0 when nothing is left to do (already integrated or already
#             attempted), exit 1 when the installer should run
#   --run     run install.sh once, guarded so a failure never loops
#
# All output goes to ~/.local/state/dsh-omarchy-agent/install.log.
set -uo pipefail

PLUGIN_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/dsh-omarchy-agent"
LOG="$STATE_DIR/install.log"
INTEGRATED="$STATE_DIR/integrated"
ATTEMPTED="$STATE_DIR/attempted"
PROFILE="${DSH_OMARCHY_PROFILE:-omarchy}"
PROFILE_MANIFEST="$HOME/.dsh/profiles/$PROFILE/package.json"
SHIM_DIR="$HOME/.local/share/dsh-omarchy-agent/bin"

is_integrated() {
  # The shims are part of the integration, so an older install that predates
  # them is treated as unfinished and run once to add them.
  [[ -f $SHIM_DIR/omarchy ]] || return 1
  [[ -f $INTEGRATED ]] && return 0
  [[ -f $PROFILE_MANIFEST ]] && grep -q '"dsh-omarchy-agent"' "$PROFILE_MANIFEST" && return 0
  return 1
}

mkdir -p "$STATE_DIR"

mode="${1:---run}"
case "$mode" in
  --check)
    if is_integrated || [[ -f $ATTEMPTED ]]; then exit 0; fi
    exit 1
    ;;
  --run)
    if is_integrated; then exit 0; fi
    if [[ -f $ATTEMPTED ]]; then exit 0; fi
    : >"$ATTEMPTED"
    {
      echo "=== $(date -Is) dsh-omarchy-agent plugin setup ==="
      bash "$PLUGIN_DIR/install.sh" --yes
    } >>"$LOG" 2>&1
    status=$?
    if [[ $status -eq 0 ]]; then
      touch "$INTEGRATED"
    fi
    exit $status
    ;;
  *)
    echo "usage: plugin-integrate.sh --check | --run" >&2
    exit 2
    ;;
esac
