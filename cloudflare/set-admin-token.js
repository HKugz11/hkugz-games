'use strict';
// Makes a long random admin secret, sets it on Cloudflare as the ADMIN_TOKEN secret, and saves a copy ONLY on this computer
// (cloudflare/.admin-token, which git ignores). Nobody has to see or copy it: server/admin.js reads that file.
// Run it again any time to replace the secret.   Usage: node set-admin-token.js   (log in first with: npx wrangler login)
const crypto = require('crypto'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const token = crypto.randomBytes(24).toString('hex'), file = path.join(__dirname, '.admin-token'), wrangler = path.join(__dirname, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
if (!fs.existsSync(wrangler)) { console.error('Run "npm install" in the cloudflare folder first (wrangler is missing).'); process.exit(1); }
const child = spawn(process.execPath, [wrangler, 'secret', 'put', 'ADMIN_TOKEN'], { cwd: __dirname, stdio: ['pipe', 'inherit', 'inherit'] });
child.stdin.end(token);
child.on('exit', code => {
  if (code !== 0) { console.error('Cloudflare did not accept the secret (exit ' + code + '). Nothing was saved.'); process.exit(1); }
  fs.writeFileSync(file, token + '\n'); console.log('Done. The admin secret is saved on this computer in cloudflare/.admin-token (not in git).');
});
