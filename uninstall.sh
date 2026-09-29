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
AGENT_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/omarchy/defaults/agent"
MENU_SCRIPT="$REPO_DIR/scripts/merge-omarchy-menu.py"
LAUNCHER_DEST="$HOME/.local/bin/dsh-agent"
HYPR_BINDINGS="$HOME/.config/hypr/bindings.lua"
BASHRC="$HOME/.bashrc"

DRY_RUN=false
ASSUME_YES=false
WANT_DEFAULT=true
WANT_KEYBIND=true

SH_BEGIN_MARK="# dsh-omarchy-agent: begin"
SH_END_MARK="# dsh-omarchy-agent: end"
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
  cp -p "$file" "$file.bak"
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

  if [[ -e $LAUNCHER_DEST ]]; then
    run rm -f "$LAUNCHER_DEST"
    $DRY_RUN || say "• removed launcher: $LAUNCHER_DEST"
  fi

  if command -v python3 >/dev/null 2>&1; then
    if $DRY_RUN; then
      say "[dry-run] python3 $MENU_SCRIPT --remove"
    else
      python3 "$MENU_SCRIPT" --remove
    fi
  fi

  remove_blocks "$BASHRC" "$SH_BEGIN_MARK" "$SH_END_MARK"
  $WANT_KEYBIND && remove_blocks "$HYPR_BINDINGS" "$LUA_BEGIN_MARK" "$LUA_END_MARK"

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
  say "Done. Profiles and the dsh install were left in place."
}

main
