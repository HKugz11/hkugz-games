// The Goals window: little jobs that pay money, and "firsts" that pay once.
import { MILESTONES } from './data.js?v=2';
import { career, fmt$ } from './career.js?v=2';

const $ = (id) => document.getElementById(id);

export class Goals {
  constructor(hooks) { this.hooks = hooks; $('misClose').onclick = () => this.close(); }
  open() { $('missions').classList.remove('hide'); this.paint(); }
  close() { $('missions').classList.add('hide'); this.hooks.closed && this.hooks.closed(); }
  paint() {
    $('misMoney').textContent = career.sandbox() ? 'Sandbox' : fmt$(career.funds);
    let h = '<h3 class="gh">Jobs for you</h3>';
    for (const c of career.contracts) h += '<div class="mrow"><div class="ck">⭐</div><div class="tx">' + c.text + '</div><div class="rw">' + fmt$(c.reward) + '</div></div>';
    h += '<h3 class="gh">Big firsts (you only get paid once)</h3>';
    for (const m of MILESTONES) {
      const done = career.done.has(m[0]);
      h += '<div class="mrow' + (done ? ' done' : '') + '"><div class="ck">' + (done ? '✓' : '') + '</div><div class="tx">' + m[1] + '<small>' + m[2] + '</small></div><div class="rw">' + fmt$(m[3]) + '</div></div>';
    }
    if (career.sandbox()) h += '<p class="fine">Sandbox mode: every part is free and goals do not pay. Turn it off in Settings to earn money.</p>';
    $('misList').innerHTML = h;
  }
}
