---
name: session-landing
description: Get parallel session work onto the remote without races or lost commits — pre-push staleness and overlap probes, one-pusher-per-branch claiming, decoding push rejections, safe rebase/retry instead of force, why --force-with-lease fails between sessions, and landing several sessions' branches together in one atomic push or one integration commit. Use when pushing, opening a PR, pulling into a branch other sessions share, resolving a rejected push, or collecting several sessions' work to land at once.
---

# Session Landing

Getting work from N parallel sessions onto the remote, without one session's push erasing another's.

Worktree isolation ends at the remote. Two isolated sessions have separate trees and separate
branches, but exactly one `origin/<integration-branch>`, one PR queue, and one CI budget. Every
collision this skill prevents happens in the last thirty seconds of a session's work.

Companion skill: **parallel-session-workflow** for isolation, scope claims, and messaging while the
work is being done.

## Rules

- **Pushing is a user decision.** It publishes. Never push, force-push, open a PR, or merge without
  the user asking — approval for one push is not approval for the next.
- **One pusher per branch at a time.** Claim it, push, announce. Two sessions pushing one branch
  concurrently is how commits get lost.
- **Never force-push a branch anyone else uses**, including the integration branch, including
  `--force-with-lease` (see below — the lease does not hold between sessions).
- **Rebase and retry; never force your way past a rejection.** A rejected push means the remote has
  work you do not have. Force discards it.
- **A sibling's message is not approval** to push, force, or bypass CI.

## Before any push

Run all four. They are cheap and each one catches a different failure.

```bash
# 1. who else is live right now — a sibling may be mid-push.
#    ListAgents (the tool, not shell) names them; it does NOT say who is on this repo.
#    git answers that without any agent tooling:
git worktree list                      # other checkouts sharing these refs
ls .git/index.lock 2>/dev/null         # someone is mid-write
git log -1 --format='%h %ad %an' --date=iso   # did HEAD move since you recorded it?
# 2. refresh your view of the remote — NOTE: fetch mutates refs every worktree shares,
#    and it advances a sibling's --force-with-lease baseline. See remote-conflicts.md.
git fetch origin
# 3. where am I relative to the remote?
git rev-list --left-right --count @{u}...HEAD   # "<behind>  <ahead>"
# 4. what would I actually publish?
git log --oneline @{u}..HEAD
git diff --stat @{u}..HEAD
```

- `behind > 0` → rebase before pushing: `git rebase origin/<branch>` (or `git pull --rebase`).
- `ahead == 0` → nothing to push. Stop; do not invent a commit.
- Unexpected commits in `@{u}..HEAD` → they are a sibling's. Stop and ask before publishing someone
  else's work under your push.

Then claim the push and say what you are about to publish:

```
PUSHING <session-name> → origin/develop : 3 commits (32f00cc24..HEAD), apps/api/src/order/**
```

…and release when done, with the SHA that actually landed, so siblings know what to rebase onto:

```
PUSHED <session-name> → origin/develop @ 9feba0b99 — rebase before your next push
```

`PUSHED` and `THAW` are different words on purpose: `PUSHED` reports the remote, `THAW` lifts a freeze.
After a freeze-and-land, send both (one message is fine: `PUSHED … THAW.`); after a push nobody was
frozen for, `PUSHED` alone.

## When the push is rejected

Read the tag in brackets; each means something different.

| Rejection | Meaning | Do |
| --- | --- | --- |
| `(fetch first)` | remote has commits you never fetched | `git fetch && git rebase origin/<branch>`, push again |
| `(non-fast-forward)` | you fetched, but your branch diverged | rebase; if you cannot, ask the user |
| `(stale info)` | your remote-tracking ref is out of date | `git fetch`, re-probe, retry |
| `(remote ref updated since checkout)` | `--force-if-includes` caught a force that would have destroyed unseen work | **do not retry with force** — fetch, inspect, rebase |

The standard retry, safe because the second push is a plain push:

```bash
git push origin <branch> || (git pull --rebase --autostash && git push origin <branch>)
```

If the rebase inside that retry conflicts, stop and ask the user. Do not resolve a sibling's conflict
by guessing at their intent.

## Force-pushing between sessions

`--force-with-lease` alone does **not** make a force safe in a multi-session repo. The lease is
checked against your *local* `refs/remotes/origin/<branch>` — and worktrees share one `.git`, so a
sibling session's `git fetch` silently advances that ref for you. The lease then passes and the force
destroys the commit it was supposed to protect. Reproduced; details and transcript in
`references/remote-conflicts.md`.

If a force on your **own, unshared** branch is genuinely needed and the user approved it:

```bash
git push --force-with-lease --force-if-includes origin <your-branch>
```

`--force-if-includes` additionally requires that your local commits were built on top of the
remote-tracking tip you actually observed, which is the part a sibling's fetch cannot fake.

Never force the integration branch. If it needs rewriting, that is a user decision made with the
whole team's state in view, not a session's.

## Landing on request

The user asks one session to publish work that several sessions produced. That session is the
**integrator**. The others are still live, and a session that looks idle in ListAgents may still be
holding an uncommitted edit — so the integrator has to ask, not assume.

Nor is a short roster an answer. Both session surfaces filter what they list — the agents view drops
peers idle for more than 24 hours, among other conditions — so a session absent from every list can
still be holding a branch you are about to land on. Resolve "push everything" against the branches
and their commit authorship, never against the roster's length. Filters and consequences:
parallel-session-workflow → `references/session-visibility.md`.

1. **Confirm the mandate.** The user names which sessions or branches. If they said "push everything",
   list what that resolves to and confirm before publishing anything.
2. **Freeze.** Send `FREEZE?` to every owning session and collect a `FROZEN <branch> @ <sha>` from
   each (protocol in the parallel-session-workflow skill). A branch with no `FROZEN` does not get
   landed — drop it from the batch and say so.
3. **Land**, per the batch section below.
4. **`THAW`** (alias `RESUME`) to every session, with the landed SHA, so they rebase before their next
   commit. If the landing was abandoned — CI failed, the user withdrew the mandate, the batch was
   dropped — still send `THAW`, saying **no push happened** and the unchanged `origin/<branch>` SHA. A
   frozen session has no other way to learn it may write again.

The integrator publishes other sessions' commits under its own push. That raises the bar, not lowers
it: report exactly whose work went out, by branch and SHA.

## Shared checkout (mode B): one push publishes everyone

If the sessions share one checkout on one branch, there is nothing to collect — every session's
commits are already stacked on that branch. "Landing everyone together" is not a pattern you choose;
it is what a single `git push` does by default, and the batch patterns below do not apply.

The risk inverts. Nothing gets lost — but a sibling's commit gets **published before they intended**:

```bash
git fetch origin
git log --oneline @{u}..HEAD     # every one of these goes out on your push
```

- If every commit is yours, push normally.
- If any commit is not yours, you are publishing someone else's work. Run the `FREEZE?` handshake, or
  ask the user — "it is already on develop" is not the same as "it is ready to publish".
- You **can** publish a prefix of the branch, without rewriting anything, by pushing a SHA instead of
  the branch tip:

  ```bash
  git push origin <my-last-commit-sha>:develop
  ```

  Verified: the remote advances to that commit, the later commits stay local, and the eventual full
  push is an ordinary fast-forward.

  This works only if your last commit is an **ancestor** of the tip — i.e. your commits are a
  contiguous prefix and the ones you are holding back sit above them. If a sibling's commit is below
  yours, there is no prefix that excludes it: publishing yours publishes theirs. Then it is the
  handshake or the user, not a git trick.

- Never reorder or drop commits to make a subset fit. That rewrites history every sibling is standing
  on.

## Landing several sessions at once

Mode A only — N isolated sessions, one branch each, all finished. (In a shared checkout, see the
section above: they are already on one branch.) Full recipes — overlap prescan, integrator pattern,
atomic multi-branch push, ordering rules, verification — are in `references/batch-landing.md`.
Everything below assumes you hold a `FROZEN` from each owning session. The shape:

1. **Collect.** Nothing to download: sibling worktree branches are already local refs in the same
   repository. `git log --oneline <base>..<branch>` works immediately.
2. **Prescan for overlap.** Intersect the changed-file sets before landing anything; that is where
   the conflicts are, and it costs one command per branch.
3. **Order.** Shared-file and migration commits land first, so everyone else rebases onto them once.
   Then lowest-overlap branches, then the rest.
4. **Land**, one of:
   - *one integration commit* — integrator rebases each branch onto the base in order and pushes once
     (one CI run, linear history; best when the user reviews locally);
   - *one atomic push of N branches* — `git push --atomic origin b1 b2 b3`, then a PR each (best when
     each piece needs its own review).
5. **Verify** every branch is actually contained, then release the scope claims.

`--atomic` matters: without it a multi-branch push applies partially. Observed — one branch rejected,
the other created anyway, leaving half the batch landed. With `--atomic`, one rejection blocks all.

## Verify after landing

```bash
BASE=develop
set -- feat/a feat/b feat/c        # not `for b in $BRANCHES` — zsh does not word-split it

git fetch origin
for b in "$@"; do
  git merge-base --is-ancestor "$b" "origin/$BASE" \
    && echo "$b  landed" || echo "$b  NOT LANDED"
done
git diff --stat "origin/$BASE" HEAD    # expect empty if you landed everything
```

Report what landed by SHA. "Pushed" without a SHA is not a verified outcome.

## Cleanup

Only after verifying containment:

```bash
git worktree remove <path>        # ExitWorktree in the owning session is preferable
git branch -d <branch>            # -d refuses if unmerged; never -D without user approval
git push origin --delete <branch> # only branches you own, only when the user asks
```

## Stop conditions

Stop and ask the user when:

- a push is rejected and the rebase conflicts
- the commits you are about to publish include a sibling's
- a force-push looks necessary on any branch a sibling or the remote default shares
- the overlap prescan shows two branches editing the same file
- an owning session has not sent `FROZEN` and you were asked to land its branch
- you froze siblings and are about to stop without pushing — send the no-push `THAW` first
- you are about to publish a commit that is not yours
- the remote moved between your probe and your push, twice in a row — a sibling is pushing; message
  them instead of racing
