// Live window tint (and colour cross-fades) for the turntable spin. Every wrap colour has its own rendered spin
// (assets/frames/spin-<colour>), so the paint, reflections and lighting are real footage; this WebGL pass only
//  - darkens the window glass to the picked film (per-frame glass mask, G channel, from _hf/glass-transfer.mjs): the
//    windshield (R channel, a clean four-cornered outline from _hf/ws-quad.mjs) takes its own shade, the rest the side shade,
//  - blends two pictures while one colour fades into the next.
// With no film and no fade the stage draws the plain frame and this never runs.
const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
const FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D f0, f1, m0, m1;
uniform float mixv, vlt, wvlt;   // mixv: 0 = picture A, 1 = picture B; vlt: side/rear film, wvlt: windshield film (0..1, 1 = no film)
uniform vec2 px;   // one mask texel
// how much of this pixel is windshield: the outline grown by ~3 px so its edge reaches the pillars (the film only
// lands on glass anyway, G channel), never past them into a door window
float front(sampler2D m){
  float w = texture2D(m, uv).r;
  for (int k = 0; k < 8; k++) { float a = float(k) * .785398; w = max(w, texture2D(m, uv + vec2(cos(a), sin(a)) * px * 3.).r); }
  return w;
}
vec3 tint(vec3 base, vec2 m, float w){
  float v = mix(vlt, wvlt, w);
  // what is seen through the glass dims to the film's VLT; reflections on the outer surface stay
  float l = dot(base, vec3(.3, .59, .11));
  vec3 refl = base * smoothstep(.35, .95, l) * .75;
  // light films read nearly clear and dark ones near black, so the steps show even on a phone-sized car
  float T = min(1., v * (1. + .5 * v));   // the film's transmission (no film = the plain glass, never brighter)
  return mix(base, (base - refl) * T + refl * mix(.6, 1., v), m.y);
}
void main(){
  vec3 a = tint(texture2D(f0, uv).rgb, texture2D(m0, uv).rg, front(m0));
  vec3 b = tint(texture2D(f1, uv).rgb, texture2D(m1, uv).rg, front(m1));
  gl_FragColor = vec4(mix(a, b, mixv), 1.);
}`;

export class Painter {
  constructor() {
    this.c = document.createElement('canvas');
    const gl = this.gl = this.c.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (!gl) return;
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { this.gl = null; return; }
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {}; for (const n of ['f0', 'f1', 'm0', 'm1', 'mixv', 'vlt', 'wvlt', 'px']) this.u[n] = gl.getUniformLocation(pr, n);
    ['f0', 'f1', 'm0', 'm1'].forEach((n, k) => gl.uniform1i(this.u[n], k));
    // one texture per unit; each remembers which bitmap it holds, so a frame is uploaded once, not every tick
    this.tex = [0, 1, 2, 3].map(() => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return { t, src: null }; });
    this.key = '';
  }
  get ok() { return !!this.gl; }
  bind(k, src) {
    const gl = this.gl, T = this.tex[k]; gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, T.t);
    if (T.src !== src) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src); T.src = src; }
  }
  // pictures a/b with their glass masks ma/mb (null = no glass known: that side gets no film), blend t, side film vlt,
  // windshield film wvlt
  draw(a, b, ma, mb, t, vlt, wvlt = 1) {
    const gl = this.gl;
    if (this.c.width !== a.width || this.c.height !== a.height) { this.c.width = a.width; this.c.height = a.height; gl.viewport(0, 0, a.width, a.height); this.key = ''; }
    const key = [a, b, ma, mb].map(x => x ? this.id(x) : 0).join() + `|${t.toFixed(3)}|${vlt.toFixed(3)}|${wvlt.toFixed(3)}`;
    if (key === this.key) return this.c;
    this.key = key;
    this.bind(0, a); this.bind(1, b); this.bind(2, ma || this.blank()); this.bind(3, mb || this.blank());
    gl.uniform1f(this.u.mixv, t); gl.uniform1f(this.u.vlt, vlt); gl.uniform1f(this.u.wvlt, wvlt); const mw = (ma || mb || {}).width || 800, mh = (ma || mb || {}).height || 450; gl.uniform2f(this.u.px, 1 / mw, 1 / mh);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.c;
  }
  blank() { if (!this._b) { this._b = document.createElement('canvas'); this._b.width = this._b.height = 2; this._b.getContext('2d').fillRect(0, 0, 2, 2); } return this._b; }
  id(x) { return x.__pid || (x.__pid = ++Painter.n); }
}
Painter.n = 0;
