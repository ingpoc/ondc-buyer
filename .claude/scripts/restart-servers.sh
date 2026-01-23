#!/bin/bash
# restart-servers.sh - ONDC UCP Buyer Portal
# Purpose: Restart Vite dev server
# Usage: ./restart-servers.sh

set -e

FRONTEND_PORT=3002

echo "=== Restarting Vite Dev Server ==="

# Kill existing process
kill_port() {
  local port=$1
  local pid=$(lsof -ti:$port 2>/dev/null || true)

  if [ -n "$pid" ]; then
    echo "Killing process on port $port (PID: $pid)"
    kill -9 $pid 2>/dev/null || true
    sleep 1
  else
    echo "No process found on port $port"
  fi
}

kill_port $FRONTEND_PORT

# Start Vite dev server
echo ""
echo "Starting Vite dev server on port $FRONTEND_PORT..."
nohup npm run dev > /tmp/vite-dev.log 2>&1 &
FRONTEND_PID=$!
echo "Vite started (PID: $FRONTEND_PID, logs: /tmp/vite-dev.log)"

# Wait for server
echo ""
echo "Waiting for server to start..."
count=0
max_wait=30
while [ $count -lt $max_wait ]; do
  if curl -sf "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
    echo "✓ Vite dev server is ready"
    echo ""
    echo "=== Server started successfully ==="
    echo "Frontend: http://localhost:$FRONTEND_PORT"
    exit 0
  fi
  sleep 1
  count=$((count + 1))
  echo -n "."
done

echo ""
echo "✗ Server failed to start within ${max_wait}s" >&2
exit 1
