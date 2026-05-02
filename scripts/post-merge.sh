#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

# Ensure GitHub auto-sync loop is running in the background.
# This is the fallback auto-start for the periodic push job so it
# resumes automatically after every task merge without manual steps.
PIDFILE=/tmp/github-sync.pid
SYNC_SCRIPT="$(cd "$(dirname "$0")" && pwd)/github-push.sh"

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "GitHub auto-sync already running (pid $(cat "$PIDFILE"))"
else
  nohup bash -c '
    while true; do
      bash "'"$SYNC_SCRIPT"'" || true
      sleep 1800
    done
  ' >> /tmp/github-sync.log 2>&1 &
  echo $! > "$PIDFILE"
  echo "GitHub auto-sync started in background (pid $(cat "$PIDFILE"))"
fi
