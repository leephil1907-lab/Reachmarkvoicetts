// Reachmark Audio — aurora background: a hand-written WebGL fragment shader (zero libraries).
// Book-of-Shaders style fbm flow field, tuned to the brand palette (lime/orange/violet/cyan
// on ink). Reacts to pointer position and scroll. Honest degradation everywhere:
//   • no WebGL / context lost  → canvas removes itself, CSS radial glows remain
//   • prefers-reduced-motion   → one static frame, never animates
//   • offscreen or hidden tab  → render loop fully paused (IntersectionObserver + visibilitychange)
//   • coarse pointer (mobile)  → renders at 0.6 scale — soft gradients hide the lower res
const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2  R;   // viewport (render pixels)
uniform float T;   // seconds
uniform vec2  M;   // pointer 0..1 (lerped)
uniform float S;   // scroll px
uniform float A;   // amplitude 0..1

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = rot(0.7) * p * 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * R) / R.y;
  vec2 m  = (M - 0.5) * vec2(R.x / R.y, 1.0);
  float t = T * 0.055 + S * 0.00045;

  vec2 q  = uv * 1.30 + m * 0.20;
  float f1 = fbm(q + vec2(t * 0.70, -t * 0.45));
  float f2 = fbm(q * 1.75 - vec2(t * 0.50, t * 0.32) + f1 * 0.90);
  float f3 = fbm(q * 0.60 + vec2(-t * 0.28, t * 0.20) + f2 * 0.55);

  vec3 lime   = vec3(0.827, 0.953, 0.420);
  vec3 orange = vec3(1.000, 0.604, 0.302);
  vec3 violet = vec3(0.616, 0.549, 1.000);
  vec3 cyan   = vec3(0.388, 0.851, 1.000);
  vec3 ink    = vec3(0.075, 0.068, 0.056);

  vec3 col = ink;
  col += lime   * smoothstep(0.46, 0.95, f1) * 0.46;
  col += orange * smoothstep(0.56, 0.98, f2) * 0.34;
  col += violet * smoothstep(0.50, 0.96, f3) * 0.30;
  col += cyan   * smoothstep(0.74, 1.02, f1 * f2 * 1.7) * 0.20;

  // pointer aura — a soft warm pool that follows the cursor
  float d = length(uv - m * 0.85);
  col += mix(lime, cyan, 0.5) * exp(-d * 2.6) * 0.10;

  col *= clamp(1.0 - 0.50 * dot(uv, uv), 0.0, 1.0);   // vignette keeps text readable
  col *= 0.80 * A;
  col += (hash(gl_FragCoord.xy + fract(T)) - 0.5) / 255.0; // dither kills banding
  gl_FragColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
  return s;
}

/**
 * Mount the aurora into a <canvas>. Returns a cleanup function.
 * opts: { scale, amplitude, scrollEl } — scrollEl() returns the scrolling container.
 */
export function mountAurora(canvas, opts = {}) {
  if (!canvas) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const scaleCap = opts.scale || (coarse ? 0.6 : 0.8);
  const amplitude = opts.amplitude ?? 1;
  const scrollEl = opts.scrollEl || (() => document.querySelector('#view') || document.scrollingElement);
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' })
          || canvas.getContext('experimental-webgl', { antialias: false, alpha: false, depth: false });
  if (!gl) { canvas.remove(); return () => {}; }   // honest fallback: CSS glows remain

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return () => {}; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return () => {}; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one big triangle
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = { R: gl.getUniformLocation(prog, 'R'), T: gl.getUniformLocation(prog, 'T'), M: gl.getUniformLocation(prog, 'M'), S: gl.getUniformLocation(prog, 'S'), A: gl.getUniformLocation(prog, 'A') };

  const dpr = Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.75);
  let W = 0, H = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = Math.max(2, Math.round(r.width * dpr * scaleCap));
    H = Math.max(2, Math.round(r.height * dpr * scaleCap));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    gl.viewport(0, 0, W, H);
  }
  let resizeT = null;
  const ro = new ResizeObserver(() => { clearTimeout(resizeT); resizeT = setTimeout(() => { resize(); draw(perfNow()); if (reduced || !visible) { /* single frame stays */ } }, 120); });
  ro.observe(canvas);

  // pointer (lerped for weight) + scroll
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  const onMove = e => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    mouse.tx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    mouse.ty = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  };
  addEventListener('pointermove', onMove, { passive: true });

  let scrollPx = 0;
  const onScroll = () => { const el = scrollEl(); scrollPx = el ? (el.scrollTop || 0) : 0; };
  const sEl = scrollEl();
  if (sEl) sEl.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const perfNow = () => (performance && performance.now ? performance.now() : Date.now());
  function draw(nowMs) {
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    gl.uniform2f(U.R, W, H);
    gl.uniform1f(U.T, nowMs / 1000);
    gl.uniform2f(U.M, mouse.x, mouse.y);
    gl.uniform1f(U.S, scrollPx);
    gl.uniform1f(U.A, amplitude);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  let raf = 0, visible = true, running = false;
  const io = new IntersectionObserver(es => { visible = es[0] && es[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0.01 });
  io.observe(canvas);
  const onVis = () => (document.hidden ? stop() : (visible && start()));
  document.addEventListener('visibilitychange', onVis);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); canvas.remove(); }, { once: true });

  function loop(now) {
    if (!canvas.isConnected) { stop(); return; }
    draw(now);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (running || reduced) return; running = true; raf = requestAnimationFrame(loop); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  resize();
  draw(perfNow());           // first frame immediately — never an empty black box
  if (!reduced) start();

  return () => {
    stop(); io.disconnect(); ro.disconnect();
    removeEventListener('pointermove', onMove);
    document.removeEventListener('visibilitychange', onVis);
    if (sEl) sEl.removeEventListener('scroll', onScroll);
    clearTimeout(resizeT);
    try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
  };
}
