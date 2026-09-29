#!/usr/bin/env bash
# Install the dsh-omarchy-agent bundle and its Omarchy desktop integration.
#
# One command sets up:
#   1. the DeepSeek Harness `omarchy` profile (web) with this bundle,
#   2. an `omarchy-headless` profile for one-shot prompts,
#   3. the `dsh-agent` launcher in ~/.local/bin,
#   4. a DeepSeek Harness row in the Omarchy agent picker,
#   5. the Agent keybinding and the `a` shell alias (unless disabled).
#
# Everything is idempotent and stays under $HOME; /usr/share/omarchy is never
# modified.
#
# Usage: ./install.sh [options]
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
WANT_MENU=true
WANT_ALIAS=true
WANT_KEYBIND=true
WANT_HEADLESS=true

SH_BEGIN_MARK="# dsh-omarchy-agent: begin"
SH_END_MARK="# dsh-omarchy-agent: end"
LUA_BEGIN_MARK="-- dsh-omarchy-agent: begin"
LUA_END_MARK="-- dsh-omarchy-agent: end"

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
Usage: ./install.sh [options]

Options:
  -y, --yes              do not prompt (non-interactive)
  -n, --dry-run          print what would change without changing anything
      --no-default       do not set dsh as the Omarchy default agent
      --no-menu          skip the Omarchy menu row
      --no-alias         skip the `a` shell alias override
      --no-keybind       skip the Agent keybinding override
      --no-headless      skip the one-shot omarchy-headless profile
  -h, --help             show this help

Environment:
  DSH_OMARCHY_PROFILE            interactive profile name (default: omarchy)
  DSH_OMARCHY_HEADLESS_PROFILE   one-shot profile name (default: omarchy-headless)
EOF
}

while (($#)); do
  case "$1" in
    -y | --yes) ASSUME_YES=true; shift ;;
    -n | --dry-run) DRY_RUN=true; shift ;;
    --no-default) WANT_DEFAULT=false; shift ;;
    --no-menu) WANT_MENU=false; shift ;;
    --no-alias) WANT_ALIAS=false; shift ;;
    --no-keybind) WANT_KEYBIND=false; shift ;;
    --no-headless) WANT_HEADLESS=false; shift ;;
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

has_marker() {
  [[ -f $1 ]] && grep -qF -- "$2" "$1"
}

install_dsh() {
  if command -v dsh >/dev/null 2>&1; then
    say "• dsh found: $(dsh --version 2>/dev/null | head -n1)"
    return 0
  fi
  if command -v mise >/dev/null 2>&1; then
    say "• installing dsh with mise"
    run mise use -g npm:@deepseek-ai/dsh@latest
    run mise reshim || true
  else
    die "dsh is not on PATH and mise is not installed. Install one of them first."
  fi
}

install_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    say "• pnpm found: $(pnpm --version)"
    return 0
  fi
  if command -v mise >/dev/null 2>&1; then
    say "• installing pnpm with mise (dsh's plugin manager needs it)"
    run mise use -g pnpm@latest
    run mise reshim || true
  else
    die "pnpm is not on PATH and mise is not installed. dsh's plugin manager needs pnpm."
  fi
}

ensure_built() {
  [[ -f "$REPO_DIR/lib/index.js" ]] && return 0
  command -v npm >/dev/null 2>&1 || die "lib/index.js is missing and npm is unavailable to build it"
  say "• building the bundle (lib/ is missing)"
  run bash -c "cd \"$REPO_DIR\" && npm install --no-audit --no-fund && npm run build"
}

ensure_profile() {
  local name="$1" template="$2"
  if [[ -d "$HOME/.dsh/profiles/$name" ]]; then
    say "• profile '$name' exists"
  else
    say "• creating profile '$name' from the '$template' template"
    run dsh --profile "$name" --from-default-profile "$template" --dump-config
  fi
  say "• installing the bundle into profile '$name'"
  run dsh plugin --profile "$name" add "$REPO_DIR"
}

install_launcher() {
  run mkdir -p "$HOME/.local/bin"
  run install -m 0755 "$REPO_DIR/assets/dsh-agent" "$LAUNCHER_DEST"
  say "• installed launcher: $LAUNCHER_DEST"
}

install_menu() {
  $WANT_MENU || return 0
  command -v python3 >/dev/null 2>&1 || { warn "python3 not found; skipping menu row"; return 0; }
  if $DRY_RUN; then
    say "[dry-run] python3 $MENU_SCRIPT"
  else
    python3 "$MENU_SCRIPT"
  fi
}

set_default_agent() {
  $WANT_DEFAULT || return 0
  if $DRY_RUN; then
    printf '[dry-run] set %s to dsh\n' "$AGENT_FILE"
    return 0
  fi
  mkdir -p "$(dirname "$AGENT_FILE")"
  printf 'dsh\n' >"$AGENT_FILE"
  say "• default agent set to dsh"
}

install_alias() {
  $WANT_ALIAS || return 0
  if [[ ! -f $BASHRC ]]; then
    warn "$BASHRC not found; skipping alias"
    return 0
  fi
  if has_marker "$BASHRC" "$SH_BEGIN_MARK" || grep -qF -- "alias a='dsh-agent" "$BASHRC"; then
    say "• shell alias already present"
    return 0
  fi
  say "• adding 'a' alias to $BASHRC (stock alias routes to a launcher that rejects dsh)"
  if $DRY_RUN; then
    printf '[dry-run] append dsh alias to %s\n' "$BASHRC"
  else
    {
      printf '\n%s\n' "$SH_BEGIN_MARK"
      printf "alias a='dsh-agent --inline'\n"
      printf '%s\n' "$SH_END_MARK"
    } >>"$BASHRC"
  fi
}

install_keybind() {
  $WANT_KEYBIND || return 0
  if [[ ! -f $HYPR_BINDINGS ]]; then
    warn "$HYPR_BINDINGS not found; skipping keybinding"
    return 0
  fi
  if has_marker "$HYPR_BINDINGS" "$LUA_BEGIN_MARK" || grep -qF -- 'o.bind("SUPER + SHIFT + CTRL + A", "Agent", "dsh-agent")' "$HYPR_BINDINGS"; then
    say "• keybinding already present"
  else
    say "• overriding SUPER + SHIFT + CTRL + A (was: omarchy-agent --pick)"
    if $DRY_RUN; then
      printf '[dry-run] append keybinding to %s\n' "$HYPR_BINDINGS"
    else
      {
        printf '\n%s\n' "$LUA_BEGIN_MARK"
        printf 'hl.unbind("SUPER + SHIFT + CTRL + A")\n'
        printf 'o.bind("SUPER + SHIFT + CTRL + A", "Agent", "dsh-agent")\n'
        printf '%s\n' "$LUA_END_MARK"
      } >>"$HYPR_BINDINGS"
    fi
  fi
  if command -v hyprctl >/dev/null 2>&1 && hyprctl version >/dev/null 2>&1; then
    if ! $DRY_RUN; then
      hyprctl reload >/dev/null 2>&1 || true
      local errors
      errors="$(hyprctl configerrors 2>/dev/null || true)"
      if [[ -n $errors ]]; then
        warn "Hyprland reported config errors:"
        printf '%s\n' "$errors" >&2
      else
        say "• Hyprland config reloaded cleanly"
      fi
    fi
  fi
}

main() {
  say "dsh-omarchy-agent installer"
  say "repository: $REPO_DIR"
  say ""

  if [[ ! -d /usr/share/omarchy ]]; then
    warn "this does not look like an Omarchy system; the bundle will still install."
  fi

  install_dsh
  install_pnpm
  ensure_built
  ensure_profile "$PROFILE" web
  if $WANT_HEADLESS; then
    ensure_profile "$HEADLESS_PROFILE" headless
  fi
  install_launcher
  install_menu
  set_default_agent
  install_alias
  install_keybind

  say ""
  say "Done."
  if [[ -z ${DEEPSEEK_API_KEY:-} ]]; then
    warn "DEEPSEEK_API_KEY is not set. Configure it before the agent can answer:"
    say "    export DEEPSEEK_API_KEY=...      # or use the dsh Models page"
  fi
  say "Launch: $LAUNCHER_DEST   (or SUPER + SHIFT + CTRL + A, or 'omarchy menu summon setup.default.agent')"
}

main
