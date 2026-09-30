#!/usr/bin/env bash
# Integration hook used by the Omarchy shell plugin service (integration/Service.qml).
#
#   --check   exit 0 when the current plugin version is already integrated or
#             already attempted, exit 1 when the installer should run
#   --run     run install.sh; a failure of the same version never loops, while
#             a new plugin version re-runs the installer once
#
# All output goes to ~/.local/state/dsh-omarchy-agent/install.log.
set -uo pipefail

PLUGIN_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/dsh-omarchy-agent"
LOG="$STATE_DIR/install.log"
INTEGRATED="$STATE_DIR/integrated"
ATTEMPTED="$STATE_DIR/attempted"
VERSION_STAMP="$STATE_DIR/version"
PROFILE="${DSH_OMARCHY_PROFILE:-omarchy}"
PROFILE_MANIFEST="$HOME/.dsh/profiles/$PROFILE/package.json"
SHIM_DIR="$HOME/.local/share/dsh-omarchy-agent/bin"
LAUNCHER_DEST="$HOME/.local/bin/dsh-agent"

plugin_version() {
  local version=""
  if [[ -f $PLUGIN_DIR/manifest.json ]]; then
    version="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PLUGIN_DIR/manifest.json" | head -n1)"
  fi
  if [[ -z $version && -f $PLUGIN_DIR/package.json ]]; then
    version="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PLUGIN_DIR/package.json" | head -n1)"
  fi
  printf '%s\n' "$version"
}

is_integrated() {
  # A complete install leaves observable artifacts. Check them rather than
  # trusting only the profile manifest: a profile that survives after mise
  # prunes dsh, or a launcher that was deleted, must still count as needing
  # the installer. (The profile manifest check is a fast path for installs
  # that predate the launcher/version-stamp markers.)
  [[ -x $LAUNCHER_DEST ]] || return 1
  command -v dsh >/dev/null 2>&1 || return 1
  [[ -f $SHIM_DIR/omarchy ]] || return 1
  [[ -f $INTEGRATED ]] && return 0
  [[ -f $PROFILE_MANIFEST ]] && grep -q '"dsh-omarchy-agent"' "$PROFILE_MANIFEST" && return 0
  return 1
}

# Whether the running plugin version has already been processed, successfully
# or not. A version bump makes this false so the installer runs again.
is_current() {
  local current
  current="$(plugin_version)"
  [[ -n $current && -f $VERSION_STAMP && "$(cat "$VERSION_STAMP" 2>/dev/null)" == "$current" ]]
}

stamp_version() {
  local version
  version="$(plugin_version)"
  [[ -n $version ]] || return 0
  printf '%s\n' "$version" >"$VERSION_STAMP"
}

mkdir -p "$STATE_DIR"

mode="${1:---run}"
case "$mode" in
  --check)
    if is_current && (is_integrated || [[ -f $ATTEMPTED ]]); then exit 0; fi
    exit 1
    ;;
  --run)
    if is_current && (is_integrated || [[ -f $ATTEMPTED ]]); then exit 0; fi

    install_args=(--yes)
    # A re-run for an already-integrated profile must not re-assert one-time
    # preferences (default agent, alias, keybinding, menu); it only applies
    # setup changes such as a dsh upgrade.
    if is_integrated; then
      install_args+=(--no-default --no-alias --no-keybind --no-menu)
    fi

    : >"$ATTEMPTED"
    {
      echo "=== $(date -Is) dsh-omarchy-agent plugin setup ==="
      bash "$PLUGIN_DIR/install.sh" "${install_args[@]}"
    } >>"$LOG" 2>&1
    status=$?
    stamp_version
    if [[ $status -eq 0 ]]; then
      touch "$INTEGRATED"
      # Success clears the attempt marker so a later incomplete state (for
      # example dsh pruned by mise) re-runs the installer; a failed run keeps
      # the marker and the version stamp, which stops it from looping.
      rm -f "$ATTEMPTED"
    fi
    exit $status
    ;;
  *)
    echo "usage: plugin-integrate.sh --check | --run" >&2
    exit 2
    ;;
esac
