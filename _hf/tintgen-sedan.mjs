// Builds the tint clip locally: clear-window still → film squeegeed on top-to-bottom → darkens to limo black.
// Only pixels inside the window polygon change, so the car and bay stay pixel-identical to the wrap clips' framing.
import sharp from 'sharp'; import fs from 'node:fs';
const W = 1600, N = 145, OUT = '../assets/frames/tint';
const load = f => sharp(f).resize(W).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const [A, B] = await Promise.all([load('sedan-tint/side_clear.png'), load('sedan-tint/side.png')]);
const { width, height } = A.info, n = width * height;
// side window + rear quarter glass, traced on the 1600px still
const poly = '596,300 640,262 700,214 800,186 1040,182 1150,200 1196,250 1186,282 1100,296 900,302';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><polygon points="${poly}" fill="#fff"/></svg>`;
const M = (await sharp(Buffer.from(svg)).blur(2).extractChannel(0).raw().toBuffer());
const top = 182, bot = 302;
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(`${OUT}/full`, { recursive: true });
const buf = Buffer.alloc(n * 3);
for (let k = 0; k < N; k++) {
  const t = k / (N - 1);
  const yl = top - 6 + (bot - top + 12) * ss(0, .12, t);            // squeegee line
  const d = t < .12 ? .18 : .18 + .82 * (t - .12) / .88;             // film darkness: 70% VLT ≈ t .15, 5% = last frame
  const limo = ss(.55, 1, t) * .55;
  for (let y = 0; y < height; y++) {
    const cov = Math.min(1, Math.max(0, (yl - y) / 4 + .5));
    const glint = t < .13 ? .45 * Math.exp(-(((y - yl) / 2.5) ** 2)) : 0;
    for (let x = 0; x < width; x++) {
      const i = y * width + x, o = i * 3, m = M[i] / 255;
      if (m === 0) { buf[o] = A.data[o]; buf[o + 1] = A.data[o + 1]; buf[o + 2] = A.data[o + 2]; continue; }
      const a = m * cov * d, dark = 1 - m * cov * limo;
      for (let c = 0; c < 3; c++) buf[o + c] = Math.min(255, (A.data[o + c] * (1 - a) + B.data[o + c] * a) * dark + 255 * glint * m);
    }
  }
  const name = String(k + 1).padStart(4, '0') + '.webp', img = sharp(buf, { raw: { width, height, channels: 3 } });
  await img.webp({ quality: 75 }).toFile(`${OUT}/full/${name}`);   // native 1600 (the stills are 1600 wide)
}
console.log('done', N);
