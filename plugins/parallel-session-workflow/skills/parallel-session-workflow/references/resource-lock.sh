#!/bin/bash
# Who holds a machine resource that sessions share — answered from the OS, not by broadcasting "<RESOURCE>?".
#
#   resource-lock.sh playwright [--root <dir>]   # Playwright MCP browser profiles (Chrome SingletonLock)
#   resource-lock.sh owner <pid>                 # which agent session a process belongs to (walks ppid)
#
# Output, one line per profile:  FREE <profile> | HELD <profile> by session <pid> [me] socket=uds:... chrome=<pid>
#                                | STALE <profile> (lock -> dead pid <pid>)
# Exit: 0 free, 1 held by someone else, 2 stale lock, 3 held by me.
set -u
PATTERN=${RL_SESSION_PATTERN:-claude}     # what a session's command line contains
ME=${CLAUDE_PID:-$PPID}

owner_of() {  # print the nearest ancestor pid whose command matches $PATTERN, else nothing
  local p=$1 pp cmd
  while [ "$p" -gt 1 ] 2>/dev/null; do
    read -r pp cmd < <(ps -o ppid=,command= -p "$p" 2>/dev/null) || return 1   # read trims ps padding
    [ -z "$pp" ] && return 1
    case "$cmd" in *"$PATTERN"*) echo "$p"; return 0;; esac
    p=$pp
  done
  return 1
}

posix_lock_supported() {  # Chrome's SingletonLock symlink exists on macOS/Linux only
  case "$(uname -s 2>/dev/null)" in Darwin|Linux) return 0;; *) return 1;; esac
}

case "${1:-}" in
  owner) owner_of "${2:?pid}";;
  playwright)
    shift; root=${PSW_PLAYWRIGHT_ROOT:-}
    while [ $# -gt 0 ]; do case "$1" in --root) root=$2; shift 2;; *) shift;; esac; done
    if [ -z "$root" ]; then
      for cand in "$HOME/Library/Caches/ms-playwright-mcp" "${XDG_CACHE_HOME:-$HOME/.cache}/ms-playwright-mcp" "${LOCALAPPDATA:-}/ms-playwright-mcp"; do
        [ -n "$cand" ] && [ -d "$cand" ] && { root=$cand; break; }
      done
      [ -z "$root" ] && { echo "no Playwright MCP profile directory found (looked in macOS, XDG and LOCALAPPDATA locations)"; exit 0; }
    fi
    rc=0; any=0
    for d in "$root"/*/; do
      [ -d "$d" ] || continue; any=1; prof=$(basename "$d")
      case "$prof" in *chrome*|*chromium*|*msedge*|*edge*) ;; *) echo "UNKNOWN $prof (not a Chromium profile; no SingletonLock to read)"; continue;; esac
      posix_lock_supported || { echo "UNKNOWN $prof (SingletonLock is a POSIX symlink; on this OS ask with <RESOURCE>? instead)"; continue; }
      if [ ! -L "$d/SingletonLock" ]; then echo "FREE  $prof"; continue; fi
      target=$(readlink "$d/SingletonLock"); cpid=${target##*-}
      if ! kill -0 "$cpid" 2>/dev/null; then echo "STALE $prof (lock -> dead pid $cpid; remove $d/SingletonLock only if no Chrome is using the profile)"; rc=2; continue; fi
      s=$(owner_of "$cpid" || true)
      if [ -z "$s" ]; then echo "HELD  $prof by an unknown process tree (chrome pid $cpid)"; [ $rc -eq 0 ] && rc=1; continue; fi
      sock=""; [ -S "/tmp/cc-socks/$s.sock" ] && sock=" socket=uds:/tmp/cc-socks/$s.sock"
      if [ "$s" = "$ME" ]; then echo "HELD  $prof by session $s [me] chrome=$cpid"; rc=3
      else echo "HELD  $prof by session $s$sock chrome=$cpid"; [ $rc -eq 0 ] && rc=1; fi
    done
    [ $any -eq 0 ] && echo "no Playwright MCP profiles under $root"
    exit $rc;;
  *) sed -n '2,10p' "$0"; exit 2;;
esac
