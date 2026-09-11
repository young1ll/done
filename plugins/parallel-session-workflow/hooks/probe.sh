#!/bin/bash
# SessionStart hook: the repo probe from SKILL.md, run once so a session cannot miss the signals.
# Prints nothing when the checkout looks solo; prints one paragraph (into context) when it does not.
set -u
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
common=$(git rev-parse --git-common-dir 2>/dev/null); gitdir=$(git rev-parse --git-dir 2>/dev/null)
wt=$(( $(git worktree list 2>/dev/null | wc -l) - 1 )); [ "$wt" -lt 0 ] && wt=0
lock=$([ -e "$gitdir/index.lock" ] && echo 1 || echo 0)
live=(); stale=(); unknown=()
for f in "$common"/claims/*; do
  [ -e "$f" ] || continue
  pid=$(sed -n 's/^PID[[:space:]]\{1,\}//p' "$f" | head -1); n=$(basename "$f")
  if [ -z "$pid" ]; then unknown+=("$n")
  elif kill -0 "$pid" 2>/dev/null; then live+=("$n(pid $pid)")
  else stale+=("$n"); fi
done
others=0
if [ -d /tmp/cc-socks ]; then
  for s in /tmp/cc-socks/*.sock; do [ -S "$s" ] || continue; [ "$s" = "${CLAUDE_CODE_MESSAGING_SOCKET:-}" ] && continue; others=$((others+1)); done
fi
pw=""
rl="$(cd "$(dirname "$0")/.." && pwd)/skills/parallel-session-workflow/references/resource-lock.sh"
if [ -x "$rl" ]; then
  pwline=$(bash "$rl" playwright 2>/dev/null | grep -E '^(HELD|STALE)' | grep -v '\[me\]' | head -1)
  [ -n "$pwline" ] && pw="Playwright browser profile: $pwline"
fi
pwd_=""
PWH=${PW_HOME:-$HOME/.config/playwright-mcp}
if [ -f "$PWH/config.json" ]; then   # pw-daemon.sh has been set up on this machine
  port=${PW_MCP_PORT:-8931}
  (exec 3<>"/dev/tcp/localhost/$port") 2>/dev/null || pwd_="Playwright MCP daemon is configured but not listening on $port — browser tools will fail until: bash '$(cd "$(dirname "$0")/.." && pwd)/skills/parallel-session-workflow/references/pw-daemon.sh' start;"
fi
[ "$wt" -eq 0 ] && [ "$lock" -eq 0 ] && [ -z "$pw" ] && [ -z "$pwd_" ] && [ ${#live[@]} -eq 0 ] && [ ${#stale[@]} -eq 0 ] && [ ${#unknown[@]} -eq 0 ] && exit 0
mode=$([ "$gitdir" = "$common" ] && echo "this is the main checkout — mode B (shared) rules apply" || echo "this is a linked worktree — mode A")
out="parallel-session-workflow: parallel signals in $(basename "$(git rev-parse --show-toplevel)") —"
[ "$wt" -gt 0 ] && out="$out $wt other worktree(s);"
[ "$lock" -eq 1 ] && out="$out index.lock present (a sibling is mid-write);"
[ ${#live[@]} -gt 0 ] && out="$out live claims: ${live[*]};"
[ ${#stale[@]} -gt 0 ] && out="$out stale claims (owner gone): ${stale[*]};"
[ ${#unknown[@]} -gt 0 ] && out="$out claims without PID (cannot check): ${unknown[*]};"
[ -n "$pw" ] && out="$out $pw — send PLAYWRIGHT? to that socket before opening a browser;"
[ -n "$pwd_" ] && out="$out $pwd_"
root=${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}
out="$out $others other Claude session(s) on this machine. $mode. Invoke the parallel-session-workflow skill before your first git write; read claims with: bash '$root/skills/parallel-session-workflow/references/claims.sh' list"
echo "$out"
