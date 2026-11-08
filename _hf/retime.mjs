// usage: node _hf/retime.mjs <clip.mp4> <out-dir> <n-frames> [--mp4 out.mp4]
// Re-times a turntable segment to constant rotation speed: measures motion between consecutive frames, then picks
// n frames at equal steps of accumulated motion (first and last frames always kept). Writes PNGs (and a preview mp4).
import sharp from 'sharp'; import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const [clip, out, nStr, flag, mp4] = process.argv.slice(2), N = +nStr;
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out + '/src', { recursive: true });
execFileSync('ffmpeg', ['-v', 'error', '-i', clip, path.join(out, 'src', '%04d.png')]);
const files = fs.readdirSync(out + '/src').sort();
const small = f => sharp(path.join(out, 'src', f)).resize(240, 135).greyscale().raw().toBuffer();
const S = []; for (const f of files) S.push(await small(f));
const step = [0]; for (let i = 1; i < S.length; i++) { let s = 0; for (let k = 0; k < S[i].length; k++) s += Math.abs(S[i][k] - S[i - 1][k]); step.push(s / S[i].length); }
const cum = []; step.reduce((a, b, i) => (cum[i] = a + b), 0);
const total = cum[cum.length - 1], pick = [];
for (let j = 0; j < N; j++) { const t = total * j / (N - 1); let i = cum.findIndex(c => c >= t - 1e-9); if (i < 0) i = cum.length - 1; pick.push(i); }
pick.forEach((i, j) => fs.copyFileSync(path.join(out, 'src', files[i]), path.join(out, String(j + 1).padStart(4, '0') + '.png')));
const uniq = new Set(pick).size;
fs.rmSync(out + '/src', { recursive: true, force: true });
if (flag === '--mp4') execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', path.join(out, '%04d.png'), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', mp4]);
console.log(JSON.stringify({ in: files.length, out: N, unique: uniq, dropped: files.length - uniq }));
