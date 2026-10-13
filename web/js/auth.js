// Reachmark Audio — signup & login (real accounts, 10,000 ✦ on signup).
import { h, icon, icons, routes, navigate, toast, api, db, refreshAll, sheet, modal, refreshVerifyBanner } from './core.js';
import { mountAurora } from './gl-bg.js';

/* count-up for hero stats — respects reduced motion, keeps suffixes like '+' and ' s' */
function animateStats(root) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll('.lp-stats b').forEach(b => {
    const m = /^([^\d]*)([\d,]+)(.*)$/.exec(b.textContent.trim());
    if (!m) return;
    const target = parseInt(m[2].replace(/,/g, ''), 10);
    if (!Number.isFinite(target)) return;
    if (reduced) return;                       // already shows the final value
    const t0 = performance.now(), dur = 950;
    const fmt = n => (m[2].includes(',') ? n.toLocaleString() : String(n));
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(2, -10 * k);      // easeOutExpo
      b.textContent = m[1] + fmt(Math.round(target * e)) + m[3];
      if (k < 1) requestAnimationFrame(tick);
    };
    b.textContent = m[1] + fmt(0) + m[3];
    requestAnimationFrame(tick);
  });
}

routes['/auth'] = {
  title: 'Welcome', public: true,
  top: () => ({ noUser: true, left: h('div', { class: 'brand', style: { padding: '4px 0' } }, h('span', { class: 'logo logo-img' }, h('img', { src: '/assets/logo-192.png', alt: 'Reachmark Audio' })), h('div', {}, h('b', {}, 'Reachmark Audio'), h('span', {}, 'by Reachmark Digital'))) }),
  view: async ({ node }) => {
    let mode = 'login';
    const err = h('div', { class: 'auth-err', hidden: true });
    const nameF = h('input', { class: 'input', placeholder: 'Full name', autocomplete: 'name' });
    const emailF = h('input', { class: 'input', placeholder: 'Email address', type: 'email', autocomplete: 'email' });
    const passF = h('input', { class: 'input', placeholder: 'Password (8+ characters)', type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password' });
    const submit = h('button', { class: 'btn primary block', type: 'submit' }, icon('spark'), 'Log in');
    const head = h('h3', { class: 'auth-head' }, 'Log in to your account');
    const tabs = h('div', { class: 'authtabs' },
      h('button', { class: 'on', onclick: () => setMode('login') }, 'Log in'),
      h('button', { onclick: () => setMode('signup') }, 'Sign up'));
    function setMode(m) {
      mode = m;
      [...tabs.children].forEach((c, i) => c.classList.toggle('on', (i === 0) === (m === 'login')));
      nameF.style.display = m === 'signup' ? '' : 'none';
      submit.replaceChildren(icon(m === 'signup' ? 'plus' : 'spark'), m === 'signup' ? 'Create account · get 10,000 ✦' : 'Log in');
      passF.autocomplete = m === 'login' ? 'current-password' : 'new-password';
      head.textContent = m === 'signup' ? 'Create your account' : 'Log in to your account';
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
    node.style.paddingBottom = '0';
    node.classList.add('landing');
    const aurora = h('canvas', { class: 'aurora', 'aria-hidden': 'true' });
    const goSignup = () => { setMode('signup'); const c = document.querySelector('.auth-card'); c && c.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => emailF.focus({ preventScroll: true }), 350); };
    const scrollTo = (sel) => () => document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    node.append(h('nav', { class: 'lp-nav', 'data-stag': '' },
      h('div', { class: 'lp-links' },
        h('button', { onclick: scrollTo('#lp-studios') }, 'Studios'),
        h('button', { onclick: scrollTo('#lp-studios') }, 'Features'),
        h('button', { onclick: () => navigate('/terms') }, 'Terms'),
        h('button', { onclick: () => navigate('/privacy') }, 'Privacy')),
      h('button', { class: 'btn ghost sm', onclick: () => { setMode('login'); scrollTo('.auth-card')(); } }, 'Log in'),
      h('button', { class: 'btn primary sm', onclick: goSignup }, icon('spark'), 'Sign up free')));
    node.append(h('div', { class: 'authwrap', 'data-stag': '' },
      h('div', { class: 'auth-hero' },
        aurora,
        h('span', { class: 'lp-eyebrow' }, icon('spark'), 'Reachmark Digital · worldwide voice infrastructure'),
        h('h1', {}, 'Studio-grade AI voice, ', h('span', { class: 'grad' }, 'indistinguishable from humans.')),
        h('p', { class: 'muted' }, 'Reachmark Audio turns text into human-grade speech in 40+ languages — clone, design, dub, lip-sync and call with voices that are yours. One professional platform, every language.'),
        h('div', { class: 'lp-cta' },
          h('button', { class: 'btn primary lg', onclick: goSignup }, icon('spark'), 'Start free — 10,000 credits'),
          h('button', { class: 'btn ghost lg', onclick: scrollTo('#lp-studios') }, 'Explore the studios')),
        h('div', { class: 'lp-checks' },
          ['10,000 credits on signup', '40+ languages & accents', '10-second voice clone', 'No card required'].map(t => h('span', {}, icon('check'), t))),
        h('div', { class: 'lp-stats' },
          [['6', 'studios'], ['40+', 'languages'], ['10 s', 'voice clone'], ['10,000', 'free credits']].map(([v, l]) => h('div', {}, h('b', {}, v), h('span', {}, l)))),
        (() => {
          const chips = ['Voiceovers', 'Dubbing', 'Lip sync', 'Characters', 'Translation', 'Voice changing'];
          const grp = hidden => h('div', { class: 'marq-grp', ...(hidden ? { 'aria-hidden': 'true' } : {}) }, chips.map(t => h('span', {}, t)));
          return h('div', { class: 'lp-chips' }, h('div', { class: 'marq-track' }, grp(false), grp(true)));
        })(),
        h('div', { class: 'bars' }, [0, 1, 2, 3, 4, 5, 6].map((i) => h('i', { style: { height: 8 + (i % 4) * 6 + 'px', animationDelay: i * 0.1 + 's' } })))),
      h('div', { class: 'auth-card card' },
        head, tabs, form, forgot,
        h('div', { class: 'center tiny faint', style: { marginTop: '14px' } },
          'Need help? ', h('a', { href: 'mailto:support@reachmarkdigital.com', class: 'maillink' }, 'support@reachmarkdigital.com'), h('br'),
          h('a', { href: 'mailto:reachmarkofficial@gmail.com', class: 'maillink' }, 'reachmarkofficial@gmail.com'))),
        h('div', { class: 'center tiny faint', style: { marginTop: '10px' } },
          'By continuing you agree to our ', h('a', { class: 'maillink', onclick: () => navigate('/terms') }, 'Terms'), ' & ', h('a', { class: 'maillink', onclick: () => navigate('/privacy') }, 'Privacy Policy'), '.', h('br'), 'Reachmark Audio is a product of Reachmark Digital.')));
    node.append(h('div', { class: 'lp-bento', id: 'lp-studios', 'data-stag': '' },
      [['text', 'Text to Speech', 'Type anything — hear it in any voice you own, in any supported language, with pitch, speed and expression control.'],
       ['copy', 'Voice Match', 'Instant cloning: ten seconds of audio becomes a tuned neural voice that stays yours across every studio.'],
       ['swap', 'Voice Changer', 'Professional pitch, timbre and FX chains on any recording — from subtle warmth to full character swaps.'],
       ['globe', 'Dubbing Studio', 'Translate and re-voice video for worldwide audiences, with downloadable masters.'],
       ['film', 'Lip Sync', 'Match speech to footage frame-accurately and export WebM ready for publish.'],
       ['bot', 'Character Agents', 'Agents built from your character bible that chat, act and call people in their own voice.']]
        .map(([ic, t, d]) => h('button', { class: 'lp-card', onclick: goSignup },
          h('span', { class: 'qi' }, icon(ic)), h('b', {}, t), h('p', {}, d), h('small', {}, 'Included free with your account')))),
      h('section', { class: 'lp-faq', id: 'lp-faq' },
        h('h2', {}, 'Frequently asked questions'),
        ...[
          ['What languages does Reachmark Audio support?', 'Neural text-to-speech and voice translation across 40+ languages and accents, including English, Spanish, French, German and Yoruba — with more models added as the engine library grows.'],
          ['How does Voice Match cloning work?', 'Record or upload ten seconds of clean audio and Reachmark Audio matches and tunes the nearest neural voice to it. Only clone voices you have the rights to use.'],
          ['Can I use generated audio commercially?', 'Yes. Voices you render are licensed for your commercial and personal use under the Terms of Service, on free and Plus plans alike.'],
          ['What does it cost?', 'Signing up is free and adds 10,000 credits. Every studio shows its credit cost before you render, and a Plus trial unlocks unlimited-style creation.'],
          ['Does it work as an installed app or offline?', 'Reachmark Audio installs as a PWA on desktop and mobile. The shell, your session and queued support messages work offline; studios stream from live engines when connected.'],
          ['How do I reach a human?', 'Use live chat in the Support Center, or email support@reachmarkdigital.com / reachmarkofficial@gmail.com — real people at Reachmark Digital reply.'],
        ].map(([q, a]) => h('details', {}, h('summary', {}, q), h('p', {}, a)))),
      h('footer', { class: 'lp-foot2' },
        h('div', { class: 'fcol' }, h('h4', {}, 'Studios'),
          ...['Text to Speech', 'Voice Match', 'Voice Changer', 'Dubbing Studio', 'Lip Sync', 'Voice Design'].map(t => h('button', { onclick: goSignup }, t))),
        h('div', { class: 'fcol' }, h('h4', {}, 'Company'),
          h('button', { onclick: scrollTo('#lp-studios') }, 'Features'),
          h('a', { href: 'mailto:reachmarkofficial@gmail.com' }, 'Reachmark Digital'),
          h('button', { onclick: goSignup }, 'Pricing & credits')),
        h('div', { class: 'fcol' }, h('h4', {}, 'Legal'),
          h('button', { onclick: () => navigate('/terms') }, 'Terms of Service'),
          h('button', { onclick: () => navigate('/privacy') }, 'Privacy Policy')),
        h('div', { class: 'fcol' }, h('h4', {}, 'Contact'),
          h('a', { href: 'mailto:support@reachmarkdigital.com' }, 'support@reachmarkdigital.com'),
          h('a', { href: 'mailto:reachmarkofficial@gmail.com' }, 'reachmarkofficial@gmail.com')),
        h('div', { class: 'fbot' },
          h('div', { class: 'brand' }, h('span', { class: 'logo logo-img' }, h('img', { src: '/assets/logo-192.png', alt: '' })), h('div', {}, h('b', {}, 'Reachmark Audio'), h('span', {}, 'by Reachmark Digital'))),
          h('span', {}, '© 2026 Reachmark Digital · Worldwide voice infrastructure'))));
    mountAurora(aurora);   // self-managing: pauses offscreen, removes itself without WebGL
    animateStats(node);
  },
};

/* ---------- email verification: link landing page + code entry ---------- */
function verifyView(withToken) {
  return async ({ node, params }) => {
    const card = h('div', { class: 'auth-card card', style: { maxWidth: '440px', margin: '40px auto', textAlign: 'center', padding: '26px 22px' } });
    node.append(h('div', { class: 'authwrap' }, card));
    const success = (already) => {
      if (db.user) { db.user.verified = true; refreshVerifyBanner(); }
      card.replaceChildren(h('div', { class: 'vbadge' }, icon('check')),
        h('b', { style: { fontSize: '19px', display: 'block', margin: '8px 0 4px' } }, already ? 'Already verified' : 'Email verified!'),
        h('p', { class: 'muted', style: { fontSize: '13.5px' } }, 'Your Reachmark Digital account is confirmed — every studio is unlocked.'),
        h('button', { class: 'btn primary block', style: { marginTop: '14px' }, onclick: () => navigate(db.user ? '/home' : '/auth') }, icon('spark'), db.user ? 'Back to the studio' : 'Continue to log in'));
    };
    const fail = (message, soft) => {
      const codeIn = h('input', { class: 'input', placeholder: '6-digit code', inputmode: 'numeric', maxlength: '6', autocomplete: 'one-time-code', style: { textAlign: 'center', letterSpacing: '.3em', fontSize: '18px' } });
      const err = h('div', { class: soft ? 'tiny muted' : 'auth-err', style: soft ? { margin: '0 0 10px' } : {} }, message);
      card.replaceChildren(h('div', { class: 'vbadge mail' }, icon('mail')),
        h('b', { style: { fontSize: '19px', display: 'block', margin: '8px 0 4px' } }, 'Enter your 6-digit code'),
        h('p', { class: 'muted', style: { fontSize: '13.5px' } }, 'The link is one option — the code in the same email works everywhere:'),
        err, codeIn,
        h('button', { class: 'btn primary block', style: { marginTop: '12px' }, onclick: async e => {
          e.currentTarget.disabled = true;
          try { const r = await api('/api/auth/verify', { method: 'POST', body: { code: codeIn.value.trim() } }); success(r.already); }
          catch (e2) { err.className = 'auth-err'; err.textContent = e2.message; e.currentTarget.disabled = false; }
        } }, icon('check'), 'Verify my email'),
        h('button', { class: 'btn ghost block', onclick: async e => {
          e.currentTarget.disabled = true;
          try { const r = await api('/api/auth/verify/resend', { method: 'POST', body: { email: db.user?.email || codeIn.value } }); toast(r.message, 'mail'); }
          catch (e2) { toast(e2.message, 'close'); }
          e.currentTarget.disabled = false;
        } }, icon('refresh'), 'Resend the email'));
      setTimeout(() => codeIn.focus(), 80);
    };
    if (withToken) {
      card.replaceChildren(h('i', { class: 'spin' }), h('p', { class: 'muted', style: { marginTop: '10px' } }, 'Verifying your email…'));
      try { const r = await api('/api/auth/verify', { method: 'POST', body: { token: params[0] } }); success(r.already); }
      catch (e) { fail(e.message, false); }
    } else {
      fail('Check your inbox — the code looks like 4 8 2 9 1 5.', true);
    }
  };
}
routes['/verify/:token'] = {
  title: 'Verify email', public: true,
  top: () => ({ back: true, title: 'Email verification', sub: 'Reachmark Audio · Reachmark Digital' }),
  view: verifyView(true),
};
routes['/verify'] = {
  title: 'Verify email', public: true,
  top: () => ({ back: true, title: 'Email verification', sub: 'Enter the 6-digit code from your inbox' }),
  view: verifyView(false),
};

export function welcomeSheet() {
  sheet('Welcome to Reachmark Audio', (box, close) => {
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
