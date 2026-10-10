// Reachmark Audio — boot: session, chrome (sidebar/tabbar), splash, create sheet, support FAB, command palette.
import { h, icon, icons, state, save, navigate, routes, renderRoute, sheet, toast, applyTheme, bootAuth, db, modal, logout, api } from './core.js';
import './views-a.js';
import './views-b.js';
import { welcomeSheet } from './auth.js';

/* ---------- splash ---------- */
const splash = h('div', { id: 'splash' },
  h('div', { class: 'sl' },
    h('div', { class: 'logo logo-img' }, h('img', { src: '/assets/logo-192.png', alt: '' })),
    h('h1', {}, 'Reachmark Audio'),
    h('p', {}, 'The AI voice studio'),
    h('small', { style: { color: 'var(--faint)', fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase' } }, 'by Reachmark Digital'),
    h('div', { class: 'bars' }, [0, 1, 2, 3, 4].map(() => h('i', { style: { height: '10px' } })))));
document.body.append(splash);

/* ---------- sidebar ---------- */
const NAV = [
  ['Studio', [['/studio/tts', 'text', 'Text to Speech'], ['/studio/changer', 'swap', 'Voice Changer'], ['/studio/clone', 'copy', 'Voice Match'], ['/studio/design', 'wand', 'Voice Design'], ['/studio/dub', 'globe', 'Dubbing Studio'], ['/studio/lip', 'film', 'Lip Sync Studio'], ['/studio/separate', 'separate', 'Quick Vocal Remove']]],
  ['Explore', [['/discover', 'compass', 'Discover Voices'], ['/agents', 'bot', 'Character Agents']]],
  ['Help', [['/support', 'lifebuoy', 'Support Center']]],
  ['System', [['/engines', 'cpu', 'Engine Hub'], ['/account', 'user', 'Account']]],
];
const sb = document.querySelector('#sidebar');
sb.append(h('div', { class: 'brand' },
  h('span', { class: 'logo logo-img' }, h('img', { src: '/assets/logo-192.png', alt: 'Reachmark Audio' })),
  h('div', {}, h('b', {}, 'Reachmark Audio'), h('span', {}, 'by Reachmark Digital'))));
for (const [label, items] of NAV) {
  sb.append(h('div', { class: 'navlabel' }, label));
  for (const [path, ic, name] of items) sb.append(h('button', { class: 'navitem', dataset: { path }, onclick: () => navigate(path) }, icon(ic), name));
}
sb.append(h('div', { class: 'side-foot' },
  h('div', { class: 'card flat', style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 15px' } },
    icon('spark'), h('div', { style: { flex: 1 } }, h('b', { class: 'credits-b', style: { fontSize: '15px' } }, '0'), h('small', { class: 'faint', style: { display: 'block' } }, 'credits')),
    h('button', { class: 'iconbtn', html: icons.logout, 'aria-label': 'Log out', onclick: () => logout() })),
  h('div', { class: 'tiny faint', style: { padding: '10px 6px 0' } }, 'v1.3 · a Reachmark Digital product · worldwide · support@reachmarkdigital.com')));

/* ---------- tabbar ---------- */
const tb = document.querySelector('#tabbar');
const TABS = [['home', 'home', 'Home', '/home'], ['create', 'plus', 'Create', null], ['discover', 'compass', 'Voices', '/discover'], ['agents', 'bot', 'Agents', '/agents'], ['account', 'user', 'Account', '/account']];
for (const [key, ic, label, path] of TABS) tb.append(h('button', { class: 'tab', dataset: { tab: key }, onclick: () => path ? navigate(path) : createSheet() }, icon(ic), label));

/* ---------- support FAB ---------- */
const fabSupport = h('button', { class: 'fab-support', 'aria-label': 'Support Center', onclick: () => navigate('/support') }, icon('lifebuoy'));
document.body.append(fabSupport);

/* ---------- create sheet ---------- */
export function createSheet() {
  sheet('Create', (box, close) => {
    const rows = [
      ['text', 'Text to Speech', 'Type it, hear it in any voice & language', '/studio/tts'],
      ['copy', 'Voice Match', 'Match a neural voice to you from 10s of audio', '/studio/clone'],
      ['wand', 'Voice Design', 'Describe the voice in plain text.', '/studio/design'],
      ['swap', 'Voice Changer', 'Upload or record, convert the voice', '/studio/changer'],
      ['globe', 'Dubbing Studio', 'One script, every language', '/studio/dub'],
      ['film', 'Lip Sync Studio', 'Animate a character with audio', '/studio/lip'],
      ['separate', 'Quick Vocal Remove', 'Center-channel vocal reduction (stereo)', '/studio/separate'],
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
    ['Go to Dashboard', 'home', () => navigate('/home')],
    ['Text to Speech', 'text', () => navigate('/studio/tts')],
    ['Instant Voice Clone', 'copy', () => navigate('/studio/clone')],
    ['Voice Changer', 'swap', () => navigate('/studio/changer')],
    ['Voice Design', 'wand', () => navigate('/studio/design')],
    ['Dubbing Studio', 'globe', () => navigate('/studio/dub')],
    ['Lip Sync Studio', 'film', () => navigate('/studio/lip')],
    ['Audio Separation', 'separate', () => navigate('/studio/separate')],
    ['Discover Voices', 'compass', () => navigate('/discover')],
    ['Character Agents', 'bot', () => navigate('/agents')],
    ['Chat with Guide', 'send', () => navigate('/agent/guide')],
    ['Support Center', 'lifebuoy', () => navigate('/support')],
    ['Engine Hub', 'cpu', () => navigate('/engines')],
    ['Account & plan', 'user', () => navigate('/account')],
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
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
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
    if (cfg.maintenance) toast('Under maintenance — studios are briefly paused', 'cpu');
    if (cfg.announcement) {
      const bar = h('button', { class: 'announce', 'aria-label': 'Dismiss announcement', onclick: e => e.currentTarget.remove() },
        h('span', {}, '📣 ' + cfg.announcement), h('small', {}, 'tap to dismiss'));
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
    history.replaceState(null, '', location.pathname + location.hash);
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
