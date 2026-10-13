#!/usr/bin/env node
// Reachmark Audio — neural voice fetcher (Piper ONNX models, rhasspy/piper-voices on HF).
// Downloads any missing voices into PIPER_VOICES_DIR (default engines/piper-voices).
// Idempotent: existing files > 1 MB are skipped. Safe to run at boot (PIPER_FETCH_ON_BOOT=1)
// and from CI. No API keys, public CDN only.
'use strict';
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

const DIR = process.env.PIPER_VOICES_DIR || path.join(__dirname, '..', 'engines', 'piper-voices');
fs.mkdirSync(DIR, { recursive: true });

const BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';
const VOICES = [
  'en/en_US/lessac/medium/en_US-lessac-medium',
  'en/en_US/amy/medium/en_US-amy-medium',
  'fr/fr_FR/siwis/medium/fr_FR-siwis-medium',
  'es/es_ES/davefx/medium/es_ES-davefx-medium',
  'de/de_DE/thorsten/medium/de_DE-thorsten-medium',
];

async function get(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1e6) { console.log('skip  ' + path.basename(dest)); return true; }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      const tmp = dest + '.part';
      await pipeline(res.body, fs.createWriteStream(tmp));
      fs.renameSync(tmp, dest);
      console.log('done  ' + path.basename(dest) + ' (' + (fs.statSync(dest).size / 1e6).toFixed(1) + ' MB)');
      return true;
    } catch (e) {
      console.log('retry ' + attempt + ' ' + path.basename(dest) + ': ' + e.message);
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  console.error('FAIL  ' + path.basename(dest));
  return false;
}

(async () => {
  const jobs = [];
  for (const v of VOICES) {
    const id = v.split('/').pop();
    jobs.push(get(BASE + '/' + v + '.onnx', path.join(DIR, id + '.onnx')));
    jobs.push(get(BASE + '/' + v + '.onnx.json', path.join(DIR, id + '.onnx.json')));
  }
  const results = await Promise.all(jobs);
  const ok = results.filter(Boolean).length;
  console.log('[voices] ' + ok + '/' + results.length + ' files present in ' + DIR);
  process.exit(ok === results.length ? 0 : 2);
})();
