// Cursor + 2D interactive pieces. Each export is self-contained and safe to skip.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const rnd = (a, b) => a + Math.random() * (b - a);

function fitCanvas(c, dprMax = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, dprMax), r = c.getBoundingClientRect();
  c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
  return { w: r.width, h: r.height, dpr };
}
function whenVisible(el, cb) {
  const io = new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting)), { rootMargin: '100px' }); io.observe(el);
}

/* ---------------- soap bubbles that trail the cursor ---------------- */
export function bubbles(canvas) {
  const g = canvas.getContext('2d'); let size, last = null, acc = 0, t0 = performance.now();
  const B = [], P = [];
  const resize = () => { size = fitCanvas(canvas, 1.5); g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0); };
  resize(); window.addEventListener('resize', resize);
  const spawn = (x, y, r, vx = 0, vy = 0) => { if (B.length > 150) return; B.push({ x, y, r, vx: vx + rnd(-12, 12), vy: vy + rnd(-30, -8), life: 0, max: rnd(1.6, 3.6), ph: rnd(0, 6.28), hue: rnd(0, 360) }); };
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    if (last) { const dx = e.clientX - last.x, dy = e.clientY - last.y, d = Math.hypot(dx, dy); acc += d;
      while (acc > 34) { acc -= 34; spawn(e.clientX + rnd(-8, 8), e.clientY + rnd(-8, 8), rnd(3, 13) * (Math.random() < .12 ? 1.8 : 1), -dx * .8, -dy * .8); } }
    last = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  window.addEventListener('pointerdown', e => { for (let i = 0; i < 12; i++) spawn(e.clientX + rnd(-20, 20), e.clientY + rnd(-20, 20), rnd(5, 22), rnd(-120, 120), rnd(-160, 40)); }, { passive: true });

  function drawBubble(b, a) {
    const { x, y, r } = b;
    const body = g.createRadialGradient(x - r * .25, y - r * .25, r * .1, x, y, r);
    body.addColorStop(0, 'rgba(255,255,255,0.02)'); body.addColorStop(.72, `hsla(${b.hue},90%,70%,${.05 * a})`);
    body.addColorStop(.93, `hsla(${b.hue + 70},100%,75%,${.32 * a})`); body.addColorStop(1, `hsla(${b.hue + 140},100%,80%,0)`);
    g.fillStyle = body; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    if (g.createConicGradient) {
      const cg = g.createConicGradient(b.ph + b.life, x, y);
      [0, .25, .5, .75, 1].forEach((s, i) => cg.addColorStop(s, `hsla(${(b.hue + i * 90) % 360},100%,72%,${.55 * a})`));
      g.strokeStyle = cg; g.lineWidth = Math.max(.6, r * .07); g.beginPath(); g.arc(x, y, r * .97, 0, 6.2832); g.stroke();
    }
    g.fillStyle = `rgba(255,255,255,${.75 * a})`; g.beginPath(); g.ellipse(x - r * .38, y - r * .4, r * .22, r * .12, -.7, 0, 6.2832); g.fill();
    g.fillStyle = `rgba(255,255,255,${.25 * a})`; g.beginPath(); g.arc(x + r * .42, y + r * .38, r * .08, 0, 6.2832); g.fill();
  }
  (function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - t0) / 1000); t0 = now;
    g.clearRect(0, 0, size.w, size.h);
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i]; b.life += dt; b.vx *= .96; b.vy = b.vy * .97 - 12 * dt;
      b.x += (b.vx + Math.sin(b.life * 3 + b.ph) * 14) * dt; b.y += b.vy * dt;
      const a = Math.min(1, b.life * 6) * (b.life > b.max - .2 ? (b.max - b.life) / .2 : 1);
      if (b.life >= b.max) { P.push({ x: b.x, y: b.y, r: b.r, t: 0, hue: b.hue }); B.splice(i, 1); continue; }
      drawBubble(b, a);
    }
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.t += dt; const k = p.t / .28; if (k >= 1) { P.splice(i, 1); continue; }
      g.strokeStyle = `hsla(${p.hue},100%,80%,${.6 * (1 - k)})`; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, p.r * (1 + k * .8), 0, 6.2832); g.stroke();
      g.fillStyle = `rgba(220,250,255,${.8 * (1 - k)})`;
      for (let j = 0; j < 6; j++) { const an = j / 6 * 6.2832 + p.r; g.beginPath(); g.arc(p.x + Math.cos(an) * p.r * (1 + k * 1.6), p.y + Math.sin(an) * p.r * (1 + k * 1.6), 1.2, 0, 6.2832); g.fill(); }
    }
  })(t0);
}

/* ---------------- custom cursor ---------------- */
export function cursor(el, label, gl) {
  document.documentElement.classList.add('has-cursor');
  const ring = el.querySelector('.cursor__ring'), dot = el.querySelector('.cursor__dot');
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, hoverEl = null;
  window.addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    const t = e.target.closest && e.target.closest('a, button, label, input, textarea, [data-cursor]');
    hoverEl = t;
  }, { passive: true });
  window.addEventListener('pointerdown', () => el.classList.add('is-down'));
  window.addEventListener('pointerup', () => el.classList.remove('is-down'));
  document.addEventListener('mouseleave', () => (el.style.opacity = 0));
  document.addEventListener('mouseenter', () => (el.style.opacity = 1));
  (function loop() {
    requestAnimationFrame(loop);
    rx += (x - rx) * .2; ry += (y - ry) * .2;
    dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    label.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    const txt = hoverEl ? (hoverEl.dataset.cursor || '') : (gl && gl.dataset.hover && !document.body.classList.contains('past-showcase') ? 'Polish' : '');
    const on = !!hoverEl || !!txt;
    el.classList.toggle('is-hover', on);
    if (label.textContent !== txt) label.textContent = txt;
  })();
}

/* ---------------- magnetic buttons ---------------- */
export function magnetic(els) {
  els.forEach(el => {
    const inner = el.querySelector('span');
    el.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: dx * .3, y: dy * .4, duration: .5, ease: 'power3.out' });
      if (inner) gsap.to(inner, { x: dx * .12, y: dy * .15, duration: .5, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => { gsap.to([el, inner].filter(Boolean), { x: 0, y: 0, duration: .9, ease: 'elastic.out(1, .35)' }); });
  });
}

/* ---------------- 3D tilt + spotlight ---------------- */
export function tilt(els) {
  els.forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', px * 100 + '%'); el.style.setProperty('--my', py * 100 + '%');
      if (e.pointerType === 'mouse') gsap.to(el, { rotateY: (px - .5) * 12, rotateX: (.5 - py) * 10, transformPerspective: 900, duration: .5, ease: 'power2.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { rotateX: 0, rotateY: 0, duration: .8, ease: 'power3.out' }));
  });
}

/* ---------------- text: split + scramble ---------------- */
export function split(el) {
  if (el.dataset.done) return el.querySelectorAll('.w > span');
  el.dataset.done = 1;
  const words = el.textContent.trim().split(/\s+/);
  const film = el.classList.contains('film-text'); if (film) el.classList.remove('film-text');
  el.innerHTML = words.map(w => `<span class="w"><span${film ? ' class="film-text"' : ''}>${w}</span></span>`).join(' ');
  return el.querySelectorAll('.w > span');
}
export function scramble(el, dur = 1.1) {
  const final = el.dataset.text || (el.dataset.text = el.textContent), chars = '!<>-_\\/[]{}=+*^?#ABCDEFX0123456789';
  const start = performance.now();
  (function step(now) {
    const k = clamp((now - start) / (dur * 1000));
    el.textContent = [...final].map((ch, i) => (ch === ' ' || ch === '·') ? ch : (i / final.length < k ? ch : chars[(Math.random() * chars.length) | 0])).join('');
    if (k < 1) requestAnimationFrame(step); else el.textContent = final;
  })(start);
}

/* ---------------- swirl marks before/after ---------------- */
export function compare(wrap, canvas, handle) {
  const g = canvas.getContext('2d'); let size, pos = .5, drag = false, vis = false, dirty = true, idle = 0;
  const light = { x: .42, y: .36, tx: .42, ty: .36 };
  const SCR = Array.from({ length: 1100 }, () => ({ x: Math.random(), y: Math.random(), len: rnd(18, 90), w: rnd(.5, 1.1), holo: Math.random() < .3 }));
  const flake = document.createElement('canvas'); flake.width = flake.height = 256;
  { const f = flake.getContext('2d'), d = f.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() < .04 ? rnd(80, 200) : rnd(0, 18); d.data[i] = v * .8; d.data[i + 1] = v * .9; d.data[i + 2] = v; d.data[i + 3] = 40; } f.putImageData(d, 0, 0); }
  const resize = () => { size = fitCanvas(canvas); g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0); dirty = true; };
  resize(); window.addEventListener('resize', resize);
  const setPos = cx => { const r = wrap.getBoundingClientRect(); pos = clamp((cx - r.left) / r.width, .02, .98); handle.style.setProperty('--x', pos * 100 + '%'); dirty = true; };
  wrap.addEventListener('pointerdown', e => { drag = true; wrap.setPointerCapture(e.pointerId); setPos(e.clientX); });
  wrap.addEventListener('pointerup', () => (drag = false)); wrap.addEventListener('pointercancel', () => (drag = false));
  wrap.addEventListener('pointermove', e => {
    if (drag) setPos(e.clientX);
    const r = wrap.getBoundingClientRect(); light.tx = (e.clientX - r.left) / r.width; light.ty = (e.clientY - r.top) / r.height; idle = 0;
  });
  handle.tabIndex = 0; handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', 'Before and after divider');
  handle.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { pos = clamp(pos + (e.key === 'ArrowLeft' ? -.04 : .04), .02, .98); handle.style.setProperty('--x', pos * 100 + '%'); dirty = true; e.preventDefault(); } });
  whenVisible(wrap, v => (vis = v));

  function paint(swirled) {
    const { w, h } = size, lx = light.x * w, ly = light.y * h;
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#141416'); bg.addColorStop(.55, '#09090a'); bg.addColorStop(1, '#18181b');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.globalAlpha = swirled ? .5 : .9; g.fillStyle = g.createPattern(flake, 'repeat'); g.fillRect(0, 0, w, h); g.globalAlpha = 1;
    // horizon reflection of the studio wall
    const hz = g.createLinearGradient(0, h * .58, 0, h * .7); hz.addColorStop(0, 'rgba(120,150,210,0)'); hz.addColorStop(.5, swirled ? 'rgba(120,150,210,.10)' : 'rgba(150,180,240,.22)'); hz.addColorStop(1, 'rgba(120,150,210,0)');
    g.fillStyle = hz; g.fillRect(0, h * .58, w, h * .12);
    // softbox
    const bw = w * .2, bh = h * .14;
    const gl = g.createRadialGradient(lx, ly, 0, lx, ly, w * (swirled ? .34 : .22)); gl.addColorStop(0, swirled ? 'rgba(200,215,255,.28)' : 'rgba(200,215,255,.14)'); gl.addColorStop(1, 'rgba(200,215,255,0)');
    g.fillStyle = gl; g.fillRect(0, 0, w, h);
    if (swirled) { for (let i = 4; i > 0; i--) { g.fillStyle = `rgba(235,240,255,${.07})`; g.beginPath(); g.roundRect(lx - bw / 2 - i * 6, ly - bh / 2 - i * 6, bw + i * 12, bh + i * 12, 14 + i * 6); g.fill(); } }
    g.fillStyle = swirled ? 'rgba(240,244,255,.75)' : '#f6f8ff'; g.beginPath(); g.roundRect(lx - bw / 2, ly - bh / 2, bw, bh, 10); g.fill();
    if (!swirled) { g.strokeStyle = 'rgba(94,242,255,.5)'; g.lineWidth = 1; g.beginPath(); g.roundRect(lx - bw / 2 - 3, ly - bh / 2 - 3, bw + 6, bh + 6, 12); g.stroke(); }
    if (swirled) {
      for (const s of SCR) {
        const x = s.x * w, y = s.y * h, dx = x - lx, dy = y - ly, d = Math.hypot(dx, dy); if (d < 30) continue;
        const v = Math.exp(-d / (w * .3)); if (v < .03) continue;
        const a = Math.atan2(dy, dx), span = s.len / d;
        g.strokeStyle = s.holo ? `hsla(${(a * 57.3 + 360) % 360},80%,78%,${.75 * v})` : `rgba(255,255,255,${.8 * v})`;
        g.lineWidth = s.w; g.beginPath(); g.arc(lx, ly, d, a - span / 2, a + span / 2); g.stroke();
      }
    }
  }
  let t = 0;
  (function loop() {
    requestAnimationFrame(loop);
    if (!vis) return;
    t += .016; idle += .016;
    if (idle > 2.5) { light.tx = .5 + Math.cos(t * .35) * .22; light.ty = .38 + Math.sin(t * .5) * .12; }
    const nx = light.x + (light.tx - light.x) * .08, ny = light.y + (light.ty - light.y) * .08;
    if (Math.abs(nx - light.x) + Math.abs(ny - light.y) > .0004) dirty = true;
    light.x = nx; light.y = ny;
    if (!dirty) return; dirty = false;
    const { w, h } = size;
    paint(false);
    g.save(); g.beginPath(); g.rect(0, 0, w * pos, h); g.clip(); paint(true); g.restore();
  })();
}

/* ---------------- self-healing film scratch pad ---------------- */
export function heal(pad, canvas, tempEl) {
  const g = canvas.getContext('2d'); let size, vis = false, cur = null, ptr = null, lastUser = -9, autoAt = 1.5, t = 0;
  const strokes = [];
  const resize = () => { size = fitCanvas(canvas); g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0); };
  resize(); window.addEventListener('resize', resize);
  whenVisible(pad, v => (vis = v));
  const local = e => { const r = pad.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); cur = { pts: [local(e)], end: Infinity }; strokes.push(cur); lastUser = t; });
  pad.addEventListener('pointermove', e => { ptr = local(e); if (cur) { const p = local(e), q = cur.pts[cur.pts.length - 1]; if (Math.hypot(p.x - q.x, p.y - q.y) > 3) cur.pts.push(p); } });
  const end = () => { if (cur) { cur.end = t; cur = null; } };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end); pad.addEventListener('pointerleave', () => (ptr = null));

  function autoScratch() {
    const { w, h } = size, x0 = rnd(.15, .45) * w, y0 = rnd(.25, .75) * h, len = rnd(.3, .45) * w, ang = rnd(-.5, .5), pts = [];
    for (let i = 0; i <= 26; i++) { const k = i / 26; pts.push({ x: x0 + Math.cos(ang) * len * k, y: y0 + Math.sin(ang) * len * k + Math.sin(k * 7) * 6 }); }
    strokes.push({ pts, end: t, born: t, auto: true });
  }
  const hexPath = (cx, cy, r) => { g.moveTo(cx + r, cy); for (let k = 1; k <= 6; k++) g.lineTo(cx + r * Math.cos(k * Math.PI / 3), cy + r * Math.sin(k * Math.PI / 3)); };
  (function loop() {
    requestAnimationFrame(loop);
    if (!vis) return;
    t += .016;
    const { w, h } = size;
    if (t - lastUser > 6 && t > autoAt) { autoScratch(); autoAt = t + 4.5; }
    // paint: deep teal metallic with a slow moving highlight
    const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#2a0b0d'); bg.addColorStop(.5, '#140607'); bg.addColorStop(1, '#33100f');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const hx = w * (.5 + Math.sin(t * .3) * .35), band = g.createLinearGradient(hx - w * .3, 0, hx + w * .3, h);
    band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(.5, 'rgba(200,250,255,.12)'); band.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = band; g.fillRect(0, 0, w, h);
    // hex film revealed near the cursor
    if (ptr) {
      g.save(); const mask = g.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, 160);
      mask.addColorStop(0, 'rgba(94,242,255,.35)'); mask.addColorStop(1, 'rgba(94,242,255,0)');
      g.strokeStyle = mask; g.lineWidth = 1; g.beginPath();
      const r = 16, dx = r * 1.5, dy = r * Math.sqrt(3);
      for (let cx = ptr.x - 180 - ((ptr.x - 180) % dx); cx < ptr.x + 180; cx += dx) {
        const col = Math.round(cx / dx); for (let cy = ptr.y - 180 - ((ptr.y - 180) % dy) + (col % 2 ? dy / 2 : 0); cy < ptr.y + 180; cy += dy) hexPath(cx, cy, r);
      }
      g.stroke(); g.restore();
    }
    // scratches
    let maxHeat = 0;
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i], age = t - s.end, hk = clamp((age - .7) / 2.4);
      if (hk >= 1) { strokes.splice(i, 1); continue; }
      let pts = s.pts; if (s.auto) { const n = Math.ceil(pts.length * clamp((t - s.born) / .45)); pts = pts.slice(0, Math.max(2, n)); }
      if (pts.length < 2) continue;
      const heat = age > .5 ? Math.sin(Math.PI * clamp((age - .5) / 2.6)) : 0; maxHeat = Math.max(maxHeat, heat);
      const path = () => { g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let j = 1; j < pts.length; j++) g.lineTo(pts[j].x, pts[j].y); };
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (heat > 0) { g.strokeStyle = `rgba(255,170,80,${.22 * heat})`; g.lineWidth = 22; path(); g.stroke(); g.strokeStyle = `rgba(255,210,140,${.35 * heat})`; g.lineWidth = 8; path(); g.stroke(); }
      g.strokeStyle = `rgba(0,0,0,${.7 * (1 - hk)})`; g.lineWidth = 3 * (1 - hk * .7); path(); g.stroke();
      g.save(); g.translate(-1, -1); g.strokeStyle = `rgba(230,250,255,${.85 * (1 - hk)})`; g.lineWidth = 1.2; path(); g.stroke(); g.restore();
    }
    const temp = Math.round(22 + maxHeat * 36);
    const txt = maxHeat > .05 ? `FILM ${temp} °C · HEALING` : 'FILM 22 °C';
    if (tempEl.textContent !== txt) tempEl.textContent = txt;
  })();
}
