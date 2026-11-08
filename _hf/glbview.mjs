// usage: node _hf/glbview.mjs <model.glb> <out-prefix>  -> 6 turntable screenshots + a contact sheet of a GLB (three.js, headless Chrome)
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const [glb, out] = process.argv.slice(2);
const html = `<!doctype html><html><body style="margin:0;background:#111"><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'; import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(800, 450); document.body.appendChild(r.domElement);
r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
const s = new THREE.Scene(); s.background = new THREE.Color(0x222428); s.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), .04).texture;
const cam = new THREE.PerspectiveCamera(30, 16 / 9, .01, 100);
const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/m.glb'); const o = g.scene; s.add(o);
const box = new THREE.Box3().setFromObject(o), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
o.position.sub(c); const R = Math.max(sz.x, sz.z) * 1.6;
let info = { size: sz.toArray().map(v => +v.toFixed(3)), meshes: 0, tris: 0, mats: [] };
o.traverse(m => { if (m.isMesh) { info.meshes++; info.tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; info.mats.push(m.material.name + ':' + (m.material.map ? m.material.map.image.width : 0)); } });
window.info = info;
window.shot = a => { cam.position.set(Math.sin(a) * R, sz.y * .35, Math.cos(a) * R); cam.lookAt(0, 0, 0); r.render(s, cam); return r.domElement.toDataURL('image/jpeg', .85); };
window.ready = true;
</script></body></html>`;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setRequestInterception(true);
p.on('request', r => { const u = new URL(r.url()); if (u.host !== 'v.test') return r.continue(); if (u.pathname === '/m.glb') return r.respond({ status: 200, contentType: 'model/gltf-binary', body: fs.readFileSync(glb) }); r.respond({ status: 200, contentType: 'text/html', body: html }); });
p.on('pageerror', e => console.log('err', e.message));
await p.goto('https://v.test/'); await p.waitForFunction('window.ready', { timeout: 120000 });
console.log(JSON.stringify(await p.evaluate(() => window.info)));
const files = [];
for (let k = 0; k < 6; k++) { const d = await p.evaluate(a => window.shot(a), k * Math.PI / 3 + .5); const f = `${out}-${k}.jpg`; fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); files.push(f); }
await b.close();
console.log(files.join(' '));
