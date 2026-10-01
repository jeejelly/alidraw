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
# Run it as your own user, not with sudo: it asks for sudo itself where needed.
# It installs what it needs: the latest Node (a private copy under .node/,
# nothing is changed system-wide) and the yarn packages.
#
# Env: EXCALIDRAW_PORT (3100), EXCALIDRAW_DIR (~/.local/share/excalidraw-local),
#      EXCALIDRAW_YES=1 (answer yes to the questions, e.g. fetching Node)
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

NODE_MIN=20
NODE_HOME="$REPO/.node"

say() { printf '== %s\n' "$*"; }
die() { printf 'package.sh: %s\n' "$*" >&2; exit 1; }

# ask before changing anything; -y / EXCALIDRAW_YES=1 answers yes, no terminal answers no
confirm() {
  [[ -n "${EXCALIDRAW_YES:-}" ]] && return 0
  [[ -t 0 ]] || return 1
  local reply
  read -r -p "$1 [Y/n] " reply
  [[ -z "$reply" || "$reply" =~ ^[Yy] ]]
}

node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

# Always the latest Node (nodejs.org/dist/latest): some dependencies need >= 20
# and newer is better. It goes to .node/ and first on PATH; the system Node is
# never touched. Offline, or if you decline, the system Node is used when it is
# >= $NODE_MIN.
ensure_node() {
  local base="https://nodejs.org/dist/latest" arch sums tarball
  case "$(uname -m)" in
    x86_64) arch=x64 ;;
    aarch64 | arm64) arch=arm64 ;;
    armv7l) arch=armv7l ;;
    *) arch="" ;;
  esac
  local system_ok=""
  command -v node >/dev/null && (( $(node_major) >= NODE_MIN )) && system_ok=1
  if [[ -n "$arch" ]] && command -v curl >/dev/null &&
    sums="$(curl -fsSL --max-time 20 "$base/SHASUMS256.txt" 2>/dev/null)" &&
    tarball="$(awk -v a="linux-$arch.tar.xz" '$2 ~ a"$" {print $2}' <<<"$sums" | head -n1)" &&
    [[ -n "$tarball" ]]; then
    local dir="$NODE_HOME/${tarball%.tar.xz}"
    if [[ ! -x "$dir/bin/node" ]]; then
      if confirm "Latest Node is ${tarball#node-}; system has $(node -v 2>/dev/null || echo none). Download it into $NODE_HOME (system untouched)?"; then
        say "node ${tarball%.tar.xz} -> $NODE_HOME"
        mkdir -p "$NODE_HOME"
        local tmp
        tmp="$(mktemp -d)"
        curl -fsSL "$base/$tarball" -o "$tmp/$tarball"
        [[ "$(sha256sum "$tmp/$tarball" | awk '{print $1}')" == "$(awk -v f="$tarball" '$2 == f {print $1}' <<<"$sums")" ]] ||
          die "checksum mismatch for $tarball"
        tar -xJf "$tmp/$tarball" -C "$NODE_HOME"
        rm -rf "$tmp"
      fi
    fi
    if [[ -x "$dir/bin/node" ]]; then
      export PATH="$dir/bin:$PATH"
      say "using node $(node -v)"
      return
    fi
  fi
  [[ -n "$system_ok" ]] ||
    die "Node >= $NODE_MIN is required (system: $(node -v 2>/dev/null || echo none)): install it from https://nodejs.org, or re-run with EXCALIDRAW_YES=1 to let this script fetch the latest into .node/"
  say "using system node $(node -v)"
}

build() {
  ensure_node
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
  ensure_node
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
  ensure_node
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

if [[ "$(id -u)" == 0 && -n "${SUDO_USER:-}" ]]; then
  die "run without sudo (sudo $0 would leave root-owned files and break the user service); it asks for sudo when it needs it"
fi

case "${1:-all}" in
  node) ensure_node; node -v ;;
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
