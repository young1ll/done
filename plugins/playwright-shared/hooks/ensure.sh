#!/bin/bash
# SessionStart: the shared Playwright daemon must be listening before this session's MCP client connects.
# Silent when it is. If it is not, start it (detached) and say so — this session reconnects with /mcp.
set -u
ROOT=${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}; D="$ROOT/bin/pw-daemon.sh"
PW_HOME=${PW_HOME:-$HOME/.config/playwright-mcp}; PORT=${PW_MCP_PORT:-8931}
(exec 3<>"/dev/tcp/localhost/$PORT") 2>/dev/null && exit 0
[ -f "$PW_HOME/disabled" ] && { echo "playwright-shared: daemon is disabled (pw-daemon.sh disable); browser tools are off until: bash '$D' enable"; exit 0; }
nohup bash "$D" start > /dev/null 2>&1 < /dev/null &
echo "playwright-shared: the shared Playwright daemon was not running — starting it now (the first start downloads @playwright/mcp, ~20s). Browser tools in this session connect after /mcp → reconnect playwright. To have it up before sessions start: bash '$D' install"
