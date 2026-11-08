// usage: node _hf/build-spin.mjs  -> assets/frames/spin/full/0001..0360.webp
// Chains the four turntable segments (~/fuerza/08-spin/seg12, seg23, seg34, seg41: front-left 3/4 → rear-left 3/4 →
// rear-right 3/4 → front-right 3/4 → front-left 3/4) into one 360-frame loop, 1 degree per frame:
//  - each segment is re-timed to constant rotation speed (equal steps of measured motion, see retime.mjs) into 91 frames
//  - the last frame of each segment is dropped because it is the next segment's first frame (same keyframe)
//  - the few frames either side of each join are cross-blended so the hand-off between clips doesn't pop
import sharp from 'sharp'; import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const SRC = process.env.HOME + '/fuerza/08-spin', OUT = 'assets/frames/spin/full', PER = 90, W = 1600, Q = 72, BLEND = 3;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spin'));
const segs = ['seg12', 'seg23', 'seg34-fixed', 'seg41'];   // seg34-fixed: a one-frame emblem-like dot painted out (deroundel.py)
const frames = [];   // raw RGB buffers at W x H
let H = 0;
for (const s of segs) {
  const dir = path.join(tmp, s);
  execFileSync('node', ['_hf/retime.mjs', `${SRC}/${s}.mp4`, dir, String(PER + 1)], { stdio: 'inherit' });
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort().slice(0, PER);
  for (const f of files) { const { data, info } = await sharp(path.join(dir, f)).resize(W).removeAlpha().raw().toBuffer({ resolveWithObject: true }); H = info.height; frames.push(data); }
}
// where re-timing picked the same source frame twice (slow ends of a clip), replace the repeat with a 50/50 blend of
// its neighbours so dragging never stalls for a frame
let dup = 0;
for (let i = 1; i < frames.length - 1; i++) if (frames[i].equals(frames[i - 1])) {
  const a = frames[i - 1], b = frames[i + 1], m = Buffer.alloc(a.length); for (let k = 0; k < a.length; k++) m[k] = (a[k] + b[k]) >> 1; frames[i] = m; dup++;
}
// cross-blend around each join (join k sits between frame k*PER-1 and k*PER): pull both sides toward their midpoint
const N = frames.length, mad = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 9) s += Math.abs(a[i] - b[i]); return s / (a.length / 9); };
const seams = [];
for (let k = 0; k < segs.length; k++) {
  const j = (k * PER) % N, a = frames[(j - 1 + N) % N], b = frames[j];
  seams.push(+mad(a, b).toFixed(2));
  const diff = Buffer.alloc(a.length); const d = new Float32Array(a.length); for (let i = 0; i < a.length; i++) d[i] = b[i] - a[i];
  for (let t = 1; t <= BLEND; t++) {
    const w = .5 * (BLEND + 1 - t) / (BLEND + 1);   // 0.375, 0.25, 0.125: spreads the jump over the join without repeating a frame
    const before = frames[(j - t + N) % N], after = frames[(j + t - 1) % N];
    for (let i = 0; i < a.length; i++) { before[i] = Math.max(0, Math.min(255, before[i] + d[i] * w)); after[i] = Math.max(0, Math.min(255, after[i] - d[i] * w)); }
  }
}
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
await Promise.all(frames.map((buf, i) => sharp(buf, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: Q }).toFile(`${OUT}/${String(i + 1).padStart(4, '0')}.webp`)));
fs.rmSync(tmp, { recursive: true, force: true });
const bytes = fs.readdirSync(OUT).reduce((s, f) => s + fs.statSync(`${OUT}/${f}`).size, 0);
console.log(JSON.stringify({ frames: N, repeatsBlended: dup, size: `${W}x${H}`, MB: +(bytes / 1e6).toFixed(1), seamMAD_beforeBlend: seams }));
