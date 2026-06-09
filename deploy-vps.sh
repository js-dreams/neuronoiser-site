#!/usr/bin/env bash
# Update neuronoiser on the VPS: pull latest source + rebuild. nginx serves dist/ directly,
# so a rebuild is the whole deploy — no service restart needed. Run as danny (no sudo).
set -euo pipefail
cd "$(dirname "$0")"
git pull --ff-only
npm ci
npm run build
echo "✓ neuronoiser rebuilt → dist/"
