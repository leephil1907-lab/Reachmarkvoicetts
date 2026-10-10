// Reachmark Audio — signup & login (real accounts, 10,000 ✦ on signup).
import { h, icon, icons, routes, navigate, toast, api, db, refreshAll, sheet, modal } from './core.js';

routes['/auth'] = {
  title: 'Welcome', public: true,
  top: () => ({ noUser: true, left: h('div', { class: 'brand', style: { padding: '4px 0' } }, h('span', { class: 'logo' }, icon('micStudio')), h('div', {}, h('b', {}, 'Reachmark Audio'), h('span', {}, 'by Reachmark Digital'))) }),
  view: async ({ node }) => {
    let mode = 'login';
    const err = h('div', { class: 'auth-err', hidden: true });
    const nameF = h('input', { class: 'input', placeholder: 'Full name', autocomplete: 'name' });
    const emailF = h('input', { class: 'input', placeholder: 'Email address', type: 'email', autocomplete: 'email' });
    const passF = h('input', { class: 'input', placeholder: 'Password (8+ characters)', type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password' });
    const submit = h('button', { class: 'btn primary block', type: 'submit' }, icon('spark'), 'Log in');
    const tabs = h('div', { class: 'authtabs' },
      h('button', { class: 'on', onclick: () => setMode('login') }, 'Log in'),
      h('button', { onclick: () => setMode('signup') }, 'Sign up'));
    function setMode(m) {
      mode = m;
      [...tabs.children].forEach((c, i) => c.classList.toggle('on', (i === 0) === (m === 'login')));
      nameF.style.display = m === 'signup' ? '' : 'none';
      submit.replaceChildren(icon(m === 'signup' ? 'plus' : 'spark'), m === 'signup' ? 'Create account · get 10,000 ✦' : 'Log in');
      passF.autocomplete = m === 'login' ? 'current-password' : 'new-password';
      err.hidden = true;
    }
    const form = h('form', { class: 'stack', onsubmit: async e => {
      e.preventDefault();
      err.hidden = true;
      submit.replaceChildren(h('i', { class: 'spin' }), mode === 'signup' ? 'Creating account…' : 'Logging in…'); submit.disabled = true;
      try {
        const r = await api(mode === 'signup' ? '/api/auth/signup' : '/api/auth/login', {
          method: 'POST',
          body: mode === 'signup' ? { name: nameF.value, email: emailF.value, password: passF.value } : { email: emailF.value, password: passF.value },
        });
        db.user = r.user;
        await refreshAll();
        const f = document.querySelector('.fab-support'); if (f) f.style.display = 'grid';
        toast('Welcome' + (r.fresh ? ' — 10,000 ✦ added' : ' back') + ', ' + db.user.name.split(' ')[0], 'spark', 3200);
        navigate('/home');
        if (r.fresh) setTimeout(welcomeSheet, 900);
      } catch (e2) {
        err.textContent = e2.message; err.hidden = false;
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      }
      submit.replaceChildren(icon(mode === 'signup' ? 'plus' : 'spark'), mode === 'signup' ? 'Create account · get 10,000 ✦' : 'Log in'); submit.disabled = false;
    } }, nameF, emailF, passF, err, submit);
    setMode('login');
    const forgot = h('button', { class: 'maillink tiny', style: { background: 'none', border: '0', cursor: 'pointer', color: 'var(--faint)', padding: '0', marginTop: '10px', textDecoration: 'underline' }, onclick: () => {
      const em = h('input', { class: 'input', type: 'email', placeholder: 'Your account email', value: emailF.value });
      const msg = h('p', { class: 'tiny muted', style: { marginTop: '10px' } }, 'We will email you a single-use link, valid for 30 minutes.');
      sheet('Reset your password', (box, close) => {
        box.append(h('label', { class: 'fld' }, 'Email'), em, msg,
          h('button', { class: 'btn primary block', style: { marginTop: '14px' }, onclick: async e => {
            e.currentTarget.disabled = true;
            try { const r = await api('/api/auth/forgot', { method: 'POST', body: { email: em.value } }); msg.textContent = r.message; toast('Reset link sent', 'mail'); close(); }
            catch (e2) { msg.textContent = e2.message; e.currentTarget.disabled = false; }
          } }, icon('mail'), 'Email me a reset link'));
      });
    } }, 'Forgot password?');
    node.style.paddingBottom = '40px';
    node.append(h('div', { class: 'authwrap', 'data-stag': '' },
      h('div', { class: 'auth-hero' },
        h('div', { class: 'logo-lg' }, icon('micStudio')),
        h('h1', {}, 'Your voice, every language, one platform.'),
        h('p', { class: 'muted' }, 'Clone, design, dub, lip-sync and call with AI voices — powered by a merged engine hub of five world-class voice codebases.'),
        h('div', { class: 'auth-feats' },
          ['🧬 Voice matching from 10 seconds of audio', '🌍 Voice translation across 4+ languages', ' Lip sync with WebM video export', '🤖 Character agents that chat & call'].map(t => h('div', { class: 'auth-feat' }, t))),
        h('div', { class: 'bars' }, [0, 1, 2, 3, 4, 5, 6].map((i) => h('i', { style: { height: 8 + (i % 4) * 6 + 'px', animationDelay: i * 0.1 + 's' } })))),
      h('div', { class: 'auth-card card' },
        tabs, form, forgot,
        h('div', { class: 'center tiny faint', style: { marginTop: '14px' } },
          'Need help? ', h('a', { href: 'mailto:support@reachmarkdigital.com', class: 'maillink' }, 'support@reachmarkdigital.com'), h('br'),
          h('a', { href: 'mailto:reachmarkofficial@gmail.com', class: 'maillink' }, 'reachmarkofficial@gmail.com'))),
        h('div', { class: 'center tiny faint', style: { marginTop: '10px' } },
          'By continuing you agree to our ', h('a', { class: 'maillink', onclick: () => navigate('/terms') }, 'Terms'), ' & ', h('a', { class: 'maillink', onclick: () => navigate('/privacy') }, 'Privacy Policy'), '.', h('br'), 'Reachmark Audio is a product of Reachmark Digital.')));
  },
};

export function welcomeSheet() {
  sheet('Welcome to Reachmark Audio 🎙️', (box, close) => {
    box.append(
      h('div', { class: 'card', style: { background: 'linear-gradient(140deg, color-mix(in srgb, var(--lime) 16%, var(--card)), var(--card))', display: 'flex', gap: '12px', alignItems: 'center' } },
        icon('spark'), h('div', {}, h('b', {}, '10,000 ✦ credits added'), h('small', { class: 'muted' }, 'Your signup gift — spend them across every studio.'))),
      h('div', { class: 'sect' }, 'Start in 3 steps'),
      h('div', { class: 'row tap', onclick: () => { close(); navigate('/studio/clone'); } }, h('div', { class: 'r-ico' }, icon('copy')), h('div', {}, h('b', {}, '1 · Match your voice'), h('small', {}, 'Record 10 seconds — the nearest neural voice is tuned to you'))),
      h('div', { class: 'row tap', onclick: () => { close(); navigate('/studio/tts'); } }, h('div', { class: 'r-ico' }, icon('text')), h('div', {}, h('b', {}, '2 · Make it speak'), h('small', {}, 'Any text, any language, your character intact'))),
      h('div', { class: 'row tap', onclick: () => { close(); navigate('/agent/guide'); } }, h('div', { class: 'r-ico' }, icon('bot')), h('div', {}, h('b', {}, '3 · Meet your Guide'), h('small', {}, 'The platform AI assistant answers anything, anytime'))),
      h('p', { class: 'tiny faint', style: { marginTop: '12px' } }, 'Tip: press Ctrl / Cmd + K anywhere for the command palette.'));
  });
}
