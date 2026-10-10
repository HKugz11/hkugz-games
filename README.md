# HKugz Games

Free browser games, built by HKugz. Everything runs in your browser: no downloads, no sign-ups, no ads, no tracking.

| Game | Type |
|---|---|
| **Tower of Destiny** | Unofficial fan remake (see below) |
| **Blaster Arena** | Original 3D shooter vs bots (Three.js): 8 maps (4 classic + 4 huge Battle Royale maps: Candy Canyon, Jungle Temple, Skyline City, Moonbase Alpha), 6 modes (incl. player-vs-player Brawl, Battle Royale and a Freeplay practice range), 11 blasters with rarities and ammo, a 5-slot hotbar, chests, solo or online co-op for up to 4 players. Runs on Chromebooks (auto Low-graphics mode, trackpad-friendly aim toggle; touch controls for phones and tablets: floating joystick, look pad, fire/aim/jump buttons, tappable hotbar) |
| **Fort Fight** | Original building shooter (Three.js), first person with a third-person option: walls, floors, stairs and roofs on a grid with materials and HP, editing (cut doors, windows and holes), a build range with a sky-ring ramp challenge, box fights (first to 5 rounds), a 6-player island free-for-all against bots, and online play for up to 4 players (box fights or building together, room codes through PeerJS). Auto Low-graphics mode for Chromebooks; touch controls for phones and tablets (joystick, look pad, build and edit buttons) |
| **Sky Tower** | Original 3D obby tower climber (Three.js): a generated tower of 10 themed stages (moving platforms and lifts, crumbling tiles, ice, bounce pads, conveyor belts, spinning bars, hammers, pistons, zap strips) with checkpoints, best times, a seeded Random Tower and a no-checkpoint Hardcore mode. Auto Low-graphics mode for Chromebooks |
| **Kart Rush** | Original toon kart racer (Three.js): 3 tracks (Sunny Loop, Neon City, Frosty Peaks with ice patches), 8 karts with 3 kart types, drifting with 3 mini-turbo tiers, boost pads, rocket start, item boxes (turbo, rockets, oil slicks, shield, zap, with rubber-banded item odds), Grand Prix points over all three tracks, single races, time trial with saved best laps, 3 robot difficulties. Auto Low-graphics mode for Chromebooks; touch controls for phones and tablets (steer stick, drift, item, brake, automatic gas) |
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

Blaster Arena, Fort Fight, Sky Tower and Kart Rush bundle [Three.js](https://threejs.org/) r160 (MIT license, see `games/blaster-arena/THREE-LICENSE.txt` and `games/fort-fight/THREE-LICENSE.txt`) and [PeerJS](https://peerjs.com/) 1.5.4 (MIT license, see `games/blaster-arena/vendor/PEERJS-LICENSE.txt` and `games/fort-fight/vendor/PEERJS-LICENSE.txt`).

### Blaster Arena online co-op

One player hosts and gets a 5-letter room code; up to 3 friends join with it. Players connect directly (WebRTC). The free PeerJS Cloud service is only used to introduce them to each other, so players can see each other's network address; only share your room code with people you know. The host runs the bots; there is no chat, only player names. For offline testing, open two tabs with `?net=local`.

### Fort Fight online play

Same idea as Blaster Arena: the host gets a 5-letter room code and up to 3 friends join with it, connected directly (WebRTC) with PeerJS Cloud only used to introduce the players. The host runs the rules (rounds, wall health); every player simulates themselves and applies their own damage. Box fights are 1v1 (first to 5 rounds) or a 3-4 player free-for-all (first to 3 round wins); the Build Range can also be shared.
