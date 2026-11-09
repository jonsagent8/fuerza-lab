// Live wrap + tint for the turntable spin. The spin footage is a satin-white car with clear glass; every frame has a
// small mask (assets/frames/spin-mask: R = body paint, G = window glass, built by _hf/spin-masks.mjs). A WebGL pass
// recolors the paint and darkens the glass, so any wrap and any tint stay on the car while it turns.
const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
const FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D f0, f1, m0, m1;
uniform float mixv, finish, vlt, trim;   // trim: 0 keeps the red accents, 1 turns them gloss black   // finish: 0 gloss, 1 satin, 2 matte, 3 chrome, 4 pearl, 5 metallic; vlt: 0..1 (1 = no film)
uniform vec3 col;
void main(){
  vec3 a = texture2D(f0, uv).rgb, b = texture2D(f1, uv).rgb;
  vec3 base = mix(a, b, mixv);
  vec3 m = mix(texture2D(m0, uv).rgb, texture2D(m1, uv).rgb, mixv);
  float l = dot(base, vec3(.3, .59, .11));
  // shading of the white body: ~0.82 on a lit panel, darker in shade; highlights above that
  float s = clamp(l / .8, 0., 1.25);
  float hi = smoothstep(.78, 1., l);
  vec3 paint;
  if (finish < .5) {            // gloss: colour times shading, crisp highlights kept
    paint = col * pow(s, 1.25) * 1.05 + hi * .55 + pow(s, 6.) * .05;
  } else if (finish < 1.5) {    // satin: softer contrast, dull highlights
    paint = col * mix(.35, 1.1, s) + hi * .18;
  } else if (finish < 2.5) {    // matte: flat, almost no highlights
    paint = col * mix(.55, 1.05, s) + hi * .05;
  } else if (finish < 3.5) {    // chrome: a hard mirror curve with a cool tint
    float c = smoothstep(.18, .95, l); c = c * c * (3. - 2. * c);
    paint = mix(vec3(.05, .06, .08), vec3(1.02, 1.03, 1.06), c) * col / .82 + hi * .35;
  } else if (finish < 4.5) {    // pearl: white base with a faint colour shift from light to shade
    vec3 shade = mix(vec3(.80, .84, .92), vec3(1.0, .985, .96), smoothstep(.25, .9, s));
    paint = col * shade * mix(.55, 1.07, s) + hi * .35;
  } else {                      // metallic: gloss plus a sparkle lift in the mid tones
    paint = col * (pow(s, 1.35) * 1.05 + .18 * smoothstep(.3, .8, s)) + hi * .5;
  }
  vec3 o = mix(base, paint, m.r);
  // red trim (grille outline, splitter and skirt stripes) blacked out: dark, keeping a hint of its highlight
  float pk = max(base.r, max(base.g, base.b));
  float red = smoothstep(.04, .16, base.r - max(base.g, base.b));   // only pixels that really are red, inside the trim zone
  o = mix(o, vec3(.035) + smoothstep(.55, 1., pk) * .06, m.b * trim * red);
  // tint film: what is seen through the glass dims to the film's VLT; reflections on the outer surface stay
  vec3 refl = base * smoothstep(.35, .95, l) * .75;
  vec3 tinted = (base - refl) * vlt + refl * mix(.6, 1., vlt);
  o = mix(o, tinted, m.g);
  gl_FragColor = vec4(o, 1.);
}`;
const FINISH = { gloss: 0, satin: 1, matte: 2, chrome: 3, pearl: 4, metallic: 5 };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

export class Painter {
  constructor() {
    this.c = document.createElement('canvas');
    const gl = this.gl = this.c.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (!gl) return;
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = this.pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { this.gl = null; return; }
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {}; for (const n of ['f0', 'f1', 'm0', 'm1', 'mixv', 'finish', 'vlt', 'col', 'trim']) this.u[n] = gl.getUniformLocation(pr, n);
    ['f0', 'f1', 'm0', 'm1'].forEach((n, k) => gl.uniform1i(this.u[n], k));
    // one texture per unit; each remembers which bitmap it holds, so a frame is uploaded once, not every tick
    this.tex = [0, 1, 2, 3].map(() => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return { t, src: null }; });
    this.color = hex('#0b0b0e'); this.finish = 0; this.vlt = 1; this.trim = 0; this.key = '';
  }
  get ok() { return !!this.gl; }
  set(hexColor, finish, vlt, trim) {
    if (trim != null) this.trim = trim;
    if (hexColor) this.color = hex(hexColor);
    if (finish != null) this.finish = FINISH[finish] ?? 0;
    if (vlt != null) this.vlt = vlt;
  }
  bind(k, src) {
    const gl = this.gl, T = this.tex[k]; gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, T.t);
    if (T.src !== src) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src); T.src = src; }
  }
  // frames a/b (b may equal a), masks ma/mb, blend t: returns the canvas holding the painted picture
  draw(a, b, ma, mb, t) {
    const gl = this.gl;
    if (this.c.width !== a.width || this.c.height !== a.height) { this.c.width = a.width; this.c.height = a.height; gl.viewport(0, 0, a.width, a.height); this.key = ''; }
    const key = [a, b, ma, mb].map(x => this.id(x)).join() + `|${t.toFixed(3)}|${this.color}|${this.finish}|${this.vlt.toFixed(3)}|${this.trim.toFixed(3)}`;
    if (key === this.key) return this.c;
    this.key = key;
    this.bind(0, a); this.bind(1, b); this.bind(2, ma); this.bind(3, mb);
    gl.uniform1f(this.u.mixv, t); gl.uniform1f(this.u.finish, this.finish); gl.uniform1f(this.u.vlt, this.vlt); gl.uniform1f(this.u.trim, this.trim); gl.uniform3fv(this.u.col, this.color);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.c;
  }
  id(x) { return x.__pid || (x.__pid = ++Painter.n); }
}
Painter.n = 0;
