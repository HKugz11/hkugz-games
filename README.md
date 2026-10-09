# HKugz Games

Free browser games, built by HKugz. Everything runs in your browser: no downloads, no sign-ups, no ads, no tracking.

| Game | Type |
|---|---|
| **Tower of Destiny** | Unofficial fan remake (see below) |
| **Blaster Arena** | Original 3D shooter vs bots (Three.js): 8 maps (4 classic + 4 huge Battle Royale maps: Candy Canyon, Jungle Temple, Skyline City, Moonbase Alpha), 6 modes (incl. player-vs-player Brawl, Battle Royale and a Freeplay practice range), 11 blasters with rarities and ammo, a 5-slot hotbar, chests, solo or online co-op for up to 4 players. Runs on Chromebooks (auto Low-graphics mode, trackpad-friendly aim toggle) |
| **Block Stack** | Original one-button game |
| **Cube Flap** | Original one-button game |
| **Snake** | Classic |
| **Breakout** | Classic |
| Scratch game | Coming soon |

Scores and progress are saved only in your own browser (`localStorage`).

## About the Tower of Destiny remake

Tower of Destiny is a one-button game by its original creators. This is a free, non-commercial **fan remake**, made for fun.
It is not affiliated with or endorsed by the original creators. All code and artwork here was written from scratch.

- Play the original: https://www.coolmathgames.com/0-tower-of-destiny
- If you are the original creator and would like anything changed or removed, please open an issue on this repository and it will be taken care of right away.

## Running locally

It is a plain static site. Serve the folder with any static file server, for example `npx serve` or `python -m http.server`, and open `index.html`.

## Third-party code

Blaster Arena bundles [Three.js](https://threejs.org/) r160 (MIT license, see `games/blaster-arena/THREE-LICENSE.txt`) and [PeerJS](https://peerjs.com/) 1.5.4 (MIT license, see `games/blaster-arena/vendor/PEERJS-LICENSE.txt`).

### Blaster Arena online co-op

One player hosts and gets a 5-letter room code; up to 3 friends join with it. Players connect directly (WebRTC). The free PeerJS Cloud service is only used to introduce them to each other, so players can see each other's network address; only share your room code with people you know. The host runs the bots; there is no chat, only player names. For offline testing, open two tabs with `?net=local`.
