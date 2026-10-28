'use strict';

// Google Gemini prerecorded-audio transcription adapter.
// The API key is read only from server environment; it is never returned to clients.
const API_ROOT = 'https://generativelanguage.googleapis.com';

function safeError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function normalizeMimeType(value) {
  const mime = String(value || '').split(';', 1)[0].trim().toLowerCase();
  const aliases = {
    'audio/x-wav': 'audio/wav',
    'audio/wave': 'audio/wav',
    'audio/mp3': 'audio/mpeg',
    'audio/x-m4a': 'audio/mp4',
    'audio/m4a': 'audio/mp4',
  };
  return aliases[mime] || mime;
}

async function transcribe({ audio, mimeType, languageCodes = [], customVocabulary = [], mode = 'smart' }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw safeError(503, 'Gemini transcription is not configured. Set GEMINI_API_KEY on the server.');

  if (!Buffer.isBuffer(audio) || !audio.length) throw safeError(400, 'Audio data is required.');
  if (audio.length > 20 * 1024 * 1024) throw safeError(413, 'Audio exceeds the 20 MB upload limit.');
  mimeType = normalizeMimeType(mimeType);
  const allowedMime = new Set(['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/flac']);
  if (!allowedMime.has(mimeType)) throw safeError(415, 'Unsupported audio type. Use WAV, MP3, MP4/M4A, AAC, OGG, WebM, or FLAC.');

  const model = process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-3.5-transcribe';
  const fileForm = new FormData();
  fileForm.append('metadata', new Blob([JSON.stringify({ file: { display_name: 'reachmark-transcription' } })], { type: 'application/json' }));
  fileForm.append('file', new Blob([audio], { type: mimeType }), 'audio-upload');

  const upload = await fetch(`${API_ROOT}/upload/v1beta/files`, {
    method: 'POST', headers: { 'x-goog-api-key': apiKey }, body: fileForm, signal: AbortSignal.timeout(90000),
  });
  const uploadText = await upload.text();
  let file;
  try { file = JSON.parse(uploadText); } catch { throw safeError(502, 'Gemini file upload returned an unreadable response.'); }
  if (!upload.ok || !file.uri) throw safeError(upload.status === 429 ? 429 : 502, file.error?.message || 'Gemini could not accept the audio file.');

  const vocabulary = Array.isArray(customVocabulary) ? customVocabulary.slice(0, 1000).map(x => String(x).slice(0, 100)).filter(Boolean) : [];
  // Google documents that smart mode cannot be combined with timestamps/diarization,
  // and custom vocabulary cannot be combined with either timestamping or diarization.
  const transcriptionMode = { type: mode === 'verbatim' ? 'verbatim' : 'smart' };
  if (transcriptionMode.type === 'verbatim' && vocabulary.length === 0) {
    transcriptionMode.diarization_mode = 'speaker';
    transcriptionMode.timestamp_granularities = ['word'];
  }
  const transcriptionConfig = { mode: transcriptionMode };
  if (Array.isArray(languageCodes) && languageCodes.length) transcriptionConfig.language_codes = languageCodes.slice(0, 8).map(x => String(x).slice(0, 20));
  if (vocabulary.length) transcriptionConfig.custom_vocabulary = vocabulary;

  const response = await fetch(`${API_ROOT}/v1beta/interactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      model,
      input: [{ type: 'audio', uri: file.uri, mime_type: file.mimeType || mimeType }],
      generation_config: { transcription_config: transcriptionConfig },
    }),
    signal: AbortSignal.timeout(180000),
  });
  const responseText = await response.text();
  let result;
  try { result = JSON.parse(responseText); } catch { throw safeError(502, 'Gemini transcription returned an unreadable response.'); }
  if (!response.ok) throw safeError(response.status === 429 ? 429 : 502, result.error?.message || 'Gemini transcription failed.');
  const transcript = typeof result.output_text === 'string' ? result.output_text : '';
  if (!transcript) throw safeError(502, 'Gemini returned no transcript text.');
  return { text: transcript, model, interactionId: result.id || null };
}

module.exports = { transcribe, normalizeMimeType };
