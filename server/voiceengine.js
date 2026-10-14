// Reachmark Audio — client for the self-hosted Voice Engine (engines/voice-engine).
// Zero-shot voice cloning + multilingual TTS on your own hardware; no third-party voice provider.
// Env: VOICE_ENGINE_URL (e.g. http://voice-engine.internal:8100), VOICE_ENGINE_TOKEN, VOICE_ENGINE_TIMEOUT_MS.
'use strict';
const URL_ = () => (process.env.VOICE_ENGINE_URL || '').replace(/\/$/, '');
const TOKEN = () => process.env.VOICE_ENGINE_TOKEN || '';
const TIMEOUT = () => +process.env.VOICE_ENGINE_TIMEOUT_MS || 180000;
const MAX_GLOBAL = +process.env.VOICE_ENGINE_CONCURRENCY || 2;
let inflight = 0;
const busyUsers = new Set();

class EngineError extends Error { constructor(msg, status = 502) { super(msg); this.status = status; } }

let cache = { at: 0, v: null };
async function health(force = false) {
  if (!URL_()) return null;
  if (!force && Date.now() - cache.at < 15000) return cache.v;
  let v = null;
  try {
    const r = await fetch(URL_() + '/health', { signal: AbortSignal.timeout(4000) });
    const j = await r.json().catch(() => ({}));
    v = r.ok && j.ok ? j : null;
  } catch { v = null; }
  cache = { at: Date.now(), v };
  return v;
}

// Returns a WAV Buffer. `sample` (Buffer) is the cloned speaker's reference audio.
async function synth({ text, lang = 'en', sample, uid = 'anon', exaggeration = 0.5, cfg = 0.5 }) {
  if (!URL_()) throw new EngineError('Voice engine is not configured on this server.', 503);
  if (busyUsers.has(uid)) throw new EngineError('You already have a render running — wait for it to finish.', 429);
  if (inflight >= MAX_GLOBAL) throw new EngineError('Voice engine is busy — try again in a few seconds.', 429);
  busyUsers.add(uid); inflight++;
  try {
    const form = new FormData();
    form.append('text', String(text).slice(0, 1000));
    form.append('language', String(lang || 'en').slice(0, 2).toLowerCase());
    form.append('exaggeration', String(exaggeration));
    form.append('cfg_weight', String(cfg));
    if (sample) form.append('sample', new Blob([sample], { type: 'audio/wav' }), 'sample.wav');
    let r;
    try {
      r = await fetch(URL_() + '/v1/tts', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN() }, body: form, signal: AbortSignal.timeout(TIMEOUT()) });
    } catch (e) {
      cache = { at: 0, v: null };
      throw new EngineError(e.name === 'TimeoutError' ? 'Voice engine timed out — try a shorter text.' : 'Voice engine is unreachable right now.', 503);
    }
    if (!r.ok) {
      let d = ''; try { d = (await r.json()).detail || ''; } catch {}
      if (r.status === 401) { console.error('[voice-engine] 401 — VOICE_ENGINE_TOKEN mismatch'); throw new EngineError('Voice engine rejected our credentials (server misconfiguration).', 502); }
      throw new EngineError(String(d || 'Voice engine error (' + r.status + ')').slice(0, 200), r.status === 422 || r.status === 400 ? 422 : 502);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 100) throw new EngineError('Voice engine returned empty audio.', 502);
    return buf;
  } finally { busyUsers.delete(uid); inflight--; }
}

module.exports = { configured: () => !!URL_(), health, synth, EngineError };
