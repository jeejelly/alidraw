#!/usr/bin/env bash
# Build excalidraw-app and install it as a loopback-only user service.
#
#   ./package.sh            build, install, (re)start, check
#   ./package.sh build      dependencies + vite build only
#   ./package.sh install    stop, uninstall, install the web app, start, check
#   ./package.sh install vscode
#   ./package.sh install desktop
#   ./package.sh status     service state and HTTP answer
#   ./package.sh desktop    build, package, install the Electron app
#   ./package.sh desktop-package  build and create a .deb in excalidraw-desktop/dist
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
VSCODE_EXTENSION="pomdtr.excalidraw-editor"
VSCODE_DIR="${EXCALIDRAW_VSCODE_DIR:-$REPO-vscode}"
VSCODE_VSIX="$VSCODE_DIR/excalidraw-editor-local.vsix"

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

stop_app() {
  systemctl --user stop "$UNIT_NAME" >/dev/null 2>&1 || true
}

install_app() {
  stop_app
  rm -rf "$DEST"
  install_files
  install_unit
  check
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
    env -u ELECTRON_RUN_AS_NODE npx electron-builder --linux deb >/dev/null)
  local deb
  deb="$(find "$DESKTOP/dist" -maxdepth 1 -type f -name '*.deb' -print -quit)"
  [[ -n "$deb" ]] || die "no .deb in $DESKTOP/dist after packaging"
  say "install $deb"
  command -v apt-get >/dev/null || die "apt-get not found; install $deb with a package manager"
  sudo apt-get install -y "$deb"
  say "installed Excalidraw; launch it from the applications menu"
}

desktop_package() {
  build
  say "package Electron app"
  (cd "$DESKTOP" && npm ci --no-audit --no-fund >/dev/null &&
    env -u ELECTRON_RUN_AS_NODE npx electron-builder --linux deb >/dev/null)
  find "$DESKTOP/dist" -maxdepth 1 -type f -name '*.deb' -print
}

vscode() {
  local vscode_cli="${VSCODE_CLI:-code}"
  command -v "$vscode_cli" >/dev/null || die "$vscode_cli not found"
  command -v npm >/dev/null || die "npm not found"
  [[ -f "$VSCODE_DIR/package.json" ]] || die "no VS Code extension at $VSCODE_DIR"
  say "build VS Code extension $VSCODE_DIR"
  (cd "$VSCODE_DIR" && npm ci --no-audit --no-fund >/dev/null && npm run package)
  say "package VS Code extension $VSCODE_VSIX"
  (cd "$VSCODE_DIR" && npx --yes @vscode/vsce package --out "$VSCODE_VSIX" >/dev/null)
  "$vscode_cli" --uninstall-extension "$VSCODE_EXTENSION" >/dev/null 2>&1 || true
  say "install VS Code extension $VSCODE_VSIX"
  "$vscode_cli" --install-extension "$VSCODE_VSIX" --force
}

case "${1:-all}" in
  all) stop_app; rm -rf "$DEST"; build; install_files; install_unit; check ;;
  build) build ;;
  install)
    case "${2:-app}" in
      app) install_app ;;
      desktop) desktop ;;
      vscode) vscode ;;
      *) die "usage: $0 install [app|vscode|desktop]" ;;
    esac
    ;;
  desktop) desktop ;;
  desktop-package) desktop_package ;;
  vscode) vscode ;;
  status) systemctl --user status "$UNIT_NAME" --no-pager | head -5; check ;;
  *) sed -n '2,10p' "$0"; exit 2 ;;
esac
