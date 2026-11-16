// Trick scoring, Tony Hawk style.
// Tricks add points to a "combo". The multiplier = how many different tricks are in it.
// The combo only goes into your score when you land clean. Bail = it is lost.

export const SPIN_POINTS = { 1: 100, 2: 250, 3: 450, 4: 700, 5: 1000, 6: 1400, 7: 1900, 8: 2500 };

export class Scorer {
  constructor() { this.reset(); }

  reset() {
    this.score = 0;
    this.bestCombo = 0;
    this.tricksLanded = 0;
    this.bails = 0;
    this.cancel();
  }

  cancel() {
    this.list = [];      // trick names in this combo (no repeats)
    this.points = 0;     // base points of the combo
  }

  get mult() { return Math.max(1, this.list.length); }
  get active() { return this.list.length > 0; }
  get total() { return Math.round(this.points) * this.mult; }

  // one trick, one lump of points. Doing the same trick again in a combo pays less.
  add(name, pts) {
    if (this.list.includes(name)) pts = Math.round(pts * 0.4);
    else this.list.push(name);
    this.points += pts;
  }

  // points that tick up while you hold something (grind, manual, grab)
  addPoints(name, pts) {
    if (!this.list.includes(name)) this.list.push(name);
    this.points += pts;
  }

  // clean landing and the combo ends -> points are yours
  bank() {
    const t = this.total;
    if (t > 0) {
      this.score += t;
      this.bestCombo = Math.max(this.bestCombo, t);
      this.tricksLanded += this.list.length;
    }
    this.cancel();
    return t;
  }

  bail() {
    this.bails++;
    this.cancel();
  }
}
