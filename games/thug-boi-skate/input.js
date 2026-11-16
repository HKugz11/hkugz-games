// Keyboard + controller -> one simple "what is the player pressing" object each frame.
//
// Keyboard:
//   W/S or Up/Down = push / brake      A/D or Left/Right = steer (on the ground)
//   Space = ollie (hold = bigger)       Shift or E = grind
//   Q = manual (hold)                   In the air: A/D = spin
//   Up/I = kickflip  Down/K = heelflip  Left/J = shove-it  Right/L = Indy grab (hold)  O = Method grab (hold)
//   P or Esc = pause    R = bail out / respawn
// Controller (standard layout):
//   Left stick = move / spin, A = ollie, LB = grind, LT = manual,
//   X = kickflip, B = heelflip, RB = shove-it, Y = Indy grab, RT = Method grab,
//   Right stick = flip tricks (up kickflip, down heelflip, left shove-it, right Indy)

function getPad() {
  try {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of list) if (g && g.connected) return g;
  } catch (e) { /* no gamepad support, that is fine */ }
  return null;
}

const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();      // keys that went down this frame
    this.padDown = {};             // pad "virtual buttons" held now
    this.padPrev = {};
    window.addEventListener('keydown', (e) => {
      if (BLOCK.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); });
  }

  read() {
    const k = (c) => this.down.has(c);
    const p = (c) => this.pressed.has(c);
    const pad = getPad();
    const pb = {};   // pad virtual buttons this frame
    let padX = 0, padY = 0;
    if (pad) {
      const dz = (v) => (Math.abs(v) > 0.25 ? v : 0);
      padX = dz(pad.axes[0] || 0);
      padY = -dz(pad.axes[1] || 0);
      const rx = pad.axes[2] || 0, ry = pad.axes[3] || 0;
      const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      pb.ollie = b(0); pb.heel = b(1) || ry > 0.6; pb.kick = b(2) || ry < -0.6;
      pb.indy = b(3) || rx > 0.6; pb.shove = b(5) || rx < -0.6; pb.grind = b(4);
      pb.method = b(7); pb.manual = b(6); pb.start = b(9);
      if (b(12)) padY = 1; if (b(13)) padY = -1; if (b(14)) padX = -1; if (b(15)) padX = 1;
    }
    const pe = (n) => !!pb[n] && !this.padPrev[n];   // pad button just pressed
    this.padPrev = pb;

    const GRAB = { indy: ['KeyL', 'ArrowRight'], method: ['KeyO'], melon: ['KeyU'], stale: ['KeyY'], nose: ['KeyT'], tail: ['KeyG'], superman: ['KeyB'], christ: ['KeyN'] };
    const grabHeld = {}, grabPressed = {};
    for (const id in GRAB) {
      grabHeld[id] = GRAB[id].some(k);
      grabPressed[id] = GRAB[id].some(p);
    }
    grabHeld.indy = grabHeld.indy || !!pb.indy; grabPressed.indy = grabPressed.indy || pe('indy');
    grabHeld.method = grabHeld.method || !!pb.method; grabPressed.method = grabPressed.method || pe('method');

    const s = {
      x: (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + padX,
      y: (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0) + padY,
      spin: (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0) + padX,
      ollieHeld: k('Space') || !!pb.ollie,
      olliePressed: p('Space') || pe('ollie'),
      kick: p('ArrowUp') || p('KeyI') || pe('kick'),
      heel: p('ArrowDown') || p('KeyK') || pe('heel'),
      shove: p('ArrowLeft') || p('KeyJ') || pe('shove'),
      imp: p('KeyM'),
      front: p('KeyW'),
      back: p('KeyS'),
      backF: p('KeyF'),
      grabHeld, grabPressed,
      grind: k('ShiftLeft') || k('ShiftRight') || k('KeyE') || !!pb.grind,
      manual: k('KeyQ') || !!pb.manual,
      noseManual: k('KeyZ'),
      pause: p('Escape') || p('KeyP'),
      restart: p('KeyR'),
      start: p('Enter') || p('Space') || pe('start') || pe('ollie'),
    };
    s.x = Math.max(-1, Math.min(1, s.x));
    s.y = Math.max(-1, Math.min(1, s.y));
    s.spin = Math.max(-1, Math.min(1, s.spin));
    this.pressed.clear();
    return s;
  }
}
