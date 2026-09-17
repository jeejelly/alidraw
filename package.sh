#!/usr/bin/env bash
# Build excalidraw-app and install it as a loopback-only user service.
#
#   ./package.sh            build, install, (re)start, check
#   ./package.sh build      dependencies + vite build only
#   ./package.sh install    install the existing build, (re)start, check
#   ./package.sh status     service state and HTTP answer
#   ./package.sh desktop    build, package the Electron app, install it in the apps menu
#
# Env: EXCALIDRAW_PORT (3100), EXCALIDRAW_DIR (~/.local/share/excalidraw-local)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$REPO/excalidraw-app"
BUILD="$APP/build"
PORT="${EXCALIDRAW_PORT:-3100}"
DEST="${EXCALIDRAW_DIR:-$HOME/.local/share/excalidraw-local}"
UNIT_NAME="excalidraw-local.service"
UNIT="$HOME/.config/systemd/user/$UNIT_NAME"
URL="http://127.0.0.1:$PORT/"
DESKTOP="$REPO/excalidraw-desktop"
DESKTOP_DEST="$HOME/.local/opt/excalidraw-desktop"
DESKTOP_ENTRY="$HOME/.local/share/applications/excalidraw-desktop.desktop"
DESKTOP_ICON="$HOME/.local/share/icons/hicolor/512x512/apps/excalidraw-desktop.png"

say() { printf '== %s\n' "$*"; }
die() { printf 'package.sh: %s\n' "$*" >&2; exit 1; }

build() {
  command -v node >/dev/null || die "node not found"
  cd "$REPO"
  if [[ ! -d node_modules ]] || [[ yarn.lock -nt node_modules ]]; then
    say "dependencies (yarn 1.22.22)"
    npx --yes yarn@1.22.22 install --frozen-lockfile
    touch node_modules
  fi
  say "build $(git -C "$REPO" rev-parse --abbrev-ref HEAD)@$(git -C "$REPO" rev-parse --short HEAD)"
  rm -rf "$BUILD"
  (cd "$APP" && npx vite build)
  [[ -f "$BUILD/index.html" ]] || die "no $BUILD/index.html after build"
}

install_files() {
  [[ -f "$BUILD/index.html" ]] || die "no build at $BUILD: run ./package.sh build"
  say "install $BUILD -> $DEST"
  mkdir -p "$DEST"
  if [[ -n "$(ls -A "$DEST")" && ! -f "$DEST/index.html" ]]; then
    die "$DEST is not empty and holds no index.html: refusing to empty it"
  fi
  # the directory is served as-is: replace it whole, so no file of an older build lingers
  find "$DEST" -mindepth 1 -delete
  cp -a "$BUILD/." "$DEST/"
  find "$DEST" -name '*.map' -delete
}

install_unit() {
  say "unit $UNIT (127.0.0.1:$PORT)"
  mkdir -p "$(dirname "$UNIT")"
  cat >"$UNIT" <<EOF
[Unit]
Description=Excalidraw, local build of $REPO, no outbound network
After=network.target

[Service]
Type=simple
WorkingDirectory=$DEST
# loopback only: nothing off this machine reaches it
ExecStart=/usr/bin/python3 -m http.server $PORT --bind 127.0.0.1 --directory $DEST
Restart=always
RestartSec=2
SuccessExitStatus=143

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable "$UNIT_NAME" >/dev/null
  systemctl --user restart "$UNIT_NAME"
}

check() {
  local code=""
  for _ in $(seq 1 20); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$URL" || true)"
    [[ "$code" == "200" ]] && break
    sleep 0.25
  done
  [[ "$code" == "200" ]] || die "$URL answered '$code'"
  say "$(systemctl --user is-active "$UNIT_NAME") $URL 200"
}

desktop() {
  build
  say "package Electron app"
  (cd "$DESKTOP" && npm ci --no-audit --no-fund >/dev/null &&
    env -u ELECTRON_RUN_AS_NODE npx electron-builder --linux dir >/dev/null)
  local unpacked="$DESKTOP/dist/linux-unpacked"
  [[ -x "$unpacked/excalidraw" ]] || die "no $unpacked/excalidraw after packaging"
  say "install $unpacked -> $DESKTOP_DEST"
  if [[ -e "$DESKTOP_DEST" && ! -x "$DESKTOP_DEST/excalidraw" ]]; then
    die "$DESKTOP_DEST exists and holds no excalidraw binary: refusing to replace it"
  fi
  rm -rf "$DESKTOP_DEST"
  mkdir -p "$(dirname "$DESKTOP_DEST")" "$(dirname "$DESKTOP_ENTRY")" "$(dirname "$DESKTOP_ICON")"
  cp -a "$unpacked" "$DESKTOP_DEST"
  cp "$BUILD/android-chrome-512x512.png" "$DESKTOP_ICON"
  # VS Code terminals export ELECTRON_RUN_AS_NODE, which turns the binary into plain node
  cat >"$DESKTOP_ENTRY" <<EOF
[Desktop Entry]
Type=Application
Name=Excalidraw
Comment=Whiteboard, local files only (branch $(git -C "$REPO" rev-parse --abbrev-ref HEAD))
Exec=env -u ELECTRON_RUN_AS_NODE $DESKTOP_DEST/excalidraw
Icon=$DESKTOP_ICON
Terminal=false
Categories=Graphics;
StartupWMClass=excalidraw-desktop
EOF
  command -v update-desktop-database >/dev/null &&
    update-desktop-database "$(dirname "$DESKTOP_ENTRY")" || true
  say "apps menu: Excalidraw ($DESKTOP_ENTRY)"
}

case "${1:-all}" in
  all) build; install_files; install_unit; check ;;
  build) build ;;
  install) install_files; install_unit; check ;;
  desktop) desktop ;;
  status) systemctl --user status "$UNIT_NAME" --no-pager | head -5; check ;;
  *) sed -n '2,10p' "$0"; exit 2 ;;
esac
