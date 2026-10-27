# HKugz Friends server

The small server behind **accounts, friends and game invites** on HKugz Games. GitHub Pages can only serve files, so this is the one piece that has to run somewhere. It is a single Node.js file with **no packages to install** (Node 18 or newer).

What it stores and what it does not protect: [`docs/FRIENDS-SAFETY.md`](../docs/FRIENDS-SAFETY.md). Please read that before switching it on.

Until `assets/friends-config.js` names a server, the hub and games do not show or send anything for friends, so it is safe to publish the site before the server exists.

## Try it on this computer (Windows or Linux)

```
cd server
copy config.example.json config.json     (Linux: cp config.example.json config.json)
node server.js
```

Edit `config.json` first: at least change `signupCode`. To see the whole thing working on one computer, set `"siteDir": ".."` (the server then serves the games site too), open `http://localhost:8787/?hkapi=same`, and open a second tab at `http://127.0.0.1:8787/?hkapi=same` (a different address, so it is a different log-in). `?hkapi=` only works on `localhost` and `127.0.0.1`.

Tests: `node --test test.js` (15 tests, they start their own throw-away copies of the server).

## Put it on the Ubuntu server

1. **Node.** `node -v` should say 18 or higher. If it is older, install Node 20 LTS (NodeSource or `nvm`).
2. **The code.** `git clone https://github.com/HKugz11/hkugz-games.git ~/hkugz-games` (the server is the `server/` folder of the games repo).
3. **The settings.**
   ```
   cd ~/hkugz-games/server
   cp config.example.json config.json
   nano config.json
   ```
   Set `signupCode` to a secret word you give only to people you know. Leave `allowedOrigins` as it is (it already lists `https://hkugz11.github.io`). `config.json` and the saved data in `data/` are in `.gitignore`, so a `git pull` or a `git add -A` never touches or publishes them.
4. **Try it.** `node server.js`, then in another window `curl http://localhost:8787/api/info` should answer with a line of JSON. Stop it with Ctrl+C.
5. **Keep it running.** Copy `hkugz-friends.service` to `/etc/systemd/system/` (change `User` and the paths if yours are different), then `sudo systemctl daemon-reload && sudo systemctl enable --now hkugz-friends`. Logs: `journalctl -u hkugz-friends -f`.

### Make it reachable over HTTPS (required)

The hub is on `https://`, and a browser will **refuse** to talk from an HTTPS page to a plain `http://` server. So the server needs a real certificate on a real name. The way you already did it for the chat room server works here too:

1. A playit.gg tunnel (TCP) to port `8787` of the server, which gives you a public address and port.
2. A DuckDNS name that points at the tunnel's address (for example `hkugz-friends.duckdns.org`).
3. A Let's Encrypt certificate for that name (certbot with the DuckDNS DNS challenge, the same setup script as the chat server).
4. Put the certificate and key paths into `config.json`:
   ```
   "tls": { "cert": "/etc/letsencrypt/live/NAME/fullchain.pem", "key": "/etc/letsencrypt/live/NAME/privkey.pem" }
   ```
   The service's user has to be allowed to read both files. After each certificate renewal run `sudo systemctl restart hkugz-friends` (or add that to certbot's renew hook).
5. Check from any other computer: `https://NAME:PORT/api/info` should show JSON with a lock in the address bar.

A tunnel hides the visitors' addresses from the server, so the per-address rate limits become one shared limit (see the safety note, item 4). If you later put nginx or Caddy in front of it, set `"trustProxy": true` so the limits work per visitor again.

### Point the hub at it

Edit `assets/friends-config.js` in the games repo:

```js
window.HK_FRIENDS_API = "https://NAME:PORT";
```

Commit and push as usual. The hub then shows a **Friends** button, and the three online games get a small friends button in a top corner. To switch the whole feature off again, put `""` back.

### Later: serve the whole games site from the server too

Set `"siteDir": ".."` in `config.json` and restart. The server then serves the hub and every game itself (compressed, with caching; the `server/` folder and hidden files such as `.git` are never served). Then set `window.HK_FRIENDS_API = "same"` in `assets/friends-config.js` so the pages talk to the server they came from, and add the new site address to the list in `allowedOrigins` only if some other website needs to call it. To update the site on the server: `git pull`.

Moving the site off `hkugz11.github.io` to its own address also fixes one weak spot named in the safety note (item 3: other code on the same address can read the log-in).

## Looking after it

Run these on the server, in the `server` folder, while the server is running:

| Command | What it does |
|---|---|
| `node admin.js users` | list the accounts |
| `node admin.js reports` | read player reports (**someone should look at these regularly**) |
| `node admin.js ban NAME` / `unban NAME` | turn an account off / on |
| `node admin.js delete NAME` | delete an account and everything about it |
| `node admin.js resetpw NAME` | make a temporary password for someone who forgot theirs (be sure it really is them) |
| `node admin.js signups close` / `open` | stop / allow new accounts |
| `node admin.js clear-reports` | empty the report list after dealing with them |

`admin.js` talks to the running server with a secret in `data/admin-token.txt`; browsers can never use the admin part.

**Backups:** everything is in `data/db.json` (and `db.json.bak`, the save before the last one). Copy that folder somewhere safe now and then, for example with a daily `cp`. The server refuses to start if the file is damaged instead of wiping it.

**Updating:** `git pull`, then `sudo systemctl restart hkugz-friends`.

## Settings (`config.json`)

| Setting | Default | Meaning |
|---|---|---|
| `port`, `host` | `8787`, `0.0.0.0` | where it listens (use `127.0.0.1` if only a tunnel or proxy on the same computer connects) |
| `dataDir` | `./data` | where the saved accounts live |
| `allowedOrigins` | the GitHub Pages site | websites whose pages may call the server from a browser (the games site served by this server is always allowed) |
| `signupCode` | empty | if set, nobody can make an account without it. **Strongly recommended.** |
| `signupsOpen`, `maxUsers` | `true`, `300` | switch sign-ups off, or cap the number of accounts |
| `ipSignupsPerHour`, `allSignupsPerHour`, `requestsPerMinute` | `5`, `30`, `1500` | rate limits (a page that is on screen asks every 5 seconds) |
| `trustProxy` | `false` | set `true` only behind a real reverse proxy that sets `X-Forwarded-For` |
| `siteDir` | empty | serve the games site from this folder too |
| `tls` | empty | certificate and key paths for HTTPS |
| `log` | `false` | log a line for each sign-up (never IPs or passwords) |
| `blockedNames` | admin, staff, ... | words that may not appear in a username |

## The API (for reference)

`GET /api/info`, and `POST` (JSON) to `/api/signup`, `/api/login`, `/api/logout`, `/api/poll` (about every 5 seconds from a page that is on screen, or every 12 seconds from a background tab if pop-up notifications are on; it is also how "online" works), `/api/friend/request|respond|cancel|remove`, `/api/block`, `/api/unblock`, `/api/report`, `/api/invite`, `/api/invite/dismiss`, `/api/settings`, `/api/code/reset`, `/api/password`, `/api/account/delete`. Everything after log-in sends `Authorization: Bearer <session token>`. There are no cookies. Answers are JSON; errors look like `{"error": "plain words"}`.
