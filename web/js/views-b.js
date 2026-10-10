// Reachmark Audio — explore views: discover, dubbing, lip sync, agents, calls, account, support, engines.
import { h, icon, icons, state, save, navigate, toast, sheet, modal, pushHistory, playerNode, emptyState, fmtTime, fmtDate, download, routes, creditsPill, applyTheme, db, api, addAgent, deleteAgent, refreshAgents, syncUser, skelRows, dropdown, userMenuBtn, fileTooBig, routeCleanup, verifySheet } from './core.js';
import { Player, serverTTS, browserSpeak, pickFile, LipRenderer, AC } from './audio.js';
import { myVoices, models, voicePicker, playerRow, exprControls, LANGS, langPicker } from './views-a.js';

/* ================= DISCOVER ================= */
const TRENDING = [
  { name: 'Super Smash Bros. 4/Ultimate Announcer', flag: '🇺🇸', tags: ['Male', 'Old', 'Character voice', 'Entertainment'], av: 'vio', p: { semitones: -6, rate: 1.05, fx: 'echo' } },
  { name: 'Guyzo', flag: '🇮🇹', tags: ['Male', 'Old', 'Narration', 'Advertising'], av: 'warm', p: { semitones: -3, rate: 0.95 } },
  { name: 'Verity', flag: '🇺🇸', tags: ['Male', 'Young', 'Conversational', 'Character voice'], av: '', p: { semitones: 2, rate: 1.08 } },
  { name: 'Verity Noir', flag: '🇺🇸', tags: ['Male', 'Middle-aged', 'Character voice', 'Entertainment'], av: 'warm', p: { semitones: -2, rate: 1.0 } },
  { name: 'Mortal Kombat', flag: '🇺🇸', tags: ['Male', 'Old', 'Character voice', 'Deep', 'Low'], av: 'vio', p: { semitones: -9, rate: 0.9, fx: 'echo' } },
];
const RECOMMENDED = [
  { name: 'ALEX_CHIKNA', flag: '🇺🇸', tags: ['Male', 'Middle-aged', 'Social media', 'Entertainment'], av: '', p: { semitones: 1, rate: 1.12 } },
  { name: 'ÉLITE Narrator', flag: '🇫🇷', tags: ['Male', 'Middle-aged', 'Narration', 'Confident'], av: 'warm', p: { model: 'fr_FR-siwis-medium', semitones: -8, rate: 0.95 } },
  { name: 'Sofía Cálida', flag: '🇪🇸', tags: ['Female', 'Young', 'Audiobook', 'Warm'], av: '', p: { model: 'es_ES-davefx-medium', semitones: 6, rate: 0.95 } },
  { name: 'Berlin Stimme', flag: '🇩🇪', tags: ['Male', 'Old', 'Broadcast', 'Deep'], av: 'vio', p: { model: 'de_DE-thorsten-medium', semitones: -2, rate: 0.92 } },
];
routes['/discover'] = {
  title: 'Discover Voices', tab: 'discover',
  top: () => ({ back: true, title: 'Discover Voices', sub: 'Worldwide catalogue' }),
  view: async ({ node }) => {
    const slots = db.user?.plan === 'plus' ? 10 : 3;
    const search = h('input', { class: 'input', placeholder: 'Search voices…', style: { borderRadius: '999px' } });
    const listWrap = h('div', { class: 'stack' }, skelRows(4));
    const addVoice = async (d) => {
      const ms = await models();
      const model = d.p.model || (ms.find(m => m.gender === (d.tags[0] === 'Female' ? 'female' : 'male')) || ms[0])?.id;
      try {
        const v = await addVoiceToCloud({ kind: 'discover', name: d.name, desc: d.tags.join(' · '), model, semitones: d.p.semitones || 0, rate: d.p.rate || 1, fx: d.p.fx || 'none', tags: d.tags });
        toast(v.name + ' added to My voices', 'star');
      } catch (e) { toast(e.message, 'close'); }
    };
    const row = (d) => h('div', { class: 'row' },
      h('span', { class: 'avatar ' + d.av }, d.name[0]),
      h('div', { style: { minWidth: 0, flex: 1 } },
        h('b', {}, d.name, ' ', h('span', { class: 'flag' }, d.flag)),
        h('small', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' } }, d.tags.join(' · '))),
      h('button', { class: 'iconbtn', html: icons.plus, 'aria-label': 'Add voice', onclick: () => addVoice(d) }));
    const render = () => {
      const q = search.value.toLowerCase();
      const f = arr => arr.filter(d => !q || d.name.toLowerCase().includes(q) || d.tags.join(' ').toLowerCase().includes(q));
      listWrap.replaceChildren();
      const t = f(TRENDING), r = f(RECOMMENDED);
      if (t.length) listWrap.append(h('div', { class: 'sect' }, 'Trending'), h('div', { class: 'stack', 'data-stag': '' }, t.map(row)),
        h('button', { class: 'btn block', style: { marginTop: '12px' }, onclick: e => { e.target.remove(); listWrap.append(h('div', { class: 'sect' }, 'Recommended'), h('div', { class: 'stack', 'data-stag': '' }, r.map(row))); } }, 'More'));
      else if (r.length) listWrap.append(h('div', { class: 'sect' }, 'Recommended'), h('div', { class: 'stack', 'data-stag': '' }, r.map(row)));
      else listWrap.append(emptyState('No voices match', 'Try another search term.'));
    };
    search.addEventListener('input', render);
    setTimeout(render, 200);
    node.append(h('div', { 'data-stag': '' },
      h('div', { class: 'row', style: { border: 0, padding: '6px 0 14px' } },
        h('div', {}, h('b', {}, 'My Voices'), h('small', {}, db.voices.length + '/' + slots + ' slots used on ' + (db.user?.plan === 'plus' ? 'Plus' : 'Free'))),
        h('div', { class: 'r-end' }, h('span', { class: 'badge' }, db.voices.length + '/' + slots))),
      h('div', { class: 'row tap', style: { borderRadius: '18px', background: 'var(--surface2)', padding: '12px 14px' }, onclick: () => window.__createSheet?.() },
        h('span', { class: 'avatar', style: { background: 'var(--pill)', color: 'var(--pill-ink)' } }, icon('plus')),
        h('div', {}, h('b', {}, 'Create new voice'), h('small', {}, 'Design or match a voice in seconds')),
        h('div', { class: 'r-end' }, icon('chevron'))),
      h('div', { style: { position: 'sticky', top: '0', zIndex: 4, padding: '12px 0', background: 'color-mix(in srgb, var(--canvas) 86%, transparent)', backdropFilter: 'blur(10px)', display: 'flex', gap: '8px' } },
        search, h('button', { class: 'iconbtn', html: icons.filter, onclick: () => sheet('Filter voices', b => { b.append(h('p', { class: 'muted tiny' }, 'Gender, age, use-case and language filters sync with the worldwide catalogue on Plus.')); }) })),
      listWrap));
  },
};
const addVoiceToCloud = payload => api('/api/voices', { method: 'POST', body: payload }).then(r => { db.voices.push(r.voice); return r.voice; });

/* ================= DUBBING ================= */
routes['/studio/dub'] = {
  title: 'Dubbing Studio', tab: 'home',
  top: () => ({ back: true, title: 'Dubbing Studio', sub: 'One script · every language' }),
  view: async ({ node }) => {
    const ms = await models();
    const lines = h('div', { class: 'stack' });
    const takes = h('div', { class: 'stack' });
    const data = [
      { text: 'Welcome to Reachmark Audio — your story, in every language.', lang: 'en_US-lessac-medium' },
      { text: 'Bienvenue dans Reachmark Audio — votre histoire, dans toutes les langues.', lang: 'fr_FR-siwis-medium' },
      { text: 'Bienvenido a Reachmark Audio: tu historia, en todos los idiomas.', lang: 'es_ES-davefx-medium' },
    ];
    const langSel = (val) => {
      const s = h('select', { class: 'input' });
      ms.forEach(m => s.append(h('option', { value: m.id, selected: m.id === val ? true : null }, m.flag + ' ' + m.name + ' · ' + m.tag)));
      return s;
    };
    const renderLines = () => {
      lines.replaceChildren();
      data.forEach((d, i) => {
        const ta = h('textarea', { class: 'ta', style: { minHeight: '64px' } }, d.text);
        ta.addEventListener('input', () => d.text = ta.value);
        const sel = langSel(d.lang); sel.addEventListener('change', () => d.lang = sel.value);
        lines.append(h('div', { class: 'card flat' },
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' } },
            h('span', { class: 'badge' }, 'Take ' + (i + 1)), h('span', { class: 'spacer' }),
            h('button', { class: 'iconbtn', html: icons.trash, onclick: () => { data.splice(i, 1); renderLines(); } })),
          ta, sel));
      });
      lines.append(h('button', { class: 'btn sm', onclick: () => { data.push({ text: '', lang: ms[0]?.id }); renderLines(); } }, icon('plus'), 'Add line'));
    };
    renderLines();
    const prog = h('div', { class: 'progress' }, h('i'));
    const pls = [];
    const renderBtn = h('button', { class: 'btn primary block', onclick: async () => {
      takes.replaceChildren(); pls.length = 0; renderBtn.disabled = true;
      const urls = [];
      for (let i = 0; i < data.length; i++) {
        const d = data[i]; if (!d.text.trim()) continue;
        prog.firstElementChild.style.width = Math.round((i / data.length) * 100) + '%';
        renderBtn.replaceChildren(h('i', { class: 'spin' }), 'Rendering take ' + (i + 1) + '/' + data.length);
        try {
          const { url, savedUrl } = await serverTTS({ text: d.text, model: d.lang, save: true });
          urls.push(savedUrl);
          const { row, pl } = playerRow('Take ' + (i + 1) + ' · ' + (ms.find(m => m.id === d.lang)?.name || d.lang), url);
          pls.push(pl);
          takes.append(row, h('button', { class: 'btn sm', onclick: () => download(savedUrl, 'dub_take_' + (i + 1) + '.wav') }, icon('download'), 'Download take'));
        } catch (e) { toast('Take ' + (i + 1) + ' failed: ' + e.message, 'close'); }
      }
      prog.firstElementChild.style.width = '100%';
      if (urls.length) await pushHistory({ kind: 'dub', title: data.length + ' takes · multilingual dub', url: urls[0], meta: data.length + ' languages' });
      toast('Dub package rendered', 'globe');
      renderBtn.replaceChildren(icon('globe'), 'Render all takes'); renderBtn.disabled = false;
    } }, icon('globe'), 'Render all takes');
    const seqBtn = h('button', { class: 'btn block', onclick: async () => {
      if (!pls.length) return toast('Render takes first', 'globe');
      seqBtn.disabled = true;
      for (const pl of pls) { pl.audio.currentTime = 0; await new Promise(r => { pl.audio.onended = r; pl.play(); }); }
      seqBtn.disabled = false;
    } }, icon('play'), 'Play sequence');
    node.append(h('div', { 'data-stag': '' },
      h('div', { class: 'card flat muted tiny' }, 'Write the script once per language, or let the same line be performed by different neural voices. Takes render server-side and stay in your History.'),
      h('label', { class: 'fld' }, 'Script lines'), lines,
      h('div', { style: { height: '14px' } }), prog, h('div', { style: { height: '10px' } }),
      renderBtn, h('label', { class: 'fld' }, 'Takes'), takes, seqBtn));
  },
};

/* ================= LIP SYNC ================= */
routes['/studio/lip'] = {
  title: 'Lip Sync Studio', tab: 'home',
  top: () => ({ back: true, title: 'Lip Sync Studio', sub: 'Audio-driven character performance' }),
  view: async ({ node }) => {
    const canvas = h('canvas');
    const stage = h('div', { class: 'stage' }, canvas, h('span', { class: 'badge' }, h('span', { class: 'dot on' }), 'LIVE PREVIEW'));
    const ren = new LipRenderer(canvas, 0);
    const scenes = h('div', { class: 'pills' }, ['Sunset', 'Studio', 'Noir'].map((s, i) =>
      h('button', { class: 'chip' + (i === 0 ? ' on' : ''), onclick: e => { ren.scene = i; [...e.target.parentNode.children].forEach(c => c.classList.remove('on')); e.target.classList.add('on'); } }, s)));
    const p = playerNode();
    const pl = new Player(p.canvas, p.pbtn, p.time);
    let srcReady = false;
    const ta = h('textarea', { class: 'ta', style: { minHeight: '70px' } }, 'Hey! I am a Reachmark character. Feed me any line and watch my lips, brows and blinks follow every syllable.');
    const status = h('div', { class: 'tiny faint center' }, 'Load audio or synthesize a line, then press play.');
    async function useUrl(url) { await pl.load(url); pl.attachAnalyser(); srcReady = true; status.textContent = 'Source ready — press play to perform.'; playBtn.classList.add('hot'); }
    const playBtn = h('button', { class: 'btn lime', onclick: () => { if (srcReady) { pl.playing ? pl.pause() : pl.play(); } else toast('Load a source first', 'film'); } }, icon('play'), 'Perform');
    const exportBtn = h('button', { class: 'btn', onclick: () => {
      if (!srcReady) return toast('Nothing to export yet', 'film');
      try {
        const cs = canvas.captureStream(30);
        const dest = AC.createMediaStreamDestination();
        pl.attachAnalyser(); pl._el.connect(dest);
        const rec = new MediaRecorder(cs, { mimeType: 'video/webm' });
        const chunks = [];
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = async () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          await pushHistory({ kind: 'lip', title: 'Lip sync performance', url: null, meta: 'webm export ready' });
          modal('Performance exported', box => box.append(
            h('video', { src: url, controls: true, style: { width: '100%', borderRadius: '14px' } }),
            h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: () => download(url, 'reachmark_lipsync.webm') }, icon('download'), 'Download .webm')));
        };
        rec.start();
        pl.audio.currentTime = 0; pl.play();
        pl.audio.onended = () => setTimeout(() => rec.state !== 'inactive' && rec.stop(), 300);
        toast('Recording performance…', 'film');
      } catch (e) { toast('Export unsupported here: ' + e.message, 'close'); }
    } }, icon('download'), 'Export video');
    let last = performance.now();
    const loop = t => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      ren.resize?.();
      const lv = srcReady && pl.playing && pl.an ? pl.level() : { rms: 0, centroid: 0.3 };
      ren.frame(dt, pl.playing ? lv.rms : 0, lv.centroid);
      requestAnimationFrame(loop);
    };
    ren.resize(); requestAnimationFrame(loop);
    node.append(h('div', { 'data-stag': '' }, stage,
      h('div', { class: 'grid2', style: { marginTop: '12px' } }, playBtn, exportBtn),
      h('label', { class: 'fld' }, 'Scene'), scenes,
      h('label', { class: 'fld' }, 'Performance source'), p.node, status,
      h('div', { class: 'stack', style: { marginTop: '10px' } },
        ta,
        h('div', { class: 'grid2' },
          h('button', { class: 'btn sm', onclick: async e => {
            e.target.replaceChildren(h('i', { class: 'spin' }), 'Synth…');
            try { const { url } = await serverTTS({ text: ta.value, voiceId: state.defaultVoiceId }); await useUrl(url); } catch (err) { toast(err.message, 'close'); }
            e.target.replaceChildren(icon('spark'), 'Synthesize line');
          } }, icon('spark'), 'Synthesize line'),
          h('button', { class: 'btn sm', onclick: () => pickFile('audio/*', f => { if (!fileTooBig(f)) useUrl(URL.createObjectURL(f)); }) }, icon('upload'), 'Upload audio')))));
  },
};

/* ================= AGENTS ================= */
routes['/agents'] = {
  title: 'Character Agents', tab: 'agents',
  top: () => ({ title: 'Character Agents', sub: 'Persona-driven voices that talk & call' }),
  view: async ({ node }) => {
    const list = h('div', { class: 'stack', 'data-stag': '' }, skelRows(2, '86px'));
    const render = () => {
      list.replaceChildren();
      if (!db.agents.length) list.append(emptyState('No agents yet', 'Build a character with a name, role, knowledge and voice — then chat or call it.'));
      db.agents.forEach(a => {
        const btns = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          h('button', { class: 'iconbtn', html: icons.phone, 'aria-label': 'Call', onclick: () => navigate('/call/' + a.id) }),
          h('button', { class: 'iconbtn', html: icons.send, 'aria-label': 'Chat', onclick: () => navigate('/agent/' + a.id) }));
        const card = h('div', { class: 'card', style: { display: 'flex', gap: '13px', alignItems: 'center' } },
          h('span', { class: 'avatar ' + (a.av || '') }, icons[a.emoji] ? h('span', { class: 'avico', html: icons[a.emoji] }) : (a.emoji || a.name[0]?.toUpperCase())),
          h('div', { style: { flex: 1, minWidth: 0 } },
            h('b', {}, a.name, a.system ? h('span', { class: 'badge', style: { marginLeft: '8px', color: 'var(--lime)', borderColor: 'color-mix(in srgb, var(--lime) 40%, transparent)' } }, 'PLATFORM AI') : null),
            h('small', { class: 'muted', style: { display: 'block' } }, a.role),
            h('div', { class: 'tagrow' }, (a.knowledge || []).slice(0, 3).map(k => h('span', {}, k.slice(0, 22))))),
          btns,
          h('button', { class: 'iconbtn', html: icons.chevD, 'aria-label': 'More', onclick: e => dropdown(e.currentTarget, [
            { icon: 'send', label: 'Open chat', onClick: () => navigate('/agent/' + a.id) },
            { icon: 'phone', label: 'Voice call', onClick: () => navigate('/call/' + a.id) },
            ...a.system ? [] : ['-', { icon: 'trash', label: 'Delete agent', danger: true, onClick: async () => { await deleteAgent(a.id); render(); toast(a.name + ' deleted', 'trash'); } }],
          ]) }));
        list.append(card);
      });
    };
    refreshAgents().then(render);
    const builder = () => sheet('Create Character Agent', (box, close) => {
      const name = h('input', { class: 'input', placeholder: 'Name — e.g. Amara, Reachmark concierge' });
      const role = h('input', { class: 'input', placeholder: 'Role — e.g. Customer care lead for Reachmark Digital' });
      const persona = h('textarea', { class: 'ta', style: { minHeight: '80px' }, placeholder: 'Personality & tone — warm, concise, playful…' });
      const know = h('textarea', { class: 'ta', style: { minHeight: '80px' }, placeholder: 'Knowledge base, one fact per line:\nHours are 9am-6pm WAT\nPricing starts at $25/month\nWe support voice cloning and dubbing' });
      const greet = h('input', { class: 'input', placeholder: 'Greeting — e.g. Hi! Amara here, how can I help?' });
      const vSel = { id: state.defaultVoiceId };
      const AVATARS = ['micStudio', 'bot', 'user', 'star', 'film', 'wave', 'phone', 'wand'];
      const pick = { emoji: AVATARS[db.agents.length % AVATARS.length], traits: new Set() };
      const avRow = h('div', { class: 'pills' });
      const drawAv = () => avRow.replaceChildren(...AVATARS.map(e => h('button', { class: 'chip avchip' + (pick.emoji === e ? ' on' : ''), 'aria-label': e, onclick: () => { pick.emoji = e; drawAv(); } }, icon(e))));
      drawAv();
      const TRAITS = [['warm', 'Warm'], ['playful', 'Playful'], ['concise', 'Concise'], ['formal', 'Formal'], ['witty', 'Witty'], ['calm', 'Calm'], ['hype', 'High-energy'], ['empathetic', 'Empathetic']];
      const trRow = h('div', { class: 'pills' });
      const drawTr = () => trRow.replaceChildren(...TRAITS.map(([t, l]) => h('button', { class: 'chip' + (pick.traits.has(t) ? ' on' : ''), onclick: () => { pick.traits.has(t) ? pick.traits.delete(t) : pick.traits.add(t); drawTr(); } }, l)));
      drawTr();
      const langSel = { lang: 'auto' };
      box.append(h('label', { class: 'fld' }, 'Name'), name,
        h('label', { class: 'fld' }, 'Avatar'), avRow,
        h('label', { class: 'fld' }, 'Role'), role,
        h('label', { class: 'fld' }, 'Personality traits'), trRow,
        h('label', { class: 'fld' }, 'Persona'), persona,
        h('label', { class: 'fld' }, 'Knowledge base'), know,
        h('label', { class: 'fld' }, 'Voice'), voicePicker(vSel),
        h('label', { class: 'fld' }, 'Language'), langPicker(langSel),
        h('label', { class: 'fld' }, 'Greeting'), greet,
        h('button', { class: 'btn primary block', style: { marginTop: '18px' }, onclick: async () => {
          if (!name.value.trim()) return toast('Give the agent a name', 'edit');
          try {
            const traits = [...pick.traits];
            const personaTxt = [persona.value.trim(), traits.length ? 'Traits: ' + traits.join(', ') + '.' : ''].filter(Boolean).join(' ');
            const a = await addAgent({ name: name.value.trim(), role: role.value.trim() || 'Reachmark assistant', persona: personaTxt, traits, emoji: pick.emoji, language: langSel.lang, knowledge: know.value.split('\n').map(s => s.trim()).filter(Boolean), greeting: greet.value.trim() || ('Hi, ' + name.value.trim() + ' here! How can I help?'), voiceId: vSel.id?.startsWith('m:') ? null : vSel.id, model: vSel.id?.startsWith('m:') ? vSel.id.slice(2) : null, av: ['', 'warm', 'vio'][db.agents.length % 3] });
            render(); close();
            toast(a.name + ' is live', 'bot');
            navigate('/agent/' + a.id);
          } catch (e) { toast(e.message, 'close'); }
        } }, icon('bot'), 'Create agent'));
    });
    node.append(h('div', { 'data-stag': '' },
      h('button', { class: 'btn lime block', onclick: builder }, icon('plus'), 'New character agent'),
      h('div', { class: 'sect' }, 'Your agents'), list));
  },
};

/* ---------- chat ---------- */
routes['/agent/:id'] = {
  title: 'Agent chat', tab: 'agents',
  top: (p) => ({ back: true, title: db.agents.find(a => a.id === p.split('/')[2])?.name || 'Agent', sub: 'Character chat · speaks with its voice', actions: [h('button', { class: 'iconbtn', html: icons.phone, onclick: () => navigate('/call/' + p.split('/')[2]) })] }),
  view: async ({ node, params }) => {
    const a = db.agents.find(x => x.id === params[0]);
    if (!a) return node.append(emptyState('Agent not found'));
    const log = h('div', { class: 'stack', style: { paddingBottom: '8px' } });
    let speakOn = true;
    const addBub = (who, text) => {
      log.append(h('div', { class: 'bub ' + who }, h('small', {}, who === 'ag' ? a.name : 'You'), text));
      $('#view').scrollTop = 9e6;
    };
    const say = async (text) => {
      addBub('ag', text);
      if (!speakOn) return;
      try { const { url } = await serverTTS({ text, voiceId: a.voiceId, model: a.model, lang: a.language || state.lang }); const au = new Audio(url); au.play(); }
      catch { browserSpeak(text); }
    };
    const inp = h('input', { class: 'input', placeholder: 'Message ' + a.name + '…', style: { borderRadius: '999px' } });
    let hist = [];
    const send = async () => {
      const t = inp.value.trim(); if (!t) return;
      inp.value = ''; addBub('me', t);
      const typing = h('div', { class: 'bub ag' }, h('span', { class: 'eq', style: { color: 'var(--lime)' } }, [0, 1, 2, 3, 4].map(() => h('i'))));
      log.append(typing); $('#view').scrollTop = 9e6;
      try {
        const r = await api('/api/agent/chat', { method: 'POST', body: { agentId: a.id, message: t, history: hist } });
        hist = hist.concat([{ role: 'user', content: t }, { role: 'assistant', content: r.content }]).slice(-12);
        typing.remove(); await say(r.content);
      } catch (e) { typing.remove(); addBub('ag', 'Connection hiccup — ' + e.message); }
    };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    setTimeout(() => say(a.greeting), 500);
    node.append(h('div', {}, log,
      h('div', { style: { position: 'sticky', bottom: '0', display: 'flex', gap: '8px', padding: '12px 0', background: 'color-mix(in srgb, var(--canvas) 88%, transparent)', backdropFilter: 'blur(10px)' } },
        h('button', { class: 'iconbtn on', html: icons.wave, onclick: e => { speakOn = !speakOn; e.currentTarget.classList.toggle('on', speakOn); toast(speakOn ? 'Voice on' : 'Voice muted', 'wave'); } }),
        inp, h('button', { class: 'iconbtn solid', html: icons.send, onclick: send }))));
  },
};

/* ---------- call ---------- */
routes['/call/:id'] = {
  title: 'Voice call', tab: 'agents',
  top: () => null,
  view: async ({ node, params }) => {
    const a = db.agents.find(x => x.id === params[0]);
    if (!a) return node.append(emptyState('Agent not found'));
    const stage = h('div', { class: 'callstage' });
    const log = h('div', { class: 'calllog' });
    const stat = h('div', { class: 'callstat' }, 'Connecting…');
    let secs = 0, timer = null, muted = false, speaker = true, ended = false;
    const say = async (text) => {
      log.append(h('div', { class: 'bub ag' }, h('small', {}, a.name), text));
      log.scrollTop = 9e6;
      if (!speaker) return;
      try { const { url } = await serverTTS({ text, voiceId: a.voiceId, model: a.model, lang: a.language || state.lang }); const au = new Audio(url); au.play(); } catch { browserSpeak(text); }
    };
    const meSay = (text) => { log.append(h('div', { class: 'bub me' }, h('small', {}, 'You'), text)); log.scrollTop = 9e6; };
    const micBtn = h('button', { class: 'iconbtn on', html: icons.mic });
    const spkBtn = h('button', { class: 'iconbtn on', html: icons.wave });
    const endBtn = h('button', { class: 'iconbtn end', html: icons.phoneOff });
    micBtn.onclick = () => { muted = !muted; micBtn.classList.toggle('on', !muted); micBtn.innerHTML = muted ? icons.micStudio : icons.mic; toast(muted ? 'Mic muted' : 'Mic live', 'mic'); };
    spkBtn.onclick = () => { speaker = !speaker; spkBtn.classList.toggle('on', speaker); toast(speaker ? 'Speaker on' : 'Speaker off', 'wave'); };
    endBtn.onclick = () => {
      if (ended) return; ended = true; clearInterval(timer);
      try { rec?.stop(); } catch {}
      navigate('/agents');
      toast('Call ended · ' + fmtTime(secs), 'phoneOff');
    };
    stage.append(
      h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
        h('button', { class: 'iconbtn', html: icons.close, onclick: () => navigate('/agents') }),
        h('span', { class: 'badge' }, 'REACHMARK CALL')),
      h('div', { class: 'ringwrap' }, h('span', { class: 'halo' }), h('span', { class: 'halo' }), h('span', { class: 'avatar ' + (a.av || ''), style: { fontSize: '34px' } }, icons[a.emoji] ? h('span', { class: 'avico big', html: icons[a.emoji] }) : (a.emoji || a.name[0]))),
      h('div', { class: 'callname' }, a.name), stat, log,
      h('div', { class: 'callbar' }, micBtn, endBtn, spkBtn));
    node.append(stage);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec = null, callHist = [];
    const agentTurn = async (text) => {
      meSay(text);
      try {
        const r = await api('/api/agent/chat', { method: 'POST', body: { agentId: a.id, message: text, history: callHist } });
        callHist = callHist.concat([{ role: 'user', content: text }, { role: 'assistant', content: r.content }]).slice(-12);
        await say(r.content);
      } catch (e) { await say('Sorry — the line crackled: ' + e.message); }
    };
    if (SR) {
      rec = new SR(); rec.continuous = true; rec.interimResults = false; rec.lang = navigator.language;
      rec.onresult = e => { const t = e.results[e.results.length - 1][0].transcript; if (!muted && t.trim()) agentTurn(t.trim()); };
      rec.onend = () => { if (!ended) try { rec.start(); } catch {} };
    } else {
      const inp = h('input', { class: 'input', placeholder: 'Type to talk…', style: { borderRadius: '999px', margin: '0 0 10px' } });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && inp.value.trim()) { agentTurn(inp.value.trim()); inp.value = ''; } });
      stage.insertBefore(inp, stage.lastElementChild);
    }
    setTimeout(() => {
      stat.textContent = '0:00'; timer = setInterval(() => { secs++; stat.textContent = fmtTime(secs); }, 1000);
      say(a.greeting);
      try { rec?.start(); } catch {}
    }, 1400);
  },
};

/* ================= SUPPORT CENTER ================= */
routes['/support'] = {
  title: 'Support Center', tab: 'account',
  top: () => ({ back: true, title: 'Support Center', sub: 'Live help, worldwide' }),
  view: async ({ node }) => {
    const faq = [
      ['How does Voice Match work?', 'Create → Voice Match. Record 10 seconds in a quiet room (or upload a clean sample) and the analyser measures your pitch and pace, then tunes the nearest neural voice to you. It is a fast voice match — true speaker-embedding cloning plugs into the same endpoint when a GPU engine is attached.'],
      ['How does voice translation work?', 'Your voice character (pitch, pace, colour) is stored as a profile. In Text to Speech, pick an output language — English, French, Spanish or German — and the same character performs in that language.'],
      ['What do credits cover?', 'New accounts get 10,000 credits. TTS ≈ 1 per 40 characters, voice change 20, Voice Match 150, Quick Vocal Remove 30, dubbing 15 per take. Failed renders refund automatically. Your balance is in the top bar.'],
      ['What is Quick Vocal Remove?', 'A center-channel reduction for stereo mixes: it extracts a centered-vocal bus and a karaoke bus. Best on mixes with centered lead vocals; a Demucs-class engine plugs into the same endpoint when attached.'],
      ['Can I use renders commercially?', 'Free plan renders are for evaluation. The Plus plan (Account → Upgrade, one 7-day trial per account) includes commercial use, 200 minutes and 10 voice slots.'],
      ['My microphone is blocked.', 'Browsers require permission per site. Allow microphone in site settings, then retry — or upload an audio file instead (20 MB max); every studio accepts uploads.'],
    ];
    const faqBox = h('div', { class: 'stack', style: { gap: '8px' } });
    faq.forEach(([q, ans]) => {
      const body = h('div', { class: 'faq-a' }, ans);
      const head = h('button', { class: 'faq-q', onclick: () => { const open = body.classList.toggle('open'); head.classList.toggle('open', open); } }, h('span', {}, q), icon('chevD'));
      faqBox.append(h('div', { class: 'card flat', style: { padding: '0' } }, head, body));
    });
    node.append(h('div', { 'data-stag': '' },
      h('div', { class: 'card', style: { background: 'linear-gradient(140deg, color-mix(in srgb, var(--lime) 14%, var(--card)), var(--card))' } },
        h('div', { style: { display: 'flex', gap: '13px', alignItems: 'center' } },
          h('span', { class: 'avatar', style: { background: 'var(--lime)', color: '#171a09' } }, icon('lifebuoy')),
          h('div', {}, h('b', { style: { fontSize: '17px' } }, 'We are here for you'), h('small', { class: 'muted' }, 'Average first response: instant with the Guide · under 24h by email')))),
      h('div', { class: 'sect' }, 'Talk to us'),
      h('div', { class: 'row tap', onclick: () => navigate('/support/chat') }, h('div', { class: 'r-ico' }, icon('send')), h('div', {}, h('b', {}, 'Live chat'), h('small', {}, 'Start with the Guide bot · escalate to a human anytime')), h('div', { class: 'r-end' }, h('span', { class: 'dot on' }), icon('chevron'))),
      h('div', { class: 'row tap', onclick: () => navigate('/agent/guide') }, h('div', { class: 'r-ico' }, icon('bot')), h('div', {}, h('b', {}, 'Guide agent chat'), h('small', {}, 'Character chat with Reachmark Guide — knows every studio')), h('div', { class: 'r-end' }, icon('chevron'))),
      h('div', { class: 'row tap', onclick: () => navigate('/call/guide') }, h('div', { class: 'r-ico' }, icon('phone')), h('div', {}, h('b', {}, 'Support session'), h('small', {}, 'Voice call with the Guide agent')), h('div', { class: 'r-end' }, icon('chevron'))),
      h('div', { class: 'row tap', onclick: () => location.href = 'mailto:reachmarkofficial@gmail.com' }, h('div', { class: 'r-ico' }, icon('mail')), h('div', {}, h('b', {}, 'reachmarkofficial@gmail.com'), h('small', {}, 'General & account enquiries')), h('div', { class: 'r-end' }, icon('external'))),
      h('div', { class: 'row tap', onclick: () => location.href = 'mailto:support@reachmarkdigital.com' }, h('div', { class: 'r-ico' }, icon('mail')), h('div', {}, h('b', {}, 'support@reachmarkdigital.com'), h('small', {}, 'Technical support & billing')), h('div', { class: 'r-end' }, icon('external'))),
      h('div', { class: 'sect' }, 'The fine print'),
      h('div', { class: 'row tap', onclick: () => navigate('/terms') }, h('div', { class: 'r-ico' }, icon('doc')), h('div', {}, h('b', {}, 'Terms of Service'), h('small', {}, 'Plain-language terms · Reachmark Digital')), h('div', { class: 'r-end' }, icon('chevron'))),
      h('div', { class: 'row tap', onclick: () => navigate('/privacy') }, h('div', { class: 'r-ico' }, icon('lock')), h('div', {}, h('b', {}, 'Privacy Policy'), h('small', {}, 'What we collect, where it lives, your controls')), h('div', { class: 'r-end' }, icon('chevron'))),
      h('div', { class: 'sect' }, 'Frequently asked'), faqBox));
  },
};

/* ---------- live support chat: Guide bot → human handoff (SSE) ---------- */
routes['/support/chat'] = {
  title: 'Live support', tab: 'account',
  top: () => ({ back: true, title: 'Live support', sub: 'Guide bot first · humans on call, worldwide' }),
  view: async ({ node }) => {
    const log = h('div', { class: 'stack', style: { paddingBottom: '8px' } });
    const modeChip = h('span', { class: 'badge' }, 'GUIDE BOT');
    const typingLine = h('small', { class: 'muted', style: { minHeight: '16px', display: 'block', padding: '0 4px' } }, '');
    let thread = null, human = false, guideHist = [], missCount = 0, poll = null, es = null, lastTypingSent = 0;
    const scroll = () => { $('#view').scrollTop = 9e6; };
    const bub = (who, text, meta) => {
      const b = h('div', { class: 'bub ' + who }, who === 'sys' ? null : h('small', {}, who === 'me' ? 'You' : (human ? 'Support team' : 'Reachmark Guide')), h('span', {}, text), meta ? h('small', { class: 'muted', style: { display: 'block', textAlign: 'right', fontSize: '10px' } }, meta) : null);
      log.append(b); scroll(); return b;
    };
    const setMode = () => {
      modeChip.textContent = !thread ? 'GUIDE BOT' : ('HUMAN · ' + thread.status.toUpperCase());
      modeChip.style.color = thread ? 'var(--lime)' : '';
      modeChip.style.borderColor = thread ? 'color-mix(in srgb, var(--lime) 40%, transparent)' : '';
    };
    const markMine = (m) => bub('me', m.text, m.readAt ? '✓✓ read' : '✓ sent');
    const clock = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const renderAdmin = (m) => bub('ag', m.text, clock(m.createdAt) + (m.sender === 'bot' ? ' · bot' : ''));

    const loadState = async () => {
      try {
        const j = await api('/api/support/state');
        thread = j.thread; human = !!thread; setMode();
        log.replaceChildren();
        if (!thread) {
          bub('ag', 'Hi! I am the Reachmark Guide — ask me anything about the studios, credits or your account. Prefer a person? Tap “Talk to a human” below.');
        } else {
          j.messages.forEach(m => m.sender === 'user' ? markMine(m) : renderAdmin(m));
          if (thread.status === 'closed') bub('sys', 'This conversation was closed. Tap “Talk to a human” to reopen it.');
          api('/api/support/read', { method: 'POST', body: {} }).catch(() => {});
        }
      } catch {}
    };
    const escalate = async (subject) => {
      try {
        const j = await api('/api/support/escalate', { method: 'POST', body: { subject: subject || 'Support request' } });
        thread = j.thread; human = true; setMode();
        renderAdmin(j.message);
        toast('Connected to the support team', 'lifebuoy');
      } catch (e) { toast(e.message, 'close'); }
    };
    const sendHuman = async (t) => {
      try {
        const j = await api('/api/support/message', { method: 'POST', body: { text: t } });
        thread = j.thread; setMode();
      } catch (e) { bub('sys', e.message); }
    };
    const sendGuide = async (t) => {
      const typing = h('div', { class: 'bub ag' }, h('span', { class: 'eq', style: { color: 'var(--lime)' } }, [0, 1, 2, 3, 4].map(() => h('i'))));
      log.append(typing); scroll();
      try {
        const r = await api('/api/agent/chat', { method: 'POST', body: { agentId: 'guide', message: t, history: guideHist } });
        guideHist = guideHist.concat([{ role: 'user', content: t }, { role: 'assistant', content: r.content }]).slice(-12);
        typing.remove();
        bub('ag', r.content);
        try { const { url } = await serverTTS({ text: r.content.slice(0, 300), voiceId: null, model: null }); const au = new Audio(url); au.volume = 0.9; au.play().catch(() => {}); } catch {}
        if (r.source === 'local' && /not in my brief|do not have|beyond my notes/i.test(r.content)) {
          missCount++;
          if (missCount >= 2) { missCount = 0; bub('sys', 'The Guide could not answer that — handing you to a human.'); await escalate(t.slice(0, 60)); }
        } else missCount = 0;
      } catch (e) { typing.remove(); bub('sys', e.message); }
    };
    const inp = h('input', { class: 'input', placeholder: 'Write a message…', style: { borderRadius: '999px' } });
    const send = async () => { const t = inp.value.trim(); if (!t) return; inp.value = ''; bub('me', t); human ? sendHuman(t) : sendGuide(t); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    inp.addEventListener('input', () => { if (human && thread && Date.now() - lastTypingSent > 2500) { lastTypingSent = Date.now(); api('/api/support/typing', { method: 'POST', body: {} }).catch(() => {}); } });
    const humanBtn = h('button', { class: 'btn sm', onclick: () => escalate(inp.value.trim().slice(0, 60) || 'Support request') }, icon('lifebuoy'), 'Talk to a human');

    /* realtime: SSE with auto-reconnect, polling fallback on repeated errors */
    const startStream = () => {
      try {
        es = new EventSource('/api/support/stream');
        let errs = 0;
        es.onerror = () => { errs++; if (errs >= 3 && es) { es.close(); es = null; startPoll(); } };
        es.onopen = () => { errs = 0; if (poll) { clearInterval(poll); poll = null; } };
        es.addEventListener('message', ev => {
          const m = JSON.parse(ev.data);
          if (!thread || m.threadId !== thread.id) return;
          renderAdmin(m);
          api('/api/support/read', { method: 'POST', body: {} }).catch(() => {});
        });
        es.addEventListener('typing', () => { typingLine.textContent = 'Support is typing…'; clearTimeout(window._stt); window._stt = setTimeout(() => typingLine.textContent = '', 4000); });
        es.addEventListener('state', ev => { const s = JSON.parse(ev.data); if (thread) { thread.status = s.status; setMode(); } });
      } catch { startPoll(); }
    };
    const startPoll = () => { if (!poll) poll = setInterval(loadState, 5000); };
    startStream();
    routeCleanup.push(() => { if (es) es.close(); es = null; if (poll) clearInterval(poll); poll = null; clearTimeout(window._stt); });

    await loadState();
    node.append(h('div', {},
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 2px 10px' } }, modeChip, h('div', { style: { flex: 1 } }), humanBtn),
      log, typingLine,
      h('div', { style: { position: 'sticky', bottom: '0', display: 'flex', gap: '8px', padding: '12px 0', background: 'color-mix(in srgb, var(--canvas) 88%, transparent)', backdropFilter: 'blur(10px)' } },
        inp, h('button', { class: 'iconbtn solid', html: icons.send, onclick: send }))));
  },
};

/* ================= LEGAL — Terms & Privacy (public) ================= */
function legalView(title, updated, intro, sections) {
  return async ({ node }) => {
    const doc = h('div', { class: 'card', style: { maxWidth: '760px', margin: '0 auto', padding: '26px 24px', lineHeight: 1.65 } },
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '6px' } },
        h('span', { class: 'logo' }, icon('micStudio')),
        h('div', {}, h('b', { style: { fontSize: '19px' } }, title), h('small', { class: 'muted', style: { display: 'block' } }, 'Reachmark Audio · a product of Reachmark Digital · updated ' + updated))),
      h('p', { class: 'muted', style: { fontSize: '14px' } }, intro),
      ...sections.map(([head, paras]) => h('div', { style: { marginTop: '18px' } },
        h('b', { style: { fontSize: '15px' } }, head),
        ...paras.map(t => h('p', { style: { fontSize: '13.8px', margin: '7px 0 0', color: 'var(--muted)' } }, t)))),
      h('div', { class: 'tiny faint', style: { marginTop: '22px', borderTop: '1px solid var(--line)', paddingTop: '14px' } },
        'Questions about this document? ', h('a', { class: 'maillink', href: 'mailto:support@reachmarkdigital.com' }, 'support@reachmarkdigital.com'), ' · ', h('a', { class: 'maillink', href: 'mailto:reachmarkofficial@gmail.com' }, 'reachmarkofficial@gmail.com'), h('br'), '© ' + new Date().getFullYear() + ' Reachmark Digital. Reachmark Audio is a product of Reachmark Digital.'));
    node.append(h('div', { 'data-stag': '' }, doc));
  };
}
routes['/terms'] = {
  title: 'Terms of Service', public: true,
  top: () => ({ back: true, title: 'Terms of Service', sub: 'Reachmark Audio · Reachmark Digital' }),
  view: legalView('Terms of Service', 'October 2026',
    'These terms govern your use of Reachmark Audio (the "Service"), a web and desktop application operated by Reachmark Digital ("we", "us"). By creating an account or using the Service you agree to these terms. Please read them — they are written in plain language on purpose.',
    [
      ['1. The Service', [
        'Reachmark Audio provides neural text-to-speech, voice translation, Voice Match (pitch/pace matching of a neural voice to your sample), a voice changer, dubbing, lip sync tools and persona-driven character agents that chat and call using synthesized voice.',
        'Features labelled "Voice Match" and "Quick Vocal Remove" are honest about their current engines: Voice Match tunes the nearest neural voice to your sample (true speaker-embedding cloning activates automatically if a GPU engine is attached), and Quick Vocal Remove is centre-channel reduction for stereo mixes. We do not charge for capabilities we cannot deliver.',
      ]],
      ['2. Accounts & credits', [
        'You must provide a valid email address and keep your password confidential. New accounts receive 10,000 credits; credits are a licence to consume compute, not money, and are non-transferable and non-refundable to cash.',
        'Charges are applied server-side before rendering and refunded automatically and in full if a render fails. Current costs are shown in-app (Support Center → FAQs and Site announcements).',
        'The Plus plan includes one 7-day trial per account, enforced server-side. Trials convert to Free automatically at expiry — we never charge a card silently, because we do not hold cards.',
      ]],
      ['3. Acceptable use', [
        'You may not: clone or synthesize a real person\'s voice without their consent; generate unlawful, defamatory, harassing or deceptive content; impersonate individuals or institutions; resell the Service; probe, overload or reverse-engineer the infrastructure; or use support channels for abuse.',
        'You are responsible for the rights to any audio or text you upload. We may suspend or delete accounts that breach these terms — suspension is always notified by email with a human review path via support@reachmarkdigital.com.',
      ]],
      ['4. Your content', [
        'You keep ownership of the text and audio you upload and of the renders you create. You grant us only the limited licence needed to process them (synthesize, store and serve them back to you).',
        'Renders and voice samples are stored on our hosting provider\'s encrypted-at-rest volumes and are visible only to your account. Admin staff can access a specific sample or render only through a deliberate, click-confirmed action that is written to an audit log.',
      ]],
      ['5. Character agents & AI replies', [
        'Agent replies are generated by AI (our on-device persona brain, or a connected language model where configured) and can be wrong. Agents are not licensed professionals; do not rely on them for legal, medical or financial advice.',
        'Chat and call usage is metered in credits as shown in-app. The built-in Reachmark Guide (platform assistant) and human support conversations are free.',
      ]],
      ['6. Availability, maintenance & changes', [
        'We run maintenance windows and may disable individual studios via site controls; the Service is provided "as is" and "as available" without warranties to the maximum extent permitted by law.',
        'We may update these terms; material changes are announced in-app. Continued use after a change constitutes acceptance. If we ever discontinue the Service, we will give notice by email and export options where feasible.',
      ]],
      ['7. Liability', [
        'To the maximum extent permitted by law, Reachmark Digital\'s total liability arising from the Service is limited to the credits purchased or granted to your account in the three (3) months preceding the claim. We are not liable for indirect or consequential losses.',
      ]],
      ['8. Governing law & contact', [
        'These terms are governed by the laws of the Federal Republic of Nigeria, without prejudice to mandatory consumer protections in your country of residence. Disputes should first be raised in good faith with support@reachmarkdigital.com — a human responds to every message.',
        'Reachmark Digital operates Reachmark Audio worldwide; general enquiries: reachmarkofficial@gmail.com.',
      ]],
    ]),
};
routes['/privacy'] = {
  title: 'Privacy Policy', public: true,
  top: () => ({ back: true, title: 'Privacy Policy', sub: 'Reachmark Audio · Reachmark Digital' }),
  view: legalView('Privacy Policy', 'October 2026',
    'Reachmark Audio is a product of Reachmark Digital. This policy explains what we collect, why, where it lives and the controls you have. Short version: we collect the minimum needed to run a voice studio, we do not sell data, and we do not run advertising or third-party analytics trackers.',
    [
      ['1. What we collect', [
        'Account data: name, email address, a salted scrypt hash of your password (never the password itself), plan, credit balance, processed-audio minutes and signup/last-seen timestamps.',
        'Content you create: uploaded audio samples, renders, voice profiles, character agents and studio history entries — stored under your account.',
        'Support data: live-chat threads and messages with our team, including internal notes; conversation metadata (status, assignee, timestamps).',
        'Operational data: session cookies, rate-limit counters, and — for staff actions only — an audit log (who did what, to which target, from which IP, when).',
      ]],
      ['2. What we do NOT collect', [
        'No advertising identifiers, no third-party analytics or tracking pixels, no cross-site cookies, no payment card data (there are no card payments), no contacts, no location beyond the coarse IP used for rate limiting and abuse prevention.',
      ]],
      ['3. How we use it', [
        'To operate the Service: authenticate you, meter credits, synthesize and store your audio, deliver support, secure the platform (rate limits, lockouts, suspension) and improve reliability.',
        'Emails: we send transactional messages only — welcome, password reset, password-change notice, support replies while you are offline, and account-status notices. There is no marketing newsletter; if we ever add one it will be opt-in.',
        'If a language-model provider is configured for character agents, the text of your agent messages (not your account data) is sent to that provider to produce the reply; with no provider configured, replies are generated on our own servers.',
      ]],
      ['4. Where data lives & who processes it', [
        'Data is stored in a SQLite database and file volumes attached to our hosting provider (Render / Railway infrastructure, EU or your chosen region). Emails are delivered via our SMTP provider (Google Workspace/Gmail infrastructure) using an authenticated app password.',
        'Staff access is role-based, requires two-factor authentication, and every access to user content (including listening to a sample) is click-confirmed and audit-logged.',
      ]],
      ['5. Retention & deletion', [
        'Account data persists while your account exists. Deleting your account (via support request or an admin action you initiate) removes your profile, sessions, voices, agents, history, renders and support threads. Rate-limit and audit records are retained briefly for security compliance.',
        'Password-reset links expire after 30 minutes and are single-use. Sessions expire and can be force-ended from Account.',
      ]],
      ['6. Your rights & controls', [
        'Access, correction, export and erasure: email support@reachmarkdigital.com from your account address and a human will action it. You can also delete individual voices, agents and history entries in-app at any time.',
        'Cookies: we use one essential HttpOnly session cookie (and a separate admin cookie for staff). Blocking it means you cannot stay signed in.',
        'Children: the Service is intended for users aged 13+; accounts of younger children will be removed on notice.',
      ]],
      ['7. Security', [
        'Passwords: async scrypt with per-user salts and constant-time comparison. Transport: HTTPS/TLS everywhere in deployment. Sessions: HttpOnly, SameSite cookies; admin sessions add SameSite=Strict, 8-hour expiry and mandatory TOTP two-factor authentication.',
        'No system is perfectly secure; we notify affected users by email if a breach materially affects their data.',
      ]],
      ['8. Contact & changes', [
        'Privacy questions and requests: support@reachmarkdigital.com (data protection) or reachmarkofficial@gmail.com (general). Material changes to this policy are announced in-app before they take effect.',
      ]],
    ]),
};

/* ================= ACCOUNT ================= */
routes['/account'] = {
  title: 'Account', tab: 'account',
  top: () => ({ back: true, title: 'Account' }),
  view: async ({ node }) => {
    const u = db.user;
    const themeVal = h('span', {}, state.theme[0].toUpperCase() + state.theme.slice(1));
    const cycle = () => { const o = ['system', 'dark', 'light']; state.theme = o[(o.indexOf(state.theme) + 1) % 3]; save(); applyTheme(); themeVal.textContent = state.theme[0].toUpperCase() + state.theme.slice(1); };
    const LANGN = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', yo: 'Yoruba' };
    const langVal = h('span', {}, LANGN[state.lang] || 'English');
    const trialDays = u?.trialEnds ? Math.max(0, Math.ceil((u.trialEnds - Date.now()) / 864e5)) : 0;
    const upgradeCard = u?.plan === 'plus'
      ? h('div', { class: 'upcard' },
          h('div', { class: 'art' }, h('span', { class: 'tag' }, u.trialEnds ? 'Plus trial · ' + trialDays + ' days left' : 'Plus active'), h('h3', {}, 'You are creating without limits')),
          h('div', { class: 'body' }, ...['200 minutes generation', 'Voice Design access', '10 private voice slots', 'Commercial use allowed'].map(t => h('div', { class: 'perk' }, icon('check'), t))))
      : h('div', { class: 'upcard' },
          h('div', { class: 'art' }, h('span', { class: 'tag' }, 'Upgrade to Plus'), h('h3', {}, 'Unleash your creativity')),
          h('div', { class: 'body' },
            ...['Up to 200 minutes generation', 'Access to Voice Design', '10 private voice slots', 'Commercial use allowed'].map(t => h('div', { class: 'perk' }, icon('check'), t)),
            h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: () => modal('Upgrade to Plus', (box, close) => box.append(
              h('p', { class: 'muted' }, 'Plus includes 200 minutes of generation, 10 private voice slots, priority Voice Design and commercial licensing worldwide.'),
              h('div', { class: 'stack', style: { marginTop: '12px' } },
                h('button', { class: 'btn lime block', onclick: async () => {
                  try { await api('/api/plan/trial', { method: 'POST' }); await syncUser(); close(); toast('Plus trial started · 7 days', 'spark'); navigate('/account'); }
                  catch (e) { toast(e.message, 'close'); }
                } }, icon('spark'), 'Start 7-day Plus trial'),
                h('button', { class: 'btn block', onclick: () => location.href = 'mailto:support@reachmarkdigital.com?subject=Reachmark%20Audio%20Plus' }, icon('mail'), 'Contact sales')))), }, 'Upgrade')));
    const verCard = h('div', { class: 'card', style: { display: 'flex', gap: '12px', alignItems: 'center' } },
      h('span', { class: 'avatar', style: { background: u?.verified ? 'var(--lime)' : 'var(--orange)', color: '#171a09' } }, icon(u?.verified ? 'check' : 'mail')),
      h('div', { style: { flex: '1', minWidth: 0 } },
        h('b', {}, u?.verified ? 'Email verified' : 'Email not verified yet'),
        h('small', { class: 'muted', style: { display: 'block' } }, u?.verified ? u.email + ' · confirmed — you are all set.' : 'We sent a verification link and a 6-digit code to ' + u.email + '.')),
      u?.verified ? h('span', { class: 'badge', style: { color: 'var(--lime)', borderColor: 'color-mix(in srgb, var(--lime) 40%, transparent)' } }, 'VERIFIED')
        : h('button', { class: 'btn sm primary', onclick: () => verifySheet() }, icon('mail'), 'Verify now'));
    node.append(h('div', { 'data-stag': '' },
      verCard,
      h('div', { class: 'procard' },
        h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center' } },
          h('span', { html: `<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#cff05a"/><circle cx="32" cy="32" r="30" fill="none" stroke="#f4f1e9" stroke-width="3"/><text x="32" y="43" font-size="34" font-weight="900" text-anchor="middle" fill="#151310" font-family="system-ui">R</text><circle cx="47" cy="17" r="4" fill="#151310"/></svg>` }),
          h('div', { style: { minWidth: 0 } }, h('b', { style: { fontSize: '19px' } }, u?.name), h('small', { class: 'muted', style: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' } }, u?.email))),
        h('div', { class: 'inner' },
          h('span', {}, 'My Team'), h('span', { class: 'badge' }, u?.plan === 'plus' ? 'Plus' : 'Free'),
          h('span', { class: 'spacer' }), h('span', { class: 'credits' }, icon('spark'), h('b', { class: 'credits-b' }, (u?.credits ?? 0).toLocaleString())))),
      h('div', { style: { height: '14px' } }), upgradeCard,
      h('div', { class: 'sect' }, 'Preferences'),
      h('div', { class: 'row tap', onclick: cycle }, h('div', { class: 'r-ico' }, icon('moon')), h('div', {}, h('b', {}, 'Appearance')), h('div', { class: 'r-end' }, themeVal, icon('chevron'))),
      h('div', { class: 'row tap', onclick: e => dropdown(e.currentTarget, Object.entries(LANGN).map(([code, name]) => ({ icon: 'globe', label: name, onClick: () => { state.lang = code; save(); langVal.textContent = name; toast('Interface language saved', 'globe'); } }))) }, h('div', { class: 'r-ico' }, icon('globe')), h('div', {}, h('b', {}, 'Language')), h('div', { class: 'r-end' }, langVal, icon('chevron'))),
      h('div', { class: 'row tap', onclick: () => navigate('/support') }, h('div', { class: 'r-ico' }, icon('lifebuoy')), h('div', {}, h('b', {}, 'Support Center'), h('small', {}, 'Live chat, support sessions, email')), h('div', { class: 'r-end' }, icon('chevron'))),
      h('div', { class: 'row tap', onclick: () => navigate('/engines') }, h('div', { class: 'r-ico' }, icon('cpu')), h('div', {}, h('b', {}, 'Engine Hub'), h('small', {}, 'Merged runtime status')), h('div', { class: 'r-end' }, icon('chevron'))),
      h('div', { class: 'row tap', onclick: () => toast('Opening community…', 'discord') }, h('div', { class: 'r-ico' }, icon('discord')), h('div', {}, h('b', {}, 'Discord')), h('div', { class: 'r-end' }, icon('chevron'))),
      h('div', { class: 'row tap', onclick: () => toast('Opening profile…', 'instagram') }, h('div', { class: 'r-ico' }, icon('instagram')), h('div', {}, h('b', {}, 'Instagram')), h('div', { class: 'r-end' }, icon('chevron'))),
      h('div', { class: 'row tap', onclick: () => modal('Terms of Service', b => b.append(h('p', { class: 'muted tiny' }, 'Reachmark Audio. Generated voices are for your licensed use; clone only voices you have rights to. GPU engine adapters (RTVC, MockingBird, ChatterBox) activate when torch runtimes are present. Support: support@reachmarkdigital.com.'))) }, h('div', { class: 'r-ico' }, icon('doc')), h('div', {}, h('b', {}, 'Terms of Service')), h('div', { class: 'r-end' }, icon('chevron'))),
      h('div', { style: { height: '18px' } }),
      h('button', { class: 'btn danger block', onclick: async () => { const { logout } = await import('./core.js'); logout(); } }, icon('logout'), 'Log out'),
      h('div', { class: 'center faint tiny', style: { padding: '22px 0' } }, 'Reachmark Audio 1.1 · Worldwide', h('br'), 'reachmarkofficial@gmail.com · support@reachmarkdigital.com')));
  },
};

/* ================= ENGINE HUB ================= */
routes['/engines'] = {
  title: 'Engine Hub', tab: 'account',
  top: () => ({ back: true, title: 'Engine Hub', sub: 'Five repos · one merged runtime' }),
  view: async ({ node }) => {
    const list = h('div', { class: 'stack', 'data-stag': '' }, skelRows(4, '96px'));
    (async () => {
      const { engines } = await api('/api/engines');
      list.replaceChildren(...engines.map(e => h('div', { class: 'eng' },
        h('div', { class: 'e-ico' }, icon(e.id === 'piper' ? 'wave' : e.id === 'rtvc' ? 'copy' : e.id === 'mockingbird' ? 'bot' : e.id === 'chatterbox' ? 'wand' : e.id === 'voicestudio' ? 'layers' : 'cpu')),
        h('div', { style: { minWidth: 0 } }, h('b', {}, e.name), h('small', {}, e.role),
          h('div', { class: 'tagrow' }, e.components.map(c => h('span', {}, c))),
          h('small', { class: 'faint', style: { marginTop: '6px', display: 'block' } }, e.repo)),
        h('div', { class: 'st' }, h('span', { class: 'dot ' + (e.state === 'online' ? 'on' : e.state === 'standby' ? 'standby' : e.state === 'merged' ? 'on' : 'off') }), e.state))));
    })();
    node.append(h('div', { 'data-stag': '' },
      h('div', { class: 'card flat' },
        h('b', {}, 'Merged pipeline'),
        h('div', { class: 'flow', style: { marginTop: '10px' } },
          h('div', { class: 'node' }, h('b', {}, 'Input'), 'text · sample · media'), h('div', { class: 'arr' }, icon('chevron')),
          h('div', { class: 'node' }, h('b', {}, 'Piper TTS'), 'neural voices'), h('div', { class: 'arr' }, icon('chevron')),
          h('div', { class: 'node' }, h('b', {}, 'Core DSP'), 'pitch · FX · separate'), h('div', { class: 'arr' }, icon('chevron')),
          h('div', { class: 'node' }, h('b', {}, 'Studios'), 'dub · lip · agents'), h('div', { class: 'arr' }, icon('chevron')),
          h('div', { class: 'node' }, h('b', {}, 'Output'), 'wav · webm · call')),
        h('p', { class: 'faint tiny', style: { marginTop: '8px' } }, 'GPU slots (RTVC / MockingBird / ChatterBox) hot-swap in when a torch runtime is detected — the CPU chain above keeps every feature live today.')),
      h('div', { class: 'sect' }, 'Imported engines'), list));
  },
};
