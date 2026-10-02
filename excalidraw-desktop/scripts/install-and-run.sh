#!/usr/bin/env bash
# Build the web app, package the desktop app as a .deb, install it, start it and
# show what it says on the console. Usage:
#   scripts/install-and-run.sh            build + install + start + follow the log
#   scripts/install-and-run.sh --dev      no install: start from the repo, logs here
# The same lines are kept in <userData>/logs/excalidraw.log (the start prints the path).
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
root="$(dirname "$here")"
console_log="${TMPDIR:-/tmp}/excalidraw-console.log"

# an earlier start that went wrong can stay alive without a window and hand every
# new start over to itself: stop it first (exact names, not a pattern)
for name in excalidraw excalidraw-desktop; do
  pgrep -x "$name" >/dev/null 2>&1 && pkill -x "$name" || true
done

echo "== building the web app"
yarn --cwd "$root" build:app

cd "$here"
if [ "${1:-}" = "--dev" ]; then
  echo "== starting from the repo (Ctrl+C to stop)"
  ELECTRON_ENABLE_LOGGING=1 exec npx electron .
fi

echo "== packaging the .deb"
npm install --no-audit --no-fund
npx electron-builder --linux deb

echo "== installing"
deb="$(ls -t dist/*.deb | head -1)"
sudo dpkg -i "$deb" || sudo apt-get install -f -y

echo "== starting (console: $console_log)"
ELECTRON_ENABLE_LOGGING=1 nohup excalidraw > "$console_log" 2>&1 &
sleep 4
if pgrep -x excalidraw >/dev/null; then
  echo "running; following the console (Ctrl+C leaves the app running)"
else
  echo "the app exited, see below" >&2
fi
tail -n 40 -f "$console_log"
