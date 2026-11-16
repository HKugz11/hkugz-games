// The shop screen: buy board parts, unlock skaters, learn new tricks. Works on the save object from main.js.
import { INFINITE_COINS, MAX_COINS } from './save.js?v=1';
import { PARTS, PRICES, CHARS, PACKS, PARKS, ITEMS, BOARDS, FREE_TRICKS } from './data.js?v=1';
import { boardCanvas } from './boardart.js?v=1';
import { STICKERS, RARITY, STICKER_BOX_PRICE, STICKER_MAX, rollSticker } from './data.js?v=1';
import { stickerCanvas } from './stickerart.js?v=1';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function createShop(ctx) {
  let tab = 'board';

  function coins() { $('shopCoins').textContent = fmt(ctx.save.coins); }

  function priceBtn(price, owned, label, id, action) {
    if (owned) return `<button class="buy owned" disabled>${label}</button>`;
    const can = ctx.save.coins >= price;
    return `<button class="buy ${can ? '' : 'poor'}" data-act="${action}" data-id="${id}">${price ? 'BUY  ' + fmt(price) : 'FREE'}</button>`;
  }

  function renderBoard() {
    return PARTS.map((p) => {
      const lv = ctx.save.parts[p.id] || 0;
      const pips = [0, 1, 2, 3].map((i) => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('');
      const next = lv < 3 ? `Next: <b>${p.levels[lv + 1]}</b> (${p.effect[lv + 1]})` : 'Fully upgraded!';
      const btn = lv < 3 ? priceBtn(PRICES[lv + 1], false, '', p.id, 'part') : '<button class="buy owned" disabled>MAXED</button>';
      return `<div class="item"><div class="txt"><div class="nm">${p.name}: ${p.levels[lv]}</div><div class="ds">${p.desc}</div><div class="pips">${pips}</div><div class="ds">${next}</div></div>${btn}</div>`;
    }).join('');
  }

  function renderChars() {
    // shop order: Mythic Unicorn, Onesie Ollie first, then everybody else in the usual order, Monkey Max very last
    const TOP = ['unicorn', 'onesie'], LAST = ['monkey'];
    const pick = (ids) => ids.map((id) => CHARS.find((x) => x.id === id)).filter(Boolean);
    const list = [...pick(TOP), ...CHARS.filter((x) => !TOP.includes(x.id) && !LAST.includes(x.id)), ...pick(LAST)];
    return list.map((c) => {
      const owned = ctx.save.chars.includes(c.id), on = ctx.save.char === c.id;
      const sw = [c.cfg.shirt, c.cfg.pants, c.cfg.hatColor, c.cfg.skin].map((x) => `<span style="background:${hex(x)}"></span>`).join('');
      let btn;
      if (on) btn = '<button class="buy owned" disabled>EQUIPPED</button>';
      else if (owned) btn = `<button class="buy" data-act="equip" data-id="${c.id}">EQUIP</button>`;
      else btn = priceBtn(c.price, false, '', c.id, 'char');
      return `<div class="item" data-char="${c.id}"><div class="txt"><div class="nm">${c.name}</div><div class="sw">${sw}</div><div class="ds">${c.perkText}</div></div>${btn}</div>`;
    }).join('');
  }

  function renderParks() {
    return PARKS.map((p) => {
      const owned = ctx.save.parks.includes(p.id), on = ctx.save.park === p.id;
      let btn;
      if (on) btn = '<button class="buy owned" disabled>SELECTED</button>';
      else if (owned) btn = `<button class="buy" data-act="selpark" data-id="${p.id}">SELECT</button>`;
      else btn = priceBtn(p.price, false, '', p.id, 'park');
      return `<div class="item"><div class="txt"><div class="nm">${p.name}</div><div class="ds">${p.desc}</div></div>${btn}</div>`;
    }).join('');
  }

  const boardImg = {};
  function renderBoards() {
    return BOARDS.map((b) => {
      const owned = (ctx.save.boards || ['classic']).includes(b.id), on = ctx.save.board === b.id;
      if (!boardImg[b.id]) boardImg[b.id] = boardCanvas(b, 56, 150).toDataURL();
      let btn;
      if (on) btn = '<button class="buy owned" disabled>EQUIPPED</button>';
      else if (owned) btn = `<button class="buy" data-act="equipboard" data-id="${b.id}">EQUIP</button>`;
      else btn = priceBtn(b.price, false, '', b.id, 'board');
      return `<div class="item board" data-board="${b.id}"><img class="bimg" src="${boardImg[b.id]}" alt=""><div class="txt"><div class="nm">${b.name}</div><div class="ds">${b.perkText}</div></div>${btn}</div>`;
    }).join('');
  }

  // ---- stickers: open a box -> random sticker -> the STICKER PLACER (turn the board, click where it goes)
  const stkImg = {};
  const simg = (id, size) => (stkImg[id + size] = stkImg[id + size] || stickerCanvas(id, size).toDataURL());
  function renderStickers() {
    const s = ctx.save;
    if (!s.stickers) s.stickers = [];
    if (!s.sdeck) s.sdeck = [];
    const inv = {};
    s.stickers.forEach((id) => { inv[id] = (inv[id] || 0) + 1; });
    const have = STICKERS.filter((x) => inv[x.id]);
    const grid = have.length
      ? have.map((x) => `<button class="stk" data-act="openplacer" data-id="${x.id}" title="${x.name}: click to stick it on your board"><img src="${simg(x.id, 48)}" alt=""><em style="color:${RARITY[x.r].color}">${x.name}</em>${inv[x.id] > 1 ? `<i>x${inv[x.id]}</i>` : ''}</button>`).join('')
      : '<div class="ds">No stickers yet. Open a Sticker Box!</div>';
    return `<div class="item"><div class="txt"><div class="nm">Sticker Box</div><div class="ds">Open it for a random sticker. Common 60%, Rare 28%, Epic 10%, Legendary 2%.</div></div>${priceBtn(STICKER_BOX_PRICE, false, '', 'box', 'box')}</div>`
      + `<div class="stkhead">YOUR BOARD: ${s.sdeck.length} / ${STICKER_MAX} STICKERS STUCK ON</div>`
      + `<button class="buy" style="width:100%;font-size:17px;padding:12px" data-act="openplacer" data-id="">PLACE STICKERS ON MY BOARD</button>`
      + `<div class="ds" style="margin-top:6px">You get to turn the camera around your board and click exactly where each sticker goes.</div>`
      + `<div class="stkhead">COLLECTION ${new Set(s.stickers).size}/${STICKERS.length} (click one to place it)</div><div class="stkgrid">${grid}</div>`;
  }
  function showReveal(st) {
    const r = RARITY[st.r], rv = document.getElementById('reveal');
    if (!rv) return;
    document.getElementById('rvArt').innerHTML = `<img src="${stickerCanvas(st.id, 170).toDataURL()}" alt="" style="filter:drop-shadow(0 0 22px ${r.color})">`;
    document.getElementById('rvName').textContent = st.name;
    const rr = document.getElementById('rvRar'); rr.textContent = r.name + ' sticker!'; rr.style.color = r.color;
    rv.classList.remove('hide');
  }
  { const ok = document.getElementById('rvOk'); if (ok) ok.addEventListener('click', () => document.getElementById('reveal').classList.add('hide')); }

  function renderItems() {
    return ITEMS.map((it) => {
      const owned = (ctx.save.items || []).includes(it.id);
      return `<div class="item"><div class="txt"><div class="nm">${it.name}</div><div class="ds">${it.desc}</div></div>${priceBtn(it.price, owned, 'OWNED', it.id, 'item')}</div>`;
    }).join('');
  }

  function renderTricks() {
    const free = `<div class="item"><div class="txt"><div class="nm">Starter tricks</div><div class="tl">${FREE_TRICKS.map((t) => `<span>${t[0]} <em>${t[1]}</em></span>`).join('')}</div></div><button class="buy owned" disabled>OWNED</button></div>`;
    return free + PACKS.map((p) => {
      const owned = ctx.save.packs.includes(p.id);
      return `<div class="item"><div class="txt"><div class="nm">${p.name}</div><div class="ds">${p.desc}</div><div class="tl">${p.tricks.map((t) => `<span>${t[0]} <em>${t[1]}</em></span>`).join('')}</div></div>${priceBtn(p.price, owned, 'OWNED', p.id, 'pack')}</div>`;
    }).join('');
  }

  function render() {
    coins();
    document.querySelectorAll('#shopTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    $('shopList').innerHTML = tab === 'board' ? renderBoard() : tab === 'chars' ? renderChars() : tab === 'parks' ? renderParks() : tab === 'items' ? renderItems() : tab === 'boards' ? renderBoards() : tab === 'stickers' ? renderStickers() : renderTricks();
  }

  function buy(act, id) {
    const s = ctx.save;
    if (act === 'part') {
      const lv = s.parts[id] || 0, price = PRICES[lv + 1];
      if (lv >= 3 || s.coins < price) return fail();
      s.coins -= price; s.parts[id] = lv + 1;
    } else if (act === 'char') {
      const c = CHARS.find((x) => x.id === id);
      if (!c || s.chars.includes(id) || s.coins < c.price) return fail();
      s.coins -= c.price; s.chars.push(id); s.char = id;
    } else if (act === 'equip') {
      if (!s.chars.includes(id)) return;
      s.char = id;
    } else if (act === 'park') {
      const p = PARKS.find((x) => x.id === id);
      if (!p || s.parks.includes(id) || s.coins < p.price) return fail();
      s.coins -= p.price; s.parks.push(id); s.park = id; ctx.setPark(id);
    } else if (act === 'selpark') {
      if (!s.parks.includes(id)) return;
      s.park = id; ctx.setPark(id);
    } else if (act === 'box') {
      if (s.coins < STICKER_BOX_PRICE) return fail();
      s.coins -= STICKER_BOX_PRICE;
      const st = rollSticker();
      if (!s.stickers) s.stickers = [];
      s.stickers.push(st.id);
      if (INFINITE_COINS) s.coins = MAX_COINS;
      ctx.persist(); ctx.sfx(true); render(); showReveal(st);
      return;
    } else if (act === 'openplacer') {
      ctx.openPlacer(id || null);
      return;
    } else if (act === 'board') {
      const b = BOARDS.find((x) => x.id === id);
      if (!s.boards) s.boards = ['classic'];
      if (!b || s.boards.includes(id) || s.coins < b.price) return fail();
      s.coins -= b.price; s.boards.push(id); s.board = id;
    } else if (act === 'equipboard') {
      if (!(s.boards || []).includes(id)) return;
      s.board = id;
    } else if (act === 'item') {
      const it = ITEMS.find((x) => x.id === id);
      if (!s.items) s.items = [];
      if (!it || s.items.includes(id) || s.coins < it.price) return fail();
      s.coins -= it.price; s.items.push(id);
    } else if (act === 'pack') {
      const p = PACKS.find((x) => x.id === id);
      if (!p || s.packs.includes(id) || s.coins < p.price) return fail();
      s.coins -= p.price; s.packs.push(id);
    }
    if (INFINITE_COINS) s.coins = MAX_COINS;
    ctx.persist(); ctx.apply(); ctx.sfx(true); render();
  }
  function fail() { ctx.sfx(false); }

  $('shopList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (b) buy(b.dataset.act, b.dataset.id);
  });
  // hover a skater card to see them on the board before you buy
  $('shopList').addEventListener('mouseover', (e) => {
    const it = e.target.closest('.item[data-char]');
    if (it) { const c = CHARS.find((x) => x.id === it.dataset.char); if (c) ctx.preview(c); return; }
    const bd = e.target.closest('.item[data-board]');
    if (bd) { const b = BOARDS.find((x) => x.id === bd.dataset.board); if (b) ctx.previewBoard(b); }
  });
  $('shopList').addEventListener('mouseleave', () => ctx.preview(null));
  $('shopTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) { tab = b.dataset.tab; render(); ctx.preview(null); }
  });

  return { render };
}
