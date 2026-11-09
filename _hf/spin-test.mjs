// usage: OUT=dir node _hf/spin-test.mjs  -> photoreal spin on tint + wrap at 1440x900 and 390x844 (4x CPU throttle on phone):
// drag scrubbing (frame pacing, how far the drawn frame lags the drag), inertia + endless loop, wrap/tint clips,
// reduced motion (arrows, no drag), and that the scroll scenes still render. Screenshots go to $OUT/st-*.jpg
import puppeteer from 'puppeteer-core'; import fs from 'node:fs'; import path from 'node:path';
const OUT = process.env.OUT || '.';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function page(W, H, mob, reduce) {
  const p = await b.newPage(); await p.setRequestInterception(true);
  p.on('request', r => { const u = new URL(r.url()); if (u.host !== 'fuerza.test') return r.continue(); let f = path.join(process.cwd(), decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html'; try { r.respond({ status: 200, contentType: T[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); } catch { r.respond({ status: 404, body: '' }); } });
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => m.type() === 'error' && p.errs.push(m.text()));
  await p.setViewport({ width: W, height: H, deviceScaleFactor: mob ? 3 : 1, isMobile: mob, hasTouch: mob });
  if (reduce) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.evaluateOnNewDocument(() => {
    const o = CanvasRenderingContext2D.prototype.drawImage, tags = new WeakMap(); window.__drawn = [];
    window.__fzTag = (bm, n, i) => tags.set(bm, [n, i]);
    const tx = WebGLRenderingContext.prototype.texImage2D; WebGLRenderingContext.prototype.texImage2D = function (...a) { const t = tags.get(a[a.length - 1]); if (t && t[0] === 'spinw') { const L = window.__drawn; if (L[L.length - 1] !== t[1]) L.push(t[1]); } return tx.apply(this, a); };
    CanvasRenderingContext2D.prototype.drawImage = function (im, ...a) { const t = tags.get(im); if (t && t[0] === 'spinw') { const L = window.__drawn; if (L[L.length - 1] !== t[1]) L.push(t[1]); } return o.call(this, im, ...a); };
  });
  await p.goto('https://fuerza.test/?debug', { waitUntil: 'load' }); await sleep(5000);
  return p;
}
const go = (p, id, k) => p.evaluate((id, k) => { const el = document.getElementById(id); scrollTo(0, el.offsetTop + el.offsetHeight * k); }, id, k);
const hudF = p => p.evaluate(() => { const t = document.body.innerText.match(/spinw f(-?\d+)/); return t ? +t[1] : null; });
async function drag(p, W, H, dx, ms, fling = false) {
  const steps = Math.max(6, Math.round(ms / 16)), x0 = W * (dx > 0 ? .2 : .8), y = H * .42;
  await p.mouse.move(x0, y); await p.mouse.down();
  for (let i = 1; i <= steps; i++) { await p.mouse.move(x0 + dx * i / steps, y); if (!fling) await sleep(16); }
  await p.mouse.up();
}
async function run(tag, W, H, mob) {
  const p = await page(W, H, mob, false);
  await go(p, 'tint', .35); await sleep(3000);
  await p.screenshot({ path: `${OUT}/st-${tag}-1-spin.jpg`, quality: 78 });
  if (mob) { const c = await p.createCDPSession(); await c.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  // pacing during a slow scrub and a fast fling
  await p.evaluate(() => { window.__drawn = []; window.__r = { d: [], last: performance.now(), on: true }; (function f() { const R = window.__r; if (!R.on) return; const n = performance.now(); R.d.push(n - R.last); R.last = n; requestAnimationFrame(f); })(); });
  const f0 = await hudF(p);
  await drag(p, W, H, -W * .35, 1200);            // slow, ~quarter turn
  const f1 = await hudF(p);
  await drag(p, W, H, W * .55, 220, true);          // fast fling the other way
  await sleep(150); const fFling = await hudF(p); await sleep(1800); const fRest = await hudF(p);
  const stats = await p.evaluate(() => { const R = window.__r; R.on = false; const d = [...R.d].sort((a, b) => a - b), q = x => +d[Math.floor(d.length * x)].toFixed(1);
    const D = window.__drawn; let big = 0, jumps = 0; for (let i = 1; i < D.length; i++) { let s = Math.abs(D[i] - D[i - 1]); s = Math.min(s, 360 - s); if (s > 3) jumps++; big = Math.max(big, s); }
    return { fps: Math.round(1000 * d.length / d.reduce((a, b) => a + b, 0)), p95ms: q(.95), over33ms: d.filter(x => x > 33).length, framesDrawn: D.length, jumpsOver3: jumps, biggestJump: big }; });
  await p.screenshot({ path: `${OUT}/st-${tag}-2-spun.jpg`, quality: 78 });
  if (mob) { const c = await p.createCDPSession(); await c.send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
  // loop: drag far past the start in reverse, the frame index keeps going (wraps)
  for (let k = 0; k < 4; k++) { await drag(p, W, H, W * .55, 500); await sleep(100); } await sleep(1500); const fLoop = await hudF(p);
  // tint chip darkens the glass on the spin, and it stays on through a drag
  await p.evaluate(() => document.querySelector('.chip[data-vlt="5"]').click()); await sleep(1200);
  await p.screenshot({ path: `${OUT}/st-${tag}-3-tint5.jpg`, quality: 78 });
  await drag(p, W, H, -W * .25, 500); await sleep(1500);
  await p.screenshot({ path: `${OUT}/st-${tag}-3b-tint5-spun.jpg`, quality: 78 });
  // wrap swatches repaint the spin (tint still on); every colour, then spin with one applied
  await go(p, 'wrap', .35); await sleep(2000);
  for (const k of ['red', 'blue', 'graphite', 'pearl', 'chrome', 'matte', 'factory']) {
    await p.evaluate(k => document.querySelector(`.swatch[data-k="${k}"]`).click(), k); await sleep(1100);
    await p.screenshot({ path: `${OUT}/st-${tag}-4-${k}.jpg`, quality: 78 });
  }
  await p.evaluate(() => document.querySelector('.swatch[data-k="blue"]').click()); await sleep(1100);
  await drag(p, W, H, -W * .3, 600); await sleep(1500);
  await p.screenshot({ path: `${OUT}/st-${tag}-5-blue-spun.jpg`, quality: 78 });
  // scroll scenes still render
  await go(p, 'wash', .45); await sleep(2500); await p.screenshot({ path: `${OUT}/st-${tag}-6-wash.jpg`, quality: 70 });
  console.log(tag, JSON.stringify({ spinFrame: { start: f0, afterSlowDrag: f1, justAfterFling: fFling, atRest: fRest, afterLoopDrag: fLoop }, ...stats }), 'errors:', p.errs);
  await p.close();
}
async function runReduce(tag, W, H, mob) {
  const p = await page(W, H, mob, true);
  await go(p, 'wrap', .35); await sleep(2500);
  const vis = await p.evaluate(() => ({ arrows: getComputedStyle(document.querySelector('#wrap .spin-arrows')).display, hint: getComputedStyle(document.querySelector('#wrap .spin-hint')).display }));
  const a = await hudF(p); await drag(p, W, H, -W * .4, 400); await sleep(600); const b2 = await hudF(p);
  await p.evaluate(() => document.querySelector('#wrap .spin-arrows button[data-step="1"]').click()); await sleep(1500); const c = await hudF(p);
  await p.screenshot({ path: `${OUT}/st-${tag}-reduce.jpg`, quality: 78 });
  console.log(tag, 'reduced-motion', JSON.stringify({ ...vis, frameBefore: a, afterDragAttempt: b2, afterArrow: c }), 'errors:', p.errs);
  await p.close();
}
await run('desk', 1440, 900, false);
await run('phone', 390, 844, true);
await runReduce('desk', 1440, 900, false);
await runReduce('phone', 390, 844, true);
await b.close();
