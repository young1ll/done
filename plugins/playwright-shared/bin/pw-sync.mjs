// Cookie-jar sync for a Playwright MCP daemon running with --isolated: every browser context keeps its own
// tabs, but cookies (and so logins) flow between them within a tick, and the merged jar is written to the
// storage-state file every new context starts from. Nobody has to notice that a login happened.
//
//   node pw-sync.mjs [--port 9333] [--state ~/.config/playwright-mcp/state.json] [--interval 1500]
//
// Rules: a cookie added or changed in one context is pushed to all others; a cookie that disappeared from
// the context it was last seen in is expired everywhere (logout propagates). If two contexts change the
// same cookie in one tick, the last one read wins. Chrome closing (last context gone) is normal: the loop
// reconnects when the debug port returns, and new contexts are seeded from the jar kept in memory and on disk.
import { writeFileSync, renameSync, readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = arg('--port', '9333');
const STATE = arg('--state', `${homedir()}/.config/playwright-mcp/state.json`);
const INTERVAL = Number(arg('--interval', '1500'));
const key = c => `${c.domain}|${c.path}|${c.name}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const jar = new Map();                       // merged, key -> cookie
if (existsSync(STATE)) try { for (const c of JSON.parse(readFileSync(STATE, 'utf8')).cookies || []) jar.set(key(c), c); log('seed loaded', jar.size); } catch {}
let dirty = false;
function persist() {
  if (!dirty) return; dirty = false;
  const cookies = [...jar.values()].map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path, expires: c.expires > 0 ? c.expires : -1, httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: ['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : 'Lax' }));
  const tmp = STATE + '.tmp'; writeFileSync(tmp, JSON.stringify({ cookies, origins: [] })); renameSync(tmp, STATE);
}
const toSet = c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path, secure: !!c.secure, httpOnly: !!c.httpOnly, sameSite: c.sameSite, ...(c.expires > 0 ? { expires: c.expires } : {}) });
const toExpire = c => ({ name: c.name, value: '', domain: c.domain, path: c.path, secure: !!c.secure, httpOnly: !!c.httpOnly, expires: 1 });

async function session() {
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const closed = new Promise(r => ws.onclose = r);
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const prev = new Map();                    // ctx -> Map(key -> cookie)
  log('connected to chrome', ver.Browser);
  while (ws.readyState === WebSocket.OPEN) {
    const r = await send('Target.getBrowserContexts'); if (r.error) break;
    const ctxs = r.result.browserContextIds;
    for (const c of [...prev.keys()]) if (!ctxs.includes(c)) prev.delete(c);
    const pushes = new Map();                // ctx -> cookies to set
    const push = (ctx, cookie) => { if (!pushes.has(ctx)) pushes.set(ctx, []); pushes.get(ctx).push(cookie); };
    for (const ctx of ctxs) {
      const cur = new Map(); for (const c of ((await send('Storage.getCookies', { browserContextId: ctx })).result?.cookies || [])) cur.set(key(c), c);
      if (!prev.has(ctx)) {                  // new context: give it the merged jar, take its own extras into the jar
        for (const [k, c] of jar) if (!cur.has(k)) push(ctx, toSet(c));
        for (const [k, c] of cur) if (!jar.has(k)) { jar.set(k, c); dirty = true; for (const o of ctxs) if (o !== ctx) push(o, toSet(c)); }
        prev.set(ctx, cur); log('context joined', ctx.slice(0, 8), 'jar', jar.size);
        continue;
      }
      const was = prev.get(ctx);
      for (const [k, c] of cur) {
        const w = was.get(k);
        if (!w || w.value !== c.value || w.expires !== c.expires) { jar.set(k, c); dirty = true; for (const o of ctxs) if (o !== ctx) push(o, toSet(c)); }
      }
      for (const [k, c] of was) if (!cur.has(k) && jar.has(k)) { jar.delete(k); dirty = true; for (const o of ctxs) if (o !== ctx) push(o, toExpire(c)); log('expired everywhere', c.name); }
      prev.set(ctx, cur);
    }
    for (const [ctx, cookies] of pushes) {
      const r = await send('Storage.setCookies', { cookies, browserContextId: ctx });
      if (r.error) log('setCookies failed', ctx.slice(0, 8), r.error.message); else { const p = prev.get(ctx); for (const c of cookies) { const k = key(c); if (c.expires === 1) p?.delete(k); else p?.set(k, c); } }
    }
    persist();
    await Promise.race([new Promise(r => setTimeout(r, INTERVAL)), closed]);
  }
  log('chrome connection closed');
}
for (;;) {
  try { await session(); } catch (e) { /* port down: Chrome not running yet or just closed */ }
  await new Promise(r => setTimeout(r, INTERVAL));
}
