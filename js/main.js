import { createStage, S } from './car.js';
import * as FX from './fx.js';

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

/* ---------------- 3D stage ---------------- */
const gl = $('#gl');
let stage = null;
try { stage = createStage(gl, { mobile }); } catch (err) { console.error(err); gl.style.background = 'radial-gradient(ellipse at 60% 60%, #2a0b0d, #070708 70%)'; }
window.addEventListener('pointermove', e => {
  S.mouse.x = e.clientX / innerWidth * 2 - 1; S.mouse.y = -(e.clientY / innerHeight * 2 - 1);
  if (stage && S.active && e.pointerType === 'mouse') stage.setPointer(e.clientX, e.clientY);
}, { passive: true });

/* ---------------- cursor + interactive bits ---------------- */
if (finePointer && !reduce) { FX.cursor($('#cursor'), $('#cursorLabel'), gl); FX.bubbles($('#bubbles')); }
FX.magnetic(finePointer ? $$('.magnetic') : []);
FX.tilt($$('.tilt'));
FX.compare($('#compare'), $('#compareCanvas'), $('#compareHandle'));
FX.heal($('#healPad'), $('#healCanvas'), $('#healTemp'));

/* ---------------- loader ---------------- */
const heroWords = $$('.hero__title [data-split]').flatMap(el => [...FX.split(el)]);
gsap.set(heroWords, { yPercent: 110 });
gsap.set(['.hero__sub', '.hero__cta', '.hero .eyebrow', '.hero__foot'], { autoAlpha: 0, y: 24 });
(function loader() {
  const bar = $('#loaderBar'), pct = $('#loaderPct'), txt = $('#loaderTxt'), words = ['PRE-RINSE', 'SNOW FOAM', 'HAND WASH', 'SPOT-FREE RINSE', 'READY'];
  const p = { v: 0 }, ready = Promise.race([stage ? stage.ready : Promise.resolve(), new Promise(r => setTimeout(r, 5000))]);
  const fill = gsap.to(p, { v: 88, duration: 1.6, ease: 'power2.out', onUpdate: draw });
  function draw() { bar.style.width = p.v + '%'; pct.textContent = String(Math.round(p.v)).padStart(3, '0'); txt.textContent = words[Math.min(4, Math.floor(p.v / 21))]; }
  Promise.all([ready, fill.then(), document.fonts ? document.fonts.ready : null]).then(() => {
    gsap.timeline()
      .to(p, { v: 100, duration: .45, ease: 'power1.inOut', onUpdate: draw })
      .to('#loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '+=.1')
      .set('#loader', { display: 'none' })
      .to(heroWords, { yPercent: 0, duration: 1.2, stagger: .08, ease: 'expo.out' }, '-=.55')
      .to(['.hero .eyebrow', '.hero__sub', '.hero__cta', '.hero__foot'], { autoAlpha: 1, y: 0, duration: 1, stagger: .1, ease: 'power3.out' }, '-=.9')
      .add(() => FX.scramble($('.hero .eyebrow')), '-=1');
    measure();
  });
})();

/* ---------------- scroll choreography ---------------- */
const scenes = $$('[data-scene]'), solid = $('.solid'), nav = $('#nav');
let offs = [], solidTop = 0;
function measure() {
  offs = scenes.map(el => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, h: el.offsetHeight }; });
  solidTop = solid.getBoundingClientRect().top + scrollY;
}
// on touch devices the URL bar showing/hiding fires height-only resizes mid-scroll; re-measuring then makes the page jump
let lastW = innerWidth;
measure(); window.addEventListener('resize', () => { if (mobile && innerWidth === lastW) return; lastW = innerWidth; measure(); ScrollTrigger.refresh(); }); window.addEventListener('load', measure);

// camera keyframes per scene: yaw around the car, distance, height, look-at height, sideways offset (car away from the panel)
const K = [
  { yaw: .82, r: 9.4, h: 1.9, ty: 1.15, tx: 0, ox: -1.55 },
  { yaw: .02, r: 7.9, h: 1.35, ty: .66, tx: 0, ox: -1.35 },
  { yaw: .38, r: 4.6, h: 1.85, ty: .82, tx: -.15, ox: .75 },
  { yaw: -.82, r: 6.9, h: 1.55, ty: .72, tx: 0, ox: -1.1 },
  { yaw: -2.25, r: 7.8, h: 2.0, ty: .58, tx: 0, ox: 1.2 },
  { yaw: 1.12, r: 5.6, h: .95, ty: .62, tx: .3, ox: -.95 },
  { yaw: 1.7, r: 10, h: 3.2, ty: .4, tx: 0, ox: 0 },
];
if (mobile) K.forEach((k, i) => { k.ox = 0; k.r *= 1.3; k.ty += i === 0 ? 1.05 : -.75; k.h += i === 0 ? 0 : .3; });
const mixKey = (a, b, t) => Object.fromEntries(Object.keys(a).map(k => [k, lerp(a[k], b[k], t)]));

const COLORS = $$('.swatch').map(b => ({ c: b.dataset.c, f: b.dataset.f, el: b, name: b.querySelector('span').textContent }));
const VLTS = [70, 50, 35, 20, 5], vltToOpacity = v => clamp(1.02 - v / 100 * 1.2, .12, .96);
const HERO_PAINT = ['#b0121a', 'gloss'];
let wrapSeg = -2, manualWrap = null, manualVlt = null, glassSm = .55, hudCache = '';
const dots = $$('#dots a'), steps = $$('.steps li'), panels = scenes.map(s => $('.panel', s));
const hud = { scene: $('#hudScene'), status: $('#hudStatus'), read: $('#hudRead') };
const NAMES = ['ARRIVAL', 'HAND WASH', 'INTERIOR', 'WINDOW TINT', 'COLOR WRAP', 'PAINT PROTECTION'];

$$('.vlt .chip').forEach(ch => ch.addEventListener('click', () => { manualVlt = { v: +ch.dataset.vlt, at: raw(3) }; }));
COLORS.forEach((c, i) => c.el.addEventListener('click', () => { manualWrap = { i, at: raw(4) }; applyWrap(i); }));
function applyWrap(i) {
  const c = i < 0 ? { c: HERO_PAINT[0], f: HERO_PAINT[1] } : COLORS[i];
  stage && stage.setWrap(c.c, c.f);
  COLORS.forEach((o, j) => o.el.classList.toggle('on', j === i));
  if (i >= 0) $('#wrapNow').textContent = `${COLORS[i].name.toUpperCase()} · ${COLORS[i].f.toUpperCase()} FINISH`;
}
const raw = i => offs[i] ? (scrollY - offs[i].top) / Math.max(1, offs[i].h - innerHeight) : 0;

function tick() {
  const y = lenis ? lenis.animatedScroll : scrollY, vh = innerHeight;
  if (!offs.length) return;
  const R = offs.map(o => (y - o.top) / Math.max(1, o.h - vh)), P = R.map(r => clamp(r));
  let cur = 0; offs.forEach((o, i) => { if (y >= o.top - 2) cur = i; });

  // camera
  const holdFrom = cur === 0 ? .25 : .74;
  const a = { ...K[cur] }; if (cur === 4) a.yaw += P[4] * 2.6;
  const b = { ...K[cur + 1] }; if (cur + 1 === 4) b.yaw += 0;
  Object.assign(S.cam, mixKey(a, b, ss(holdFrom, 1, P[cur])));
  if (window.__view) Object.assign(S.cam, window.__view);

  // wash
  const pw = P[1];
  S.dirt = ss(0, .12, pw); S.foam = ss(.13, .4, pw); S.rinse = lerp(3.2, -3.2, ss(.45, .8, pw));
  S.sweep = pw > .8 && pw < 1 ? (pw - .8) / .2 : -1;
  if (window.__dirt != null) { S.dirt = window.__dirt; S.foam = 0; S.rinse = 3.2; }
  steps.forEach(li => li.classList.toggle('on', pw >= +li.dataset.at));

  // interior
  const pi = P[2]; S.interior = ss(.05, .2, pi) * (1 - ss(.8, .95, pi)); S.steam = S.interior;
  let glass = lerp(.68, .1, S.interior);

  // tint
  const pt = P[3];
  if (manualVlt && Math.abs(R[3] - manualVlt.at) > .12) manualVlt = null;
  let vlt = VLTS[Math.min(4, Math.floor(clamp(pt) * 5.5))];
  if (manualVlt) vlt = manualVlt.v;
  if (cur >= 3) glass = vltToOpacity(cur > 3 ? 20 : vlt);
  if (cur === 3 && R[3] < 0) glass = vltToOpacity(70);
  glassSm += (glass - glassSm) * .12; S.glass = glassSm;
  S.cabin += ((cur === 3 && R[3] > -.2 ? 1 : 0) - S.cabin) * .08;
  const vltShown = cur >= 3 ? vlt : 70;
  if ($('#vltNum').textContent !== String(vltShown)) { $('#vltNum').textContent = vltShown; $$('.vlt .chip').forEach(c => c.classList.toggle('on', +c.dataset.vlt === vltShown)); }

  // wrap: auto-advance colors through the scene unless a swatch was clicked nearby
  const pr = R[4];
  if (manualWrap && Math.abs(pr - manualWrap.at) > .14) manualWrap = null;
  const seg = cur !== 4 ? -1 : pr < .06 ? 0 : Math.min(5, Math.floor((pr - .06) / .15));
  if (!manualWrap && seg !== wrapSeg) { wrapSeg = seg; applyWrap(seg); }

  // ppf
  const pf = P[5];
  S.scan = lerp(2.6, -2.6, ss(.06, .5, pf)); S.scanOn = ss(.02, .08, pf) * (1 - ss(.5, .6, pf)); S.film = ss(.06, .25, pf);
  S.rocks = ss(.5, .58, pf) * (1 - ss(.94, 1, pf));

  // panels fade with their scene
  panels.forEach((p, i) => { if (!p) return; const r = R[i]; const o = ss(-.35, .02, r) * (1 - ss(.84, .97, r)); p.style.opacity = o; p.style.transform = `translateY(${(1 - o) * 30}px)`; });
  dots.forEach((d, i) => d.classList.toggle('on', i === cur));

  // stage on/off, HUD
  const covered = solidTop - y <= 0;
  S.active = !covered;
  document.body.classList.toggle('past-showcase', y > solidTop - vh * .6);
  document.body.classList.toggle('in-hero', cur === 0 && P[0] < .6);
  const read = [
    'GLOSS 98 GU · PAINT 0 DEFECTS',
    pw < .13 ? 'ROAD FILM DETECTED' : pw < .45 ? `FOAM ${Math.round(S.foam * 100)}% · pH 7.0` : pw < .8 ? `RINSE ${Math.round(ss(.45, .8, pw) * 100)}% · DEIONIZED` : 'SPOT-FREE · DRY',
    `STEAM ${Math.round(S.steam * 100)}% · 110 °C`,
    `VLT ${vltShown}% · UV BLOCK 99%`,
    `WRAP ${seg >= 0 ? COLORS[seg].name.toUpperCase() : '—'}`,
    pf < .5 ? `FILM COVERAGE ${Math.round(ss(.06, .5, pf) * 100)}% · 8 MIL` : 'IMPACTS ABSORBED · PAINT INTACT',
  ][cur];
  const status = ['SHOWROOM READY', 'WASH CYCLE', 'CABIN DETAIL', 'FILM SELECTION', 'VINYL APPLICATION', 'FILM INSTALLED'][cur];
  const key = cur + read + status;
  if (key !== hudCache) { hudCache = key; hud.scene.textContent = `0${cur} / ${NAMES[cur]}`; hud.status.textContent = status; hud.read.textContent = read; }

  // nav + progress
  nav.classList.toggle('is-scrolled', y > 40);
  $('#progress').style.transform = `scaleX(${clamp(y / (document.documentElement.scrollHeight - vh))})`;
}
gsap.ticker.add(tick);

/* ---------------- reveals ---------------- */
$$('[data-split]').forEach(el => {
  if (el.closest('.hero')) return;
  const w = FX.split(el);
  gsap.from(w, { yPercent: 110, duration: 1.1, stagger: .06, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
});
$$('.block__lede, .compare, .compare__legend, .heal__pad, .heal__copy .note, .form, .contact').forEach(el =>
  gsap.from(el, { y: 50, autoAlpha: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));
gsap.from('.card', { y: 80, autoAlpha: 0, rotateX: -12, duration: 1.1, stagger: .09, ease: 'power3.out', scrollTrigger: { trigger: '.cards', start: 'top 85%' } });
gsap.from('.tier', { y: 90, autoAlpha: 0, duration: 1.1, stagger: .12, ease: 'power3.out', scrollTrigger: { trigger: '.tiers', start: 'top 85%' } });
gsap.from('.flow li', { y: 40, autoAlpha: 0, duration: 1, stagger: .15, ease: 'power3.out', scrollTrigger: { trigger: '.flow', start: 'top 85%' } });
gsap.fromTo('.flow', { '--flow': 0 }, { '--flow': 1, ease: 'none', scrollTrigger: { trigger: '.flow', start: 'top 80%', end: 'bottom 60%', scrub: true } });
gsap.to('.marquee__track', { x: () => -innerWidth * .25, ease: 'none', scrollTrigger: { trigger: '.marquee', start: 'top bottom', end: 'bottom top', scrub: true } });
gsap.from('.foot__big', { yPercent: 40, scale: .9, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });
$$('[data-scramble]').forEach(el => { if (!el.closest('.hero')) ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => FX.scramble(el) }); });
$$('.block .eyebrow').forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => FX.scramble(el, .8) }));
$$('[data-count]').forEach(el => {
  const end = +el.dataset.count, dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || '';
  ScrollTrigger.create({ trigger: el, start: 'top 95%', once: true, onEnter: () => { const o = { v: 0 }; gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', onUpdate: () => (el.textContent = o.v.toFixed(dec) + suf) }); } });
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
