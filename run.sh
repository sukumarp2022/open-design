#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# --- Prefer Homebrew Copilot CLI over VS Code bundled one ---
export PATH="/opt/homebrew/bin:$PATH"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { printf "${GREEN}▸${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}▸${NC} %s\n" "$*"; }
fail()  { printf "${RED}✗${NC} %s\n" "$*"; exit 1; }

# --- Check Node ---
if ! command -v node &>/dev/null; then
  fail "Node.js is not installed. Install Node ~24 first."
fi

NODE_MAJOR=$(node -e 'process.stdout.write(process.version.split(".")[0].slice(1))')
if (( NODE_MAJOR < 22 )); then
  warn "Node $NODE_MAJOR detected; this project targets Node ~24. Things may break."
fi

# --- Enable Corepack (provides the pinned pnpm) ---
info "Enabling Corepack..."
corepack enable 2>/dev/null || warn "corepack enable failed — make sure Corepack is available"

# --- Stop any running daemon (may have stale PATH/binaries) ---
info "Stopping any running services..."
pnpm tools-dev stop 2>/dev/null || true

# --- Install dependencies ---
info "Installing dependencies (pnpm install)..."
pnpm install

# --- Rebuild native modules if Node version changed ---
info "Rebuilding native modules..."
pnpm --filter @open-design/daemon rebuild better-sqlite3 --pending 2>/dev/null || true

# --- Build workspace packages (ensures dist/ is fresh after branch switches) ---
info "Building workspace packages..."
pnpm --filter @open-design/contracts build
pnpm --filter @open-design/sidecar-proto build
pnpm --filter @open-design/sidecar build
pnpm --filter @open-design/platform build
pnpm --filter @open-design/tools-dev build

# --- Verify Copilot CLI ---
COPILOT_BIN=$(command -v copilot 2>/dev/null || true)
if [[ -n "$COPILOT_BIN" ]]; then
  info "Using Copilot CLI: $COPILOT_BIN"
else
  warn "No copilot binary found on PATH"
fi

# --- Graceful shutdown on Ctrl+C / SIGTERM ---
cleanup() {
  printf '\n'
  info "Caught interrupt — stopping services..."
  pnpm tools-dev stop 2>/dev/null || true
  info "Stopped. Bye!"
  exit 0
}
trap cleanup INT TERM

# --- Start dev environment ---
info "Starting local development environment..."
pnpm tools-dev "$@"
