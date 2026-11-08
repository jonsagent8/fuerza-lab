// "Build your car": one side photo of the sedan per wrap color (assets/build, made by _hf/build-car.mjs) composited live on
// an offscreen canvas. Picking a color sweeps the new wrap across the body front to back; picking a shade squeegees the
// film down the windows. Color and tint are independent layers, so every combination works and both stay applied.
// The canvas stands in for a frame sequence on the stage (same want/frame/nearest interface as frames.js Seq).
const W = 1600, H = 900;
const KEYS = ['factory', 'red', 'blue', 'graphite', 'pearl', 'chrome', 'matte'];
const BODY = [150, 1500];                  // front bumper to rear bumper, px in the 1600 photo (car faces left)
const GLASS = [176, 308];                  // top and bottom of the side windows
const BAND = [304, 470];                   // beltline to rocker panel: the shine rides the doors, never the roof or the bay
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
// film look per VLT, same curve the old tint clip used: share of tinted glass, then extra "limo" darkening near 5%
const film = v => {
  if (v == null) return { a: 0, limo: 0 };
  const t = lerp(.15, 1, (70 - v) / 65);
  return { a: t < .12 ? .18 : .18 + .82 * (t - .12) / .88, limo: ss(.55, 1, t) * .55 };
};

export class BuildCar {
  constructor() {
    this.c = document.createElement('canvas'); this.c.width = W; this.c.height = H;
    this.g = this.c.getContext('2d', { alpha: false });
    this.tmp = document.createElement('canvas'); this.tmp.width = W; this.tmp.height = H; this.t = this.tmp.getContext('2d');
    this.imgs = {}; this.ready = false;
    this.color = 'factory'; this.from = 'factory'; this.wipe = 1;      // wrap: from → color, wipe 0..1
    this.vlt = null; this.vltFrom = null; this.sq = 1;               // tint: vltFrom → vlt, squeegee 0..1
    // stage interface (frames.js Seq look-alike)
    this.name = 'build'; this.n = 1; this.bmps = [];
  }
  load() {
    if (this.loading) return this.loading;
    const get = src => fetch(src).then(r => r.blob()).then(b => (window.createImageBitmap ? createImageBitmap(b) : new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = URL.createObjectURL(b); })));
    const jobs = [...KEYS.map(k => get(`assets/build/${k}.webp`).then(b => (this.imgs[k] = b))),
      get('assets/build/glass.webp').then(b => (this.glass = b)), get('assets/build/mask.png').then(b => (this.mask = b))];
    this.loading = Promise.all(jobs).then(() => { this.ready = true; });
    return this.loading;
  }
  poster() { return this.load(); }
  loaded() { return this.ready ? 1 : 0; }
  want() {}
  frame(i) { return i === 0 ? this.draw() : null; }
  nearest() { return this.draw(); }
  get width() { return W; } get height() { return H; }

  // ---- state ----
  setColor(k, tween) {
    if (!KEYS.includes(k) || k === this.color) return;
    this.from = this.color; this.color = k; this.wipe = 0;
    return tween ? tween(this, 'wipe', 1.6) : (this.wipe = 1);
  }
  setTint(v, tween) {
    if (v === this.vlt) return;
    this.vltFrom = this.vlt; this.vlt = v; this.sq = 0;
    return tween ? tween(this, 'sq', .9) : (this.sq = 1);
  }

  // ---- drawing ----
  draw() {
    if (!this.imgs.factory) return null;
    const key = [this.from, this.color, this.wipe, this.vltFrom, this.vlt, this.sq, !!this.glass, !!this.mask, Object.keys(this.imgs).length].join('|');
    if (key === this.key) return this.c;
    this.key = key;
    const g = this.g, t = this.t, base = this.imgs[this.from] || this.imgs.factory, top = this.imgs[this.color] || base;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.drawImage(this.wipe >= 1 ? top : base, 0, 0);
    if (this.wipe < 1 && top !== base) {
      // new wrap laid front to back: a soft edge, plus a glossy squeegee highlight riding the edge (on the car only)
      const e = lerp(BODY[0] - 80, BODY[1] + 80, ss(0, 1, this.wipe));
      t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1; t.clearRect(0, 0, W, H);
      t.drawImage(top, 0, 0);
      const gr = t.createLinearGradient(e - 26, 0, e + 26, 0); gr.addColorStop(0, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      t.globalCompositeOperation = 'destination-in'; t.fillStyle = gr; t.fillRect(0, 0, W, H);
      g.drawImage(this.tmp, 0, 0);
      if (this.mask) {
        t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H);
        const hl = t.createLinearGradient(e - 60, 0, e + 22, 0);
        hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(.75, 'rgba(255,255,255,.55)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
        t.fillStyle = hl; t.fillRect(e - 60, BAND[0], 82, BAND[1] - BAND[0]);   // body only, not the bay or the floor
        t.globalCompositeOperation = 'destination-in'; t.drawImage(this.mask, 0, 0);
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = .4 * Math.sin(Math.PI * this.wipe); g.drawImage(this.tmp, 0, 0);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      }
    }
    if (this.glass) {
      // old film everywhere, new film above the squeegee line, then a bright glint on the line itself
      const yl = lerp(GLASS[0] - 8, GLASS[1] + 8, ss(0, 1, this.sq));
      this.film(film(this.vltFrom), 0, H);
      if (this.sq > 0) { this.film(film(this.vlt), 0, yl); }
      if (this.sq > 0 && this.sq < 1) {
        t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1; t.clearRect(0, 0, W, H);
        const gl = t.createLinearGradient(0, yl - 4, 0, yl + 4); gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(.5, 'rgba(255,255,255,.8)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        t.fillStyle = gl; t.fillRect(0, yl - 4, W, 8);
        t.globalCompositeOperation = 'destination-in'; t.drawImage(this.glass, 0, 0);
        g.globalCompositeOperation = 'lighter'; g.drawImage(this.tmp, 0, 0); g.globalCompositeOperation = 'source-over';
      }
    }
    return this.c;
  }
  // tint film over the side glass between rows y0..y1
  film({ a, limo }, y0, y1) {
    if (a <= 0 || y1 <= y0) return;
    const g = this.g, t = this.t;
    g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip();
    g.globalAlpha = a; g.drawImage(this.glass, 0, 0); g.globalAlpha = 1;
    if (limo > 0) {
      t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1; t.clearRect(0, 0, W, H);
      t.fillStyle = '#000'; t.fillRect(0, 0, W, H);
      t.globalCompositeOperation = 'destination-in'; t.drawImage(this.glass, 0, 0);
      g.globalAlpha = limo; g.drawImage(this.tmp, 0, 0); g.globalAlpha = 1;
    }
    g.restore();
  }
}
