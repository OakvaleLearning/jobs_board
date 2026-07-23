#!/usr/bin/env bash
#
# One-shot Let's Encrypt bootstrap for the Oakvale portal.
#
# Issues the FIRST certificate before the TLS nginx.conf can load (a :443 block
# with ssl_certificate crashes nginx if the cert file doesn't exist yet). It spins
# up a throwaway HTTP-only nginx to answer the ACME challenge, requests the cert via
# the certbot webroot plugin, then tears the throwaway down. After it succeeds, start
# the real stack normally.
#
# Usage (run from the repo root, as the deploy user):
#   ./infra/init-letsencrypt.sh <domain> <email> [--staging]
#   ./infra/init-letsencrypt.sh jobs.oakvaleltd.com admin@oakvaleltd.com
#
# Then:
#   docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d --build
#
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
STAGING_ARG=""
[ "${3:-}" = "--staging" ] && STAGING_ARG="--staging"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: $0 <domain> <email> [--staging]" >&2
  exit 1
fi

# Resolve paths relative to the repo root (this script lives in infra/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CERT_DIR="$REPO_ROOT/certbot"
BOOTSTRAP_CONF="$SCRIPT_DIR/nginx/nginx.bootstrap.conf"

mkdir -p "$CERT_DIR/conf" "$CERT_DIR/www"

echo "==> Starting throwaway ACME nginx on :80"
docker rm -f oakvale-acme-nginx >/dev/null 2>&1 || true
docker run -d --name oakvale-acme-nginx -p 80:80 \
  -v "$BOOTSTRAP_CONF:/etc/nginx/nginx.conf:ro" \
  -v "$CERT_DIR/www:/var/www/certbot:ro" \
  nginx:alpine >/dev/null

cleanup() { docker rm -f oakvale-acme-nginx >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Give nginx a moment to come up.
sleep 2

echo "==> Requesting certificate for $DOMAIN"
docker run --rm \
  -v "$CERT_DIR/conf:/etc/letsencrypt" \
  -v "$CERT_DIR/www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email --non-interactive $STAGING_ARG

echo ""
echo "==> Certificate issued to $CERT_DIR/conf/live/$DOMAIN/"
echo "    Make sure infra/nginx/nginx.conf references this domain, then start the stack:"
echo "    docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d --build"
