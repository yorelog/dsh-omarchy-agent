#!/usr/bin/env bash
# Remove the dsh-omarchy-agent bundle and its Omarchy desktop integration.
#
# Reverses install.sh. User configuration under /usr/share/omarchy is never
# touched; only files this project created or marked are removed.
#
# Usage: ./uninstall.sh [options]
set -euo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="${DSH_OMARCHY_PROFILE:-omarchy}"
HEADLESS_PROFILE="${DSH_OMARCHY_HEADLESS_PROFILE:-omarchy-headless}"
TUI_PROFILE="${DSH_OMARCHY_TUI_PROFILE:-tui}"
AGENT_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/omarchy/defaults/agent"
MENU_SCRIPT="$REPO_DIR/scripts/merge-omarchy-menu.py"
LAUNCHER_DEST="$HOME/.local/bin/dsh-agent"
HYPR_BINDINGS="$HOME/.config/hypr/bindings.lua"
BASHRC="$HOME/.bashrc"
SHARE_DIR="$HOME/.local/share/dsh-omarchy-agent"
SHIM_DIR="$SHARE_DIR/bin"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/dsh-omarchy-agent"
MENU_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/omarchy/extensions/omarchy-menu.jsonc"
ENVD_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/environment.d/50-dsh-omarchy-agent.conf"
FISH_CONF="${XDG_CONFIG_HOME:-$HOME/.config}/fish/conf.d/dsh-omarchy-agent.fish"

DRY_RUN=false
ASSUME_YES=false
WANT_DEFAULT=true
WANT_KEYBIND=true

SH_BEGIN_MARK="# dsh-omarchy-agent: begin"
SH_END_MARK="# dsh-omarchy-agent: end"
PATH_BEGIN_MARK="# dsh-omarchy-agent path: begin"
PATH_END_MARK="# dsh-omarchy-agent path: end"
LUA_BEGIN_MARK="-- dsh-omarchy-agent: begin"
LUA_END_MARK="-- dsh-omarchy-agent: end"

say() { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
run() { if $DRY_RUN; then printf '[dry-run] %s\n' "$*"; else "$@"; fi; }

usage() {
  cat <<'EOF'
Usage: ./uninstall.sh [options]

Options:
  -y, --yes          do not prompt (non-interactive)
  -n, --dry-run      print what would change without changing anything
      --no-default   leave the Omarchy default agent unchanged
      --no-keybind   leave the Agent keybinding unchanged
  -h, --help         show this help
EOF
}

while (($#)); do
  case "$1" in
    -y | --yes) ASSUME_YES=true; shift ;;
    -n | --dry-run) DRY_RUN=true; shift ;;
    --no-default) WANT_DEFAULT=false; shift ;;
    --no-keybind) WANT_KEYBIND=false; shift ;;
    -h | --help) usage; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
done

confirm() {
  $ASSUME_YES && return 0
  $DRY_RUN && return 0
  read -r -p "$1 [y/N] " reply
  [[ $reply == [yY] || $reply == [yY][eE][sS] ]]
}

remove_blocks() {
  local file="$1" begin="$2" end="$3"
  [[ -f $file ]] || return 0
  grep -qF -- "$begin" "$file" || return 0
  if $DRY_RUN; then
    printf '[dry-run] remove marked block from %s\n' "$file"
    return 0
  fi
  awk -v b="$begin" -v e="$end" '
    $0 == b { skip = 1; next }
    $0 == e { skip = 0; next }
    !skip { print }
  ' "$file" >"$file.tmp"
  mv "$file.tmp" "$file"
  say "• removed block from $file"
}

remove_profile_bundle() {
  local name="$1"
  [[ -d "$HOME/.dsh/profiles/$name" ]] || return 0
  say "• removing the bundle from profile '$name'"
  run dsh plugin --profile "$name" remove dsh-omarchy-agent || warn "could not update profile '$name'"
}

main() {
  say "dsh-omarchy-agent uninstaller"
  say ""

  remove_profile_bundle "$PROFILE"
  remove_profile_bundle "$HEADLESS_PROFILE"
  remove_profile_bundle "$TUI_PROFILE"

  if [[ -e $LAUNCHER_DEST ]]; then
    run rm -f "$LAUNCHER_DEST"
    $DRY_RUN || say "• removed launcher: $LAUNCHER_DEST"
  fi

  if [[ -d $SHARE_DIR ]]; then
    run rm -rf "$SHARE_DIR"
    $DRY_RUN || say "• removed Omarchy agent shims: $SHARE_DIR"
  fi
  if [[ -d $STATE_DIR ]]; then
    run rm -rf "$STATE_DIR"
    $DRY_RUN || say "• removed state: $STATE_DIR"
  fi
  for file in "$ENVD_FILE" "$FISH_CONF"; do
    if [[ -e $file ]]; then
      run rm -f "$file"
      $DRY_RUN || say "• removed $file"
    fi
  done

  # Drop the shim from the running session's systemd/D-Bus PATH so no stale
  # directory is left behind until the next login.
  if ! $DRY_RUN && command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
    local session_path cleaned
    session_path="$(systemctl --user show-environment | sed -n 's/^PATH=//p')"
    cleaned="$(printf '%s' "$session_path" | tr ':' '\n' | grep -vxF "$SHIM_DIR" | paste -sd: -)"
    systemctl --user set-environment PATH="$cleaned" >/dev/null 2>&1 || true
    if command -v dbus-update-activation-environment >/dev/null 2>&1; then
      PATH="$cleaned" dbus-update-activation-environment --systemd PATH >/dev/null 2>&1 || true
    fi
    say "• removed the shim from the session PATH"
  fi

  if command -v python3 >/dev/null 2>&1; then
    if $DRY_RUN; then
      say "[dry-run] python3 $MENU_SCRIPT --remove"
    else
      python3 "$MENU_SCRIPT" --remove
    fi
  fi

  remove_blocks "$BASHRC" "$SH_BEGIN_MARK" "$SH_END_MARK"
  remove_blocks "$BASHRC" "$PATH_BEGIN_MARK" "$PATH_END_MARK"
  $WANT_KEYBIND && remove_blocks "$HYPR_BINDINGS" "$LUA_BEGIN_MARK" "$LUA_END_MARK"

  # Backups this project wrote while editing user files.
  for backup in "$BASHRC.bak" "$HYPR_BINDINGS.bak" "$MENU_FILE.bak"; do
    if [[ -e $backup ]]; then
      run rm -f "$backup"
      $DRY_RUN || say "• removed $backup"
    fi
  done

  if $WANT_DEFAULT && [[ -r $AGENT_FILE ]] && [[ "$(head -n1 "$AGENT_FILE")" == dsh ]]; then
    if confirm "Reset the Omarchy default agent away from dsh?"; then
      if $DRY_RUN; then
        say "[dry-run] clear the default agent file"
      else
        printf '\n' >"$AGENT_FILE"
        say "• default agent cleared"
      fi
    fi
  fi

  if ! $DRY_RUN && command -v hyprctl >/dev/null 2>&1 && hyprctl version >/dev/null 2>&1; then
    hyprctl reload >/dev/null 2>&1 || true
  fi

  say ""
  say "Done. The dsh profiles, the dsh install, and the Omarchy shell plugin"
  say "directory are left in place; remove the plugin with:"
  say "    omarchy plugin remove dsh-omarchy-agent"
}

main
