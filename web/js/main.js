// Reachmark Audio — boot: session, chrome (sidebar/tabbar), splash, create sheet, support FAB, command palette.
import { h, icon, icons, state, save, navigate, routes, renderRoute, sheet, toast, applyTheme, bootAuth, db, modal, logout, api } from './core.js';
import './views-a.js';
import './views-b.js';
import { welcomeSheet } from './auth.js';
import { mountAurora } from './gl-bg.js';

/* ---------- splash ---------- */
const splash = h('div', { id: 'splash' },
  h('div', { class: 'sl' },
    h('span', { class: 'logo logo-img brand-mark', html: icons.brandMark, 'aria-label': 'Reachmark Audio' }),
    h('h1', {}, 'Reachmark Audio'),
    h('p', {}, 'The AI voice studio'),
    h('small', { style: { color: 'var(--faint)', fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase' } }, 'by Reachmark Digital'),
    h('div', { class: 'bars' }, [0, 1, 2, 3, 4].map(() => h('i', { style: { height: '10px' } })))));
document.body.append(splash);

// Restrained ambient shader: desktop only, with CSS fallback on mobile/low-data devices.
const bgRoot = document.querySelector('#bg');
const motionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowData = navigator.connection?.saveData === true;
if (bgRoot && matchMedia('(min-width: 960px) and (pointer: fine)').matches && !motionReduced && !lowData) {
  const auroraCanvas = document.createElement('canvas');
  auroraCanvas.className = 'aurora-canvas';
  auroraCanvas.setAttribute('aria-hidden', 'true');
  bgRoot.prepend(auroraCanvas);
  mountAurora(auroraCanvas, { scale: 0.7, amplitude: 0.48, scrollEl: () => document.querySelector('#view') });
}

/* ---------- sidebar ---------- */
const NAV = [
  ['Studio', [
    ['/studio/tts', 'audioLines', 'Text to Speech', 'Type it — any voice, any language'],
    ['/studio/changer', 'audioWaveform', 'Voice Changer', 'Pitch, timbre & FX chains'],
    ['/studio/clone', 'fingerprint', 'Voice Match', 'Clone a voice from 10 seconds'],
    ['/studio/design', 'wandSparkles', 'Voice Design', 'Design a voice from plain traits'],
    ['/studio/dub', 'languages', 'Dubbing Studio', 'Translate & re-voice video'],
    ['/studio/lip', 'video', 'Lip Sync Studio', 'Match speech to footage'],
    ['/studio/separate', 'sliders', 'Quick Vocal Remove', 'Strip vocals from stereo mixes']]],
  ['Explore', [
    ['/discover', 'compass', 'Discover Voices', 'Browse the shared voice library'],
    ['/agents', 'bot', 'Character Agents', 'Personas that chat & call']]],
  ['Help', [['/support', 'lifebuoy', 'Support Center', 'Live chat & support sessions']]],
  ['System', [
    ['/engines', 'cpu', 'Engine Hub', 'Engine status & merge map'],
    ['/account', 'userRound', 'Account', 'Plan, credits & security']]],
];
const sb = document.querySelector('#sidebar');
sb.append(h('div', { class: 'brand' },
  h('span', { class: 'logo logo-img brand-mark', html: icons.brandMark, 'aria-label': 'Reachmark Audio' }),
  h('div', {}, h('b', {}, 'Reachmark Audio'), h('span', {}, 'by Reachmark Digital'))));
for (const [label, items] of NAV) {
  sb.append(h('div', { class: 'navlabel' }, label));
  for (const [path, ic, name, desc] of items) sb.append(h('button', { class: 'navitem', dataset: { path }, onclick: () => navigate(path) }, icon(ic), h('span', { class: 'nv-txt' }, h('b', {}, name), h('small', {}, desc))));
}
sb.append(h('div', { class: 'side-foot' },
  h('div', { class: 'card flat', style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 15px' } },
    icon('spark'), h('div', { style: { flex: 1 } }, h('b', { class: 'credits-b', style: { fontSize: '15px' } }, '0'), h('small', { class: 'faint', style: { display: 'block' } }, 'credits')),
    h('button', { class: 'iconbtn', html: icons.logout, 'aria-label': 'Log out', onclick: () => logout() })),
  h('div', { class: 'tiny faint', style: { padding: '10px 6px 0' } }, 'v1.3 · a Reachmark Digital product · worldwide · support@reachmarkdigital.com')));

/* ---------- tabbar ---------- */
const tb = document.querySelector('#tabbar');
const TABS = [['home', 'panelsTopLeft', 'Home', '/home'], ['create', 'plus', 'Create', null], ['discover', 'compass', 'Voices', '/discover'], ['agents', 'bot', 'Agents', '/agents'], ['account', 'userRound', 'Account', '/account']];
for (const [key, ic, label, path] of TABS) tb.append(h('button', { class: 'tab', dataset: { tab: key }, onclick: () => path ? navigate(path) : createSheet() }, icon(ic), label));

/* ---------- support FAB ---------- */
const fabSupport = h('button', { class: 'fab-support', 'aria-label': 'Support Center', onclick: () => navigate('/support') }, icon('lifebuoy'));
document.body.append(fabSupport);

/* ---------- create sheet ---------- */
export function createSheet() {
  sheet('Create', (box, close) => {
    const rows = [
      ['audioLines', 'Text to Speech', 'Type it, hear it in any voice & language', '/studio/tts'],
      ['fingerprint', 'Voice Match', 'Match a neural voice to you from 10s of audio', '/studio/clone'],
      ['wandSparkles', 'Voice Design', 'Describe the voice in plain text.', '/studio/design'],
      ['audioWaveform', 'Voice Changer', 'Upload or record, convert the voice', '/studio/changer'],
      ['languages', 'Dubbing Studio', 'One script, every language', '/studio/dub'],
      ['video', 'Lip Sync Studio', 'Animate a character with audio', '/studio/lip'],
      ['sliders', 'Quick Vocal Remove', 'Center-channel vocal reduction (stereo)', '/studio/separate'],
      ['bot', 'Character Agent', 'Build a persona that talks & calls', '/agents'],
    ];
    for (const [ic, b, s, path] of rows) {
      box.append(h('div', { class: 'row tap', onclick: () => { close(); setTimeout(() => navigate(path), 120); } },
        h('div', { class: 'r-ico' }, icon(ic)),
        h('div', {}, h('b', {}, b), h('small', {}, s)),
        h('div', { class: 'r-end' }, icon('chevron'))));
    }
  });
}
window.__createSheet = createSheet;

/* ---------- command palette ---------- */
function palette() {
  const actions = [
    ['Go to Dashboard', 'panelsTopLeft', () => navigate('/home')],
    ['Text to Speech', 'audioLines', () => navigate('/studio/tts')],
    ['Instant Voice Clone', 'fingerprint', () => navigate('/studio/clone')],
    ['Voice Changer', 'audioWaveform', () => navigate('/studio/changer')],
    ['Voice Design', 'wandSparkles', () => navigate('/studio/design')],
    ['Dubbing Studio', 'languages', () => navigate('/studio/dub')],
    ['Lip Sync Studio', 'video', () => navigate('/studio/lip')],
    ['Audio Separation', 'sliders', () => navigate('/studio/separate')],
    ['Discover Voices', 'compass', () => navigate('/discover')],
    ['Character Agents', 'bot', () => navigate('/agents')],
    ['Chat with Guide', 'send', () => navigate('/agent/guide')],
    ['Support Center', 'lifebuoy', () => navigate('/support')],
    ['Engine Hub', 'cpu', () => navigate('/engines')],
    ['Account & plan', 'userRound', () => navigate('/account')],
    ['Toggle theme', 'moon', () => { const o = ['dark', 'light', 'system']; state.theme = o[(o.indexOf(state.theme) + 1) % 3]; save(); applyTheme(); toast('Theme: ' + state.theme, 'moon'); }],
    ['Log out', 'logout', () => logout()],
  ];
  const inp = h('input', { class: 'input', placeholder: 'Type a command or studio…', style: { borderRadius: '14px' } });
  const list = h('div', { class: 'stack', style: { gap: '4px', marginTop: '10px' } });
  const render = () => {
    const q = inp.value.toLowerCase();
    list.replaceChildren(...actions.filter(a => a[0].toLowerCase().includes(q)).map(([label, ic, fn]) =>
      h('button', { class: 'drop-item', style: { position: 'static', width: '100%' }, onclick: () => { close(); fn(); } }, icon(ic), h('span', {}, label))));
    if (!list.children.length) list.append(h('div', { class: 'tiny faint', style: { padding: '10px' } }, 'No matches.'));
  };
  inp.addEventListener('input', render); render();
  const close = modal('Command palette', box => { box.append(inp, list); setTimeout(() => inp.focus(), 60); });
}
addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (db.user) palette(); }
});

/* ---------- boot ---------- */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').then(reg => { if (reg.periodicSync) reg.periodicSync.register('rm-catalog', { minInterval: 24 * 3600 }).catch(() => {}); return reg; }).catch(() => {}));
}
(async () => {
  applyTheme();
  const user = await bootAuth();
  setTimeout(() => { splash.classList.add('gone'); setTimeout(() => splash.remove(), 600); }, state.seenSplash ? 700 : 1500);
  state.seenSplash = true; save();
  addEventListener('hashchange', renderRoute);
  if (!user && !location.hash) location.hash = '/auth';
  renderRoute();
  try {
    const cfg = await api('/api/config');
    db.engines = cfg.engines || {};
    db.mail = cfg.mail === true;
    if (cfg.maintenance) toast('Under maintenance — studios are briefly paused', 'cpu');
    if (cfg.announcement) {
      const bar = h('button', { class: 'announce', 'aria-label': 'Dismiss announcement', onclick: e => e.currentTarget.remove() },
        h('span', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, icon('megaphone'), cfg.announcement), h('small', {}, 'tap to dismiss'));
      document.body.prepend(bar);
    }
  } catch {}
  if (user) {
    fabSupport.style.display = 'grid';
    if (!state.onboarded) { state.onboarded = true; save(); setTimeout(welcomeSheet, 1200); }
  }
})();
document.querySelector('#view').addEventListener('scroll', () => { }, { passive: true });

/* ---------- PWA share target + file handlers ---------- */
try {
  const q = new URLSearchParams(location.search);
  if (q.get('share')) {
    const t = [q.get('rm_title'), q.get('rm_text')].filter(Boolean).join(' — ').trim();
    if (t) {
      sessionStorage.setItem('rm_share_text', t.slice(0, 2000));
      setTimeout(() => {
        toast('Shared text received — ready in Text to Speech', 'text');
        if (state.user) navigate('/studio/tts');
      }, 900);
    }
    const proto = q.get('proto');
    if (proto) {
      const t = decodeURIComponent(proto.replace(/^web\+reachmark:/, '')).trim();
      if (t) {
        sessionStorage.setItem('rm_share_text', t.slice(0, 2000));
        setTimeout(() => {
          toast('Received via web+reachmark — ready in Text to Speech', 'text');
          if (state.user) navigate('/studio/tts');
        }, 900);
      }
    }
    if (q.get('note')) {
      sessionStorage.setItem('rm_note', '1');
      setTimeout(() => { if (state.user) navigate('/studio/tts'); }, 900);
    }
    if (proto || q.get('note')) history.replaceState(null, '', location.pathname + location.hash);
  }
} catch {}
if ('launchQueue' in window) {
  try {
    window.launchQueue.setConsumer(async (params) => {
      for (const hf of (params.files || [])) {
        try {
          const f = await hf.getFile();
          if (!f) continue;
          window.__rmLaunchFile = f;
          navigate('/studio/changer');
          toast('Audio file received — loaded into Voice Changer', 'swap');
        } catch {}
      }
    });
  } catch {}
}

/* ---------- fish-style descriptive drawer (mobile menu) ---------- */
window.__menuSheet = () => sheet('Reachmark Audio', (box, close) => {
  for (const [label, items] of NAV) {
    box.append(h('div', { class: 'navlabel', style: { marginTop: '10px' } }, label));
    for (const [path, ic, name, desc] of items) {
      box.append(h('div', { class: 'row tap', onclick: () => { close(); setTimeout(() => navigate(path), 120); } },
        h('div', { class: 'r-ico' }, icon(ic)),
        h('div', {}, h('b', {}, name), h('small', {}, desc)),
        h('div', { class: 'r-end' }, icon('chevron'))));
    }
  }
});
