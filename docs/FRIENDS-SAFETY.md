# HKugz Games friends: what is stored, what a stranger could do, what is NOT protected

This is the safety note for the optional **accounts, friends and game invites** feature. It is written to be read by a parent or any other adult who wants to check it before it is switched on. It describes what the code in `server/core.js` (the rules), `cloudflare/` (the Cloudflare version) and `assets/hkfriends.js` (the panel) really does (the server has automated tests for most of the rules below, such as the log-in lock, blocking, the sign-up code and the hidden `server/` folder: `cd server && node --test test.js`).

**Where it runs.** The recommended way is Cloudflare's free plan (`cloudflare/README.md`): the saved data then lives in Cloudflare's storage, and the Cloudflare account owner (a parent) controls it. It can also run on a computer you control (`server/README.md`), where the saved data is the file `server/data/db.json`. The rules are the same file either way.

**The feature is off by default.** Until someone puts a server address in `assets/friends-config.js`, the hub and the games do not load any of it, show nothing and send nothing. Every game works the same with no account, and nothing here changes how the play timer works.

## What it is, in plain words

- You can make an account with a **username and a password**. That is all. No email, no real name, no birthday, no phone number.
- With an account you can add friends (by their username or their friend code), see which friends are online, and **invite an online friend to a game**. The friend sees the invite on the hub (or inside a game) and can press Join.
- There is **no chat and no messages** of any kind. An invite is only a game name and a 5-letter room code.
- When a friend invites you, a popup with a **Join** button appears (and a short chime plays, which you can turn off). **Enter** joins it. If you are already in a game, the first Enter only asks you to press it again, so one stray key can not end your match. You can also turn on **pop-up notifications** in Settings (your browser has to say yes), which show the invite even when the tab is in the background.
- You can remove a friend, **block** someone, or **report** someone. You can also hide ("appear offline"), switch off being found by username, get a new friend code, change your password, or delete your account.

## What the server stores

| What | Where | Notes |
|---|---|---|
| Username (as typed) | the saved data (Cloudflare storage, or `server/data/db.json`) | Public to anyone who can type it exactly (see below). The sign-up form tells kids to make one up and rejects phone-number-like names. |
| Password | the saved data, as a **scrypt hash with its own random salt** | The password itself is never stored or logged. A wrong password takes as long to check as a right one. |
| Friend code | the saved data | 8 random characters (about 850 billion possibilities). A player can replace it any time. |
| Friends, blocked players, waiting requests | the saved data | Only the two people involved can see their own lists. |
| Settings | the saved data | "Appear offline" and "let people add me by username". |
| Log-in sessions | the saved data, only a **hash** of each session token and its expiry | 30 days, up to 5 devices, ended by log out, password change or a ban. |
| Reports | the saved data | Who reported, who was reported, one of four fixed reasons, and the time. No free text. |
| Created / last log-in times | the saved data | For housekeeping. |
| Who is online, what game they are in, open invites | **memory only** | Gone when the server restarts. Invites vanish after 10 minutes. |
| IP addresses | **not stored by us** | They are used for a moment, in memory, for rate limits and then forgotten. Logging is off unless the operator turns it on, and even then no IPs or passwords are written. (On Cloudflare, Cloudflare itself sees every visitor's address and keeps its own short-lived logs, as any website host does.) |

Nothing is sent to anyone else: no analytics, no ads, no Google, no fonts or scripts from other sites. The only outside service involved is the one the games already use (PeerJS, for introducing players in online games).

On the player's own device the browser keeps the session token in `localStorage` (key `hkfriends`), the two sound/pop-up choices (`hkfriends_prefs`), and, only for the tab's lifetime, the ids of invites it has already chimed for (`sessionStorage`). Nothing about notifications is stored on the server.

**How often the page talks to the server:** a page that is on screen asks "anything new?" every 5 seconds (3 seconds while the panel is open); that is also how "online" works. A tab in the background says nothing and shows as offline, **unless** the player turned on pop-up notifications: then it asks every 12 seconds so the invite can reach them, and they keep showing as online.

## What a stranger could do

Assuming the server is set up as recommended (with a **sign-up code**, see `server/README.md`):

- **Make an account?** No. Without the sign-up code the server refuses. The operator can also close sign-ups completely (`node admin.js signups close`). Without a sign-up code, anyone who finds the site could make an account, so please do not skip it unless you have decided you want an open community.
- **Guess a password?** Very slowly. After 5 wrong tries on one account the log-in is locked for 30 seconds, then 1 minute, 2 minutes and so on, up to 15 minutes. There is also a limit per address. Passwords must be 8 or more characters and not obviously weak.
- **Find a kid?** Only by typing the exact username or the friend code. There is no player list and no search. A player can turn off "found by username" and use the friend code only. Guessing is slowed down (10 misses an hour). Someone who knows a username can find out that it exists (that is also true when they try to sign up with it). That is all they learn.
- **Send them something?** A friend request, nothing more: no text, no picture. Requests that are declined are not re-sent for 24 hours, a player can have at most 30 waiting, and each player can send at most 20 an hour. Blocking someone silently stops their requests: they are not told.
- **See when they are online or what they are playing?** Only accepted friends can, and only if the player has not chosen "appear offline".
- **Invite them to a game?** Only a friend, only while they are online, and the invite is only a game and a room code. When the friend presses Join they land in a room the inviter is hosting.
- **Break the server?** The server checks every request, limits its size, and was tested with garbage and trick input (including names like `__proto__`). Any single error is caught and logged instead of stopping the server. A flood of requests is slowed down by the limits, but see "not protected" below.
- **Read the saved data or the code that runs the server through the website?** If the games site is served from the same server, the `server/` folder (which holds the settings and the saved data) and hidden files like `.git` are refused (tested).

## What is NOT protected (the honest list)

1. **A hacked server, a hacked Cloudflare account, or a hacked computer.** Whoever runs the server, controls the Cloudflare account, or breaks into either can see everything in the table above. (Cloudflare itself could too, as the host.) Use a strong password and two-step login on the Cloudflare account. Passwords are scrambled, but a weak or reused password can still be guessed offline from a stolen copy of the data. Tell kids never to reuse a password from another site.
2. **No encryption unless HTTPS is set up.** The hub is on HTTPS, so browsers refuse to talk to a plain `http://` server. Cloudflare gives HTTPS automatically; on your own computer the setup guide covers getting a certificate. Without HTTPS nobody should be using the feature.
3. **Other code on the same web address can read the log-in.** The hub lives at `hkugz11.github.io`, the same address as Hyrum's other public site, and it also hosts a third-party game (Tower of Destiny). Any script that runs on that address could read the saved session token from `localStorage`. Moving the games site to its own server or address (planned) fixes the "other site" part; the third-party game stays a small risk until it is moved or separated.
4. **Rate limits are only as good as the address the server can see.** On Cloudflare the real address of every visitor is known, so the limits work per person. On your own computer behind a plain tunnel (playit.gg), every visitor looks like the same address, so the "per address" limits become one limit for everybody. That is still a brake on floods, but one attacker could use up the shared allowance and block sign-ups or log-ins for a while. (A wrong-password lock can also be triggered on purpose against one account; it is capped at 15 minutes.) A proper reverse proxy (nginx, Caddy) with `"trustProxy": true` gives real per-address limits.
5. **No password reset by email**, because there is no email. A forgotten password is fixed by the operator with `node admin.js resetpw NAME`, and the operator has to be sure it really is that person (for example by asking in real life).
6. **Moderation is one person.** Reports are a list that the operator reads with `node admin.js reports`. Nobody is watching all the time. Please agree who looks at it and how often (a weekly look is a sensible minimum), and what happens when the operator is away. A report also blocks the person, so the reporter is protected straight away.
7. **A pop-up shows on the screen.** An invite notification contains the friend's username and the game name, and it appears wherever the browser shows notifications (including over a screen share or a shared family computer's screen). Turn it off in Settings on shared devices. The chime is off in Settings too.
8. **Names are not checked for meaning.** There is a small list of banned words (admin, staff, hkugz and so on) and a phone-number check, not a swear-word filter. Report and ban are the safety net.
9. **Room codes and in-game names are not part of this system.** After pressing Join, a player is in a normal game room: they can see the other players' in-game names (typed by each player, up to 12 characters) and, because the games connect directly (WebRTC), other players in the room can see their network address. That is how the games already worked, and the games' pages say so.
10. **Age rules.** The sign-up form asks people to tick "I am 13 or older, or a parent or guardian said it is OK". Anyone can tick it, so it is a reminder and a record of intent, not a check. Whether a username plus friends list for under-13s counts as personal information under US children's privacy law (COPPA) is a question for an adult to settle (the FTC hotline or a lawyer), not something the code can answer.
11. **Backups and "what if nobody looks after it".** On Cloudflare the saved data is in Cloudflare's storage; whoever runs it can save everything to one file with `node admin.js export` (that file holds everyone's scrambled passwords and friend lists, so it must be kept private and never committed; it is also how the accounts are moved to the Ubuntu server), and without a saved copy the accounts would be lost if the Cloudflare account were lost; on your own computer it is one file (`server/data/db.json`) that you can copy. If the person running it stops, the safe shutdown is: set `window.HK_FRIENDS_API = ""` in `assets/friends-config.js` (everything disappears from the site), then delete the server (`npx wrangler delete` on Cloudflare, or stop it and delete `server/data/`).

## Questions to go through together

- Who is the operator, and which adult can reach the server if something goes wrong?
- Is a sign-up code set, and who hands it out? (Recommended: a closed group of people Hyrum knows.)
- Who reads the reports, how often, and what do we do about a serious one?
- Is HTTPS working? (Open the hub, make a test account, and check the address bar of the server shows a lock.)
- Are backups being made?
- Is everyone comfortable with the "not protected" list above? If not, which item should be fixed before it goes live?
