// usage: node align-colors.mjs  -> for each recolor in ~/fuerza/06-wrap-colors, find the shift/scale that best lines it up with
// the master side photo (edge maps, so paint color doesn't matter) and report the leftover error around the windows
import sharp from 'sharp'; import fs from 'node:fs';
const D = process.env.HOME + '/fuerza/06-wrap-colors', W = 400, H = 225;
const edges = async (f, s = 1, dx = 0, dy = 0) => {
  const { data } = await sharp(f).resize(1600, 900, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  // apply scale about center + shift in 1600 space, sample down to W x H
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const X = ((x * 4 - 800) / s + 800) - dx, Y = ((y * 4 - 450) / s + 450) - dy;
    const xi = Math.round(X), yi = Math.round(Y);
    out[y * W + x] = xi > 0 && yi > 0 && xi < 1599 && yi < 899 ? data[yi * 1600 + xi] : 0;
  }
  const e = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; e[i] = Math.abs(out[i + 1] - out[i - 1]) + Math.abs(out[i + W] - out[i - W]); }
  return e;
};
const M = await edges(D + '/master-factory-black.png');
const score = (e) => { let s = 0; for (let y = 40; y < 200; y++) for (let x = 20; x < 380; x++) { const i = y * W + x; s += Math.abs(e[i] - M[i]); } return s / 57600; };
const res = {};
for (const f of fs.readdirSync(D).filter(f => /-(a|b)\.png$/.test(f))) {
  let best = { sc: 1e9 };
  for (const s of [0.985, 0.99, 0.995, 1, 1.005, 1.01, 1.015])
    for (let dx = -12; dx <= 12; dx += 4) for (let dy = -12; dy <= 12; dy += 4) {
      const sc = score(await edges(D + '/' + f, s, dx, dy)); if (sc < best.sc) best = { sc, s, dx, dy };
    }
  // refine 1px
  const b0 = { ...best };
  for (let dx = b0.dx - 3; dx <= b0.dx + 3; dx++) for (let dy = b0.dy - 3; dy <= b0.dy + 3; dy++) { const sc = score(await edges(D + '/' + f, b0.s, dx, dy)); if (sc < best.sc) best = { sc, s: b0.s, dx, dy }; }
  const base = score(await edges(D + '/' + f));
  res[f] = { ...best, sc: +best.sc.toFixed(2), unaligned: +base.toFixed(2) };
  console.log(f, JSON.stringify(res[f]));
}
fs.writeFileSync(D + '/alignment.json', JSON.stringify(res, null, 1));
