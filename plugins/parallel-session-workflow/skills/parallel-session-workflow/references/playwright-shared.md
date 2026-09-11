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
| **`--port N --isolated --storage-state f`** + `--config` giving Chrome a debug port | yes — one context per HTTP session; separate pages; `browser_close` local to the client | seeded from `f`; the sync sidecar copies every context's cookies (httpOnly included) between contexts and into the seed | **one MCP daemon**, which launches Chrome itself | best measured |

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

Packaged as the **playwright-shared** plugin in this marketplace: it registers the HTTP server itself,
runs a cookie-jar sync sidecar so logins propagate between contexts without anyone exporting anything,
starts the daemon from a SessionStart hook, and installs a login service. Install it and disable the
per-session Playwright server you had. Its README carries the measurements (six concurrent sessions,
login and logout propagation) and the limits (cookies only; last change wins).

## Recipe: no daemon, still isolated

`--cdp-endpoint http://127.0.0.1:9333 --isolated --storage-state f` per session, with Chrome started
once by hand or by a launcher on that port and the same export step. Same isolation; one more moving
part (the launcher) and one server process per session.

Tool names follow the registration: a plugin-registered server exposes `mcp__plugin_<x>_playwright__*`,
a user-registered one `mcp__playwright__*`. Skills or notes that name tools need the new prefix.

When the last context closes the daemon closes Chrome too; it relaunches on the next browser call, and
new contexts are seeded from the jar the sync sidecar keeps on disk.
