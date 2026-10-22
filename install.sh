#!/usr/bin/env bash
# Install the Omarchy capability bundle into a DeepSeek Harness profile.
#
# Omarchy owns installing, launching (`dsh web`), and selecting dsh as the
# default agent. This script only adds the bundle to the profile that launcher
# runs, so nothing under /usr/share/omarchy or ~/.config is edited here.
#
# Usage: ./install.sh [options]
set -euo pipefail

REPO_DIR="$(cd -- "$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")" && pwd)"
BUNDLE="dsh-omarchy-agent"
PROFILE="${DSH_OMARCHY_PROFILE:-web}"
HEADLESS_PROFILE="${DSH_OMARCHY_HEADLESS_PROFILE:-headless}"

DRY_RUN=false
ASSUME_YES=false
WANT_HEADLESS=false
WANT_INSTALL_DSH=true
PIN_VERSION=""

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

Adds dsh-omarchy-agent to a dsh profile. Omarchy's native dsh launcher runs the
`web` profile, which is the default target.

Options:
  -y, --yes               do not prompt (non-interactive)
  -n, --dry-run           print what would change without changing anything
      --profile <name>    profile to install into (default: web)
      --version <version>  pin the bundle to this npm version (default: latest)
      --headless          also install into the one-shot `headless` profile
      --no-install-dsh    fail instead of installing dsh when it is missing
  -h, --help              show this help

Environment:
  DSH_OMARCHY_PROFILE           profile to install into (default: web)
  DSH_OMARCHY_HEADLESS_PROFILE  one-shot profile name (default: headless)
EOF
}

while (($#)); do
  case "$1" in
    -y | --yes) ASSUME_YES=true; shift ;;
    -n | --dry-run) DRY_RUN=true; shift ;;
    --profile) PROFILE=${2:?--profile needs a value}; shift 2 ;;
    --version | --pin) PIN_VERSION=${2:?--version needs a value}; shift 2 ;;
    --headless) WANT_HEADLESS=true; shift ;;
    --no-install-dsh) WANT_INSTALL_DSH=false; shift ;;
    -h | --help) usage; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
done

if [[ -n $PIN_VERSION && ! $PIN_VERSION =~ ^[0-9A-Za-z._+-]+$ ]]; then
  die "invalid version: $PIN_VERSION"
fi

# A Quickshell service or a systemd-launched shell may not inherit mise's shim
# directory, so put the two places a dsh install lands on PATH first.
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

ensure_dsh() {
  prepend_tool_paths
  if command -v dsh >/dev/null 2>&1; then
    say "• dsh found: $(command -v dsh)"
    return 0
  fi

  $WANT_INSTALL_DSH || die "dsh is not on PATH. Install it first (Omarchy: 'omarchy default agent dsh'; otherwise 'mise use -g npm:@deepseek-ai/dsh@latest') and re-run."
  command -v mise >/dev/null 2>&1 || die "dsh is not on PATH and mise is not installed. Install dsh first (Omarchy: 'omarchy default agent dsh')."

  say "• installing dsh with mise"
  # When Omarchy declares the tool, `mise install` keeps the user's mise config
  # untouched. Otherwise this is a standalone install and the user config is the
  # only place mise can record it.
  if command -v omarchy-mise-default-tools >/dev/null 2>&1 &&
    omarchy-mise-default-tools declares npm:@deepseek-ai/dsh; then
    run mise install node npm:@deepseek-ai/dsh
  else
    run env MISE_PRERELEASES=true MISE_MINIMUM_RELEASE_AGE=0 mise use -g npm:@deepseek-ai/dsh@latest
  fi
  run mise reshim || true
  if $DRY_RUN; then return 0; fi
  prepend_tool_paths
  command -v dsh >/dev/null 2>&1 || die "dsh is still not on PATH after installing; open a new shell and re-run."
}

ensure_pnpm() {
  prepend_tool_paths
  if command -v pnpm >/dev/null 2>&1; then
    say "• pnpm found: $(pnpm --version)"
    return 0
  fi
  command -v mise >/dev/null 2>&1 || die "pnpm is not on PATH and mise is not installed. dsh's plugin manager needs pnpm."
  say "• installing pnpm with mise (dsh's plugin manager needs it)"
  run mise use -g pnpm@latest
  run mise reshim || true
  prepend_tool_paths
}

# A checkout tracks local edits; an npm-installed copy is added by name so the
# profile owns its own copy and a package-manager prune cannot break the link.
# A checkout tracks local edits; an npm-installed copy uses the package name
# unless --version pins a release.
bundle_spec() {
  if [[ -n $PIN_VERSION ]]; then
    printf '%s@%s\n' "$BUNDLE" "$PIN_VERSION"
    return
  fi
  if [[ -d "$REPO_DIR/.git" ]]; then
    printf '%s\n' "$REPO_DIR"
  else
    printf '%s\n' "$BUNDLE"
  fi
}

install_bundle() {
  local profile="$1" spec
  spec="$(bundle_spec)"
  if [[ -d "$HOME/.dsh/profiles/$profile" ]]; then
    say "• profile '$profile' exists"
  else
    say "• dsh will initialize profile '$profile' from its shipped template"
  fi
  say "• adding $spec to profile '$profile'"
  run dsh plugin --profile "$profile" add "$spec"
}

# The packaged omarchy-default-agent grows a dsh case when Omarchy's native
# support lands; until then its usage line is the reliable signal.
supports_dsh_default_agent() {
  local bin
  bin="$(command -v omarchy-default-agent 2>/dev/null)" || return 1
  grep -qw dsh "$bin" 2>/dev/null
}

main() {
  say "dsh-omarchy-agent installer"
  say "repository: $REPO_DIR"
  say ""

  ensure_dsh
  ensure_pnpm
  install_bundle "$PROFILE"
  $WANT_HEADLESS && install_bundle "$HEADLESS_PROFILE"

  say ""
  say "Done. Launch DeepSeek Harness with: dsh web"
  if supports_dsh_default_agent; then
    say "Select it as the default agent:  omarchy default agent dsh"
  else
    say "This Omarchy does not list dsh yet (#14455/#14040); once it does:"
    say "    omarchy default agent dsh"
  fi
}

main
