// Reachmark Audio — Core DSP engine
// Merged lineage:
//  - audio preprocessing constants (sr windows, hop sizes) follow the encoder/vocoder
//    conventions of CorentinJ/Real-Time-Voice-Cloning (utils/audio.py) and babysor/MockingBird.
//  - FX chain (ring-mod / band-limit / echo) mirrors the expression controls exposed by
//    filliptm/ComfyUI_Fill-ChatterBox (emotion/expression knobs) as lightweight CPU proxies.
//  - WAV codec + pipeline orchestration originates from leephil1907-lab/Reachmarkvoicetts
//    (lib/server/backend.ts adapter philosophy: normalize everything to PCM frames).
'use strict';

/* ---------------- WAV codec ---------------- */

function decodeWav(buf) {
  const dv = new DataView(buf.buffer ?? buf, buf.byteOffset ?? 0, buf.byteLength);
  if (dv.getUint32(0, false) !== 0x52494646 || dv.getUint32(8, false) !== 0x57415645) {
    throw new Error('Not a RIFF/WAVE file');
  }
  let off = 12, fmt = null, dataOff = 0, dataLen = 0;
  while (off + 8 <= dv.byteLength) {
    const id = dv.getUint32(off, false), len = dv.getUint32(off + 4, true);
    const body = off + 8;
    if (id === 0x666d7420) {
      fmt = {
        format: dv.getUint16(body, true),
        channels: dv.getUint16(body + 2, true),
        sampleRate: dv.getUint32(body + 4, true),
        bits: dv.getUint16(body + 14, true),
      };
    } else if (id === 0x64617461) { dataOff = body; dataLen = len; }
    off = body + len + (len & 1);
  }
  if (!fmt || !dataOff) throw new Error('Malformed WAV');
  const ch = [];
  const bytesPer = fmt.bits / 8;
  const frames = Math.floor(dataLen / (bytesPer * fmt.channels));
  for (let c = 0; c < fmt.channels; c++) ch.push(new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.channels; c++) {
      const p = dataOff + (i * fmt.channels + c) * bytesPer;
      let v = 0;
      if (fmt.format === 3) v = dv.getFloat32(p, true);
      else if (fmt.format === 1 && fmt.bits === 16) v = dv.getInt16(p, true) / 32768;
      else if (fmt.format === 1 && fmt.bits === 24) {
        const a = dv.getUint8(p), b = dv.getUint8(p + 1), cc = dv.getUint8(p + 2);
        v = ((a | (b << 8) | (cc << 16)) << 8 >> 8) / 8388608;
      } else if (fmt.format === 1 && fmt.bits === 32) v = dv.getInt32(p, true) / 2147483648;
      else throw new Error('Unsupported WAV format ' + fmt.format + '/' + fmt.bits);
      ch[c][i] = v;
    }
  }
  return { sampleRate: fmt.sampleRate, channels: ch };
}

function encodeWav(channels, sampleRate) {
  const nCh = channels.length, frames = channels[0].length;
  const buf = Buffer.alloc(44 + frames * nCh * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + frames * nCh * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(nCh, 22); buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * nCh * 2, 28); buf.writeUInt16LE(nCh * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(frames * nCh * 2, 40);
  let p = 44;
  for (let i = 0; i < frames; i++) for (let c = 0; c < nCh; c++) {
    let v = Math.max(-1, Math.min(1, channels[c][i]));
    buf.writeInt16LE(Math.round(v * 32767), p); p += 2;
  }
  return buf;
}

/* ---------------- resample / time-stretch / pitch ---------------- */

function resampleBy(ch, r) { // output[i] = ch[i*r]; length N/r ; pitch multiplied by r
  const n = Math.floor(ch.length / r);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * r, i0 = Math.floor(x), f = x - i0;
    out[i] = ch[i0] * (1 - f) + (ch[i0 + 1] ?? ch[i0]) * f;
  }
  return out;
}

function hann(n) { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)); return w; }

function stretchOLA(ch, sr, S) { // time-stretch by factor S (duration * S), pitch preserved
  if (Math.abs(S - 1) < 0.01) return ch.slice();
  const win = sr > 32000 ? 4096 : 2048;
  const hopIn = win >> 2;
  const hopOut = Math.max(64, Math.round(hopIn * S));
  const w = hann(win);
  const outLen = Math.ceil(ch.length * S) + win;
  const acc = new Float32Array(outLen), norm = new Float32Array(outLen);
  for (let i = 0, o = 0; i + win < ch.length; i += hopIn, o += hopOut) {
    for (let j = 0; j < win; j++) {
      acc[o + j] += ch[i + j] * w[j];
      norm[o + j] += w[j] * w[j];
    }
  }
  for (let i = 0; i < outLen; i++) acc[i] /= Math.max(norm[i], 1e-6);
  return acc;
}

function pitchShift(ch, sr, semitones) {
  if (!semitones) return ch;
  const P = Math.pow(2, semitones / 12);
  const tmp = resampleBy(ch, P);      // pitch up P, duration /P
  return stretchOLA(tmp, sr, P);      // duration back to original
}

function rateChange(ch, sr, rate) {
  if (Math.abs(rate - 1) < 0.01) return ch;
  return resampleBy(ch, rate);        // true speed change (pitch follows), like tape
}

/* ---------------- FX chain ---------------- */

function fxRobot(ch, sr) {
  const out = new Float32Array(ch.length);
  for (let i = 0; i < ch.length; i++) {
    const t = i / sr;
    const m = Math.sin(2 * Math.PI * 62 * t) * 0.5 + Math.sin(2 * Math.PI * 124 * t) * 0.2;
    let v = ch[i] * (0.55 * m + 0.55);
    out[i] = Math.tanh(v * 1.6) * 0.9;
  }
  return out;
}
function onePoleHP(ch, sr, fc) { const a = Math.exp(-2 * Math.PI * fc / sr); const y = new Float32Array(ch.length); let px = 0, py = 0; for (let i = 0; i < ch.length; i++) { y[i] = a * (py - px) + ch[i]; px = ch[i]; py = y[i]; } return y; }
function onePoleLP(ch, sr, fc) { const a = Math.exp(-2 * Math.PI * fc / sr); const y = new Float32Array(ch.length); let py = 0; for (let i = 0; i < ch.length; i++) { py = ch[i] * (1 - a) + py * a; y[i] = py; } return y; }
function fxRadio(ch, sr) {
  let y = onePoleHP(ch, sr, 320); y = onePoleLP(y, sr, 3300);
  const out = new Float32Array(y.length);
  for (let i = 0; i < y.length; i++) out[i] = Math.tanh(y[i] * 2.4) * 0.75;
  return out;
}
function fxEcho(ch, sr) {
  const d1 = Math.round(sr * 0.26), d2 = Math.round(sr * 0.52);
  const out = new Float32Array(ch.length);
  for (let i = 0; i < ch.length; i++) {
    out[i] = ch[i] + (i >= d1 ? out[i - d1] * 0.38 : 0) + (i >= d2 ? out[i - d2] * 0.16 : 0);
  }
  return out;
}
function applyFx(ch, sr, fx) {
  switch (fx) {
    case 'robot': return fxRobot(ch, sr);
    case 'radio': return fxRadio(ch, sr);
    case 'echo': return fxEcho(ch, sr);
    default: return ch;
  }
}

/* ---------------- analysis ---------------- */

function estimateF0(ch, sr) {
  const win = Math.round(sr * 0.05), hop = win >> 1;
  const minLag = Math.floor(sr / 400), maxLag = Math.floor(sr / 60);
  const f0s = [];
  for (let s = 0; s + win < ch.length; s += hop) {
    let e = 0; for (let j = 0; j < win; j++) e += ch[s + j] * ch[s + j];
    if (e / win < 0.002) continue;
    let best = -1, bestLag = 0;
    for (let lag = minLag; lag < maxLag; lag++) {
      let sum = 0, n1 = 0, n2 = 0;
      for (let j = 0; j < win; j += 2) { const a = ch[s + j], b = ch[s + j + lag] || 0; sum += a * b; n1 += a * a; n2 += b * b; }
      const r = sum / Math.sqrt(n1 * n2 + 1e-9);
      if (r > best) { best = r; bestLag = lag; }
    }
    if (best > 0.45 && bestLag) f0s.push(sr / bestLag);
  }
  if (!f0s.length) return 0;
  f0s.sort((a, b) => a - b);
  return f0s[Math.floor(f0s.length / 2)];
}

function speechRate(ch, sr) {
  // voiced-syllable density proxy: energy envelope peaks per second
  const win = Math.round(sr * 0.02), env = [];
  for (let s = 0; s + win < ch.length; s += win) {
    let e = 0; for (let j = 0; j < win; j++) e += ch[s + j] * ch[s + j];
    env.push(Math.sqrt(e / win));
  }
  const mean = env.reduce((a, b) => a + b, 0) / (env.length || 1);
  let peaks = 0;
  for (let i = 1; i < env.length - 1; i++) if (env[i] > mean * 0.6 && env[i] >= env[i - 1] && env[i] > env[i + 1]) peaks++;
  return peaks / (env.length * 0.02 || 1);
}

function peaksOf(ch, n) {
  const out = new Array(n).fill(0);
  const b = Math.max(1, Math.floor(ch.length / n));
  for (let i = 0; i < n; i++) {
    let m = 0; const s = i * b;
    for (let j = 0; j < b; j += 4) m = Math.max(m, Math.abs(ch[s + j] || 0));
    out[i] = m;
  }
  const mx = Math.max(...out, 1e-6);
  return out.map(v => v / mx);
}

/* ---------------- source separation (center extraction) ---------------- */

function separate(audio) {
  const { sampleRate: sr, channels } = audio;
  if (channels.length < 2) return null;
  const L = channels[0], R = channels[1], n = Math.min(L.length, R.length);
  const mid = new Float32Array(n), side = new Float32Array(n);
  for (let i = 0; i < n; i++) { mid[i] = (L[i] + R[i]) / 2; side[i] = (L[i] - R[i]) / 2; }
  // per-frame mask: centre-dominant frames keep mid as "vocals"
  const win = 2048, hop = 512;
  const g = new Float32Array(Math.ceil(n / hop) + 2);
  for (let f = 0, s = 0; s < n; f++, s += hop) {
    let em = 0, es = 0;
    for (let j = 0; j < win && s + j < n; j++) { em += mid[s + j] ** 2; es += side[s + j] ** 2; }
    g[f] = Math.max(0, Math.min(1, 1 - Math.sqrt(es / (em + 1e-9))));
  }
  const gs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = i / hop, f0 = Math.floor(f), fr = f - f0;
    gs[i] = g[f0] * (1 - fr) + (g[f0 + 1] ?? g[f0]) * fr;
  }
  const vocals = new Float32Array(n), inst = new Float32Array(n);
  for (let i = 0; i < n; i++) { vocals[i] = mid[i] * gs[i] * 1.6; inst[i] = side[i] * 2; }
  return { sr, vocals, inst };
}

module.exports = { decodeWav, encodeWav, resampleBy, stretchOLA, pitchShift, rateChange, applyFx, estimateF0, speechRate, peaksOf, separate };
