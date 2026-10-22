#!/usr/bin/env bash
# Remove the dsh-omarchy-agent bundle and any artifacts older versions created.
#
# The bundle is the whole integration now: Omarchy owns the dsh launcher, the
# default-agent entry, and the agents panel. This script removes the bundle from
# the profiles it was installed into, then cleans up the shims, launcher, and
# shell/editor blocks that earlier versions of this project wrote.
#
# Usage: ./uninstall.sh [options]
set -euo pipefail

BUNDLE="dsh-omarchy-agent"
PROFILES=(
  "${DSH_OMARCHY_PROFILE:-web}"
  "${DSH_OMARCHY_HEADLESS_PROFILE:-headless}"
  omarchy
  omarchy-headless
  tui
)

CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
AGENT_FILE="$CONFIG_HOME/omarchy/defaults/agent"
MENU_FILE="$CONFIG_HOME/omarchy/extensions/omarchy-menu.jsonc"
ENVD_FILE="$CONFIG_HOME/environment.d/50-dsh-omarchy-agent.conf"
FISH_CONF="$CONFIG_HOME/fish/conf.d/dsh-omarchy-agent.fish"
LAUNCHER_DEST="$HOME/.local/bin/dsh-agent"
SHIM_DIR="$HOME/.local/share/dsh-omarchy-agent/bin"
SHARE_DIR="$HOME/.local/share/dsh-omarchy-agent"
STATE_DIR="$STATE_HOME/dsh-omarchy-agent"
HYPR_BINDINGS="$HOME/.config/hypr/bindings.lua"
BASHRC="$HOME/.bashrc"

SH_BEGIN_MARK="# dsh-omarchy-agent: begin"
SH_END_MARK="# dsh-omarchy-agent: end"
PATH_BEGIN_MARK="# dsh-omarchy-agent path: begin"
PATH_END_MARK="# dsh-omarchy-agent path: end"
LUA_BEGIN_MARK="-- dsh-omarchy-agent: begin"
LUA_END_MARK="-- dsh-omarchy-agent: end"

DRY_RUN=false
ASSUME_YES=false
WANT_DSH=false

say() { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
run() {
  if $DRY_RUN; then
    printf '[dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

usage() {
  cat <<'EOF'
Usage: ./uninstall.sh [options]

Removes dsh-omarchy-agent from the dsh profiles and deletes artifacts written by
older versions of this project (shims, launcher, shell and Hyprland blocks).

Options:
  -y, --yes        do not prompt (non-interactive)
  -n, --dry-run    print what would change without changing anything
      --remove-dsh remove the mise-installed dsh tool too (Omarchy owns it now)
  -h, --help       show this help
EOF
}

while (($#)); do
  case "$1" in
    -y | --yes) ASSUME_YES=true; shift ;;
    -n | --dry-run) DRY_RUN=true; shift ;;
    --remove-dsh) WANT_DSH=true; shift ;;
    -h | --help) usage; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
done

prepend_tool_paths() {
  local dir
  for dir in "$HOME/.local/bin" "$HOME/.local/share/mise/shims"; do
    [[ -d $dir ]] || continue
    case ":$PATH:" in
    *":$dir:"*) ;;
    *) PATH="$dir:$PATH" ;;
    esac
  done
  export PATH
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

remove_bundle() {
  local name="$1"
  [[ -d "$HOME/.dsh/profiles/$name" ]] || return 0
  prepend_tool_paths
  command -v dsh >/dev/null 2>&1 || {
    warn "dsh is not on PATH; leaving profile '$name' unchanged"
    return 0
  }
  say "• removing $BUNDLE from profile '$name'"
  run dsh plugin --profile "$name" remove "$BUNDLE" || warn "could not update profile '$name'"
}

remove_our_backup() {
  local file="$1"
  [[ -f $file ]] || return 0
  grep -qE 'dsh-omarchy-agent|setup\.default\.agent\.dsh' "$file" 2>/dev/null || return 0
  run rm -f "$file"
  $DRY_RUN || say "• removed $file"
}

legacy_cleanup() {
  local file

  for file in "$LAUNCHER_DEST" "$ENVD_FILE" "$FISH_CONF"; do
    if [[ -e $file ]]; then
      run rm -f "$file"
      $DRY_RUN || say "• removed $file"
    fi
  done
  for dir in "$SHARE_DIR" "$STATE_DIR"; do
    if [[ -d $dir ]]; then
      run rm -rf "$dir"
      $DRY_RUN || say "• removed $dir"
    fi
  done

  # The old installer merged a single row into the user's menu extension.
  if [[ -f $MENU_FILE ]] && grep -q 'setup\.default\.agent\.dsh' "$MENU_FILE"; then
    if $DRY_RUN; then
      printf '[dry-run] remove the dsh row from %s\n' "$MENU_FILE"
    else
      sed -i '/setup\.default\.agent\.dsh/d' "$MENU_FILE"
      say "• removed the dsh row from $MENU_FILE"
    fi
  fi

  remove_blocks "$BASHRC" "$SH_BEGIN_MARK" "$SH_END_MARK"
  remove_blocks "$BASHRC" "$PATH_BEGIN_MARK" "$PATH_END_MARK"
  remove_blocks "$HYPR_BINDINGS" "$LUA_BEGIN_MARK" "$LUA_END_MARK"

  remove_our_backup "$BASHRC.bak"
  remove_our_backup "$HYPR_BINDINGS.bak"
  remove_our_backup "$MENU_FILE.bak"

  # Drop the old shim directory from the running session's PATH.
  if ! $DRY_RUN && command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
    local session_path cleaned
    session_path="$(systemctl --user show-environment | sed -n 's/^PATH=//p')"
    cleaned="$(printf '%s' "$session_path" | tr ':' '\n' | grep -vxF "$SHIM_DIR" | paste -sd: -)"
    systemctl --user set-environment PATH="$cleaned" >/dev/null 2>&1 || true
    if command -v dbus-update-activation-environment >/dev/null 2>&1; then
      PATH="$cleaned" dbus-update-activation-environment --systemd PATH >/dev/null 2>&1 || true
    fi
  fi

  if [[ -f $HYPR_BINDINGS ]] && command -v hyprctl >/dev/null 2>&1 && hyprctl version >/dev/null 2>&1; then
    $DRY_RUN || hyprctl reload >/dev/null 2>&1 || true
  fi
}

remove_dsh() {
  $WANT_DSH || return 0
  command -v mise >/dev/null 2>&1 || {
    warn "mise not found; leaving dsh in place"
    return 0
  }
  if ! mise ls 2>/dev/null | grep -qE '^npm:@deepseek-ai/dsh[[:space:]]'; then
    say "• dsh is not managed by mise; leaving it in place"
    return 0
  fi
  warn "Omarchy declares dsh as a lazy tool; removing it makes the next launch reinstall it."
  run mise unuse -g npm:@deepseek-ai/dsh || true
  run mise uninstall npm:@deepseek-ai/dsh || true
  run mise reshim || true
}

main() {
  say "dsh-omarchy-agent uninstaller"
  say ""

  for profile in "${PROFILES[@]}"; do
    remove_bundle "$profile"
  done
  legacy_cleanup
  remove_dsh

  # The default-agent file is Omarchy's. Leave it alone and point at its own
  # command, so switching agents stays a single documented step.
  if [[ -r $AGENT_FILE ]] && [[ "$(head -n1 "$AGENT_FILE")" == dsh ]]; then
    say ""
    say "dsh is still the Omarchy default agent. Switch with: omarchy default agent <name>"
  fi

  say ""
  say "Done. If this was installed as an Omarchy plugin, remove the plugin too:"
  say "    omarchy plugin remove dsh-omarchy-agent"
}

main
