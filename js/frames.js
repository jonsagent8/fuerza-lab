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

// One canvas per scene. draw(f) only repaints when the shown frame or the canvas size changes.
export class Painter {
  // fit 'width' (portrait screens only): show the whole car across the width instead of cropping to the doors
  constructor(canvas, { focusX = .5, fit = 'cover', y = .4 } = {}) {
    this.c = canvas; this.g = canvas.getContext('2d', { alpha: false }); this.focusX = focusX; this.fit = fit; this.y = y; this.shown = null; this.seq = null;
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() {
    const r = this.c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, SMALL ? 2 : 1.5);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w === this.c.width && h === this.c.height) return;
    this.c.width = w; this.c.height = h; this.shown = null;
    if (this.seq) this.draw(this.seq, this.lastF);   // a resized canvas is cleared, so put the frame back
  }
  draw(s, f) {
    this.seq = s; this.lastF = f;
    const im = s.nearest(f); if (!im || im === this.shown) return;
    this.shown = im;
    const { width: cw, height: ch } = this.c, iw = im.naturalWidth, ih = im.naturalHeight;
    const portrait = ch > cw;
    if (this.fit === 'width' && portrait) {
      const k = cw / iw * 1.18, w = iw * k, h = ih * k;
      this.g.fillStyle = '#060607'; this.g.fillRect(0, 0, cw, ch);
      this.g.drawImage(im, (cw - w) / 2, (ch - h) * this.y, w, h);
      return;
    }
    const k = Math.max(cw / iw, ch / ih), w = iw * k, h = ih * k;   // object-fit: cover
    this.g.drawImage(im, (cw - w) * this.focusX, (ch - h) / 2, w, h);
  }
}
