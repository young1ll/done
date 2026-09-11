#!/bin/bash
# Re-verify every executable claim these skills make, in a throwaway repository.
# Touches nothing outside its own temp directory. Usage: bash verify.sh
set -u
R=$(mktemp -d "${TMPDIR:-/tmp}/psw-verify.XXXXXX") || exit 1
trap 'rm -rf "$R"' EXIT
cd "$R" || exit 1
pass=0; fail=0
ok(){ if [ "$1" = "$2" ]; then echo "  PASS  $3"; pass=$((pass+1)); else echo "  FAIL  $3 (got '$1' want '$2')"; fail=$((fail+1)); fi; }

git init -q -b main repo && cd repo && git config user.email t@t && git config user.name t
echo a > a.txt; git add a.txt; git commit -qm c1
git checkout -q -b develop; echo b > b.txt; git add b.txt; git commit -qm c2

echo "== one branch, one checkout =="
out=$(git worktree add ../wt-dev develop 2>&1); ok "$?" "128" "worktree add on a checked-out branch fails"
case "$out" in *"already used by worktree"*) ok y y "message names the holding worktree";; *) ok n y "message names the holding worktree";; esac

echo "== --is-ancestor semantics =="
H=$(git rev-parse HEAD); P=$(git rev-parse HEAD~1)
git merge-base --is-ancestor "$H" "$H"; ok "$?" "0" "a commit IS an ancestor of itself (exit 0 != 'moved')"
git merge-base --is-ancestor "$P" "$H"; ok "$?" "0" "true ancestor exits 0"
git merge-base --is-ancestor "$H" "$P"; ok "$?" "1" "non-ancestor exits 1 (this is the rewind signal)"

echo "== worktree isolation boundary =="
git worktree add -q -b feat/x ../wt-x >/dev/null 2>&1; ok "$?" "0" "worktree on a new branch succeeds"
m_dir=$(git rev-parse --git-dir); m_common=$(git rev-parse --git-common-dir)
ok "$m_dir" "$m_common" "main checkout: --git-dir == --git-common-dir"
w_dir=$(cd ../wt-x && git rev-parse --git-dir); w_common=$(cd ../wt-x && git rev-parse --git-common-dir)
[ "$w_dir" != "$w_common" ] && ok y y "worktree: --git-dir != --git-common-dir" || ok n y "worktree: --git-dir != --git-common-dir"
git diff --name-only develop...feat/x >/dev/null 2>&1; ok "$?" "0" "sibling branch diffs with no network"

echo "== the stash stack is shared =="
echo wip >> a.txt; git stash push -q -u -m owner-tag; ok "$?" "0" "stash created in main checkout"
n=$(cd ../wt-x && git stash list | wc -l | tr -d ' '); ok "$n" "1" "sibling worktree sees it (refs/stash is one ref)"
(cd ../wt-x && git stash pop -q >/dev/null 2>&1)
n=$(git stash list | wc -l | tr -d ' '); ok "$n" "0" "sibling's pop emptied the owner's stack"
git checkout -q -- . 2>/dev/null; echo wip2 >> a.txt; git stash push -q -u -m tag2
sha=$(git stash list --format='%H' | head -1)
git stash apply -q "$sha" >/dev/null 2>&1; ok "$?" "0" "apply <sha> works"
n=$(git stash list | wc -l | tr -d ' '); ok "$n" "1" "apply does NOT consume the entry (pop would)"
git checkout -q -- .; git stash drop -q >/dev/null 2>&1

echo "== reflog rescue =="
echo d > d.txt; git add d.txt; git commit -qm doomed; D=$(git rev-parse HEAD)
git reset -q --hard HEAD~1
git cat-file -e "$D" 2>/dev/null; ok "$?" "0" "object survives reset --hard"
git reflog --date=iso | grep -q "${D:0:7}"; ok "$?" "0" "reachable from the reflog"
git branch "rescue/x" "$D" >/dev/null 2>&1; ok "$?" "0" "git branch rescue/<n> <sha> parks it"

echo "== conflict handling =="
(cd ../wt-x && echo mine > b.txt && git add b.txt && git commit -qm mine)
echo theirs > b.txt; git add b.txt; git commit -qm theirs
pre=$(cd ../wt-x && git rev-parse HEAD)   # pre-REBASE, not pre-commit
(cd ../wt-x && git rebase develop >/dev/null 2>&1)
u=$(cd ../wt-x && git diff --name-only --diff-filter=U | wc -l | tr -d ' '); ok "$u" "1" "--diff-filter=U lists conflicted paths"
(cd ../wt-x && git rebase --abort >/dev/null 2>&1); ok "$?" "0" "rebase --abort succeeds"
post=$(cd ../wt-x && git rev-parse HEAD); ok "$post" "$pre" "abort restored the pre-rebase HEAD"

echo "== claim files under --git-common-dir =="
C=$(git rev-parse --git-common-dir)/claims; mkdir -p "$C"
echo "SCOPE session-a: src/**" > "$C/session-a"
n=$(cd ../wt-x && cat "$(git rev-parse --git-common-dir)/claims/session-a" 2>/dev/null | wc -l | tr -d ' ')
ok "$n" "1" "sibling worktree reads the claim, no messaging"
s=$(git status --porcelain | wc -l | tr -d ' '); ok "$s" "0" "claim is invisible to git status"
git clean -fdx -q >/dev/null 2>&1
[ -f "$C/session-a" ] && ok y y "claim survives git clean -fdx" || ok n y "claim survives git clean -fdx"
mkdir -p .claude/claims && echo x > .claude/claims/s
s=$(git status --porcelain | wc -l | tr -d ' '); ok "$s" "1" "a working-tree claim would pollute git status (rejected)"

echo "== pathspec commit with a heredoc message (-F - -- <paths>) =="
echo s1 > s1.txt; echo s2 > s2.txt; git add s1.txt s2.txt          # s2 plays the sibling's staged file
git commit -q -F - -- s1.txt <<'MSG'
scoped commit, message from stdin
MSG
ok "$?" "0" "git commit -F - -- <path> <<heredoc succeeds"
n=$(git show --format= --name-only HEAD | wc -l | tr -d ' '); ok "$n" "1" "only the pathspec file was committed"
git diff --cached --name-only | grep -q s2.txt; ok "$?" "0" "the sibling's staged file is still staged, untouched"
git commit -q -m "drain" -- s2.txt

echo "== claims.sh =="
CS="$(dirname "$0")/claims.sh"
CLAUDE_PID=$$ bash "$CS" write me --mode B --scope 'src/**' --shared package.json >/dev/null; ok "$?" "0" "write creates a claim"
grep -q "^PID     $$" "$C/me"; ok "$?" "0" "PID line carries the session pid"
grep -q "^SINCE" "$C/me"; ok "$?" "0" "SINCE line present"
printf 'SESSION ghost\nSCOPE   x/**\nPID     2147483000\nSINCE   2000-01-01 00:00\n' > "$C/ghost"
printf 'SESSION nopid\nSCOPE   y/**\n' > "$C/nopid"
l=$(bash "$CS" list); echo "$l" | grep -q "^LIVE     me"; ok "$?" "0" "list: live owner → LIVE"
echo "$l" | grep -q "^STALE    ghost"; ok "$?" "0" "list: dead pid → STALE"
echo "$l" | grep -q "^UNKNOWN  nopid"; ok "$?" "0" "list: no PID line → UNKNOWN"
echo "$l" | grep -q "    SHARED  package.json"; ok "$?" "0" "list prints SHARED lines"
CLAUDE_PID=$$ bash "$CS" lend me src/a.ts peer >/dev/null; grep -q "^LEND    src/a.ts -> peer" "$C/me"; ok "$?" "0" "lend appends a LEND line"
r=$(bash "$CS" reap); [ ! -e "$C/ghost" ] && ok y y "reap removes STALE" || ok n y "reap removes STALE"
[ -e "$C/nopid" ] && ok y y "reap keeps UNKNOWN" || ok n y "reap keeps UNKNOWN"
[ -e "$C/me" ] && ok y y "reap keeps LIVE" || ok n y "reap keeps LIVE"
bash "$CS" release me >/dev/null; [ ! -e "$C/me" ] && ok y y "release removes the claim" || ok n y "release removes the claim"
rm -f "$C/nopid"

echo "== SessionStart probe hook =="
PROBE="$(dirname "$0")/../../../hooks/probe.sh"
git init -q -b main ../solo && (cd ../solo && git config user.email t@t && git config user.name t && git commit -q --allow-empty -m init)
o=$(cd ../solo && CLAUDE_PROJECT_DIR=$PWD bash "$PROBE"); ok "$o" "" "solo checkout: probe prints nothing"
o=$(CLAUDE_PROJECT_DIR=$PWD bash "$PROBE"); case "$o" in *"other worktree"*"mode B"*) ok y y "shared checkout with a worktree: probe reports and names mode B";; *) ok "$o" "…other worktree…mode B…" "shared checkout with a worktree: probe reports and names mode B";; esac

echo "== worktree prune is non-destructive while dirs exist =="
before=$(git worktree list | wc -l | tr -d ' '); git worktree prune
after=$(git worktree list | wc -l | tr -d ' '); ok "$after" "$before" "prune removed no live records"

echo
echo "git $(git --version | awk '{print $3}')  —  $pass passed, $fail failed"
[ "$fail" -eq 0 ]
