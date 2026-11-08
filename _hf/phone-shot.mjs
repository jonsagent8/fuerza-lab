import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--disable-background-timer-throttling'] });
const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await p.goto('http://127.0.0.1:8811/?debug', { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 6000));
const S = '/private/tmp/claude-501/-Users-root1/7fa2854f-024a-4458-86e4-e78e01bc944d/scratchpad/';
for (const [id, k] of [['wash', .45], ['interior', .5], ['tint', .3]]) {
  await p.evaluate((id, k) => { const el = document.getElementById(id); scrollTo(0, el.offsetTop + el.offsetHeight * k); }, id, k);
  await new Promise(r => setTimeout(r, 3500)); await p.screenshot({ path: S + 'ph-' + id + '.jpg', quality: 80 });
}
console.log('errors', errs);
await b.close();
