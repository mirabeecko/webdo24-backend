#!/bin/bash
set -e

APP_DIR="/var/www/webdo24-backend"
LOG_DIR="$APP_DIR/logs"
PM2_APP_NAME="webdo24-backend"

echo "=== Webdo24 Deploy ==="
echo "$(date '+%Y-%m-%d %H:%M:%S')"

cd "$APP_DIR"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Pull latest code
echo "→ Pulling from git..."
git pull origin main

# Install dependencies
echo "→ Installing dependencies..."
npm ci

# Build
echo "→ Building Next.js..."
npm run build

# Ensure .env.local is in standalone output
if [ -f ".env.local" ] && [ ! -f ".next/standalone/.env.local" ]; then
  echo "→ Copying .env.local to standalone output..."
  cp .env.local .next/standalone/.env.local
fi

# Fix server.js path if workspace root detection placed it elsewhere
if [ ! -f ".next/standalone/server.js" ]; then
  ACTUAL_SERVER=$(find .next/standalone -name "server.js" -not -path "*/node_modules/*" | head -n1)
  if [ -n "$ACTUAL_SERVER" ]; then
    echo "→ Creating server.js symlink ($ACTUAL_SERVER)"
    ln -sf "$(realpath --relative-to=.next/standalone "$ACTUAL_SERVER")" .next/standalone/server.js
  fi
fi

# Restart with PM2
echo "→ Restarting PM2 process..."
pm2 restart "$PM2_APP_NAME" --update-env || pm2 start "$APP_DIR/pm2/ecosystem.config.js"

# Save PM2 process list
pm2 save

echo "=== Deploy finished ==="
echo "Check status: pm2 status $PM2_APP_NAME"
echo "View logs:    pm2 logs $PM2_APP_NAME"
