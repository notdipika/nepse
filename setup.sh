#!/usr/bin/env bash
# setup.sh — run once from the project root
# Creates a Python venv, installs deps, then loads 30 days of NEPSE data

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== NEPSE Dashboard Setup ==="

# 1. Create virtual environment
if [ ! -d ".venv" ]; then
  echo "→ Creating Python virtual environment..."
  python3 -m venv .venv
else
  echo "→ Virtual environment already exists"
fi

# 2. Activate and install deps
echo "→ Installing Python dependencies..."
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet \
  mysql-connector-python \
  pymysql \
  pandas \
  requests \
  openpyxl

echo "→ Dependencies installed"

# 3. Run load_history.py with the venv python
echo "→ Loading 30 days of NEPSE data (this takes 2–5 minutes)..."
.venv/bin/python load_history.py --days 30

echo ""
echo "✓ Setup complete! Now run: npm run dev"