'use strict';
// HKugz Friends on Node: wraps core.js (the rules) with a web server, a data file and, if you want, the games site itself.
// One file plus core.js, no npm packages (needs Node 18 or newer). Setup: server/README.md. What is stored and what is not protected: docs/FRIENDS-SAFETY.md.
//   node server.js [path/to/config.json]
// To run on Cloudflare instead, see cloudflare/README.md (it uses the very same core.js).
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { createCore, CORE_DEFAULTS, GAMES } = require('./core.js');

const DEFAULTS = Object.assign({}, CORE_DEFAULTS, {
  port: 8787, host: '0.0.0.0', dataDir: './data',
  trustProxy: false,         // true only when a real reverse proxy (nginx, Caddy) in front sets X-Forwarded-For; a plain tunnel does not
  siteDir: '',               // folder of the games site to serve too (optional)
  tls: { cert: '', key: '' } // paths to a certificate + key to serve https directly
});

function createApp(userCfg) {
  const cfg = Object.assign({}, DEFAULTS, userCfg || {}); cfg.tls = Object.assign({}, DEFAULTS.tls, cfg.tls || {});
  const dataDir = path.resolve(cfg.dataDir); fs.mkdirSync(dataDir, { recursive: true });

  // ------------------------------------------------------------------ the saved data: data/db.json (and db.json.bak, the save before the last one)
  const dbFile = path.join(dataDir, 'db.json');
  let raw = null, damaged = '';
  for (const f of [dbFile, dbFile + '.bak']) {      // the .bak is used only if the main file is unreadable
    try { raw = JSON.parse(fs.readFileSync(f, 'utf8')); break; } catch (e) { if (e.code !== 'ENOENT') damaged = f + ': ' + e.message; }
  }
  if (!raw && damaged) throw new Error('The saved data is damaged (' + damaged + '). Fix or move it away before starting, so nothing gets wiped.');
  const adminFile = path.join(dataDir, 'admin-token.txt');
  if (!fs.existsSync(adminFile)) fs.writeFileSync(adminFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  const adminToken = fs.readFileSync(adminFile, 'utf8').trim();

  const core = createCore(Object.assign({}, cfg, { adminToken }), raw);
  let saveT = 0;
  core.onDirty = () => { if (!saveT) { saveT = setTimeout(flush, 300); saveT.unref && saveT.unref(); } };
  function flush() {
    clearTimeout(saveT); saveT = 0; if (!core.dirty) return; core.clearDirty();
    const tmp = dbFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(core.snapshot()), { mode: 0o600 });
    try { fs.copyFileSync(dbFile, dbFile + '.bak'); } catch (e) {}
    fs.renameSync(tmp, dbFile);
  }

  // ------------------------------------------------------------------ http
  function clientIp(req) {
    let ip = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    if (cfg.trustProxy && (ip === '127.0.0.1' || ip === '::1' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip))) {
      const xff = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
      if (xff.length) ip = xff[xff.length - 1].replace(/^::ffff:/, '');   // the entry our own proxy added, not one the visitor wrote
    }
    return ip || 'unknown';
  }
  async function api(req, res, pathname) {
    let text = '', tooBig = false;
    if (req.method === 'POST') {
      text = await new Promise(resolve => {
        let n = 0; const chunks = [];
        req.on('data', c => { n += c.length; if (n > 4096) tooBig = true; else chunks.push(c); });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); req.on('error', () => resolve(''));
      });
    }
    const out = await core.handle({ method: req.method, path: pathname, headers: req.headers, ip: clientIp(req), text, tooBig });
    res.writeHead(out.status, out.close ? Object.assign({}, out.headers, { Connection: 'close' }) : out.headers);
    res.end(req.method === 'HEAD' ? undefined : out.body);
  }

  // ---- serving the games site too (optional)
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.map': 'application/json' };
  const GZ = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.md']), gzCache = new Map();
  const siteRoot = cfg.siteDir ? path.resolve(cfg.siteDir) : '';
  async function site(req, res, pathname) {
    const fail = (code, msg) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }); res.end(msg); };
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(405, 'Method not allowed');
    let rel; try { rel = decodeURIComponent(pathname); } catch (e) { return fail(400, 'Bad request'); }
    if (rel.includes('\0') || rel.includes('\\')) return fail(400, 'Bad request');
    const parts = rel.split('/').filter(Boolean);
    if (parts.some(p => p === '..' || p.startsWith('.')) || ['server', 'node_modules'].includes((parts[0] || '').toLowerCase())) return fail(404, 'Not found');   // never hand out the server folder (config + data) or dotfiles like .git
    let file = path.join(siteRoot, ...parts);
    if (file !== siteRoot && !file.startsWith(siteRoot + path.sep)) return fail(404, 'Not found');
    let st; try { st = await fs.promises.stat(file); } catch (e) { return fail(404, 'Not found'); }
    if (st.isDirectory()) { if (!pathname.endsWith('/')) { res.writeHead(301, { Location: pathname + '/' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '') }); return res.end(); } file = path.join(file, 'index.html'); try { st = await fs.promises.stat(file); } catch (e) { return fail(404, 'Not found'); } }
    const ext = path.extname(file).toLowerCase(), etag = 'W/"' + st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36) + '"';
    const head = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'ETag': etag, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'Vary': 'Accept-Encoding' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); return res.end(); }
    if (GZ.has(ext) && st.size > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      let c = gzCache.get(file); if (!c || c.etag !== etag) { c = { etag, buf: zlib.gzipSync(await fs.promises.readFile(file)) }; if (gzCache.size > 200) gzCache.clear(); gzCache.set(file, c); }
      res.writeHead(200, Object.assign(head, { 'Content-Encoding': 'gzip', 'Content-Length': c.buf.length })); return res.end(req.method === 'HEAD' ? undefined : c.buf);
    }
    res.writeHead(200, Object.assign(head, { 'Content-Length': st.size }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }

  function handler(req, res) {
    const pathname = (req.url || '/').split('?')[0];
    if (pathname.startsWith('/api/') || pathname.startsWith('/admin/')) return void api(req, res, pathname);
    if (siteRoot) return void site(req, res, pathname).catch(e => { console.error('site error', e); try { res.destroy(); } catch (_) {} });
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('HKugz Friends server. The games site is not served from here.');
  }
  let server;
  if (cfg.tls.cert && cfg.tls.key) server = https.createServer({ cert: fs.readFileSync(cfg.tls.cert), key: fs.readFileSync(cfg.tls.key) }, handler);
  else server = http.createServer(handler);
  server.requestTimeout = 15e3; server.headersTimeout = 10e3; server.keepAliveTimeout = 5e3;

  return {
    cfg, adminToken, users: core.users, server,
    advance: ms => core.advance(ms),
    start() { return new Promise(res => server.listen(cfg.port, cfg.host, () => res(server.address().port))); },
    close() { flush(); return new Promise(res => { server.close(() => res()); if (server.closeAllConnections) server.closeAllConnections(); }); },
    flush
  };
}

module.exports = { createApp, DEFAULTS, GAMES };

if (require.main === module) {
  let cfgFile = process.argv[2] || process.env.HKF_CONFIG || path.join(__dirname, 'config.json'), user = {};
  try { user = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') { console.error('Could not read ' + cfgFile + ': ' + e.message); process.exit(1); } console.log('No config.json found, using the defaults (see config.example.json).'); }
  if (process.env.PORT) user.port = +process.env.PORT;
  if (user.dataDir) user.dataDir = path.resolve(path.dirname(cfgFile), user.dataDir); else user.dataDir = path.join(__dirname, 'data');
  if (user.siteDir) user.siteDir = path.resolve(path.dirname(cfgFile), user.siteDir);
  const app = createApp(user);
  process.on('uncaughtException', e => console.error('uncaught', e && e.stack || e));      // one bad request must never take the server down
  process.on('unhandledRejection', e => console.error('unhandled', e && e.stack || e));
  const stop = () => app.close().then(() => process.exit(0)); process.on('SIGINT', stop); process.on('SIGTERM', stop);
  app.start().then(p => {
    console.log('HKugz Friends is running on ' + (app.cfg.tls.cert ? 'https' : 'http') + '://localhost:' + p + (app.cfg.siteDir ? '  (also serving the site from ' + app.cfg.siteDir + ')' : ''));
    console.log(app.cfg.signupCode ? 'Sign-up needs a code.' : 'WARNING: no signupCode set, so anyone who finds the site can make an account.');
  });
}
