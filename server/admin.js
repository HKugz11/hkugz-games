'use strict';
// Look after the friends server from the server itself (the server must be running).
//   node admin.js users                 list accounts
//   node admin.js reports               read player reports
//   node admin.js ban NAME | unban NAME turn an account off / on
//   node admin.js delete NAME           delete an account and everything about it
//   node admin.js resetpw NAME          make a new temporary password for someone who forgot theirs
//   node admin.js clear-reports         clear the report list
//   node admin.js signups open|close    open or close sign-ups
// On the server itself it talks to the running server with the secret in data/admin-token.txt. Nobody else has that secret.
// For the Cloudflare version it finds the server in assets/friends-config.js and the secret in cloudflare/.admin-token (made by cloudflare/set-admin-token.js).
// To point it at any other server, set two things first, then run the same commands:
//   Windows (Command Prompt):  set HKF_URL=https://hkugz-friends.YOURNAME.workers.dev  &  set HKF_ADMIN_TOKEN=the-secret-you-made
//   Linux / Mac:               export HKF_URL=https://...  HKF_ADMIN_TOKEN=...
const fs = require('fs'), path = require('path'), http = require('http'), https = require('https');
const cfgFile = process.env.HKF_CONFIG || path.join(__dirname, 'config.json');
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) {}
let REMOTE = (process.env.HKF_URL || '').replace(/\/+$/, '');
const dataDir = path.resolve(path.dirname(cfgFile), cfg.dataDir || path.join(__dirname, 'data'));
const port = +process.env.PORT || cfg.port || 8787, secure = !!(cfg.tls && cfg.tls.cert);
if (!REMOTE && !fs.existsSync(path.join(dataDir, 'admin-token.txt'))) {     // no local server's data here: maybe this site uses the Cloudflare one
  try { const m = /HK_FRIENDS_API\s*=\s*"(https:\/\/[^"]+)"/.exec(fs.readFileSync(path.join(__dirname, '..', 'assets', 'friends-config.js'), 'utf8')); if (m) { REMOTE = m[1].replace(/\/+$/, ''); console.log('Using the server at ' + REMOTE + ' (from assets/friends-config.js).'); } } catch (e) {}
}
let token = process.env.HKF_ADMIN_TOKEN || '';
if (REMOTE && !token) { try { token = fs.readFileSync(path.join(__dirname, '..', 'cloudflare', '.admin-token'), 'utf8').trim(); } catch (e) {} }   // written by cloudflare/set-admin-token.js
if (REMOTE && !token) { console.error('No admin secret found. Run "node set-admin-token.js" in the cloudflare folder, or set HKF_ADMIN_TOKEN (see the top of admin.js).'); process.exit(1); }
if (!REMOTE) { try { token = fs.readFileSync(path.join(dataDir, 'admin-token.txt'), 'utf8').trim(); } catch (e) { console.error('Start the server once first (no data/admin-token.txt yet).'); process.exit(1); } }

function call(method, url, body) {
  if (REMOTE) {
    return fetch(REMOTE + url, { method, headers: { 'x-admin-token': token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(async r => { let j = {}; try { j = await r.json(); } catch (e) {} if (r.status !== 200) throw new Error(j.error || 'failed (' + r.status + ')'); return j; }, e => { throw new Error('Could not reach ' + REMOTE + ' (' + e.message + ')'); });
  }
  return new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : '';
    const r = (secure ? https : http).request({ host: '127.0.0.1', port, path: url, method, rejectUnauthorized: false, headers: { 'x-admin-token': token, 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, resp => {
      let s = ''; resp.on('data', c => (s += c)); resp.on('end', () => { try { const j = JSON.parse(s); resp.statusCode === 200 ? res(j) : rej(new Error(j.error || 'failed')); } catch (e) { rej(new Error('bad answer from the server')); } });
    });
    r.on('error', e => rej(new Error('Could not reach the server on port ' + port + ' (' + e.message + '). Is it running?'))); r.end(data);
  });
}
const when = t => (t ? new Date(t).toISOString().replace('T', ' ').slice(0, 16) : '-');
const [cmd, arg] = process.argv.slice(2);
(async () => {
  if (cmd === 'users') { const r = await call('GET', '/admin/users'); console.log('Sign-ups are ' + (r.signupsOpen ? 'OPEN' : 'CLOSED') + '. ' + r.users.length + ' accounts:'); for (const u of r.users) console.log(u.name.padEnd(18), 'made', when(u.created), ' last log-in', when(u.lastLogin), ' friends', u.friends, u.banned ? ' BANNED' : ''); }
  else if (cmd === 'reports') { const r = await call('GET', '/admin/reports'); if (!r.reports.length) console.log('No reports.'); for (const x of r.reports) console.log(when(x.t), x.by, 'reported', x.who, '-', x.reason); }
  else if (['ban', 'unban', 'delete', 'resetpw'].includes(cmd) && arg) { const r = await call('POST', '/admin/' + cmd, { name: arg }); console.log(r.password ? 'Temporary password for ' + arg + ': ' + r.password + '\n(tell them to change it after they log in)' : 'Done.'); }
  else if (cmd === 'clear-reports') { await call('POST', '/admin/clear-reports'); console.log('Cleared.'); }
  else if (cmd === 'signups' && (arg === 'open' || arg === 'close')) { await call('POST', '/admin/signups', { open: arg === 'open' }); console.log('Sign-ups are now ' + (arg === 'open' ? 'OPEN' : 'CLOSED') + '.'); }
  else console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 11).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
})().catch(e => { console.error(e.message); process.exit(1); });
