// Reachmark Audio — core runtime: dom helpers, icons, session, cloud db, router, chrome, sheets, toasts.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(9)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

/* ---------------- icon set ---------------- */
const I = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
export const icons = {
  mic: I('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7"/>'),
  micStudio: I('<rect x="8" y="2.5" width="8" height="12.5" rx="4"/><path d="M4.5 11a7.5 7.5 0 0 0 15 0M12 18.5V22M8 22h8M8 6.5h8M8 9.5h8"/>'),
  upload: I('<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>'),
  home: I('<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1Z"/>'),
  spark: I('<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4Z"/>', 'fill="currentColor" stroke="none"'),
  compass: I('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  back: I('<path d="M15 5l-7 7 7 7"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  play: I('<path d="M8 5.5v13l11-6.5Z" fill="currentColor" stroke="none"/>'),
  pause: I('<rect x="7" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/>'),
  download: I('<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>'),
  trash: I('<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>'),
  wave: I('<path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4M21.5 12h.01"/>'),
  swap: I('<path d="M7 8h11l-3-3M17 16H6l3 3"/>'),
  bot: I('<rect x="4" y="8" width="16" height="11" rx="4"/><path d="M12 8V4.5M9.5 4.5h5M9 13h.01M15 13h.01M9.5 16h5"/><circle cx="12" cy="4" r="1" fill="currentColor"/>'),
  phone: I('<path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z"/>'),
  phoneOff: I('<path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5ZM4 4l16 16"/>'),
  globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/>'),
  film: I('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M8 5v14M16 5v14"/>'),
  layers: I('<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>'),
  cpu: I('<rect x="6" y="6" width="12" height="12" rx="3"/><rect x="10" y="10" width="4" height="4" rx="1"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2 2M19 5l-2 2M5 19l2-2M19 19l-2-2"/>'),
  check: I('<path d="m5 12.5 4.5 4.5L19 7"/>'),
  chevron: I('<path d="m9 5 7 7-7 7"/>'),
  chevD: I('<path d="m5 9 7 7 7-7"/>'),
  search: I('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  filter: I('<path d="M4 6h16M7 12h10M10 18h4"/>'),
  send: I('<path d="M4 12 20 4l-6 16-2.5-6.5Z"/>'),
  edit: I('<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17Z"/>'),
  copy: I('<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
  star: I('<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z"/>'),
  doc: I('<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  moon: I('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>'),
  sun: I('<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M4.5 19.5l2-2M17.5 6.5l2-2"/>'),
  monitor: I('<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M9 20h6M12 16v4"/>'),
  stop: I('<rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none"/>'),
  refresh: I('<path d="M20 11a8 8 0 1 0-2.3 6.3M20 5v6h-6"/>'),
  external: I('<path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6"/>'),
  separate: I('<circle cx="8.5" cy="12" r="5"/><circle cx="15.5" cy="12" r="5"/>'),
  history: I('<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4h4"/><path d="M12 8v4.5l3 1.8"/>'),
  discord: I('<path d="M8.5 5.5C6 6 4.5 7 4.5 7 3 10 2.8 13.5 3 16.5c1.7 1.4 3.6 2 3.6 2l.9-1.6M15.5 5.5c2.5.5 4 1.5 4 1.5 1.5 3 1.7 6.5 1.5 9.5-1.7 1.4-3.6 2-3.6 2l-.9-1.6M8.5 5.5C10 5 14 5 15.5 5.5M8 16.5c2.5 1 5.5 1 8 0M9.5 12h.01M14.5 12h.01"/>'),
  instagram: I('<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><path d="M16.8 7.2h.01"/>'),
  arrowUp: I('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  text: I('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
  wand: I('<path d="m5 19 9-9M15 5l.9 2.1L18 8l-2.1.9L15 11l-.9-2.1L12 8l2.1-.9ZM19 13l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z"/>'),
  lifebuoy: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6M18.4 5.6l-3.6 3.6M18.4 18.4l-3.6-3.6M5.6 18.4l3.6-3.6"/>'),
  logout: I('<path d="M9 4H5v16h4M15 8l4 4-4 4M19 12H9"/>'),
  mail: I('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>'),
  cmd: I('<path d="M9 9V6a3 3 0 1 0-3 3Zm0 0v6m0-6h6m-6 6v3a3 3 0 1 1-3-3Zm6-6V6a3 3 0 1 1 3 3Zm0 0v6m0 0v3a3 3 0 1 0 3-3Zm0 0H9"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
  grid: I('<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'),
};
export const icon = (name, cls = '') => h('span', { class: 'ico' + (cls ? ' ' + cls : ''), html: icons[name] || icons.spark });

/* ---------------- local prefs ---------------- */
const KEY = 'reachmark-audio-prefs-v2';
const defaults = { theme: 'dark', lang: 'en', onboarded: false, defaultVoiceId: null };
export const state = { ...defaults, ...load() };
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
export function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
export const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);

/* ---------------- session + cloud db ---------------- */
export const db = { user: null, voices: [], agents: [], history: [] };
export async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: opts.body ? { 'content-type': 'application/json' } : {},
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const credits = res.headers.get('X-Reachmark-Credits');
  if (credits) setCredits(+credits);
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || ('Request failed (' + res.status + ')'));
  return data ?? res;
}
export async function bootAuth() {
  try { db.user = (await api('/api/auth/me')).user; } catch { db.user = null; }
  if (db.user) await refreshAll();
  return db.user;
}
export async function refreshAll() {
  const [v, a, hh] = await Promise.all([api('/api/voices'), api('/api/agents'), api('/api/history')]);
  db.voices = v.voices; db.agents = a.agents; db.history = hh.history;
}
export const refreshVoices = async () => { db.voices = (await api('/api/voices')).voices; return db.voices; };
export const refreshAgents = async () => { db.agents = (await api('/api/agents')).agents; return db.agents; };
export async function pushHistory(item) {
  const { item: saved } = await api('/api/history', { method: 'POST', body: item });
  db.history.unshift(saved); db.history = db.history.slice(0, 80);
  return saved;
}
export async function removeHistory(id) {
  await api('/api/history/' + id, { method: 'DELETE' });
  db.history = db.history.filter(x => x.id !== id);
}
export async function addVoice(payload) { const { voice } = await api('/api/voices', { method: 'POST', body: payload }); db.voices.push(voice); return voice; }
export async function deleteVoice(id) { await api('/api/voices/' + id, { method: 'DELETE' }); db.voices = db.voices.filter(v => v.id !== id); }
export async function addAgent(payload) { const { agent } = await api('/api/agents', { method: 'POST', body: payload }); db.agents.push(agent); return agent; }
export async function deleteAgent(id) { await api('/api/agents/' + id, { method: 'DELETE' }); db.agents = db.agents.filter(a => a.id !== id); }
export async function logout() { await api('/api/auth/logout', { method: 'POST' }); db.user = null; db.voices = []; db.agents = []; db.history = []; const f = document.querySelector('.fab-support'); if (f) f.style.display = 'none'; navigate('/auth'); }

export function setCredits(n) {
  if (!db.user) return;
  const old = db.user.credits; db.user.credits = n;
  $$('.credits-b').forEach(el => animateNumber(el, old, n));
}
function animateNumber(el, from, to) {
  const t0 = performance.now(), d = 600;
  const step = t => { const k = Math.min(1, (t - t0) / d); el.textContent = Math.round(from + (to - from) * k).toLocaleString(); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
export const syncUser = async () => { db.user = (await api('/api/me')).user; $$('.credits-b').forEach(el => el.textContent = db.user.credits.toLocaleString()); };

/* ---------------- theme ---------------- */
export function applyTheme() {
  const sys = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = state.theme === 'system' ? sys : state.theme;
}
matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);

/* ---------------- toasts ---------------- */
export function toast(msg, ic = 'check', ms = 2600) {
  const t = h('div', { class: 'toast' }, icon(ic), h('span', {}, msg));
  $('#toast-root').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, ms);
  return t;
}

/* ---------------- sheet & modal ---------------- */
export function sheet(title, build, opts = {}) {
  const root = $('#sheet-root');
  const back = h('div', { class: 'sheet-back' });
  const body = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
    h('h3', {}, title, h('button', { class: 'iconbtn x', onclick: () => close(), html: icons.close, 'aria-label': 'Close' })));
  back.append(body);
  root.append(back);
  let closed = false;
  function close() {
    if (closed) return; closed = true;
    body.classList.add('out'); back.style.animation = 'fadeIn .2s reverse both';
    setTimeout(() => back.remove(), 230);
    opts.onClose?.();
  }
  back.addEventListener('click', e => { if (e.target === back) close(); });
  build(body, close);
  return close;
}
export function modal(title, build) {
  const root = $('#modal-root');
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, h('h3', { style: { marginBottom: '14px' } }, title));
  back.append(box); root.append(back);
  let closed = false;
  const close = () => { if (closed) return; closed = true; box.classList.add('out'); back.style.animation = 'fadeIn .2s reverse both'; setTimeout(() => back.remove(), 200); };
  back.addEventListener('click', e => { if (e.target === back) close(); });
  build(box, close);
  return close;
}

/* ---------------- dropdown (smooth, animated) ---------------- */
let openDrop = null;
export function dropdown(anchor, items) {
  closeDropdown();
  const r = anchor.getBoundingClientRect();
  const menu = h('div', { class: 'drop', role: 'menu' });
  const place = () => {
    const mw = 232;
    let left = Math.min(innerWidth - mw - 10, Math.max(10, r.right - mw));
    menu.style.left = left + 'px';
    menu.style.top = Math.min(innerHeight - menu.offsetHeight - 12, r.bottom + 8) + 'px';
  };
  for (const it of items) {
    if (it === '-') { menu.append(h('div', { class: 'drop-sep' })); continue;
    }
    menu.append(h('button', {
      class: 'drop-item' + (it.danger ? ' danger' : ''), role: 'menuitem',
      onclick: () => { closeDropdown(); it.onClick?.(); },
    }, icon(it.icon || 'chevron'), h('span', {}, it.label), it.hint ? h('small', {}, it.hint) : null));
  }
  document.body.append(menu);
  place();
  requestAnimationFrame(() => menu.classList.add('in'));
  openDrop = { menu, close: closeDropdown };
  setTimeout(() => document.addEventListener('pointerdown', outside, { once: true }), 0);
  function outside(e) { if (!menu.contains(e.target) && e.target !== anchor) closeDropdown(); else document.addEventListener('pointerdown', outside, { once: true }); }
  return menu;
}
export function closeDropdown() {
  if (!openDrop) return;
  const m = openDrop.menu; openDrop = null;
  m.classList.remove('in'); m.classList.add('out');
  setTimeout(() => m.remove(), 160);
}

/* ---------------- skeletons ---------------- */
export const skel = (style = {}) => h('div', { class: 'skeleton', style }, ' ');
export function skelRows(n, hpx = '58px') { return h('div', { class: 'stack', style: { gap: '10px' } }, ...Array.from({ length: n }, () => skel({ height: hpx }))); }

/* ---------------- ripple ---------------- */
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.btn,.iconbtn,.tab,.voicecard,.chip,.drop-item,.navitem');
  if (!b) return;
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height);
  const s = h('i', { class: 'ripple', style: { width: d + 'px', height: d + 'px', left: e.clientX - r.left - d / 2 + 'px', top: e.clientY - r.top - d / 2 + 'px' } });
  b.append(s); setTimeout(() => s.remove(), 520);
}, true);

/* ---------------- router & chrome ---------------- */
export const routes = {};
export let currentView = null;
let navigating = false;

export function navigate(path, replace = false) {
  if (location.hash.slice(1) === path) return;
  if (replace) location.replace('#' + path); else location.hash = path;
}

export async function renderRoute() {
  let path = location.hash.slice(1) || '/home';
  const match = Object.keys(routes).map(k => ({ k, re: new RegExp('^' + k.replace(/:[^/]+/g, '([^/]+)') + '$') })).find(r => r.re.test(path));
  if (!match) { navigate('/home', true); return; }
  const route = routes[match.k];
  // auth gate
  if (route.public !== true && !db.user) { navigate('/auth', true); return; }
  if (route.public === true && db.user && match.k === '/auth') { navigate('/home', true); return; }
  const params = path.match(match.re)?.slice(1) || [];
  const wrap = $('#view');
  const old = wrap.firstElementChild;
  if (navigating) return;
  navigating = true;
  const node = h('div', { class: 'view' });
  const ctx = { params, node };
  try { await route.view(ctx); } catch (e) { node.append(h('div', { class: 'empty' }, h('b', {}, 'View error: ' + e.message))); console.error(e); }
  stag(node);
  if (old) {
    old.classList.add('leaving');
    setTimeout(() => { old.remove(); wrap.append(node); afterMount(node, route, path); navigating = false; }, 150);
  } else { wrap.append(node); afterMount(node, route, path); navigating = false; }
}
function afterMount(node, route, path) {
  $('#view').scrollTop = 0;
  chromeFor(route, path);
  route.mounted?.(node);
  currentView = path;
}
export function stag(root) {
  root.querySelectorAll('[data-stag]').forEach(box => [...box.children].forEach((c, i) => c.style.setProperty('--i', i)));
}

export const creditsPill = () => h('button', { class: 'chip', onclick: () => navigate('/account'), 'aria-label': 'Credits' }, icon('spark'), h('b', { class: 'credits-b' }, (db.user?.credits ?? 0).toLocaleString()));

export function userMenuBtn(size = 42) {
  const b = h('button', { class: 'iconbtn avatarbtn', style: { width: size + 'px', height: size + 'px' }, 'aria-label': 'Account menu' },
    h('span', { class: 'avatar', style: { width: size - 8 + 'px', height: size - 8 + 'px', fontSize: (size / 2.6) + 'px' } }, (db.user?.name || 'R')[0].toUpperCase()));
  b.addEventListener('click', () => dropdown(b, [
    { icon: 'user', label: db.user?.name || 'Account', hint: db.user?.email },
    { icon: 'grid', label: 'Dashboard', onClick: () => navigate('/home') },
    { icon: 'lifebuoy', label: 'Support Center', onClick: () => navigate('/support') },
    { icon: 'cpu', label: 'Engine Hub', onClick: () => navigate('/engines') },
    '-',
    { icon: 'logout', label: 'Log out', danger: true, onClick: () => logout() },
  ]));
  return b;
}

function chromeFor(route, path) {
  document.title = (route.title ? route.title + ' — ' : '') + 'Reachmark Audio';
  const tb = $('#topbar'); tb.replaceChildren();
  const top = route.top ? route.top(path) : { title: route.title };
  if (top === null) { tb.style.visibility = 'hidden'; } else {
    tb.style.visibility = 'visible';
    if (top.back) tb.append(h('button', { class: 'iconbtn solid', html: icons.back, 'aria-label': 'Back', onclick: () => history.back() }));
    if (top.left) tb.append(top.left);
    else tb.append(h('div', { class: 'tb-title' }, top.title, top.sub ? h('small', {}, top.sub) : null), h('span', { class: 'spacer' }));
    (top.actions || []).forEach(a => tb.append(a));
    if (db.user && top.noUser !== true) tb.append(userMenuBtn(38));
  }
  const tabOf = route.tab;
  $$('#tabbar .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tabOf));
  $$('#sidebar .navitem').forEach(n => n.classList.toggle('on', path.startsWith(n.dataset.path)));
}

/* ---------------- shared UI builders ---------------- */
export function playerNode() {
  const canvas = h('canvas');
  const pbtn = h('button', { class: 'pbtn', html: icons.play, 'aria-label': 'Play' });
  const time = h('span', { class: 'ptime' }, '0:00');
  const node = h('div', { class: 'player' }, pbtn, canvas, time);
  return { node, canvas, pbtn, time };
}
export function emptyState(title, sub) {
  return h('div', { class: 'empty' },
    h('span', { html: `<svg viewBox="0 0 200 140" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M84 18c14 10 22 26 24 44 1 12 0 24-3 36"/><path d="M108 98c-2-14 2-26 10-34 4 10 4 22 0 34"/><path d="M108 62c8-10 10-22 8-34-8 6-12 16-12 26"/><path d="M40 108c10-6 22-8 34-6M126 108c10-4 22-4 32 0"/><path d="M30 112c20 8 44 10 70 10s50-2 70-10"/><circle cx="60" cy="80" r="1.6"/><circle cx="52" cy="88" r="1.2"/><circle cx="140" cy="60" r="1.6"/><circle cx="148" cy="70" r="1.2"/><circle cx="132" cy="46" r="1.2"/><path d="M118 40c6-8 14-12 22-14M124 48c8-6 16-8 24-8"/></svg>` }),
    h('b', {}, title), sub ? h('span', { class: 'tiny faint', style: { display: 'block', marginTop: '8px', maxWidth: '280px' } }, sub) : null);
}
export const fmtTime = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export const fmtDate = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export function download(url, name) { const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); }
export const fileToDataUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
