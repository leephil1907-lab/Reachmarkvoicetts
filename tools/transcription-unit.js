'use strict';
// Focused unit tests for Gemini transcription input validation and request construction.
const assert = require('node:assert/strict');
const { transcribe, normalizeMimeType } = require('../server/transcription');
const originalFetch = global.fetch;
const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_TRANSCRIBE_MODEL;
let tests = 0;
async function rejects(fn, status, message) {
  await assert.rejects(fn, e => e.status === status && (!message || e.message.includes(message)));
  tests++;
}
(async () => {
  try {
    delete process.env.GEMINI_API_KEY;
    await rejects(() => transcribe({ audio: Buffer.from('x'), mimeType: 'audio/wav' }), 503, 'not configured');
    process.env.GEMINI_API_KEY = 'unit-test-key';
    await rejects(() => transcribe({ audio: Buffer.alloc(0), mimeType: 'audio/wav' }), 400, 'required');
    await rejects(() => transcribe({ audio: Buffer.from('x'), mimeType: 'application/octet-stream' }), 415, 'Unsupported audio type');
    assert.equal(normalizeMimeType('audio/x-m4a'), 'audio/mp4');
    assert.equal(normalizeMimeType('audio/m4a'), 'audio/mp4');
    assert.equal(normalizeMimeType('audio/x-wav'), 'audio/wav');
    tests += 3;
    await rejects(() => transcribe({ audio: Buffer.alloc(20 * 1024 * 1024 + 1), mimeType: 'audio/wav' }), 413, '20 MB');

    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes('/upload/')) return new Response(JSON.stringify({ uri: 'https://files.example/audio', mimeType: 'audio/wav' }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({ id: 'interaction-test', output_text: 'Hello from audio.' }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const smart = await transcribe({ audio: Buffer.from('fake-audio'), mimeType: 'audio/wav', mode: 'smart', languageCodes: ['en-US'], customVocabulary: ['Reachmark'] });
    assert.equal(smart.text, 'Hello from audio.');
    assert.equal(smart.model, 'gemini-3.5-transcribe');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.headers['x-goog-api-key'], 'unit-test-key');
    assert.equal(calls[1].options.headers['x-goog-api-key'], 'unit-test-key');
    const smartBody = JSON.parse(calls[1].options.body);
    assert.equal(smartBody.generation_config.transcription_config.mode.type, 'smart');
    assert.deepEqual(smartBody.generation_config.transcription_config.custom_vocabulary, ['Reachmark']);
    assert.equal('timestamp_granularities' in smartBody.generation_config.transcription_config.mode, false);
    assert.equal('diarization_mode' in smartBody.generation_config.transcription_config.mode, false);
    tests += 7;

    calls.length = 0;
    await transcribe({ audio: Buffer.from('fake-audio'), mimeType: 'audio/wav', mode: 'verbatim' });
    const verbatim = JSON.parse(calls[1].options.body).generation_config.transcription_config.mode;
    assert.deepEqual(verbatim.timestamp_granularities, ['word']);
    assert.equal(verbatim.diarization_mode, 'speaker');
    tests += 2;
    console.log('Gemini transcription unit tests passed: ' + tests);
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GEMINI_TRANSCRIBE_MODEL; else process.env.GEMINI_TRANSCRIBE_MODEL = originalModel;
  }
})();
