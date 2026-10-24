#!/usr/bin/env bash
# Install the Omarchy capability bundle into a DeepSeek Harness profile.
#
# Omarchy owns installing, launching (`dsh web`), and selecting dsh as the
# default agent. This script only adds the bundle to the profile that launcher
# runs; nothing under /usr/share/omarchy is edited here.
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
WANT_DSH_INSTALL=true
PIN_VERSION=""
DSH_VERSION="${DSH_OMARCHY_DSH_VERSION:-}"

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
`web` profile, which is the default target. If dsh is missing, the installer
looks up the newest published version (pre-releases included) and offers to
install it with mise; -y accepts that offer. Omarchy still owns selecting dsh
as the default agent.

Options:
  -y, --yes               do not prompt; install a missing dsh without asking
  -n, --dry-run           print what would change without changing anything
      --profile <name>    profile to install into (default: web)
      --version <version>  pin the bundle to this npm version (default: latest)
      --dsh-version <v>   dsh version to install when missing (default: newest
                          published, including pre-releases)
      --no-install-dsh    never install dsh; fail when it is missing
      --headless          also install into the one-shot `headless` profile
  -h, --help              show this help

Environment:
  DSH_OMARCHY_PROFILE           profile to install into (default: web)
  DSH_OMARCHY_HEADLESS_PROFILE  one-shot profile name (default: headless)
  DSH_OMARCHY_DSH_VERSION       same as --dsh-version
EOF
}

while (($#)); do
  case "$1" in
    -y | --yes) ASSUME_YES=true; shift ;;
    -n | --dry-run) DRY_RUN=true; shift ;;
    --profile) PROFILE=${2:?--profile needs a value}; shift 2 ;;
    --version | --pin) PIN_VERSION=${2:?--version needs a value}; shift 2 ;;
    --dsh-version) DSH_VERSION=${2:?--dsh-version needs a value}; shift 2 ;;
    --no-install-dsh) WANT_DSH_INSTALL=false; shift ;;
    --headless) WANT_HEADLESS=true; shift ;;
    -h | --help) usage; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
done

if [[ -n $PIN_VERSION && ! $PIN_VERSION =~ ^[0-9A-Za-z._+-]+$ ]]; then
  die "invalid version: $PIN_VERSION"
fi

if [[ -n $DSH_VERSION && ! $DSH_VERSION =~ ^[0-9A-Za-z._+-]+$ ]]; then
  die "invalid dsh version: $DSH_VERSION"
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

# dsh is still published as a pre-release, so the npm `latest` tag can trail
# `next` (or be absent on a mirror). Pick whichever of the two tags was
# published last, then fall back to the tag that exists.
detect_latest_dsh_version() {
  local meta="" latest="" next="" latest_time="" next_time=""
  if command -v npm >/dev/null 2>&1; then
    meta="$(npm view @deepseek-ai/dsh time dist-tags --json --fetch-timeout=15000 --fetch-retries=1 2>/dev/null)" || meta=""
  fi
  if [[ -z $meta ]] && command -v curl >/dev/null 2>&1; then
    meta="$(curl -fsSL --max-time 15 'https://registry.npmjs.org/@deepseek-ai%2fdsh' 2>/dev/null)" || meta=""
  fi
  [[ -n $meta ]] || return 1

  if command -v jq >/dev/null 2>&1; then
    latest="$(jq -r '."dist-tags".latest // empty' <<<"$meta" 2>/dev/null || true)"
    next="$(jq -r '."dist-tags".next // empty' <<<"$meta" 2>/dev/null || true)"
    latest_time="$(jq -r --arg v "$latest" '.time[$v] // empty' <<<"$meta" 2>/dev/null || true)"
    next_time="$(jq -r --arg v "$next" '.time[$v] // empty' <<<"$meta" 2>/dev/null || true)"
  else
    latest="$(printf '%s' "$meta" | sed -nE 's/.*"latest"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' | head -n1)"
    next="$(printf '%s' "$meta" | sed -nE 's/.*"next"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' | head -n1)"
  fi

  if [[ -n $next && -n $latest ]]; then
    if [[ -n $next_time && -n $latest_time ]]; then
      # ISO-8601 UTC timestamps compare correctly as strings.
      if [[ $next_time > $latest_time ]]; then
        printf '%s\n' "$next"
      else
        printf '%s\n' "$latest"
      fi
      return 0
    fi
    # No jq: `next` is the pre-release channel dsh currently ships on.
    printf '%s\n' "$next"
    return 0
  fi
  if [[ -n $latest ]]; then
    printf '%s\n' "$latest"
    return 0
  fi
  if [[ -n $next ]]; then
    printf '%s\n' "$next"
    return 0
  fi
  return 1
}

install_dsh() {
  local version="$1" answer=""
  command -v mise >/dev/null 2>&1 ||
    die "dsh $version is not installed and mise is not on PATH. Install it manually: npm install -g @deepseek-ai/dsh@$version"

  # A dry run changes nothing, so it never needs to ask; it still prints the
  # install command it would have run.
  if ! $ASSUME_YES && ! $DRY_RUN; then
    if [[ ! -t 0 ]]; then
      die "dsh is not on PATH. Re-run with --yes to install dsh $version, or install it manually: mise use -g npm:@deepseek-ai/dsh@$version"
    fi
    printf 'dsh is not installed. Install the newest published version (%s) with mise? [Y/n] ' "$version" >&2
    read -r answer || answer=""
    case "$answer" in
    "" | y | Y | yes | YES) ;;
    *) die "dsh is required. Install it with: mise use -g npm:@deepseek-ai/dsh@$version" ;;
    esac
  fi

  say "• installing dsh $version with mise"
  if $DRY_RUN; then
    printf '[dry-run] mise use -g npm:@deepseek-ai/dsh@%s\n' "$version"
    return 0
  fi
  mise use -g "npm:@deepseek-ai/dsh@$version" || die "could not install dsh $version with mise"
  mise reshim >/dev/null 2>&1 || true
  prepend_tool_paths
  hash -r 2>/dev/null || true
  command -v dsh >/dev/null 2>&1 ||
    die "dsh $version was installed but is still not on PATH. Open a new shell and re-run this installer."
}

require_dsh() {
  prepend_tool_paths
  if command -v dsh >/dev/null 2>&1; then
    say "• dsh found: $(command -v dsh)"
    return 0
  fi

  if ! $WANT_DSH_INSTALL; then
    die "dsh is not on PATH. Install it with 'mise use -g npm:@deepseek-ai/dsh@<version>', or re-run without --no-install-dsh."
  fi

  local version="$DSH_VERSION"
  if [[ -z $version ]]; then
    say "• dsh is not installed; looking up the newest published version"
    version="$(detect_latest_dsh_version)" || version=""
  fi
  [[ -n $version ]] ||
    die "dsh is not on PATH and its newest published version could not be detected (offline?). Install it manually: mise use -g npm:@deepseek-ai/dsh@<version>"

  say "• newest published dsh: $version"
  install_dsh "$version"

  if $DRY_RUN; then
    say "• dry-run: skipping the post-install dsh check"
    return 0
  fi
  prepend_tool_paths
  hash -r 2>/dev/null || true
  command -v dsh >/dev/null 2>&1 ||
    die "dsh is not on PATH after installation. Open a new shell and re-run this installer."
  say "• dsh found: $(command -v dsh)"
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

  require_dsh
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
