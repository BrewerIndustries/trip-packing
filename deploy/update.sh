#!/usr/bin/env bash
# Pull latest main and redeploy Trip Packing (trip-packing, :4840) on the jarvis server.
# From your Mac:  ssh dan@100.102.159.57 /opt/trip-packing/deploy/update.sh
set -euo pipefail

cd /opt/trip-packing

# npm install on Linux rewrites the macOS-generated lockfile; discard that churn
# so the fast-forward pull can't abort.
git checkout -- package-lock.json 2>/dev/null || true

echo "→ fetching latest main…"
git pull --ff-only

echo "→ installing deps…"          # npm install (not ci): lockfile is macOS-generated
npm install

echo "→ building…"
npm run build

echo "→ restarting trip-packing…"
sudo systemctl restart trip-packing

for i in $(seq 1 20); do
  curl -sf http://localhost:4840/api/health >/dev/null && break
  sleep 1
done
echo "✓ deployed $(git log -1 --pretty='%h %s') — $(systemctl is-active trip-packing) on :4840, health $(curl -s http://localhost:4840/api/health)"
