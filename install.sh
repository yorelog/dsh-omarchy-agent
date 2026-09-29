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
TUI_PROFILE="${DSH_OMARCHY_TUI_PROFILE:-tui}"
TUI_PACKAGE="${DSH_OMARCHY_TUI_PACKAGE:-github:deepseek-harness/turtle-ui}"
AGENT_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/omarchy/defaults/agent"
MENU_SCRIPT="$REPO_DIR/scripts/merge-omarchy-menu.py"
LAUNCHER_DEST="$HOME/.local/bin/dsh-agent"
HYPR_BINDINGS="$HOME/.config/hypr/bindings.lua"
BASHRC="$HOME/.bashrc"
SHIM_DIR="$HOME/.local/share/dsh-omarchy-agent/bin"
ENVD_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/environment.d/50-dsh-omarchy-agent.conf"
FISH_CONF="${XDG_CONFIG_HOME:-$HOME/.config}/fish/conf.d/dsh-omarchy-agent.fish"

DRY_RUN=false
ASSUME_YES=false
WANT_DEFAULT=true
WANT_MENU=true
WANT_ALIAS=true
WANT_KEYBIND=true
WANT_HEADLESS=true
WANT_TUI=true
WANT_SHIM=true

SH_BEGIN_MARK="# dsh-omarchy-agent: begin"
SH_END_MARK="# dsh-omarchy-agent: end"
PATH_BEGIN_MARK="# dsh-omarchy-agent path: begin"
PATH_END_MARK="# dsh-omarchy-agent path: end"
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
      --no-tui           skip the TUI profile (falls back to the web profile)
      --no-shim          skip the `omarchy agent` / default-agent shims
  -h, --help             show this help

Environment:
  DSH_OMARCHY_TUI_PROFILE        TUI profile launched interactively (default: tui)
  DSH_OMARCHY_TUI_PACKAGE        TUI bundle to install (default: github:deepseek-harness/turtle-ui)
  DSH_OMARCHY_PROFILE            web profile fallback (default: omarchy)
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
    --no-tui) WANT_TUI=false; shift ;;
    --no-shim) WANT_SHIM=false; shift ;;
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

# The TUI profile is base-backed: dsh ships no tui template, so dsh plugin
# initializes it, installs the TUI app bundle, then this bundle. The Omarchy
# tools, guard, conventions, and preset are global rows, so the TUI inherits
# them the same way the web profile does. A TUI bundle the machine cannot reach
# (for example a private git spec) is reported and skipped rather than aborting
# the rest of the install; dsh-agent then falls back to the web profile.
ensure_tui_profile() {
  $WANT_TUI || return 0
  if [[ -d "$HOME/.dsh/profiles/$TUI_PROFILE" ]]; then
    # An existing profile already has whatever TUI app the user chose; only
    # make sure this bundle is in it.
    say "• profile '$TUI_PROFILE' exists"
  else
    if [[ -z $TUI_PACKAGE ]]; then
      warn "no TUI bundle configured; skipping the '$TUI_PROFILE' profile"
      return 0
    fi
    say "• creating profile '$TUI_PROFILE' with TUI bundle '$TUI_PACKAGE'"
    if ! run dsh plugin --profile "$TUI_PROFILE" add "$TUI_PACKAGE"; then
      warn "could not install '$TUI_PACKAGE'; the TUI profile was not created"
      warn "set DSH_OMARCHY_TUI_PACKAGE to a reachable TUI bundle and re-run"
      return 0
    fi
  fi
  say "• installing the bundle into profile '$TUI_PROFILE'"
  run dsh plugin --profile "$TUI_PROFILE" add "$REPO_DIR"
}

install_launcher() {
  run mkdir -p "$HOME/.local/bin"
  run install -m 0755 "$REPO_DIR/assets/dsh-agent" "$LAUNCHER_DEST"
  say "• installed launcher: $LAUNCHER_DEST"
}

# Omarchy hardcodes its agent list, and the `omarchy` router resolves
# subcommands from its own directory rather than PATH. These shims sit earlier
# on PATH so `omarchy agent`, `omarchy default agent dsh`, and direct
# omarchy-agent calls reach dsh, while every other invocation is delegated to
# the packaged commands unchanged.
install_shims() {
  $WANT_SHIM || return 0
  run mkdir -p "$SHIM_DIR"
  local name
  for name in omarchy omarchy-agent omarchy-default-agent; do
    run install -m 0755 "$REPO_DIR/assets/omarchy-shim/$name" "$SHIM_DIR/$name"
  done
  say "• installed Omarchy agent shims: $SHIM_DIR"

  # Session PATH (Hyprland, the shell, menus): environment.d is read at login,
  # so the shim outranks the packaged /usr/share/omarchy/bin entry.
  if $DRY_RUN; then
    printf '[dry-run] write %s\n' "$ENVD_FILE"
    printf '[dry-run] write %s\n' "$FISH_CONF"
  else
    mkdir -p "$(dirname "$ENVD_FILE")"
    {
      printf '# dsh-omarchy-agent: put the Omarchy agent shim ahead of the packaged commands.\n'
      printf 'PATH=%s:$PATH\n' "$SHIM_DIR"
    } >"$ENVD_FILE"
    mkdir -p "$(dirname "$FISH_CONF")"
    {
      printf '# dsh-omarchy-agent: put the Omarchy agent shim ahead of the packaged commands.\n'
      printf 'if test -d "%s"\n' "$SHIM_DIR"
      printf '    set -gx PATH "%s" $PATH\n' "$SHIM_DIR"
      printf 'end\n'
    } >"$FISH_CONF"
  fi

  if [[ -f $BASHRC ]]; then
    if has_marker "$BASHRC" "$PATH_BEGIN_MARK"; then
      say "• bash PATH already set"
    elif $DRY_RUN; then
      printf '[dry-run] prepend the shim dir to PATH in %s\n' "$BASHRC"
    else
      cp -p "$BASHRC" "$BASHRC.bak"
      {
        printf '\n%s\n' "$PATH_BEGIN_MARK"
        printf 'if [ -d "%s" ]; then PATH="%s:$PATH"; export PATH; fi\n' "$SHIM_DIR" "$SHIM_DIR"
        printf '%s\n' "$PATH_END_MARK"
      } >>"$BASHRC"
      say "• added shim PATH block to $BASHRC"
    fi
  fi

  # Best effort for the running session: push the shim into the systemd user
  # environment and the D-Bus activation environment so new processes do not
  # wait for the next login. Running shells still pick it up from their rc.
  if ! $DRY_RUN && command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
    local session_path
    session_path="$(systemctl --user show-environment | sed -n 's/^PATH=//p')"
    case ":$session_path:" in
    *":$SHIM_DIR:"*) ;;
    *) systemctl --user set-environment PATH="$SHIM_DIR:${session_path:-$PATH}" >/dev/null 2>&1 || true ;;
    esac
  fi
  if ! $DRY_RUN && command -v dbus-update-activation-environment >/dev/null 2>&1; then
    PATH="$SHIM_DIR:$PATH" dbus-update-activation-environment --systemd PATH >/dev/null 2>&1 || true
  fi
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
  ensure_tui_profile
  install_launcher
  install_shims
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
  say "Launch: $LAUNCHER_DEST   (or SUPER + SHIFT + CTRL + A, or 'omarchy agent') — opens the dsh TUI"
  say "Web UI: dsh-agent --web   (or 'dsh web')"
  say ""
  say "If 'omarchy agent' still prints 'Unsupported default agent: dsh', that shell"
  say "predates the shim: open a new terminal or run 'exec fish' once."
}

main
