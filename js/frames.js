// Image-sequence playback: Higgsfield clips exported to WebP frames, drawn to a <canvas> by frame index.
import COUNTS from './frames-manifest.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const SMALL = matchMedia('(max-width: 767px)').matches;
const SET = SMALL ? 'mobile' : 'desktop';
const CONCURRENCY = 6;

const all = {};
export function seq(name) { return all[name] || (all[name] = new Seq(name, COUNTS[name])); }

class Seq {
  constructor(name, n) { this.name = name; this.n = n; this.imgs = new Array(n); this.started = false; this.listeners = new Set(); }
  src(i) { return `assets/frames/${this.name}/${SET}/${String(i + 1).padStart(4, '0')}.webp`; }
  img(i) {
    let im = this.imgs[i];
    if (!im) {
      im = this.imgs[i] = new Image(); im.decoding = 'async';
      im.done = new Promise(r => { im.onload = () => { im.ok = true; this.listeners.forEach(f => f(i)); r(); }; im.onerror = r; });
      im.src = this.src(i);
    }
    return im;
  }
  poster() { return this.img(0).done; }
  // coarse-to-fine order (every 16th frame, then every 8th, ...) so scrubbing has something close while the rest streams in
  load() {
    if (this.started) return this.all; this.started = true;
    const seen = new Uint8Array(this.n), order = [0, this.n - 1];
    seen[0] = seen[this.n - 1] = 1;
    for (let step = 16; step >= 1; step >>= 1) for (let i = 0; i < this.n; i += step) if (!seen[i]) { seen[i] = 1; order.push(i); }
    let next = 0;
    const worker = () => next < order.length ? this.img(order[next++]).done.then(worker) : null;
    this.all = Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return this.all;
  }
  nearest(i) {
    i = clamp(Math.round(i), 0, this.n - 1);
    for (let d = 0; d < this.n; d++) {
      const a = this.imgs[i - d], b = this.imgs[i + d];
      if (a && a.ok) return a; if (b && b.ok) return b;
    }
    return null;
  }
}

// One fixed full-screen canvas for the whole page. render() draws one clip, or two while one dissolves into the next.
// layer: { s, f, alpha, scale, fit, y, focusX }. fit 'width' (portrait screens only) shows the whole car across the
// width instead of cropping to the doors.
export class Stage {
  constructor(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d', { alpha: false });
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, SMALL ? 2 : 1.5);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (w !== this.c.width || h !== this.c.height) { this.c.width = w; this.c.height = h; }
  }
  render(layers, { dx = 0, dy = 0, flare = 0 } = {}) {
    const g = this.g, { width: cw, height: ch } = this.c;
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#060607'; g.fillRect(0, 0, cw, ch);
    for (const L of layers) {
      g.fillStyle = '#060607';
      const im = L.s.nearest(L.f); if (!im || L.alpha <= 0) continue;
      const iw = im.naturalWidth, ih = im.naturalHeight, byWidth = L.fit === 'width' && ch > cw;
      const k = (byWidth ? cw / iw * 1.18 : Math.max(cw / iw, ch / ih)) * (L.scale || 1), w = iw * k, h = ih * k;
      const x = byWidth ? (cw - w) / 2 : (cw - w) * (L.focusX ?? .5), y = byWidth ? (ch - h) * (L.y ?? .4) : (ch - h) / 2;
      g.globalAlpha = Math.min(1, L.alpha);
      if (byWidth) g.fillRect(0, 0, cw, ch);   // letterbox in bay-black, so a dissolve fades the whole screen, not a box
      g.drawImage(im, x + dx * cw, y + dy * ch, w, h);
      if (byWidth) {                          // feather the top and bottom edges into the letterbox
        const e = h * .14, X = x + dx * cw, Y = y + dy * ch;
        for (const [y0, y1] of [[Y, Y + e], [Y + h, Y + h - e]]) {
          const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#060607'); gr.addColorStop(1, 'rgba(6,6,7,0)');
          g.fillStyle = gr; g.fillRect(X, Math.min(y0, y1), w, e);
        }
        g.fillStyle = '#060607';
      }
    }
    if (flare > .01) {   // a soft bay-light flare at the middle of a dissolve
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = flare;
      const r = g.createRadialGradient(cw * .55, ch * .35, 0, cw * .55, ch * .35, Math.max(cw, ch) * .7);
      r.addColorStop(0, 'rgba(235,240,255,.9)'); r.addColorStop(.35, 'rgba(255,60,70,.25)'); r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, cw, ch);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
}
