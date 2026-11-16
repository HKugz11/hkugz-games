/* Games-site VAULT client: when you are logged in to the friends panel, your coins and your skins / knives / costumes live on the friends server (so nobody can fake them) and can be given to friends.
   This file only gives the game a tiny helper, window.HKVault. It does nothing (no network at all) until the friends server address is set in assets/friends-config.js AND you are logged in.
   Load it after friends-config.js and before the game. What the server keeps: docs/FRIENDS-SAFETY.md. */
(function () {
  var api = window.HK_FRIENDS_API;
  var localHost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  try { var q = new URLSearchParams(location.search).get('hkapi'); if (localHost && q) sessionStorage.setItem('hkapi', q); if (localHost && sessionStorage.getItem('hkapi')) api = sessionStorage.getItem('hkapi'); } catch (e) {}
  if (!api) return;
  api = api === 'same' ? location.origin : String(api).replace(/\/+$/, '');
  function sess() { try { return JSON.parse(localStorage.getItem('hkfriends')) || {}; } catch (e) { return {}; } }
  function call(path, body) {
    var s = sess(); if (!s.t || s.api !== api) return Promise.reject(Object.assign(new Error('Log in to the friends panel first.'), { status: 401 }));
    var ac = window.AbortController ? new AbortController() : null, tm = ac ? setTimeout(function () { ac.abort(); }, 20000) : 0;
    return fetch(api + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.t }, body: JSON.stringify(body || {}), signal: ac ? ac.signal : undefined }).then(
      function (r) { return r.json().catch(function () { return {}; }).then(function (j) { clearTimeout(tm); if (!r.ok) { var e = new Error(j.error || 'Something went wrong.'); e.status = r.status; throw e; } return j; }); },
      function () { clearTimeout(tm); var e = new Error('Can not reach the server right now.'); e.status = 0; throw e; });
  }
  var H = {
    state: null,
    get active() { var s = sess(); return !!(s.t && s.api === api); },
    get name() { return sess().n || ''; },
    refresh: function () { return call('/api/vault').then(function (v) { H.state = v; return v; }); },
    migrate: function (coins, items) { return call('/api/vault/migrate', { coins: coins, items: items }).then(function (v) { H.state = v; return v; }); },
    open: function (caseId) { return call('/api/vault/open', { case: caseId }); },
    start: function () { return call('/api/vault/start'); },
    earn: function (amount) { return call('/api/vault/earn', { amount: amount }); },
    gift: function (to, item) { return call('/api/vault/gift', { to: to, item: item }).then(function (v) { H.state = v; return v; }); },
    dismiss: function (id) { return call('/api/vault/gift/dismiss', { id: id }); },
    sell: function (items) { return call('/api/vault/sell', { items: items }).then(function (v) { H.state = v; return v; }); },
    marketBrowse: function (o) { return call('/api/market/browse', o || {}); },
    marketList: function (item, price) { return call('/api/market/list', { item: item, price: price }).then(function (v) { H.state = v; return v; }); },
    marketBuy: function (id) { return call('/api/market/buy', { id: id }).then(function (v) { H.state = v; return v; }); },
    marketCancel: function (id) { return call('/api/market/cancel', { id: id }).then(function (v) { H.state = v; return v; }); },
    salesDismiss: function (id) { return call('/api/market/sales/dismiss', { id: id }); },
    friends: function () { return call('/api/poll', { at: 'hub' }).then(function (r) { return (r.friends || []).map(function (f) { return f.name; }); }); }
  };
  window.HKVault = H;
})();
