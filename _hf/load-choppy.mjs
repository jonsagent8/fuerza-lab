// usage: node _hf/load-choppy.mjs <label> [mbps]  -> phone on a throttled network, scrolls the page like a visitor and counts
// "skips": consecutive drawn frames of the same clip more than 3 frames apart (= the clip wasn't loaded there yet)
import puppeteer from 'puppeteer-core';
const [label = 'run', mbps = '20'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-cache'] });
const p = await b.newPage();
await p.setCacheEnabled(false);
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const c = await p.createCDPSession();
await c.send('Network.enable');
await c.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: +mbps * 125000, uploadThroughput: 5 * 125000 });
await p.evaluateOnNewDocument(() => {
  const o = CanvasRenderingContext2D.prototype.drawImage; window.__seq = []; const tags = new WeakMap(); window.__fzTag = (bm, n, i) => tags.set(bm, [n, String(i + 1)]);
  CanvasRenderingContext2D.prototype.drawImage = function (im, ...a) { const m = tags.get(im) ? [0, ...tags.get(im)] : im.src && im.src.match(/frames\/([^/]+)\/\w+\/(\d+)\.webp/); if (m) { const L = window.__seq, k = m[1] + ':' + m[2]; if (L[L.length - 1] !== k) L.push(k); } return o.call(this, im, ...a); };
});
const t0 = Date.now();
await p.goto('http://127.0.0.1:8811/', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 5000));
const H = await p.evaluate(() => document.querySelector('#interior') ? document.querySelector('#interior').getBoundingClientRect().bottom + scrollY : document.body.scrollHeight * .5);
// visitor scrolls down at ~1 screen per second until past the interior
for (let y = 0; y < H; y += 844 / 30) { await p.evaluate(v => scrollTo(0, v), y); await new Promise(r => setTimeout(r, 33)); }
await new Promise(r => setTimeout(r, 1000));
const res = await p.evaluate(() => {
  const per = {}; let prev = null;
  for (const k of window.__seq) { const [n, f] = k.split(':'); const x = per[n] || (per[n] = { draws: 0, skips: 0, bigSkips: 0 }); x.draws++; if (prev && prev[0] === n) { const d = Math.abs(+f - prev[1]); if (d > 3) x.skips++; if (d > 10) x.bigSkips++; } prev = [n, +f]; }
  return per;
});
const errs = await p.evaluate(() => window.__errs || []);
console.log(label, mbps + 'Mbps', 'secs', ((Date.now() - t0) / 1000).toFixed(0), JSON.stringify(res));
await b.close();
