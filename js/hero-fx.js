// Studio lighting over the arrival clip: a softbox sweep behind the car, its highlight on the paint, shadows and a vignette.
// The car is baked into the video frames, so "behind" comes from a matte of the car (assets/hero/*-mask.webp). JS only places
// the plate on the car and sets its opacity; the sweep itself is a CSS transform animation on the compositor.
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Where the car sits in the clip relative to frame 96 (the resting frame), as a fraction of the image (from the bounding box of per-frame mattes)
const KEYS = [
  { f: 58, s: 0.9128, x: 0.0451, y: 0.0376 }, { f: 74, s: 0.9427, x: 0.0277, y: 0.023 }, { f: 96, s: 1, x: 0, y: 0 }, { f: 104, s: 1.0207, x: -0.0116, y: -0.009 }, { f: 119, s: 1.0625, x: -0.0329, y: -0.0272 }, { f: 139, s: 1.1254, x: -0.0677, y: -0.0563 },
];
const PAD = .12;   // the plate is the image plus 12% on each side, so a moved or scaled matte still covers the screen
const FADE = { inFrom: 58, inTo: 92, outFrom: 116, outTo: 142 };   // on while the bay is dim, gone before the headlights come on

function carAt(f) {
  if (f <= KEYS[0].f) return KEYS[0];
  for (let i = 1; i < KEYS.length; i++) {
    if (f <= KEYS[i].f) {
      const a = KEYS[i - 1], b = KEYS[i], t = (f - a.f) / (b.f - a.f);
      return { s: a.s + (b.s - a.s) * t, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return KEYS[KEYS.length - 1];
}

export function heroFx(root, hero) {
  const plate = root.querySelector('.hfx__plate'), render = root.querySelector('.hfx__render');
  const src = hero.dataset.render;
  if (src) { render.src = src; render.hidden = false; }
  let W0 = 0, H0 = 0, shown = -1, on = false;
  const size = (w, h) => {   // the plate is laid out near screen size so transforms stay close to scale 1; this only runs on resize
    W0 = w; H0 = h;
    plate.style.width = `${w * (1 + 2 * PAD)}px`; plate.style.height = `${h * (1 + 2 * PAD)}px`;
  };
  addEventListener('resize', () => { W0 = 0; });

  return function update(rect, f) {
    const o = rect ? ss(FADE.inFrom, FADE.inTo, f) * (1 - ss(FADE.outFrom, FADE.outTo, f)) : 0;
    const vis = o > .002;
    if (vis !== on) { on = vis; root.classList.toggle('is-on', on); }
    if (!on) { shown = -1; return; }
    if (!W0) size(rect.w, rect.h);
    const c = carAt(f), k = rect.w * c.s / W0;
    const tx = rect.x + rect.w * c.x - k * PAD * W0, ty = rect.y + rect.h * c.y - k * PAD * H0;
    plate.style.transform = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${k.toFixed(5)})`;
    if (Math.abs(o - shown) > .004 || (o === 1 && shown !== 1)) { shown = o; root.style.opacity = o.toFixed(3); }
    if (src) render.style.opacity = (1 - ss(96, 110, f)).toFixed(3);
  };
}
