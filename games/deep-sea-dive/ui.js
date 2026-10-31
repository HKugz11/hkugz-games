// ui.js - the menu screens you use on the boat: Sell fish, Shop, Fish-dex and Settings.
// They are built from the lists in data.js, so new fish and new gear levels appear here by themselves.
import { FISH, RARITY, ZONES, GEAR, GEAR_ORDER, SPEAR_ORDER, CONSUMABLES, fishById } from './data.js?v=2';
import { save, settings, persist, saveSettings, resetAll, flush } from './save.js?v=2';
import { icon } from './symbols.js?v=2';
import { ItemPreview } from './preview.js?v=2';

const money = n => Math.floor(n).toLocaleString();

// env = what the UI needs from game.js: { $, show, setState, sound, getIcons, goBoat, toast, diver }
export function createUI(env) {
  const { $, sound } = env;
  const open = (id, st) => { env.setState(st); env.show(id); };

  // A row with a fish picture, used by the sell list and the dive summary.
  function fishRows(counts, showTotal = true) {
    const icons = env.getIcons();
    const ids = Object.keys(counts).filter(id => counts[id] > 0 && fishById(id)).sort((a, b) => RARITY[fishById(b).rarity].order - RARITY[fishById(a).rarity].order || fishById(b).value - fishById(a).value);
    if (!ids.length) return '';
    return ids.map(id => {
      const f = fishById(id), r = RARITY[f.rarity];
      return `<div class="sl"><img src="${icons[id]}" alt=""><b>${f.name}<small style="color:${r.color}">${r.name} · $${f.value} each</small></b><span>× ${counts[id]}</span>${showTotal ? `<span class="v">$${money(f.value * counts[id])}</span>` : ''}</div>`;
    }).join('');
  }

  // ---------------------------------------------------------------- sell
  const holdTotal = () => Object.keys(save.hold).reduce((a, id) => a + (fishById(id) ? fishById(id).value * save.hold[id] : 0), 0);
  function openSell() {
    open('sell', 'sell');
    renderSell();
  }
  function renderSell() {
    $('slCoins').textContent = money(save.coins);
    const rows = fishRows(save.hold);
    $('slList').innerHTML = rows || '<div class="sub">You have no fish to sell. Go for a dive and catch some!</div>';
    const total = holdTotal();
    $('slAll').textContent = total ? 'Sell all  +$' + money(total) : 'Nothing to sell';
    $('slAll').disabled = !total;
  }
  $('slAll').addEventListener('click', () => {
    const total = holdTotal(); if (!total) return;
    const n = Object.values(save.hold).reduce((a, b) => a + b, 0);
    save.coins += total; save.stats.earned += total; save.hold = {};
    persist(); sound.kaching(); env.toast('Sold ' + n + ' fish for $' + money(total) + '!');
    renderSell();
  });
  $('slBack').addEventListener('click', () => { sound.click(); env.goBoat(); });

  // ---------------------------------------------------------------- shop
  // One menu per kind of gear. You can OWN several items of each kind and swap between them (for example single or twin tanks).
  let tab = 'suit', pick = 0;
  const CATS = [['flippers', 'Flippers', 'flippers'], ['suit', 'Suits', 'suit'], ['tank', 'Tanks', 'tank'], ['net', 'Nets', 'net'], ['light', 'Lights', 'light'], ['bag', 'Bags', 'bag'], ['gun', 'Spear guns', 'gun'], ['quiver', 'Spear belts', 'quiver'], ['supplies', 'Supplies', 'repel']];
  const preview = new ItemPreview($('shView'));
  function openShop() { open('shop', 'shop'); if (tab !== 'supplies') pick = save.gear[tab]; renderShop(); preview.start(); }
  const closeShop = () => { preview.stop(); env.goBoat(); };
  const zonesFor = (cat, level) => ZONES.filter(z => (cat === 'suit' && z.needSuit === level) || (cat === 'light' && z.needLight === level)).map(z => z.name);
  const SUPPLY = ['spears', 'repel'];
  function renderShop() {
    $('shCoins').textContent = money(save.coins);
    $('shTabs').innerHTML = CATS.map(([id, label, ic]) => `<button type="button" class="${tab === id ? 'on' : ''}" data-tab="${id}">${icon(ic, 22)} ${label}</button>`).join('');
    let h = '';
    if (tab === 'supplies') {
      h = SUPPLY.map((key, i) => supplyCard(key, i)).join('') + infoCard();
      const key = SUPPLY[Math.min(pick, SUPPLY.length - 1)]; showPreview(key, 0, CONSUMABLES[key].title, CONSUMABLES[key].text);
    } else {
      const G = GEAR[tab];
      h = G.levels.map((it, i) => itemCard(tab, G, it, i)).join('');
      const it = G.levels[pick] || G.levels[0], z = zonesFor(tab, pick);
      showPreview(tab, pick, it.name, it.text + (z.length ? ' Needed to dive: ' + z.join(', ') + '.' : ''));
    }
    $('shGrid').innerHTML = h;
  }
  function showPreview(cat, i, name, text) { preview.show(cat, i); $('pvName').textContent = name; $('pvText').textContent = text; }
  function itemCard(cat, G, it, i) {
    const owned = save.owned[cat].includes(i), eq = save.gear[cat] === i, afford = save.coins >= it.price, need = zonesFor(cat, i);
    let act;
    if (eq) act = '<span class="pill max">IN USE</span>';
    else if (owned) act = `<button class="small go" data-equip="${i}">USE THIS</button>`;
    else act = `<span class="price ${afford ? '' : 'no'}">${money(it.price)}</span><button class="small gold" data-buy="${i}" ${afford ? '' : 'disabled'}>BUY</button>`;
    return `<div class="item panel ${pick === i ? 'sel' : ''} ${eq ? 'done' : ''}" data-pick="${i}"><div class="ih"><div class="ico">${icon(G.icon, 44)}</div><div><b>${it.name}</b><div class="lv">${owned ? (eq ? 'YOU ARE USING THIS' : 'YOU OWN THIS') : 'NOT OWNED'}</div></div></div>` +
      `<p>${it.text}</p>${need.length ? `<p class="need ok">Needed to dive: ${need.join(', ')}</p>` : ''}<div class="buy">${act}</div></div>`;
  }
  function supplyCard(key, i) {
    const c = CONSUMABLES[key], have = save[key], ok = save.coins >= c.price && have < c.max;
    return `<div class="item panel ${pick === i ? 'sel' : ''}" data-pick="${i}"><div class="ih"><div class="ico">${icon(c.icon, 44)}</div><div><b>${c.title}</b><div class="lv">YOU HAVE ${have} (MAX ${c.max})</div></div></div><p>${c.text}</p>` +
      `<div class="buy"><span class="price ${save.coins >= c.price ? '' : 'no'}">${money(c.price)}</span><button class="small gold" data-sup="${key}" ${ok ? '' : 'disabled'}>${have >= c.max ? 'FULL' : 'BUY ' + c.give}</button></div></div>`;
  }
  function infoCard() {
    const gun = GEAR.gun.levels[save.gear.gun], belt = GEAR.quiver.levels[save.gear.quiver];
    return `<div class="item panel"><div class="ih"><div class="ico">${icon('info', 44)}</div><div><b>How spears work</b></div></div><p>Press 2 to pick the spear gun and click to fire. A spear that hits a fish catches it. A hit on a shark only <b>stuns</b> it for a few seconds so you can escape.</p>` +
      `<p class="now">Each dive you carry up to <b>${gun.ammo + belt.extra}</b> spears (gun ${gun.ammo} + belt ${belt.extra}). In your locker: <b>${save.spears}</b>.</p></div>`;
  }
  $('shTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; pick = tab === 'supplies' ? 0 : save.gear[tab]; sound.click(); renderShop(); });
  $('shGrid').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && !b.disabled) {
      if (b.dataset.buy !== undefined) {
        const i = +b.dataset.buy, it = GEAR[tab].levels[i];
        if (save.owned[tab].includes(i) || save.coins < it.price) { sound.deny(); return; }
        save.coins -= it.price; save.owned[tab].push(i); save.owned[tab].sort((x, y) => x - y); save.gear[tab] = i; pick = i;     // buying puts it on right away
        persist(); sound.buy(); env.diver.setGear(save.gear); env.toast('Bought ' + it.name + '!');
      } else if (b.dataset.equip !== undefined) {
        const i = +b.dataset.equip; if (!save.owned[tab].includes(i)) return;
        save.gear[tab] = i; pick = i; persist(); sound.click(); env.diver.setGear(save.gear); env.toast('Now using ' + GEAR[tab].levels[i].name);
      } else if (b.dataset.sup) {
        const key = b.dataset.sup, c = CONSUMABLES[key];
        if (save.coins < c.price || save[key] >= c.max) { sound.deny(); return; }
        save.coins -= c.price; save[key] = Math.min(c.max, save[key] + c.give); persist(); sound.buy();
      }
      renderShop(); return;
    }
    const card = e.target.closest('[data-pick]'); if (card) { pick = +card.dataset.pick; sound.tick(); renderShop(); }
  });
  $('shBack').addEventListener('click', () => { sound.click(); closeShop(); });
  addEventListener('resize', () => preview.resize());

  // ---------------------------------------------------------------- Fish-dex
  let dexZone = -1;
  function openDex() { open('dex', 'dex'); renderDex(); }
  function renderDex() {
    const icons = env.getIcons(), found = FISH.filter(f => save.dex[f.id]).length;
    $('dxCount').textContent = found + ' of ' + FISH.length + ' fish discovered';
    $('dxBar').style.width = (found / FISH.length * 100) + '%';
    $('dxTabs').innerHTML = [[-1, 'All']].concat(ZONES.map(z => [z.id, z.name])).map(([id, n]) => `<button type="button" class="${dexZone === id ? 'on' : ''}" data-z="${id}">${n}</button>`).join('');
    const list = FISH.filter(f => dexZone < 0 || f.zone === dexZone).sort((a, b) => a.zone - b.zone || RARITY[a.rarity].order - RARITY[b.rarity].order);
    $('dxGrid').innerHTML = list.map(f => {
      const got = save.dex[f.id], r = RARITY[f.rarity];
      if (!got) return `<div class="fcard panel lock"><div class="fi"><img src="${icons[f.id]}" alt=""></div><b>???</b><div class="rar" style="opacity:.6">Undiscovered</div><small>Found in the ${ZONES[f.zone].name}</small></div>`;
      return `<div class="fcard panel ${f.needSpear ? 'sp' : ''}" style="border-color:${r.color}55"><span class="n">×${got.n}</span><div class="fi"><img src="${icons[f.id]}" alt=""></div><b>${f.name}</b><div class="rar" style="color:${r.color}">${r.name}</div><small>${f.blurb}</small><div class="val">$${money(f.value)}</div><small style="min-height:0;opacity:.6">${ZONES[f.zone].name}</small></div>`;
    }).join('');
  }
  $('dxTabs').addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (!b) return; dexZone = +b.dataset.z; sound.click(); renderDex(); });
  $('dxBack').addEventListener('click', () => { sound.click(); env.goBoat(); });

  // ---------------------------------------------------------------- settings
  const CAMS = ['Close', 'Medium', 'Far'];
  let armed = false;
  function openSettings() {
    open('settings', 'settings');
    $('stVol').value = Math.round(settings.vol * 100); $('stSens').value = Math.round(settings.sens * 100);
    $('stCam').textContent = CAMS[settings.camDist]; $('stLite').textContent = settings.lite ? 'On' : 'Off'; $('stMute').textContent = settings.mute ? 'On' : 'Off';
    armed = false; $('stReset').textContent = 'Erase…';
  }
  $('stVol').addEventListener('input', e => { settings.vol = e.target.value / 100; sound.setVolume(settings.vol); saveSettings(); });
  $('stSens').addEventListener('input', e => { settings.sens = e.target.value / 100; saveSettings(); });
  $('stCam').addEventListener('click', () => { settings.camDist = (settings.camDist + 1) % 3; $('stCam').textContent = CAMS[settings.camDist]; saveSettings(); sound.click(); });
  $('stLite').addEventListener('click', () => { settings.lite = !settings.lite; $('stLite').textContent = settings.lite ? 'On' : 'Off'; saveSettings(); sound.click(); });
  $('stMute').addEventListener('click', () => { env.toggleMute(); $('stMute').textContent = settings.mute ? 'On' : 'Off'; });
  $('stReset').addEventListener('click', () => {
    if (!armed) { armed = true; $('stReset').textContent = 'Really erase?'; return; }
    resetAll(); flush(); location.reload();
  });
  $('stBack').addEventListener('click', () => { sound.click(); env.goBoat(); });

  return { openSell, openShop, openDex, openSettings, fishRows };
}
