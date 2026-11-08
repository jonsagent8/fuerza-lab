// The tint + wrap car. Shows the composited side photo (build-car.js) straight away, loads three.js and the 3D sedan
// (car3d.js) in the background and switches to it once ready, so the car can be spun. Color and shade live here and are
// pushed to whichever car is drawing; both animations (wrap wipe, tint squeegee) are tweened on this object.
import { BuildCar } from './build-car.js?v=spin1';

export class SpinCar {
  constructor({ small = false } = {}) {
    this.flat = new BuildCar(); this.small = small;
    this.name = 'build'; this.n = 1; this.bmps = [];
    this.from = 'factory'; this.color = 'factory'; this.wipe = 1;
    this.vltFrom = null; this.vlt = null; this.sq = 1;
    this.d3 = null;
  }
  get ready() { return this.flat.ready || !!(this.d3 && this.d3.ready); }
  get spinnable() { return !!(this.d3 && this.d3.ready); }
  load() {
    if (!this.l3) {
      this.l3 = import('./car3d.js?v=spin1')
        .then(m => { this.d3 = new m.Car3D(this.small ? { w: 1280, h: 720 } : { w: 1600, h: 900 }); return this.d3.load(); })
        .catch(e => { console.warn('3D car unavailable, using the side photo', e); this.d3 = null; });
    }
    return this.flat.load();
  }
  poster() { return this.load(); }
  loaded() { return this.ready ? 1 : 0; }
  want() {}

  setColor(k, tween) {
    if (k === this.color) return;
    this.from = this.wipe < .5 ? this.from : this.color; this.color = k; this.wipe = 0;
    tween ? tween(this, 'wipe', 1.6) : (this.wipe = 1);
  }
  setTint(v, tween) {
    if (v === this.vlt) return;
    this.vltFrom = this.vlt; this.vlt = v; this.sq = 0;
    tween ? tween(this, 'sq', .9) : (this.sq = 1);
  }
  // drag to spin: dx in CSS px
  grab() { if (this.d3) this.d3.drag = true; }
  spinBy(dx) { if (this.d3 && this.d3.ready) this.d3.spin(dx * .009); }
  release() { if (this.d3) this.d3.release(); }

  // fraction of the frame width to slide the car (+ = right)
  shiftTo(x) { this.shift = x; }

  frame(i) {
    if (i !== 0) return null;
    if (this.d3 && this.d3.ready) {
      this.d3.shiftTo = this.shift || 0;
      this.d3.setColor(this.from, this.color, this.wipe);
      this.d3.setTint(this.vltFrom, this.vlt, this.sq);
      const c = this.d3.render(); if (c) return c;
    }
    const f = this.flat;
    f.from = this.from; f.color = this.color; f.wipe = this.wipe; f.vltFrom = this.vltFrom; f.vlt = this.vlt; f.sq = this.sq;
    return f.draw();
  }
  nearest() { return this.frame(0); }
}
