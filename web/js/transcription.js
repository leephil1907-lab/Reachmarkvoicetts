// Reachmark Audio — Gemini-powered prerecorded audio transcription studio.
import { h, icon, icons, routes, api, toast } from './core.js';

const MAX_AUDIO = 20 * 1024 * 1024;
const ACCEPT = 'audio/*,.wav,.mp3,.m4a,.aac,.ogg,.webm,.flac';

routes['/studio/transcribe'] = {
  title: 'Audio Transcription',
  tab: 'create',
  view: async ({ node }) => {
    let selectedFile = null;
    let transcript = '';
    let busy = false;
    let recorder = null;
    let chunks = [];
    let stream = null;
    let recordedUrl = null;

    const fileInput = h('input', { type: 'file', accept: ACCEPT, hidden: true, 'aria-label': 'Choose audio file' });
    const fileName = h('b', { class: 'transcribe-file-name' }, 'No audio selected');
    const fileMeta = h('span', { class: 'tiny faint' }, 'WAV, MP3, M4A, AAC, OGG, WebM or FLAC · up to 20 MB');
    const status = h('div', { class: 'transcribe-status', role: 'status', 'aria-live': 'polite' }, 'Ready when you are.');
    const result = h('textarea', { class: 'input transcribe-output', placeholder: 'Your transcript will appear here…', rows: '10', 'aria-label': 'Transcript output' });
    result.readOnly = true;
    const mode = h('select', { class: 'input', 'aria-label': 'Transcription mode' },
      h('option', { value: 'smart' }, 'Smart — natural punctuation and formatting'),
      h('option', { value: 'verbatim' }, 'Verbatim — closer to the spoken words'));
    const lang = h('select', { class: 'input', 'aria-label': 'Audio language' },
      h('option', { value: '' }, 'Auto-detect language'),
      h('option', { value: 'en-US' }, 'English'),
      h('option', { value: 'en-NG' }, 'English (Nigeria)'),
      h('option', { value: 'es-ES' }, 'Spanish'),
      h('option', { value: 'fr-FR' }, 'French'),
      h('option', { value: 'de-DE' }, 'German'),
      h('option', { value: 'pt-BR' }, 'Portuguese'),
      h('option', { value: 'hi-IN' }, 'Hindi'),
      h('option', { value: 'ar-EG' }, 'Arabic'));
    const vocabulary = h('input', { class: 'input', placeholder: 'e.g. Reachmark, product names, people' });
    const transcribeBtn = h('button', { class: 'btn primary', onclick: runTranscription }, icon('audioLines'), 'Transcribe audio');
    const recordBtn = h('button', { class: 'btn', onclick: toggleRecording }, icon('mic'), 'Record audio');
    const stopBtn = h('button', { class: 'btn', hidden: true, onclick: stopRecording }, icon('square'), 'Stop recording');
    const copyBtn = h('button', { class: 'btn', disabled: true, onclick: copyTranscript }, icon('copy'), 'Copy text');
    const downloadBtn = h('button', { class: 'btn', disabled: true, onclick: downloadTranscript }, icon('download'), 'Download .txt');
    const audioPreview = h('audio', { controls: true, hidden: true, class: 'transcribe-audio-preview' });
    const fileCard = h('button', { class: 'transcribe-file-card', type: 'button', onclick: () => fileInput.click() },
      h('span', { class: 'transcribe-file-icon' }, icon('audioFile')),
      h('span', { class: 'transcribe-file-copy' }, fileName, fileMeta),
      h('span', { class: 'transcribe-file-action' }, icon('upload'), 'Choose file'));
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) selectFile(file);
    });

    function setStatus(message, kind = '') {
      status.textContent = message;
      status.dataset.kind = kind;
    }
    function selectFile(file) {
      if (file.size > MAX_AUDIO) { setStatus('This file is larger than 20 MB. Choose a smaller audio file.', 'error'); return; }
      if (!file.type.startsWith('audio/') && !/\.(wav|mp3|m4a|aac|ogg|webm|flac)$/i.test(file.name)) {
        setStatus('That does not look like a supported audio file.', 'error'); return;
      }
      selectedFile = file;
      fileName.textContent = file.name;
      fileMeta.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB · ' + (file.type || 'audio file');
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      recordedUrl = URL.createObjectURL(file);
      audioPreview.src = recordedUrl;
      audioPreview.hidden = false;
      result.value = '';
      transcript = '';
      copyBtn.disabled = downloadBtn.disabled = true;
      setStatus('Audio ready. Transcription sends this file to Google Gemini for processing.');
    }
    function toBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read this audio file.'));
        reader.onload = () => {
          const value = String(reader.result || '');
          const comma = value.indexOf(',');
          if (comma < 0) reject(new Error('Could not encode this audio file.'));
          else resolve(value.slice(comma + 1));
        };
        reader.readAsDataURL(file);
      });
    }
    async function runTranscription() {
      if (busy) return;
      if (!selectedFile) { fileInput.click(); setStatus('Choose an audio file first.'); return; }
      busy = true;
      transcribeBtn.disabled = true;
      recordBtn.disabled = true;
      setStatus('Preparing audio…');
      try {
        const audioBase64 = await toBase64(selectedFile);
        setStatus('Transcribing with Gemini. Longer recordings can take a little while…');
        const payload = {
          audioBase64,
          mimeType: selectedFile.type || mimeFromName(selectedFile.name),
          mode: mode.value,
          languageCodes: lang.value ? [lang.value] : [],
          customVocabulary: vocabulary.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 100),
        };
        const response = await api('/api/transcribe', { method: 'POST', body: payload });
        transcript = String(response.transcript || '');
        result.value = transcript;
        copyBtn.disabled = downloadBtn.disabled = !transcript;
        setStatus('Transcription complete · ' + transcript.trim().split(/\s+/).filter(Boolean).length + ' words', 'success');
        toast('Transcription complete', 'check');
      } catch (error) {
        setStatus(error.message || 'Transcription failed. Please try again.', 'error');
      } finally {
        busy = false;
        transcribeBtn.disabled = false;
        recordBtn.disabled = false;
      }
    }
    function mimeFromName(name) {
      const ext = name.toLowerCase().split('.').pop();
      return ({ wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', webm: 'audio/webm', flac: 'audio/flac' })[ext] || 'audio/wav';
    }
    async function toggleRecording() {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        setStatus('Recording is not supported in this browser. Choose an audio file instead.', 'error'); return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const supported = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t));
        recorder = supported ? new MediaRecorder(stream, { mimeType: supported }) : new MediaRecorder(stream);
        chunks = [];
        recorder.addEventListener('dataavailable', e => { if (e.data.size) chunks.push(e.data); });
        recorder.addEventListener('stop', () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          stream?.getTracks().forEach(t => t.stop()); stream = null;
          if (blob.size > MAX_AUDIO) { setStatus('Recording exceeded 20 MB. Record a shorter clip.', 'error'); return; }
          const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
          selectFile(new File([blob], 'reachmark-recording.' + ext, { type: blob.type }));
          recordBtn.hidden = false; stopBtn.hidden = true;
          setStatus('Recording saved locally and ready to transcribe.');
        });
        recorder.start();
        recordBtn.hidden = true; stopBtn.hidden = false;
        setStatus('Recording… Tap Stop recording when you are finished.');
      } catch (error) {
        stream?.getTracks().forEach(t => t.stop()); stream = null;
        setStatus(error.name === 'NotAllowedError' ? 'Microphone permission was denied. You can upload a recording instead.' : 'Could not start recording. Please upload an audio file instead.', 'error');
      }
    }
    function stopRecording() { if (recorder && recorder.state !== 'inactive') recorder.stop(); }
    async function copyTranscript() {
      if (!transcript) return;
      try { await navigator.clipboard.writeText(transcript); toast('Transcript copied', 'copy'); }
      catch { result.readOnly = false; result.focus(); result.select(); toast('Select and copy the transcript', 'copy'); result.readOnly = true; }
    }
    function downloadTranscript() {
      if (!transcript) return;
      const url = URL.createObjectURL(new Blob([transcript], { type: 'text/plain;charset=utf-8' }));
      const a = h('a', { href: url, download: (selectedFile?.name || 'transcript').replace(/\.[^.]+$/, '') + '.txt' });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    node.append(
      h('section', { class: 'transcribe-hero' },
        h('div', { class: 'transcribe-eyebrow' }, icon('spark'), ' GEMINI TRANSCRIPTION'),
        h('h1', {}, 'Turn audio into text.'),
        h('p', {}, 'Upload a recording or capture audio from your microphone. Get a transcript you can copy, edit, and download.'),
        h('div', { class: 'transcribe-trust' }, icon('shieldCheck'), 'Your Gemini key stays on the server. Audio is sent to Google for transcription.')),
      h('div', { class: 'transcribe-grid' },
        h('section', { class: 'card transcribe-panel' },
          h('div', { class: 'transcribe-section-head' }, h('div', {}, h('h2', {}, '1. Add your audio'), h('p', { class: 'muted tiny' }, 'Choose a file or record a short clip.')),
            h('span', { class: 'transcribe-step' }, '01')),
          fileCard, fileInput, audioPreview,
          h('div', { class: 'transcribe-settings' },
            h('label', { class: 'transcribe-field' }, h('span', {}, 'Transcription style'), mode),
            h('label', { class: 'transcribe-field' }, h('span', {}, 'Spoken language'), lang),
            h('label', { class: 'transcribe-field' }, h('span', {}, 'Custom words (optional)'), vocabulary)),
          h('div', { class: 'transcribe-actions' }, recordBtn, stopBtn, transcribeBtn),
          h('p', { class: 'transcribe-privacy' }, icon('info'), 'Only transcribe audio you have permission to use. Provider access and billing must be enabled on the server.')),
        h('section', { class: 'card transcribe-panel transcribe-result-panel' },
          h('div', { class: 'transcribe-section-head' }, h('div', {}, h('h2', {}, '2. Your transcript'), h('p', { class: 'muted tiny' }, 'Review the result before using it.')),
            h('span', { class: 'transcribe-step' }, '02')),
          status, result,
          h('div', { class: 'transcribe-actions transcribe-result-actions' }, copyBtn, downloadBtn))),
      h('p', { class: 'transcribe-footnote' }, 'Powered by Gemini transcription · 20 MB maximum per audio file'));
    const cleanup = () => {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      stream?.getTracks().forEach(t => t.stop());
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    window.addEventListener('pagehide', cleanup, { once: true });
  },
};
