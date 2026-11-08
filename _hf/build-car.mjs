// Builds assets/build/: one 1600x900 side photo of the sedan per wrap color (paint-only edits of the master clear-glass
// still, aligned to it, with the background taken from the master so only the car changes), a car mask, and the tint
// glass layer (tinted window pixels + window alpha). js/build-car.js composites these live: wrap wipe + tint squeegee.
import sharp from 'sharp'; import fs from 'node:fs';
const SRC = process.env.HOME + '/fuerza/06-wrap-colors', OUT = '../assets/build', W = 1600, H = 900, N = W * H;
const PICK = { red: 'red-b', blue: 'blue-b', graphite: 'graphite-b', pearl: 'pearl-a', chrome: 'chrome-a', matte: 'matte-a' };
const AL = JSON.parse(fs.readFileSync(SRC + '/alignment.json'));
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const raw = async (f, dx = 0, dy = 0) => {
  const b = await sharp(f).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  if (!dx && !dy) return b;
  const o = Buffer.alloc(N * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const sx = Math.min(W - 1, Math.max(0, x - dx)), sy = Math.min(H - 1, Math.max(0, y - dy)); const i = (y * W + x) * 3, j = (sy * W + sx) * 3; o[i] = b[j]; o[i + 1] = b[j + 1]; o[i + 2] = b[j + 2]; }
  return o;
};
const master = await raw('sedan-tint/side_clear.png');
const cols = {};
for (const [k, f] of Object.entries(PICK)) { const a = AL[f + '.png']; cols[k] = await raw(`${SRC}/${f}.png`, a.dx * 1600 / 1600, a.dy); }
// car mask: where any recolor differs clearly from the master (the paint), grown and feathered so it covers the whole body
const diff = new Uint8Array(N);
for (let i = 0; i < N; i++) { let m = 0; for (const k in cols) { const c = cols[k], d = Math.abs(c[i * 3] - master[i * 3]) + Math.abs(c[i * 3 + 1] - master[i * 3 + 1]) + Math.abs(c[i * 3 + 2] - master[i * 3 + 2]); if (d > m) m = d; } diff[i] = m > 70 ? 255 : 0; }
// keep the floor reflection too (recolored paint reflects), but cut stray background speckles: open then close
const m1 = await sharp(Buffer.from(diff), { raw: { width: W, height: H, channels: 1 } }).median(5).blur(6).extractChannel(0).raw().toBuffer();
const m2 = Buffer.from(m1.map(v => (v > 40 ? 255 : 0)));
// keep only the big shapes (car body + its floor reflection); drop smoke/neon speckles in the bay
{
  const lab = new Int32Array(N), sizes = [0]; const st = [];
  for (let i = 0; i < N; i++) if (m2[i] && !lab[i]) {
    const id = sizes.length; let n = 0; st.push(i); lab[i] = id;
    while (st.length) { const j = st.pop(); n++; const x = j % W, y = (j / W) | 0;
      for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) if (k >= 0 && m2[k] && !lab[k]) { lab[k] = id; st.push(k); } }
    sizes.push(n);
  }
  const big = Math.max(...sizes);
  for (let i = 0; i < N; i++) if (m2[i] && sizes[lab[i]] < big * .08) m2[i] = 0;
  // fill holes inside the body (dark trim, glass): close vertically between the roof and rocker within the car's span
}
const mask = await sharp(m2, { raw: { width: W, height: H, channels: 1 } }).blur(4).extractChannel(0).raw().toBuffer();
if (mask.length !== N) throw new Error('mask size ' + mask.length);
await sharp(mask, { raw: { width: W, height: H, channels: 1 } }).png().toFile(OUT + '/mask.png');
// each color = master background + recolored car inside the mask
const fac = await sharp(master, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 86 }).toFile(OUT + '/factory.webp');
for (const k in cols) {
  const c = cols[k], o = Buffer.alloc(N * 3);
  for (let i = 0; i < N; i++) { const a = mask[i] / 255; for (let ch = 0; ch < 3; ch++) o[i * 3 + ch] = master[i * 3 + ch] * (1 - a) + c[i * 3 + ch] * a; }
  await sharp(o, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 86 }).toFile(`${OUT}/${k}.webp`);
}
// tint glass: the tinted still's window pixels, alpha = window polygon (same trace as tintgen-sedan.mjs)
const poly = '596,300 640,262 700,214 800,186 1040,182 1150,200 1196,250 1186,282 1100,296 900,302';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><polygon points="${poly}" fill="#fff"/></svg>`;
const wa = await sharp(Buffer.from(svg)).blur(2).extractChannel(0).raw().toBuffer();
const tinted = await raw('sedan-tint/side.png');
const g = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) { g[i * 4] = tinted[i * 3]; g[i * 4 + 1] = tinted[i * 3 + 1]; g[i * 4 + 2] = tinted[i * 3 + 2]; g[i * 4 + 3] = wa[i]; }
await sharp(g, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 88, alphaQuality: 100 }).toFile(OUT + '/glass.webp');
console.log(fs.readdirSync(OUT).map(f => f + ' ' + Math.round(fs.statSync(OUT + '/' + f).size / 1024) + 'K').join('\n'));
