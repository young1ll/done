# playwright-shared

One Playwright MCP daemon for the machine, instead of one per session.

Two Claude Code sessions with the standard Playwright plugin each start their own MCP server, and both
open the same persistent Chrome profile. The second one fails with
`Browser is already in use for …/ms-playwright-mcp/mcp-chrome-…`. Teams work around it with a
"close your browser, tell me when it's free" ritual — measured on one team: eight failures and about
twenty-five hand-overs in a day.

This plugin removes the contention instead of managing it:

- **one daemon** (`@playwright/mcp --port --isolated`), registered as an HTTP MCP server by the plugin
  itself — nothing to `claude mcp add`;
- **one browser context per session** — own tabs, own `browser_close`, no stomping;
- **a cookie-jar sync sidecar** (`bin/pw-sync.mjs`) that copies cookies between contexts within ~2 s and
  writes the merged jar to the storage-state file every new context starts from — a login done in any
  session's window is a login everywhere, with nobody running anything;
- **a SessionStart hook** that starts the daemon if it is down and tells the session to reconnect;
- **`pw-daemon.sh install`** to run it as a login service (launchd / systemd --user) so it is already
  up when sessions start.

Measured with `@playwright/mcp` 0.0.80 / Chrome 152: six sessions navigating, evaluating, screenshotting
and closing concurrently — zero errors, each seeing only its own tabs; a cookie set in one context visible
in another's open page without reload; a logout propagated; the seed file updated.

## Install

```
/plugin marketplace add young1ll/done
/plugin install playwright-shared@done
```

Then **disable the other Playwright server** you had (the official `playwright` plugin, typically), or
sessions get two browser toolsets and the old one keeps fighting over the profile. Restart Claude Code.

Optional, recommended: `bash <plugin>/bin/pw-daemon.sh install` once, so the daemon is up before any
session starts. Without it the first session after a boot starts the daemon and needs one `/mcp`
reconnect.

Tool names become `mcp__plugin_playwright-shared_playwright__*`.

## What the user does

Install once. Log in when an app asks, in whichever session's window asked. That is all — no export, no
hand-over, no restart on login.

## Operating

```bash
D=~/.claude/plugins/cache/done/playwright-shared/<version>/bin/pw-daemon.sh   # or the marketplace clone
bash "$D" status | start | stop | restart | log
bash "$D" install | uninstall      # login service
bash "$D" disable | enable         # keep hook and service from starting it (e.g. to use a different setup)
```

Files live in `~/.config/playwright-mcp/` (`state.json` seed, `config.json`, logs, `output/`).
Environment: `PW_MCP_PORT` (8931), `PW_DEBUG_PORT` (9333), `PW_HOME`, `PW_HEADLESS=1`.

## Limits

- Cookies are what is shared. An app that keeps its login in localStorage is not covered.
- Two sessions logging in as *different* users at once: last change wins, per tick.
- The daemon is one process: if it dies, every session's browser calls fail until it is back (the
  service restarts it; the daemon relaunches Chrome on the next call if only Chrome died).
- Every context opens a visible window (headed by default, so a person can log in). `PW_HEADLESS=1`
  if nobody ever needs to.
- macOS and Linux. Windows untested.

## Why not …

`--cdp-endpoint` alone or `--shared-browser-context`: every client shares one *tab* — one session's
navigate replaces another's, silently. `--user-data-dir` per session: no lock, but no way to share a
login (`--storage-state` applies to isolated contexts only). The full comparison is in
`parallel-session-workflow/references/playwright-shared.md`.

`bin/verify.sh` checks the scripts without network or Chrome.
