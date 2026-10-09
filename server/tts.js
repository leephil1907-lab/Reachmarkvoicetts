// Reachmark Audio — TTS bridge (Piper, CPU ONNX)
// Hardened: 30s child timeout with SIGKILL, per-user concurrency = 1, capped global
// queue (429 when full), fixed regional-indicator flags, health reporting.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dsp = require('./dsp');

const VOICES_DIR = process.env.PIPER_VOICES_DIR || path.join(__dirname, '..', 'engines', 'piper-voices');
const RENDER_DIR = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'renders') : path.join(__dirname, '..', 'data', 'renders');
fs.mkdirSync(RENDER_DIR, { recursive: true });

const BASE_F0 = {
  'en_US-lessac-medium': 196, 'en_US-amy-medium': 214, 'fr_FR-siwis-medium': 192,
  'es_ES-davefx-medium': 118, 'de_DE-thorsten-medium': 112,
};
const LABELS = {
  'en_US-lessac-medium': { name: 'Lessac', tag: 'Neutral · Narration', gender: 'female', lang: 'en-US', flag: '🇺🇸' },
  'en_US-amy-medium': { name: 'Amy', tag: 'Warm · Conversational', gender: 'female', lang: 'en-US', flag: '🇺🇸' },
  'fr_FR-siwis-medium': { name: 'Siwis', tag: 'French · Narration', gender: 'female', lang: 'fr-FR', flag: '🇫🇷' },
  'es_ES-davefx-medium': { name: 'Davefx', tag: 'Spanish · Character', gender: 'male', lang: 'es-ES', flag: '🇪🇸' },
  'de_DE-thorsten-medium': { name: 'Thorsten', tag: 'German · Broadcast', gender: 'male', lang: 'de-DE', flag: '🇩🇪' },
};

function catalog() {
  if (!fs.existsSync(VOICES_DIR)) return [];
  return fs.readdirSync(VOICES_DIR).filter(f => f.endsWith('.onnx')).map(f => {
    const id = f.replace(/\.onnx$/, '');
    const meta = LABELS[id] || { name: id, tag: 'Voice', gender: 'unknown', lang: id.slice(0, 5), flag: '🏳️' };
    return { id, file: path.join(VOICES_DIR, f), baseF0: BASE_F0[id] || 160, ready: fs.statSync(path.join(VOICES_DIR, f)).size > 1e6, ...meta };
  }).filter(v => v.ready);
}

/* ---------- concurrency control ---------- */
const MAX_GLOBAL = 2;              // concurrent synths on small boxes
const TIMEOUT_MS = 30000;          // hard kill for hung children
const inflightUsers = new Set();
let inflightGlobal = 0;
class QueueError extends Error { constructor(msg) { super(msg); this.code = 429; } }

function synthRaw(text, modelFile, rate) {
  return new Promise((resolve, reject) => {
    const out = path.join(RENDER_DIR, 'raw_' + crypto.randomBytes(6).toString('hex') + '.wav');
    const args = ['-m', 'piper', '--model', modelFile, '--output_file', out, '--sentence-silence', '0.32'];
    if (rate && Math.abs(rate - 1) > 0.02) args.push('--length-scale', (1 / rate).toFixed(3));
    const child = spawn(process.env.PYTHON || 'python3', args);
    let err = '';
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} reject(new Error('Synthesis timed out (30s) — try a shorter script.')); }, TIMEOUT_MS);
    child.stderr.on('data', d => err += d);
    child.stdin.on('error', () => {});
    child.stdin.end(text);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) { try { fs.unlinkSync(out); } catch {} reject(new Error('piper exit ' + code + ' ' + err.slice(-240))); return; }
      let buf;
      try { buf = fs.readFileSync(out); } catch { try { fs.unlinkSync(out); } catch {} reject(new Error('piper produced no output file')); return; }
      try { fs.unlinkSync(out); } catch {}
      if (!buf.length) { reject(new Error('piper produced empty output')); return; }
      resolve(buf);
    });
  });
}

function postProcess(wavBuf, { semitones = 0, fx = 'none' } = {}) {
  const audio = dsp.decodeWav(wavBuf);
  let chans = audio.channels;
  if (semitones) chans = chans.map(c => dsp.pitchShift(c, audio.sampleRate, semitones));
  if (fx && fx !== 'none') chans = chans.map(c => dsp.applyFx(c, audio.sampleRate, fx));
  return dsp.encodeWav(chans, audio.sampleRate);
}

function synthesize({ text, model, lang, semitones = 0, rate = 1, fx = 'none' }, uid = 'anon') {
  const cats = catalog();
  if (!cats.length) return Promise.reject(new Error('Speech engine has no voices installed on this server.'));
  let voice = null;
  if (model) voice = cats.find(v => v.id === model);
  if (!voice && lang && lang !== 'auto') voice = cats.find(v => v.lang.startsWith(lang));
  if (!voice) voice = cats.find(v => v.lang.startsWith('en')) || cats[0];
  if (inflightUsers.has(uid)) return Promise.reject(new QueueError('You already have a render running — wait for it to finish.'));
  if (inflightGlobal >= MAX_GLOBAL) return Promise.reject(new QueueError('Render queue is full — try again in a few seconds.'));
  inflightUsers.add(uid); inflightGlobal++;
  const key = crypto.createHash('sha1').update([text, voice.id, semitones, rate, fx].join('|')).digest('hex').slice(0, 16);
  const cache = path.join(RENDER_DIR, 'c_' + key + '.wav');
  const finish = () => { inflightUsers.delete(uid); inflightGlobal--; };
  if (fs.existsSync(cache)) { finish(); return Promise.resolve({ buf: fs.readFileSync(cache), voice, cached: true }); }
  return synthRaw(String(text).slice(0, 4000), voice.file, rate)
    .then(raw => {
      const buf = postProcess(raw, { semitones, fx });
      try { fs.writeFileSync(cache, buf); } catch {}
      return { buf, voice, cached: false };
    })
    .finally(finish);
}

function status() {
  const cats = catalog();
  return { ready: cats.length > 0, voices: cats.length, voicesDir: VOICES_DIR };
}

module.exports = { catalog, synthesize, postProcess, RENDER_DIR, BASE_F0, status, QueueError };
