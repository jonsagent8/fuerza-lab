import * as FX from './fx.js?v=turn1';
import { seq, Stage, SMALL, setFocus } from './frames.js?v=turn17';
import { heroFx } from './hero-fx.js';
import { Painter } from './paint.js?v=ws1';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });
$('#yr').textContent = new Date().getFullYear();

/* ---------------- smooth scroll ---------------- */
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new Lenis({ lerp: .085, smoothWheel: true, wheelMultiplier: .9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
}
const scrollTo = target => lenis ? lenis.scrollTo(target, { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) }) : target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href'); const el = id === '#top' ? document.body : $(id); if (!el) return;
  e.preventDefault(); nav.classList.remove('menu-open'); $('#navMenu').setAttribute('aria-expanded', 'false'); scrollTo(id === '#top' ? 0 : el);
}));

/* ---------------- cursor + interactive bits ---------------- */
if (finePointer && !reduce) { FX.cursor($('#cursor'), $('#cursorLabel')); FX.bubbles($('#bubbles')); }
FX.magnetic(finePointer ? $$('.magnetic') : []);
FX.tilt($$('.tilt'));
FX.heal($('#healPad'), $('#healCanvas'), $('#healTemp'));

/* ---------------- video: one fixed stage plays every Higgsfield clip, scrubbed by scroll ---------------- */
// [data-media] sections are windows onto the stage. Neighbouring scenes dissolve into each other instead of cutting.
// `still` is the frame shown with reduced motion.
const stage = new Stage($('#stage'));
const updateHeroFx = heroFx($('#heroFx'), $('.hero'));
// tint and wrap open on a photoreal turntable of the car that the visitor drags to rotate. Every wrap colour is its own
// rendered spin (assets/frames/spin-<colour>: 360 frames, 1 degree each, four Higgsfield segments chained by
// _hf/build-spin.mjs), so the paint, reflections and lighting are real footage. Picking a colour fades from one spin to
// the other at the same angle. The window tint is the one live effect: js/paint.js darkens the glass using a small
// per-frame glass mask (spin-<colour>-mask). With no film and no fade the plain frame is drawn, like any other clip.
const SPINS = Object.fromEntries(['black', 'red', 'blue', 'graphite', 'pearl', 'chrome', 'matte'].map(k => {
  const s = seq('spin-' + k), m = seq('spin-' + k + '-mask'); s.loop = m.loop = true; return [k, { k, s, m }];
}));
const painter = new Painter(), PAINT = painter.ok;
const film = { vlt: 1, wvlt: 1 };   // vlt: side + rear windows, wvlt: windshield (0..1, 1 = no film)
const filmOn = () => film.vlt < .999 || film.wvlt < .999;
const look = { cur: SPINS.black, prev: null, t: 1, last: 0 };   // prev fades out while cur fades in (t: 0 -> 1)
const FADE_S = .6;
// closest angle to i where this spin has its frame (and its glass mask, when a film is on) decoded
// (a frame with its mask only within a couple of degrees; further off it is better to show this angle without the film)
const maskNear = (L, j, n) => { for (let d = 0; d <= n; d++) { const m = L.m.frame(j + d) || L.m.frame(j - d); if (m) return m; } return null; };
function pick(L, i, needMask) {
  const ok = j => L.s.frame(j) && (!needMask || L.m.frame(j));
  for (let d = 0, n = needMask ? 3 : 180; d < n; d++) { if (ok(i + d)) return L.s.wrap(i + d); if (ok(i - d)) return L.s.wrap(i - d); }
  return -1;
}
const SPIN = {
  name: 'spin', n: 360, loop: true,
  wrap: i => ((i % 360) + 360) % 360,
  want(f) { const tinted = filmOn(); for (const L of [look.cur, look.prev]) if (L) { L.s.want(f); if (tinted) L.m.want(f); } },
  frame() { return null }, nearest() { return null },
  load() { look.cur.s.load(); if (PAINT) look.cur.m.load(); },
  img(i) { look.cur.s.img(i); if (PAINT) look.cur.m.img(i); },
  paint(f) {
    const i = this.wrap(Math.round(f)), tinted = PAINT && filmOn(), L = look.cur;
    let a = pick(L, i, tinted); if (a < 0 && tinted) a = pick(L, i, false);
    // fading: hold the old colour until the new one has this angle, then dissolve over FADE_S
    const now = performance.now(), dt = Math.min(.1, (now - look.last) / 1000); look.last = now;
    if (look.prev) {
      const P = look.prev; let b = pick(P, i, tinted); if (b < 0) b = pick(P, i, false);
      const ready = a >= 0 && Math.abs(SPIN_DIST(a, i)) <= 2;
      if (!ready && b >= 0) {   // new colour not in yet at this angle: keep showing the old one
        const fb = P.s.frame(b), mb = tinted && maskNear(P, b, 12);
        return mb ? painter.draw(fb, fb, mb, mb, 0, film.vlt, film.wvlt) : fb;
      }
      if (ready) look.t = Math.min(1, look.t + dt / FADE_S);
      if (!ready || look.t >= 1 || !PAINT || b < 0) endFade();
      else return painter.draw(P.s.frame(b), L.s.frame(a), tinted ? maskNear(P, b, 12) : null, tinted ? maskNear(L, a, 12) : null, ss(0, 1, look.t), film.vlt, film.wvlt);
    }
    if (a < 0) return null;
    if (!tinted) return L.s.frame(a);
    // mid-spin the exact mask may not be decoded yet: a neighbouring angle's mask is a pixel or two off, which can't be
    // seen while the car turns, whereas dropping the film for a frame flashes the glass
    const fa = L.s.frame(a), ma = maskNear(L, a, 12);
    if (window.__fzPaint != null) { window.__fzPaint++; if (!ma) window.__fzMiss++; }   // test hook (_hf/flash-test.mjs)
    if (!ma) return this.held != null && Math.abs(SPIN_DIST(this.held, a)) <= 24 ? painter.c : fa;   // none near: hold the last filmed picture a tick
    this.held = a;
    return painter.draw(fa, fa, ma, ma, 0, film.vlt, film.wvlt);
  },
};
const SPIN_DIST = (a, b) => { let d = ((b - a) % 360 + 360) % 360; return d > 180 ? d - 360 : d; };
function endFade() { const P = look.prev; look.prev = null; look.t = 1; if (P && P !== look.cur) { P.s.unload(); P.m.unload(); } }
const media = $$('[data-media]').map(el => ({
  el, name: el.dataset.media, role: el.dataset.role || '', s: seq(el.dataset.media),
  fit: el.dataset.fit || 'cover', y: +(el.dataset.y || .4), focusX: +(el.dataset.focus || .5),
  f: 0, still: +(el.dataset.still || 1), top: 0, h: 1, prog: 0,
}));
const M = Object.fromEntries(media.map(m => [m.role || m.name, m]));

// lazy-load a scene's frames once it is within one viewport of the screen; frame 0 is fetched up front as the poster
media.forEach(m => m.s.poster());
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const m = media.find(x => x.el === e.target);
  if (m.role === 'tint' || m.role === 'wrap') { if (reduce) [0, 90, 180, 270].forEach(i => SPIN.img(i)); else SPIN.load(); }   // reduced motion: only the four stills
  else if (!reduce) m.s.load();
  else if (reduce && !m.role) m.s.img(Math.round(m.still * (m.s.n - 1)));
}), { rootMargin: '300% 0px' });   // start early; the shared queue still fills the on-screen clip first
media.forEach(m => io.observe(m.el));

/* ---------------- loader ---------------- */
const heroWords = $$('.hero__title [data-split]').flatMap(el => [...FX.split(el)]);
gsap.set(heroWords, { yPercent: 110 });
gsap.set(['.hero__sub', '.hero__cta', '.hero__reviews', '.hero .eyebrow', '.hero__foot'], { autoAlpha: 0, y: 24 });
const arrivalIntro = { v: reduce ? 1 : 0 };   // the bay lights come on by themselves after the loader; scroll scrubs the rest
(function loader() {
  const bar = $('#loaderBar'), pct = $('#loaderPct'), txt = $('#loaderTxt'), words = ['PRE-RINSE', 'SNOW FOAM', 'HAND WASH', 'SPOT-FREE RINSE', 'READY'];
  const p = { v: 0 }, a = M.arrival.s;
  // wait for the poster plus the coarse pass of the arrival clip, capped at 5 s
  const ready = Promise.race([a.poster().then(() => Promise.all(Array.from({ length: Math.ceil(a.n / 16) }, (_, i) => a.img(i * 16).done))), new Promise(r => setTimeout(r, 5000))]);
  if (!reduce) a.load();
  const fill = gsap.to(p, { v: 88, duration: 1.6, ease: 'power2.out', onUpdate: draw });
  function draw() { bar.style.width = p.v + '%'; pct.textContent = String(Math.round(p.v)).padStart(3, '0'); txt.textContent = words[Math.min(4, Math.floor(p.v / 21))]; }
  Promise.all([ready, fill.then(), document.fonts ? document.fonts.ready : null]).then(() => {
    gsap.timeline()
      .to(p, { v: 100, duration: .45, ease: 'power1.inOut', onUpdate: draw })
      .to('#loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '+=.1')
      .set('#loader', { display: 'none' })
      .to(arrivalIntro, { v: 1, duration: reduce ? 0 : 2.6, ease: 'power2.inOut' }, '-=.6')
      .to(heroWords, { yPercent: 0, duration: 1.2, stagger: .08, ease: 'expo.out' }, '-=2.2')
      .to(['.hero .eyebrow', '.hero__sub', '.hero__cta', '.hero__reviews', '.hero__foot'], { autoAlpha: 1, y: 0, duration: 1, stagger: .1, ease: 'power3.out' }, '-=.9')
      .add(() => FX.scramble($('.hero .eyebrow')), '-=1');
    measure();
  });
})();

/* ---------------- spin: drag / swipe sideways on tint + wrap turns the car (loops both ways, with inertia) ---------------- */
// frame index grows as the near side of the car moves left, so dragging left turns it that way
const spin = { f: 0, vel: 0, drag: false, turn: 0 };   // turn: the scroll-driven part of the angle (see TURN)
// scrolling into tint turns the car from nearly head-on to the three-quarter view with more of the side (frame 0),
// finishing exactly where the page settles on it
const TURN = 18;
const SPIN_PER_PX = () => SPIN.n / Math.max(600, innerWidth * (mobile ? 1.5 : 1.1));   // a full turn ≈ one and a bit screen widths
for (const el of [$('#tint'), $('#wrap')]) {
  let x0 = null, t0 = 0, id = null;
  el.addEventListener('pointerdown', e => {
    if (reduce || e.target.closest('button, a')) return;
    x0 = e.clientX; t0 = performance.now(); id = e.pointerId; spin.drag = true; spin.vel = 0; el.classList.add('spinning');
    showSpin(el.id);                                                   // a playing wrap / tint clip gives way to the spin
  });
  el.addEventListener('pointermove', e => {
    if (x0 == null || e.pointerId !== id) return;
    const now = performance.now(), df = -(e.clientX - x0) * SPIN_PER_PX();
    spin.f += df; spin.vel = df / Math.max(1, (now - t0) / (1000 / 60));   // frames per 60 Hz tick, for the fling
    x0 = e.clientX; t0 = now;
  });
  const end = e => { if (x0 == null || (e && e.pointerId !== id)) return; x0 = null; spin.drag = false; el.classList.remove('spinning'); if (performance.now() - t0 > 120) spin.vel = 0; };   // finger rested before letting go: no fling
  // phones: a swipe that starts sideways keeps spinning even if the finger drifts up or down (the page doesn't scroll away)
  let tx = 0, ty = 0, lock = null;
  el.addEventListener('touchstart', e => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; lock = e.touches.length > 1 || reduce || e.target.closest('button, a') ? 'y' : null; }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (lock == null) { const t = e.touches[0], dx = Math.abs(t.clientX - tx), dy = Math.abs(t.clientY - ty); if (Math.max(dx, dy) < 6) return; lock = dx > dy * .7 ? 'x' : 'y'; }
    if (lock === 'x' && e.cancelable) e.preventDefault();
  }, { passive: false });
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
}
// reduced motion: no free spinning, the arrows step a quarter turn between the four keyframes
$$('.spin-arrows button').forEach(b => b.addEventListener('click', () => {
  const k = Math.round(spin.f / 90) + +b.dataset.step; spin.f = k * 90; spin.vel = 0;
  showSpin(b.closest('section').id);
}));
document.documentElement.classList.toggle('reduce-motion', reduce);

/* ---------------- hero reviews: the quotes take turns (reduced motion: the first one stays) ---------------- */
{ const qs = $$('.hero__quotes .rv'); let k = 0;
  if (!reduce && qs.length > 1) setInterval(() => { if (document.hidden) return; qs[k].classList.remove('on'); k = (k + 1) % qs.length; qs[k].classList.add('on'); }, 5500); }

/* ---------------- tint: a shade darkens the spin's glass (painter); without WebGL it plays the side-view tint clip ---------------- */
const tintFrac = v => (window.TINT_CURVE ? window.TINT_CURVE(v) : lerp(.15, 1, (70 - v) / 65));
const tint = { f: 0, v: null, clip: false, tw: null };
const tintFrame = v => tintFrac(v) * (seq('tint').n - 1);
function pickVlt(v) {
  tint.v = v; tint.tw && tint.tw.kill();
  if (PAINT) {   // the film slides from the old shade to the new one
    look.cur.m.load();
    if (reduce) { film.vlt = v / 100; return; }
    tint.tw = gsap.to(film, { vlt: v / 100, duration: .7, ease: 'power2.inOut' });
    return;
  }
  if (v === 100) { tint.clip = false; return; }   // no film: back to the plain spin
  const s = seq('tint');
  if (reduce) { tint.clip = true; tint.f = tintFrame(v); s.img(Math.round(tint.f)); return; }
  s.load().then(() => { tint.clip = true; tint.tw = gsap.to(tint, { f: tintFrame(v), duration: .8, ease: 'power3.inOut' }); });
}
$$('.vlt .chip[data-vlt]').forEach(ch => ch.addEventListener('click', () => { pickVlt(+ch.dataset.vlt); chipOn(+ch.dataset.vlt); }));
const chipOn = v => $$('.vlt .chip[data-vlt]').forEach(c => c.classList.toggle('on', +c.dataset.vlt === v));
// windshield: its own, lighter shade (painter only; the fallback tint clip can't show it)
const ws = { v: 100, tw: null };
if (!PAINT) $('#wsRow').hidden = true;
$$('.vlt .chip[data-wvlt]').forEach(ch => ch.addEventListener('click', () => {
  const v = ws.v = +ch.dataset.wvlt; ws.tw && ws.tw.kill();
  $$('.vlt .chip[data-wvlt]').forEach(c => c.classList.toggle('on', c === ch));
  look.cur.m.load();
  if (reduce) film.wvlt = v / 100; else ws.tw = gsap.to(film, { wvlt: v / 100, duration: .7, ease: 'power2.inOut' });
}));

/* ---------------- wrap: a swatch switches to that colour's own rendered spin, at the same angle ---------------- */
const wrap = { pick: -1 };
const COLORS = $$('.swatch').map(b => ({ el: b, k: b.dataset.k, f: b.dataset.f, name: b.querySelector('span').textContent, spin: SPINS[b.dataset.spin] }));
COLORS.forEach(c => {
  c.el.hidden = !c.spin;
  // start fetching the frames around the current angle as soon as a finger or pointer comes near the swatch
  const pre = () => { if (c.spin && c.spin !== look.cur) { const i = SPIN.wrap(Math.round(spin.f + spin.turn)); for (let d = -6; d <= 6; d++) c.spin.s.img(SPIN.wrap(i + d)); } };
  c.el.addEventListener('pointerenter', pre); c.el.addEventListener('touchstart', pre, { passive: true }); c.el.addEventListener('focus', pre);
});
COLORS.forEach((c, i) => c.el.addEventListener('click', () => applyWrap(i)));
function applyWrap(i) {
  const c = COLORS[i]; wrap.pick = i;
  COLORS.forEach((o, j) => o.el.classList.toggle('on', j === i));
  $('#wrapNow').textContent = `${c.name.toUpperCase()} · ${c.f.toUpperCase()} FINISH`;
  if (!c.spin || c.spin === look.cur) return;
  if (look.prev) endFade();                            // a fade still running: settle it first
  look.prev = look.cur; look.cur = c.spin; look.t = reduce || !PAINT ? 1 : 0; look.last = performance.now();
  const a = SPIN.wrap(Math.round(spin.f + spin.turn));
  for (let d = -8; d <= 8; d++) c.spin.s.img(SPIN.wrap(a + d));   // this angle first, then the rest of the turn
  if (reduce) [0, 90, 180, 270].forEach(k => SPIN.img(k)); else SPIN.load();
  if (filmOn()) c.spin.m.load();
}
function showSpin() {}

/* ---------------- scroll choreography ---------------- */
const scenes = $$('[data-scene]'), nav = $('#nav');
let offs = [];
// phones: park the hero car (frame 97: car spans 18%–80% of the picture height) just above the reviews
function placeHeroCar() {
  const hr = $('.hero__reviews'), A = M.arrival;
  if (!hr || !A || innerHeight <= innerWidth || getComputedStyle(hr).position !== 'absolute') { if (A) A.y = +(A.el.dataset.y || .4); return; }
  const h = innerWidth * 1.18 * 1080 / 1920;
  const top = innerHeight - parseFloat(getComputedStyle(hr).bottom) - hr.offsetHeight;
  A.y = Math.min(1, Math.max(0, (top - 10 - .8 * h) / (innerHeight - h)));
}
function measure() {
  placeHeroCar();
  const top = el => el.getBoundingClientRect().top + scrollY;
  offs = scenes.map(el => ({ top: top(el), h: el.offsetHeight }));
  media.forEach(m => { m.top = top(m.el); m.h = m.el.offsetHeight; });
  // scenes closer than a screen apart dissolve into each other over BLEND screens of scroll, ending where the next one pins;
  // each clip finishes scrubbing just before its dissolve starts
  const vh = innerHeight;
  media.forEach((m, i) => {
    const n = media[i + 1];
    m.next = n && n.top - (m.top + m.h) < vh ? n : null;
    if (n) n.prevAdj = !!m.next;
    m.scrubEnd = Math.max(m.top + vh * .5, m.next ? m.next.top - BLEND * vh : m.top + m.h - vh);
  });
}
const BLEND = 1.4;
// on touch devices the URL bar showing/hiding fires height-only resizes mid-scroll; re-measuring then makes the page jump
let lastW = innerWidth;
if (document.fonts) document.fonts.ready.then(placeHeroCar);
measure(); window.addEventListener('resize', () => { measure(); if (mobile && innerWidth === lastW) return; lastW = innerWidth; ScrollTrigger.refresh(); }); window.addEventListener('load', measure);

let hudCache = '';
const par = { x: 0, y: 0 }, S = { mx: 0, my: 0 };
addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { S.mx = e.clientX / innerWidth * 2 - 1; S.my = e.clientY / innerHeight * 2 - 1; } }, { passive: true });
const dots = $$('#dots a'), steps = $$('.steps li'), panels = scenes.map(s => $('.panel', s));
const hud = { scene: $('#hudScene'), status: $('#hudStatus'), read: $('#hudRead') };
const NAMES = ['ARRIVAL', 'HAND WASH', 'INTERIOR', 'WINDOW TINT', 'COLOR WRAP', 'PAINT PROTECTION'];
const tags = { before: $('.compare__tag--l'), after: $('.compare__tag--r') };

function tick() {
  // phones scroll natively (Lenis only smooths wheels), so read Safari's own scroll position and re-measure live
  if (mobile) measure();
  const y = lenis && !mobile ? lenis.animatedScroll : scrollY, vh = innerHeight;
  if (!offs.length) return;
  setFocus(media, y, vh);
  const R = offs.map(o => (y - o.top) / Math.max(1, o.h - vh)), P = R.map(r => clamp(r));
  let cur = 0; offs.forEach((o, i) => { if (y >= o.top - 2) cur = i; });

  // stage: frame targets for every clip, then which one (or two, mid-dissolve) is on screen
  const dt = gsap.ticker.deltaRatio(60) / 60, ease = 1 - Math.exp(-dt * 9), now = gsap.ticker.time;
  if (!spin.drag && Math.abs(spin.vel) > .01) { spin.f += spin.vel * dt * 60; spin.vel *= Math.pow(.04, dt); } else if (!spin.drag) spin.vel = 0;
  if (M.tint && !reduce) spin.turn = -TURN * (1 - ss(M.tint.top - .8 * vh, M.tint.top, y));   // over the part of the dissolve where the car is visible
  for (const m of media) {
    const p = clamp((y - m.top) / Math.max(1, m.scrubEnd - m.top));
    m.prog = clamp((y - m.top) / Math.max(1, m.h - vh));
    let s = m.s, f;
    if (m.name === 'arrival') f = lerp(0, .5, arrivalIntro.v) + .5 * p;   // rests on frame 96: paint lit, headlights still off
    else if (m.role === 'tint' && tint.clip) { s = seq('tint'); f = tint.f / Math.max(1, s.n - 1); }
    else if (m.role === 'tint' || m.role === 'wrap') { s = SPIN; f = (spin.f + spin.turn) / (SPIN.n - 1); }
    else f = reduce ? m.still : p;
    m.cur = s;
    const target = f * (s.n - 1);
    // the shown frame chases the scroll position, so the clip keeps playing out after the wheel stops instead of freezing
    m.f = m.role || reduce ? target : m.f + (target - m.f) * ease;
  }
  let ci = -1; media.forEach((m, k) => { if (y >= m.top - (m.prevAdj ? BLEND : 1) * vh) ci = k; });
  const A = media[ci], visible = A && y < A.top + A.h;
  if (visible) {
    const P0 = media[ci - 1], t = A.prevAdj && y < A.top ? ss(A.top - BLEND * vh, A.top, y) : 1;
    const layer = (m, alpha, scale) => ({ s: m.cur, f: m.f, alpha, scale, fit: m.fit, y: m.y, focusX: m.focusX });
    const breathe = reduce ? 1 : 1.025 + .012 * Math.sin(now * .35);
    par.x += ((reduce ? 0 : S.mx * -.008) - par.x) * ease * .5; par.y += ((reduce ? 0 : S.my * -.006) - par.y) * ease * .5;
    let layers;
    if (reduce) layers = [layer(t < .5 ? P0 : A, 1, 1)];
    else if (t < 1 && P0.cur === A.cur) layers = [layer(A, 1, breathe)];   // tint -> wrap shows the same spinning car: hold it still
    else if (t < 1) layers = [layer(P0, 1, breathe * (1 + .07 * t)), layer(A, t, breathe * (1.07 - .07 * t))];   // push through into the next clip
    else layers = [layer(A, 1, breathe)];
    stage.render(layers, { dx: par.x, dy: par.y, flare: reduce || t >= 1 || P0.cur === A.cur ? 0 : .22 * Math.sin(Math.PI * t) });
    updateHeroFx(A === M.arrival && t >= 1 ? stage.rect : null, A.f);
  } else updateHeroFx(null, 0);

  // wash steps
  const pw = P[1];
  steps.forEach(li => li.classList.toggle('on', pw >= +li.dataset.at));

  // tint readout follows the film
  // tint readouts count along with the film as it slides to the new shade
  const vltShown = PAINT ? Math.round(film.vlt * 100) : tint.v == null ? 100 : tint.v;
  if ($('#vltNum').textContent !== String(vltShown)) $('#vltNum').textContent = vltShown;
  const wsShown = Math.round(film.wvlt * 100), wsTxt = wsShown === 100 ? 'clear' : wsShown + '%';
  if ($('#wsNum').textContent !== wsTxt) $('#wsNum').textContent = wsTxt;

  // correction: before/after tags trade places as the light sweeps the panel
  if (M.correction) { const c = M.correction.prog; tags.before.style.opacity = 1 - ss(.35, .55, c); tags.after.style.opacity = ss(.55, .75, c); }

  // panels fade with their scene
  panels.forEach((p, i) => { if (!p) return; const r = R[i]; const o = ss(-.35, .02, r) * (1 - ss(.84, .97, r)); p.style.opacity = o; p.style.transform = `translateY(${(1 - o) * 30}px)`; });
  dots.forEach((d, i) => d.classList.toggle('on', i === cur));

  // HUD
  const showcaseEnd = offs[offs.length - 1].top + offs[offs.length - 1].h;
  document.body.classList.toggle('past-showcase', y > showcaseEnd - vh * .6);
  document.body.classList.toggle('in-hero', cur === 0 && P[0] < .6);
  const read = [
    'GLOSS 98 GU · PAINT 0 DEFECTS',
    pw < .13 ? 'ROAD FILM DETECTED' : pw < .45 ? `FOAM ${Math.round(ss(.13, .4, pw) * 100)}% · pH 7.0` : pw < .8 ? `RINSE ${Math.round(ss(.45, .8, pw) * 100)}% · DEIONIZED` : 'SPOT-FREE · DRY',
    `STEAM ${Math.round(ss(.05, .2, P[2]) * (1 - ss(.8, .95, P[2])) * 100)}% · 110 °C`,
    `${vltShown === 100 ? 'SIDES CLEAR' : `VLT ${vltShown}%`} · FRONT ${ws.v === 100 ? 'CLEAR' : ws.v + '%'}`,
    `WRAP ${wrap.pick >= 0 ? COLORS[wrap.pick].name.toUpperCase() : '—'}`,
    P[5] < .5 ? `FILM COVERAGE ${Math.round(ss(.06, .5, P[5]) * 100)}% · 8 MIL` : 'IMPACTS ABSORBED · PAINT INTACT',
  ][cur];
  const status = ['SHOWROOM READY', 'WASH CYCLE', 'CABIN DETAIL', 'FILM SELECTION', 'VINYL APPLICATION', 'FILM INSTALLED'][cur];
  const key = cur + read + status;
  if (key !== hudCache) { hudCache = key; hud.scene.textContent = `0${cur} / ${NAMES[cur]}`; hud.status.textContent = status; hud.read.textContent = read; }

  // nav + progress
  nav.classList.toggle('is-scrolled', y > 40);
  $('#progress').style.transform = `scaleX(${clamp(y / (document.documentElement.scrollHeight - vh))})`;
}
gsap.ticker.add(tick);

/* ---------------- settle: stopping near the tint / wrap car eases the page onto it ---------------- */
// rest = the stretch of each spin scene where the car is still and only its own panel shows. Scrolling that stops in a
// dissolve or a panel hand-off just outside it glides to the edge of the nearest rest (in the direction you were going)
const settle = { y: null, dir: 1, moved: 0, touch: false, busy: 0 };
addEventListener('touchstart', () => { settle.touch = true; }, { passive: true });
addEventListener('touchend', () => { settle.touch = false; settle.moved = performance.now(); }, { passive: true });
addEventListener('touchcancel', () => { settle.touch = false; }, { passive: true });
function rests(vh) {
  const R = [];
  for (const m of [M.tint, M.wrap]) {
    if (!m) continue;
    const span = Math.max(1, m.h - vh), i = media.indexOf(m), n = media[i + 1];
    let hi = m.top + .84 * span;                                              // own panel starts fading out
    if (m.next && m.next !== M.tint && m.next !== M.wrap) hi = Math.min(hi, m.next.top - BLEND * vh);   // next clip starts dissolving in (tint -> wrap is the same car)
    if (n && n.el.querySelector('.panel')) hi = Math.min(hi, n.top - .35 * Math.max(1, n.h - vh));   // next panel starts fading in
    R.push([m.top, Math.max(m.top, hi)]);
  }
  return R;
}
gsap.ticker.add(() => {
  const y = lenis && !mobile ? lenis.animatedScroll : scrollY, vh = innerHeight, now = performance.now();
  if (settle.y == null) { settle.y = y; return; }
  if (Math.abs(y - settle.y) > .5) { settle.dir = Math.sign(y - settle.y); settle.moved = now; }
  settle.y = y;
  if (settle.touch || spin.drag || now - settle.moved < 220 || now < settle.busy) return;
  let best = null;
  for (const [lo, hi] of rests(vh)) {
    if (y >= lo - 1 && y <= hi + 1) return;                                   // already resting on a car
    const edge = y < lo ? lo : hi, d = Math.abs(edge - y), ahead = Math.sign(edge - y) === settle.dir;
    if (d > .9 * vh || (!ahead && d > .3 * vh)) continue;
    const score = d - (ahead ? .3 * vh : 0);
    if (!best || score < best.score) best = { edge, score };
  }
  if (!best) return;
  settle.busy = now + 1200; settle.moved = now;
  if (lenis && !mobile) lenis.scrollTo(best.edge, { duration: .8, easing: t => 1 - Math.pow(1 - t, 3) });
  else window.scrollTo({ top: best.edge, behavior: reduce ? 'auto' : 'smooth' });
});

// ?debug → tiny on-screen readout for diagnosing on a real phone
if (/[?&]debug\b/.test(location.search)) {
  const d = document.createElement('pre');
  d.style.cssText = 'position:fixed;left:8px;top:80px;z-index:999;margin:0;padding:6px 8px;font:11px/1.35 ui-monospace,monospace;color:#0f0;background:rgba(0,0,0,.75);pointer-events:none';
  document.body.appendChild(d); window.__spin = spin;
  let frames = 0, fps = 0, t0 = performance.now();
  gsap.ticker.add(() => {
    frames++; const now = performance.now(); if (now - t0 > 500) { fps = Math.round(frames * 1000 / (now - t0)); frames = 0; t0 = now; }
    d.textContent = `fps ${fps}  y ${Math.round(scrollY)}  set full\n` + media.filter(m => m.prog > 0 && m.prog < 1).map(m => { const q = m.role === 'tint' || m.role === 'wrap' ? look.cur.s : m.s; return `${q.name} f${Math.round(m.f)} p${(m.prog || 0).toFixed(2)} loaded ${q.loaded()}/${q.n} decoded ${q.bmps.filter(Boolean).length}`; }).join('\n');
  });
}

/* ---------------- reveals ---------------- */
// masked text: each word slides up out of an overflow-hidden line (transform only), expo.out, 80 ms apart
$$('[data-split]').forEach(el => {
  if (el.closest('.hero')) return;
  const w = FX.split(el);
  if (reduce) return;
  gsap.from(w, { yPercent: 110, duration: 1.1, stagger: .08, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
});
if (!reduce) {
  $$('.block__lede, .compare__legend, .heal__pad, .heal__copy .note, .form, .contact').forEach(el =>
    gsap.from(el, { y: 50, autoAlpha: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));
  gsap.from('.card', { y: 80, autoAlpha: 0, rotateX: -12, duration: 1.1, stagger: .09, ease: 'power3.out', scrollTrigger: { trigger: '.cards', start: 'top 85%' } });
  gsap.from('.tier', { y: 90, autoAlpha: 0, duration: 1.1, stagger: .12, ease: 'power3.out', scrollTrigger: { trigger: '.tiers', start: 'top 85%' } });
  gsap.from('.flow li', { y: 40, autoAlpha: 0, duration: 1, stagger: .15, ease: 'power3.out', scrollTrigger: { trigger: '.flow', start: 'top 85%' } });
  gsap.fromTo('.flow', { '--flow': 0 }, { '--flow': 1, ease: 'none', scrollTrigger: { trigger: '.flow', start: 'top 80%', end: 'bottom 60%', scrub: true } });
  gsap.to('.marquee__track', { x: () => -innerWidth * .25, ease: 'none', scrollTrigger: { trigger: '.marquee', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.foot__big', { yPercent: 40, scale: .9, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  $$('[data-scramble]').forEach(el => { if (!el.closest('.hero')) ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => FX.scramble(el) }); });
  $$('.block .eyebrow').forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => FX.scramble(el, .8) }));
}
$$('[data-count]').forEach(el => {
  const end = +el.dataset.count, dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || '';
  ScrollTrigger.create({ trigger: el, start: 'top 95%', once: true, onEnter: () => { const o = { v: 0 }; gsap.to(o, { v: end, duration: reduce ? 0 : 1.6, ease: 'power3.out', onUpdate: () => (el.textContent = o.v.toFixed(dec) + suf) }); } });
});

/* ---------------- nav menu ---------------- */
$('#navMenu').addEventListener('click', e => { const open = nav.classList.toggle('menu-open'); e.currentTarget.setAttribute('aria-expanded', open); });

/* ---------------- booking: one Cal.com calendar per service ---------------- */
// Paste your Cal.com username below. Each service needs a matching Event Type slug in Cal.com.
const CAL_CONFIG = {
  username: 'YOUR-CAL-USERNAME',            // ← PASTE YOUR CAL.COM USERNAME
  origin: 'https://cal.com',
  embedScript: 'https://app.cal.com/embed/embed.js',
  brandColor: '#e11d25',
  services: {
    'detailing':   { label: 'Detailing', slug: 'detailing', minutes: 240 },
    'window-tint': { label: 'Window Tint', slug: 'window-tint', minutes: 180 },
    'vinyl-wrap':  { label: 'Vinyl Wrap', slug: 'vinyl-wrap-dropoff', minutes: 480 },
    'ppf':         { label: 'Paint Protection Film', slug: 'ppf-dropoff', minutes: 480 },
  },
};
const calReady = CAL_CONFIG.username && !CAL_CONFIG.username.startsWith('YOUR-');
if (calReady) {
  (function (C, A, L) { const p = (a, ar) => a.q.push(ar), d = C.document;
    C.Cal = C.Cal || function () { const cal = C.Cal, ar = arguments;
      if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; }
      if (ar[0] === L) { const api = function () { p(api, arguments); }, ns = ar[1]; api.q = api.q || [];
        if (typeof ns === 'string') { cal.ns[ns] = cal.ns[ns] || api; p(cal.ns[ns], ar); p(cal, ['initNamespace', ns]); } else p(cal, ar); return; }
      p(cal, ar); }; })(window, CAL_CONFIG.embedScript, 'init');
  window.Cal('init', { origin: CAL_CONFIG.origin });
  window.Cal('ui', { theme: 'dark', styles: { branding: { brandColor: CAL_CONFIG.brandColor } }, hideEventTypeDetails: false, layout: 'month_view' });
  $('#calPlaceholder').hidden = true;
}
let calCurrent = null;
function selectService(key) {
  const svc = CAL_CONFIG.services[key]; if (!svc || key === calCurrent) return; calCurrent = key;
  $$('[data-tab]').forEach(t => { const on = t.dataset.tab === key; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); });
  $('#calSelected').textContent = `${svc.label} · ${svc.minutes} min`;
  const calLink = `${CAL_CONFIG.username}/${svc.slug}`;
  $('#calLink').href = calReady ? `${CAL_CONFIG.origin}/${calLink}` : '#book';
  if (calReady) { $('#calEmbed').innerHTML = ''; window.Cal('inline', { elementOrSelector: '#calEmbed', calLink, layout: 'month_view', config: { theme: 'dark' } }); }
}
$$('[data-tab]').forEach(t => t.addEventListener('click', () => selectService(t.dataset.tab)));
$$('[data-pkg]').forEach(a => a.addEventListener('click', () => selectService(a.dataset.pkg)));
selectService('detailing');
if (window.ResizeObserver) { let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => ScrollTrigger.refresh(), 200); }).observe($('.cal')); }
