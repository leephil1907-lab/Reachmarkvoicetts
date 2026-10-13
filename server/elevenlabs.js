// Reachmark Audio — ElevenLabs cloud provider bridge (Voice Design + neural TTS).
// Merged from the Reachmark Voice API blueprint, adapted to this stack:
// CommonJS, native fetch (Node 18+), NO extra dependencies, key ONLY from env.
// If ELEVENLABS_API_KEY is unset every entry point reports honestly and the app
// keeps running on the local engines (piper + trait parser).
'use strict';

const KEY = () => process.env.ELEVENLABS_API_KEY || '';
const BASE = () => (process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io').replace(/\/$/, '');
const MODEL = () => process.env.TTS_MODEL || 'eleven_multilingual_v2';
const TIMEOUT = 60000;
const VOICE_ID = /^[A-Za-z0-9_-]{10,64}$/;

class ProviderError extends Error {
  constructor(message, status = 502, detail = '') {
    super(message);
    this.status = status;
    this.detail = String(detail).slice(0, 500);
  }
}

async function call(path, body, { raw = false } = {}) {
  if (!KEY()) throw new ProviderError('Voice Design engine is not connected on this server.', 503);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(BASE() + path, {
      method: 'POST',
      headers: { 'xi-api-key': KEY(), 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!r.ok) throw new ProviderError('Voice provider error (' + r.status + ')', 502, await r.text());
    return raw ? Buffer.from(await r.arrayBuffer()) : await r.json();
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e.name === 'AbortError') throw new ProviderError('Voice provider timed out (60s) — try again.', 504);
    throw new ProviderError('Voice provider unreachable: ' + e.message, 502);
  } finally { clearTimeout(timer); }
}

const desc = (v, min = 20, max = 1000) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < min || s.length > max) throw new ProviderError('Voice description must be ' + min + '-' + max + ' characters.', 400);
  return s;
};

/* ---------- Voice Design ---------- */
// 1) Generate audible previews from a plain-text description.
//    Each preview carries generated_voice_id + base64 mp3 audio.
async function designPreviews({ description, text }) {
  const body = { voice_description: desc(description) };
  if (text && String(text).trim()) {
    const t = String(text).trim();
    if (t.length < 100 || t.length > 1000) throw new ProviderError('Preview script must be 100-1000 characters.', 400);
    body.text = t;
  } else body.auto_generate_text = true;
  const data = await call('/v1/text-to-voice/design', body);
  const previews = Array.isArray(data.previews) ? data.previews : [];
  return {
    text: typeof data.generated_text === 'string' ? data.generated_text : (typeof data.text === 'string' ? data.text : ''),
    previews: previews
      .filter(pv => pv && typeof pv.generated_voice_id === 'string')
      .slice(0, 3)
      .map(pv => ({ generatedVoiceId: pv.generated_voice_id, audioBase64: String(pv.audio_base64 || pv.audio || '') })),
  };
}

// 2) Turn the chosen preview into a permanent voice in the user's ElevenLabs library.
async function saveDesigned({ generatedVoiceId, name, description }) {
  const gid = typeof generatedVoiceId === 'string' ? generatedVoiceId.trim() : '';
  if (gid.length < 10 || gid.length > 128) throw new ProviderError('generated_voice_id must be 10-128 characters.', 400);
  const nm = typeof name === 'string' ? name.trim() : '';
  if (!nm || nm.length > 60) throw new ProviderError('Voice name must be 1-60 characters.', 400);
  const data = await call('/v1/text-to-voice', { voice_name: nm, voice_description: desc(description), generated_voice_id: gid });
  const voiceId = String(data.voice_id || '');
  if (!VOICE_ID.test(voiceId)) throw new ProviderError('Provider returned an unusable voice id.', 502);
  return { voiceId };
}

/* ---------- Neural TTS ---------- */
async function tts(voiceId, text) {
  const vid = String(voiceId || '');
  if (!VOICE_ID.test(vid)) throw new ProviderError('Invalid ElevenLabs voice id.', 400);
  const t = String(text || '').trim();
  if (!t) throw new ProviderError('Text is required.', 400);
  return call('/v1/text-to-speech/' + encodeURIComponent(vid), { text: t.slice(0, 4000), model_id: MODEL() }, { raw: true });
}

module.exports = {
  configured: () => !!KEY(),
  model: MODEL,
  validVoiceId: v => VOICE_ID.test(String(v || '')),
  designPreviews,
  saveDesigned,
  tts,
  ProviderError,
};
