// HKugz Games friends: optional accounts, friends and game invites. Loaded on the hub and on the three games with online play.
// It does nothing at all (no network, nothing on screen) until assets/friends-config.js names a friends server, and nothing is sent
// unless you log in. No account is needed to play any game. What the server stores: docs/FRIENDS-SAFETY.md.
// The panel lives in a shadow root, so a game's own styles and key presses can't touch it (and the other way round).
(function () {
  'use strict';
  const GAMES = { 'blaster-arena': 'Blaster Arena', 'fort-fight': 'Fort Fight', 'core-strike': 'Core Strike' };
  const ROOM_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$/;
  let api = window.HK_FRIENDS_API;
  const localHost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  try { // for testing on this computer only: ?hkapi=http://localhost:8787 points the page at a test server
    const q = new URLSearchParams(location.search).get('hkapi');
    if (localHost && q) sessionStorage.setItem('hkapi', q);
    if (localHost && sessionStorage.getItem('hkapi')) api = sessionStorage.getItem('hkapi');
  } catch (e) {}
  if (!api) return;
  api = api === 'same' ? location.origin : String(api).replace(/\/+$/, '');
  const me = document.currentScript, base = me && me.src ? me.src.replace(/assets\/hkfriends\.js.*$/, '') : '/';

  // ---------------------------------------------------------------- tiny helpers
  const store = { get() { try { return JSON.parse(localStorage.getItem('hkfriends')) || {}; } catch (e) { return {}; } }, set(o) { try { localStorage.setItem('hkfriends', JSON.stringify(o)); } catch (e) {} } };
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const k in props || {}) { const v = props[k]; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  }
  const where = () => { const m = /\/games\/([a-z-]+)\//.exec(location.pathname); return m && GAMES[m[1]] ? m[1] : 'hub'; };
  const room = () => { const r = window.HKRoom; return r && typeof r.code === 'string' && ROOM_RE.test(r.code) && GAMES[r.game] ? { game: r.game, code: r.code } : null; };   // each game publishes its room code here
  const gameName = slug => GAMES[slug] || 'the hub';

  let sess = store.get(); if (sess.api !== api) sess = {};
  let token = sess.t || '', name = sess.n || '', state = null, info = null, open = false, mode = 'login', fails = 0, pollT = 0, lastKey = '', moreFor = '', reportFor = '', msgT = 0;
  const shown = new Set();

  function call(path, body) {
    return fetch(api + path, { method: body === undefined ? 'GET' : 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token && body !== undefined ? { Authorization: 'Bearer ' + token } : {}), body: body === undefined ? undefined : JSON.stringify(body) })
      .then(r => r.json().catch(() => ({})).then(j => { if (!r.ok) { const e = new Error(j.error || 'Something went wrong.'); e.status = r.status; throw e; } return j; }),
        () => { const e = new Error('Can not reach the friends server right now.'); e.status = 0; throw e; });
  }

  // ---------------------------------------------------------------- the page bits
  const CSS = `
:host{all:initial}*{box-sizing:border-box;font-family:"Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif}
button,input{font:inherit}[hidden]{display:none!important}
.pill{position:fixed;top:8px;left:8px;z-index:2147482000;width:36px;height:36px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.4);background:rgba(20,16,28,.8);color:#fff;cursor:pointer;display:grid;place-items:center;opacity:.8}
.pill:hover,.pill:focus-visible{opacity:1;background:rgba(58,47,79,.95)}
.dot{position:absolute;top:-4px;right:-4px;min-width:17px;height:17px;border-radius:9px;background:#ff7a1a;color:#1a0c00;font-weight:800;font-size:11px;line-height:17px;text-align:center;padding:0 4px}
.back{position:fixed;inset:0;z-index:2147482001;background:rgba(8,40,52,.45);opacity:0;pointer-events:none;transition:opacity .2s}
.back.on{opacity:1;pointer-events:auto}
.panel{position:fixed;top:0;right:0;bottom:0;z-index:2147482002;width:min(410px,100vw);background:#e9fafd;color:#0b2a33;display:flex;flex-direction:column;box-shadow:-8px 0 30px rgba(0,0,0,.35);transform:translateX(106%);transition:transform .2s;font-size:15px;line-height:1.35}
.panel.on{transform:none}
.head{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#42d7f1;font-size:19px}.head b{flex:1}
.x{border:0;background:rgba(255,255,255,.6);border-radius:50%;width:32px;height:32px;font-size:20px;line-height:1;cursor:pointer;color:#0b2a33}
.body{flex:1;overflow:auto;padding:12px 14px 22px}
.card{background:#fff;border-radius:14px;padding:12px 14px;margin:0 0 12px;box-shadow:0 3px 10px rgba(8,60,80,.15)}
h3{margin:0 0 8px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;opacity:.7}
p{margin:6px 0}.small{font-size:13px;opacity:.75}
input[type=text],input[type=password]{width:100%;padding:10px 12px;border:2px solid rgba(11,42,51,.25);border-radius:12px;font-size:16px;background:#fff;color:#0b2a33;margin:4px 0 8px}
input:focus{outline:none;border-color:#7a3bff}label{display:block;font-weight:700;font-size:14px}
.chk{display:flex;gap:8px;align-items:flex-start;font-weight:600;font-size:13px;margin:6px 0 10px}.chk input{margin-top:3px;width:18px;height:18px;flex:none}
.btn{display:inline-block;border:0;cursor:pointer;background:#ff7a1a;color:#1a0c00;font-weight:800;font-size:14px;padding:8px 14px;border-radius:12px;box-shadow:0 3px 0 #a24a00}
.btn:hover{filter:brightness(1.06)}.btn:active{transform:translateY(2px);box-shadow:0 1px 0 #a24a00}
.btn.alt{background:#7a3bff;color:#fff;box-shadow:0 3px 0 #3a1a9a}.btn.ghost{background:#fff;color:#0b2a33;box-shadow:0 3px 0 rgba(11,42,51,.25)}
.btn.sm{font-size:13px;padding:5px 10px;border-radius:10px}.btn.danger{background:#d6402f;color:#fff;box-shadow:0 3px 0 #8a2418}
.btn[disabled]{opacity:.5;cursor:not-allowed}
.tabs{display:flex;gap:6px;margin:0 0 12px}.tabs .btn{flex:1}
.row{display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid rgba(11,42,51,.1)}.row:first-of-type{border-top:0}
.row .nm{flex:1;min-width:0;overflow-wrap:anywhere;font-weight:700}.row .nm small{display:block;font-weight:500;opacity:.7}
.on-dot{width:11px;height:11px;border-radius:50%;background:#bbb;flex:none}.on-dot.y{background:#1bb552;box-shadow:0 0 0 3px rgba(27,181,82,.25)}
.more{display:flex;flex-wrap:wrap;gap:6px;padding:0 0 8px 19px}
.code{font:800 24px/1 ui-monospace,Consolas,monospace;letter-spacing:.08em}
.msg{min-height:1.2em;font-weight:700;font-size:14px;margin:4px 0}.msg.ok{color:#0b6a3a}.msg.err{color:#b3261e}
.inline{display:flex;gap:8px}.inline input{margin:0}
.toasts{position:fixed;top:54px;left:50%;transform:translateX(-50%);z-index:2147482003;display:flex;flex-direction:column;gap:8px;width:min(460px,94vw);pointer-events:none}
.toast{pointer-events:auto;display:flex;align-items:center;gap:10px;background:#fff;color:#0b2a33;border-radius:14px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.4);border:2px solid #ff7a1a}
.toast span{flex:1;font-size:14px}.toast b{font-weight:800}
details summary{cursor:pointer;font-weight:700;font-size:14px}
.danger-zone{margin-top:6px;padding-top:8px;border-top:1px dashed rgba(11,42,51,.25)}
.reasons{display:flex;flex-wrap:wrap;gap:6px;padding:0 0 8px 19px}.reasons span{font-size:13px;width:100%}
`;
  const host = h('div', { id: 'hkf-root' }), root = host.attachShadow({ mode: 'open' });
  const dotEl = h('span', { class: 'dot', hidden: true });
  const pill = h('button', { class: 'pill', type: 'button', 'aria-label': 'Friends', title: 'Friends', onclick: () => toggle() }, dotEl);
  pill.insertAdjacentHTML('afterbegin', '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 19c0-3.6 2.9-5.6 6.5-5.6s6.5 2 6.5 5.6z"/><circle cx="17.2" cy="9" r="2.6" opacity=".8"/><path d="M16.3 13.6c3.1-.3 5.2 1.4 5.2 4.4h-4.4c0-1.8-.3-3.3-.8-4.4z" opacity=".8"/></svg>');
  const toasts = h('div', { class: 'toasts' }), back = h('div', { class: 'back', onclick: () => close() });
  const body = h('div', { class: 'body' });
  const panel = h('div', { class: 'panel', role: 'dialog', 'aria-label': 'Friends' }, h('div', { class: 'head' }, h('b', { text: 'Friends' }), h('button', { class: 'x', type: 'button', 'aria-label': 'Close', onclick: () => close(), text: '×' })), body);
  for (const t of ['keydown', 'keyup', 'keypress']) panel.addEventListener(t, e => { e.stopPropagation(); if (t === 'keydown' && e.key === 'Escape') close(); });   // typing here must not move your player
  root.append(h('style', { text: CSS }), pill, toasts, back, panel);
  const hubBtn = document.getElementById('hkFriendsBtn');
  function mount() {
    document.body.append(host);
    if (hubBtn) { hubBtn.hidden = false; pill.hidden = true; hubBtn.addEventListener('click', e => { e.preventDefault(); toggle(); }); }
    const note = document.getElementById('hkFriendsNote'); if (note) note.hidden = false;
    document.addEventListener('pointerlockchange', () => { pill.hidden = !!hubBtn || !!document.pointerLockElement; });
    render(true); if (token) poll();
  }

  // ---------------------------------------------------------------- open / close
  function toggle() { open ? close() : openPanel(); }
  function openPanel() { open = true; try { if (document.exitPointerLock) document.exitPointerLock(); } catch (e) {} panel.classList.add('on'); back.classList.add('on'); render(true); if (token) poll(true); else loadInfo(); }
  function close() { open = false; panel.classList.remove('on'); back.classList.remove('on'); }

  const sayEl = h('div', { class: 'msg', 'aria-live': 'polite' });
  function say(text, ok) { sayEl.textContent = text || ''; sayEl.className = 'msg ' + (text ? (ok ? 'ok' : 'err') : ''); clearTimeout(msgT); if (text) msgT = setTimeout(() => say(''), 7000); }

  // ---------------------------------------------------------------- signed out
  function loadInfo() { if (info) return; call('/api/info').then(i => { info = i; if (!token) render(true); }).catch(e => { if (!token) say(e.message, false); }); }
  function viewOut() {
    const tab = (id, label) => h('button', { type: 'button', class: 'btn ' + (mode === id ? '' : 'ghost'), text: label, onclick: () => { mode = id; say(''); viewOut(); } });
    const user = h('input', { type: 'text', maxlength: 16, autocomplete: 'username', autocapitalize: 'off', spellcheck: 'false', id: 'hkf-u' }), pw = h('input', { type: 'password', maxlength: 100, autocomplete: mode === 'login' ? 'current-password' : 'new-password', id: 'hkf-p' });
    const code = h('input', { type: 'text', maxlength: 40, autocomplete: 'off', autocapitalize: 'off', id: 'hkf-c' }), agree = h('input', { type: 'checkbox', id: 'hkf-a' });
    const go = h('button', { class: 'btn', type: 'submit', text: mode === 'login' ? 'Log in' : 'Make my account' });
    const form = h('form', { onsubmit: e => {
      e.preventDefault(); go.disabled = true; say('');
      const req = mode === 'login' ? call('/api/login', { username: user.value.trim(), password: pw.value }) : call('/api/signup', { username: user.value.trim(), password: pw.value, signupCode: code.value, agree: agree.checked });
      req.then(r => { token = r.token; name = r.me.name; store.set({ api, t: token, n: name }); state = null; lastKey = ''; render(true); poll(true); })
        .catch(err => { say(err.message, false); go.disabled = false; });
    } },
      h('label', { for: 'hkf-u', text: 'Username' }), user,
      mode === 'signup' ? h('p', { class: 'small', text: 'Make one up. 3 to 16 letters, numbers or _. Please do not use your real name.' }) : null,
      h('label', { for: 'hkf-p', text: 'Password' }), pw,
      mode === 'signup' && info && info.codeRequired ? [h('label', { for: 'hkf-c', text: 'Sign-up code' }), code, h('p', { class: 'small', text: 'Ask the person who runs the site for the code.' })] : null,
      mode === 'signup' ? h('label', { class: 'chk' }, agree, h('span', { text: 'I am 13 or older, or a parent or guardian said it is OK for me to make an account.' })) : null,
      go);
    body.replaceChildren(
      h('div', { class: 'card' }, h('p', { text: 'Friends are optional. You never need an account to play.' }), h('p', { class: 'small', text: 'An account is just a username and a password. No email, no real name, and there is no chat: friends can only see when you are online and invite you to a game.' })),
      h('div', { class: 'tabs' }, tab('login', 'Log in'), tab('signup', 'Make an account')),
      h('div', { class: 'card' }, form, sayEl),
      h('p', { class: 'small' }, 'Never share your password. ', h('a', { href: base + 'docs/FRIENDS-SAFETY.md', target: '_blank', rel: 'noopener', text: 'What is stored and what is not protected' })));
    if (mode === 'signup' && info && info.signupsOpen === false) say('Sign-ups are closed right now.', false);
  }

  // ---------------------------------------------------------------- signed in
  const els = {};
  function viewIn() {
    const copy = h('button', { class: 'btn sm ghost', type: 'button', text: 'Copy', onclick: () => { const c = (state && state.me.friendCode) || ''; try { navigator.clipboard.writeText(c); copy.textContent = 'Copied!'; setTimeout(() => (copy.textContent = 'Copy'), 1500); } catch (e) {} } });
    els.who = h('b'); els.code = h('div', { class: 'code' }); els.room = h('p', { class: 'small' });
    els.invites = h('div'); els.requests = h('div'); els.friends = h('div'); els.blocked = h('div');
    const addIn = h('input', { type: 'text', maxlength: 40, placeholder: 'Username or friend code', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Username or friend code' });
    const addBtn = h('button', { class: 'btn', type: 'submit', text: 'Add' });
    els.offline = h('input', { type: 'checkbox', onchange: () => call('/api/settings', { appearOffline: els.offline.checked }).then(() => poll(true)).catch(e => say(e.message, false)) });
    els.byName = h('input', { type: 'checkbox', onchange: () => call('/api/settings', { byName: els.byName.checked }).then(() => poll(true)).catch(e => say(e.message, false)) });
    const pwOld = h('input', { type: 'password', maxlength: 100, placeholder: 'Old password', autocomplete: 'current-password' }), pwNew = h('input', { type: 'password', maxlength: 100, placeholder: 'New password (8 or more)', autocomplete: 'new-password' });
    const delPw = h('input', { type: 'password', maxlength: 100, placeholder: 'Your password', autocomplete: 'current-password' });
    body.replaceChildren(
      h('div', { class: 'card' }, h('div', { class: 'row' }, h('span', { class: 'nm' }, 'Hi, ', els.who), h('button', { class: 'btn sm ghost', type: 'button', text: 'Log out', onclick: () => logout() })),
        h('p', { class: 'small', text: 'Your friend code (anyone you give it to can ask to be your friend):' }), h('div', { class: 'inline' }, els.code, copy)),
      sayEl, els.invites,
      h('div', { class: 'card' }, h('h3', { text: 'Add a friend' }), h('form', { class: 'inline', onsubmit: e => { e.preventDefault(); const v = addIn.value.trim(); if (!v) return; addBtn.disabled = true; call('/api/friend/request', { to: v }).then(r => { say(r.result === 'friends' ? 'You and ' + r.name + ' are friends now!' : 'Request sent' + (r.name ? ' to ' + r.name : '') + '.', true); addIn.value = ''; poll(true); }).catch(err => say(err.message, false)).then(() => (addBtn.disabled = false)); } }, addIn, addBtn)),
      els.requests,
      h('div', { class: 'card' }, h('h3', { text: 'Friends' }), els.room, els.friends),
      els.blocked,
      h('div', { class: 'card' }, h('details', {}, h('summary', { text: 'Settings' }),
        h('label', { class: 'chk' }, els.offline, h('span', { text: 'Appear offline (friends can not see you or invite you)' })),
        h('label', { class: 'chk' }, els.byName, h('span', { text: 'Let people add me by username. Turn off to be found by friend code only.' })),
        h('button', { class: 'btn sm ghost', type: 'button', text: 'Get a new friend code', onclick: () => { if (confirm('Make a new friend code? The old one stops working.')) call('/api/code/reset', {}).then(() => { say('New friend code!', true); poll(true); }).catch(e => say(e.message, false)); } }),
        h('p', { class: 'small', text: 'Change my password' }), pwOld, pwNew,
        h('button', { class: 'btn sm', type: 'button', text: 'Change password', onclick: () => call('/api/password', { oldPassword: pwOld.value, newPassword: pwNew.value }).then(r => { token = r.token; store.set({ api, t: token, n: name }); pwOld.value = pwNew.value = ''; say('Password changed.', true); }).catch(e => say(e.message, false)) }),
        h('div', { class: 'danger-zone' }, h('p', { class: 'small', text: 'Delete my account and everything about it:' }), delPw,
          h('button', { class: 'btn sm danger', type: 'button', text: 'Delete my account', onclick: () => { if (confirm('Really delete your account? This can not be undone.')) call('/api/account/delete', { password: delPw.value }).then(() => logout(false, 'Your account was deleted.')).catch(e => say(e.message, false)); } })))),
      h('p', { class: 'small' }, h('a', { href: base + 'docs/FRIENDS-SAFETY.md', target: '_blank', rel: 'noopener', text: 'What is stored and what is not protected' })));
  }

  const nobody = t => h('p', { class: 'small', text: t });
  function fill() {
    if (!state || !els.who) return;
    els.who.textContent = state.me.name; els.code.textContent = state.me.friendCode;
    if (document.activeElement !== els.offline) els.offline.checked = !!state.me.appearOffline;
    if (document.activeElement !== els.byName) els.byName.checked = state.me.byName !== false;
    const rm = room();
    els.room.textContent = rm ? 'Your room: ' + rm.code + ' in ' + gameName(rm.game) + '. Press Invite next to a friend who is online.' : where() === 'hub' ? 'To invite a friend: open a game, press Host (or Host online), then open Friends there.' : 'Host a game (or join one) first, then you can invite friends to it.';
    // invites
    els.invites.replaceChildren(...state.invites.map(inv => h('div', { class: 'card', style: 'border:2px solid #ff7a1a' }, h('div', { class: 'row' }, h('span', { class: 'nm' }, h('b', { text: inv.from }), ' invited you to ', h('b', { text: inv.gameName }), h('small', { text: 'Room ' + inv.code })), h('button', { class: 'btn sm', type: 'button', text: 'Join', onclick: () => join(inv) }), h('button', { class: 'btn sm ghost', type: 'button', text: 'No', onclick: () => dismiss(inv.id) })))));
    // requests
    const reqs = [...state.incoming.map(r => h('div', { class: 'row' }, h('span', { class: 'nm', text: r.from }), h('button', { class: 'btn sm', type: 'button', text: 'Accept', onclick: () => respond(r.from, true) }), h('button', { class: 'btn sm ghost', type: 'button', text: 'Decline', onclick: () => respond(r.from, false) }), h('button', { class: 'btn sm ghost', type: 'button', text: 'Block', onclick: () => blockUser(r.from) }))),
      ...state.outgoing.map(r => h('div', { class: 'row' }, h('span', { class: 'nm' }, r.to, h('small', { text: 'waiting for them to answer' })), h('button', { class: 'btn sm ghost', type: 'button', text: 'Cancel', onclick: () => doIt('/api/friend/cancel', { to: r.to }) })))];
    els.requests.replaceChildren(...(reqs.length ? [h('div', { class: 'card' }, h('h3', { text: 'Friend requests' }), reqs)] : []));
    // friends
    const rows = state.friends.map(f => {
      const r = h('div', { class: 'row' }, h('i', { class: 'on-dot' + (f.online ? ' y' : '') }), h('span', { class: 'nm' }, f.name, h('small', { text: f.online ? (f.at && f.at !== 'hub' ? 'in ' + gameName(f.at) : 'online') : 'offline' })),
        f.online ? h('button', { class: 'btn sm', type: 'button', text: 'Invite', disabled: !rm, title: rm ? '' : 'Host a game first', onclick: () => invite(f.name) }) : null,
        h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': 'More for ' + f.name, text: '⋯', onclick: () => { moreFor = moreFor === f.name ? '' : f.name; reportFor = ''; fill(); } }));
      if (moreFor !== f.name) return [r];
      const more = h('div', { class: 'more' }, h('button', { class: 'btn sm ghost', type: 'button', text: 'Remove friend', onclick: () => { if (confirm('Remove ' + f.name + ' from your friends?')) doIt('/api/friend/remove', { who: f.name }); } }),
        h('button', { class: 'btn sm ghost', type: 'button', text: 'Block', onclick: () => blockUser(f.name) }), h('button', { class: 'btn sm danger', type: 'button', text: 'Report', onclick: () => { reportFor = reportFor === f.name ? '' : f.name; fill(); } }));
      const reasons = reportFor === f.name ? [h('div', { class: 'reasons' }, h('span', { text: 'Why? (this also blocks them)' }), ...[['bad-name', 'Bad name'], ['harassment', 'Mean or bullying'], ['cheating', 'Cheating'], ['other', 'Something else']].map(([k, t]) => h('button', { class: 'btn sm ghost', type: 'button', text: t, onclick: () => { reportFor = moreFor = ''; doIt('/api/report', { who: f.name, reason: k }, 'Thanks. ' + f.name + ' is blocked and the report was sent.'); } })))] : [];
      return [r, more, ...reasons];
    }).flat();
    els.friends.replaceChildren(...(rows.length ? rows : [nobody('No friends yet. Add one with their username or friend code above.')]));
    // blocked
    els.blocked.replaceChildren(...(state.blocked.length ? [h('div', { class: 'card' }, h('details', {}, h('summary', { text: 'Blocked players (' + state.blocked.length + ')' }), state.blocked.map(n => h('div', { class: 'row' }, h('span', { class: 'nm', text: n }), h('button', { class: 'btn sm ghost', type: 'button', text: 'Unblock', onclick: () => doIt('/api/unblock', { who: n }) })))))] : []));
  }

  // ---------------------------------------------------------------- actions
  function doIt(path, bodyObj, okMsg) { return call(path, bodyObj).then(() => { if (okMsg) say(okMsg, true); poll(true); }).catch(e => say(e.message, false)); }
  const respond = (from, accept) => doIt('/api/friend/respond', { from, accept });
  const blockUser = n => { if (confirm('Block ' + n + '? They will not be able to find you or see when you are online.')) doIt('/api/block', { who: n }, n + ' is blocked.'); };
  function invite(to) {
    const rm = room(); if (!rm) { say('Host a game first, then invite your friend.', false); return; }
    call('/api/invite', { to, game: rm.game, code: rm.code }).then(() => say('Invited ' + to + '!', true)).catch(e => say(e.message, false));
  }
  const dismiss = id => { call('/api/invite/dismiss', { id }).catch(() => {}); if (state) state.invites = state.invites.filter(i => i.id !== id); fill(); for (const t of toasts.children) if (t.dataset.id === id) t.remove(); updateBadge(); };
  function join(inv) {
    if (!GAMES[inv.game] || !ROOM_RE.test(inv.code)) return;                       // never build a link out of anything unexpected
    const rm = room(); if (rm && !confirm('You are in a room already. Leave it and join ' + inv.from + '?')) return;
    call('/api/invite/dismiss', { id: inv.id }).catch(() => {}).then(() => { location.href = base + 'games/' + inv.game + '/?join=' + inv.code; });
  }
  function logout(quiet, msg) {
    if (token && !quiet) call('/api/logout', {}).catch(() => {});
    token = ''; name = ''; state = null; lastKey = ''; store.set({}); clearTimeout(pollT); toasts.replaceChildren(); updateBadge(); render(true); if (msg) say(msg, !quiet || msg === 'Your account was deleted.');
  }

  // ---------------------------------------------------------------- polling (about every 8 seconds while the page is on screen)
  function poll(now) {
    clearTimeout(pollT); if (!token) return;
    if (document.visibilityState !== 'visible') { pollT = setTimeout(poll, 4000); return; }   // a hidden tab shows up as offline and uses no data
    const tokenAtStart = token;
    call('/api/poll', { at: where() }).then(st => {
      if (token !== tokenAtStart) return;
      fails = 0; state = st; name = st.me.name;
      const key = JSON.stringify([st.me, st.friends, st.incoming, st.outgoing, st.blocked, st.invites.map(i => i.id)]);
      if (key !== lastKey) { lastKey = key; fill(); }
      for (const inv of st.invites) if (!shown.has(inv.id)) { shown.add(inv.id); toast(inv); }
      updateBadge(); pollT = setTimeout(poll, open ? 5000 : 8000);
    }).catch(e => {
      if (token !== tokenAtStart) return;
      if (e.status === 401) { logout(true, 'You were logged out. Please log in again.'); return; }
      fails++; pollT = setTimeout(poll, Math.min(60000, 8000 * Math.pow(2, fails)));
      if (open) say(e.message, false);
    });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && token) poll(true); });

  function toast(inv) {
    if (!GAMES[inv.game]) return;
    const t = h('div', { class: 'toast', 'data-id': inv.id }, h('span', {}, h('b', { text: inv.from }), ' invited you to ', h('b', { text: inv.gameName })), h('button', { class: 'btn sm', type: 'button', text: 'Join', onclick: () => join(inv) }), h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': 'Dismiss', text: '×', onclick: () => dismiss(inv.id) }));
    toasts.append(t); setTimeout(() => t.remove(), 60000);
  }
  function updateBadge() {
    const n = state ? state.invites.length + state.incoming.length : 0, on = state ? state.friends.filter(f => f.online).length : 0;
    dotEl.hidden = !n; dotEl.textContent = n; pill.title = token ? 'Friends (' + on + ' online)' : 'Friends';
    if (hubBtn) hubBtn.textContent = token ? 'Friends' + (on ? ' · ' + on + ' online' : '') + (n ? ' · ' + n + ' new' : '') : 'Friends';
  }
  function render(force) { if (token) { if (force || !els.who || !els.who.isConnected) { viewIn(); lastKey = ''; if (state) { lastKey = ''; fill(); } } } else viewOut(); updateBadge(); }

  window.HKFriends = { open: openPanel, close, poll, get state() { return state; } };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
