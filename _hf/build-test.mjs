// usage: node _hf/build-test.mjs  -> phone + desktop: tint and wrap combine on the live car; saves screenshots to $OUT
import puppeteer from 'puppeteer-core'; import fs from 'node:fs'; import path from 'node:path';
const OUT = process.env.OUT || '.';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function run(tag, W, H, mob) {
  const p = await b.newPage(); await p.setRequestInterception(true);
  p.on('request', r => { const u = new URL(r.url()); if (u.host !== 'fuerza.test') return r.continue(); let f = path.join(process.cwd(), decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html'; try { r.respond({ status: 200, contentType: T[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); } catch { r.respond({ status: 404, body: '' }); } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.setViewport({ width: W, height: H, deviceScaleFactor: mob ? 3 : 1, isMobile: mob, hasTouch: mob });
  await p.goto('https://fuerza.test/', { waitUntil: 'load' }); await sleep(5000);
  const go = async (id, k) => { await p.evaluate((id, k) => { const el = document.getElementById(id); scrollTo(0, el.offsetTop + el.offsetHeight * k); }, id, k); await sleep(2500); };
  const shot = n => p.screenshot({ path: `${OUT}/bt-${tag}-${n}.jpg`, quality: 78 });
  const tap = sel => p.evaluate(s => document.querySelector(s).click(), sel);
  await go('tint', .35); await shot('1-tint35');
  await tap('.chip[data-vlt="5"]'); await sleep(450); await shot('2-squeegee'); await sleep(900);
  await go('wrap', .35); await tap('.swatch[data-k="blue"]'); await sleep(700); await shot('3-wipe'); await sleep(1400); await shot('4-blue-5');
  await tap('.swatch[data-k="chrome"]'); await sleep(2000);
  await go('tint', .35); await tap('.chip[data-vlt="50"]'); await sleep(1400); await shot('5-chrome-50');
  console.log(tag, 'errors', errs);
  await p.close();
}
await run('desk', 1440, 900, false);
await run('phone', 390, 844, true);
await b.close();
