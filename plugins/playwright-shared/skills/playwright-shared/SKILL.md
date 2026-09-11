---
name: playwright-shared
description: How browser tools behave when Playwright runs as one shared daemon for the machine (the playwright-shared plugin) — what is isolated per session and what is shared, why no lock or hand-over is needed, the screenshot filename rule, and what to do when browser tools fail with ECONNREFUSED or a login seems missing. Use when using Playwright browser tools while other sessions may be doing the same, when a browser tool call fails to connect, or when checking or explaining the shared Playwright setup.
---

# Playwright, shared

With this plugin installed there is **one** Playwright MCP daemon on the machine and every session is a
client of it. You never wait for a sibling to close a browser, and you never ask for one.

| Per session (isolated) | Shared across sessions |
| --- | --- |
| browser context, its tabs, `browser_tabs` list, `browser_close` | cookies — and so logins and logouts — synced within ~2 s |
| localStorage, sessionStorage, IndexedDB | the daemon's Chrome process and its output directory |
| console messages, dialogs, downloads | the storage-state seed every new session starts from |

## Rules

1. **Do not run a hand-over protocol for the browser.** There is no profile lock. `PLAYWRIGHT?` /
   `PLAYWRIGHT FREE` from the parallel-session-workflow skill applies to the old one-server-per-session
   setup, not here.
2. **Name your screenshots and saved files.** Default names are millisecond timestamps in one shared
   directory, which collide when sessions screenshot together (measured with rootless clients: 4
   screenshots → 2 files). Always pass `filename`, prefixed with your session name:
   `browser_take_screenshot { filename: "<session-name>-orders-after-fix.png" }`. The image also comes
   back inline, so what you *see* is always yours; the rule protects the path you hand to a person.
   Where it lands depends on the client: Claude Code hands the daemon its working directory as an MCP
   root, so a relative `filename` is written under *your* project directory (`.playwright-mcp/` by
   convention) and an absolute one where you said. Only the unnamed, timestamped snapshots fall into
   the daemon's shared `~/.config/playwright-mcp/output/` — and those you never hand to anyone.
3. **Logins propagate by themselves.** If a page shows a login form, either nobody is logged in yet or
   the session expired — log in (or ask the user to, in your window), and every other session is logged
   in within a tick. Do not tell the user to run anything. A logout propagates the same way, so say so
   before logging out while siblings are working.
4. **Same login, same server-side session.** Two sessions acting as one user in one app can still
   collide *in the app* (editing the same record, single-session limits). That is application state,
   not browser contention — coordinate it with a `SCOPE`/`<RESOURCE>?` message like any shared resource.
5. **Close your page when your check is done.** It costs nothing (the login stays in the jar) and keeps
   the user's screen — every context opens a visible window — from filling with stale tabs.

## When a browser tool fails

| Symptom | Meaning | Do |
| --- | --- | --- |
| `connect ECONNREFUSED 127.0.0.1:8931` / server not connected | the daemon is not up (first session on a fresh machine, or it was stopped) | the SessionStart hook has started it; run `/mcp` and reconnect `playwright`, then retry. If it stays down: `bash "$CLAUDE_PLUGIN_ROOT/bin/pw-daemon.sh" status` |
| tools exist but every call errors after a while | Chrome died; the daemon relaunches it on the next call | retry once |
| a login you expect is missing | you connected before it happened and the tick has not run, or the app keeps its login outside cookies | wait a second and reload; if the app uses localStorage for auth, this plugin does not cover it — say so |
| a sibling's file path in a screenshot result | you did not pass `filename` | rule 2 |

## Checking the setup

```bash
D="$CLAUDE_PLUGIN_ROOT/bin/pw-daemon.sh"
bash "$D" status      # RUNNING/STOPPED, ports, cookie sync, open pages, seed age, login service
bash "$D" log         # daemon and sync logs
bash "$D" install     # start at login (launchd / systemd --user) — the user's call, say what it writes
```

Details, measurements and the alternatives that were rejected: `../../README.md` and
parallel-session-workflow → `references/playwright-shared.md`.
