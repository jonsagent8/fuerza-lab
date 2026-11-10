// Image-sequence playback: Higgsfield clips exported to WebP frames, drawn to a <canvas> by frame index.
import COUNTS from './frames-manifest.js?v=turn5';
// bump when a sequence's frames are re-rendered in place (the frames are cached for an hour)
const FRAME_VER = { 'spin-black': 'glass1' };
for (const c of ['black', 'red', 'blue', 'graphite', 'pearl', 'chrome', 'matte']) FRAME_VER[`spin-${c}-mask`] = 'ws9';   // + windshield (R)

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const SMALL = matchMedia('(max-width: 767px)').matches;
const TOUCH = SMALL || matchMedia('(pointer: coarse)').matches;
// Every device loads the same full-size frames (native clip size, up to 1920 wide). Downloaded frames are kept compressed
// (a Blob each); only a small window around the playhead is decoded into ImageBitmaps, off the main thread, so a phone
// never holds hundreds of 1920px bitmaps or re-decodes one mid-scroll.
const FETCHERS = 8;                       // parallel downloads, shared by every clip
const DECODERS = TOUCH ? 3 : 4;           // parallel decodes
const AHEAD = TOUCH ? 10 : 18, BEHIND = TOUCH ? 4 : 8;   // decoded frames kept around the playhead (direction of play first)
const IDLE_MS = 1200;                     // a clip not drawn for this long drops to a single decoded frame

const all = {};
export function seq(name) { return all[name] || (all[name] = new Seq(name, COUNTS[name])); }

class Seq {
  constructor(name, n) {
    this.name = name; this.n = n; this.blobs = new Array(n); this.bmps = new Array(n); this.slots = new Array(n);
    this.busy = new Set(); this.started = false; this.prio = 0; this.c = 0; this.dir = 1; this.seen = -1e9; this.keep = -1;
    this.loop = false;   // a turntable spin: frame indices wrap around (n-1 is followed by 0)
  }
  wrap(i) { return this.loop ? ((i % this.n) + this.n) % this.n : i; }
  // signed distance from frame a to frame b, the short way round on a loop
  dist(a, b) { let d = b - a; if (this.loop) { d = ((d % this.n) + this.n) % this.n; if (d > this.n / 2) d -= this.n; } return d; }
  src(i) { return `assets/frames/${this.name}/full/${String(i + 1).padStart(4, '0')}.webp${FRAME_VER[this.name] ? '?v=' + FRAME_VER[this.name] : ''}`; }
  // ask for frame i now (jumps the download queue); .done resolves once it is downloaded
  img(i) {
    let sl = this.slots[i];
    if (!sl) { sl = this.slots[i] = {}; sl.done = new Promise(r => (sl.resolve = r)); urgent.push([this, i]); fetchPump(); }
    return sl;
  }
  // first frame, downloaded and decoded (kept for good as the clip's poster)
  poster() {
    this.keep = 0;
    return this.img(0).done.then(() => this.decode(0));
  }
  // download the whole clip, coarse-to-fine (every 16th frame, then every 8th, ...) so scrubbing has something close
  // while the rest streams in. Clips share one queue: the one on screen and the next one down go first (setFocus).
  load() {
    if (this.started) return this.all; this.started = true;
    const seen = new Uint8Array(this.n), order = [0, this.n - 1], coarse = [1, 1];
    seen[0] = seen[this.n - 1] = 1;
    for (let step = 16; step >= 1; step >>= 1) for (let i = 0; i < this.n; i += step) if (!seen[i]) { seen[i] = 1; order.push(i); coarse.push(step >= 8 ? 1 : 0); }
    this.order = order; this.coarse = coarse; this.next = 0;
    this.all = Promise.all(order.map(i => this.slot(i).done));
    queue.push(this); fetchPump();
    return this.all;
  }
  // forget a clip's downloads (a wrap colour the visitor moved away from), so a phone doesn't keep seven spins in memory
  unload() {
    this.started = false; this.all = null; this.keep = -1; this.seen = -1e9;
    const qi = queue.indexOf(this); if (qi >= 0) queue.splice(qi, 1);
    for (let k = urgent.length - 1; k >= 0; k--) if (urgent[k][0] === this) urgent.splice(k, 1);
    for (const b of this.bmps) if (b && b.close) b.close();
    this.bmps = new Array(this.n); this.blobs = new Array(this.n); this.slots = new Array(this.n); this.busy.clear(); live.delete(this);
  }
  slot(i) { let sl = this.slots[i]; if (!sl) { sl = this.slots[i] = {}; sl.done = new Promise(r => (sl.resolve = r)); } return sl; }
  loaded() { let k = 0; for (const b of this.blobs) if (b) k++; return k; }
  decode(i) {
    if (this.bmps[i]) return Promise.resolve(this.bmps[i]);
    const b = this.blobs[i]; if (!b || b === 'err') return Promise.resolve(null);
    this.busy.add(i);
    return toBitmap(b).then(bm => {
      this.busy.delete(i);
      if (bm && window.__fzTag) window.__fzTag(bm, this.name, i);   // test hook (_hf/load-choppy.mjs)
      if (bm && this.wanted(i)) this.bmps[i] = bm; else if (bm && bm.close) bm.close();
      return this.bmps[i] || null;
    });
  }
  wanted(i) {
    if (i === this.keep) return true;
    const d = this.dist(this.c, i) * this.dir;
    return performance.now() - this.seen < IDLE_MS ? d <= AHEAD + 4 && d >= -(BEHIND + 4) : Math.abs(this.dist(this.c, i)) <= 1;
  }
  // called by the stage whenever this clip is drawn at (fractional) frame f
  want(f) {
    const c = this.loop ? this.wrap(Math.round(f)) : clamp(Math.round(f), 0, this.n - 1);
    if (c !== this.c) {
      this.dir = this.dist(this.c, c) > 0 ? 1 : -1;
      // a spin can be dragged anywhere: fetch the frames around the playhead first, ahead of the rest of the clip
      if (this.loop) for (let d = -BEHIND; d <= AHEAD + 6; d++) { const i = this.wrap(c + d * this.dir); if (!this.slots[i]) this.img(i); }
    }
    this.c = c; this.seen = performance.now(); live.add(this);
  }
  trim() { for (let i = 0; i < this.n; i++) if (this.bmps[i] && !this.wanted(i)) { this.bmps[i].close && this.bmps[i].close(); this.bmps[i] = null; } }
  frame(i) { i = this.wrap(i); return i >= 0 && i < this.n ? this.bmps[i] || null : null; }
  nearestIdx(f) {
    const i = this.loop ? this.wrap(Math.round(f)) : clamp(Math.round(f), 0, this.n - 1);
    for (let d = 0; d < this.n; d++) { if (this.bmps[this.wrap(i - d)]) return this.wrap(i - d); if (this.bmps[this.wrap(i + d)]) return this.wrap(i + d); }
    return -1;
  }
  nearest(f) {
    const i = this.loop ? this.wrap(Math.round(f)) : clamp(Math.round(f), 0, this.n - 1);
    for (let d = 0; d < this.n; d++) { const a = this.bmps[this.wrap(i - d)], b = this.bmps[this.wrap(i + d)]; if (a) return a; if (b) return b; }
    return null;
  }
}

function toBitmap(blob) {
  if (window.createImageBitmap) return createImageBitmap(blob).catch(() => null);
  return new Promise(r => { const im = new Image(), u = URL.createObjectURL(blob); im.onload = () => (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { URL.revokeObjectURL(u); r(im); }); im.onerror = () => r(null); im.src = u; });
}

// ---- downloads: urgent requests first, then clips by scroll distance; a clip's coarse frames beat far-away fine ones ----
const urgent = [], queue = []; let fetching = 0;
function pickFetch() {
  while (urgent.length) { const [q, i] = urgent.shift(); if (!q.blobs[i] && !q.slot(i).req) return [q, i]; }
  let best = null, bs = Infinity;
  for (const q of queue) {
    while (q.next < q.order.length && q.slot(q.order[q.next]).req) q.next++;
    if (q.next >= q.order.length) continue;
    const sc = q.prio + (q.coarse[q.next] ? 0 : 1.5);
    if (sc < bs) { bs = sc; best = q; }
  }
  return best ? [best, best.order[best.next++]] : null;
}
function fetchPump() {
  while (fetching < FETCHERS) {
    const job = pickFetch(); if (!job) return;
    const [q, i] = job, sl = q.slot(i); sl.req = true; fetching++;
    fetch(q.src(i)).then(r => (r.ok ? r.blob() : 'err')).catch(() => 'err').then(b => {
      q.blobs[i] = b; fetching--; sl.resolve(); fetchPump(); decodePump();
    });
  }
}
// called every frame from the scroll loop: [{ s, top, h }] in page px. 0 = on screen; scenes behind count triple.
export function setFocus(list, y, vh) {
  for (const { s, top, h } of list) {
    const ahead = (top - (y + vh)) / vh, behind = (y - (top + h)) / vh;
    s.prio = ahead > 0 ? ahead : behind > 0 ? behind * 3 : 0;
  }
}

// ---- decodes: frames nearest the playhead of clips drawn in the last moment, direction of play first ----
const live = new Set(); let decoding = 0;
function pickDecode() {
  let best = null, bi = -1, bs = Infinity; const now = performance.now();
  for (const q of live) {
    if (now - q.seen > IDLE_MS) continue;
    for (let d = -BEHIND; d <= AHEAD; d++) {
      const i = q.wrap(q.c + d * q.dir); if (i < 0 || i >= q.n || q.bmps[i] || q.busy.has(i)) continue;
      const b = q.blobs[i]; if (!b || b === 'err') continue;
      const sc = (d < 0 ? -d * 2.5 : d) * (q.name.endsWith('-mask') ? .3 : 1);   // glass masks are tiny: decode them first
      if (sc < bs) { bs = sc; best = q; bi = i; }
    }
  }
  return best ? [best, bi] : null;
}
function decodePump() {
  while (decoding < DECODERS) {
    const job = pickDecode(); if (!job) return;
    const [q, i] = job; decoding++;
    q.decode(i).then(() => { decoding--; decodePump(); });
  }
}
function sweep() {
  const now = performance.now();
  for (const q of live) { q.trim(); if (now - q.seen > IDLE_MS * 2) live.delete(q); }
}
setInterval(sweep, 400);

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
      // between two clip frames, draw the earlier one and fade the next over it; if either isn't in yet, show the closest frame
      L.s.want(L.f);
      // a clip with a painter (the recolorable spin) hands back one finished picture, in-between blend included
      const i0 = Math.floor(L.f), f0 = L.s.frame(i0), f1 = L.s.frame(i0 + 1), both = !L.s.paint && f0 && f1;
      const im = L.s.paint ? L.s.paint(L.f) : both ? f0 : L.s.nearest(L.f); if (!im || L.alpha <= 0) continue;
      const iw = im.width, ih = im.height, byWidth = L.fit === 'width' && ch > cw;
      const k = (byWidth ? cw / iw * 1.18 : Math.max(cw / iw, ch / ih)) * (L.scale || 1), w = iw * k, h = ih * k;
      const x = byWidth ? (cw - w) / 2 : (cw - w) * (L.focusX ?? .5), y = byWidth ? (ch - h) * (L.y ?? .4) : (ch - h) / 2;
      g.globalAlpha = Math.min(1, L.alpha);
      if (byWidth) g.fillRect(0, 0, cw, ch);   // letterbox in bay-black, so a dissolve fades the whole screen, not a box
      g.drawImage(im, x + dx * cw, y + dy * ch, w, h);
      const mix = L.f - i0;
      if (both && mix > .01) { g.globalAlpha = Math.min(1, L.alpha) * mix; g.drawImage(f1, x + dx * cw, y + dy * ch, w, h); g.globalAlpha = Math.min(1, L.alpha); }
      this.rect = { name: L.s.name, x: (x + dx * cw) / cw * innerWidth, y: (y + dy * ch) / ch * innerHeight, w: w / cw * innerWidth, h: h / ch * innerHeight };   // CSS px, for overlays tracking the picture
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
    decodePump();
  }
}
