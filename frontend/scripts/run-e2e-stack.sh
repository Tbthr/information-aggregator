#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_URL="http://127.0.0.1:3000/api/health"
FRONTEND_URL="http://127.0.0.1:5173/"

backend_pid=""
frontend_pid=""

cleanup() {
  if [[ -n "$frontend_pid" ]] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill "$frontend_pid" 2>/dev/null || true
    wait "$frontend_pid" 2>/dev/null || true
  fi

  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

cd "$ROOT_DIR"
bun src/cli/main.ts serve --port 3000 > /tmp/ia-playwright-backend.log 2>&1 &
backend_pid=$!

for _ in $(seq 1 120); do
  if curl --silent --fail "$BACKEND_URL" >/dev/null; then
    break
  fi
  sleep 1
done

if ! curl --silent --fail "$BACKEND_URL" >/dev/null; then
  echo "后端服务未能在预期时间内启动" >&2
  exit 1
fi

cd "$FRONTEND_DIR"
bun run dev -- --host 127.0.0.1 --strictPort > /tmp/ia-playwright-frontend.log 2>&1 &
frontend_pid=$!

for _ in $(seq 1 120); do
  if curl --silent --fail "$FRONTEND_URL" >/dev/null; then
    break
  fi
  sleep 1
done

if ! curl --silent --fail "$FRONTEND_URL" >/dev/null; then
  echo "前端服务未能在预期时间内启动" >&2
  exit 1
fi

wait "$frontend_pid"
