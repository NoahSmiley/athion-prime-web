#!/usr/bin/env bash
# Athion Prime web — production deploy.
#
# Builds the SPA against athion.me, rsyncs dist/ to CT 111 (prime-web at
# 192.168.0.148), and reloads nginx. Cloudflare tunnel routes
# prime.athion.me to that container, so no DNS / TLS work is needed here.
#
# Run from anywhere on the home LAN with SSH access to the container.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="root@192.168.0.148"
WEBROOT="/var/www/prime-web"

cd "$REPO_ROOT"

echo "==> Building production bundle"
VITE_ATHION_API_BASE=https://athion.me \
VITE_ATHION_LOGIN_URL=https://athion.me/login \
  pnpm build

echo "==> Syncing dist/ → ${HOST}:${WEBROOT}/"
rsync -av --delete dist/ "${HOST}:${WEBROOT}/"

echo "==> Reloading nginx on prime-web"
ssh "$HOST" "systemctl reload nginx"

echo "==> Live at https://prime.athion.me/"
