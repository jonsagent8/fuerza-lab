import puppeteer from 'puppeteer-core';
const W = +process.env.W || 1440, H = +process.env.H || 900, list = (process.argv[2] || '0').split(',').map(Number);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=metal', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const p = await b.newPage();
import fs from 'node:fs'; import path from 'node:path';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
await p.setRequestInterception(true);
p.on('request', req => { const u = new URL(req.url()); if (u.host !== 'fuerza.test') return req.continue();
  let f = path.join(process.cwd(), decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
  try { req.respond({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); } catch { req.respond({ status: 404, body: 'nf' }); } }); await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const errs = []; p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await p.goto('https://fuerza.test/' + (process.env.PAGE || ''), { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 4500));
const docH = await p.evaluate(() => document.documentElement.scrollHeight);
for (const f of list) {
  const y = Math.round(f <= 1 ? f * (docH - H) : f);
  await p.evaluate(y => window.scrollTo(0, y), y);
  await p.mouse.move(W * .7, H * .45); await p.mouse.move(W * .72, H * .5);
  await new Promise(r => setTimeout(r, 1800));
  await p.screenshot({ path: `shot-${W}-${String(y).padStart(6, '0')}.png` });
}
console.log('docH', docH); console.log(errs.map(e => e.split("\n").filter(l => /ERROR|error/i.test(l)).join(" | ") || e.slice(0, 200)).join("\n"));
await b.close();
