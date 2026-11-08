// usage: node _hf/seg-check.mjs <clip.mp4> <start.png> <end.png>
// -> how closely the first/last frames match the keyframes (seams), and frame-to-frame motion (cuts, uneven speed)
import sharp from 'sharp'; import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const [clip, ks, ke] = process.argv.slice(2), W = 192, H = 108;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seg'));
execFileSync('ffmpeg', ['-v', 'error', '-i', clip, '-vf', `scale=${W}:${H},format=gray`, path.join(tmp, '%04d.png')]);
const files = fs.readdirSync(tmp).sort(), g = f => sharp(f).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer();
const F = []; for (const f of files) F.push(await g(path.join(tmp, f)));
const mad = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
const [S, E] = [await g(ks), await g(ke)];
const steps = F.slice(1).map((f, i) => mad(f, F[i]));
const sorted = [...steps].sort((a, b) => a - b), med = sorted[sorted.length >> 1];
const cuts = steps.map((d, i) => [i + 1, d]).filter(([, d]) => d > med * 3.5 && d > 4);
// speed evenness over the middle 80% (ease-in/out at the very ends is expected and gets trimmed at the joins)
const mid = steps.slice(Math.floor(steps.length * .1), Math.ceil(steps.length * .9)), mean = mid.reduce((a, b) => a + b, 0) / mid.length;
const cv = Math.sqrt(mid.reduce((a, b) => a + (b - mean) ** 2, 0) / mid.length) / mean;
// in tenths: motion per frame, to see slow-fast-slow
const tenth = Array.from({ length: 10 }, (_, k) => { const a = steps.slice(Math.floor(k * steps.length / 10), Math.floor((k + 1) * steps.length / 10)); return +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2); });
console.log(JSON.stringify({ frames: F.length, firstVsStart: +mad(F[0], S).toFixed(2), lastVsEnd: +mad(F[F.length - 1], E).toFixed(2), startVsEnd: +mad(S, E).toFixed(2),
  medianStep: +med.toFixed(2), cuts, speedCV_mid80: +cv.toFixed(2), motionByTenth: tenth }, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
