#!/usr/bin/env bash
# Reachmark Audio v1.3 — run BOTH apps in one container.
#   • public PWA  → PORT      (default 8000)
#   • admin app   → ADMIN_PORT (default 8001; point your admin subdomain here)
# They share ONE SQLite database (WAL mode is multi-process safe) on the same
# persistent disk (DATA_DIR). On Render, a web service routes only $PORT — so
# either run this single-container setup behind your own reverse proxy
# (nginx/Caddy/Cloudflare Tunnel routing admin.yourdomain → :8001), or split
# into two services ONLY after moving to a shared Postgres database.
set -euo pipefail
cd "$(dirname "$0")/.."

export PORT="${PORT:-8000}"
export ADMIN_PORT="${ADMIN_PORT:-8001}"
export DATA_DIR="${DATA_DIR:-./data}"

echo "[run-all] DATA_DIR=$DATA_DIR  public=:$PORT  admin=:$ADMIN_PORT"

node admin/server.js &
ADMIN_PID=$!
trap 'echo "[run-all] shutting down"; kill "$ADMIN_PID" 2>/dev/null || true' TERM INT EXIT

node server/server.js &
PUBLIC_PID=$!
trap 'echo "[run-all] shutting down"; kill "$ADMIN_PID" "$PUBLIC_PID" 2>/dev/null || true' TERM INT EXIT

# exit as soon as either process dies so the orchestrator restarts the container
wait -n "$ADMIN_PID" "$PUBLIC_PID"
