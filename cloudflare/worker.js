// HKugz Friends on Cloudflare.
// A Worker answers every request and hands /api and /admin requests to ONE Durable Object (a tiny private server with its own storage).
// The Durable Object keeps all the accounts, so there is one place that knows who is online. The rules are in ../server/core.js, the same file the Node server uses.
// Settings come from wrangler.toml ([vars]) and from secrets set with `wrangler secret put` (SIGNUP_CODE, ADMIN_TOKEN): see cloudflare/README.md.
import { DurableObject } from 'cloudflare:workers';
import { createCore, CORE_DEFAULTS } from '../server/core.js';

const list = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const num = (v, d) => (v !== undefined && v !== '' && isFinite(+v) ? +v : d);
function configFrom(env) {
  return {
    allowedOrigins: env.ALLOWED_ORIGINS ? list(env.ALLOWED_ORIGINS) : CORE_DEFAULTS.allowedOrigins,
    signupCode: env.SIGNUP_CODE || '', adminToken: env.ADMIN_TOKEN || '',
    signupsOpen: env.SIGNUPS_OPEN !== 'false', maxUsers: num(env.MAX_USERS, CORE_DEFAULTS.maxUsers),
    ipSignupsPerHour: num(env.IP_SIGNUPS_PER_HOUR, CORE_DEFAULTS.ipSignupsPerHour), allSignupsPerHour: num(env.ALL_SIGNUPS_PER_HOUR, CORE_DEFAULTS.allSignupsPerHour),
    requestsPerMinute: num(env.REQUESTS_PER_MINUTE, CORE_DEFAULTS.requestsPerMinute), log: env.LOG === 'true',
    ownerNames: list(env.OWNER_NAMES)
  };
}

// ---- the saved data: the whole snapshot as JSON, cut into 96 KB pieces (db:0, db:1, ...) so no single value gets too big. One put() is all-or-nothing.
const CHUNK = 96 * 1024;
async function loadDb(storage) {
  const n = await storage.get('db:n'); if (!n) return { raw: null, n: 0 };
  const keys = []; for (let i = 0; i < n; i++) keys.push('db:' + i);
  const got = await storage.get(keys); let json = '';
  for (const k of keys) { if (typeof got.get(k) !== 'string') throw new Error('Saved data is incomplete (' + k + ' is missing). Not starting, so nothing gets overwritten.'); json += got.get(k); }
  return { raw: JSON.parse(json), n };
}
async function saveDb(storage, snapshot, prevN) {
  const json = JSON.stringify(snapshot), parts = {}; let n = 0;
  for (let i = 0; i < json.length; i += CHUNK) parts['db:' + n++] = json.slice(i, i + CHUNK);
  if (n > 120) throw new Error('The saved data got too big (' + json.length + ' bytes).');
  parts['db:n'] = n; await storage.put(parts);
  if (prevN > n) { const old = []; for (let i = n; i < prevN; i++) old.push('db:' + i); await storage.delete(old); }
  return n;
}

async function readText(request, limit) {      // the body as text, but never read more than `limit` bytes
  if (+request.headers.get('content-length') > limit) return { text: '', tooBig: true };
  if (!request.body) return { text: '', tooBig: false };
  const reader = request.body.getReader(), parts = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    n += value.length; if (n > limit) { await reader.cancel(); return { text: '', tooBig: true }; }
    parts.push(value);
  }
  const all = new Uint8Array(n); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
  return { text: new TextDecoder().decode(all), tooBig: false };
}

export class World extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env); this.core = null; this.pieces = 0;
    ctx.blockConcurrencyWhile(async () => {            // nothing is answered until the saved data is loaded
      const { raw, n } = await loadDb(ctx.storage); this.pieces = n;
      this.core = createCore(configFrom(env), raw);
    });
  }
  async fetch(request) {
    const { text, tooBig } = request.method === 'POST' ? await readText(request, 4096) : { text: '', tooBig: false };
    const headers = {}; request.headers.forEach((v, k) => { headers[k] = v; });
    const out = await this.core.handle({ method: request.method, path: new URL(request.url).pathname, headers, ip: headers['x-hkf-ip'] || 'unknown', text, tooBig });
    if (this.core.dirty) {                              // something changed: save before answering
      this.core.clearDirty();
      try { this.pieces = await saveDb(this.ctx.storage, this.core.snapshot(), this.pieces); } catch (e) { this.core.markDirty(); console.error('Could not save:', e && e.stack || e); }
    }
    return new Response(request.method === 'HEAD' || out.status === 204 ? null : out.body, { status: out.status, headers: out.headers });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/admin/')) return new Response('HKugz Friends server. Nothing to see here.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (request.method === 'OPTIONS') {                // the browser's "may I?" check needs no accounts, so it does not wake the Durable Object
      const headers = {}; request.headers.forEach((v, k) => { headers[k] = v; });
      const out = await createCore(configFrom(env), null).handle({ method: 'OPTIONS', path: url.pathname, headers, ip: 'preflight', text: '' });
      return new Response(out.status === 204 ? null : out.body, { status: out.status, headers: out.headers });
    }
    const headers = new Headers(request.headers);
    headers.set('x-hkf-ip', request.headers.get('cf-connecting-ip') || 'unknown');   // Cloudflare writes the real visitor address here and visitors can not fake it
    return env.WORLD.get(env.WORLD.idFromName('main')).fetch(new Request(request, { headers }));
  }
};
