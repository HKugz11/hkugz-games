'use strict';
// Look after the friends server from the server itself (the server must be running).
//   node admin.js users                 list accounts
//   node admin.js reports               read player reports
//   node admin.js ban NAME | unban NAME turn an account off / on
//   node admin.js delete NAME           delete an account and everything about it
//   node admin.js resetpw NAME          make a new temporary password for someone who forgot theirs
//   node admin.js clear-reports         clear the report list
//   node admin.js signups open|close    open or close sign-ups
// It talks to the running server on this computer with the secret in data/admin-token.txt. Nobody else has that secret.
const fs = require('fs'), path = require('path'), http = require('http'), https = require('https');
const cfgFile = process.env.HKF_CONFIG || path.join(__dirname, 'config.json');
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) {}
const dataDir = path.resolve(path.dirname(cfgFile), cfg.dataDir || path.join(__dirname, 'data'));
const port = +process.env.PORT || cfg.port || 8787, secure = !!(cfg.tls && cfg.tls.cert);
let token; try { token = fs.readFileSync(path.join(dataDir, 'admin-token.txt'), 'utf8').trim(); } catch (e) { console.error('Start the server once first (no data/admin-token.txt yet).'); process.exit(1); }

function call(method, url, body) {
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
