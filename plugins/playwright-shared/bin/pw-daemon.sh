#!/bin/bash
# One Playwright MCP daemon for the whole machine. Every agent session that connects gets its own isolated
# browser context (own tabs), while pw-sync.mjs keeps cookies — and so logins — flowing between contexts.
# Nobody runs anything when they log in; nobody waits for a sibling to close a browser.
#
#   pw-daemon.sh start | stop | restart | status | log [n]
#   pw-daemon.sh install | uninstall     # start at login (launchd on macOS, systemd --user on Linux)
#   pw-daemon.sh disable | enable        # keep the hook and the service from starting it
#   pw-daemon.sh run                     # foreground supervisor (what the service runs)
#   pw-daemon.sh export                  # write the merged cookie jar to the seed file by hand (sync does this itself)
#
# Environment (optional): PW_MCP_PORT=8931  PW_DEBUG_PORT=9333  PW_HOME=~/.config/playwright-mcp
#   PW_STATE=$PW_HOME/state.json  PW_HEADLESS=1 (default headed so a person can log in in a session's window)
#   PW_MCP_PKG=@playwright/mcp@latest
set -u
PW_MCP_PORT=${PW_MCP_PORT:-8931}; PW_DEBUG_PORT=${PW_DEBUG_PORT:-9333}
PW_HOME=${PW_HOME:-$HOME/.config/playwright-mcp}; PW_STATE=${PW_STATE:-$PW_HOME/state.json}
PW_MCP_PKG=${PW_MCP_PKG:-@playwright/mcp@latest}
CFG="$PW_HOME/config.json"; LOG="$PW_HOME/daemon.log"; SLOG="$PW_HOME/sync.log"
PIDF="$PW_HOME/daemon.pid"; SPIDF="$PW_HOME/sync.pid"; SVPIDF="$PW_HOME/service.pid"
HERE=$(cd "$(dirname "$0")" && pwd); SELF="$HERE/$(basename "$0")"
LABEL=dev.young1ll.playwright-shared
mkdir -p "$PW_HOME/output"

listening() { (exec 3<>"/dev/tcp/localhost/$1") 2>/dev/null; }
alive() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }
wait_port() { for i in $(seq 1 "${1:-90}"); do listening "$PW_MCP_PORT" && return 0; sleep 0.5; done; return 1; }
stop_pid() { alive "$1" || { rm -f "$1"; return; }; p=$(cat "$1"); pkill -TERM -P "$p" 2>/dev/null; kill -TERM "$p" 2>/dev/null; sleep 1; kill -0 "$p" 2>/dev/null && kill -KILL "$p" 2>/dev/null; rm -f "$1"; }
prepare() {
  [ -s "$PW_STATE" ] || printf '{"cookies":[],"origins":[]}\n' > "$PW_STATE"
  printf '{ "browser": { "launchOptions": { "args": ["--remote-debugging-port=%s"] } } }\n' "$PW_DEBUG_PORT" > "$CFG"
  ARGS=(--port "$PW_MCP_PORT" --isolated --storage-state "$PW_STATE" --config "$CFG" --output-dir "$PW_HOME/output")
  [ "${PW_HEADLESS:-0}" = 1 ] && ARGS+=(--headless)
}
unit_path() { case "$(uname -s)" in Darwin) echo "$HOME/Library/LaunchAgents/$LABEL.plist";; *) echo "${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/$LABEL.service";; esac; }
installed() { [ -f "$(unit_path)" ]; }
svc_load()   { case "$(uname -s)" in Darwin) launchctl load "$(unit_path)" 2>/dev/null;; *) systemctl --user start "$LABEL" 2>/dev/null;; esac; return 0; }
svc_unload() { case "$(uname -s)" in Darwin) launchctl unload "$(unit_path)" 2>/dev/null;; *) systemctl --user stop "$LABEL" 2>/dev/null;; esac; return 0; }
kill_all() { installed && svc_unload; stop_pid "$SVPIDF"; stop_pid "$SPIDF"; stop_pid "$PIDF"; }

case "${1:-status}" in
  run)   # foreground supervisor: owns the MCP server and the sync sidecar, dies with them, cleans up after them
    [ -f "$PW_HOME/disabled" ] && { echo "disabled"; exec sleep 3600; }
    prepare; cd "$PW_HOME/output" || exit 1          # files saved by name land next to the timestamped ones
    echo $$ > "$SVPIDF"
    npx "$PW_MCP_PKG" "${ARGS[@]}" >> "$LOG" 2>&1 < /dev/null & echo $! > "$PIDF"
    node "$HERE/pw-sync.mjs" --port "$PW_DEBUG_PORT" --state "$PW_STATE" >> "$SLOG" 2>&1 < /dev/null & echo $! > "$SPIDF"
    cleanup() { stop_pid "$SPIDF"; stop_pid "$PIDF"; rm -f "$SVPIDF"; }
    trap 'cleanup; exit 0' TERM INT; trap cleanup EXIT
    wait "$(cat "$PIDF")";;
  start)
    [ -f "$PW_HOME/disabled" ] && { echo "disabled — run: $SELF enable" >&2; exit 1; }
    alive "$PIDF" && { echo "already running (pid $(cat "$PIDF")) on http://localhost:$PW_MCP_PORT/mcp"; exit 0; }
    listening "$PW_MCP_PORT" && { echo "port $PW_MCP_PORT is taken by something that is not our daemon" >&2; exit 1; }
    if installed; then svc_load; else nohup bash "$SELF" run > /dev/null 2>&1 < /dev/null & fi   # detached: a caller piping our output must not wait
    if wait_port; then echo "started (server $(cat "$PIDF" 2>/dev/null), sync $(cat "$SPIDF" 2>/dev/null)) — MCP http://localhost:$PW_MCP_PORT/mcp, home $PW_HOME"
    else echo "did not come up in 45s — see $LOG" >&2; tail -5 "$LOG" >&2; exit 1; fi;;
  stop)
    p=$(cat "$PIDF" 2>/dev/null); kill_all
    [ -n "$p" ] && echo "stopped $p" || echo "not running"
    installed && echo "note: the login service stays installed — 'start' loads it again, 'disable' keeps it down across logins";;
  restart) "$SELF" stop; "$SELF" start;;
  status)
    if alive "$PIDF"; then echo "RUNNING pid $(cat "$PIDF")  http://localhost:$PW_MCP_PORT/mcp"; else echo "STOPPED"; fi
    [ -f "$PW_HOME/disabled" ] && echo "  DISABLED (pw-daemon.sh enable to allow starts)"
    listening "$PW_MCP_PORT" && echo "  mcp port $PW_MCP_PORT: listening" || echo "  mcp port $PW_MCP_PORT: closed"
    alive "$SPIDF" && echo "  cookie sync: running (pid $(cat "$SPIDF"))" || echo "  cookie sync: not running"
    if listening "$PW_DEBUG_PORT"; then n=$(curl -s "http://127.0.0.1:$PW_DEBUG_PORT/json/list" 2>/dev/null | grep -c '"type": *"page"'); echo "  chrome debug port $PW_DEBUG_PORT: up, $n page(s) open"
    else echo "  chrome debug port $PW_DEBUG_PORT: closed (Chrome starts on the first browser call)"; fi
    [ -s "$PW_STATE" ] && echo "  seed $PW_STATE: $(grep -o '"name"' "$PW_STATE" | wc -l | tr -d ' ') cookie(s), $(date -r "$PW_STATE" '+%Y-%m-%d %H:%M' 2>/dev/null)"
    installed && echo "  login service: installed ($(unit_path))" || echo "  login service: not installed (pw-daemon.sh install)";;
  export)
    listening "$PW_DEBUG_PORT" || { echo "Chrome debug port $PW_DEBUG_PORT is not up — open a page from any session first" >&2; exit 1; }
    tmp=$(mktemp) && node "$HERE/pw-state.mjs" "$PW_DEBUG_PORT" > "$tmp" && mv "$tmp" "$PW_STATE" && echo "exported $(grep -o '"name"' "$PW_STATE" | wc -l | tr -d ' ') cookie(s) to $PW_STATE";;
  disable) touch "$PW_HOME/disabled"; kill_all; echo "disabled — hook and service will not start it until: $SELF enable";;
  enable)  rm -f "$PW_HOME/disabled"; installed && svc_load; echo "enabled";;
  install)
    NODE_BIN=$(dirname "$(command -v node)"); command -v npx >/dev/null || { echo "npx not found" >&2; exit 1; }
    u=$(unit_path)
    if [ "${2:-}" = "--print" ]; then u=$(mktemp "${TMPDIR:-/tmp}/pw-unit.XXXXXX"); else mkdir -p "$(dirname "$u")"; fi   # --print never touches the real unit
    case "$(uname -s)" in
      Darwin)
        cat > "$u" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$SELF</string><string>run</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$NODE_BIN:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string><key>HOME</key><string>$HOME</string><key>PW_HOME</key><string>$PW_HOME</string><key>PW_MCP_PORT</key><string>$PW_MCP_PORT</string><key>PW_DEBUG_PORT</key><string>$PW_DEBUG_PORT</string></dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$PW_HOME/service.log</string><key>StandardErrorPath</key><string>$PW_HOME/service.log</string>
</dict></plist>
PLIST
        ;;
      *)
        cat > "$u" <<UNIT
[Unit]
Description=Shared Playwright MCP daemon (playwright-shared)
[Service]
ExecStart=/bin/bash $SELF run
Restart=always
RestartSec=2
Environment=PATH=$NODE_BIN:/usr/local/bin:/usr/bin:/bin PW_HOME=$PW_HOME PW_MCP_PORT=$PW_MCP_PORT PW_DEBUG_PORT=$PW_DEBUG_PORT
[Install]
WantedBy=default.target
UNIT
        ;;
    esac
    [ "${2:-}" = "--print" ] && { cat "$u"; rm -f "$u"; exit 0; }
    [ -f "$PW_HOME/disabled" ] && echo "note: 'disabled' marker present — the service will idle until: $SELF enable"
    kill_all                                                        # whatever ran before (hand-started or an older unit)
    case "$(uname -s)" in Darwin) ;; *) systemctl --user daemon-reload && systemctl --user enable "$LABEL" >/dev/null 2>&1;; esac
    svc_load; echo "installed $u — starts at login, restarts if it dies"
    wait_port 120 || echo "not listening yet — the first start downloads @playwright/mcp; check: $SELF status" >&2
    "$SELF" status | head -1;;
  uninstall)
    kill_all; u=$(unit_path); case "$(uname -s)" in Darwin) ;; *) systemctl --user disable "$LABEL" 2>/dev/null;; esac
    rm -f "$u"; echo "uninstalled $u";;
  log) tail -n "${2:-40}" "$LOG"; echo "--- sync"; tail -n "${2:-10}" "$SLOG";;
  *) sed -n '2,15p' "$0"; exit 2;;
esac
