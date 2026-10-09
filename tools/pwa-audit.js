// Local PWABuilder-style checklist audit (manifest + service worker + security + installability)
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const WEB = path.join(__dirname, '..', 'web');
let pass = 0, fail = 0;
const check = (ok, label, detail = '') => { ok ? pass++ : fail++; console.log((ok ? '  ✅ ' : '  ❌ ') + label + (detail ? ' — ' + detail : '')); };

console.log('MANIFEST');
const m = JSON.parse(fs.readFileSync(path.join(WEB, 'manifest.webmanifest'), 'utf8'));
check(!!m.name && m.name.length >= 4, 'name', m.name);
check(!!m.short_name && m.short_name.length <= 12, 'short_name', m.short_name);
check(!!m.start_url, 'start_url', m.start_url);
check(!!m.scope, 'scope', m.scope);
check(['standalone', 'fullscreen', 'minimal-ui'].includes(m.display), 'display', m.display);
check(!!m.background_color, 'background_color', m.background_color);
check(!!m.theme_color, 'theme_color', m.theme_color);
check(!!m.description && m.description.length > 40, 'description length', m.description.length + ' chars');
check(!!m.lang, 'lang', m.lang);
const sizes = m.icons.map(i => i.sizes);
check(sizes.includes('192x192'), 'icon 192x192 present');
check(sizes.includes('512x512'), 'icon 512x512 present');
check(m.icons.some(i => i.purpose === 'any' && i.sizes === '512x512'), '512 any purpose');
check(m.icons.some(i => i.purpose === 'maskable'), 'maskable icon present');
for (const i of m.icons) {
  const f = path.join(WEB, i.src);
  const exists = fs.existsSync(f);
  const dim = exists ? execSync(`identify -format "%wx%h" ${f}`).toString() : 'missing';
  check(exists && dim === i.sizes, 'icon file matches declared size', i.src + ' ' + dim);
}
check(Array.isArray(m.shortcuts) && m.shortcuts.length >= 2, 'shortcuts', (m.shortcuts || []).length + ' entries');

console.log('SERVICE WORKER');
const sw = fs.readFileSync(path.join(WEB, 'sw.js'), 'utf8');
check(sw.includes("addEventListener('install'"), 'install handler + precache');
check(sw.includes("addEventListener('activate'"), 'activate handler + cache cleanup');
check(sw.includes("addEventListener('fetch'"), 'fetch handler (offline capability)');
check(sw.includes("caches.match('/index.html')"), 'offline navigation fallback');
const main = fs.readFileSync(path.join(WEB, 'js', 'main.js'), 'utf8');
check(main.includes("serviceWorker.register('/sw.js')"), 'SW registration in app boot');
check(sw.includes("startsWith('/api/')"), 'API/auth calls excluded from SW cache');

console.log('SECURITY & INSTALLABILITY');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
check(html.includes('name="theme-color"'), 'theme-color meta');
check(html.includes('name="viewport"'), 'viewport meta');
check(html.includes('rel="manifest"'), 'manifest linked');
check(!/src="http:|href="http:/.test(html), 'no mixed content in shell');
console.log('  ℹ️  HTTPS: served over TLS in deployment (preview proxy + your domain)');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
