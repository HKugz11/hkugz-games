// CrazyGames SDK integration for the CrazyGames version of Core Strike (Basic Launch: no advertising, no account requirement).
//   * loading / gameplay start + stop events, and the platform's mute setting
//   * INVITES: your room is reported to CrazyGames, so friends join with the CrazyGames "Invite" button or friends list (nobody types a room code)
// Everything is optional: if the SDK cannot load (for example when you open the files on your own computer) the game just runs normally.
let sdk = null, ready = false, loaded = false, wanted = false, sent = false;
// Enable only for an approved Full Launch build.
const FULL_LAUNCH_ADS = false;
let adMuted = false;
let muteListener = () => {};
const call = (method) => { try { sdk.game[method](); return true; } catch (error) { console.warn('CrazyGames ' + method, error); return false; } };
function sync() {
  if (!ready || !loaded || sent === wanted) return;
  if (call(wanted ? 'gameplayStart' : 'gameplayStop')) sent = wanted;
}
export const platform = {
  get canReward() { return FULL_LAUNCH_ADS && ready && this.active && typeof sdk.ad?.requestAd === 'function'; },
  async reward() {
    if (!this.canReward) return false;
    try {
      return await new Promise(resolve => sdk.ad.requestAd('rewarded', {
        adStarted: () => { adMuted = true; muteListener(true); },
        adFinished: () => resolve(true),
        adError: () => resolve(false)
      }));
    } catch { return false; }
    finally { adMuted=false; muteListener(!!sdk.game.settings?.muteAudio); }
  },
  onMute(listener) { muteListener = listener; if (ready) listener(!!sdk.game.settings?.muteAudio); },
  setPlaying(value) { wanted = !!value; sync(); },
  loaded() { loaded = true; if (ready) call('loadingStop'); sync(); },

  // ---- invites -----------------------------------------------------------------------------------
  whenReady: () => initDone,                                             // resolves once the SDK has started (or failed to)
  // true when we are on CrazyGames (or its local test mode): then friends are invited through CrazyGames, not with a room code
  get active() { return ready && (sdk.environment === 'crazygames' || sdk.environment === 'local'); },
  // the room a friend invited us to (from the invite link we were opened with), or ''
  inviteRoom() { try { const r = sdk.game.getInviteParam('room'); return r ? String(r) : ''; } catch { return ''; } },
  // CrazyGames' "Play with friends" button opens the game with this on: go straight into a new private room
  get instant() { try { return !!sdk.game.isInstantMultiplayer; } catch { return false; } },
  // a friend accepted an invite while the game is already open: no page reload, just join
  onJoinRoom(listener) { try { sdk.game.addJoinRoomListener((params) => listener(params && (params.room ?? params.roomName) ? String(params.room ?? params.roomName) : '')); } catch (error) { console.warn('CrazyGames join listener', error); } },
  // tell CrazyGames which room we are in and whether friends can join it right now
  setRoom(code, joinable) { try { sdk.game.updateRoom({ roomId: String(code), isJoinable: !!joinable, inviteParams: { room: String(code) } }); } catch (error) { console.warn('CrazyGames updateRoom', error); } },
  leaveRoom() { try { sdk.game.leftRoom(); } catch (error) { console.warn('CrazyGames leftRoom', error); } },
  inviteLink(code) { try { return String(sdk.game.inviteLink({ room: String(code) }) || ''); } catch { return ''; } },
  // the player's CrazyGames name, so friends recognise each other (null when not logged in)
  async userName() { try { const u = await sdk.user.getUser(); return u && u.username ? String(u.username) : null; } catch { return null; } },
};

async function initialize() {
  try {
    // A blocked SDK must never leave the game stuck on a loading screen.
    await new Promise((resolve, reject) => {
      if (window.CrazyGames?.SDK) return resolve();
      const script = document.createElement('script');
      const timer = setTimeout(() => reject(new Error('SDK load timed out')), 6000);
      script.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); reject(new Error('SDK unavailable')); };
      document.head.appendChild(script);
    });
    sdk = window.CrazyGames.SDK;
    await sdk.init();
    ready = true;
    muteListener(!!sdk.game.settings?.muteAudio);
    sdk.game.addSettingsChangeListener(settings => muteListener(adMuted || !!settings.muteAudio));
    call('loadingStart');
    if (loaded) call('loadingStop');
    sync();
  } catch (error) { console.warn('CrazyGames integration unavailable; continuing locally.', error); }
}
const initDone = initialize();
