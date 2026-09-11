#!/bin/bash
# Checks that need neither network nor Chrome. Usage: bash verify.sh
set -u
H=$(cd "$(dirname "$0")" && pwd); R=$(mktemp -d "${TMPDIR:-/tmp}/pws-verify.XXXXXX") || exit 1; trap 'rm -rf "$R"' EXIT
pass=0; fail=0; ok(){ if [ "$1" = "$2" ]; then echo "  PASS  $3"; pass=$((pass+1)); else echo "  FAIL  $3 (got '$1' want '$2')"; fail=$((fail+1)); fi; }
bash -n "$H/pw-daemon.sh"; ok "$?" "0" "pw-daemon.sh parses"
bash -n "$H/../hooks/ensure.sh"; ok "$?" "0" "ensure.sh parses"
node --check "$H/pw-sync.mjs"; ok "$?" "0" "pw-sync.mjs parses"
node --check "$H/pw-state.mjs"; ok "$?" "0" "pw-state.mjs parses"
for f in "$H/../.mcp.json" "$H/../hooks/hooks.json" "$H/../.claude-plugin/plugin.json"; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))"; ok "$?" "0" "$(basename "$f") is JSON"; done
o=$(PW_HOME="$R/h" PW_MCP_PORT=1 bash "$H/pw-daemon.sh" status); case "$o" in STOPPED*) ok y y "status: STOPPED with a fresh PW_HOME";; *) ok "$o" "STOPPED…" "status: STOPPED with a fresh PW_HOME";; esac
[ -d "$R/h/output" ] && ok y y "PW_HOME/output is created" || ok n y "PW_HOME/output is created"
touch "$R/h/disabled"; o=$(PW_HOME="$R/h" PW_MCP_PORT=1 bash "$H/pw-daemon.sh" start 2>&1); ok "$?" "1" "start refuses while disabled"
o=$(PW_HOME="$R/h" PW_MCP_PORT=1 CLAUDE_PLUGIN_ROOT="$H/.." bash "$H/../hooks/ensure.sh"); case "$o" in *disabled*) ok y y "hook: reports disabled instead of starting";; *) ok "$o" "…disabled…" "hook: reports disabled instead of starting";; esac
rm "$R/h/disabled"
o=$(PW_HOME="$R/h" PW_DEBUG_PORT=1 bash "$H/pw-daemon.sh" export 2>&1); ok "$?" "1" "export refuses when the debug port is down"
export HOME="$R/home"; mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.config/systemd/user"   # never touch the operator's real unit
o=$(PW_HOME="$R/h" bash "$H/pw-daemon.sh" install --print); case "$o" in *"pw-daemon.sh"*run*) ok y y "install --print renders a unit that runs 'pw-daemon.sh run'";; *) ok "$o" "…run…" "install --print renders a unit";; esac
u="$HOME/Library/LaunchAgents/dev.young1ll.playwright-shared.plist"; [ "$(uname -s)" = Darwin ] || u="$HOME/.config/systemd/user/dev.young1ll.playwright-shared.service"
echo keep > "$u"; PW_HOME="$R/h" bash "$H/pw-daemon.sh" install --print >/dev/null; ok "$(cat "$u")" "keep" "install --print leaves an existing unit untouched (regression: it used to delete it)"
echo; echo "$pass passed, $fail failed"; [ "$fail" -eq 0 ]
