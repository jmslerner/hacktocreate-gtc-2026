#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  ██╗  ██╗ █████╗  ██████╗██╗  ██╗████████╗ ██████╗"
echo "  ██║  ██║██╔══██╗██╔════╝██║ ██╔╝╚══██╔══╝██╔═══██╗"
echo "  ███████║███████║██║     █████╔╝    ██║   ██║   ██║"
echo "  ██╔══██║██╔══██║██║     ██╔═██╗    ██║   ██║   ██║"
echo "  ██║  ██║██║  ██║╚██████╗██║  ██╗   ██║   ╚██████╔╝"
echo "  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝  ╚═╝    ╚═════╝"
echo "  CREATE  ·  GTC 2026  ·  Dell GB10"
echo ""

# ── Backend ──────────────────────────────────────────────────────────────────
echo "[1/2] Starting FastAPI backend on :8000"
cd "$ROOT/backend"

if [ ! -d ".venv" ]; then
  echo "  → Creating Python venv…"
  python3 -m venv .venv
fi

source .venv/bin/activate

echo "  → Installing Python dependencies…"
pip install -q -r requirements.txt

export RAG_BASE_URL="${RAG_BASE_URL:-http://10.1.96.117}"
echo "  → RAG agent: $RAG_BASE_URL"

uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "  → Backend PID: $BACKEND_PID"

# ── Frontend ─────────────────────────────────────────────────────────────────
echo ""
echo "[2/2] Starting Next.js frontend on :3000"
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  echo "  → Installing npm dependencies…"
  npm install
fi

npm run dev &
FRONTEND_PID=$!
echo "  → Frontend PID: $FRONTEND_PID"

echo ""
echo "  ✓ App running at http://localhost:3000"
echo "  ✓ API running at http://localhost:8000"
echo "  ✓ API docs at  http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

# Wait and clean up on exit
trap "echo ''; echo 'Shutting down…'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait $BACKEND_PID $FRONTEND_PID
