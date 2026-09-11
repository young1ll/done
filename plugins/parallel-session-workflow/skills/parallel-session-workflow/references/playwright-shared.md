# Sharing a browser between sessions — measured `@playwright/mcp` behaviour

Every variant below was exercised with two MCP clients driving real tool calls (`browser_navigate`,
`browser_tabs`, `browser_evaluate`, `browser_close`) against `@playwright/mcp` 0.0.80 and Chrome 152
on macOS. Re-measure before trusting a different version; the table is what happened, not what the
docs promise. Nothing here changes on its own — every variant is an MCP server registration, which is a
shared configuration file, so it is the user's decision.

## Why the default collides

Each session starts its own MCP server, and each server opens the same persistent profile
(`ms-playwright-mcp/mcp-chrome-<hash>` under the OS cache dir). Chrome guards a profile with one
`SingletonLock`; the second server fails with `Browser is already in use for …`. See
`resource-lock.sh` for reading who holds it.

## The variants

| Variant | Tabs isolated | Cookies / login | Long-lived parts | Verdict |
| --- | --- | --- | --- | --- |
| default: stdio server per session, shared persistent profile | no — serialized by the lock | shared automatically | none | contention; handshake needed |
| `--user-data-dir <per-session>` | yes | **not shareable** — `--storage-state` is applied to isolated contexts only (help text and measurement agree); each profile logs in once, cookies with an expiry survive restarts, session cookies do not | none | one login per profile |
| `--cdp-endpoint` alone | **no** — every client attaches to the same page; one client's `navigate` replaces another's | shared | a Chrome started with `--remote-debugging-port` | worse than the lock: silent |
| `--cdp-endpoint --isolated [--storage-state f]` | yes — one context per client; `browser_close` closes only that client's page; Chrome survives | seeded from `f` at context creation | a Chrome launcher + one server per session | works |
| `--port N` (HTTP server), one daemon, persistent profile | no — each HTTP client launches its own browser on the same profile → same lock error | shared | MCP daemon | contention unchanged |
| `--port N --shared-browser-context` | **no** — one context *and one page* for all clients | shared | MCP daemon | same failure as bare CDP |
| **`--port N --isolated --storage-state f`** + `--config` giving Chrome a debug port | yes — one context per HTTP session; separate pages; `browser_close` local to the client | seeded from `f`; `pw-state.mjs` exports every context's cookies (httpOnly included) from the daemon's debug port | **one MCP daemon**, which launches Chrome itself | best measured |

Further facts that matter operationally:

- An MCP server started before its Chrome (or after Chrome died) fails each call with
  `ECONNREFUSED` and reconnects by itself on the next call once Chrome is up. No restart needed.
- `--storage-state` is read when a context is created. A session already connected does not see a
  newer file; reconnect the MCP server (`/mcp`) or log in again.
- The HTTP server binds `localhost` (`::1` on a dual-stack machine) and checks the `Host` header:
  register `http://localhost:N/mcp`, not `127.0.0.1` (that answers 403).
- `--extension` pairs one server with one browser extension; it is not a multi-session mode.
- Chromium's `SingletonLock` is a POSIX symlink. On Windows there is nothing to read; use the
  `<RESOURCE>?` message.

## Recipe: one daemon, isolated sessions, shared login

`pw-daemon.sh` does the whole arrangement (config with the debug port, empty seed on first start,
pidfile, log, export). Verified end to end with two Claude Code sessions running concurrently: each
got its own context, cookies set in one were invisible to the other, no `already in use`, and no
per-session stdio server was spawned.

```bash
D=<this dir>/pw-daemon.sh
bash "$D" start                     # headed by default so a person can log in inside a session's window
claude mcp add --transport http --scope user playwright http://localhost:8931/mcp   # once
# and disable the stdio Playwright server that was registered before (a plugin's, typically),
# otherwise sessions get two browser toolsets and the old one still contends for the profile.
```

After a login by hand in any session's window, while that page is still open:

```bash
bash "$D" export                    # every session that connects from now on starts logged in
bash "$D" status                    # RUNNING / ports / open pages / seed age
```

Sessions already connected reconnect (`/mcp`) to pick up the new seed. The daemon does not survive a
reboot by itself: the SessionStart probe hook reports "configured but not listening" and prints the
start command. Rollback: `claude mcp remove playwright -s user`, re-enable the old server, `pw-daemon.sh stop`.

## Recipe: no daemon, still isolated

`--cdp-endpoint http://127.0.0.1:9333 --isolated --storage-state f` per session, with Chrome started
once by hand or by a launcher on that port and the same export step. Same isolation; one more moving
part (the launcher) and one server process per session.

Tool names follow the registration: a plugin-registered server exposes `mcp__plugin_<x>_playwright__*`,
a user-registered one `mcp__playwright__*`. Skills or notes that name tools need the new prefix.

When the last context closes the daemon closes Chrome too; it relaunches on the next browser call.
So `export` needs a page open somewhere — the script says so if it is not.
