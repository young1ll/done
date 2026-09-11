# done

Small, finished Claude Code plugins. Each one does its job and gets out of the way.

## Plugins

| Plugin | What it does |
| --- | --- |
| [parallel-session-workflow](./plugins/parallel-session-workflow) | Run several Claude Code sessions on one git repository without them colliding. |
| [session-landing](./plugins/session-landing) | Get those sessions' work onto the remote — safely, and several at once. |

## Install

```
/plugin marketplace add young1ll/done
/plugin install parallel-session-workflow@done
/plugin install session-landing@done
```

The two are designed as a pair: `parallel-session-workflow` covers the work, `session-landing` covers
the moment it reaches GitHub. Each also stands on its own.

## parallel-session-workflow

Two agent sessions on one repository is a quiet failure mode: one session's `git reset` rewinds
another's commit, a shared staging area swallows files, `git stash pop` restores someone else's work.

It covers:

- **A session-start probe hook** — the git-only probe runs when a session starts or resumes and
  prints one line when it finds other worktrees, an `index.lock`, or claim files. Silent when solo.
  This exists because the skill's own usage data showed sessions coordinating heavily without ever
  loading it: the trigger has to come from the repository, not from the model remembering.
- **Detecting parallel mode** — when to treat the environment as shared, and when to re-check.
  Also why neither session roster settles it: both filter what they list, so a short list is not
  an empty machine.
- **Two operating modes** — isolated worktree per session, or one shared checkout on one branch. Both
  are legitimate; each has its own safety rules, and the choice has to be explicit.
- **Worktree isolation** — entering one, picking the right base, and what a fresh worktree is missing.
  Also what a worktree does *not* isolate: refs, the stash, remote-tracking branches.
- **Shared-checkout discipline** — the index is shared, so `git add <path>` does not scope your
  commit; `.git/index.lock` collisions silently drop staged files; HEAD rewinds hit everyone.
- **Claim files with liveness** — `references/claims.sh` writes claims under
  `$(git rev-parse --git-common-dir)/claims/` (shared by every worktree, invisible to `git status`),
  lists them as LIVE / STALE / UNKNOWN by owner pid, records `SHARED` / `AVOID` / `LEND` lines for the
  cases a static scope list cannot express, and reaps the dead ones.
- **Message vocabulary** — the words sessions actually converged on: `SCOPE`/`CLAIM`, `RELEASE`, `ACK`,
  `FREEZE? / FROZEN / BUSY / THAW`, `PUSHED`, and a `<RESOURCE>? / <RESOURCE> FREE` lock for the things
  git does not cover (one browser profile, one dev server, one database per machine).
- **Resource-lock discovery** — `references/resource-lock.sh playwright` reads Chrome's `SingletonLock`
  in the Playwright MCP profile and walks the process tree to the session that holds it, so a session
  asks the one holder instead of broadcasting. The probe hook reports a held profile at start.
- **Sharing a browser without the lock** — `references/playwright-shared.md` measures every
  `@playwright/mcp` arrangement (per-session profile, CDP, HTTP daemon, isolated contexts) for tab
  isolation and login sharing; `references/pw-daemon.sh` runs the one-daemon arrangement
  (start/stop/status/export) and `references/pw-state.mjs` exports a login done by hand into the
  storage-state file every later session starts from.
- **Addressing failures** — names break on rename or exit, sockets break on exit; what each error
  text means and what to do.
- **Cross-session messaging** — what to send, and why a sibling's message is never permission to
  bypass a check.
- **Shared-file rules** — lockfiles, CI config, and migrations need an owner, not a conversation.
- **Recovery** — worktrees, rebase conflicts, index locks, the shared stash, and reflog rescue.

## session-landing

Isolation ends at the remote. Two isolated sessions still share one `origin/<branch>`, one PR queue,
and one CI budget.

It covers:

- **Pre-push probes** — staleness, what you would actually publish, and who else is live.
- **One pusher per branch** — a claim/release protocol, because two concurrent pushes lose commits.
- **Decoding rejections** — `(fetch first)`, `(non-fast-forward)`, `(stale info)`,
  `(remote ref updated since checkout)` each mean something different.
- **Why `--force-with-lease` is not a safeguard between sessions** — worktrees share `.git`, so a
  sibling's `git fetch` advances the very ref the lease is checked against, and the force goes
  through. Reproduced, with the transcript. `--force-if-includes` is the flag that actually holds.
- **Landing on request** — what a session does when the user tells it to publish several sessions'
  work: confirm the mandate, freeze the owners, land, then `THAW` everyone with their new base — or
  with an explicit "no push happened", so nobody stays frozen by silence.
- **Landing several sessions at once** — overlap prescan, landing order, an integrator loop that
  aborts cleanly on conflict, and `git push --atomic` so a multi-branch push cannot land halfway.
- **Shared checkouts** — where one push publishes every session's commits, so the risk is premature
  publication rather than loss, and `git push origin <sha>:<branch>` publishes only a prefix.
- **Verification** — containment checks, and reporting by SHA rather than by hope.

Commands in both plugins are written for zsh as well as bash, since that is the default shell on
macOS and its word-splitting rules break the obvious `for b in $BRANCHES` form.

## Requirements and portability

- **Shell:** bash (the hook and the `references/*.sh` scripts). zsh users are covered — the scripts
  are invoked with `bash`, and the documented snippets avoid zsh word-splitting traps.
- **OS:** macOS and Linux are exercised by `verify.sh`. Windows is untested; `resource-lock.sh`
  answers `UNKNOWN` there because Chromium's lock is not a symlink.
- **Tools:** git ≥ 2.28 (`init -b`), `ps`, `readlink`; Node ≥ 22 only for `pw-state.mjs`.
- **Harness variables:** `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PROJECT_DIR`, `CLAUDE_PID`,
  `CLAUDE_CODE_MESSAGING_SOCKET` are used when present and every script degrades without them
  (claims fall back to the shell's parent pid; the session count reads 0). `RL_SESSION_PATTERN`
  names another agent CLI's process for the lock walker.
- **Nothing in the skills is project-specific.** Paths in examples are placeholders; the measurements
  quoted as evidence came from one team's repository and are labelled as such.

## Verifying a change

`plugins/parallel-session-workflow/skills/parallel-session-workflow/references/verify.sh` re-runs every
executable claim both skills make — git semantics, claim files, the pathspec commit form, `claims.sh`,
the probe hook — in a throwaway repository. Run it before editing either skill; if it fails on a newer
git, the document is what is wrong.

## License

MIT
