#!/bin/bash
set -e

# === Webdo24 VPS First-Time Setup ===
# Run as root on a fresh Debian/Ubuntu VPS

APP_DIR="/var/www/webdo24-backend"
APP_USER="www-data"
NODE_VERSION="20"

echo "=== Webdo24 VPS Setup ==="

# Update system
apt update && apt upgrade -y

# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt install -y nodejs

# Install PM2 globally
npm install -g pm2

# Install Caddy
echo "→ Installing Caddy..."
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Create app directory
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/logs"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Clone repo (or you can copy files via SCP/rsync)
# git clone https://github.com/mirabeecko/webdo24-backend.git "$APP_DIR"
# cd "$APP_DIR"

echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Copy project files to $APP_DIR"
echo "  2. Create .env.local from .env.example"
echo "  3. Run: cd $APP_DIR && ./scripts/deploy.sh"
echo "  4. Copy Caddyfile: cp $APP_DIR/caddy/Caddyfile /etc/caddy/Caddyfile"
echo "  5. Reload Caddy: systemctl reload caddy"
echo ""
echo "  Optional: Enable logrotate:"
echo "    cp $APP_DIR/scripts/logrotate-webdo24 /etc/logrotate.d/webdo24"
