import * as FX from './fx.js';
import { seq, Stage, SMALL } from './frames.js';
import { heroFx } from './hero-fx.js';

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
const media = $$('[data-media]').map(el => ({
  el, name: el.dataset.media, role: el.dataset.role || '', s: seq(el.dataset.media),
  fit: el.dataset.fit || 'cover', y: +(el.dataset.y || .4), focusX: +(el.dataset.focus || .5),
  f: 0, still: +(el.dataset.still || 1), top: 0, h: 1, prog: 0,
}));
const M = Object.fromEntries(media.map(m => [m.role || m.name, m]));
const WRAPS = ['wrap-red', 'wrap-graphite', 'wrap-pearl', 'wrap-chrome', 'wrap-matteblack'];

// lazy-load a scene's frames once it is within one viewport of the screen; frame 0 is fetched up front as the poster
media.forEach(m => m.s.poster());
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const m = media.find(x => x.el === e.target);
  if (!reduce && m.role !== 'wrap') m.s.load();
  else if (reduce && m.role === 'tint') m.s.img(Math.round(tint.f));
  else if (reduce && !m.role) m.s.img(Math.round(m.still * (m.s.n - 1)));
}), { rootMargin: '100% 0px' });
media.forEach(m => io.observe(m.el));

/* ---------------- loader ---------------- */
const heroWords = $$('.hero__title [data-split]').flatMap(el => [...FX.split(el)]);
gsap.set(heroWords, { yPercent: 110 });
gsap.set(['.hero__sub', '.hero__cta', '.hero .eyebrow', '.hero__foot'], { autoAlpha: 0, y: 24 });
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
      .to(['.hero .eyebrow', '.hero__sub', '.hero__cta', '.hero__foot'], { autoAlpha: 1, y: 0, duration: 1, stagger: .1, ease: 'power3.out' }, '-=.9')
      .add(() => FX.scramble($('.hero .eyebrow')), '-=1');
    measure();
  });
})();

/* ---------------- tint: the shade picker drives the film clip ---------------- */
// 70% VLT sits on an early frame, 5% on the last one. Values in between follow the measured window darkness of the clip.
const VLTS = [70, 50, 35, 20, 5];
const tintFrac = v => (window.TINT_CURVE ? window.TINT_CURVE(v) : lerp(.15, 1, (70 - v) / 65));
const tint = { f: 0, picked: false, tw: null };
const tintFrame = v => tintFrac(v) * (M.tint.s.n - 1);
if (reduce) tint.f = tintFrame(35);
function vltAt(f) {   // invert the curve for the readout while the film animates
  let best = 70, d = Infinity;
  for (let v = 5; v <= 70; v++) { const e = Math.abs(tintFrame(v) - f); if (e < d) { d = e; best = v; } }
  return best;
}
function pickVlt(v) {
  tint.picked = true; tint.tw && tint.tw.kill();
  if (reduce) { tint.f = tintFrame(v); M.tint.s.img(Math.round(tint.f)); return; }
  tint.tw = gsap.to(tint, { f: tintFrame(v), duration: .8, ease: 'power3.inOut' });
}
$$('.vlt .chip').forEach(ch => ch.addEventListener('click', () => { pickVlt(+ch.dataset.vlt); chipOn(+ch.dataset.vlt); }));
const chipOn = v => $$('.vlt .chip').forEach(c => c.classList.toggle('on', +c.dataset.vlt === v));

/* ---------------- wrap: each swatch plays its own wrap clip; factory gloss black is frame 0 of all of them ---------------- */
const wrap = { clip: WRAPS[0], f: 0, tl: null, pick: -1 };
const COLORS = $$('.swatch').map((b, i) => ({ el: b, f: b.dataset.f, name: b.querySelector('span').textContent, clip: WRAPS[i] || null }));
COLORS.forEach(c => {
  if (!c.clip) return;
  const pre = () => seq(c.clip).load();
  c.el.addEventListener('pointerenter', pre); c.el.addEventListener('touchstart', pre, { passive: true }); c.el.addEventListener('focus', pre);
});
COLORS.forEach((c, i) => c.el.addEventListener('click', () => applyWrap(i)));
function applyWrap(i) {
  const c = COLORS[i]; wrap.pick = i;
  COLORS.forEach((o, j) => o.el.classList.toggle('on', j === i));
  $('#wrapNow').textContent = `${c.name.toUpperCase()} · ${c.f.toUpperCase()} FINISH`;
  wrap.tl && wrap.tl.kill();
  const back = Math.max(.25, .7 * wrap.f / Math.max(1, seq(wrap.clip).n - 1));
  if (reduce) { if (c.clip) wrap.clip = c.clip; wrap.f = c.clip ? seq(wrap.clip).n - 1 : 0; seq(wrap.clip).img(Math.round(wrap.f)); return; }
  const tl = wrap.tl = gsap.timeline();
  if (wrap.clip !== c.clip && wrap.f > 0) tl.to(wrap, { f: 0, duration: back, ease: 'power2.in' });   // peel back to factory black first
  if (!c.clip) { if (wrap.f > 0 && wrap.clip) tl.to(wrap, { f: 0, duration: back, ease: 'power2.inOut' }); return; }
  const s = seq(c.clip), loaded = s.load();
  tl.add(() => { tl.pause(); loaded.then(() => tl.resume()); });                                    // hold until this color's frames are in
  tl.add(() => { wrap.clip = c.clip; wrap.f = 0; });
  tl.to(wrap, { f: s.n - 1, duration: 1.8, ease: 'power2.inOut' });
}

/* ---------------- scroll choreography ---------------- */
const scenes = $$('[data-scene]'), nav = $('#nav');
let offs = [];
function measure() {
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
  const R = offs.map(o => (y - o.top) / Math.max(1, o.h - vh)), P = R.map(r => clamp(r));
  let cur = 0; offs.forEach((o, i) => { if (y >= o.top - 2) cur = i; });

  // stage: frame targets for every clip, then which one (or two, mid-dissolve) is on screen
  const dt = gsap.ticker.deltaRatio(60) / 60, ease = 1 - Math.exp(-dt * 9), now = gsap.ticker.time;
  for (const m of media) {
    const p = clamp((y - m.top) / Math.max(1, m.scrubEnd - m.top));
    m.prog = clamp((y - m.top) / Math.max(1, m.h - vh));
    let s = m.s, f;
    if (m.name === 'arrival') f = lerp(0, .5, arrivalIntro.v) + .5 * p;   // rests on frame 96: paint lit, headlights still off
    else if (m.role === 'tint') {
      // entering the section plays the film from clear to 35% once, until a shade is tapped
      if (!tint.picked && !reduce) tint.f = tintFrame(35) * ss(.02, .3, m.prog);
      f = tint.f / Math.max(1, s.n - 1);
    } else if (m.role === 'wrap') { s = seq(wrap.clip); f = wrap.f / Math.max(1, s.n - 1); }
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
    else if (t < 1) layers = [layer(P0, 1, breathe * (1 + .07 * t)), layer(A, t, breathe * (1.07 - .07 * t))];   // push through into the next clip
    else layers = [layer(A, 1, breathe)];
    stage.render(layers, { dx: par.x, dy: par.y, flare: reduce || t >= 1 ? 0 : .22 * Math.sin(Math.PI * t) });
    updateHeroFx(A === M.arrival && t >= 1 ? stage.rect : null, A.f);
  } else updateHeroFx(null, 0);

  // wash steps
  const pw = P[1];
  steps.forEach(li => li.classList.toggle('on', pw >= +li.dataset.at));

  // tint readout follows the film
  const vltShown = vltAt(tint.f);
  if ($('#vltNum').textContent !== String(vltShown)) { $('#vltNum').textContent = vltShown; if (!tint.picked) chipOn(VLTS.includes(vltShown) ? vltShown : -1); }

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
    `VLT ${vltShown}% · UV BLOCK 99%`,
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

// ?debug → tiny on-screen readout for diagnosing on a real phone
if (/[?&]debug\b/.test(location.search)) {
  const d = document.createElement('pre');
  d.style.cssText = 'position:fixed;left:8px;top:80px;z-index:999;margin:0;padding:6px 8px;font:11px/1.35 ui-monospace,monospace;color:#0f0;background:rgba(0,0,0,.75);pointer-events:none';
  document.body.appendChild(d);
  let frames = 0, fps = 0, t0 = performance.now();
  gsap.ticker.add(() => {
    frames++; const now = performance.now(); if (now - t0 > 500) { fps = Math.round(frames * 1000 / (now - t0)); frames = 0; t0 = now; }
    d.textContent = `fps ${fps}  y ${Math.round(scrollY)}  set ${SMALL ? 'mobile' : 'desktop'}\n` + media.filter(m => m.prog > 0 && m.prog < 1).map(m => `${m.name} f${Math.round(m.f)} p${(m.prog || 0).toFixed(2)} loaded ${m.s.imgs.filter(i => i && i.ok).length}/${m.s.n}`).join('\n');
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
