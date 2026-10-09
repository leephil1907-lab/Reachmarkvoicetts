// Reachmark Audio — client audio engine: recorder, waveform players, TTS bridge, lip-sync renderer.
import { h, icons, toast, setCredits } from './core.js';

export const AC = window.AudioContext ? new AudioContext() : null;

/* ---------- WAV encode (for sending browser audio to the server DSP) ---------- */
export function encodeWav(float32, sampleRate) {
  const n = float32.length, buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, float32[i])) * 32767, true);
  return new Blob([buf], { type: 'audio/wav' });
}
export async function decodeToMono(blobOrUrl) {
  const buf = await (blobOrUrl instanceof Blob ? blobOrUrl.arrayBuffer() : (await fetch(blobOrUrl)).arrayBuffer());
  const audio = await AC.decodeAudioData(buf);
  const ch0 = audio.getChannelData(0);
  let mono = ch0;
  if (audio.numberOfChannels > 1) {
    mono = new Float32Array(audio.length);
    const ch1 = audio.getChannelData(1);
    for (let i = 0; i < audio.length; i++) mono[i] = (ch0[i] + ch1[i]) / 2;
  }
  return { mono, sampleRate: audio.sampleRate, duration: audio.duration };
}
export const blobToDataUrl = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });

/* ---------- recorder ---------- */
export class Recorder {
  constructor(onLevel) { this.onLevel = onLevel; this.chunks = []; }
  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    this.stream = stream;
    this.mr = new MediaRecorder(stream);
    this.chunks = [];
    this.mr.ondataavailable = e => this.chunks.push(e.data);
    this.mr.start();
    this.src = AC.createMediaStreamSource(stream);
    this.an = AC.createAnalyser(); this.an.fftSize = 512;
    this.src.connect(this.an);
    this.data = new Uint8Array(this.an.fftSize);
    this.loop = setInterval(() => {
      this.an.getByteTimeDomainData(this.data);
      let p = 0; for (let i = 0; i < this.data.length; i++) { const v = (this.data[i] - 128) / 128; p += v * v; }
      this.onLevel?.(Math.sqrt(p / this.data.length));
    }, 60);
    this.t0 = Date.now();
  }
  stop() {
    return new Promise(res => {
      clearInterval(this.loop);
      this.mr.onstop = async () => {
        this.stream?.getTracks().forEach(t => t.stop());
        const blob = new Blob(this.chunks, { type: this.mr.mimeType || 'audio/webm' });
        res(blob);
      };
      this.mr.stop();
    });
  }
  get elapsed() { return (Date.now() - this.t0) / 1000; }
}

/* ---------- waveform player ---------- */
export class Player {
  constructor(canvas, pbtn, timeEl) {
    this.canvas = canvas; this.pbtn = pbtn; this.timeEl = timeEl;
    this.audio = new Audio(); this.audio.preload = 'metadata';
    this.peaks = null; this.playing = false;
    this.pbtn?.addEventListener('click', () => this.playing ? this.pause() : this.play());
    canvas?.addEventListener('click', e => {
      if (!this.audio.duration) return;
      const r = canvas.getBoundingClientRect();
      this.audio.currentTime = ((e.clientX - r.left) / r.width) * this.audio.duration;
      if (!this.playing) this.play();
    });
    this.audio.addEventListener('ended', () => this.setPlaying(false));
    this.audio.addEventListener('play', () => this.setPlaying(true));
    this.audio.addEventListener('pause', () => this.setPlaying(false));
    this.raf = null;
  }
  setPlaying(p) {
    this.playing = p;
    if (this.pbtn) this.pbtn.innerHTML = p ? icons.pause : icons.play;
    if (p) this.tick(); else { cancelAnimationFrame(this.raf); this.draw(); }
  }
  async load(url) {
    this.url = url; this.audio.src = url;
    try {
      const { mono } = await decodeToMono(url);
      this.peaks = peaksOf(mono, 96);
      this.mono = mono;
    } catch { this.peaks = null; }
    this.draw();
    return this;
  }
  loadPeaks(peaks, duration) { this.peaks = peaks; this.audio.duration = duration; this.draw(); }
  play() { AC?.resume?.(); this.audio.play().catch(() => toast('Playback blocked', 'close')); }
  pause() { this.audio.pause(); }
  stop() { this.pause(); this.audio.currentTime = 0; }
  destroy() { this.pause(); cancelAnimationFrame(this.raf); }
  tick() {
    const step = () => {
      this.draw();
      if (this.timeEl) this.timeEl.textContent = fmt(this.audio.currentTime) + ' / ' + fmt(this.audio.duration || 0);
      if (this.playing) this.raf = requestAnimationFrame(step);
    };
    step();
  }
  draw() {
    const c = this.canvas; if (!c) return;
    const dpr = devicePixelRatio || 1;
    const w = c.clientWidth, hh = c.clientHeight;
    if (!w) return;
    c.width = w * dpr; c.height = hh * dpr;
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    g.clearRect(0, 0, w, hh);
    const peaks = this.peaks || new Array(96).fill(0.12);
    const n = peaks.length, bw = w / n;
    const prog = this.audio.duration ? this.audio.currentTime / this.audio.duration : 0;
    const cs = getComputedStyle(document.documentElement);
    for (let i = 0; i < n; i++) {
      const p = peaks[i], bh = Math.max(2, p * (hh - 6));
      const x = i * bw, y = (hh - bh) / 2;
      g.fillStyle = i / n <= prog ? (cs.getPropertyValue('--lime') || '#d3f36b') : (cs.getPropertyValue('--line2') || '#453f34');
      g.beginPath(); g.roundRect(x + bw * 0.18, y, bw * 0.64, bh, 3); g.fill();
    }
  }
  // analyser-driven level for lip sync
  attachAnalyser() {
    if (this._el) return this._el;
    this._el = AC.createMediaElementSource(this.audio);
    this.an = AC.createAnalyser(); this.an.fftSize = 1024;
    this._el.connect(this.an); this.an.connect(AC.destination);
    this.freq = new Uint8Array(this.an.frequencyBinCount);
    this.td = new Uint8Array(this.an.fftSize);
    return this._el;
  }
  level() {
    if (!this.an) return 0;
    this.an.getByteTimeDomainData(this.td);
    let p = 0; for (let i = 0; i < this.td.length; i++) { const v = (this.td[i] - 128) / 128; p += v * v; }
    this.an.getByteFrequencyData(this.freq);
    let num = 0, den = 0; for (let i = 0; i < this.freq.length; i++) { num += i * this.freq[i]; den += this.freq[i]; }
    return { rms: Math.sqrt(p / this.td.length), centroid: den ? (num / den) / this.freq.length : 0 };
  }
}
const fmt = s => { s = Math.max(0, s || 0); return Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0'); };
function peaksOf(ch, n) {
  const out = new Array(n).fill(0), b = Math.max(1, Math.floor(ch.length / n));
  for (let i = 0; i < n; i++) { let m = 0; for (let j = 0; j < b; j += 4) m = Math.max(m, Math.abs(ch[i * b + j] || 0)); out[i] = m; }
  const mx = Math.max(...out, 1e-6); return out.map(v => v / mx);
}

/* ---------- server TTS bridge + browser fallback ---------- */
export async function serverTTS({ text, voiceId, model, semitones, rate, fx, save, lang }) {
  const res = await fetch('/api/tts', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, voiceId, model, semitones, rate, fx, save, lang }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'TTS failed');
  const url = res.headers.get('X-Reachmark-Url') || null;
  const credits = res.headers.get('X-Reachmark-Credits');
  if (credits) setCredits(+credits);
  const blob = await res.blob();
  return { blob, url: URL.createObjectURL(blob), savedUrl: url };
}
export function browserSpeak(text, { pitch = 1, rate = 1 } = {}) {
  return new Promise(res => {
    if (!('speechSynthesis' in window)) return res(false);
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = pitch; u.rate = rate;
    u.onend = () => res(true); u.onerror = () => res(false);
    speechSynthesis.speak(u);
  });
}

/* ---------- lip-sync character renderer ---------- */
export class LipRenderer {
  constructor(canvas, scene = 0) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.scene = scene;
    this.t = 0; this.level = 0; this.centroid = 0.3; this.blink = 0; this.nextBlink = 2;
  }
  resize() {
    const dpr = devicePixelRatio || 1, r = this.c.getBoundingClientRect();
    this.c.width = r.width * dpr; this.c.height = r.height * dpr;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = r.width; this.hh = r.height;
  }
  frame(dt, level, centroid) {
    this.t += dt;
    this.level += (level - this.level) * 0.35;
    this.centroid += ((centroid ?? 0.3) - this.centroid) * 0.3;
    if (this.t > this.nextBlink) { this.blink = 0.14; this.nextBlink = this.t + 2 + Math.random() * 3; }
    this.blink = Math.max(0, this.blink - dt);
    this.draw();
  }
  draw() {
    const g = this.g, w = this.w, hh = this.hh; if (!w) return;
    const scenes = [
      ['#2b2417', '#12100c', '#ff9a4d'], ['#1a2226', '#0b0e10', '#63d9ff'], ['#241a26', '#100b12', '#9d8cff'],
    ];
    const [c1, c2, accent] = scenes[this.scene % 3];
    const grd = g.createLinearGradient(0, 0, 0, hh);
    grd.addColorStop(0, c1); grd.addColorStop(1, c2);
    g.fillStyle = grd; g.fillRect(0, 0, w, hh);
    // glow
    const rg = g.createRadialGradient(w / 2, hh * 0.42, 10, w / 2, hh * 0.42, w * 0.5);
    rg.addColorStop(0, accent + '33'); rg.addColorStop(1, 'transparent');
    g.fillStyle = rg; g.fillRect(0, 0, w, hh);
    // floor line
    g.strokeStyle = '#ffffff18'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(w * 0.1, hh * 0.9); g.lineTo(w * 0.9, hh * 0.9); g.stroke();

    const cx = w / 2, cy = hh * 0.44 + Math.sin(this.t * 1.7) * 2.5 - this.level * 4;
    const R = Math.min(w, hh) * 0.21;
    // body
    g.fillStyle = '#0e0c0a';
    g.beginPath();
    g.moveTo(cx - R * 1.5, hh * 0.9);
    g.quadraticCurveTo(cx - R * 1.35, cy + R * 1.15, cx, cy + R * 1.05);
    g.quadraticCurveTo(cx + R * 1.35, cy + R * 1.15, cx + R * 1.5, hh * 0.9);
    g.closePath(); g.fill();
    // head
    const tilt = Math.sin(this.t * 0.9) * 0.03 + (this.centroid - 0.3) * 0.06;
    g.save(); g.translate(cx, cy); g.rotate(tilt);
    const hg = g.createLinearGradient(-R, -R, R, R);
    hg.addColorStop(0, '#ffb066'); hg.addColorStop(1, '#e07a2e');
    g.fillStyle = hg;
    g.beginPath(); g.ellipse(0, 0, R * 0.82, R, 0, 0, Math.PI * 2); g.fill();
    // ears
    g.beginPath(); g.ellipse(-R * 0.82, R * 0.05, R * 0.12, R * 0.2, 0, 0, Math.PI * 2); g.ellipse(R * 0.82, R * 0.05, R * 0.12, R * 0.2, 0, 0, Math.PI * 2); g.fill();
    // eyes
    const eyeY = -R * 0.18, eyeX = R * 0.3, open = this.blink > 0 ? 0.12 : 1;
    g.fillStyle = '#171310';
    for (const s of [-1, 1]) {
      g.beginPath(); g.ellipse(s * eyeX, eyeY, R * 0.1, R * 0.12 * open, 0, 0, Math.PI * 2); g.fill();
    }
    // brows
    g.strokeStyle = '#171310'; g.lineWidth = R * 0.06; g.lineCap = 'round';
    const brow = this.level * R * 0.12;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * eyeX - R * 0.14, eyeY - R * 0.28 - brow); g.lineTo(s * eyeX + R * 0.14, eyeY - R * 0.3 - brow); g.stroke(); }
    // mouth — viseme from level + centroid
    const openM = Math.min(1, this.level * 3.2);
    const wide = 0.35 + this.centroid * 0.75;
    g.fillStyle = '#2a1206';
    g.beginPath();
    g.ellipse(0, R * 0.42, R * 0.34 * wide, R * (0.05 + openM * 0.3), 0, 0, Math.PI * 2);
    g.fill();
    if (openM > 0.25) { g.fillStyle = '#c4482f'; g.beginPath(); g.ellipse(0, R * 0.5 + openM * R * 0.08, R * 0.2 * wide, R * openM * 0.1, 0, 0, Math.PI * 2); g.fill(); }
    // nose
    g.strokeStyle = '#17131055'; g.lineWidth = R * 0.05;
    g.beginPath(); g.moveTo(0, -R * 0.02); g.quadraticCurveTo(R * 0.06, R * 0.14, 0, R * 0.18); g.stroke();
    g.restore();
    // speaking indicator bars
    const bars = 24;
    for (let i = 0; i < bars; i++) {
      const x = w * 0.08 + (i / (bars - 1)) * w * 0.84;
      const a = Math.sin(this.t * 6 + i * 0.7) * 0.5 + 0.5;
      const bh = 3 + a * this.level * 46;
      g.fillStyle = accent + 'aa';
      g.beginPath(); g.roundRect(x - 1.5, hh * 0.94 - bh / 2, 3, bh, 2); g.fill();
    }
  }
}

/* ---------- misc ---------- */
export async function recordBlobToWavData(blob) {
  const { mono, sampleRate } = await decodeToMono(blob);
  return blobToDataUrl(encodeWav(mono, sampleRate));
}
export function pickFile(accept, cb) {
  const inp = h('input', { type: 'file', accept, style: { display: 'none' } });
  inp.addEventListener('change', () => { if (inp.files[0]) cb(inp.files[0]); inp.remove(); });
  document.body.append(inp); inp.click();
}
