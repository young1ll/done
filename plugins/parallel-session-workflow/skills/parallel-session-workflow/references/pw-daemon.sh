#!/bin/bash
# One Playwright MCP server for the whole machine, so N agent sessions never fight over one browser profile.
# Each session that connects gets its own isolated browser context, seeded from a storage-state file; the
# daemon launches Chrome itself with a CDP debug port so a login done by hand can be exported to that file.
# Measured behaviour and the reasoning: playwright-shared.md.
#
#   pw-daemon.sh start | stop | restart | status | export | log
#
# Environment (all optional):
#   PW_MCP_PORT=8931        MCP HTTP port  → register http://localhost:$PW_MCP_PORT/mcp (localhost, not 127.0.0.1)
#   PW_DEBUG_PORT=9333      Chrome remote-debugging port used only by `export`
#   PW_STATE=~/.config/playwright-mcp/state.json      storage-state every new context starts from
#   PW_HOME=~/.config/playwright-mcp                   config, pidfile, log
#   PW_HEADLESS=1           run Chrome headless (default headed, so a person can log in inside a session's window)
#   PW_MCP_PKG=@playwright/mcp@latest
set -u
PW_MCP_PORT=${PW_MCP_PORT:-8931}; PW_DEBUG_PORT=${PW_DEBUG_PORT:-9333}
PW_HOME=${PW_HOME:-$HOME/.config/playwright-mcp}; PW_STATE=${PW_STATE:-$PW_HOME/state.json}
PW_MCP_PKG=${PW_MCP_PKG:-@playwright/mcp@latest}
CFG="$PW_HOME/config.json"; PIDF="$PW_HOME/daemon.pid"; LOG="$PW_HOME/daemon.log"
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$PW_HOME"

listening() { (exec 3<>"/dev/tcp/localhost/$1") 2>/dev/null; }
alive() { [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; }

case "${1:-status}" in
  start)
    if alive; then echo "already running (pid $(cat "$PIDF")) on http://localhost:$PW_MCP_PORT/mcp"; exit 0; fi
    if listening "$PW_MCP_PORT"; then echo "port $PW_MCP_PORT is taken by something that is not our daemon" >&2; exit 1; fi
    [ -s "$PW_STATE" ] || printf '{"cookies":[],"origins":[]}\n' > "$PW_STATE"
    printf '{ "browser": { "launchOptions": { "args": ["--remote-debugging-port=%s"] } } }\n' "$PW_DEBUG_PORT" > "$CFG"
    mkdir -p "$PW_HOME/output"
    args=(--port "$PW_MCP_PORT" --isolated --storage-state "$PW_STATE" --config "$CFG" --output-dir "$PW_HOME/output")
    [ "${PW_HEADLESS:-0}" = 1 ] && args+=(--headless)
    cd "$PW_HOME" || exit 1
    nohup npx "$PW_MCP_PKG" "${args[@]}" >> "$LOG" 2>&1 < /dev/null &   # fully detached: a caller piping our output must not wait on the daemon
    echo $! > "$PIDF"
    for i in $(seq 1 60); do listening "$PW_MCP_PORT" && break; sleep 0.5; done
    if listening "$PW_MCP_PORT"; then
      echo "started pid $(cat "$PIDF") — MCP http://localhost:$PW_MCP_PORT/mcp, seed $PW_STATE, log $LOG"
      echo 'register once:  claude mcp add --transport http --scope user playwright http://localhost:'"$PW_MCP_PORT"'/mcp'
    else echo "did not come up in 30s — see $LOG" >&2; tail -5 "$LOG" >&2; exit 1; fi;;
  stop)
    if alive; then pid=$(cat "$PIDF"); pkill -TERM -P "$pid" 2>/dev/null; kill -TERM "$pid" 2>/dev/null; sleep 1; kill -0 "$pid" 2>/dev/null && kill -KILL "$pid"; rm -f "$PIDF"; echo "stopped $pid"; else rm -f "$PIDF"; echo "not running"; fi;;
  restart) "$0" stop; "$0" start;;
  status)
    if alive; then echo "RUNNING pid $(cat "$PIDF")  http://localhost:$PW_MCP_PORT/mcp"; else echo "STOPPED"; fi
    listening "$PW_MCP_PORT" && echo "  mcp port $PW_MCP_PORT: listening" || echo "  mcp port $PW_MCP_PORT: closed"
    if listening "$PW_DEBUG_PORT"; then
      n=$(curl -s "http://127.0.0.1:$PW_DEBUG_PORT/json/list" 2>/dev/null | grep -c '"type": *"page"')
      echo "  chrome debug port $PW_DEBUG_PORT: up, $n page(s) open"
    else echo "  chrome debug port $PW_DEBUG_PORT: closed (Chrome starts on the first browser call)"; fi
    [ -s "$PW_STATE" ] && echo "  seed $PW_STATE: $(grep -o '"name"' "$PW_STATE" | wc -l | tr -d ' ') cookie(s), $(date -r "$PW_STATE" '+%Y-%m-%d %H:%M' 2>/dev/null)";;
  export)
    listening "$PW_DEBUG_PORT" || { echo "Chrome debug port $PW_DEBUG_PORT is not up — open a page from any session first" >&2; exit 1; }
    tmp=$(mktemp) && node "$HERE/pw-state.mjs" "$PW_DEBUG_PORT" > "$tmp" && mv "$tmp" "$PW_STATE" \
      && echo "exported $(grep -o '"name"' "$PW_STATE" | wc -l | tr -d ' ') cookie(s) to $PW_STATE — sessions that connect from now on start with them; connected ones reconnect (/mcp)";;
  log) tail -n "${2:-40}" "$LOG";;
  *) sed -n '2,15p' "$0"; exit 2;;
esac
