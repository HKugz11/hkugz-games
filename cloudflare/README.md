# HKugz Friends on Cloudflare

This runs the friends server (accounts, friends, game invites) on **Cloudflare's free plan**, so nothing at home has to stay switched on. It is the very same rules file the Node server uses (`../server/core.js`), wrapped in a Cloudflare Worker plus one Durable Object (a small private server with its own storage that holds the accounts).

Please read [`../docs/FRIENDS-SAFETY.md`](../docs/FRIENDS-SAFETY.md) before switching it on. Until `assets/friends-config.js` names the server, the hub and games do not show or send anything for friends.

## Who does what

- **A parent makes the Cloudflare account.** Cloudflare's own rules say its services are not for people under 18, so Hyrum should not sign up himself. It is free and (on the free plan) does not ask for a payment card; if it ever asks for one, stop and ask first. Turn on two-step login for that account: whoever controls the account controls the server and can read every saved username.
- Nothing secret is ever typed into a chat. The log-in is a "click Allow" in the browser. The two secrets below are typed at a prompt in the terminal and are never saved in the project.

## Put it online (about 15 minutes, once)

Open **Command Prompt** (Windows) and go to this folder:

```
cd /d C:\Users\hyrum\games-site\cloudflare
npm install
```

1. **Log in to Cloudflare** (a browser window opens, the parent clicks *Allow*):
   ```
   npx wrangler login
   ```
2. **Deploy:**
   ```
   npx wrangler deploy
   ```
   The first time it asks the parent to pick a free `workers.dev` name (for example `hkugz`). It then prints the server's address, like `https://hkugz-friends.hkugz.workers.dev`. Write it down.
3. **The sign-up code.** Only people who know it can make an account. Pick a secret word or two, and give it only to people you know:
   ```
   npx wrangler secret put SIGNUP_CODE
   ```
   (type it at the prompt and press Enter)
4. **The admin secret.** First make a long random one, and keep it somewhere safe (a password manager is best):
   ```
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
   npx wrangler secret put ADMIN_TOKEN
   ```
   Paste the random text at the prompt. Without this secret the admin part stays switched off.
5. **Check it.** Open `https://YOUR-ADDRESS/api/info` in a browser. You should see a line of text that includes `"codeRequired":true`. (If it says `false`, wait a minute and reload: the new secret is still arriving.)
6. **Switch the friends on in the hub.** Edit `assets/friends-config.js` in the games repo:
   ```js
   window.HK_FRIENDS_API = "https://YOUR-ADDRESS";
   ```
   Commit and push as usual. The hub then shows a **Friends** button, and the three online games get a small friends button.

To change the secrets later, run the same `secret put` command again. To change other settings, edit `wrangler.toml` (`[vars]`) and run `npx wrangler deploy`. (`OWNER_NAMES = "hkugz"` there lets the site owner take the name `hkugz`, which is otherwise blocked so nobody can pretend to be the site.)

## Looking after it

The admin tool works the same as on the Ubuntu version, you just tell it where the server is (Command Prompt):

```
set HKF_URL=https://YOUR-ADDRESS
set HKF_ADMIN_TOKEN=the-admin-secret-from-step-4
node ..\server\admin.js users
node ..\server\admin.js reports
```

The other commands (`ban NAME`, `unban NAME`, `delete NAME`, `resetpw NAME`, `signups close`, `signups open`, `clear-reports`) are listed at the top of `server/admin.js`. **Someone should read the reports regularly.**

**What it costs, and what happens at the limit.** The free plan allows 100,000 requests a day to the Worker and 100,000 to the Durable Object. A hub or game page with someone logged in asks "anything new?" every 5 seconds while it is on screen (more slowly or not at all in a background tab), so very roughly 140 hours of open pages a day fit, for example 20 people for 7 hours each. If the limit is ever reached, the friends panel shows errors until the counters reset at midnight UTC; all the games keep working. Cloudflare shows the numbers in the dashboard under *Workers & Pages* → `hkugz-friends` → *Metrics*.

**Backups.** The saved data lives in Cloudflare's storage, and there is no easy download. If the Cloudflare account were lost, the accounts would be lost too. That is a small loss for a friends list; just do not use this for anything you could not recreate.

**Shutting it down.** Put `""` back in `assets/friends-config.js` and push: everything disappears from the site at once. To delete the server and every saved account, run `npx wrangler delete` (parent logged in).

## Try it on this computer first (no account needed)

```
cd cloudflare
npm install
copy .dev.vars.example .dev.vars        (then edit the two secrets in it)
npm run dev                              (Cloudflare's own runtime on this computer, port 8788)
npm test                                 (in a second window: 13 end-to-end checks)
```

`.dev.vars` holds test secrets and is ignored by git. To click through it, serve the games site any way you like (for example `node ../server/server.js` with `"siteDir": ".."`), add that page's address to `ALLOWED_ORIGINS` in `.dev.vars`, and open the hub with `?hkapi=http://localhost:8788` on the end (that only works on `localhost`).

## How it differs from the Ubuntu version

- Cloudflare gives every request the visitor's real address, so the per-address limits (log-in tries, sign-ups, friend requests) work properly, which a plain tunnel can not do.
- Cloudflare provides the HTTPS certificate, so there is nothing to set up or renew.
- It only does the friends API. The games site stays on GitHub Pages (`siteDir` is a Node-server feature).
- The saved accounts move to the Ubuntu server with two commands (`node admin.js export`, then `node admin.js import`): see **Moving from Cloudflare to the Ubuntu server** in [`../server/README.md`](../server/README.md). Both versions use the same rules and the same data shape, so nothing is lost: passwords, friends, blocks and friend codes all come along.
