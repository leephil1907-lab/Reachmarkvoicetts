// Reachmark Audio — Engine Hub registry
// One merged control plane over five imported codebases.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const tts = require('./tts');

const VENDOR = path.join(__dirname, '..', 'vendor');

const ENGINES = [
  {
    id: 'reachmark-core', name: 'Reachmark Core', repo: 'leephil1907-lab/Reachmarkvoicetts', dir: 'reachmark-voice-tts',
    role: 'Control plane, API adapters, design system & agent runtime (this app).',
    components: ['lib/server/backend.ts adapter pattern', 'docs/DESIGN_SYSTEM.md motion rules', 'agent chat route contract'],
    kind: 'online',
  },
  {
    id: 'piper', name: 'Piper Neural TTS', repo: 'rhasspy/piper (runtime installed)',
    role: 'CPU neural text-to-speech — the live synthesis engine behind TTS, dubbing, agents & calls.',
    components: ['ONNX voice models (en/fr/es/de)', 'length-scale prosody control'],
    kind: 'runtime',
  },
  {
    id: 'rtvc', name: 'Real-Time Voice Cloning', repo: 'CorentinJ/Real-Time-Voice-Cloning', dir: 'Real-Time-Voice-Cloning',
    role: 'SV2TTS pipeline blueprint: encoder embedding -> synthesizer -> vocoder. Drives the clone flow & F0 analysis defaults.',
    components: ['encoder/inference embedder', 'synthesizer train/inference split', 'utils/audio.py mel conventions'],
    kind: 'gpu',
  },
  {
    id: 'mockingbird', name: 'MockingBird', repo: 'babysor/MockingBird', dir: 'MockingBird',
    role: 'Clone UX & toolbox flow (record -> embed -> preview), VITS/SV2TTS variants for future GPU slots.',
    components: ['demo_toolbox flow', 'gen_voice one-shot pipeline', 'web UI state machine'],
    kind: 'gpu',
  },
  {
    id: 'chatterbox', name: 'ChatterBox (ComfyUI Fill)', repo: 'filliptm/ComfyUI_Fill-ChatterBox', dir: 'ComfyUI_Fill-ChatterBox',
    role: 'Expression/emotion parameter model — mapped to Reachmark expression knobs (rate, pitch, FX colour).',
    components: ['chatterbox_node params', 'dialog node turn structure'],
    kind: 'gpu',
  },
  {
    id: 'voicestudio', name: 'VoiceStudio', repo: 'debpalash/VoiceStudio', dir: 'VoiceStudio',
    role: 'Studio workspace patterns: project/history model, separation pipeline layout, Electron desktop shell reference.',
    components: ['frontend studio layout', 'backend separation service shape', 'electron packaging'],
    kind: 'ref',
  },
];

let torchCache = null;
function torchAvailable() {
  if (torchCache) return torchCache;
  torchCache = new Promise(res => {
    const c = spawn(process.env.PYTHON || 'python3', ['-c', 'import torch,sys;print(torch.__version__)']);
    let out = ''; c.stdout.on('data', d => out += d); c.on('error', () => res(null));
    c.on('close', code => res(code === 0 ? out.trim() : null));
    setTimeout(() => res(null), 8000);
  });
  return torchCache;
}

async function status() {
  const models = tts.catalog();
  const torch = await torchAvailable();
  return ENGINES.map(e => {
    let state = 'offline', detail = '';
    const vendored = e.dir ? fs.existsSync(path.join(VENDOR, e.dir)) : false;
    if (e.id === 'reachmark-core') { state = 'online'; detail = 'serving'; }
    else if (e.id === 'piper') { state = models.length ? 'online' : 'offline'; detail = models.length + ' neural voices loaded'; }
    else if (e.kind === 'gpu') { state = torch ? 'ready' : 'standby'; detail = torch ? 'torch ' + torch : 'needs GPU/torch — CPU fallback active'; }
    else if (e.id === 'voicestudio') { state = 'merged'; detail = 'patterns ported into UI + desktop shell'; }
    return { ...e, vendored, state, detail };
  });
}

module.exports = { ENGINES, status, VENDOR };
