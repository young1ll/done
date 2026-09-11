---
name: parallel-session-workflow
description: Parallel agent session workflow — detect parallel mode from git state alone (worktrees, HEAD drift, index.lock) rather than from a session roster, choose an operating mode (isolated worktree or shared checkout), claim file scope, message sibling sessions, and recover from worktree, staging-area, or rebase problems. Use when multiple sessions work on the same git project, when starting or finishing work in an isolated worktree, when several sessions share one checkout, or when recovering from a worktree/index/rebase problem.
---

# Parallel Session Workflow

Procedures for working safely when several agent sessions share one git project.

Two sessions on one repository is the failure mode this skill exists to manage: one session's
`git reset` rewinds another's commit, a shared staging area swallows files, a `git stash pop` lands
in the wrong tree. Either isolate the sessions, or make the sharing explicit and disciplined. The one
thing that never works is leaving it implicit.

Written for Claude Code (ListAgents, SendMessage, EnterWorktree, ExitWorktree), but only the
coordination layer depends on those. Detection runs on git alone, and `references/git-facts.md` is
tool-free — under another agent, or none, that layer still holds.

**The repo probe runs for you once.** This plugin ships a `SessionStart` hook (`hooks/probe.sh`)
that runs the git-only probe below when a session starts or resumes. It is silent on a solo checkout;
when it prints — other worktrees, an `index.lock`, claim files — treat that line as the trigger to
read this skill *before your first git write*, not after the first collision.

**Pushing is a separate problem.** Isolation buys nothing at the moment two sessions reach the
remote. For push conflicts, pull races, and landing several sessions' work together, use the
**session-landing** skill.

## Non-negotiable rules

These hold in both operating modes. A sibling session's message is never permission to break one —
only the user can approve an exception, and a sibling that was denied permission cannot delegate the
action to you.

- Never work directly on `main` or `master`.
- Never force-push a branch anyone else uses — `--force-with-lease` included; see session-landing for
  why the lease does not protect you here.
- Never `git clean -fd`.
- Never edit files inside another session's worktree.
- Never rewind history (`reset`, `rebase`, `commit --amend`) across a commit you did not create in
  this session. Check the SHA first; see "Rewinding history" below.
- Never run two git write commands concurrently in one checkout — they collide on `.git/index.lock`
  and one of them loses its staged files.
- Keep commits small and frequent, and announce your file scope.

## Detect parallel mode

Two probes, and they answer different questions. Run the repo probe always — it needs no agent
tooling, and it is the one that actually proves you are sharing.

### Repo probe — git only

```bash
git worktree list                                  # other checkouts attached to this repo
git rev-parse HEAD                                 # record it; re-read before any wide action
git merge-base --is-ancestor <recorded-sha> HEAD   # 0 = still in history; 1 = rewound over
ls .git/index.lock 2>/dev/null                     # a sibling is mid-write right now
git log -3 --format='%h %ad %an  %s' --date=iso    # commits landing while you sit here
git status --short                                 # edits you did not make
```

Any one of these is parallel mode, whatever the session list says:

- more than one worktree, or a worktree you did not create
- `HEAD` differs from the SHA you recorded. Then the ancestor check tells you which kind: exit 0 is a
  sibling committing on top (normal), exit 1 means someone rewound over you — stop, and go to
  "A commit disappeared"
- `.git/index.lock` present while you are running no git command
- a commit timestamped inside your session that you did not make
- tracked modifications you did not make

### Session probe — the rosters

The **ListAgents tool** (not shell) names the live sessions you can message. It is the only thing
that gives you an *address*.

It does **not** report each session's working directory, so it cannot tell you which peers are on
this repository. The user has a surface that does — the agents view, `←` on an empty prompt, groups
by directory in one keystroke. When the repo probe is positive and the names matter, ask them to
read it rather than inferring repository membership from a list that carries none.

Neither roster is a boundary, and the failure is asymmetric. A long peer list is not proof of
parallel mode; a **short one is not proof of its absence**. Both surfaces filter — the agents view
drops peers that have been idle for more than 24 hours, among other conditions — and a session that
went quiet yesterday can still be sitting on an uncommitted edit in this working tree. Cross the
two: git says whether you are sharing, the roster says with whom.
Mechanics and the full filter: `references/session-visibility.md`.

- repo probe positive + sessions identified → parallel mode; coordinate by name
- repo probe positive + nobody addressable (another agent, or a human in another terminal) → still
  parallel mode. Coordinate through the user and apply mode B rules to every git write.
- repo probe clean + one session → solo; say so, and re-probe before wide actions
- still ambiguous after both → ask the user rather than guessing

Re-check before any wide-blast-radius action (rewinding history, touching a shared file, pushing).
The session list at minute 0 is not the session list at minute 40 — and neither is `HEAD`.

## Know which siblings can actually answer

`ListAgents` lists more kinds of session than you can hold a conversation with, and every protocol
below assumes a reply. Read the kind on each row before you depend on one.

| Row kind | Receives your message | Can reply | Usable for a `FREEZE?` handshake |
| --- | --- | --- | --- |
| interactive, this machine | yes | yes | yes |
| background job, this machine | yes | yes | yes — but nobody may be reading it |
| cloud | yes | **no** | **no** |
| Remote Control, `offline` | not now | not now | **no** |
| a subagent you spawned | yes | to its parent | it is not a peer — see below |

- **A cloud session cannot send `FROZEN`.** It receives your message and cannot message any session
  back. Never block a landing on a reply that cannot arrive: drop it from the batch and say so, the
  same as an unresolved `BUSY`.
- **A subagent is not a peer.** Its `SendMessage` goes out under the *parent session's* address and
  replies land in the parent's conversation, not the subagent's. The parent runs the handshake on
  their behalf; a subagent must not be asked to hold a claim.
- **`notify_when_idle` is local and main-conversation-only.** It does not reach cloud or Remote
  Control rows, and a subagent cannot subscribe.
- **Idle is not frozen** for any kind. It reports a finished turn, not a committed tree.
- **A row in the agents view is not a channel.** That view merges local jobs, adopted peers and
  remote sessions into one roster, each with its own filters, and lets you attach to some kinds and
  not others. Presence there says nothing about whether a `FREEZE?` can be answered — decide that
  from the table above, not from the row.

Filter the roster before you send. An unanswerable `FREEZE?` is indistinguishable from a session
ignoring you, and that difference decides whether you wait or proceed.

## Choose an operating mode

Decide once, explicitly, and say which mode you are in. The project's own convention wins over your
preference; if the repository or its CLAUDE.md mandates a mode, follow it and do not silently switch.

| | **A · Isolated** | **B · Shared checkout** |
| --- | --- | --- |
| Layout | one worktree + one branch per session | one directory, one branch, N sessions |
| Isolation from | working tree, index, HEAD | nothing — only path discipline |
| Costs | fresh checkout per session (deps, `.env`) | every git write is a shared-state mutation |
| Good when | independent tasks, review per branch | the user wants one branch as the single progress window |

Prefer **A** *when the choice is yours* — the harness enforces it, so its safety does not depend on
you remembering anything. But the choice is often not yours, and B is not the exotic case. You are in
B, chosen or not, when any of these hold:

- the project pins one integration branch and wants it as the single progress window
- your session was launched to work in place — background jobs commonly are
- you were already mid-task in the main checkout when a sibling appeared

Which one you are in is a fact you can read, not a preference (verified in `verify.sh`):

```bash
[ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ] \
  && echo "main checkout — mode B rules apply" \
  || echo "worktree — mode A"
```

B's safety is **entirely procedural**; nothing enforces it. Read `references/shared-checkout.md`
before your next git write.

You cannot fake mode B with worktrees — git refuses to check one branch out twice, so one branch
means one checkout (`references/git-facts.md`).

## Mode A — isolated worktree

The harness isolates natively and **enforces** it: inside a native worktree it refuses edits to the
main checkout and blocks a bash `cd` or git redirect that escapes. Take that rather than hand-rolling
`git worktree add`:

- at launch: `claude --worktree <task-name>`
- mid-session: the **EnterWorktree tool**
- file-editing subagents: `isolation: "worktree"` on the Agent tool

Do not re-derive what the harness already guarantees. Four things it does not do, and you must:

1. **Verify the base ref, in the one window where it is checkable.** `worktree.baseRef` defaults to
   `"fresh"` — the *remote default* branch. On a project that integrates on `develop`, that silently
   bases you on `main` and every diff you produce is wrong. Set `"head"` from the integration branch,
   and confirm the moment the worktree exists, before your first commit, while HEAD is still exactly
   the base:

   ```bash
   git rev-parse HEAD                          # must equal
   git rev-parse origin/<integration-branch>   # this
   ```

   Miss that window and there is no reliable after-the-fact test. Two plausible ones were tried and
   both failed on a real repository: `--is-ancestor origin/<integration> HEAD` reports a wrong base
   for a correct one as soon as the integration branch moves ahead, and comparing fork points against
   the default branch cannot separate them at all once a release has merged one into the other. If
   you are unsure later, rebase onto the integration branch and read what conflicts.
2. **Provision the checkout.** No `node_modules`, no untracked `.env`, no build cache. Install or
   copy before treating a failure as real.
3. **Claim your file scope** (below). Isolation prevents write collisions; it does not prevent two
   sessions redesigning the same file on two branches and colliding at merge.
4. **Name the session and the branch.** `claude -n <name>` / `/rename <name>` so siblings have an
   address; `feat/… fix/… refactor/… docs/… explore/…` so the branch says what it is.

Isolation stops at `.git`. The object store, every branch ref, remote-tracking refs, the stash stack
and config all stay shared — `references/git-facts.md` — and the remote is not isolated at all:
**session-landing**.

## Mode B — shared checkout

The working tree, the index, HEAD and the stash are all one copy. There is no isolation to fall back
on, so every rule here is load-bearing rather than advisory. Full mechanics and recipes:
`references/shared-checkout.md`.

- **Stage and commit by explicit path — both steps.** A bare `git commit` sweeps in whatever a sibling
  has staged, and `git add <path>` on its own does not scope the commit:
  `git add -- <my paths> && git commit -m "…" -- <my paths>`. The heredoc form keeps the pathspec too,
  verified in `verify.sh`: `git commit -q -F - -- <my paths> <<'EOF'`. Never `git add -A`,
  `git add .`, or `git commit -a`. Observed drift: sessions stage by path and then commit without one —
  that is the window in which a sibling's staged file rides along.
- **Serialize git writes.** Never issue two commits, or a commit and an `add`, in parallel Bash
  calls — they collide on `.git/index.lock` and the loser stages nothing while reporting nothing.
- **Never switch branches.** `git checkout` / `git switch` rewrites the working tree under every
  sibling at once, mid-edit.
- **Do not stash.** The stack is shared and a sibling's `pop` empties it (`references/git-facts.md`).
  Park work as a commit instead — that is also what a `FROZEN` reply should point at.
- **Re-read HEAD before acting on it.** A sibling can commit between two of your tool calls. Record
  `git rev-parse HEAD` after each of your commits and re-check before any wide action.
- **Commit early so ownership is legible.** Your uncommitted edits show up in a sibling's
  `git status`, and neither of you can tell whose lines are whose from `git diff` alone. History can
  answer that question; a shared working tree cannot.

## Claim your file scope

Overlapping edits are prevented by claims, not by good intentions. A claim has two carriers, and you
need both: a **message** so live siblings hear it now, and a **claim file** so a session that starts
after you — or one you have no address for — reads it later.

The message (`CLAIM` and `SCOPE` are the same verb; sessions use both):

```
SCOPE  <session-name>: apps/api/src/order/**, apps/web/src/app/(admin)/orders/**
BASE   develop @ 32f00cc24
MODE   A (worktree feat/order-substatus) | B (shared checkout)
```

On finish, release it, with the SHA that carries your work:

```
RELEASE <session-name>: apps/api/src/order/** — landed as 9feba0b99 on develop
```

### The claim file

Kept under `$(git rev-parse --git-common-dir)/claims/<session-name>` — the same directory from every
worktree, invisible to `git status`, and a survivor of `git clean -fdx` (all verified in
`references/verify.sh`; a `.claude/claims/` path fails the second test). `references/claims.sh` writes,
lists, lends, reaps and releases them:

```bash
CS="$CLAUDE_PLUGIN_ROOT/skills/parallel-session-workflow/references/claims.sh"   # or the path the hook printed
bash "$CS" list                                                   # read everyone's, with LIVE / STALE / UNKNOWN
bash "$CS" write <session-name> --mode B --scope 'apps/api/src/order/**' \
     --shared apps/web/src/features/field/column-view/business-column-view.tsx \
     --avoid  'apps/web/src/features/field/column-view/*'        # a sibling's area you will not enter
bash "$CS" lend   <session-name> <path> <to-session> "why"       # file-level loan, sibling edits it for now
bash "$CS" return <session-name> <path> <sha>                    # loan ended, at that commit
bash "$CS" release <session-name>
bash "$CS" reap                                                   # remove claims whose owner pid is gone
```

The format the script writes, and what each line means when you read a sibling's by hand:

| Line | Required | Meaning |
| --- | --- | --- |
| `SESSION` | yes | the name a `SendMessage` can reach |
| `SCOPE` (repeatable) | yes | paths only this session edits |
| `BASE` | yes | branch @ short SHA the claim was written on |
| `MODE` | yes | `A` (worktree) or `B` (shared checkout) |
| `PID`, `SOCKET` | yes | how liveness is checked; `SOCKET` is the session's messaging socket |
| `SINCE` | yes | when the claim was written |
| `SHARED` | no | a path you will edit only after notifying its owner, minimally, in its own commit |
| `AVOID` | no | a sibling's area you are explicitly staying out of |
| `LEND` / `RETURN` | no | a file handed to a sibling for a bounded change, and the SHA that ended the loan |
| `NOTE` | no | anything a reader needs before touching your area |

That table came from reading real claim files, not from design: after a week of shared-checkout work
the live ones had grown `SHARED`, `AVOID` and `LEND` lines by hand, because a static scope list cannot
describe two sessions editing one component from different sides. Write those lines when they are
true; a claim that says only `SCOPE` invites a sibling to guess.

### Stale claims

A claim outlives the session that wrote it, and nothing else removes it. `claims.sh list` classifies:

- **LIVE** — `kill -0 <pid>` succeeds (and the socket exists, when recorded). Honour it.
- **STALE** — the pid is gone. `claims.sh reap` removes it; say that you reaped it, and to whom.
- **UNKNOWN** — no `PID` line. It cannot be checked, so the script never reaps it. Report it to the
  user and ask before honouring or retiring it. Observed: a hand-written claim with no `PID` outlived
  its owner by two days because every session that read it treated it as live.

Before you touch a file outside your announced scope, re-run `claims.sh list` and ListAgents, and claim
it first. In mode A you can check what a sibling's branch already touches without any network, because
its branch is already a local ref:

```bash
git diff --name-only develop...<sibling-branch>
```

## Message vocabulary

One word first, then your name, then the payload — the recipient's human sees only the first line as a
preview. These are the words sessions actually converged on over a week of shared-checkout work; the
skill records them rather than inventing others.

| First word | Sent by | Means | Reply expected |
| --- | --- | --- | --- |
| `SCOPE` / `CLAIM` | anyone | I am taking these paths (see above) | `ACK`, or an objection |
| `RELEASE` | owner | done with these paths; carried by this SHA | none |
| `ACK` | anyone | I agree / I read it. First line says *what* you agree to | none |
| `FREEZE?` | integrator | stop writing; reply with your tip | `FROZEN` or `BUSY` |
| `FROZEN` | owner | tip SHA, nothing uncommitted; no writes until `THAW` | — |
| `BUSY` | owner | cannot stop cleanly; honest estimate | later `FROZEN` |
| `THAW` (alias `RESUME`) | integrator | write again. Carries the landed SHA — **or says no push happened** | none |
| `PUSHED` | pusher | what reached the remote, by SHA (session-landing) | none |
| `<RESOURCE>?` | anyone | I need a machine resource you may hold — see below | `<RESOURCE> FREE` |
| `<RESOURCE> FREE` | holder | released it; go ahead | none |
| `LEND` / `RETURN` | owner / borrower | file-level loan and its end, mirrored in the claim file | `ACK` |

### Resource locks

Git is not the only thing sessions share. On one machine there is one Playwright/Chrome profile, one
dev server port, one local database. Two sessions driving one browser profile fail with "profile in
use", and the fix is the same handshake as a freeze, named after the resource:

```
PLAYWRIGHT? from <me>: shared profile mcp-chrome-… is in use — if you hold it, send PLAYWRIGHT FREE when done
PLAYWRIGHT FREE — closed the browser (browser_close); yours now
```

Rules: the holder closes the resource *before* sending `FREE`; the asker does not open it until `FREE`
arrives; a `FREE` you did not ask for is still binding on the sender (they closed it). Any resource
name works — `DEVSERVER?`, `DB?` — as long as both sides use the same word.

### Freezing for a landing

When the user asks one session to publish several sessions' work, that session becomes the
integrator and needs the others to stop writing first. It cannot infer that from ListAgents — a
session can be idle in the tool list and still be holding an uncommitted edit. Ask:

```
FREEZE? from <integrator>: stop writing and reply FROZEN with your branch tip — landing
        feat/a, feat/b, feat/c onto develop. Commit or park what you have first.
FROZEN  <session-b>: feat/b @ 3f4c30e68 — nothing uncommitted
BUSY    <session-c>: feat/c — mid-edit, ~5 min, will send FROZEN
THAW    from <integrator>: rebase before your next commit — landed origin/develop @ 9feba0b99.
THAW    from <integrator>: no push — origin/develop unchanged @ 248bcfd33; resume git writes and tests.
```

Both `THAW` forms matter. A freeze that ends without a push is common (the user changed their mind,
CI failed, the batch was dropped) and a frozen session has no other way to learn that it may write
again. Never leave a sibling frozen by silence.

Rules for the integrator:

- **Filter the roster first.** Send `FREEZE?` only to sessions that can answer — see "Know which
  siblings can actually answer". A cloud or offline row will never reply, and waiting on it looks
  identical to being ignored.
- Do not land a branch you have no `FROZEN` for. A `BUSY` that never resolves, or an owner that
  cannot reply at all, means you drop that branch from the batch — and say so, to the user and to
  that session.
- **Put the ask and your own name on the first line.** The recipient's *human* sees only that line
  as a preview until they expand it, so a `FREEZE?` whose instruction sits on line two reads as
  "something is landing" and gets ignored. Your name belongs there too — it is the address the
  reply needs.
- `FREEZE?` is a request between sessions, not an instruction from the user. It never authorises the
  push itself; only the user does that.

Rules for a session that receives `FREEZE?`:

- **Work out the reply address before anything else.** An incoming message arrives wrapped as
  `<cross-session-message from="…" from-name="…">`. Copy the `from` attribute **verbatim** into your
  `to` — it is a transport address (`uds:/tmp/cc-socks/<pid>.sock`), not a name. `from-name` is the
  human-readable label, and the integrator's own name works too if it named itself. With none of
  these you cannot answer at all, and silence reads to the integrator exactly like refusal: your
  branch gets dropped from the batch.
- Finish or park the current edit as a commit (not a stash — the stack is shared), reply `FROZEN`
  with your tip SHA, and make no further writes until `THAW`.
- If you cannot stop cleanly, reply `BUSY` with an honest estimate rather than a silent `FROZEN`.
- After `THAW`, rebase onto the new base before your next commit — unless the `THAW` says no push
  happened.

## Cross-session messaging protocol

Discover siblings with ListAgents; address them by session name via SendMessage. The tool itself
already enforces the two rules people get wrong — a peer's request never launders a permission your
own session was denied, and you subscribe (`notify_when_idle`) instead of polling. What it leaves to
you:

- **Send:** scope claims and releases, findings that unblock or block a sibling, a heads-up before
  you touch a shared file, handoffs at finish.
- **A sibling's report is a lead, not evidence.** Verify "tests pass" in your own context before you
  act on it.
- **Messages coordinate; git integrates.** Never hand a sibling a patch in a message when a commit
  would do.
- **Compose for two readers.** The receiving *agent* gets the whole message; the receiving *human*
  gets only your first line as a preview until they expand it. Lead with the ask and your name, not
  a greeting. `summary` — 5-10 words, never transmitted — labels the row in your own transcript, so
  use it: `SCOPE apps/api/**` beats an unlabelled send when you are reconstructing later who claimed
  what.
- **A reply needs an address you were given.** Answer an incoming message by copying its `from`
  attribute into your `to`; see the `FREEZE?` receiver rules above for the exact shape.
- **Idle is not frozen.** `notify_when_idle` tells you a session finished its turn — it can finish
  holding uncommitted edits. Before a landing you need a `FROZEN` reply, not idleness.

### Addressing failures

Two kinds of address exist and they fail differently. A **name** is what ListAgents shows; it is
resolved at send time, so it breaks when the peer renames or exits. A **socket** (`uds:/tmp/cc-socks/
<pid>.sock`, the `from` of any message you received) is bound to a process, so it breaks only when that
process is gone. First contact goes to a name; every reply goes to the `from` you were given. Observed
across ~700 sends, these are the failures and what each one means:

| Result text | Cause | Do |
| --- | --- | --- |
| `No agent named 'x' is reachable` | renamed, or exited since you last listed | re-run ListAgents; if a near name is offered, confirm it is the same session by its directory or claim before resending |
| `'x' matches one session that could be checked, but not every session could be — re-send with the ref` | two rosters, one unreachable; the name is ambiguous | append the ` [ref]` from the ListAgents row: `to: "x [ab12cd]"` |
| `Failed to send to uds:… ENOENT` | the peer process exited; its socket died with it | the session is gone — its claim is stale (`claims.sh reap`), its `FROZEN` is void; tell the user |
| `InputValidationError … could not be parsed as JSON` on a subscribe-only send | an empty `message` with `notify_when_idle` breaks the encoder | always send a real first line; there is no free probe |
| delivered, no reply | peer is a cloud/offline row, or nobody is reading | see "Know which siblings can actually answer"; do not wait past what the task tolerates |

## Shared file rules

Treat these as high-risk, because two sessions editing them produces conflicts that no amount of
messaging prevents:

- package manifests: `package.json`, `Cargo.toml`, `pyproject.toml`
- lockfiles: `pnpm-lock.yaml`, `package-lock.json`, `Cargo.lock`
- config: `tsconfig.json`, `.env*`
- CI/CD: `.github/workflows/*`
- schema or migrations: `schema.prisma`, `migrations/`

Rules:

- Ask the user before changing a shared file.
- Isolate shared-file changes in their own commit, so it can land first and everyone else rebases
  onto it once.
- Update lockfiles only through the package manager.
- Schema or migration changes get exactly one owner session.

## Rewinding history

HEAD, refs and the reflog are shared across every worktree. Record `git rev-parse HEAD` after every
commit you make — that recorded SHA is the only thing that later distinguishes "a sibling built on
top of me" from "someone rewound over me".

Before any `reset`, `rebase -i`, or `commit --amend`, prove the range is yours. Both tests, and what
to do when the answer is bad, are in `references/git-facts.md`.

## Finish sequence

1. Commit all intended changes.
2. Fetch and rebase onto the integration branch (project convention; the remote default branch unless
   the project says otherwise):

   ```bash
   git fetch origin && git rebase origin/<integration-branch>
   ```

3. If conflicts occur, stop and ask the user.
4. Release your scope claim — `RELEASE` via SendMessage, and `claims.sh release <name>`.
5. To push, open a PR, or land several sessions at once → **session-landing skill**. Pushing is a
   user decision unless the user has already approved it.
6. Exit/clean up the worktree when done (ExitWorktree, or `git worktree remove <path>` for manual
   ones).

## Recovery index

Symptoms you will actually see, and where the recipe lives. All of them assume you do **not** improvise
on a shared repository.

| Symptom | Go to |
| --- | --- |
| a commit of yours is gone | `git-facts.md` → A commit disappeared (park it in a `rescue/` branch first) |
| `fatal: Unable to create '.git/index.lock'` | `git-facts.md` → `index.lock` exists |
| rebase stopped on a conflict | `git-facts.md` → Rebase conflict, then stop and ask |
| your commit swept in a sibling's files | `references/shared-checkout.md` → the index sweep |
| `git stash list` is empty / holds someone else's entry | `git-facts.md` → the stash stack is shared |
| `worktree add` refuses a branch | `git-facts.md` → one branch, one checkout |
| worktree records point at directories that are gone | `git-facts.md` → worktree records out of sync |
| a push was rejected | **session-landing** skill → decoding rejections |
| a claim file whose owner is gone, or with no `PID` | "Stale claims" above — `claims.sh reap` for STALE, the user for UNKNOWN |
| `No agent named …` / `re-send with the ref` / `ENOENT … .sock` | "Addressing failures" above |
| a browser profile / port / database is "in use" | "Resource locks" above — `<RESOURCE>?` handshake |
| a worktree is missing `node_modules` / `.env` | not a failure — provision it (mode A, step 2) |

## Stop conditions

Stop and ask the user when:

- you are on `main`/`master`, or in mode A without a worktree
- a rebase or merge conflict occurs
- a shared file or lockfile must change
- the commits you are about to rewind are not all yours
- the actual repo state does not match the plan
- you have failed three times on the same approach — re-plan instead of trying a fourth

Stopping is not the same as going quiet. If nobody may be reading — a background job, a session the
user has stepped away from — do everything the answer does not gate, park the rest as a commit rather
than a dirty tree or a stash, release or refresh your claim so a sibling is not blocked behind a
question only you can see, and state plainly what is waiting and on what.
