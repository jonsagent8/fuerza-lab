// Spinnable 3D sedan for the tint + wrap scenes (three.js). The model (assets/build/car.glb) was generated from four
// light-silver views of our sedan, so its texture tells paint (light, grey), glass/trim (dark) and accents (red) apart.
// The shader recolors only the paint, lays a new wrap front to back, darkens the glass top to bottom for tint, and
// renders into an offscreen canvas that the 2D stage draws like any clip frame.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const lin = hex => new THREE.Color(hex);   // three converts hex (sRGB) to linear
// paint finishes: color, roughness, metalness, clearcoat
export const FINISH = {
  factory:  { c: 0x0b0b0e, r: .16, m: .1,  cc: 1 },
  red:      { c: 0xb0121a, r: .14, m: .05, cc: 1 },
  blue:     { c: 0x1f4fa8, r: .26, m: .55, cc: 1 },
  graphite: { c: 0x3a3f47, r: .45, m: .25, cc: .25 },
  pearl:    { c: 0xe6ebf0, r: .16, m: .2,  cc: 1 },
  chrome:   { c: 0xe8ecf2, r: .06, m: 1,   cc: 1 },
  matte:    { c: 0x16181c, r: .82, m: 0,   cc: 0 },
};
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
// film per VLT (same curve as the side-photo version): 0 = clear glass, 1 = limo black
const filmK = v => (v == null ? 0 : Math.min(1, .25 + .75 * ss(0, 1, (70 - v) / 65)));

// model space after load(): centred, 4.6 m long, front at +z, ground at y = GROUND
const SCALE = 4, GROUND = -.812;
const GLASS = [.13, .82];                 // glass band, bottom (beltline) to top (roof edge), y in model space
const WHEELS = [[1.48, -.46], [-1.24, -.46]], WHEEL_R = .37;   // [z, y] centres, radius
const BADGE = [0, .23, 1.83, .1];         // a badge-like mark the 3D engine invented on the hood: painted over

export class Car3D {
  constructor({ w = 1600, h = 900 } = {}) {
    this.w = w; this.h = h;
    const r = this.r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1); r.setSize(w, h, false);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
    this.c = r.domElement;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(24, w / h, .1, 100);
    this.cam.position.set(11.8, 2.15, 0); this.cam.lookAt(0, -.05, 0);
    if (h > w * .5 && w < 1500) this.cam.fov = 20;   // phones: frame the car tighter
    this.cam.updateProjectionMatrix();
    this.shift = 0; this.shiftTo = 0;                 // slide the car sideways, out from under the text panel
    this.yaw = .5; this.vel = 0; this.drag = false; this.idleAt = 0;
    this.U = {
      uFrom: { value: lin(FINISH.factory.c) }, uTo: { value: lin(FINISH.factory.c) },
      uFromF: { value: new THREE.Vector3(FINISH.factory.r, FINISH.factory.m, FINISH.factory.cc) },
      uToF: { value: new THREE.Vector3(FINISH.factory.r, FINISH.factory.m, FINISH.factory.cc) },
      uWipe: { value: 1 }, uTintA: { value: 0 }, uTintB: { value: 0 }, uSq: { value: 1 },
      uMirror: { value: 0 },
    };
  }

  async load() {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const [gltf, bay] = await Promise.all([loader.loadAsync('assets/build/car.glb'), new THREE.TextureLoader().loadAsync('assets/build/bay.webp')]);
    bay.colorSpace = THREE.SRGBColorSpace; this.scene.background = bay;
    this.scene.environment = this.envMap();
    let mesh; gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    gltf.scene.updateMatrixWorld(true);
    // the compressed model stores quantized (normalized int) attributes; transforming those in place clamps them,
    // so copy everything to plain floats first
    const geo = new THREE.BufferGeometry();
    for (const [k, at] of Object.entries(mesh.geometry.attributes)) {
      const f = new Float32Array(at.count * at.itemSize);
      for (let i = 0; i < at.count; i++) for (let c = 0; c < at.itemSize; c++) f[i * at.itemSize + c] = at.getComponent ? at.getComponent(i, c) : [at.getX(i), at.getY(i), at.getZ(i), at.getW(i)][c];
      geo.setAttribute(k, new THREE.BufferAttribute(f, at.itemSize));
    }
    if (mesh.geometry.index) geo.setIndex(mesh.geometry.index);
    geo.applyMatrix4(mesh.matrixWorld);
    geo.computeBoundingBox(); const c = geo.boundingBox.getCenter(new THREE.Vector3());
    geo.translate(-c.x, -c.y, -c.z); geo.scale(SCALE, SCALE, SCALE);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const src = mesh.material;
    this.car = new THREE.Group();
    this.car.add(new THREE.Mesh(geo, this.material(src, false)));
    // wet-floor reflection: the same car mirrored under the ground, faded with depth
    const mirror = new THREE.Mesh(geo, this.material(src, true));
    mirror.scale.y = -1; mirror.position.y = 2 * GROUND;
    this.car.add(mirror);
    this.car.add(this.shadow());
    this.scene.add(this.car);
    this.dirty = true; this.ready = true;
  }

  // a dark bay for reflections: black room, angled white light bars overhead, red neon strips on the walls
  envMap() {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 14, 40), new THREE.MeshBasicMaterial({ color: 0x050506, side: THREE.BackSide })));
    const white = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 9, 9) }), red = new THREE.MeshBasicMaterial({ color: new THREE.Color(7, .25, .3) });
    for (let i = -3; i <= 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.5, .2, 9), white); b.position.set(i * 3.2, 6.6, 0); b.rotation.y = .5 * (i % 2 ? 1 : -1); env.add(b); }
    for (const z of [-19.5, 19.5]) { const s = new THREE.Mesh(new THREE.BoxGeometry(40, .12, .12), red); s.position.set(0, 1.2, z); env.add(s); const s2 = s.clone(); s2.position.y = -.9; env.add(s2); }
    for (const x of [-19.5, 19.5]) { const s = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, 40), red); s.position.set(x, 1.2, 0); env.add(s); }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x0a0a0c })); floor.rotation.x = -Math.PI / 2; floor.position.y = -1; env.add(floor);
    // a big soft overhead box and a faint grey horizon band give chrome and gloss something to reflect
    const soft = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.3), side: THREE.DoubleSide }));
    soft.rotation.x = Math.PI / 2; soft.position.y = 6.4; env.add(soft);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 3.5, 48, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(.3, .3, .33), side: THREE.BackSide }));
    band.position.y = 1.4; env.add(band);
    const pm = new THREE.PMREMGenerator(this.r), t = pm.fromScene(env, .02).texture; pm.dispose();
    return t;
  }

  shadow() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(.6, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = GROUND + .005; m.renderOrder = 1;
    return m;
  }

  material(src, mirror) {
    const m = new THREE.MeshPhysicalMaterial({ map: src.map, normalMap: src.normalMap || null, roughness: .55, metalness: 0, clearcoat: .2, clearcoatRoughness: .08, envMapIntensity: 1.25 });
    if (mirror) { m.transparent = true; m.depthWrite = false; }
    (this.mats || (this.mats = [])).push(m);
    const U = this.U;
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U, { uIsMirror: { value: mirror ? 1 : 0 } });
      sh.vertexShader = 'varying vec3 vLocal; varying vec3 vNrm;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLocal = position; vNrm = normal;');
      sh.fragmentShader = `varying vec3 vLocal; varying vec3 vNrm;
uniform vec3 uFrom, uTo, uFromF, uToF; uniform float uWipe, uTintA, uTintB, uSq, uIsMirror;
float sstep(float a, float b, float x) { return smoothstep(a, b, x); }
` + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
  vec3 srgb = pow(max(diffuseColor.rgb, vec3(0.)), vec3(1. / 2.2));
  float L = dot(srgb, vec3(.3333)), S = max(max(srgb.r, srgb.g), srgb.b) - min(min(srgb.r, srgb.g), srgb.b);
  // paint = the light grey of the source model; a hood mark the generator invented counts as paint too
  float paintM = sstep(.47, .6, L) * (1. - sstep(.1, .2, S));
  float badge = 1. - sstep(${BADGE[3] * .6}, ${BADGE[3].toFixed(3)}, distance(vLocal, vec3(${BADGE[0]}., ${BADGE[1]}, ${BADGE[2]})));
  paintM = max(paintM, badge); L = mix(L, .8, badge);
  // glass: dark texels above the beltline, inside the body's width
  // glass by shape: above the beltline and not facing straight up (the roof, hood and trunk lid face up and stay paint)
  float glassM = sstep(${GLASS[0] - .03}, ${GLASS[0] + .03}, vLocal.y) * (1. - sstep(.72, .84, normalize(vNrm).y)) * (1. - sstep(.25, .45, S));
  paintM *= 1. - glassM;
  // hood, roof and trunk lid (facing up, below the glass band top or on the roof): all paint, smoothing out marks the
  // generator baked in (a dark wedge down the hood); the grille and intakes face forward so they keep their texture
  float up = sstep(.78, .9, normalize(vNrm).y) * (1. - glassM);
  L = mix(L, max(L, .74), up); paintM = max(paintM, up);
  // wheels: the generator smeared caliper red over the spokes; keep red only in the caliper zone (inner ring, upper half)
  float wheelM = 0.; float caliper = 0.;
  ${WHEELS.map(([z, y]) => `{ vec2 d = vec2(vLocal.z - ${z.toFixed(3)}, vLocal.y - (${y.toFixed(3)})); float rr = length(d) / ${WHEEL_R.toFixed(3)};
    float on = (1. - sstep(.95, 1.02, rr)) * sstep(.75, .95, abs(vLocal.x));
    wheelM = max(wheelM, on); caliper = max(caliper, on * (1. - sstep(.62, .72, rr)) * sstep(.1, .3, rr) * sstep(-.15, .1, d.y / ${WHEEL_R.toFixed(3)})); }`).join('\n  ')}
  float redness = sstep(.15, .35, srgb.r - max(srgb.g, srgb.b));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.018, .019, .021) * (.6 + L), wheelM * redness * (1. - caliper));
  paintM *= 1. - wheelM;
  // wrap: new color laid from the front bumper (+z) to the rear
  float edge = mix(2.75, -2.75, uWipe);
  float w = sstep(edge - .05, edge + .05, vLocal.z);              // 1 = new wrap already here
  vec3 col = mix(uFrom, uTo, w); vec3 fin = mix(uFromF, uToF, w);
  float shade = clamp(L / .78, 0., 1.2);
  shade = mix(shade, 1., fin.y * .6);                             // metallic / chrome: let reflections carry the shape
  diffuseColor.rgb = mix(diffuseColor.rgb, col * shade, paintM);
  float sheen = paintM * (1. - sstep(0., .12, abs(vLocal.z - edge))) * step(.001, uWipe) * step(uWipe, .999);
  // tint: new film above the squeegee line, previous film below it
  float yl = mix(${(GLASS[1] + .05).toFixed(3)}, ${(GLASS[0] - .05).toFixed(3)}, uSq);
  float k = mix(uTintA, uTintB, step(yl, vLocal.y));
  vec3 glassCol = mix(vec3(.05, .055, .065), vec3(.002), k);
  diffuseColor.rgb = mix(diffuseColor.rgb, glassCol, glassM);
  float glint = glassM * (1. - sstep(0., .025, abs(vLocal.y - yl))) * step(.001, uSq) * step(uSq, .999);
  if (uIsMirror > .5) diffuseColor.a *= .32 * (1. - sstep(-.8, .55, vLocal.y));`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, fin.x, paintM); roughnessFactor = mix(roughnessFactor, .04, glassM);`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor = mix(metalnessFactor, fin.y, paintM); metalnessFactor = mix(metalnessFactor, 0., glassM);`)
        .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
  material.clearcoat = mix(material.clearcoat, fin.z, paintM); material.clearcoat = mix(material.clearcoat, 1., glassM);`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
  gl_FragColor.rgb += vec3(1.) * (sheen * .35 + glint * .8);
  // chrome: a soft studio horizon and overhead glow in the reflection, so the mirror finish reads as chrome
  vec3 rv = inverseTransformDirection(reflect(-normalize(vViewPosition), normal), viewMatrix);
  float chromeAmt = paintM * sstep(.8, 1., fin.y);
  float hz = sstep(-.25, 0., rv.y) * (1. - sstep(.05, .35, rv.y));
  gl_FragColor.rgb += chromeAmt * (vec3(.62, .64, .7) * hz + vec3(.35, .36, .4) * sstep(.35, .9, rv.y) + vec3(.5, .05, .06) * (1. - sstep(-.6, -.2, rv.y)) * .35);`);
    };
    return m;
  }

  // ---- state ----
  setColor(from, to, wipe) {
    const a = FINISH[from] || FINISH.factory, b = FINISH[to] || FINISH.factory;
    this.U.uFrom.value.set(a.c); this.U.uTo.value.set(b.c);
    this.U.uFromF.value.set(a.r, a.m, a.cc); this.U.uToF.value.set(b.r, b.m, b.cc);
    this.U.uWipe.value = wipe; this.dirty = true;
    // chrome only reads as chrome with strong reflections; ease the reflection strength with the wipe
    const e = k => (k === 'chrome' ? 2.6 : 1.25), ei = e(from) + (e(to) - e(from)) * wipe;
    for (const m of this.mats || []) m.envMapIntensity = ei;
  }
  setTint(from, to, sq) { this.U.uTintA.value = filmK(from); this.U.uTintB.value = filmK(to); this.U.uSq.value = sq; this.dirty = true; }
  spin(dx) { this.yaw += dx; this.vel = dx; this.idleAt = performance.now(); this.dirty = true; }
  release() { this.drag = false; this.idleAt = performance.now(); }

  render() {
    if (!this.ready) return null;
    const now = performance.now(), dt = Math.min(.05, (now - (this.t || now)) / 1000); this.t = now;
    if (!this.drag) {
      // fling inertia, then a slow showroom turn once the visitor lets go for a few seconds
      if (Math.abs(this.vel) > 1e-4) { this.yaw += this.vel; this.vel *= Math.pow(.05, dt); this.dirty = true; }
      else if (now - this.idleAt > 3500) { this.yaw += dt * .22; this.dirty = true; }
    }
    if (Math.abs(this.shiftTo - this.shift) > 1e-4) { this.shift += (this.shiftTo - this.shift) * Math.min(1, dt * 4); this.dirty = true; }
    if (!this.dirty) return this.c;
    this.cam.setViewOffset(this.w, this.h, -this.shift * this.w, 0, this.w, this.h);
    this.car.rotation.y = this.yaw;
    this.r.render(this.scene, this.cam);
    this.dirty = false;
    return this.c;
  }
}
