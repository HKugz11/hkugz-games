// The parts shop, the missions list and the "load a rocket" window.
import { PARTS, PART_LIST, CATS, STARTERS, MILESTONES, MILESTONE } from './data.js?v=1';
import { career, fmt$, loadShips, deleteShip } from './career.js?v=1';
import { partFacts } from './build.js?v=1';
import { missingParts, newDesign } from './design.js?v=1';
import { analyze } from './sim.js?v=1';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export class Shop {
  constructor(icons, preview, hooks) {
    this.icons = icons; this.preview = preview; this.hooks = hooks; this.cat = 'pod'; this.sel = null; this.isOpen = false;
    $('shopClose').onclick = () => this.close();
    $('shopBuy').onclick = () => this.buy();
    const cats = $('shopCats');
    for (const [id, name] of CATS) { const b = el('button', 'small ghost', name); b.dataset.c = id; b.onclick = () => { this.cat = id; this.list(); }; cats.appendChild(b); }
    this.preview.el = $('shopPrev');
  }
  open(partId) {
    this.isOpen = true; $('shop').classList.remove('hide');
    if (partId && PARTS[partId]) { this.cat = PARTS[partId].cat; this.sel = partId; }
    else if (!this.sel) this.sel = (PART_LIST.find((p) => !career.unlocked(p.id) && p.cat === this.cat) || PART_LIST.find((p) => p.cat === this.cat)).id;
    this.list(); this.show(this.sel);
  }
  close() { this.isOpen = false; $('shop').classList.add('hide'); this.hooks.onClose && this.hooks.onClose(); }
  list() {
    for (const b of $('shopCats').children) b.classList.toggle('sel', b.dataset.c === this.cat);
    $('shopMoney').textContent = career.sandbox() ? 'Sandbox: everything is free' : fmt$(career.funds);
    const box = $('shopList'); box.innerHTML = '';
    for (const p of PART_LIST.filter((x) => x.cat === this.cat)) {
      const owned = career.unlocked(p.id), gated = !career.reqMet(p);
      const t = el('div', 'tile' + (owned ? '' : ' locked') + (this.sel === p.id ? ' sel' : ''), '<img alt=""><div class="nm">' + p.name + '</div><div class="pr">' + (owned ? 'Owned' : gated ? 'Locked' : fmt$(p.price)) + '</div>');
      t.firstChild.src = this.icons.get(p.id);
      t.onclick = () => { this.sel = p.id; this.hooks.sound.click(); this.list(); this.show(p.id); };
      box.appendChild(t);
    }
  }
  show(id) {
    const p = PARTS[id]; if (!p) return;
    this.preview.set(p);
    const owned = career.unlocked(id), why = career.whyNotBuy(id);
    $('shopInfo').innerHTML = '<b class="t">' + p.name + '</b>' + p.desc + '<div style="margin-top:6px;opacity:.85;font-size:13px">' + partFacts(p) + '</div>' +
      (owned ? '<div class="money" style="margin-top:8px">You own this part.</div>' : '<div style="margin-top:8px"><span class="money">' + fmt$(p.price) + '</span>' + (why ? ' <span style="color:#ff9ab0;font-size:13px">' + why + '</span>' : '') + '</div>');
    const b = $('shopBuy');
    b.textContent = owned ? 'Owned' : 'Buy for ' + fmt$(p.price);
    b.disabled = owned || !!why;
  }
  buy() {
    const id = this.sel; if (!id) return;
    if (career.buy(id)) { this.hooks.sound.good(); this.hooks.toast('Unlocked: ' + PARTS[id].name + '!', 'good'); this.list(); this.show(id); this.hooks.onChange && this.hooks.onChange(); }
  }
}

export class Missions {
  constructor(hooks) { this.hooks = hooks; $('misClose').onclick = () => this.close(); }
  open() { $('missions').classList.remove('hide'); this.paint(); }
  close() { $('missions').classList.add('hide'); }
  paint() {
    $('misMoney').textContent = career.sandbox() ? 'Sandbox' : fmt$(career.funds);
    let h = '<h3 style="margin:8px 0 4px;letter-spacing:.14em;font-size:12px;opacity:.65">CONTRACTS (new ones appear when you finish one)</h3>';
    for (const c of career.contracts) h += '<div class="mrow"><div class="ck">&#9733;</div><div class="tx">' + c.text + '</div><div class="rw">' + fmt$(c.reward) + '</div></div>';
    h += '<h3 style="margin:14px 0 4px;letter-spacing:.14em;font-size:12px;opacity:.65">FIRSTS (each one pays once)</h3>';
    for (const m of MILESTONES) {
      const done = career.done.has(m[0]);
      h += '<div class="mrow' + (done ? ' done' : '') + '"><div class="ck">' + (done ? '&#10003;' : '') + '</div><div class="tx">' + m[1] + '<small>' + m[2] + '</small></div><div class="rw">' + fmt$(m[3]) + '</div></div>';
    }
    if (career.sandbox()) h += '<p class="fine">Sandbox mode: you have every part, and missions do not pay. Switch to Career in Settings to earn money.</p>';
    $('misList').innerHTML = h;
  }
}

export class LoadDlg {
  constructor(icons, hooks) { this.hooks = hooks; $('loadClose').onclick = () => this.close(); }
  open() { $('loadDlg').classList.remove('hide'); this.paint(); }
  close() { $('loadDlg').classList.add('hide'); }
  paint() {
    const un = career.unlockedSet(), box = $('loadList'); box.innerHTML = '';
    const sec = (t) => box.appendChild(el('h3', '', t)).style.cssText = 'margin:10px 0 4px;letter-spacing:.14em;font-size:12px;opacity:.65';
    const add = (design, blurb, deletable) => {
      const miss = missingParts(design, un), st = analyze(design);
      const row = el('div', 'shipitem', '<div class="tx"><b>' + design.name + '</b><small>' + (blurb || '') + ' ' + design.parts.length + ' parts, ' + Math.round(st.dv).toLocaleString('en-US') + ' m/s' + (miss.length ? ' &middot; <span style="color:#ff9ab0">needs ' + miss.map((m) => PARTS[m].name).join(', ') + '</span>' : '') + '</small></div>');
      const b = el('button', 'small go', 'Open'); b.onclick = () => { this.close(); this.hooks.onPick(JSON.parse(JSON.stringify(design))); }; row.appendChild(b);
      if (deletable) { const d = el('button', 'small warn', 'Delete'); d.onclick = () => { deleteShip(design.name); this.paint(); }; row.appendChild(d); }
      box.appendChild(row);
    };
    sec('STARTER ROCKETS');
    for (const s of STARTERS) add({ name: s.name, v: 1, parts: s.parts, gnext: 99 }, s.blurb, false);
    const mine = Object.values(loadShips());
    sec('YOUR SAVED ROCKETS');
    if (!mine.length) box.appendChild(el('div', 'fine', 'Nothing saved yet. Press Save in the hangar.'));
    for (const d of mine) add(d, '', true);
  }
}
