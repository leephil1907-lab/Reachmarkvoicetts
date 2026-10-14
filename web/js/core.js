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
const I = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
/* Icon set: Lucide (lucide.dev, ISC licence) — consistent 24px stroke icons. */
export const icons = {
  mic: I('<path d="M12 19v3" /> <path d="M19 10v2a7 7 0 0 1-14 0v-2" /> <rect x="9" y="2" width="6" height="13" rx="3" />'),
  micStudio: I('<path d="M12 19v3" /> <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" /> <path d="M16.95 16.95A7 7 0 0 1 5 12v-2" /> <path d="M18.89 13.23A7 7 0 0 0 19 12v-2" /> <path d="m2 2 20 20" /> <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />'),
  upload: I('<path d="M12 3v12" /> <path d="m17 8-5-5-5 5" /> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />'),
  home: I('<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /> <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />'),
  spark: I('<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /> <path d="M20 2v4" /> <path d="M22 4h-4" /> <circle cx="4" cy="20" r="2" />'),
  compass: I('<circle cx="12" cy="12" r="10" /> <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />'),
  user: I('<circle cx="12" cy="8" r="5" /> <path d="M20 21a8 8 0 0 0-16 0" />'),
  plus: I('<path d="M5 12h14" /> <path d="M12 5v14" />'),
  back: I('<path d="m12 19-7-7 7-7" /> <path d="M19 12H5" />'),
  close: I('<path d="M18 6 6 18" /> <path d="m6 6 12 12" />'),
  play: I('<path fill="currentColor" d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />'),
  pause: I('<rect x="14" y="3" width="5" height="18" rx="1" /> <rect x="5" y="3" width="5" height="18" rx="1" />'),
  download: I('<path d="M12 15V3" /> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /> <path d="m7 10 5 5 5-5" />'),
  trash: I('<path d="M10 11v6" /> <path d="M14 11v6" /> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /> <path d="M3 6h18" /> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />'),
  wave: I('<path d="M2 10v3" /> <path d="M6 6v11" /> <path d="M10 3v18" /> <path d="M14 8v7" /> <path d="M18 5v13" /> <path d="M22 10v3" />'),
  swap: I('<path d="M8 3 4 7l4 4" /> <path d="M4 7h16" /> <path d="m16 21 4-4-4-4" /> <path d="M20 17H4" />'),
  bot: I('<path d="M12 8V4H8" /> <rect width="16" height="12" x="4" y="8" rx="2" /> <path d="M2 14h2" /> <path d="M20 14h2" /> <path d="M15 13v2" /> <path d="M9 13v2" />'),
  phone: I('<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />'),
  phoneOff: I('<path d="M10.1 13.9a14 14 0 0 0 3.732 2.668 1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2 18 18 0 0 1-12.728-5.272" /> <path d="M22 2 2 22" /> <path d="M4.76 13.582A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 .244.473" />'),
  globe: I('<circle cx="12" cy="12" r="10" /> <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /> <path d="M2 12h20" />'),
  film: I('<path d="m12.296 3.464 3.02 3.956" /> <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z" /> <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /> <path d="m6.18 5.276 3.1 3.899" />'),
  layers: I('<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /> <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /> <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />'),
  cpu: I('<path d="M12 20v2" /> <path d="M12 2v2" /> <path d="M17 20v2" /> <path d="M17 2v2" /> <path d="M2 12h2" /> <path d="M2 17h2" /> <path d="M2 7h2" /> <path d="M20 12h2" /> <path d="M20 17h2" /> <path d="M20 7h2" /> <path d="M7 20v2" /> <path d="M7 2v2" /> <rect x="4" y="4" width="16" height="16" rx="2" /> <rect x="8" y="8" width="8" height="8" rx="1" />'),
  check: I('<path d="M20 6 9 17l-5-5" />'),
  megaphone: I('<path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" /> <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14" /> <path d="M8 6v8" />'),
  menu: I('<path d="M4 5h16" /> <path d="M4 12h16" /> <path d="M4 19h16" />'),
  chevron: I('<path d="m9 18 6-6-6-6" />'),
  chevD: I('<path d="m6 9 6 6 6-6" />'),
  search: I('<path d="m21 21-4.34-4.34" /> <circle cx="11" cy="11" r="8" />'),
  filter: I('<path d="M10 5H3" /> <path d="M12 19H3" /> <path d="M14 3v4" /> <path d="M16 17v4" /> <path d="M21 12h-9" /> <path d="M21 19h-5" /> <path d="M21 5h-7" /> <path d="M8 10v4" /> <path d="M8 12H3" />'),
  send: I('<path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z" /> <path d="M6 12h16" />'),
  edit: I('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /> <path d="m15 5 4 4" />'),
  copy: I('<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />'),
  star: I('<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />'),
  doc: I('<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /> <path d="M14 2v5a1 1 0 0 0 1 1h5" /> <path d="M10 9H8" /> <path d="M16 13H8" /> <path d="M16 17H8" />'),
  moon: I('<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />'),
  sun: I('<circle cx="12" cy="12" r="4" /> <path d="M12 2v2" /> <path d="M12 20v2" /> <path d="m4.93 4.93 1.41 1.41" /> <path d="m17.66 17.66 1.41 1.41" /> <path d="M2 12h2" /> <path d="M20 12h2" /> <path d="m6.34 17.66-1.41 1.41" /> <path d="m19.07 4.93-1.41 1.41" />'),
  monitor: I('<rect width="20" height="14" x="2" y="3" rx="2" /> <line x1="8" x2="16" y1="21" y2="21" /> <line x1="12" x2="12" y1="17" y2="21" />'),
  stop: I('<rect fill="currentColor" width="18" height="18" x="3" y="3" rx="2" />'),
  refresh: I('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /> <path d="M21 3v5h-5" /> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /> <path d="M8 16H3v5" />'),
  external: I('<path d="M15 3h6v6" /> <path d="M10 14 21 3" /> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />'),
  separate: I('<circle cx="6" cy="6" r="3" /> <path d="M8.12 8.12 12 12" /> <path d="M20 4 8.12 15.88" /> <circle cx="6" cy="18" r="3" /> <path d="M14.8 14.8 20 20" />'),
  history: I('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" /> <path d="M12 7v5l4 2" />'),
  discord: I('<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />'),
  instagram: I('<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" /> <circle cx="12" cy="13" r="3" />'),
  arrowUp: I('<path d="m5 12 7-7 7 7" /> <path d="M12 19V5" />'),
  text: I('<path d="M12 4v16" /> <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" /> <path d="M9 20h6" />'),
  wand: I('<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" /> <path d="m14 7 3 3" /> <path d="M5 6v4" /> <path d="M19 14v4" /> <path d="M10 2v2" /> <path d="M7 8H3" /> <path d="M21 16h-4" /> <path d="M11 3H9" />'),
  lifebuoy: I('<circle cx="12" cy="12" r="10" /> <path d="m4.93 4.93 4.24 4.24" /> <path d="m14.83 9.17 4.24-4.24" /> <path d="m14.83 14.83 4.24 4.24" /> <path d="m9.17 14.83-4.24 4.24" /> <circle cx="12" cy="12" r="4" />'),
  logout: I('<path d="m16 17 5-5-5-5" /> <path d="M21 12H9" /> <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />'),
  mail: I('<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /> <rect x="2" y="4" width="20" height="16" rx="2" />'),
  cmd: I('<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />'),
  clock: I('<circle cx="12" cy="12" r="10" /> <path d="M12 6v6l4 2" />'),
  grid: I('<rect width="7" height="7" x="3" y="3" rx="1" /> <rect width="7" height="7" x="14" y="3" rx="1" /> <rect width="7" height="7" x="14" y="14" rx="1" /> <rect width="7" height="7" x="3" y="14" rx="1" />'),
  lock: I('<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 10 0v4" />'),
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
export const db = { user: null, voices: [], agents: [], history: [], engines: {}, mail: false };
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
  if (db.user) { await refreshAll(); $$('.credits-b').forEach(el => el.textContent = (db.user.credits ?? 0).toLocaleString()); }
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
export const routeCleanup = []; // views push teardown fns (SSE, timers); flushed on every navigation
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
  while (routeCleanup.length) { try { routeCleanup.pop()(); } catch {} }
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
  refreshVerifyBanner();
  revealLanding(node);
}

/* ---------- scroll-driven reveals (landing pages) ---------- */
/* stag() already numbers children with --i; here they start invisible and rise
   into place as the scroller reaches them — the landing.love pattern, zero libs. */
function revealLanding(node) {
  if (!node.classList?.contains('landing')) return;
  const els = node.querySelectorAll('[data-stag] > *');
  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('rv-in')); return; }
  const root = document.querySelector('#view');
  const io = new IntersectionObserver(entries => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('rv-in'); io.unobserve(en.target); }
  }, { root, rootMargin: '0px 0px -6% 0px', threshold: 0.02 });
  els.forEach(el => { el.classList.add('rv'); io.observe(el); });
}

/* ---------- pointer spotlight + 3D tilt (kinetics-style, fine pointers only) ---------- */
const SPOT_SEL = '.qcard, .lp-card, .stat, .voicecard, .auth-card';
const TILT_SEL = '.qcard, .lp-card, .voicecard';
if (matchMedia('(pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let spotRaf = 0, spotE = null;
  addEventListener('pointermove', e => {
    spotE = e;
    if (spotRaf) return;
    spotRaf = requestAnimationFrame(() => {
      spotRaf = 0;
      const el = spotE.target?.closest?.(SPOT_SEL);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = (spotE.clientX - r.left) / r.width, py = (spotE.clientY - r.top) / r.height;
      el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      if (el.matches(TILT_SEL)) {
        el.style.setProperty('--ty', ((px - 0.5) * 5).toFixed(2) + 'deg');   // yaw ±2.5°
        el.style.setProperty('--tx', ((0.5 - py) * 4).toFixed(2) + 'deg');   // pitch ±2°
      }
    });
  }, { passive: true });
  addEventListener('pointerout', e => {
    const el = e.target?.closest?.(TILT_SEL);
    if (el && !el.contains(e.relatedTarget)) { el.style.setProperty('--tx', '0deg'); el.style.setProperty('--ty', '0deg'); }
  }, { passive: true });
}

/* ---------- email verification: banner + sheet (link or 6-digit code) ---------- */
export function verifySheet() {
  const codeIn = h('input', { class: 'input', placeholder: '6-digit code', inputmode: 'numeric', maxlength: '6', autocomplete: 'one-time-code' });
  const msg = db.mail
    ? h('p', { class: 'tiny muted', style: { margin: '0 0 10px' } }, 'We emailed a verification link and a 6-digit code to ', h('b', {}, db.user?.email || ''), '. Paste the code, or open the link on any device — both work.')
    : h('p', { class: 'tiny muted', style: { margin: '0 0 10px' } }, 'Heads up: email delivery is not connected on this server yet, so no message reached ', h('b', {}, db.user?.email || ''), ' this time. Your account works fully — to verify, write to support@reachmarkdigital.com and a human will confirm you, or try again once the operator connects mail.');
  sheet('Verify your email', (box, close) => {
    box.append(msg, codeIn,
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '14px' } },
        h('button', { class: 'btn primary', style: { flex: 1 }, onclick: async e => {
          e.currentTarget.disabled = true;
          try {
            await api('/api/auth/verify', { method: 'POST', body: { code: codeIn.value.trim() } });
            if (db.user) db.user.verified = true;
            toast('Email verified', 'mail'); close(); refreshVerifyBanner();
          } catch (e2) { toast(e2.message, 'close'); e.currentTarget.disabled = false; }
        } }, icon('check'), 'Verify code'),
        h('button', { class: 'btn', onclick: async e => {
          e.currentTarget.disabled = true;
          try { const r = await api('/api/auth/verify/resend', { method: 'POST', body: { email: db.user?.email } }); toast(r.message, 'mail'); }
          catch (e2) { toast(e2.message, 'close'); }
          e.currentTarget.disabled = false;
        } }, icon('refresh'), 'Resend email')));
    setTimeout(() => codeIn.focus(), 80);
  });
}
export function queueSupport(text) {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open('rm-outbox', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('msgs', { keyPath: 'id' });
    rq.onsuccess = () => {
      const dbo = rq.result;
      const tx = dbo.transaction('msgs', 'readwrite');
      tx.objectStore('msgs').put({ id: 'q' + Date.now() + Math.random().toString(36).slice(2, 6), text: String(text).slice(0, 2000), at: Date.now() });
      tx.oncomplete = async () => {
        dbo.close();
        try { const reg = await navigator.serviceWorker.ready; await reg.sync.register('rm-support-retry'); } catch {}
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    rq.onerror = () => reject(rq.error);
  });
}
export function refreshVerifyBanner() {
  const main = document.querySelector('#main'); if (!main) return;
  let b = document.getElementById('verify-banner');
  if (!db.user || db.user.verified) { if (b) b.remove(); return; }
  if (b) return;
  b = h('div', { id: 'verify-banner', class: 'verify-banner', role: 'status' },
    h('span', { style: { flex: '1', minWidth: '0', display: 'flex', gap: '9px', alignItems: 'center' } }, icon('mail'), h('span', {}, h('b', {}, db.mail ? 'Verify your email' : 'Email delivery is off on this server'), h('span', { class: 'hide-sm' }, db.mail ? ' — a link and a 6-digit code are waiting in ' + db.user.email + '.' : ' — verification is handled by our support team until mail is connected.'))),
    h('button', { class: 'btn sm primary', onclick: () => verifySheet() }, icon('mail'), 'Verify now'),
    h('button', { class: 'iconbtn', 'aria-label': 'Dismiss verification banner', html: icons.close, onclick: () => b.remove() }));
  main.insertBefore(b, main.firstElementChild);
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
    if (db.user && top.noUser !== true) tb.append(h('button', { class: 'iconbtn menubtn', 'aria-label': 'Menu', html: icons.menu, onclick: () => window.__menuSheet && window.__menuSheet() }), userMenuBtn(38));
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
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export function fileTooBig(f) {
  if (f && f.size > MAX_UPLOAD_BYTES) { toast('File too large — 20 MB max', 'close'); return true; }
  return false;
}
export const fmtDate = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export function download(url, name) { const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); }
export const fileToDataUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
