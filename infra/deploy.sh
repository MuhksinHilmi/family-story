#!/usr/bin/env bash
set -euo pipefail

# deploy.sh
# Usage: sudo ./deploy.sh example.com GITHUB_REPO_URL
# Example: sudo ./deploy.sh example.com git@github.com:you/family-story.git

DOMAIN="$1"
REPO_URL="$2"
APP_DIR="/var/www/family-story"
ENV_FILE="$APP_DIR/.env.production"
DOCKER_COMPOSE_FILE="$APP_DIR/infra/docker-compose.yml"
NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}"
NGINX_LINK="/etc/nginx/sites-enabled/${DOMAIN}"

if [ -z "$DOMAIN" ] || [ -z "$REPO_URL" ]; then
  echo "Usage: sudo $0 <domain> <repo_url>"
  exit 1
fi

echo "--- Preparing VPS for deployment: $DOMAIN"

# 1. Install prerequisites: docker, docker-compose plugin, nginx, certbot
apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release sudo software-properties-common

# Docker install
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm get-docker.sh
fi

# Docker compose plugin (comes with recent docker)
if ! docker compose version >/dev/null 2>&1; then
  echo "Enabling docker compose plugin..."
  # usually included; if not, user should install docker-compose-plugin
fi

# Nginx & certbot
if ! command -v nginx >/dev/null 2>&1; then
  apt-get install -y nginx
fi
if ! command -v certbot >/dev/null 2>&1; then
  apt-get install -y certbot python3-certbot-nginx
fi

# 2. Create application directory and clone repo
if [ ! -d "$APP_DIR" ]; then
  mkdir -p "$APP_DIR"
  chown "$SUDO_USER":"$SUDO_USER" "$APP_DIR" || true
fi

cd "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  echo "Cloning repository..."
  git clone "$REPO_URL" .
else
  echo "Repository exists, pulling latest..."
  git fetch --all
  git reset --hard origin/main || true
fi

# 3. Ensure infra files exist (docker-compose, Dockerfile) — they should be in repo/infra
if [ ! -f "$APP_DIR/infra/docker-compose.yml" ]; then
  echo "ERROR: infra/docker-compose.yml not found in repository."
  exit 1
fi

# 4. Create production .env from template if missing
if [ ! -f "$ENV_FILE" ]; then
  echo "Creating .env.production (you will be asked values)"
  read -p "Postgres password (DB_PASSWORD): " DB_PASSWORD
  read -p "Domain (for NEXT_PUBLIC_SITE_URL) [$DOMAIN]: " SITE_URL_IN
  SITE_URL=${SITE_URL_IN:-https://$DOMAIN}

  cat > "$ENV_FILE" <<EOF
# Application environment (production)
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://postgres:${DB_PASSWORD}@db:5432/family_story
REDIS_URL=redis://redis:6379
NEXT_PUBLIC_SITE_URL=${SITE_URL}
# other envs (SMTP_*) can be set here or in systemd environment
EOF
  echo "Wrote $ENV_FILE"
fi

# 5. Start containers (build app image if Dockerfile present)
cd "$APP_DIR/infra"

# Run docker compose up - build
docker compose pull || true
docker compose build --no-cache app || docker compose build app || true
docker compose up -d --remove-orphans

# 6. Setup nginx site config (host nginx)
if [ ! -f "$NGINX_SITE" ]; then
  echo "Creating nginx config for $DOMAIN"
  cat > "$NGINX_SITE" <<EOF
server {
  listen 80;
  server_name ${DOMAIN} www.${DOMAIN};

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
  }

  location /.well-known/acme-challenge/ {
    root /var/www/letsencrypt;
  }
}
EOF
  ln -sf "$NGINX_SITE" "$NGINX_LINK"
fi

# Create directory for ACME challenges
mkdir -p /var/www/letsencrypt
chown www-data:www-data /var/www/letsencrypt || true

# Reload nginx and obtain TLS cert
nginx -t && systemctl reload nginx || true

echo "Obtaining TLS certificates with certbot..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "admin@${DOMAIN}" || true

# Final nginx reload
nginx -t && systemctl reload nginx

# 7. Setup simple systemd service to keep docker-compose up (optional)
SERVICE_FILE="/etc/systemd/system/family-story.service"
if [ ! -f "$SERVICE_FILE" ]; then
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Family Story docker-compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}/infra
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable family-story.service
  systemctl start family-story.service || true
fi

echo "Deployment finished. Visit: https://${DOMAIN}"
