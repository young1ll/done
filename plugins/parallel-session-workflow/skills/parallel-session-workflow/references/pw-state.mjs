// Export cookies from every browser context of a Chromium on a CDP port as Playwright storage-state JSON.
// usage: node pw-state.mjs [port] > state.json      (Node 22+: uses the global fetch and WebSocket)
// Reads httpOnly cookies too, so a login done by hand in one context can seed every later context.
const port = process.argv[2] || '9333';
const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ctxs = (await send('Target.getBrowserContexts')).result.browserContextIds;
const seen = new Map();
for (const browserContextId of [undefined, ...ctxs]) {
  const r = await send('Storage.getCookies', browserContextId ? { browserContextId } : {});
  for (const c of r.result?.cookies || []) seen.set(`${c.domain}|${c.path}|${c.name}`, c);
}
const cookies = [...seen.values()].map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path, expires: c.expires ?? -1, httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: c.sameSite === 'None' ? 'None' : c.sameSite === 'Strict' ? 'Strict' : 'Lax' }));
console.log(JSON.stringify({ cookies, origins: [] }, null, 1));
ws.close();
