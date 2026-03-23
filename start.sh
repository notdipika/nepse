#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  NEPSE Dashboard — start.sh
#  Usage: bash start.sh [--dev | --prod]
#  Default: production build + start
# ─────────────────────────────────────────────────────────────────

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}${BOLD}[NEPSE]${RESET} $*"; }
ok()   { echo -e "${GREEN}${BOLD}[  OK  ]${RESET} $*"; }
warn() { echo -e "${YELLOW}${BOLD}[ WARN ]${RESET} $*"; }
err()  { echo -e "${RED}${BOLD}[ ERR  ]${RESET} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
log "Working directory: $SCRIPT_DIR"

MODE="prod"
if [[ "$1" == "--dev" ]]; then MODE="dev"; fi

echo ""
echo -e "${BOLD}════════════════════════════════════════${RESET}"
echo -e "${BOLD}   NEPSE Dashboard  •  mode: ${MODE}${RESET}"
echo -e "${BOLD}════════════════════════════════════════${RESET}"
echo ""

# ── 1. Python venv ─────────────────────────────────────────────────
VENV_DIR="$SCRIPT_DIR/.venv"
if [[ ! -d "$VENV_DIR" ]]; then
  log "Creating Python virtual environment…"
  python3 -m venv "$VENV_DIR" || err "python3 -m venv failed."
  ok "Virtual environment created at .venv"
else
  ok "Virtual environment already exists"
fi
log "Activating virtual environment…"
source "$VENV_DIR/bin/activate"
ok "Python venv active  →  $(python --version)"

REQUIREMENTS="$SCRIPT_DIR/requirements.txt"
if [[ -f "$REQUIREMENTS" ]]; then
  log "Installing Python dependencies from requirements.txt…"
  pip install --quiet --upgrade pip
  pip install --quiet -r "$REQUIREMENTS"
  ok "Python dependencies installed"
else
  warn "requirements.txt not found — installing pymysql + requests directly…"
  pip install --quiet pymysql requests
  ok "pymysql + requests installed"
fi

# ── 2. Node / npm ──────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || err "Node.js not installed."
command -v npm  >/dev/null 2>&1 || err "npm not installed."
ok "Node $(node --version)  •  npm $(npm --version)"

if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
  log "Installing npm dependencies…"
  npm install
  ok "npm dependencies installed"
else
  log "Checking for npm dependency changes…"
  npm install --silent
  ok "npm dependencies up to date"
fi

# ── 3. .env.local ──────────────────────────────────────────────────
ENV_FILE="$SCRIPT_DIR/.env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  warn ".env.local not found!"
  if [[ -f "$SCRIPT_DIR/.env.local.example" ]]; then
    cp "$SCRIPT_DIR/.env.local.example" "$ENV_FILE"
    warn "Copied .env.local.example → .env.local"
    warn "Please edit .env.local and set your DB passwords, then re-run."
    exit 1
  else
    err ".env.local is missing."
  fi
fi
ok ".env.local found"

# ── CRITICAL: ensure AUTH_TRUST_HOST=true is in .env.local ─────────
# Without this, NextAuth v5 throws "UntrustedHost" on every request
# when running outside Vercel (i.e. localhost production builds).
if ! grep -q "AUTH_TRUST_HOST" "$ENV_FILE"; then
  echo "" >> "$ENV_FILE"
  echo "# Required for self-hosted NextAuth v5" >> "$ENV_FILE"
  echo "AUTH_TRUST_HOST=true" >> "$ENV_FILE"
  ok "Added AUTH_TRUST_HOST=true to .env.local"
else
  ok "AUTH_TRUST_HOST already set"
fi

# ── 4. Build + Run ─────────────────────────────────────────────────
if [[ "$MODE" == "dev" ]]; then
  log "Starting Next.js in development mode…"
  echo ""
  echo -e "${GREEN}${BOLD}→ http://localhost:3000${RESET}"
  echo ""
  npm run dev
else
  log "Building Next.js for production…"
  npm run build || err "Build failed. Fix the errors above and retry."
  ok "Build complete"
  echo ""
  log "Starting production server…"
  echo -e "${GREEN}${BOLD}→ http://localhost:3000${RESET}"
  echo ""
  npm run start
fi