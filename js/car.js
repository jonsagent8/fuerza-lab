// Procedural concept car + studio, driven by a shared state object (S) that main.js updates from scroll.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export const FINISHES = {
  gloss:  { rough: .3, metal: .6, cc: 1,   ccr: .015 },
  pearl:  { rough: .22, metal: .35, cc: 1,   ccr: .05 },
  satin:  { rough: .46, metal: .45, cc: .25, ccr: .35 },
  matte:  { rough: .8,  metal: .2,  cc: 0,   ccr: .6 },
  chrome: { rough: .07, metal: .96, cc: 1,   ccr: .02 },
};

export const S = {
  cam: { yaw: .78, r: 7.4, h: 1.75, ty: .6, tx: 0, ox: 0 },
  mouse: { x: 0, y: 0 },
  dirt: 0, foam: 0, rinse: 3.2, sweep: -1,
  glass: .55, interior: 0, steam: 0, cabin: 0,
  scan: 3, scanOn: 0, film: 0, rocks: 0,
  active: true,
};

// ---------------- body profile: BMW M240i Coupé (G42), measured ----------------
// Tables traced column-by-column from a dimensioned G42 side + plan drawing and scaled to spec:
// length 4.54 m, wheelbase 2.741 m, height 1.39 m, width 1.838 m (mirrors excluded). x = length (front +), y = up, z = width.
const L = 4.54, XMIN = -2.27, XMAX = XMIN + L, BELT = .965, GLASS_Y = BELT + .03, WR = .338, WY = .338, AR = .37;
const WHEELS_U = [0.2108, 0.8145], WHEEL_X = WHEELS_U.map(u => XMIN + u * L), TRACK = .79;
const TOP = [[0, 0.4925], [0.0052, 0.6107], [0.0105, 0.6157], [0.0157, 0.6286], [0.021, 0.8927], [0.0262, 1.0228], [0.0315, 1.0317], [0.0367, 1.0297], [0.042, 1.0297], [0.0472, 1.0297], [0.0525, 1.0297], [0.0577, 1.0307], [0.063, 1.0317], [0.0682, 1.0337], [0.0735, 1.0357], [0.0787, 1.0387], [0.084, 1.0407], [0.0892, 1.0436], [0.0945, 1.0476], [0.0997, 1.0506], [0.105, 1.0536], [0.1102, 1.0566], [0.1155, 1.0595], [0.1207, 1.0625], [0.126, 1.0714], [0.1312, 1.0844], [0.1365, 1.0963], [0.1417, 1.1082], [0.147, 1.1201], [0.1522, 1.131], [0.1575, 1.141], [0.1627, 1.1519], [0.168, 1.1618], [0.1732, 1.1727], [0.1785, 1.1827], [0.1837, 1.1926], [0.189, 1.2015], [0.1942, 1.2115], [0.1995, 1.2204], [0.2047, 1.2293], [0.21, 1.2383], [0.2152, 1.2462], [0.2205, 1.2542], [0.2257, 1.2621], [0.231, 1.27], [0.2362, 1.277], [0.2415, 1.2831], [0.2467, 1.2893], [0.252, 1.2955], [0.2572, 1.3017], [0.2625, 1.3079], [0.2677, 1.3141], [0.273, 1.3203], [0.2782, 1.3265], [0.2835, 1.3326], [0.2887, 1.3388], [0.294, 1.345], [0.2992, 1.3512], [0.3045, 1.3574], [0.3097, 1.3614], [0.315, 1.3644], [0.3202, 1.3674], [0.3255, 1.3703], [0.3307, 1.3733], [0.336, 1.3763], [0.3412, 1.3783], [0.3465, 1.3803], [0.3517, 1.3823], [0.357, 1.3842], [0.3622, 1.3852], [0.3675, 1.3862], [0.3727, 1.3882], [0.378, 1.3892], [0.3832, 1.3892], [0.3885, 1.3902], [0.3937, 1.3912], [0.399, 1.3912], [0.4042, 1.3912], [0.4094, 1.3912], [0.4147, 1.3912], [0.4199, 1.3912], [0.4252, 1.3902], [0.4304, 1.3902], [0.4357, 1.3892], [0.4409, 1.3882], [0.4462, 1.3872], [0.4514, 1.3852], [0.4567, 1.3833], [0.4619, 1.3813], [0.4672, 1.3793], [0.4724, 1.3763], [0.4777, 1.3733], [0.4829, 1.3713], [0.4882, 1.3654], [0.4934, 1.3698], [0.4987, 1.3664], [0.5039, 1.3654], [0.5092, 1.3465], [0.5144, 1.343], [0.5197, 1.3346], [0.5249, 1.3268], [0.5302, 1.3173], [0.5354, 1.3077], [0.5407, 1.2982], [0.5459, 1.2887], [0.5512, 1.2791], [0.5564, 1.2696], [0.5617, 1.26], [0.5669, 1.2505], [0.5722, 1.2409], [0.5774, 1.2314], [0.5827, 1.2218], [0.5879, 1.2123], [0.5932, 1.2027], [0.5984, 1.1932], [0.6037, 1.1817], [0.6089, 1.1698], [0.6142, 1.1568], [0.6194, 1.1449], [0.6247, 1.132], [0.6299, 1.1191], [0.6352, 1.1062], [0.6404, 1.0933], [0.6457, 1.0794], [0.6509, 1.0645], [0.6562, 1.0506], [0.6614, 1.0347], [0.6667, 1.0188], [0.6719, 1.0019], [0.6772, 0.9851], [0.6824, 0.9672], [0.6877, 0.9573], [0.6929, 0.9582], [0.6982, 0.9582], [0.7034, 0.9592], [0.7087, 0.9602], [0.7139, 0.9612], [0.7192, 0.9612], [0.7244, 0.9612], [0.7297, 0.9622], [0.7349, 0.9612], [0.7402, 0.9612], [0.7454, 0.9602], [0.7507, 0.9602], [0.7559, 0.9592], [0.7612, 0.9582], [0.7664, 0.9563], [0.7717, 0.9553], [0.7769, 0.9543], [0.7822, 0.9523], [0.7874, 0.9503], [0.7927, 0.9493], [0.7979, 0.9473], [0.8031, 0.9453], [0.8084, 0.9434], [0.8136, 0.9404], [0.8189, 0.9384], [0.8241, 0.9354], [0.8294, 0.9334], [0.8346, 0.9304], [0.8399, 0.9265], [0.8451, 0.9235], [0.8504, 0.9205], [0.8556, 0.9165], [0.8609, 0.9126], [0.8661, 0.9086], [0.8714, 0.9036], [0.8766, 0.8997], [0.8819, 0.8947], [0.8871, 0.8887], [0.8924, 0.8838], [0.8976, 0.8778], [0.9029, 0.8719], [0.9081, 0.8659], [0.9134, 0.8589], [0.9186, 0.852], [0.9239, 0.845], [0.9291, 0.8371], [0.9344, 0.8292], [0.9396, 0.8212], [0.9449, 0.8123], [0.9501, 0.8033], [0.9554, 0.7934], [0.9606, 0.7835], [0.9659, 0.7726], [0.9711, 0.7606], [0.9764, 0.7467], [0.9816, 0.7318], [0.9869, 0.713], [0.9921, 0.7001], [1, 0.6901]];
const BOT = [[0, 0.3664], [0.007, 0.28], [0.014, 0.2681], [0.021, 0.2691], [0.028, 0.2661], [0.035, 0.2582], [0.042, 0.2512], [0.049, 0.2453], [0.056, 0.2403], [0.063, 0.2343], [0.07, 0.2284], [0.077, 0.2234], [0.084, 0.2175], [0.091, 0.2125], [0.098, 0.2065], [0.105, 0.2016], [0.112, 0.1956], [0.119, 0.1907], [0.126, 0.1847], [0.133, 0.1807], [0.287, 0.1787], [0.294, 0.1777], [0.301, 0.1629], [0.308, 0.1599], [0.315, 0.1599], [0.322, 0.1599], [0.329, 0.1589], [0.336, 0.1589], [0.343, 0.1589], [0.35, 0.1589], [0.357, 0.1589], [0.364, 0.1589], [0.371, 0.1589], [0.378, 0.1589], [0.385, 0.1579], [0.392, 0.1579], [0.399, 0.1579], [0.4059, 0.1579], [0.4129, 0.1579], [0.4199, 0.1579], [0.4269, 0.1579], [0.4339, 0.1579], [0.4409, 0.1579], [0.4479, 0.1569], [0.4549, 0.1569], [0.4619, 0.1569], [0.4689, 0.1569], [0.4759, 0.1569], [0.4829, 0.1569], [0.4899, 0.1569], [0.4969, 0.1569], [0.5039, 0.1569], [0.5109, 0.1569], [0.5179, 0.1559], [0.5249, 0.1559], [0.5319, 0.1559], [0.5389, 0.1559], [0.5459, 0.1559], [0.5529, 0.1559], [0.5599, 0.1559], [0.5669, 0.1559], [0.5739, 0.1559], [0.5809, 0.1559], [0.5879, 0.1559], [0.5949, 0.1549], [0.6019, 0.1549], [0.6089, 0.1549], [0.6159, 0.1549], [0.6229, 0.1549], [0.6299, 0.1549], [0.6369, 0.1549], [0.6439, 0.1549], [0.6509, 0.1549], [0.6579, 0.1549], [0.6649, 0.1549], [0.6719, 0.1539], [0.6789, 0.1539], [0.6859, 0.1539], [0.6929, 0.1539], [0.6999, 0.1539], [0.7069, 0.1539], [0.7139, 0.1539], [0.7209, 0.1539], [0.7279, 0.1539], [0.7349, 0.1698], [0.8959, 0.15], [0.9029, 0.15], [0.9099, 0.15], [0.9169, 0.15], [0.9239, 0.15], [0.9309, 0.15], [0.9379, 0.15], [0.9449, 0.15], [0.9519, 0.15], [0.9589, 0.15], [0.9659, 0.15], [0.9729, 0.15], [0.9799, 0.1658], [0.9869, 0.1777], [0.9939, 0.1787], [1, 0.1787]];
const PLAN = [[0, 0], [0.0026, 0.4158], [0.007, 0.5082], [0.0114, 0.5661], [0.0157, 0.6094], [0.0201, 0.6448], [0.0245, 0.6752], [0.0289, 0.7018], [0.0332, 0.7254], [0.0376, 0.745], [0.042, 0.7627], [0.0464, 0.7784], [0.0507, 0.7922], [0.0551, 0.804], [0.0595, 0.8148], [0.0639, 0.8237], [0.0682, 0.8325], [0.0726, 0.8404], [0.077, 0.8472], [0.0814, 0.8531], [0.0857, 0.859], [0.0901, 0.864], [0.0945, 0.8689], [0.0989, 0.8728], [0.1032, 0.8767], [0.1076, 0.8807], [0.112, 0.8846], [0.1164, 0.8875], [0.1207, 0.8905], [0.1251, 0.8934], [0.1295, 0.8964], [0.1339, 0.8984], [0.1382, 0.9003], [0.1426, 0.9023], [0.147, 0.9043], [0.1514, 0.9062], [0.1557, 0.9082], [0.1601, 0.9092], [0.1645, 0.9111], [0.1689, 0.9121], [0.1732, 0.9131], [0.1776, 0.9141], [0.182, 0.9151], [0.1864, 0.9161], [0.1907, 0.917], [0.1951, 0.918], [0.1995, 0.918], [0.2038, 0.918], [0.2082, 0.918], [0.2126, 0.919], [0.217, 0.919], [0.2213, 0.919], [0.2257, 0.919], [0.2301, 0.919], [0.2345, 0.919], [0.2388, 0.919], [0.2432, 0.919], [0.2476, 0.919], [0.252, 0.919], [0.2563, 0.919], [0.2607, 0.919], [0.2651, 0.919], [0.2695, 0.918], [0.2738, 0.918], [0.2782, 0.918], [0.2826, 0.917], [0.287, 0.9161], [0.2913, 0.9151], [0.2957, 0.9141], [0.3001, 0.9121], [0.3045, 0.9111], [0.3088, 0.9092], [0.3132, 0.9082], [0.3176, 0.9072], [0.322, 0.9052], [0.3263, 0.9043], [0.3307, 0.9023], [0.3351, 0.9013], [0.3395, 0.9003], [0.3438, 0.9003], [0.3482, 0.8993], [0.3526, 0.8993], [0.357, 0.8984], [0.3613, 0.8984], [0.3657, 0.8984], [0.3701, 0.8984], [0.3745, 0.8984], [0.3788, 0.8984], [0.3832, 0.8984], [0.3876, 0.8984], [0.392, 0.8984], [0.3963, 0.8984], [0.4007, 0.8984], [0.4051, 0.8984], [0.4094, 0.8984], [0.4138, 0.8984], [0.4182, 0.8984], [0.4226, 0.8984], [0.4269, 0.8984], [0.4313, 0.8984], [0.4357, 0.8984], [0.4401, 0.8974], [0.4444, 0.8974], [0.4488, 0.8974], [0.4532, 0.8974], [0.4576, 0.8974], [0.4619, 0.8974], [0.4663, 0.8974], [0.4707, 0.8974], [0.4751, 0.8974], [0.4794, 0.8974], [0.4838, 0.8974], [0.4882, 0.8974], [0.4926, 0.8974], [0.4969, 0.8974], [0.5013, 0.8974], [0.5057, 0.8974], [0.5101, 0.8974], [0.5144, 0.8974], [0.5188, 0.8974], [0.5232, 0.8974], [0.5276, 0.8974], [0.5319, 0.8974], [0.5363, 0.8974], [0.6702, 0.8993], [0.6745, 0.9003], [0.6789, 0.9013], [0.6833, 0.9033], [0.6877, 0.9052], [0.692, 0.9072], [0.6964, 0.9092], [0.7008, 0.9111], [0.7052, 0.9131], [0.7095, 0.9151], [0.7139, 0.9161], [0.7183, 0.917], [0.7227, 0.917], [0.727, 0.918], [0.7314, 0.918], [0.7358, 0.918], [0.7402, 0.919], [0.7445, 0.919], [0.7489, 0.919], [0.7533, 0.919], [0.7577, 0.919], [0.762, 0.919], [0.7664, 0.919], [0.7708, 0.919], [0.7752, 0.919], [0.7795, 0.919], [0.7839, 0.919], [0.7883, 0.919], [0.7927, 0.919], [0.797, 0.919], [0.8014, 0.919], [0.8058, 0.918], [0.8101, 0.918], [0.8145, 0.918], [0.8189, 0.917], [0.8233, 0.9161], [0.8276, 0.9161], [0.832, 0.9151], [0.8364, 0.9141], [0.8408, 0.9131], [0.8451, 0.9111], [0.8495, 0.9102], [0.8539, 0.9092], [0.8583, 0.9072], [0.8626, 0.9052], [0.867, 0.9033], [0.8714, 0.9003], [0.8758, 0.8984], [0.8801, 0.8954], [0.8845, 0.8925], [0.8889, 0.8895], [0.8933, 0.8856], [0.8976, 0.8826], [0.902, 0.8787], [0.9064, 0.8738], [0.9108, 0.8689], [0.9151, 0.864], [0.9195, 0.8581], [0.9239, 0.8512], [0.9283, 0.8433], [0.9326, 0.8355], [0.937, 0.8256], [0.9414, 0.8138], [0.9458, 0.8011], [0.9501, 0.7853], [0.9545, 0.7686], [0.9589, 0.749], [0.9633, 0.7264], [0.9676, 0.7008], [0.972, 0.6693], [0.9764, 0.631], [0.9808, 0.5829], [0.9851, 0.5199], [0.9895, 0.4364], [0.9939, 0.3588], [0.9983, 0.2261], [1, 0]];
function table(pts, u) {
  let i = 1; while (i < pts.length - 1 && pts[i][0] < u) i++;
  const [u0, v0] = pts[i - 1], [u1, v1] = pts[i], t = clamp((u - u0) / ((u1 - u0) || 1));
  return v0 + (v1 - v0) * t;
}
function resample(pts, sigma, n = 900) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n; let sw = 0, sv = 0;
    for (let k = -3; k <= 3; k += .25) { const w = Math.exp(-k * k / 2), uu = u + k * sigma, ur = uu < 0 ? -uu : uu > 1 ? 2 - uu : uu; sw += w; sv += w * table(pts, ur); }
    out.push([u, sv / sw]);
  }
  return out;
}
const TOP_S = resample(TOP, .008), BOT_S = resample(BOT, .012), PLAN_S = resample(PLAN, .005);
const top = u => table(TOP_S, u);
function bot(u) {
  let y = table(BOT_S, u); const x = XMIN + u * L;
  for (const wx of WHEEL_X) { const dx = x - wx; if (Math.abs(dx) < AR) y = Math.max(y, WY + Math.sqrt(AR * AR - dx * dx)); }
  return y;
}
const wid = u => (u <= 0 || u >= 1) ? 0 : table(PLAN_S, u);
const cabin = u => ss(BELT + .04, BELT + .2, top(u));
function HW(u, y) {
  const yb = bot(u), yt = top(u), w = wid(u);
  let hw = w * (.9 + .1 * ss(yb, yb + .24, y));
  hw *= 1 - .045 * ss(.8, BELT, y);                         // body tucks in above the shoulder
  hw += .007 * Math.exp(-(((y - .79) / .014) ** 2)) * ss(.1, .2, u) * ss(.97, .88, u); // shoulder crease
  const c = cabin(u);
  if (y > BELT && c > 0) {
    const t = clamp((y - BELT) / (yt - BELT)), shoulder = ss(0, .16, t);
    const cab = w * .83 * (1 - .36 * t) * Math.pow(Math.max(0, 1 - Math.pow(t, 9)), 1 / 9);
    hw = lerp(hw, lerp(hw, cab, shoulder), c);
  }
  const rt = lerp(.12, .045, c), rb = .08, dt = yt - y, db = y - yb;
  if (dt < rt) hw *= Math.sqrt(Math.max(0, 1 - (1 - dt / rt) ** 2));
  if (db < rb) hw *= Math.sqrt(Math.max(0, 1 - (1 - db / rb) ** 2));
  return hw;
}

function buildBody(NU = 420, M = 96) {
  const R = 2 * M, KB = Math.round(M * .56);
  const pos = new Float32Array((NU + 1) * R * 3), split = [];
  for (let i = 0; i <= NU; i++) {
    const u = .5 - .5 * Math.cos(Math.PI * i / NU), x = XMIN + u * L, yb = bot(u), yt = top(u);
    const twoPart = yt > GLASS_Y + .06; split.push(twoPart && cabin(u) > .45);
    for (let k = 0; k < R; k++) {
      const kk = k <= M ? k : R - k, side = k <= M ? 1 : -1;
      let y;
      if (twoPart) y = kk <= KB ? yb + (GLASS_Y - yb) * (1 - Math.cos(kk / KB * Math.PI / 2)) : GLASS_Y + (yt - GLASS_Y) * Math.sin((kk - KB) / (M - KB) * Math.PI / 2);
      else y = yb + (yt - yb) * (1 - Math.cos(Math.PI * kk / M)) / 2;
      const o = (i * R + k) * 3; pos[o] = x; pos[o + 1] = y; pos[o + 2] = side * HW(u, y);
    }
  }
  const cand = [], all = [];
  for (let i = 0; i < NU; i++) for (let k = 0; k < R; k++) {
    const a = i * R + k, b = i * R + (k + 1) % R, c = (i + 1) * R + k, d = (i + 1) * R + (k + 1) % R;
    all.push(a, c, b, b, c, d); cand.push(split[i] && split[i + 1] && k >= KB && k < R - KB ? i : -1);
  }
  const full = new THREE.BufferGeometry();
  full.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  full.setIndex(all); full.computeVertexNormals();
  const na = full.getAttribute('normal').array, bodyIdx = [], glassIdx = [];
  cand.forEach((ci, f) => {
    const q = all.slice(f * 6, f * 6 + 6);
    let isGlass = ci >= 0;
    if (isGlass) {
      const v4 = [q[0], q[1], q[2], q[5]], avg = o => v4.reduce((a, v) => a + na[v * 3 + o], 0) / 4;
      const u = .5 - .5 * Math.cos(Math.PI * ci / NU), ny = avg(1), nz = Math.abs(avg(2)), yc = v4.reduce((a, v) => a + pos[v * 3 + 1], 0) / 4;
      if (u > .27 && u < .54 && ny > .93) isGlass = false;                       // painted roof
      if (nz > .5) { const ur = .232 + (yc - GLASS_Y) * .22, uf = .652 - (yc - GLASS_Y) * .32; if (u < ur || u > uf) isGlass = false; } // C- and A-pillars
    }
    (isGlass ? glassIdx : bodyIdx).push(...q);
  });
  const nrm = full.getAttribute('normal');
  const body = new THREE.BufferGeometry(); body.setAttribute('position', full.getAttribute('position')); body.setAttribute('normal', nrm); body.setIndex(bodyIdx);
  const gp = pos.slice(); for (let i = 0; i < gp.length; i += 3) { gp[i] += nrm.array[i] * .004; gp[i + 1] += nrm.array[i + 1] * .004; gp[i + 2] += nrm.array[i + 2] * .004; }
  const glass = new THREE.BufferGeometry(); glass.setAttribute('position', new THREE.BufferAttribute(gp, 3)); glass.setAttribute('normal', nrm); glass.setIndex(glassIdx);
  return { body, glass, pos, nrm: nrm.array };
}

// ---------------- road grime ----------------
// One packed CC0 texture (ambientCG): R = vertical grime streaks, G = blotchy smudge/dust, B = drips, A = debris flecks.
// Projected triplanar in car space (the model has no UVs) and layered by where dirt really collects on a car.
const GRIME_WX = [-1.287, 1.439];
const GRIME_GLSL = `
uniform sampler2D uGrime;
vec4 triG(vec3 p, vec3 n, float s) {
  vec3 w = pow(abs(n), vec3(6.)); w /= max(dot(w, vec3(1.)), 1e-4);
  return texture2D(uGrime, p.zy * s) * w.x + texture2D(uGrime, p.xz * s) * w.y + texture2D(uGrime, vec2(p.x, p.y) * s) * w.z;
}
// rgb = grime colour, a = coverage. lift > 0 lightens it for dark parts (dust shows pale on black plastic).
vec4 grimeLayer(vec3 p, vec3 n, float dirt, float rinse, float lift) {
  float k = dirt * (1. - smoothstep(rinse - .06, rinse + .06, p.x));
  if (k <= .001) return vec4(0.);
  vec4 g1 = triG(p, n, .85), g2 = triG(p * 1.7 + 3.1, n, 1.4);
  float up = smoothstep(.4, .85, n.y), side = 1. - smoothstep(.5, .8, abs(n.y));
  float low = smoothstep(.8, .16, p.y);
  float wheel = max(smoothstep(.95, .38, length(vec2(p.x - (${GRIME_WX[0].toFixed(3)} - .3), p.y - .32))),
                    smoothstep(.95, .38, length(vec2(p.x - (${GRIME_WX[1].toFixed(3)} - .3), p.y - .32))));
  float spray = (low * .9 + wheel * .7) * (.35 + 1.1 * g1.g);
  spray = smoothstep(.12, .88, spray + (g1.r - .45) * .35 * (1. - low));
  float runs = side * smoothstep(1.0, .6, p.y) * smoothstep(.12, .45, p.y) * smoothstep(.26, .52, g1.r) * (.55 + .45 * g2.b);
  float dust = up * smoothstep(.15, .7, g1.g * .8 + .25);
  float fleck = smoothstep(.42, .62, g2.a) * clamp(low * .9 + wheel, 0., 1.);
  vec3 dustC = mix(vec3(.5, .45, .38), vec3(.5, .46, .4), lift);
  vec3 grimeC = mix(vec3(.23, .19, .145), vec3(.36, .32, .27), lift) * (.8 + .4 * g2.g);
  vec3 mudC = mix(vec3(.17, .13, .09), vec3(.3, .25, .19), lift);
  vec3 c = dustC; float a = dust * .6;
  c = mix(c, grimeC, spray); a = max(a, spray * .94);
  c = mix(c, grimeC * .9, runs); a = max(a, runs * .8);
  c = mix(c, mudC, fleck); a = max(a, fleck * .97);
  return vec4(c, clamp(a * k, 0., 1.));
}
`;
// Adds the grime layer (and part-specific dirt) to any standard/physical material. kind: trim | tire | rim | lens | glass
function grimify(mat, U, kind) {
  const prev = mat.onBeforeCompile;
  mat.customProgramCacheKey = () => 'grime-' + kind;
  mat.onBeforeCompile = (sh, r) => {
    prev && prev(sh, r);
    sh.uniforms.uDirt = U.uDirt; sh.uniforms.uRinse = U.uRinse; sh.uniforms.uGrime = U.uGrime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGP; varying vec3 vGN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGP = position; vGN = normal;');
    const lift = kind === 'trim' ? '.3' : kind === 'tire' ? '.2' : '0.';
    let body = `vec4 gl = grimeLayer(vGP, normalize(vGN), uDirt, uRinse, ${lift});`;
    if (kind === 'rim') body += `
      vec4 bd = triG(vGP * 2.3, normalize(vGN), 1.); float clean = 1. - smoothstep(uRinse - .06, uRinse + .06, vGP.x);
      gl = vec4(vec3(.12, .095, .07) * (.7 + .6 * bd.g), clamp(uDirt * clean * (.5 + .35 * bd.g), 0., 1.));`;
    if (kind === 'tire') body += `\n      gl.a *= .65;`;
    if (kind === 'lens') body += `\n      gl.a = max(gl.a, uDirt * (1. - smoothstep(uRinse - .06, uRinse + .06, vGP.x)) * .35);`;
    if (kind === 'glass') body += `
      vec3 gn = normalize(vGN); float clean = 1. - smoothstep(uRinse - .06, uRinse + .06, vGP.x);
      vec4 gg = triG(vGP, gn, .9);
      float haze = uDirt * clean * (.35 + .65 * gg.g) * (.55 + .45 * smoothstep(.3, .9, gn.y));
      float wipe = 0.;
      if (vGP.x > .3 && gn.x > .25) {   // windshield: two clean wiper arcs
        wipe = max(smoothstep(.64, .6, length(vec2(vGP.x - 1.14, vGP.z + .46))), smoothstep(.62, .58, length(vec2(vGP.x - 1.14, vGP.z - .14)))) * step(vGP.x, 1.14);
      }
      haze *= 1. - .88 * wipe;
      haze = max(haze, uDirt * clean * smoothstep(.55, .8, gg.b) * .6 * (1. - wipe));   // dried water spots
      gl = vec4(vec3(.58, .54, .47), clamp(haze, 0., 1.));`;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGP; varying vec3 vGN; uniform float uDirt, uRinse;\n' + GRIME_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>\n  ${body}\n  diffuseColor.rgb = mix(diffuseColor.rgb, gl.rgb, gl.a);` + (kind === 'glass' ? '\n  diffuseColor.a = mix(diffuseColor.a, .93, gl.a * .8);' : ''))
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, ' + (kind === 'glass' ? '.55' : '.95') + ', gl.a);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, 0., gl.a);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\n  material.clearcoat *= 1. - gl.a;\n#endif');
  };
  mat.needsUpdate = true;
}

// ---------------- paint shader (wrap wipe, dirt, PPF hex scan, impacts, cursor polish trail) ----------------
const TRAIL = 14;
function paintMaterial(real = false, shared = null) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: .55, roughness: .16, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 2.1 });
  if (real) m.defines = { REAL_MODEL: '' };
  const U = m.userData.u = shared || {
    uColA: { value: new THREE.Color('#b0121a') }, uColB: { value: new THREE.Color('#b0121a') }, uWipe: { value: 9 }, uWipeGlow: { value: 0 },
    uDirt: { value: 0 }, uRinse: { value: 3.2 }, uScan: { value: 3 }, uScanOn: { value: 0 }, uFilm: { value: 0 }, uTime: { value: 0 },
    uImp: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 0, -9)) },
    uTrail: { value: Array.from({ length: TRAIL }, () => new THREE.Vector4(0, -9, 0, -9)) },
  };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vP; varying vec3 vNo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position; vNo = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vP; varying vec3 vNo;
uniform vec3 uColA, uColB; uniform float uWipe, uWipeGlow, uDirt, uRinse, uScan, uScanOn, uFilm, uTime;
uniform vec4 uImp[4]; uniform vec4 uTrail[${TRAIL}];
${GRIME_GLSL}
float aoG = 1.0, dmG = 0.0, tmG = 0.0, trR = .2, trM = 0., trCC = 1.; vec3 lampE = vec3(0.);
float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float inside(float d){ return 1. - smoothstep(-.002, .003, d); }
float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * n3(p); p *= 2.03; a *= .5; } return v; }
float hexEdge(vec2 p){ vec2 r = vec2(1., 1.7320508), h = r * .5; vec2 a = mod(p, r) - h, b = mod(p - h, r) - h; vec2 g = dot(a, a) < dot(b, b) ? a : b; g = abs(g); return .5 - max(dot(g, normalize(r)), g.x); }
vec3 film(float t){ return .5 + .5 * cos(6.2831 * (vec3(0., .33, .67) + t)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  float wm = smoothstep(uWipe - .012, uWipe + .012, vP.x);
  diffuseColor.rgb = mix(uColB, uColA, wm);
#ifndef REAL_MODEL
  // ---- G42 trim, read from object-space position + normal ----
  vec3 nn = normalize(vNo); float az = abs(vP.z), y = vP.y;
  vec3 tc = vec3(.008, .009, .011); float tm = 0.;
  if (vP.x > ${(XMAX - .7).toFixed(3)}) {
    float face = smoothstep(.4, .7, nn.x);
    float kd = rbox(vec2(az - .195, y - .6), vec2(.165, .098), .06);                 // kidneys
    float kid = face * inside(kd) * step(.03, az);
    float slat = .5 + .5 * sin(az * 110. + sin(y * 60.) * 1.4);
    float li = face * inside(rbox(vec2(vP.z, y - .36), vec2(.4, .055), .03));       // lower intake
    float ci = smoothstep(.18, .32, nn.x) * step(.25, y) * step(az, .87) * step(.5 + (y - .25) * .85, az) * step(y, .6); // corner intakes
    float hl = smoothstep(.0, .25, nn.x) * inside(rbox(vec2(az - .66, y - .675 - (az - .66) * .14), vec2(.185, .04), .02)); // headlights
    float split = face * step(y, .25);                                              // front splitter
    tm = max(max(kid, li), max(ci, split));
    tc = mix(tc, vec3(.02), kid * slat * .6);
    tc = mix(tc, vec3(.03), li * step(.5, fract(y * 55.)));
    if (hl > 0.) {
      float hy = (y - .675 - (az - .66) * .14) / .04, hz = (az - .66) / .185;
      float drl = max(smoothstep(.45, .7, hy) * step(-.85, hz) * step(hz, .9), smoothstep(.55, .8, hz) * step(-.6, hy));
      lampE += vec3(.85, .93, 1.) * drl * hl * 2.6;
      tm = max(tm, hl); tc = mix(tc, vec3(.03, .035, .045), hl);
    }
  }
  if (vP.x < ${(XMIN + .6).toFixed(3)}) {
    float face = smoothstep(.4, .7, -nn.x);
    float tl = step(-.35, -nn.x) * inside(rbox(vec2(az - .7, y - .9), vec2(.19, .05), .025)) * step(vP.x, ${(XMIN + .32).toFixed(3)}); // taillights
    float dif = smoothstep(.2, .5, -nn.x) * step(y, .5);                                                 // diffuser
    float ex = face * inside(rbox(vec2(az - .56, y - .37), vec2(.08, .034), .012)); // exhaust tips
    tm = max(tm, dif);
    if (tl > 0.) {
      float hy = (y - .9) / .05, hz = (az - .7) / .19;
      float l = max(smoothstep(.2, .55, hy) * step(-.9, hz), smoothstep(.45, .75, hz) * step(-.5, hy) + smoothstep(-.1, .1, hz) * smoothstep(.3, -.3, abs(hy)) * .6);
      lampE += vec3(1., .06, .08) * clamp(l, 0., 1.) * tl * 2.4;
      tm = max(tm, tl); tc = mix(tc, vec3(.12, .005, .01), tl);
    }
    if (ex > 0.) { tm = 1.; tc = vec3(.05); trM = .9; trR = .25; }
  }
  float spoiler = step(vP.x, ${(XMIN + .3).toFixed(3)}) * step(.99, y) * smoothstep(.2, .5, nn.y);
  float belt = step(${(XMIN + .232 * L).toFixed(3)}, vP.x) * step(vP.x, ${(XMIN + .655 * L).toFixed(3)}) * step(${(BELT - .02).toFixed(3)}, y) * step(y, ${(GLASS_Y + .004).toFixed(3)}) * step(.35, abs(nn.z));
  float apil = step(${(XMIN + .56 * L).toFixed(3)}, vP.x) * step(${GLASS_Y.toFixed(3)}, y) * step(.45, abs(nn.z)) * step(nn.y, .9);
  tm = max(tm, max(max(spoiler, belt), apil));
  // panel gaps, flush door handle, baked occlusion
  float sideF = smoothstep(.45, .7, abs(nn.z)), gap = 0.;
  gap = max(gap, smoothstep(.0045, .0012, abs(vP.x - (${(XMIN + .672 * L).toFixed(3)} - (y - .3) * .06))) * step(.24, y) * step(y, ${BELT.toFixed(3)}) * sideF);
  gap = max(gap, smoothstep(.0045, .0012, abs(vP.x - (${(XMIN + .386 * L).toFixed(3)} + (y - .55) * .05))) * step(.26, y) * step(y, ${BELT.toFixed(3)}) * sideF);
  gap = max(gap, smoothstep(.0045, .0012, abs(y - .748)) * smoothstep(.35, .6, nn.x) * step(az, .6));
  gap = max(gap, smoothstep(.0045, .0012, abs(vP.x - ${(XMIN + .045 * L).toFixed(3)})) * smoothstep(.3, .6, nn.y) * step(az, .6));
  float handle = sideF * inside(rbox(vec2(vP.x - ${(XMIN + .43 * L).toFixed(3)}, y - .875), vec2(.075, .011), .009));
  diffuseColor.rgb *= 1. - gap * .9;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * .45, handle);
  float ao = 1. - .32 * (1. - smoothstep(.16, .42, y));
  ao *= mix(.5, 1., smoothstep(${AR.toFixed(3)} - .01, ${AR.toFixed(3)} + .13, length(vec2(vP.x - ${WHEEL_X[0].toFixed(3)}, y - ${WY.toFixed(3)}))));
  ao *= mix(.5, 1., smoothstep(${AR.toFixed(3)} - .01, ${AR.toFixed(3)} + .13, length(vec2(vP.x - ${WHEEL_X[1].toFixed(3)}, y - ${WY.toFixed(3)}))));
  aoG = ao * (1. - gap * .9);
  tmG = tm; trCC = 1.;
  diffuseColor.rgb = mix(diffuseColor.rgb, tc, tmG);
#endif
  vec4 gl = grimeLayer(vP, normalize(vNo), uDirt, uRinse, 0.);
  dmG = gl.a;
  diffuseColor.rgb = mix(diffuseColor.rgb, gl.rgb, dmG);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(mix(roughnessFactor, trR, tmG), .95, dmG);')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n  reflectedLight.indirectDiffuse *= aoG; reflectedLight.indirectSpecular *= mix(1., aoG, .85); reflectedLight.directDiffuse *= mix(1., aoG, .5);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, trM, tmG);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  \n#ifdef USE_CLEARCOAT\n  material.clearcoat = mix(material.clearcoat, trCC, tmG) * (1. - dmG);\n#endif')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += lampE;
  totalEmissiveRadiance += film(vP.y * .8 + uTime * .2) * exp(-pow((vP.x - uWipe) * 18., 2.)) * uWipeGlow * 3.;
  vec2 hp = vec2(vP.x + vP.z * .6, vP.y + vP.z * .8) * 7.;
  float hx = smoothstep(.07, .0, hexEdge(hp));
  float band = exp(-pow((vP.x - uScan) * 4.5, 2.)) * uScanOn;
  totalEmissiveRadiance += vec3(1., .26, .22) * (hx * 2.2 + .12) * band;
  float covered = smoothstep(uScan - .05, uScan + .05, vP.x) * uFilm;
  float fres = pow(1. - abs(dot(normal, vec3(0., 0., 1.))), 2.);
  totalEmissiveRadiance += film(fres * 1.2 + vP.x * .25) * .03 * covered * fres;
  for (int i = 0; i < 4; i++) { vec4 im = uImp[i]; float age = uTime - im.w; if (age < 0. || age > 1.1) continue;
    float d = distance(vP, im.xyz); float ring = exp(-pow((d - age * .9) * 16., 2.)) * (1. - age / 1.1);
    totalEmissiveRadiance += vec3(1., .32, .26) * ring * (.5 + hx * 3.) + vec3(1., .9, .7) * exp(-d * d * 900.) * max(0., 1. - age * 8.) * 1.2; }
  for (int i = 0; i < ${TRAIL}; i++) { vec4 tp = uTrail[i]; float age = uTime - tp.w; if (age < 0. || age > 1.4) continue;
    float d = distance(vP, tp.xyz); float k = exp(-d * d * 90.) * (1. - age / 1.4);
    totalEmissiveRadiance += film(age * .6 + d * 2. + uTime * .15) * k * .5; }`);
  };
  return m;
}

// ---------------- details ----------------
// 19" black Y-spoke wheel (five split spokes) on 35-profile tires, red M Sport calipers
function wheel(mats) {
  const g = new THREE.Group(), w = .128, rIn = .243;
  const prof = [[rIn, -w], [WR - .035, -w], [WR - .01, -w + .02], [WR, -w + .05], [WR, w - .05], [WR - .01, w - .02], [WR - .035, w], [rIn, w]].map(([r, y]) => new THREE.Vector2(r, y));
  const tire = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), mats.tire); tire.rotation.x = Math.PI / 2; g.add(tire);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rIn, rIn, w * 1.8, 48, 1, true), mats.dark); barrel.rotation.x = Math.PI / 2; g.add(barrel);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rIn - .004, .011, 10, 80), mats.rim); lip.position.z = w - .02; g.add(lip);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(rIn, 48), mats.dark); disc.position.z = -.02; g.add(disc);
  const cal = new THREE.Mesh(new THREE.BoxGeometry(.19, .085, .07), mats.caliper); cal.position.set(-.13, .12, w - .095); cal.rotation.z = .85; g.add(cal);
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .02, 48), mats.rotor); rotor.rotation.x = Math.PI / 2; rotor.position.z = w - .12; g.add(rotor);
  const spoke = (r0, r1, ang, wd, z) => { const len = r1 - r0, m = new THREE.Mesh(new THREE.BoxGeometry(wd, len, .035), mats.rim); const rm = (r0 + r1) / 2; m.position.set(Math.cos(ang) * rm, Math.sin(ang) * rm, z); m.rotation.z = ang - Math.PI / 2; g.add(m); };
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + .3;
    spoke(.045, .12, a, .05, w - .04);
    for (const d of [-1, 1]) { const ang = a + d * .19; spoke(.11, rIn - .006, ang, .03, w - .042); }
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.055, .06, .045, 32), mats.rim); hub.rotation.x = Math.PI / 2; hub.position.z = w - .035; g.add(hub);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .05, 24), mats.cap); cap.rotation.x = Math.PI / 2; cap.position.z = w - .03; g.add(cap);
  return g;
}
function tubeAlong(pts, r, mat) { return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, r, 8, false), mat); }
const surf = (u, y, side, out = .006) => { const w = HW(u, y); return new THREE.Vector3(XMIN + u * L + (u > .97 ? out : u < .03 ? -out : 0), y, side * (w + out)); };

function interior(mats) {
  const g = new THREE.Group(), seat = mats.leather;
  for (const [x, sc] of [[.05, 1], [-.6, .78]]) for (const z of [-.36, .36]) {
    const cush = new THREE.Mesh(new THREE.BoxGeometry(.48 * sc, .1, .46), seat); cush.position.set(x, .46, z * (sc < 1 ? .9 : 1)); g.add(cush);
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(.19, .26 * sc, 4, 10), seat); back.scale.set(.42, 1, 1.05); back.position.set(x - .24 * sc, .72, z * (sc < 1 ? .9 : 1)); back.rotation.z = .2; g.add(back);
  }
  const dash = new THREE.Mesh(new THREE.BoxGeometry(.36, .2, 1.36), mats.dark); dash.position.set(.74, .86, 0); g.add(dash);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(.01, .09, .9), mats.screen); scr.position.set(.56, .93, 0); g.add(scr);
  const sw = new THREE.Mesh(new THREE.TorusGeometry(.16, .022, 10, 40), mats.dark); sw.position.set(.46, .9, .36); sw.rotation.set(0, Math.PI / 2, 0); sw.rotation.z = .3; g.add(sw);
  const tunnel = new THREE.Mesh(new THREE.BoxGeometry(1.2, .18, .2), mats.dark); tunnel.position.set(.05, .48, 0); g.add(tunnel);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.0, .04, 1.4), mats.dark); floor.position.set(-.1, .42, 0); g.add(floor);
  return g;
}

function curtainMat(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uCol: { value: new THREE.Color(color) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime, uOn; uniform vec3 uCol;
      void main(){ float edge = smoothstep(0., .15, vUv.x) * smoothstep(1., .85, vUv.x) * smoothstep(0., .1, vUv.y) * smoothstep(1., .7, vUv.y);
        float lines = .7 + .3 * sin(vUv.y * 90. - uTime * 14.); float streak = 1.;
        gl_FragColor = vec4(uCol * edge * lines * streak * uOn * .28, 1.); }`,
  });
}
function glowSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ======================================================================
export function createStage(canvas, { mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x080707, 1);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x080707, 11, 24);
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 80);

  // studio environment with neon strip reflections
  // dark studio: black room, big overhead softbox, neon strips. Reflections carry the look on dark paint.
  const pmrem = new THREE.PMREMGenerator(renderer), room = new THREE.Scene();
  room.background = new THREE.Color(0x030303);
  const soft = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    const gx = g.createLinearGradient(0, 0, 256, 0); [[0, 0], [.18, 1], [.82, 1], [1, 0]].forEach(([o, a]) => gx.addColorStop(o, `rgba(255,255,255,${a})`));
    g.fillStyle = gx; g.fillRect(0, 0, 256, 128); g.globalCompositeOperation = 'destination-in';
    const gy = g.createLinearGradient(0, 0, 0, 128); [[0, 0], [.22, 1], [.78, 1], [1, 0]].forEach(([o, a]) => gy.addColorStop(o, `rgba(255,255,255,${a})`));
    g.fillStyle = gy; g.fillRect(0, 0, 256, 128); return new THREE.CanvasTexture(c); })();
  const panel = (col, k, pos, size, rot = [0, 0, 0]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), map: soft, transparent: true, side: THREE.DoubleSide })); m.position.set(...pos); m.rotation.set(...rot); room.add(m); };
  { const f = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color("#211e1e").multiplyScalar(.6), side: THREE.DoubleSide })); f.rotation.x = -Math.PI / 2; f.position.y = -.05; room.add(f); }
  panel('#ffffff', 5, [0, 7.2, 0], [8, 3.2], [Math.PI / 2, 0, 0]);           // overhead softbox
  panel('#ffffff', 2.2, [0, 3.6, 6.5], [11, 1.2], [0, Math.PI, 0]);         // long side strips
  panel('#ffffff', 2.2, [0, 3.6, -6.5], [11, 1.2]);
  panel('#ffffff', 55, [0, 1.25, 7], [14, .1], [0, Math.PI, 0]);            // horizon line lights: crisp highlight along the doors
  panel('#ffffff', 55, [0, 1.25, -7], [14, .1]);
  panel('#ffffff', 35, [0, 2.1, 7], [14, .06], [0, Math.PI, 0]);
  panel('#ffffff', 35, [0, 2.1, -7], [14, .06]);
  panel('#f2f7ff', 1.6, [8, 2.6, 0], [5, 3.2], [0, -Math.PI / 2, 0]);       // front fill
  panel('#ffffff', 40, [8, 1.4, 0], [.08, 6], [0, -Math.PI / 2, 0]);     // vertical strip for front-quarter highlights
  panel('#ffffff', 30, [-8, 1.6, 0], [.08, 6], [0, Math.PI / 2, 0]);
  panel('#ffffff', 1.1, [-8, 2.6, 0], [5, 3.2], [0, Math.PI / 2, 0]);       // rear fill
  panel('#ffffff', 45, [0, 6.4, 1.3], [12, .16], [Math.PI / 2, 0, 0]);       // crisp overhead line lights
  panel('#ffffff', 45, [0, 6.4, -1.3], [12, .16], [Math.PI / 2, 0, 0]);
  panel('#ff2a2a', 1.1, [0, 6.9, 3.8], [12, .22], [Math.PI / 2, 0, 0]);     // faint brand accents
  panel('#f4f4f6', 1.1, [0, 6.9, -3.8], [12, .22], [Math.PI / 2, 0, 0]);
  void RoomEnvironment;
  scene.environment = pmrem.fromScene(room, .02).texture;

  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2.5, 9, 3.5); key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 }); key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 4;
  scene.add(key);
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ opacity: .55 })); shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = .003; shadowCatcher.receiveShadow = true; scene.add(shadowCatcher);
  const cursorLight = new THREE.PointLight(0xdfe6ff, 4, 9, 1.6); scene.add(cursorLight);
  const sweepLight = new THREE.PointLight(0xffffff, 0, 6, 1.4); scene.add(sweepLight);
  const cabinLight = new THREE.PointLight(0xff2a2a, 0, 2.2, 1.5); cabinLight.position.set(0, .95, 0); scene.add(cabinLight);

  const mats = {
    paint: paintMaterial(),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x070a10, metalness: 0, roughness: .03, transparent: true, opacity: .55, envMapIntensity: 1.5, clearcoat: 1, clearcoatRoughness: .01 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: .82 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x07080b, roughness: .6, metalness: .2 }),
    rim: new THREE.MeshPhysicalMaterial({ color: 0x0b0c0f, roughness: .28, metalness: .5, clearcoat: 1, clearcoatRoughness: .08 }),
    rotor: new THREE.MeshStandardMaterial({ color: 0x5a5d63, roughness: .45, metalness: .9 }),
    cap: new THREE.MeshStandardMaterial({ color: 0x8a90a0, roughness: .3, metalness: .9 }),
    mirror: new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: .12, metalness: .1, clearcoat: 1, clearcoatRoughness: .03, envMapIntensity: 1.4 }),
    rimDark: new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: .35, metalness: .9 }),
    caliper: new THREE.MeshStandardMaterial({ color: 0xc0161c, roughness: .4, metalness: .2 }),
    neon: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a2a').multiplyScalar(2.2), toneMapped: false }),
    headlight: new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8f6ff').multiplyScalar(1.4), toneMapped: false }),
    tail: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a4a').multiplyScalar(3), toneMapped: false }),
    accent: new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4f4f6').multiplyScalar(1.6), toneMapped: false }),
    leather: new THREE.MeshStandardMaterial({ color: 0x5a463a, roughness: .6, envMapIntensity: .4 }),
    screen: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a2a').multiplyScalar(.5) }),
  };
  const PU = mats.paint.userData.u;
  mats.paintReal = paintMaterial(true, PU);
  const grimeTex = new THREE.TextureLoader().load('textures/grime.webp');
  grimeTex.wrapS = grimeTex.wrapT = THREE.RepeatWrapping; grimeTex.colorSpace = THREE.NoColorSpace; grimeTex.anisotropy = 8;
  PU.uGrime = { value: grimeTex };
  grimify(mats.glass, PU, 'glass');

  // car
  const geo = buildBody();
  const car = new THREE.Group(), stat = new THREE.Group(); car.add(stat); scene.add(car);
  const bodyMesh = new THREE.Mesh(geo.body, mats.paint), glassMesh = new THREE.Mesh(geo.glass, mats.glass);
  const proc = new THREE.Group(); stat.add(proc, interior(mats));
  proc.add(bodyMesh, glassMesh);
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(L * .58, .26, 1.42), mats.dark); chassis.position.set(-.05, .33, 0); proc.add(chassis);
  for (const x of WHEEL_X) for (const side of [1, -1]) { const wh = wheel(mats); wh.position.set(x, WY, side * TRACK); if (side < 0) wh.rotation.y = Math.PI; proc.add(wh); }
  // light bars
  // shark-fin antenna at the back of the roof
  { const fin = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.mirror); const u = .262; fin.scale.set(.1, .055, .035); fin.position.set(XMIN + u * L, top(u) - .008, 0); proc.add(fin); }
  // gloss black mirror caps on short stalks
  for (const side of [1, -1]) {
    const u = .588, x = XMIN + u * L, base = HW(u, BELT + .03);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), mats.mirror); head.scale.set(.12, .062, .13); head.position.set(x - .02, BELT + .04, side * .9); head.rotation.set(0, side * .15, side * -.06); proc.add(head);
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(.09, .035, Math.max(.05, .86 - base)), mats.mirror); stalk.position.set(x + .01, BELT + .02, side * (base + .86) / 2); proc.add(stalk);
  }

  // reflection: mirrored copy of the static car under a translucent floor
  stat.traverse(o => { if (o.isMesh && o !== glassMesh) o.castShadow = true; });
  const proxy = new THREE.Mesh(buildBody(120, 36).body, new THREE.MeshBasicMaterial()); proxy.visible = false; car.add(proxy);
  const mirror = stat.clone(); mirror.scale.y = -1; scene.add(mirror);
  mirror.traverse(o => { o.castShadow = false; });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(26, 64), new THREE.MeshStandardMaterial({ color: 0x080707, roughness: .55, metalness: 0, envMapIntensity: .15, transparent: true, opacity: .9 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const grid = new THREE.GridHelper(40, 80, 0xff2a2a, 0xff2a2a); grid.material.transparent = true; grid.material.opacity = .06; grid.position.y = .002; scene.add(grid);
  { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = .004; scene.add(sh); }
  // halo ring on the floor
  const halo = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.32, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a2a').multiplyScalar(1.5), transparent: true, opacity: .5, toneMapped: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = .006; scene.add(halo);

  // ---- foam (instanced bubbles sampled on the body surface) ----
  const FOAM_N = mobile ? 1600 : 4200, foamPts = [];
  function sampleFoam(pos, nrm) {
    foamPts.length = 0; const n = pos.length / 3; let guard = 0;
    while (foamPts.length < FOAM_N && guard++ < 400000) {
      const i = Math.floor(Math.random() * n), y = pos[i * 3 + 1], ny = nrm[i * 3 + 1];
      if (y < .3 || ny < -.25) continue;
      const nx = nrm[i * 3], nz = nrm[i * 3 + 2];
      foamPts.push({ x: pos[i * 3] + nx * .015, y: y + ny * .015, z: pos[i * 3 + 2] + nz * .015, r: .012 + Math.random() ** 3 * .04, t: Math.random() * .85, ph: Math.random() * 6.28 });
    }
  }
  sampleFoam(geo.pos, geo.nrm);
  const foam = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9aa4b8, emissiveIntensity: .12, roughness: .25, metalness: 0, envMapIntensity: .6 }), foamPts.length);
  foam.instanceMatrix.setUsage(THREE.DynamicDrawUsage); foam.frustumCulled = false; car.add(foam);
  const dummy = new THREE.Object3D();

  // ---- rinse curtain + water spray ----
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.4), curtainMat('#ff2a2a')); curtain.rotation.y = Math.PI / 2; curtain.position.y = 1.15; scene.add(curtain);
  const SPRAY = mobile ? 500 : 1400, sprayGeo = new THREE.BufferGeometry(), sprayPos = new Float32Array(SPRAY * 3), spraySeed = Array.from({ length: SPRAY }, () => [Math.random(), Math.random(), Math.random()]);
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
  const sprite = glowSprite();
  const spray = new THREE.Points(sprayGeo, new THREE.PointsMaterial({ size: .028, map: sprite, color: 0xbff8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); spray.frustumCulled = false; scene.add(spray);
  // ---- steam in the cabin ----
  const STEAM = 260, steamGeo = new THREE.BufferGeometry(), steamPos = new Float32Array(STEAM * 3), steamSeed = Array.from({ length: STEAM }, () => [Math.random(), Math.random(), Math.random()]);
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));
  const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({ size: .16, map: sprite, color: 0xdff6ff, transparent: true, opacity: 0, depthWrite: false })); steam.frustumCulled = false; scene.add(steam);
  const uvScan = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .9), curtainMat('#f4f4f6')); uvScan.rotation.y = Math.PI / 2; uvScan.position.y = .85; scene.add(uvScan);
  // ---- rock chips for PPF ----
  const ROCKS = 18, rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.022, 0), new THREE.MeshStandardMaterial({ color: 0x8c8a86, roughness: .9 }), ROCKS);
  rockMesh.frustumCulled = false; scene.add(rockMesh);
  const hitPts = [];
  function sampleHits(pos, nrm) { hitPts.length = 0; const n = pos.length / 3, step = Math.max(1, Math.floor(n / 6000)); for (let i = 0; i < n && hitPts.length < 400; i += step) { const x = pos[i * 3], nx = nrm[i * 3]; if (x > 1.55 && nx > .25 && pos[i * 3 + 1] > .35) hitPts.push(new THREE.Vector3(x, pos[i * 3 + 1], pos[i * 3 + 2])); } }
  sampleHits(geo.pos, geo.nrm);
  const rocks = Array.from({ length: ROCKS }, (_, i) => ({ ph: i / ROCKS, hit: hitPts[Math.floor(Math.random() * hitPts.length)], from: new THREE.Vector3(6.5, .35 + Math.random() * .5, (Math.random() - .5) * 1.6), cycle: -1 }));
  let impI = 0;

  // ---- the real car: Sketchfab "2022 BMW M240i Coupe" by Nazh Design (CC BY 4.0), preprocessed into car-frame parts ----
  const PART_MATS = {
    paint: mats.paintReal,
    glass: mats.glass,
    trim: new THREE.MeshPhysicalMaterial({ color: 0x060709, roughness: .3, metalness: .1, clearcoat: .7, clearcoatRoughness: .12, envMapIntensity: 1 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: .86, metalness: 0 }),
    rim: new THREE.MeshPhysicalMaterial({ color: 0x0e0f12, roughness: .32, metalness: .55, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.4 }),
    headlight: new THREE.MeshPhysicalMaterial({ color: 0xc9d2de, roughness: .12, metalness: 1, clearcoat: 1, clearcoatRoughness: .02, emissive: 0xdfeeff, emissiveIntensity: .12, envMapIntensity: 1.6 }),
    chrome: new THREE.MeshPhysicalMaterial({ color: 0x0d0e11, roughness: .38, metalness: .6, clearcoat: .6, clearcoatRoughness: .1, envMapIntensity: 1 }),
    taillight: new THREE.MeshPhysicalMaterial({ color: 0x5a0008, roughness: .14, metalness: 0, clearcoat: 1, clearcoatRoughness: .02, emissive: 0xff1428, emissiveIntensity: .75 }),
  };
  grimify(PART_MATS.trim, PU, 'trim'); grimify(PART_MATS.chrome, PU, 'trim'); grimify(PART_MATS.tire, PU, 'tire');
  grimify(PART_MATS.rim, PU, 'rim'); grimify(PART_MATS.headlight, PU, 'lens'); grimify(PART_MATS.taillight, PU, 'lens');
  const toFloat = a => { const out = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k); return new THREE.BufferAttribute(out, a.itemSize); };
  // window.VANTA_MODEL_URL may point at a .js module exporting the GLB as base64 (used where .glb files can't be served)
  const MODEL_URL = window.VANTA_MODEL_URL || 'models/m240i.glb', loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const loadModel = MODEL_URL.endsWith('.js')
    ? import(new URL(MODEL_URL, document.baseURI).href).then(m => { const bin = Uint8Array.from(atob(m.default), c => c.charCodeAt(0)); return loader.parseAsync(bin.buffer, ''); })
    : loader.loadAsync(MODEL_URL);
  const modelReady = loadModel.then(gltf => {
    const real = new THREE.Group(); real.name = 'm240i';
    gltf.scene.updateMatrixWorld(true);
    let paintGeo = null, rimOuter = .9;
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', toFloat(o.geometry.attributes.position)); g.setAttribute('normal', toFloat(o.geometry.attributes.normal)); g.setIndex(o.geometry.index);
      g.applyMatrix4(o.matrixWorld); g.computeBoundingSphere(); g.computeBoundingBox();
      const m = new THREE.Mesh(g, PART_MATS[o.name] || mats.mirror); m.name = o.name;
      m.castShadow = o.name !== 'glass'; real.add(m);
      if (o.name === 'paint') paintGeo = g;
      if (o.name === 'rim') rimOuter = Math.max(-g.boundingBox.min.z, g.boundingBox.max.z);
    });
    // red M Sport calipers tucked behind the spokes
    for (const [wx, dir] of [[-1.287, 1], [1.439, -1]]) for (const side of [1, -1]) {
      const cal = new THREE.Mesh(new THREE.BoxGeometry(.2, .09, .07), mats.caliper);
      cal.position.set(wx + dir * .13, .345 + .13, side * (rimOuter - .12)); cal.rotation.z = dir * -.75; cal.castShadow = true; real.add(cal);
    }
    proc.visible = false; stat.add(real);
    // reflection copy: flipped normals would light the underbody from above, so keep its dark parts matte and unlit
    const flat = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 1, metalness: 0, envMapIntensity: 0 });
    const mreal = real.clone(); mreal.traverse(o => { o.castShadow = false; if (o.isMesh && ['trim', 'chrome', 'tire'].includes(o.name)) o.material = flat; }); mirror.add(mreal);
    mirror.children[0].visible = false;   // the reflection's copy of the procedural car
    stat.children[1].visible = false; mirror.children[1].visible = false;   // the model has its own interior
    if (paintGeo) { sampleFoam(paintGeo.attributes.position.array, paintGeo.attributes.normal.array); sampleHits(paintGeo.attributes.position.array, paintGeo.attributes.normal.array); }
    foam.count = foamPts.length;
    window.__vanta && (window.__vanta.real = real);
  }).catch(err => { console.warn('M240i model failed to load; using the procedural car.', err); });

  // ---- post ----
  const rt = new THREE.WebGLRenderTarget(1, 1, { samples: mobile ? 2 : 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (!mobile) { gtao = new GTAOPass(scene, camera, 1, 1); gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = .85; gtao.updateGtaoMaterial({ radius: .45, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 12 }); gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 }); composer.addPass(gtao); }
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), mobile ? .2 : .24, .35, .95); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- wrap color changes ----
  const wrap = { from: FINISHES.gloss, to: FINISHES.gloss, t0: -9, dur: 1.5, current: '#b0121a' };
  function setWrap(hex, fin = 'gloss', instant = false) {
    if (hex === wrap.current && !instant) return;
    PU.uColA.value.copy(PU.uColB.value); PU.uColB.value.set(hex);
    wrap.from = { rough: mats.paint.roughness, metal: mats.paint.metalness, cc: mats.paint.clearcoat, ccr: mats.paint.clearcoatRoughness };
    wrap.to = FINISHES[fin] || FINISHES.gloss; wrap.current = hex; wrap.t0 = instant ? -9 : clock.elapsedTime;
    if (instant) { PU.uColA.value.set(hex); PU.uWipe.value = 9; applyFinish(wrap.to); }
  }
  function applyFinish(f) { for (const m of [mats.paint, mats.paintReal]) { m.roughness = f.rough; m.metalness = f.metal; m.clearcoat = f.cc; m.clearcoatRoughness = f.ccr; } }

  // ---- cursor raycast: polish trail on the paint ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let pointer = null, lastTrail = 0, trailI = 0;
  const setPointer = (cx, cy) => { pointer = [cx, cy]; };

  // ---- sizing ----
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h); if (gtao) gtao.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    camera.aspect = w / h; camera.fov = w / h < .8 ? 48 : w / h < 1.2 ? 40 : 32; camera.updateProjectionMatrix();
  }
  resize(); window.addEventListener('resize', resize);

  // ---- loop ----
  const clock = new THREE.Clock(), camPos = new THREE.Vector3(6, 2, 6), camTgt = new THREE.Vector3(0, .6, 0), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3();
  const sm = { yaw: S.cam.yaw, r: S.cam.r, h: S.cam.h, ty: S.cam.ty, tx: S.cam.tx, ox: 0, mx: 0, my: 0 };
  const perf = { acc: 0, n: 0, level: 0 };
  let firstFrame = null; const ready = Promise.all([new Promise(r => (firstFrame = r)), modelReady]);

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
    if (!S.active || document.hidden) { canvas.dataset.hover = ''; return; }
    const k = 1 - Math.pow(.0015, dt);
    for (const key of ['yaw', 'r', 'h', 'ty', 'tx', 'ox']) sm[key] += (S.cam[key] - sm[key]) * k;
    sm.mx += (S.mouse.x - sm.mx) * (1 - Math.pow(.02, dt)); sm.my += (S.mouse.y - sm.my) * (1 - Math.pow(.02, dt));
    const yaw = sm.yaw + sm.mx * .16 + Math.sin(t * .15) * .03, h = sm.h + sm.my * .25;
    camPos.set(Math.sin(yaw) * sm.r + sm.tx, h, Math.cos(yaw) * sm.r); camTgt.set(sm.tx, sm.ty, 0);
    fwd.subVectors(camTgt, camPos).normalize(); right.crossVectors(fwd, up).normalize();
    camPos.addScaledVector(right, sm.ox); camTgt.addScaledVector(right, sm.ox);
    camera.position.copy(camPos); camera.lookAt(camTgt);
    cursorLight.position.copy(camPos).addScaledVector(fwd, sm.r * .55).addScaledVector(right, sm.mx * 3.2).addScaledVector(up, 1.2 + sm.my * 1.6);
    cursorLight.color.setHSL((.62 + Math.sin(t * .2) * .06) % 1, .35, .8); cursorLight.intensity = 4 * clamp((sm.r - 3) / 5.5, .25, 1);

    // paint uniforms
    PU.uTime.value = t; PU.uDirt.value = S.dirt; PU.uRinse.value = S.rinse; PU.uScan.value = S.scan; PU.uScanOn.value = S.scanOn; PU.uFilm.value = S.film;
    const wp = clamp((t - wrap.t0) / wrap.dur);
    if (wrap.t0 > 0) {
      PU.uWipe.value = lerp(-2.6, 2.6, ss(0, 1, wp)); PU.uWipeGlow.value = Math.sin(Math.PI * wp);
      const e = ss(0, 1, wp); applyFinish({ rough: lerp(wrap.from.rough, wrap.to.rough, e), metal: lerp(wrap.from.metal, wrap.to.metal, e), cc: lerp(wrap.from.cc, wrap.to.cc, e), ccr: lerp(wrap.from.ccr, wrap.to.ccr, e) });
      if (wp >= 1) { PU.uColA.value.copy(PU.uColB.value); PU.uWipe.value = 9; PU.uWipeGlow.value = 0; wrap.t0 = -9; }
    }
    sweepLight.intensity = S.sweep > -1 ? 22 * Math.sin(Math.PI * clamp(S.sweep)) : 0; sweepLight.position.set(lerp(3, -3, clamp(S.sweep)), 2.2, 1.6);
    mats.glass.opacity = S.glass;
    cabinLight.intensity = S.interior * 2.5 + S.cabin * 3 * (1 - S.glass);
    halo.material.opacity = .25 + .25 * Math.sin(t * 1.2); halo.scale.setScalar(1 + .015 * Math.sin(t * 1.2));

    // foam
    const foamOn = S.foam > 0 && S.rinse > -3;
    foam.visible = foamOn;
    if (foamOn) {
      for (let i = 0; i < foamPts.length; i++) {
        const p = foamPts[i], grow = ss(p.t, p.t + .15, S.foam), off = clamp((p.x - S.rinse) / .5);
        const s = p.r * grow * (1 - off) * (1 + .08 * Math.sin(t * 2 + p.ph));
        dummy.position.set(p.x, p.y - off * .35, p.z); dummy.scale.setScalar(Math.max(s, 1e-5)); dummy.updateMatrix(); foam.setMatrixAt(i, dummy.matrix);
      }
      foam.instanceMatrix.needsUpdate = true;
    }
    // rinse curtain + spray
    const rinsing = S.rinse < 3 && S.rinse > -3 ? 1 : 0;
    curtain.material.uniforms.uOn.value += (rinsing - curtain.material.uniforms.uOn.value) * k; curtain.material.uniforms.uTime.value = t;
    curtain.position.x = S.rinse; curtain.visible = curtain.material.uniforms.uOn.value > .01;
    spray.material.opacity = curtain.material.uniforms.uOn.value * .8; spray.visible = spray.material.opacity > .01;
    if (spray.visible) {
      for (let i = 0; i < SPRAY; i++) { const [a, b, c] = spraySeed[i], q = (a + t * (.9 + b * .6)) % 1;
        const nz = (Math.floor(c * 7) - 3) * .34, ang = (b - .5) * .9;
        sprayPos[i * 3] = S.rinse + Math.sin(ang) * q * 1.1 + Math.sin(a * 40) * .02; sprayPos[i * 3 + 1] = 2.4 - q * 2.1 - q * q * .3; sprayPos[i * 3 + 2] = nz + Math.cos(ang * 3 + a * 9) * q * .22; }
      sprayGeo.attributes.position.needsUpdate = true;
    }
    // steam + UV scan
    steam.material.opacity = S.steam * .32; steam.visible = S.steam > .01;
    if (steam.visible) {
      for (let i = 0; i < STEAM; i++) { const [a, b, c] = steamSeed[i], q = (a + t * (.12 + b * .1)) % 1;
        steamPos[i * 3] = -.9 + b * 1.6 + Math.sin(q * 6 + c * 9) * .08; steamPos[i * 3 + 1] = .5 + q * .65; steamPos[i * 3 + 2] = (c - .5) * 1.1 + Math.cos(q * 5 + a * 7) * .06; }
      steamGeo.attributes.position.needsUpdate = true;
    }
    uvScan.material.uniforms.uOn.value = S.interior * .8; uvScan.material.uniforms.uTime.value = t; uvScan.visible = S.interior > .01;
    uvScan.position.x = Math.sin(t * .9) * .9;

    // rocks
    rockMesh.visible = S.rocks > .01;
    if (rockMesh.visible) {
      rocks.forEach((rk, i) => {
        const cyc = t * .7 + rk.ph, c = Math.floor(cyc), q = cyc - c;
        if (c !== rk.cycle) { rk.cycle = c; rk.hit = hitPts[Math.floor(Math.random() * hitPts.length)]; rk.from.set(6.5, .3 + Math.random() * .6, (Math.random() - .5) * 1.6); rk.done = false; }
        let p;
        if (q < .45) p = rk.from.clone().lerp(rk.hit, q / .45);
        else {
          if (!rk.done && S.rocks > .5) { rk.done = true; PU.uImp.value[impI].set(rk.hit.x, rk.hit.y, rk.hit.z, t); impI = (impI + 1) % 4; }
          const tt = q - .45; p = rk.hit.clone().add(new THREE.Vector3(2.2 * tt, 1.4 * tt - 4.5 * tt * tt, (rk.hit.z) * 1.2 * tt));
        }
        dummy.position.copy(p); dummy.rotation.set(t * 5 + i, t * 3, 0); dummy.scale.setScalar(S.rocks); dummy.updateMatrix(); rockMesh.setMatrixAt(i, dummy.matrix);
      });
      rockMesh.instanceMatrix.needsUpdate = true;
    }

    // cursor polish trail
    if (pointer && t - lastTrail > .035) {
      lastTrail = t; ndc.set(pointer[0] / window.innerWidth * 2 - 1, -(pointer[1] / window.innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, camera); const hit = ray.intersectObject(proxy, false)[0];
      if (hit) { PU.uTrail.value[trailI].set(hit.point.x, hit.point.y, hit.point.z, t); trailI = (trailI + 1) % TRAIL; canvas.dataset.hover = '1'; } else canvas.dataset.hover = '';
      pointer = null;
    }

    // adaptive quality: if frames run slow, drop resolution, then ambient occlusion
    perf.acc += dt; perf.n++;
    if (perf.n === 90) { const avg = perf.acc / perf.n; perf.acc = 0; perf.n = 0;
      if (avg > .026 && perf.level < 2) { perf.level++; if (perf.level === 1) renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)); if (perf.level === 2 && gtao) { gtao.enabled = false; renderer.setPixelRatio(1); } resize(); } }
    composer.render();
    if (firstFrame) { firstFrame(); firstFrame = null; }
  }
  requestAnimationFrame(frame);
  window.__vanta = { scene, glassMesh, bodyMesh, mats, camera, renderer, composer, S, perf };
  setWrap('#b0121a', 'gloss', true);
  return { ready, setWrap, setPointer, resize };
}
