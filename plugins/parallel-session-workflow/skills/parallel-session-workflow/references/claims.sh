#!/bin/bash
# Claim files for parallel sessions on one git repository.
# Location: $(git rev-parse --git-common-dir)/claims/<session-name>
#   — same directory from every worktree, invisible to git status, survives git clean -fdx.
#
# usage:
#   claims.sh write   <name> [--mode A|B] [--base <ref>] [--scope <glob>]... [--shared <path>]... [--avoid <path>]...
#   claims.sh list                      # every claim, with LIVE / STALE / UNKNOWN
#   claims.sh lend    <name> <path> <to-session> [note]
#   claims.sh return  <name> <path> [sha]
#   claims.sh release <name>
#   claims.sh reap                      # remove STALE claims (owner pid gone); UNKNOWN are reported, never removed
#
# Liveness: PID via kill -0, plus SOCKET (/tmp/cc-socks/<pid>.sock) when the owner is a Claude Code
# session. A claim without a PID line cannot be checked — it is UNKNOWN, and only the user can retire it.
set -u
cmd=${1:-help}; [ $# -gt 0 ] && shift
C="$(git rev-parse --git-common-dir 2>/dev/null)/claims" || { echo "not a git repository" >&2; exit 2; }
mkdir -p "$C"

field() { sed -n "s/^$2[[:space:]]\{1,\}//p" "$1" | head -1; }

status_of() {  # LIVE | STALE | UNKNOWN
  local pid sock
  pid=$(field "$1" PID); sock=$(field "$1" SOCKET)
  [ -z "$pid" ] && { echo UNKNOWN; return; }
  if kill -0 "$pid" 2>/dev/null; then
    if [ -n "$sock" ] && [ ! -S "$sock" ]; then echo STALE; else echo LIVE; fi
  else echo STALE; fi
}

case "$cmd" in
  write)
    name=${1:?session name}; shift
    mode=B; base=$(git rev-parse --abbrev-ref '@{u}' 2>/dev/null || git branch --show-current)
    scopes=(); shared=(); avoid=()
    while [ $# -gt 0 ]; do
      case "$1" in
        --mode) mode=$2; shift 2;; --base) base=$2; shift 2;;
        --scope) scopes+=("$2"); shift 2;; --shared) shared+=("$2"); shift 2;; --avoid) avoid+=("$2"); shift 2;;
        *) scopes+=("$1"); shift;;
      esac
    done
    [ ${#scopes[@]} -eq 0 ] && { echo "at least one --scope" >&2; exit 2; }
    f="$C/$name"
    [ -e "$f" ] && [ "$(status_of "$f")" = LIVE ] && [ "$(field "$f" PID)" != "${CLAUDE_PID:-$PPID}" ] \
      && { echo "refusing: $f belongs to a live session (pid $(field "$f" PID))" >&2; exit 3; }
    {
      echo "SESSION $name"
      for s in "${scopes[@]}"; do echo "SCOPE   $s"; done
      for s in "${shared[@]}"; do echo "SHARED  $s"; done
      for s in "${avoid[@]}";  do echo "AVOID   $s"; done
      echo "BASE    $base @ $(git rev-parse --short HEAD 2>/dev/null)"
      echo "MODE    $mode"
      echo "PID     ${CLAUDE_PID:-$PPID}"
      [ -n "${CLAUDE_CODE_MESSAGING_SOCKET:-}" ] && echo "SOCKET  $CLAUDE_CODE_MESSAGING_SOCKET"
      echo "SINCE   $(date '+%Y-%m-%d %H:%M')"
    } > "$f"
    echo "wrote $f"; cat "$f";;
  list)
    n=0
    for f in "$C"/*; do
      [ -e "$f" ] || continue; n=$((n+1))
      printf '%-8s %s  (pid %s, since %s)\n' "$(status_of "$f")" "$(basename "$f")" "$(field "$f" PID)" "$(field "$f" SINCE)"
      sed -E -n 's/^(SCOPE|SHARED|AVOID|LEND|RETURN)/    \1/p' "$f"
    done
    [ $n -eq 0 ] && echo "no claims in $C"; exit 0;;
  lend)
    name=${1:?name}; path=${2:?path}; to=${3:?to-session}; note=${4:-}
    echo "LEND    $path -> $to ($(date '+%Y-%m-%d %H:%M'))${note:+ $note}" >> "$C/$name"; tail -1 "$C/$name";;
  return)
    name=${1:?name}; path=${2:?path}; sha=${3:-}
    echo "RETURN  $path${sha:+ @ $sha} ($(date '+%Y-%m-%d %H:%M'))" >> "$C/$name"; tail -1 "$C/$name";;
  release)
    name=${1:?name}; rm -f "$C/$name" && echo "released $name";;
  reap)
    for f in "$C"/*; do
      [ -e "$f" ] || continue
      case "$(status_of "$f")" in
        STALE)   echo "reaped  $(basename "$f") (pid $(field "$f" PID) gone)"; rm -f "$f";;
        UNKNOWN) echo "kept    $(basename "$f") — no PID line; ask the user before retiring it";;
      esac
    done;;
  *) sed -n '2,15p' "$0"; exit 2;;
esac
