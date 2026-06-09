#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Set up nginx + TLS for neuronoiser.com on THIS VPS (static site, served from dist/).
#
#   RUN AS ROOT:  sudo bash setup-nginx-neuronoiser.sh
#   RUN IT AFTER you've repointed neuronoiser.com (+ www) DNS to this VPS (167.86.99.43).
#
# Reviewed by Danny before running. Idempotent — safe to re-run.
# certbot needs DNS already pointing here (HTTP-01 validation), so DNS first, script second.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="neuronoiser.com"
ROOT="/home/deploy/neuronoiser-site/dist"
VPS_IP="167.86.99.43"
SITE="/etc/nginx/sites-available/neuronoiser"
LINK="/etc/nginx/sites-enabled/neuronoiser"

[[ $EUID -eq 0 ]] || { echo "Run with sudo."; exit 1; }
[[ -f "$ROOT/index.html" ]] || { echo "Build missing at $ROOT — run the build first."; exit 1; }

# DNS sanity (warn, don't hard-fail). Query a PUBLIC resolver (what Let's Encrypt sees),
# not the VPS's local cache — which can lag behind for a while after the change.
resolved="$(dig +short "$DOMAIN" A @8.8.8.8 | tail -1 || true)"
echo "DNS (via 8.8.8.8): $DOMAIN -> ${resolved:-(none)}   (want $VPS_IP)"
if [[ "$resolved" != "$VPS_IP" ]]; then
  echo "⚠️  $DOMAIN does not resolve to $VPS_IP yet — certbot will FAIL until DNS propagates."
  read -r -p "Continue anyway? [y/N] " ok; [[ "$ok" == "y" || "$ok" == "Y" ]] || exit 1
fi

# 1) nginx server block — HTTP only; certbot adds the 443/SSL block + HTTP→HTTPS redirect.
#    apex + www both serve the site (canonical is handled by the <link> tag in index.html).
cat > "$SITE" <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name neuronoiser.com www.neuronoiser.com;

    root /home/deploy/neuronoiser-site/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # fingerprinted assets — cache hard
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript application/wasm text/xml image/svg+xml;
    gzip_min_length 256;
}
NGINX

ln -sf "$SITE" "$LINK"
nginx -t
systemctl reload nginx
echo "✓ nginx serving $DOMAIN over HTTP."

# 2) TLS — same certbot flags as the rest of the stack.
certbot --nginx -d neuronoiser.com -d www.neuronoiser.com \
        --non-interactive --agree-tos --redirect --register-unsafely-without-email

nginx -t
systemctl reload nginx
echo "✓ HTTPS live. Verifying…"
curl -sI "https://neuronoiser.com" | head -3 || true
echo "Done — neuronoiser.com is now served from the VPS."
