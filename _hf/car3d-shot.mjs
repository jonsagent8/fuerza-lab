// usage: node _hf/car3d-shot.mjs [color] [vlt]  -> renders js/car3d.js alone at 4 yaws into $OUT/c3-<k>.jpg
import puppeteer from 'puppeteer-core'; import fs from 'node:fs'; import path from 'node:path';
const [color = 'factory', vlt = '35'] = process.argv.slice(2); const OUT = process.env.OUT || '.';
const html = `<!doctype html><body style="margin:0;background:#000"><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script>
<script type="module">
import { Car3D } from '/js/car3d.js';
const c = new Car3D({ w: 1600, h: 900 }); await c.load(); document.body.appendChild(c.c); c.c.style.width = '1600px';
c.idleAt = 1e15; c.setColor('${color}', '${color}', 1); c.setTint(null, ${vlt === 'null' ? 'null' : vlt}, 1);
window.shot = y => { c.yaw = y; c.vel = 0; c.dirty = true; c.render(); return c.c.toDataURL('image/jpeg', .85); };
window.ready = true;
</script>`;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); await p.setRequestInterception(true);
const T = { '.js': 'text/javascript', '.webp': 'image/webp', '.glb': 'model/gltf-binary' };
p.on('request', r => { const u = new URL(r.url()); if (u.host !== 'c.test') return r.continue(); if (u.pathname === '/') return r.respond({ status: 200, contentType: 'text/html', body: html }); try { r.respond({ status: 200, contentType: T[path.extname(u.pathname)] || 'application/octet-stream', body: fs.readFileSync('.' + u.pathname) }); } catch { r.respond({ status: 404, body: '' }); } });
p.on('pageerror', e => console.log('err', e.message)); p.on('console', m => m.type() === 'error' && console.log('console', m.text()));
await p.goto('https://c.test/'); await p.waitForFunction('window.ready', { timeout: 120000 });
for (const [k, y] of [[0, .5], [1, 1.57], [2, 3.0], [3, -1.2], [4, 1.3]]) { const d = await p.evaluate(y => window.shot(y), y); fs.writeFileSync(`${OUT}/c3-${k}.jpg`, Buffer.from(d.split(',')[1], 'base64')); }
await b.close(); console.log('ok');
