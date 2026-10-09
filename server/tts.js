// Reachmark Audio — TTS bridge
// Neural runtime: Piper (CPU ONNX). Pipeline shape (text -> synth -> vocoder-out -> post DSP)
// follows the synthesizer/vocoder split of CorentinJ/Real-Time-Voice-Cloning; expression
// knobs (rate/emphasis) mirror ChatterBox node params from filliptm/ComfyUI_Fill-ChatterBox.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dsp = require('./dsp');

const VOICES_DIR = path.join(__dirname, '..', 'engines', 'piper-voices');
const RENDER_DIR = path.join(__dirname, '..', 'data', 'renders');
fs.mkdirSync(RENDER_DIR, { recursive: true });

const BASE_F0 = {
  'en_US-lessac-medium': 196, 'en_US-amy-medium': 214, 'fr_FR-siwis-medium': 192,
  'es_ES-davefx-medium': 118, 'de_DE-thorsten-medium': 112,
};
const LABELS = {
  'en_US-lessac-medium': { name: 'Lessac', tag: 'Neutral · Narration', gender: 'female', lang: 'en-US', flag: '🇺🇸' },
  'en_US-amy-medium': { name: 'Amy', tag: 'Warm · Conversational', gender: 'female', lang: 'en-US', flag: '🇺' },
  'fr_FR-siwis-medium': { name: 'Siwis', tag: 'French · Narration', gender: 'female', lang: 'fr-FR', flag: '🇫' },
  'es_ES-davefx-medium': { name: 'Davefx', tag: 'Spanish · Character', gender: 'male', lang: 'es-ES', flag: '🇪' },
  'de_DE-thorsten-medium': { name: 'Thorsten', tag: 'German · Broadcast', gender: 'male', lang: 'de-DE', flag: '🇩' },
};

function catalog() {
  if (!fs.existsSync(VOICES_DIR)) return [];
  return fs.readdirSync(VOICES_DIR).filter(f => f.endsWith('.onnx')).map(f => {
    const id = f.replace(/\.onnx$/, '');
    const meta = LABELS[id] || { name: id, tag: 'Voice', gender: 'unknown', lang: id.slice(0, 5), flag: '🏳️' };
    return { id, file: path.join(VOICES_DIR, f), baseF0: BASE_F0[id] || 160, ready: fs.statSync(path.join(VOICES_DIR, f)).size > 1e6, ...meta };
  }).filter(v => v.ready);
}

// serialize heavy synths on small boxes
let chain = Promise.resolve();
function queued(fn) { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; }

function synthRaw(text, modelFile, rate) {
  return new Promise((resolve, reject) => {
    const out = path.join(RENDER_DIR, 'raw_' + crypto.randomBytes(6).toString('hex') + '.wav');
    const args = ['-m', 'piper', '--model', modelFile, '--output_file', out, '--sentence-silence', '0.32'];
    if (rate && Math.abs(rate - 1) > 0.02) args.push('--length-scale', (1 / rate).toFixed(3));
    const child = spawn(process.env.PYTHON || 'python3', args, { env: { ...process.env, PYTHONPATH: '' } });
    let err = '';
    child.stderr.on('data', d => err += d);
    child.stdin.end(text);
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0 || !fs.existsSync(out)) { reject(new Error('piper exit ' + code + ' ' + err.slice(-300))); return; }
      const buf = fs.readFileSync(out); fs.unlinkSync(out); resolve(buf);
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

function synthesize({ text, model, lang, semitones = 0, rate = 1, fx = 'none' }) {
  const cats = catalog();
  // voice translation: an explicit output language re-targets the neural voice while the
  // caller's profile (pitch/speed/colour) carries across — cross-lingual voice transfer.
  let voice = null;
  if (model) voice = cats.find(v => v.id === model);
  if (!voice && lang && lang !== 'auto') voice = cats.find(v => v.lang.startsWith(lang));
  if (!voice) voice = cats.find(v => v.id === model) || cats.find(v => v.lang.startsWith('en')) || cats[0];
  if (!voice) return Promise.reject(new Error('No neural voice models installed'));
  const key = crypto.createHash('sha1').update([text, voice.id, semitones, rate, fx].join('|')).digest('hex').slice(0, 16);
  const cache = path.join(RENDER_DIR, 'c_' + key + '.wav');
  if (fs.existsSync(cache)) return Promise.resolve({ buf: fs.readFileSync(cache), voice, cached: true });
  return queued(async () => {
    if (fs.existsSync(cache)) return { buf: fs.readFileSync(cache), voice, cached: true };
    const raw = await synthRaw(text.slice(0, 4000), voice.file, rate);
    const buf = postProcess(raw, { semitones, fx });
    fs.writeFileSync(cache, buf);
    return { buf, voice, cached: false };
  });
}

module.exports = { catalog, synthesize, postProcess, RENDER_DIR, BASE_F0 };
