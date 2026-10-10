// Reachmark Audio — studio views: dashboard, TTS (with voice translation), changer, clone, design, separation.
import { h, icon, icons, state, save, navigate, toast, sheet, modal, pushHistory, removeHistory, playerNode, emptyState, fmtTime, fmtDate, download, routes, creditsPill, db, api, addVoice, refreshVoices, skel, skelRows, dropdown, setCredits, userMenuBtn, fileTooBig } from './core.js';
import { Player, Recorder, serverTTS, browserSpeak, pickFile, recordBlobToWavData } from './audio.js';

/* ---------- shared data ---------- */
export async function myVoices(force) { if (force) return refreshVoices(); return db.voices; }
let _md = null, _mt = 0;
export async function models() {
  if (!_md || Date.now() - _mt > 30000) { try { _md = (await api('/api/models')).models; _mt = Date.now(); } catch { _md = []; } }
  return _md;
}
export const LANGS = [['auto', '', 'Auto'], ['en', '🇬🇧', 'English'], ['fr', '🇫🇷', 'French'], ['es', '🇪🇸', 'Spanish'], ['de', '🇩🇪', 'German']];
export function langPicker(sel, label = 'Output language · voice translation') {
  const row = h('div', { class: 'pills' });
  const render = () => {
    row.replaceChildren();
    for (const [code, flag, name] of LANGS) {
      row.append(h('button', { class: 'chip' + ((sel.lang || 'auto') === code ? ' on' : ''), onclick: () => { sel.lang = code; render(); } }, flag + ' ' + name));
    }
  };
  render();
  return h('div', {}, h('label', { class: 'fld' }, label), row);
}
export function voicePicker(sel, onpick) {
  const box = h('div', { class: 'pills' });
  const render = async () => {
    box.replaceChildren();
    const [vs, ms] = await Promise.all([myVoices(), models()]);
    const all = [...vs.map(v => ({ id: v.id, label: (v.kind === 'clone' ? '🧬 ' : '') + v.name, mine: true })), ...ms.map(m => ({ id: 'm:' + m.id, label: m.flag + ' ' + m.name }))];
    if (!sel.id && all.length) sel.id = state.defaultVoiceId && vs.some(v => v.id === state.defaultVoiceId) ? state.defaultVoiceId : all[0].id;
    for (const v of all) box.append(h('button', { class: 'chip' + (v.id === sel.id ? ' on' : ''), onclick: () => { sel.id = v.id; render(); onpick?.(v); } }, v.label));
  };
  render();
  return box;
}
export function playerRow(label, url) {
  const p = playerNode();
  const row = h('div', { class: 'stack', style: { gap: '6px' } },
    h('div', { class: 'tiny faint', style: { fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase' } }, label), p.node);
  const pl = new Player(p.canvas, p.pbtn, p.time);
  pl.load(url);
  return { row, pl };
}
export async function postWav(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const credits = res.headers.get('X-Reachmark-Credits'); if (credits) setCredits(+credits);
  if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
  const saved = res.headers.get('X-Reachmark-Url') || null;
  const blob = await res.blob();
  return { blob, url: URL.createObjectURL(blob), savedUrl: saved };
}
export function exprControls(sel) {
  const st = h('input', { type: 'range', min: '-12', max: '12', step: '1', value: sel.semitones });
  const stLab = h('b', {}, (sel.semitones > 0 ? '+' : '') + sel.semitones + ' st');
  st.addEventListener('input', () => { sel.semitones = +st.value; stLab.textContent = (sel.semitones > 0 ? '+' : '') + sel.semitones + ' st'; });
  const rt = h('input', { type: 'range', min: '0.7', max: '1.4', step: '0.05', value: sel.rate });
  const rtLab = h('b', {}, sel.rate.toFixed(2) + '×');
  rt.addEventListener('input', () => { sel.rate = +rt.value; rtLab.textContent = sel.rate.toFixed(2) + '×'; });
  const fxRow = h('div', { class: 'pills' });
  for (const f of ['none', 'robot', 'radio', 'echo']) {
    fxRow.append(h('button', { class: 'chip' + (sel.fx === f ? ' on' : ''), onclick: e => { sel.fx = f; [...fxRow.children].forEach(c => c.classList.remove('on')); e.target.classList.add('on'); } }, f === 'none' ? 'Clean' : f[0].toUpperCase() + f.slice(1)));
  }
  return h('div', { class: 'stack' },
    h('div', { class: 'grid2' },
      h('div', {}, h('label', { class: 'fld' }, 'Pitch ', stLab), st),
      h('div', {}, h('label', { class: 'fld' }, 'Speed ', rtLab), rt)),
    h('label', { class: 'fld' }, 'Expression colour'), fxRow);
}
export const KIND_ICON = { tts: 'text', vc: 'swap', sep: 'separate', dub: 'globe', lip: 'film', clone: 'copy', design: 'wand', agent: 'bot' };

/* ================= DASHBOARD (HOME) ================= */
routes['/home'] = {
  title: 'Dashboard', tab: 'home',
  top: () => ({
    left: h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, creditsPill()),
    actions: [
      h('button', { class: 'iconbtn', html: icons.lifebuoy, 'aria-label': 'Support', onclick: () => navigate('/support') }),
      h('button', { class: 'iconbtn', html: icons.compass, 'aria-label': 'Discover voices', onclick: () => navigate('/discover') }),
    ],
  }),
  view: async ({ node }) => {
    const first = (db.user?.name || 'creator').split(' ')[0];
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const stats = h('div', { class: 'stats', 'data-stag': '' },
      h('div', { class: 'stat' }, h('span', { class: 's-ico' }, icon('spark')), h('b', { class: 'credits-b' }, (db.user?.credits ?? 0).toLocaleString()), h('small', {}, 'credits')),
      h('div', { class: 'stat' }, h('span', { class: 's-ico warm' }, icon('mic')), h('b', {}, String(db.voices.length)), h('small', {}, 'voices · ' + (db.user?.plan === 'plus' ? '10' : '3') + ' slots')),
      h('div', { class: 'stat' }, h('span', { class: 's-ico vio' }, icon('wave')), h('b', {}, String(db.history.length)), h('small', {}, 'renders')),
      h('div', { class: 'stat' }, h('span', { class: 's-ico cyan' }, icon('clock')), h('b', {}, (db.user?.minutes || 0).toFixed(1)), h('small', {}, 'studio minutes')));
    const quick = h('div', { class: 'qgrid', 'data-stag': '' },
      [['/studio/tts', 'text', 'Text to Speech', 'Type it — hear it in any voice, any language'],
       ['/studio/clone', 'copy', 'Voice Match', 'Clone a voice from 10 seconds of audio'],
       ['/studio/changer', 'swap', 'Voice Changer', 'Pitch, timbre and FX chains on any recording'],
       ['/studio/dub', 'globe', 'Dubbing Studio', 'Translate and re-voice video with downloads'],
       ['/studio/lip', 'film', 'Lip Sync', 'Match speech to footage, export WebM'],
       ['/studio/design', 'wand', 'Voice Design', 'Design a new voice from plain traits']]
        .map(([path, ic, label, desc]) => h('button', { class: 'qcard', onclick: () => navigate(path) },
          h('span', { class: 'qi' }, icon(ic)),
          h('span', { class: 'qt' }, h('b', {}, label), h('small', {}, desc)),
          h('span', { class: 'qa', html: icons.chevron }))));
    const hs = h('div', { class: 'hscroll', 'data-stag': '' }, skel({ width: '112px', height: '132px' }), skel({ width: '112px', height: '132px' }));
    (async () => {
      const vs = await myVoices(true);
      hs.replaceChildren(h('button', { class: 'voicecard new', onclick: () => window.__createSheet?.() },
        h('span', { class: 'avatar ghost', style: { background: 'transparent', boxShadow: 'inset 0 0 0 1.5px dashed var(--line2)', width: '52px', height: '52px' } }, icon('plus')),
        h('b', {}, 'New voice')));
      for (const v of vs) {
        const card = h('button', { class: 'voicecard' },
          h('span', { class: 'avatar ' + (v.kind === 'clone' ? 'warm' : v.kind === 'design' ? 'vio' : '') }, v.name[0]?.toUpperCase()),
          h('b', {}, v.name), h('small', {}, v.kind),
          h('span', { class: 'vplay', html: icons.play }));
        card.addEventListener('click', e => {
          if (e.target.closest('.vplay')) { previewVoice(v); return; }
          dropdown(card, [
            { icon: 'play', label: 'Preview voice', onClick: () => previewVoice(v) },
            { icon: 'text', label: 'Use in Text to Speech', onClick: () => { state.defaultVoiceId = v.id; save(); navigate('/studio/tts'); } },
            { icon: 'star', label: 'Set as default', onClick: () => { state.defaultVoiceId = v.id; save(); toast(v.name + ' is now default', 'star'); } },
            '-',
            { icon: 'trash', label: 'Delete voice', danger: true, onClick: async () => { await deleteVoiceWrap(v); card.remove(); } },
          ]);
        });
        hs.append(card);
      }
    })();
    const tabs = ['tts', 'vc', 'sep', 'dub', 'lip', 'clone'];
    const labels = { tts: 'Text to Speech', vc: 'Voice Changer', sep: 'Quick Vocal Remove', dub: 'Dubbing', lip: 'Lip Sync', clone: 'Voice Matches' };
    const pills = h('div', { class: 'pills' });
    const list = h('div', { class: 'stack', style: { marginTop: '10px' } }, skelRows(3));
    let cur = 'tts';
    const renderList = () => {
      list.replaceChildren();
      const items = db.history.filter(x => x.kind === cur);
      if (!items.length) { list.append(emptyState('Create your first ' + labels[cur].toLowerCase() + ' project', 'Everything you render is saved to your account with playback, download and reuse.')); return; }
      for (const it of items) {
        const end = h('div', { class: 'r-end' });
        if (it.url) {
          end.append(h('button', { class: 'iconbtn', html: icons.play, 'aria-label': 'Play', onclick: () => { modal('Playing · ' + it.title, box => { const p = playerNode(); const pl = new Player(p.canvas, p.pbtn, p.time); box.append(p.node); pl.load(it.url).then(() => pl.play()); }); } }));
          end.append(h('button', { class: 'iconbtn', html: icons.download, 'aria-label': 'Download', onclick: () => download(it.url, it.title.replace(/\W+/g, '_') + '.wav') }));
        }
        const rowEl = h('div', { class: 'row' },
          h('div', { class: 'r-ico' }, icon(KIND_ICON[it.kind] || 'wave')),
          h('div', { style: { minWidth: 0 } }, h('b', {}, it.title), h('small', {}, fmtDate(it.at) + (it.meta ? ' · ' + it.meta : ''))), end);
        end.append(h('button', { class: 'iconbtn', html: icons.trash, 'aria-label': 'Delete', onclick: async () => { await removeHistory(it.id); rowEl.remove(); } }));
        list.append(rowEl);
      }
    };
    tabs.forEach(t => pills.append(h('button', { class: 'chip' + (t === cur ? ' on' : ''), onclick: e => { cur = t; [...pills.children].forEach(c => c.classList.remove('on')); e.target.classList.add('on'); renderList(); } }, labels[t])));
    setTimeout(renderList, 250);
    const planLabel = db.user?.plan === 'plus' ? 'Plus plan' : 'Free plan';
    node.append(h('div', { 'data-stag': '' },
      h('div', { class: 'dash-head' },
        h('img', { class: 'dash-logo', src: '/assets/logo-192.png', alt: 'Reachmark Audio' }),
        h('div', { class: 'dh-txt' },
          h('h2', {}, greet + ', ' + first),
          h('p', { class: 'muted tiny' }, new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })),
          h('div', { class: 'dh-tags' },
            h('span', { class: 'tag lime' }, planLabel),
            h('span', { class: 'tag' }, 'Reachmark Digital'))),
        h('button', { class: 'btn primary', onclick: () => navigate('/studio/tts') }, icon('spark'), 'New render')),
      stats,
      h('div', { class: 'sect' }, 'Studios'), quick,
      h('div', { class: 'sect' }, 'My voices'), hs,
      h('div', { class: 'sect' }, 'History'), pills, list));
  },
};
async function previewVoice(v) {
  toast('Previewing ' + v.name, 'wave');
  try { const { url } = await serverTTS({ text: 'Hi, this is ' + v.name + '. My voice lives inside Reachmark Audio.', voiceId: v.id }); const a = new Audio(url); a.play(); }
  catch (e) { toast(e.message, 'close'); }
}
async function deleteVoiceWrap(v) {
  await api('/api/voices/' + v.id, { method: 'DELETE' });
  db.voices = db.voices.filter(x => x.id !== v.id);
  toast(v.name + ' deleted', 'trash');
}

/* ================= TEXT TO SPEECH ================= */
routes['/studio/tts'] = {
  title: 'Text to Speech', tab: 'home',
  top: () => ({ back: true, title: 'Text to Speech', sub: 'Neural synthesis · voice translation' }),
  view: async ({ node }) => {
    const sel = { id: null, semitones: 0, rate: 1, fx: 'none', lang: 'auto' };
    const ta = h('textarea', { class: 'ta', placeholder: 'Type anything… Reachmark speaks it in any voice you own, in any supported language.', maxlength: '2000' }, 'Welcome to Reachmark Audio — one engine, every voice, every language. Clone, design, dub, animate and call.');
    const count = h('span', { class: 'tiny faint' }, '');
    const upd = () => count.textContent = ta.value.length + ' / 2000';
    ta.addEventListener('input', upd); upd();
    const sharedText = sessionStorage.getItem('rm_share_text');
    if (sharedText) { ta.value = sharedText.slice(0, 2000); sessionStorage.removeItem('rm_share_text'); upd(); toast('Shared text loaded into the editor', 'text'); }
    const out = h('div', { class: 'stack' });
    const gen = h('button', { class: 'btn primary block', onclick: async () => {
      if (!ta.value.trim()) return toast('Type something first', 'edit');
      gen.replaceChildren(h('i', { class: 'spin' }), 'Synthesizing…'); gen.disabled = true;
      try {
        const voiceId = sel.id?.startsWith('m:') ? null : sel.id;
        const model = sel.id?.startsWith('m:') ? sel.id.slice(2) : null;
        const { url, savedUrl } = await serverTTS({ text: ta.value, voiceId, model, semitones: sel.semitones, rate: sel.rate, fx: sel.fx, lang: sel.lang, save: true });
        out.replaceChildren();
        const langName = (LANGS.find(l => l[0] === sel.lang) || LANGS[0])[2];
        const { row, pl } = playerRow('Render · ' + langName, url); out.append(row);
        pl.play();
        await pushHistory({ kind: 'tts', title: ta.value.slice(0, 42) + (ta.value.length > 42 ? '…' : ''), url: savedUrl, meta: langName });
        toast('Rendered in ' + langName, 'spark');
      } catch (e) {
        if (/credits/i.test(e.message)) toast(e.message, 'spark');
        else { toast('Engine offline — using device voice', 'wave'); browserSpeak(ta.value, { rate: sel.rate, pitch: 1 + sel.semitones / 12 }); }
      } finally { gen.replaceChildren(icon('spark'), 'Generate speech'); gen.disabled = false; }
    } }, icon('spark'), 'Generate speech');
    const prompts = ['Announce a product launch', 'Bed-time story narrator', 'Movie trailer voice', 'Calm meditation guide'];
    node.append(h('div', { 'data-stag': '' },
      h('label', { class: 'fld' }, 'Script ', count), ta,
      h('div', { class: 'pills', style: { marginTop: '10px' } }, prompts.map(p => h('button', { class: 'chip', onclick: () => { ta.value = p + ': ' + ta.value; upd(); } }, p))),
      h('label', { class: 'fld' }, 'Voice'), voicePicker(sel),
      langPicker(sel),
      exprControls(sel),
      h('div', { style: { height: '16px' } }), gen, out));
  },
};

/* ================= VOICE CHANGER ================= */
routes['/studio/changer'] = {
  title: 'Voice Changer', tab: 'home',
  top: () => ({ back: true, title: 'Voice Changer', sub: 'Core DSP · pitch, timbre & FX' }),
  view: async ({ node }) => {
    const sel = { semitones: 0, rate: 1, fx: 'none' };
    let srcData = null, srcUrl = null;
    const art = h('div', { class: 'hero-art' }, h('span', { html: `
      <svg viewBox="0 0 240 190">
        <defs><linearGradient id="ograd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd9a8"/><stop offset="1" stop-color="#ff8a3c"/></linearGradient></defs>
        <g transform="rotate(-6 80 90)"><path class="bust-a" d="M40 150c0-40 8-78 40-78s40 38 40 78c0 12-8 18-40 18s-40-6-40-18Z"/><circle class="bust-a" cx="80" cy="66" r="26"/></g>
        <g transform="rotate(4 158 96)"><path class="bust-b" d="M112 158c0-42 9-82 46-82s46 40 46 82c0 12-9 19-46 19s-46-7-46-19Z"/><circle class="bust-b" cx="158" cy="70" r="28"/></g>
        <g transform="translate(66 148)"><rect x="0" y="0" width="152" height="26" rx="13" fill="#f4f1e9"/>
          ${[8, 16, 24, 32, 40, 48, 96, 104, 112, 120, 128, 136].map((x, i) => `<rect class="wvbar" x="${x}" y="${7 + (i % 3) * 2}" width="3.4" height="${12 - (i % 3) * 4}" rx="1.7" fill="${x < 60 ? '#8d8779' : '#ff8a3c'}" style="animation-delay:${i * 0.09}s"/>`).join('')}
          <circle cx="72" cy="13" r="12" fill="#151310"/><path d="M67 10h10M67 16h10M70 10v6M74 10v6" stroke="#f4f1e9" stroke-width="1.6"/>
        </g>
      </svg>` }));
    const srcBox = h('div', { class: 'stack' });
    const outBox = h('div', { class: 'stack' });
    const status = h('div', { class: 'center muted tiny', style: { minHeight: '18px' } }, 'No source audio yet');
    async function setSource(blob, label) {
      srcUrl = URL.createObjectURL(blob);
      srcData = await recordBlobToWavData(blob);
      srcBox.replaceChildren();
      const { row, pl } = playerRow('Source · ' + label, srcUrl);
      srcBox.append(row);
      status.textContent = 'Source ready · ' + fmtTime(pl.audio.duration);
      go.classList.add('hot');
    }
    const presets = [['Original', 0], ['Deep', -5], ['Sub', -12], ['Bright', +5], ['Air', +12]];
    const presetRow = h('div', { class: 'pills' });
    presets.forEach(([n, v]) => presetRow.append(h('button', { class: 'chip' + (v === 0 ? ' on' : ''), onclick: e => { sel.semitones = v; [...presetRow.children].forEach(c => c.classList.remove('on')); e.target.classList.add('on'); slider.value = v; sliderLab.textContent = (v > 0 ? '+' : '') + v + ' st'; } }, n)));
    const slider = h('input', { type: 'range', min: '-12', max: '12', value: '0' });
    const sliderLab = h('b', {}, '0 st');
    slider.addEventListener('input', () => { sel.semitones = +slider.value; sliderLab.textContent = (sel.semitones > 0 ? '+' : '') + sel.semitones + ' st'; });
    const go = h('button', { class: 'go', html: icons.arrowUp, 'aria-label': 'Convert', onclick: async () => {
      if (!srcData) return toast('Upload or record first', 'upload');
      go.replaceChildren(h('i', { class: 'spin' }));
      try {
        const { url, savedUrl } = await postWav('/api/voice-change', { audio: srcData, semitones: sel.semitones, rate: sel.rate, fx: sel.fx, save: true });
        outBox.replaceChildren();
        const a = playerRow('Original', srcUrl), b = playerRow('Converted', url);
        outBox.append(a.row, b.row); b.pl.play();
        await pushHistory({ kind: 'vc', title: 'Voice change · ' + (sel.semitones > 0 ? '+' : '') + sel.semitones + 'st ' + (sel.fx !== 'none' ? sel.fx : ''), url: savedUrl, meta: fmtTime(b.pl.audio.duration) });
        toast('Converted on Core DSP · −20 ✦', 'swap');
      } catch (e) { toast(e.message, 'close'); }
      go.replaceChildren(h('span', { html: icons.arrowUp }));
    } });
    const recBtn = h('button', { class: 'btn' }, icon('mic'), 'Record');
    let liveRec = null;
    recBtn.onclick = async () => {
      if (liveRec) { const blob = await liveRec.stop(); liveRec = null; recBtn.replaceChildren(icon('mic'), 'Record'); setSource(blob, 'Recording'); return; }
      try { liveRec = new Recorder(); await liveRec.start(); } catch { return toast('Microphone unavailable — upload instead', 'close'); }
      recBtn.replaceChildren(icon('stop'), 'Stop');
      toast('Recording… tap again to stop', 'mic');
    };
    const dock = h('div', { class: 'dock' },
      h('button', { class: 'btn', onclick: () => pickFile('audio/*', f => { if (!fileTooBig(f)) setSource(f, f.name); }) }, icon('upload'), 'Upload'),
      recBtn, go);
    node.append(h('div', { 'data-stag': '' }, art,
      h('div', { class: 'hero-title' }, 'Voice Changer'),
      h('div', { class: 'hero-sub' }, 'Upload or record audio to convert to a different voice'),
      status, srcBox,
      h('label', { class: 'fld' }, 'Character presets'), presetRow,
      h('label', { class: 'fld' }, 'Fine pitch ', sliderLab), slider,
      exprControls(sel), outBox), dock);
    if (window.__rmLaunchFile) {
      const f = window.__rmLaunchFile; window.__rmLaunchFile = null;
      setSource(f, f.name).catch(e => toast(e.message || 'Could not read that file', 'close'));
    }
  },
};

/* ================= INSTANT VOICE CLONE ================= */
routes['/studio/clone'] = {
  title: 'Voice Match', tab: 'home',
  top: () => ({ back: true, title: 'Voice Match', sub: 'Pitch & pace analysis → nearest neural voice, tuned to you' }),
  view: async ({ node }) => {
    const ring = h('div', { class: 'recring' }, h('button', { class: 'mic', html: icons.mic }));
    const timeLab = h('div', { class: 'rectime' }, 'Tap the mic · 10 seconds is enough');
    const levelBar = h('div', { class: 'progress', style: { maxWidth: '220px', margin: '6px auto' } }, h('i'));
    const srcBox = h('div', { class: 'stack' });
    const nameIn = h('input', { class: 'input', placeholder: 'Voice name (e.g. My narrating voice)' });
    const noteIn = h('input', { class: 'input', placeholder: 'Note — accent, mood, use-case (optional)' });
    let sampleData = null, rec = null, recTimer = null;
    const micBtn = ring.querySelector('.mic');
    micBtn.addEventListener('click', async () => {
      if (rec) {
        clearInterval(recTimer);
        const blob = await rec.stop(); rec = null;
        ring.classList.remove('live'); micBtn.innerHTML = icons.mic;
        sampleData = await recordBlobToWavData(blob);
        srcBox.replaceChildren();
        const { row, pl } = playerRow('Reference sample', URL.createObjectURL(blob));
        srcBox.append(row);
        timeLab.textContent = 'Sample captured · ' + fmtTime(pl.audio.duration);
        cloneBtn.disabled = false;
        return;
      }
      try { rec = new Recorder(lv => { levelBar.firstElementChild.style.width = Math.min(100, lv * 260) + '%'; }); await rec.start(); }
      catch { return toast('Microphone unavailable — upload instead', 'close'); }
      ring.classList.add('live'); micBtn.innerHTML = icons.stop;
      const t0 = Date.now();
      recTimer = setInterval(() => {
        const s = (Date.now() - t0) / 1000;
        timeLab.textContent = 'Recording ' + s.toFixed(1) + 's / 10s';
        if (s >= 10) micBtn.click();
      }, 100);
    });
    const flow = h('div', { class: 'flow' },
      h('div', { class: 'node' }, h('b', {}, 'Sample'), '10s audio'), h('div', { class: 'arr' }, icon('chevron')),
      h('div', { class: 'node' }, h('b', {}, 'Analyse'), 'F0 + pace'), h('div', { class: 'arr' }, icon('chevron')),
      h('div', { class: 'node' }, h('b', {}, 'Profile'), 'pitch · speed · colour'), h('div', { class: 'arr' }, icon('chevron')),
      h('div', { class: 'node' }, h('b', {}, 'Match'), 'nearest neural voice'), h('div', { class: 'arr' }, icon('chevron')),
      h('div', { class: 'node' }, h('b', {}, 'Ready'), 'speaks 5 languages'));
    const cloneBtn = h('button', { class: 'btn lime block', disabled: true, onclick: async () => {
      cloneBtn.replaceChildren(h('i', { class: 'spin' }), 'Matching…'); cloneBtn.disabled = true;
      try {
        const { voice } = await api('/api/clone', { method: 'POST', body: { name: nameIn.value || 'Matched voice', note: noteIn.value, sample: sampleData } });
        await refreshVoices();
        state.defaultVoiceId = voice.id; save();
        await pushHistory({ kind: 'clone', title: voice.name, url: voice.sample, meta: voice.desc });
        modal('Voice matched ✨', (box, close) => {
          box.append(h('p', { class: 'muted' }, voice.name + ' is live. ' + voice.desc + '. It is now your default voice — and it can speak English, French, Spanish and German with your character intact.'),
            h('div', { class: 'stack', style: { marginTop: '12px' } },
              h('button', { class: 'btn primary block', onclick: () => { close(); navigate('/studio/tts'); } }, 'Try it in Text to Speech'),
              h('button', { class: 'btn block', onclick: () => { close(); navigate('/agents'); } }, 'Build an agent with it')));
        });
      } catch (e) { toast(e.message, 'close'); }
      cloneBtn.replaceChildren(icon('copy'), 'Match this voice · 150 ✦'); cloneBtn.disabled = !sampleData;
    } }, icon('copy'), 'Match this voice · 150 ✦');
    node.append(h('div', { 'data-stag': '' },
      h('div', { class: 'card flat muted tiny' }, 'Honest labelling: Voice Match measures the pitch and pace of your sample and tunes the closest neural voice to you — a fast, usable match. True speaker-embedding cloning (XTTS / OpenVoice) plugs into this same endpoint automatically when a GPU engine is attached in Engine Hub.'),
      h('div', { class: 'card flat center' }, ring, levelBar, timeLab,
        h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' } },
          h('button', { class: 'btn sm', onclick: () => pickFile('audio/*', async f => {
            if (fileTooBig(f)) return;
            sampleData = await recordBlobToWavData(f);
            srcBox.replaceChildren();
            const { row, pl } = playerRow('Reference sample', URL.createObjectURL(f));
            srcBox.append(row); cloneBtn.disabled = false;
            timeLab.textContent = 'Sample loaded · ' + fmtTime(pl.audio.duration);
          }) }, icon('upload'), 'Upload sample'))),
      srcBox,
      h('label', { class: 'fld' }, 'Name it'), nameIn, noteIn,
      h('label', { class: 'fld' }, 'Pipeline'), flow,
      cloneBtn));
  },
};

/* ================= VOICE DESIGN ================= */
routes['/studio/design'] = {
  title: 'Voice Design', tab: 'home',
  top: () => ({ back: true, title: 'Voice Design', sub: 'Describe it in plain text' }),
  view: async ({ node }) => {
    const ta = h('textarea', { class: 'ta', placeholder: 'e.g. A warm, deep male narrator with a slow calm pace and a vintage radio colour…' });
    const sugg = ['Warm late-night radio host', 'Energetic young female narrator', 'Calm meditation guide, slow and soft', 'Gravelly villain with echo', 'Bright friendly assistant, fast'];
    const parsed = h('div', { class: 'tagrow' });
    const out = h('div', { class: 'stack' });
    function parse() {
      const t = ta.value.toLowerCase();
      const p = { semitones: 0, rate: 1, fx: 'none', gender: null };
      const tags = [];
      const has = (...w) => w.some(x => t.includes(x));
      if (has('deep', 'low', 'grave')) { p.semitones -= 4; tags.push('deep'); }
      if (has('high', 'bright', 'airy')) { p.semitones += 3; tags.push('bright'); }
      if (has('warm')) { p.semitones -= 2; tags.push('warm'); }
      if (has('female', 'woman', 'girl', 'she')) { p.gender = 'female'; tags.push('female'); }
      if (has('male', 'man', 'boy', 'he')) { p.gender = 'male'; tags.push('male'); }
      if (has('fast', 'energetic', 'quick', 'hype')) { p.rate = 1.15; tags.push('fast'); }
      if (has('slow', 'calm', 'soft', 'gentle')) { p.rate = 0.88; tags.push('slow'); }
      if (has('robot', 'cyborg', 'ai')) { p.fx = 'robot'; tags.push('robot'); }
      if (has('radio', 'vintage', 'retro', 'old')) { p.fx = 'radio'; tags.push('radio'); }
      if (has('echo', 'cave', 'hall')) { p.fx = 'echo'; tags.push('echo'); }
      parsed.replaceChildren(...(tags.length ? tags : ['neutral']).map(x => h('span', {}, x)));
      return p;
    }
    ta.addEventListener('input', parse);
    const prev = h('button', { class: 'btn', onclick: async () => {
      const p = parse();
      const ms = await models();
      const model = (p.gender ? ms.find(m => m.gender === p.gender) : null) || ms[0];
      prev.replaceChildren(h('i', { class: 'spin' }), 'Previewing');
      try {
        const { url } = await serverTTS({ text: 'This is the voice you described. It speaks exactly like this.', model: model?.id, semitones: p.semitones, rate: p.rate, fx: p.fx });
        out.replaceChildren();
        const { row, pl } = playerRow('Preview · ' + (model?.name || 'voice'), url);
        out.append(row); pl.play();
      } catch (e) { toast(e.message, 'close'); }
      prev.replaceChildren(icon('play'), 'Preview voice');
    } }, icon('play'), 'Preview voice');
    const saveBtn = h('button', { class: 'btn primary block', onclick: async () => {
      const p = parse();
      const ms = await models();
      const model = (p.gender ? ms.find(m => m.gender === p.gender) : null) || ms[0];
      try {
        const voice = await addVoice({ kind: 'design', name: (ta.value.slice(0, 34) || 'Designed voice'), desc: ta.value, model: model?.id, semitones: p.semitones, rate: p.rate, fx: p.fx, tags: [...parsed.children].map(c => c.textContent) });
        toast(voice.name + ' saved to My voices', 'star');
        navigate('/home');
      } catch (e) { toast(e.message, 'close'); }
    } }, icon('star'), 'Save to My voices');
    node.append(h('div', { 'data-stag': '' },
      h('label', { class: 'fld' }, 'Describe the voice'), ta,
      h('div', { class: 'pills', style: { marginTop: '10px' } }, sugg.map(s => h('button', { class: 'chip', onclick: () => { ta.value = s; parse(); } }, s))),
      h('label', { class: 'fld' }, 'Interpreted traits'), parsed,
      h('div', { class: 'grid2', style: { marginTop: '18px' } }, prev, h('span')), out, saveBtn));
  },
};

/* ================= AUDIO SEPARATION ================= */
routes['/studio/separate'] = {
  title: 'Quick Vocal Remove', tab: 'home',
  top: () => ({ back: true, title: 'Quick Vocal Remove', sub: 'Center-channel reduction · stereo in' }),
  view: async ({ node }) => {
    const out = h('div', { class: 'stack' });
    const btn = h('button', { class: 'btn primary block', onclick: () => pickFile('audio/*', async f => {
      if (fileTooBig(f)) return;
      btn.replaceChildren(h('i', { class: 'spin' }), 'Separating…'); btn.disabled = true;
      const data = await recordBlobToWavData(f);
      try {
        const j = await api('/api/separate', { method: 'POST', body: { audio: data } });
        out.replaceChildren();
        const a = playerRow('Vocals (center)', j.vocals), b = playerRow('Instrumental (sides)', j.instrumental);
        out.append(a.row, b.row, h('div', { class: 'grid2' },
          h('button', { class: 'btn sm', onclick: () => download(j.vocals, f.name.replace(/\..+$/, '') + '_vocals.wav') }, icon('download'), 'Vocals'),
          h('button', { class: 'btn sm', onclick: () => download(j.instrumental, f.name.replace(/\..+$/, '') + '_instr.wav') }, icon('download'), 'Instrumental')));
        await pushHistory({ kind: 'sep', title: f.name, url: j.vocals, meta: 'vocals + instrumental' });
        toast('Separated · −30 ✦', 'separate');
      } catch (e) { toast(e.message, 'close'); }
      btn.replaceChildren(icon('separate'), 'Choose stereo audio'); btn.disabled = false;
    }) }, icon('separate'), 'Choose stereo audio · 30 ✦');
    node.append(h('div', { 'data-stag': '' },
      h('div', { class: 'card flat muted tiny' }, 'Honest labelling: Quick Vocal Remove uses center-channel reduction — it pulls centered lead vocals out of a stereo mix and leaves a karaoke bus. It shines on mixes with centered vocals; a Demucs-class source-separation engine plugs into this same endpoint when attached.'),
      h('div', { style: { height: '14px' } }), btn, out));
  },
};
