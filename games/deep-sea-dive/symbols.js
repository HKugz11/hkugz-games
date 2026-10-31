// symbols.js - every icon in the game: flat, solid and colourful (a bright fill with a dark edge). No emojis and no grey outlines.
// icon('fish', 28) gives back a little picture you can put into a page. To add an icon, add a name and a drawing (in a 100 x 100 box) to DRAW.
const K = '#14304a';                                                                   // the dark edge colour
const S = (d, fill, stroke = K, w = 4) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;      // a filled shape
const L = (d, stroke, w = 6) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}"/>`;                     // a line
const O = (x, y, r, fill, stroke = K, w = 4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;   // a circle

const cog = (() => {   // a cog with eight teeth
  let d = '';
  for (let k = 0; k < 8; k++) {
    const a0 = k * Math.PI / 4, pts = [[-12, 32], [-9, 45], [9, 45], [12, 32]].map(([da, r]) => { const a = a0 + da * Math.PI / 180; return (50 + Math.cos(a) * r).toFixed(1) + ' ' + (50 + Math.sin(a) * r).toFixed(1); });
    d += (k ? 'L' : 'M') + pts.join('L');
  }
  return S(d + 'Z', '#b4bfcf') + O(50, 50, 13, '#33425a', K, 3);
})();
const speaker = S('M8 38H26L48 18V82L26 62H8Z', '#ffffff');

const DRAW = {
  fish: S('M10 50Q32 18 62 38L90 22L80 50L90 78L62 62Q32 82 10 50Z', '#ff9a3c') + L('M52 38Q57 50 52 62', '#ffd08a', 4) + O(31, 45, 4.5, '#fff', K, 2),
  flippers: S('M28 12H52L55 52L87 86Q58 97 32 85Q21 70 28 50Z', '#2f9be8') + L('M38 60L60 80', '#9ad8ff', 4),
  suit: S('M10 36Q10 26 22 26H78Q90 26 90 36V54Q90 70 74 70H62Q56 70 52 60H48Q44 70 38 70H26Q10 70 10 54Z', '#27b6e0') + S('M21 37H79V53Q79 60 72 60H60Q54 60 50 52Q46 60 40 60H28Q21 60 21 53Z', '#c8f4ff', K, 3) + L('M82 26V10H95', '#27b6e0', 6),
  tank: S('M33 32Q33 24 41 24H59Q67 24 67 32V82Q67 91 58 91H42Q33 91 33 82Z', '#ffd23c') + S('M43 24V12H57V24Z', '#aab4c4') + L('M33 50H67', '#b8860b', 5) + L('M41 36V44', '#fff3b0', 4),
  net: O(42, 40, 27, 'rgba(200,240,255,.55)', '#2f8fc0', 5) + L('M21 30Q42 58 63 30M42 13V67M17 48Q42 36 67 48', '#ffffff', 3) + L('M62 60L88 88', '#a0663a', 10),
  light: S('M32 38H76Q83 38 83 45V57Q83 64 76 64H32Z', '#ffd23c') + S('M32 33L12 24V78L32 69Z', '#c8d0d8') + L('M7 38L2 34M7 51H2M7 64L2 68', '#ffe680', 4),
  bag: S('M28 44Q28 24 50 24Q72 24 72 44V82Q72 91 63 91H37Q28 91 28 82Z', '#ff8a3c') + S('M37 58H63V73H37Z', '#ffc07a', K, 3) + L('M41 24V13H59V24', '#c8d0d8', 6),
  gun: S('M6 50H70V64H26L22 82H10Z', '#8a93a0') + S('M70 51L96 57L70 63Z', '#ffffff') + L('M40 50V41H56V50', '#5a626e', 5),
  quiver: S('M10 66H90V86H10Z', '#a0663a') + L('M30 68V26M50 68V18M70 68V26', '#dfe6ee', 5) + S('M30 12L23 28H37Z', '#ffffff', K, 3) + S('M50 4L43 20H57Z', '#ffffff', K, 3) + S('M70 12L63 28H77Z', '#ffffff', K, 3),
  spears: L('M16 90L68 24M32 94L84 28M48 98L96 36', '#dfe6ee', 6) + S('M74 14L60 24L72 34Z', '#ffffff', K, 3),
  repel: S('M42 16H58V30Q74 36 74 52V82Q74 92 64 92H36Q26 92 26 82V52Q26 36 42 30Z', '#2fb8c8') + S('M26 58H74V76H26Z', '#ffffff', K, 3) + S('M39 6H61V18H39Z', '#e8453c', K, 3),
  dive: S('M42 6H58V42H76L50 70L24 42H42Z', '#ffd23c') + L('M8 80Q22 68 36 80T64 80T92 80', '#27b6e0', 9) + L('M8 94Q22 82 36 94T64 94T92 94', '#7cdcf6', 6),
  sell: O(50, 50, 40, '#ffc21a', '#a86a00', 5) + O(50, 50, 29, '#ffe27a', '#d49000', 3) + L('M59 38Q59 31 50 31Q41 31 41 38Q41 46 50 49Q59 52 59 60Q59 69 50 69Q41 69 41 62', '#a86a00', 5) + L('M50 22V31M50 69V78', '#a86a00', 5),
  shop: S('M22 28H90L80 62H33Z', '#5fd27a') + L('M6 16H20L34 62H80', '#cfd6e0', 7) + O(42, 79, 8, '#33425a', '#cfd6e0', 3) + O(72, 79, 8, '#33425a', '#cfd6e0', 3),
  dex: S('M8 22Q30 12 50 26Q70 12 92 22V80Q70 70 50 84Q30 70 8 80Z', '#8a6cff') + S('M16 29Q32 22 46 33V76Q32 66 16 73Z', '#f4f0ff', K, 3) + S('M54 33Q68 22 84 29V73Q68 66 54 76Z', '#f4f0ff', K, 3),
  settings: cog,
  shark: S('M8 78Q40 70 46 12Q70 48 92 78Z', '#8fa4b8') + S('M46 12Q42 46 20 74L8 78Q40 70 46 12Z', '#b7c8d8', K, 0) + L('M6 92Q20 82 34 92T62 92T90 92', '#27b6e0', 7),
  hide: S('M16 86Q6 28 76 14Q92 58 42 82Z', '#5dd36a') + L('M16 86L60 38', '#2f8f3c', 5),
  cave: S('M6 84Q12 30 50 22Q88 30 94 84Z', '#8a8f9a') + S('M32 84Q32 54 50 54Q68 54 68 84Z', '#2a2f3a', K, 3),
  anchor: O(50, 17, 9, 'none', '#cfd6e0', 7) + L('M50 27V84M28 44H72M14 62Q18 86 50 88Q82 86 86 62', '#cfd6e0', 8) + S('M4 66L16 52L28 70Z', '#cfd6e0', K, 3) + S('M72 70L84 52L96 66Z', '#cfd6e0', K, 3),
  info: O(50, 50, 40, '#27b6e0', K, 5) + L('M50 46V72', '#ffffff', 10) + O(50, 29, 6, '#ffffff', 'none', 0),
  sound: speaker + L('M60 38Q70 50 60 62M70 28Q90 50 70 72', '#7cf0ff', 6),
  mute: speaker + L('M60 38L88 64M88 38L60 64', '#ff6a6a', 8),
};

export function icon(name, px = 28) {
  const g = DRAW[name] || DRAW.fish;
  return `<svg class="gi" viewBox="0 0 100 100" width="${px}" height="${px}" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round">${g}</g></svg>`;
}

// Turns every <i data-ic="name" data-s="size"></i> in the page into its icon.
export function fillIcons(root = document) {
  root.querySelectorAll('[data-ic]').forEach(el => { el.outerHTML = icon(el.dataset.ic, +el.dataset.s || 26); });
}
