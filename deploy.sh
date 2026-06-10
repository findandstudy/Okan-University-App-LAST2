#!/usr/bin/env bash
# ─── University Landing Platform — Deployment Script ──────────────────────────
#
# Run this script on the VPS after SSH-ing in, from the project root:
#
#   bash deploy.sh
#
# What it does:
#   1. Pull latest code from git
#   2. Install / update Node.js dependencies
#   3. Build the production bundle (client + server)
#   4. Apply any pending database migrations
#   5. Reload the PM2 process (zero-downtime)
#
# Requirements:
#   - Node.js 20+ and npm available in PATH
#   - PM2 installed globally: npm install -g pm2
#   - ecosystem.config.cjs present in the project root
#   - Environment variables set (see .env.example)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  University Landing Platform — Deployment"
echo "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Pull latest code ───────────────────────────────────────────────────────
echo "▶ [1/5] Pulling latest code..."
git pull --ff-only
echo "  ✔ git pull done"
echo ""

# ── 2. Install dependencies ───────────────────────────────────────────────────
echo "▶ [2/5] Installing dependencies..."
npm install --prefer-offline
echo "  ✔ npm install done"
echo ""

# ── 3. Build production bundle ────────────────────────────────────────────────
echo "▶ [3/5] Building production bundle..."
npm run build
echo "  ✔ Build successful — dist/index.cjs + dist/public/ ready"
echo ""

# ── 4. Database migrations ────────────────────────────────────────────────────
echo "▶ [4/5] Applying database migrations..."
npm run db:push
echo "  ✔ Database schema up-to-date"
echo ""

# ── 5. Reload PM2 ─────────────────────────────────────────────────────────────
echo "▶ [5/5] Reloading PM2 process (zero-downtime)..."
if pm2 list | grep -q "uni-landing"; then
  pm2 reload ecosystem.config.cjs --update-env
  echo "  ✔ PM2 reloaded"
else
  pm2 start ecosystem.config.cjs
  pm2 save
  echo "  ✔ PM2 started (first time)"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Deployment complete!"
echo "  Run  pm2 logs uni-landing  to watch live logs."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
