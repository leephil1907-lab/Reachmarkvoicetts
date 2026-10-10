// Reachmark Audio — branded email templates.
// Every message carries the Reachmark Digital company footer: Reachmark Audio is a
// product of Reachmark Digital. HTML is table-free, inline-styled (email-client safe),
// and each template also returns a plain-text twin for clients that block HTML.
'use strict';

const COMPANY = 'Reachmark Digital';
const CONTACT = 'reachmarkofficial@gmail.com';
const SUPPORT = 'support@reachmarkdigital.com';

function wrap(title, bodyHtml, preheader) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f2f1ee;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1f1a">
<div style="display:none;max-height:0;overflow:hidden">${preheader || ''}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f1ee;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e1da">
  <tr><td style="background:#151310;padding:22px 28px">
    <span style="font-size:22px">🎙️</span>
    <span style="color:#f2f5ee;font-size:17px;font-weight:800;letter-spacing:.02em;margin-left:8px">Reachmark Audio</span>
    <span style="color:#d3f36b;font-size:11px;font-weight:700;letter-spacing:.14em;margin-left:10px;text-transform:uppercase">by ${COMPANY}</span>
    <div style="height:3px;background:linear-gradient(90deg,#d3f36b,#63d9ff);border-radius:2px;margin-top:14px"></div>
  </td></tr>
  <tr><td style="padding:28px">
    ${bodyHtml}
  </td></tr>
  <tr><td style="background:#faf9f6;border-top:1px solid #eceae4;padding:18px 28px;font-size:12px;color:#77796f;line-height:1.7">
    <b style="color:#43453d">${COMPANY}</b> · Reachmark Audio is a product of ${COMPANY}.<br>
    General: <a href="mailto:${CONTACT}" style="color:#43453d">${CONTACT}</a> · Support &amp; billing: <a href="mailto:${SUPPORT}" style="color:#43453d">${SUPPORT}</a><br>
    You receive this because you have a Reachmark Audio account. Worldwide service · all regions welcome.<br>
    © ${new Date().getFullYear()} ${COMPANY}. All rights reserved.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
const btn = (href, label) => `<a href="${href}" style="display:inline-block;background:#d3f36b;color:#171a09;font-weight:800;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px">${label}</a>`;
const p = (html) => `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#33352e">${html}</p>`;
const h1 = (t) => `<h1 style="margin:0 0 14px;font-size:21px;color:#151310">${t}</h1>`;

function welcome({ name, email, credits, url }) {
  const subject = 'Welcome to Reachmark Audio — your ' + credits.toLocaleString() + ' credits are live';
  const html = wrap(subject,
    h1('Welcome aboard, ' + name + ' 👋') +
    p(`Your Reachmark Audio account (<b>${email}</b>) is ready. We have added <b>${credits.toLocaleString()} ✦ credits</b> to your balance — they are live right now.`) +
    p('Start with anything: neural text-to-speech and voice translation in any language, Voice Match (tune a neural voice to you from 10 seconds of audio), the voice changer, dubbing, lip sync — or build a <b>character agent</b> that talks and calls in its own voice.') +
    p(btn(url + '/#/home', 'Open Reachmark Audio')) +
    p('<span style="color:#77796f;font-size:12.5px">Credits never expire while your account is active. Failed renders refund automatically. Questions? Reply-anytime support at ' + SUPPORT + '.</span>'),
    'Your ' + credits.toLocaleString() + ' credits are live.');
  const text = `Welcome to Reachmark Audio, ${name}!\n\nYour account (${email}) is ready with ${credits.toLocaleString()} credits — live now.\nOpen the studio: ${url}/#/home\n\nReachmark Audio is a product of ${COMPANY}.\n${CONTACT} · ${SUPPORT}`;
  return { subject, html, text };
}

function passwordReset({ name, url, token }) {
  const link = url + '/#/reset/' + token;
  const subject = 'Reset your Reachmark Audio password';
  const html = wrap(subject,
    h1('Password reset requested') +
    p(`Hi ${name} — we received a request to reset your Reachmark Audio password. Use the button below within <b>30 minutes</b>:`) +
    p(btn(link, 'Choose a new password')) +
    p('<span style="color:#77796f;font-size:12.5px">If the button does not work, paste this link:<br>' + link + '</span>') +
    p('<span style="color:#77796f;font-size:12.5px">Did not request this? Ignore this email — your password stays unchanged and the link expires on its own.</span>'),
    'Reset link inside — expires in 30 minutes.');
  const text = `Hi ${name},\n\nReset your Reachmark Audio password within 30 minutes:\n${link}\n\nIf you did not request this, ignore this email.\n\n${COMPANY} · ${SUPPORT}`;
  return { subject, html, text };
}

function passwordChanged({ name }) {
  const subject = 'Your Reachmark Audio password was changed';
  const html = wrap(subject,
    h1('Password changed 🔒') +
    p(`Hi ${name} — your Reachmark Audio password was just changed. All other sessions were signed out.`) +
    p('<span style="color:#77796f;font-size:12.5px">If this was not you, reset your password immediately and write to ' + SUPPORT + '.</span>'),
    'Security notice.');
  const text = `Hi ${name}, your Reachmark Audio password was changed and other sessions were signed out.\nNot you? Contact ${SUPPORT} immediately.\n\n${COMPANY}`;
  return { subject, html, text };
}

function supportReply({ name, excerpt, url }) {
  const subject = 'Reachmark support replied to you';
  const html = wrap(subject,
    h1('The support team replied 💬') +
    p(`Hi ${name} — a member of Reachmark support answered your conversation:`) +
    `<div style="background:#f4f8e8;border:1px solid #dcebc0;border-left:4px solid #d3f36b;border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.6;color:#33352e;margin:0 0 16px">${excerpt}</div>` +
    p(btn(url + '/#/support/chat', 'Continue the conversation')) +
    p('<span style="color:#77796f;font-size:12.5px">This message also stays in your app: Support → Live chat.</span>'),
    'New reply in your support conversation.');
  const text = `Hi ${name},\n\nReachmark support replied:\n\n"${excerpt}"\n\nContinue: ${url}/#/support/chat\n\n${COMPANY} · ${SUPPORT}`;
  return { subject, html, text };
}

function suspended({ name, reason, url }) {
  const subject = 'Your Reachmark Audio account is suspended';
  const html = wrap(subject,
    h1('Account suspended') +
    p(`Hi ${name} — your Reachmark Audio account has been suspended.${reason ? ' Reason given: <b>' + reason + '</b>.' : ''}`) +
    p('If you believe this is a mistake, reply to this email or write to ' + SUPPORT + ' — a human reviews every suspension.') +
    p('<span style="color:#77796f;font-size:12.5px">' + (url || '') + '</span>'),
    'Account status change.');
  const text = `Hi ${name}, your Reachmark Audio account has been suspended.${reason ? ' Reason: ' + reason + '.' : ''}\nAppeal: ${SUPPORT}\n\n${COMPANY}`;
  return { subject, html, text };
}

function reinstated({ name, url }) {
  const subject = 'Your Reachmark Audio account is active again';
  const html = wrap(subject,
    h1('Welcome back 🎉') +
    p(`Hi ${name} — your suspension has been lifted and your account is fully active again.`) +
    p(btn(url + '/#/home', 'Back to the studio')),
    'Account reinstated.');
  const text = `Hi ${name}, your Reachmark Audio account is active again: ${url}/#/home\n\n${COMPANY}`;
  return { subject, html, text };
}

function adminThreadNotice({ adminEmail, threadId, userEmail, preview, url }) {
  const subject = '[Reachmark support] new conversation from ' + userEmail;
  const html = wrap(subject,
    h1('New support conversation') +
    p(`User <b>${userEmail}</b> opened/updated thread <b>${threadId}</b>:`) +
    `<div style="background:#f5f5f2;border:1px solid #e3e1da;border-radius:10px;padding:12px 14px;font-size:13.5px;color:#33352e;margin:0 0 16px">${preview}</div>` +
    p(btn(url + '/#/inbox', 'Open inbox')),
    'Inbox activity.');
  const text = `New support thread ${threadId} from ${userEmail}:\n"${preview}"\n\n${COMPANY} internal · ${adminEmail}`;
  return { subject, html, text };
}

function adminOfflineReply({ adminEmail, threadId, userEmail, replyText }) {
  const subject = '[Reachmark support] offline reply delivered to ' + userEmail;
  const html = wrap(subject,
    h1('Reply queued for an offline user') +
    p(`Admin <b>${adminEmail}</b> replied in thread <b>${threadId}</b>. The user was offline, so the reply was emailed to them and will appear in-app on their next open.`) +
    `<div style="background:#f5f5f2;border:1px solid #e3e1da;border-radius:10px;padding:12px 14px;font-size:13.5px;color:#33352e;margin:0 0 16px">${replyText}</div>`,
    'Inbox activity.');
  const text = `Offline reply in thread ${threadId} to ${userEmail} by ${adminEmail}:\n"${replyText}"\n\n${COMPANY} internal`;
  return { subject, html, text };
}

module.exports = { COMPANY, CONTACT, SUPPORT, welcome, passwordReset, passwordChanged, supportReply, suspended, reinstated, adminThreadNotice, adminOfflineReply };
