// usage: node _hf/glbprobe.mjs <model.glb>  -> bounds, and where dark (glass/trim), light (paint) and red texels sit on the mesh
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const glb = process.argv[2];
const html = `<!doctype html><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/m.glb'); let mesh; g.scene.traverse(o => { if (o.isMesh) mesh = o; });
g.scene.updateMatrixWorld(true);
const geo = new THREE.BufferGeometry(); for (const [k, at] of Object.entries(mesh.geometry.attributes)) { const f = new Float32Array(at.count * at.itemSize); for (let i = 0; i < at.count; i++) for (let q = 0; q < at.itemSize; q++) f[i * at.itemSize + q] = at.getComponent(i, q); geo.setAttribute(k, new THREE.BufferAttribute(f, at.itemSize)); } geo.applyMatrix4(mesh.matrixWorld); geo.computeVertexNormals();
const P = geo.attributes.position, U = geo.attributes.uv;
const img = mesh.material.map.image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); const D = cx.getImageData(0, 0, cv.width, cv.height).data;
const box = new THREE.Box3().setFromBufferAttribute(P); const c = box.getCenter(new THREE.Vector3());
const out = { min: box.min.toArray(), max: box.max.toArray(), flipY: mesh.material.map.flipY, cats: {} };
const H = {}; const add = (k, x, y, z) => { const h = H[k] || (H[k] = { n: 0, y: [], z: [], x: [] }); h.n++; if (h.n % 7 === 0) { h.y.push(y); h.z.push(z); h.x.push(x); } };
for (let i = 0; i < P.count; i++) {
  let u = U.getX(i), v = U.getY(i); const px = Math.min(cv.width - 1, Math.max(0, Math.floor(u * cv.width))), py = Math.min(cv.height - 1, Math.max(0, Math.floor((mesh.material.map.flipY ? 1 - v : v) * cv.height)));
  const j = (py * cv.width + px) * 4, r = D[j] / 255, gg = D[j + 1] / 255, b = D[j + 2] / 255, l = (r + gg + b) / 3, s = Math.max(r, gg, b) - Math.min(r, gg, b);
  const k = r > .45 && r > gg * 1.8 ? 'red' : l > .6 && s < .12 ? 'paint' : l < .3 ? 'dark' : 'mid';
  add(k, P.getX(i) - c.x, P.getY(i) - c.y, P.getZ(i) - c.z);
}
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return +s[Math.floor(s.length * f)].toFixed(3); };
for (const k in H) { const h = H[k]; out.cats[k] = { n: h.n, y: [q(h.y, .05), q(h.y, .5), q(h.y, .95)], z: [q(h.z, .05), q(h.z, .5), q(h.z, .95)], x: [q(h.x, .05), q(h.x, .95)] }; }
// dark texels by height band -> glass sits in a band above the beltline
const band = {}; for (let i = 0; i < H.dark.y.length; i++) { const b = Math.round(H.dark.y[i] * 50) / 50; band[b] = (band[b] || 0) + 1; } out.darkByY = band;
// red texels by z (along the car) -> wheel centers
const rz = {}; for (let i = 0; i < H.red.z.length; i++) { if (H.red.y[i] > -0.05) continue; const b = Math.round(H.red.z[i] * 20) / 20; rz[b] = (rz[b] || 0) + 1; } out.redLowByZ = rz;
// hood leading edge on the centreline (model space as car3d.js uses it: centred, x4): up-facing points near x = 0
{ const N = geo.attributes.normal; const pts = [];
  for (let i = 0; i < P.count; i++) { const x = (P.getX(i) - c.x) * 4, y = (P.getY(i) - c.y) * 4, z = (P.getZ(i) - c.z) * 4; if (Math.abs(x) < .06 && N && N.getY(i) > .35 && z > 1.2) pts.push([+z.toFixed(3), +y.toFixed(3), +N.getY(i).toFixed(2)]); }
  pts.sort((a, b) => b[0] - a[0]); out.hoodFront = pts.filter((_, k) => k % Math.max(1, Math.floor(pts.length / 25)) === 0).slice(0, 25); }
window.out = out; window.done = true;
</script>`;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage(); await p.setRequestInterception(true);
p.on('request', r => { const u = new URL(r.url()); if (u.host !== 'v.test') return r.continue(); if (u.pathname === '/m.glb') return r.respond({ status: 200, contentType: 'model/gltf-binary', body: fs.readFileSync(glb) }); r.respond({ status: 200, contentType: 'text/html', body: html }); });
p.on('pageerror', e => console.log('err', e.message));
await p.goto('https://v.test/'); await p.waitForFunction('window.done', { timeout: 120000 });
console.log(JSON.stringify(await p.evaluate(() => window.out), null, 1));
await b.close();
