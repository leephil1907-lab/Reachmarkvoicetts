// Reachmark Audio — on-device persona brain (fallback when no LLM_API_KEY is configured).
// Same contract as the LLM adapter: respond(agent, message) -> string.
'use strict';
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9\s₦$]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (t, ...w) => w.some(x => t.includes(x));
const pick = a => a[Math.floor(Math.random() * a.length)];

function respond(agent, input) {
  const t = norm(input);
  const name = (agent.name || 'Agent').split(' ')[0];
  const kb = agent.knowledge || [];
  const persona = norm(agent.persona || '');
  let best = null, bestScore = 0;
  for (const line of kb) {
    const lt = norm(line);
    const words = t.split(' ').filter(w => w.length > 2);
    let s = 0;
    for (const w of words) if (lt.includes(w)) s++;
    if (s > bestScore) { bestScore = s; best = line; }
  }
  if (best && bestScore >= 1) {
    return pick(['Good question — here is what I know:', 'From my brief:', 'I can help with that.', 'Yes — let me put it this way:']) + ' ' + best + tail(persona);
  }
  if (has(t, 'hello', 'hi ', 'hey', 'good morning', 'good evening')) return pick([agent.greeting, `Hey there! ${name} on the line — what can I do for you?`, `Hello! You reached ${agent.name}. How can I help?`]);
  if (has(t, 'your name', 'who are you')) return `I'm ${agent.name}, ${agent.role || 'a Reachmark character agent'}. My voice was built in Reachmark Audio and every reply is spoken with it.`;
  if (has(t, 'what can you do', 'help me', 'capabilities')) return `I can answer anything in my brief${kb.length ? ` (${kb.length} facts loaded)` : ''}, hold a conversation in character, and join voice calls with my own voice.`;
  if (has(t, 'price', 'cost', 'how much')) { const p = kb.find(k => has(norm(k), 'price', 'cost', '₦', '$')); return p ? `Pricing? ${p}` : 'I do not have a price sheet in my brief yet — the team can quote you exactly.'; }
  if (has(t, 'thank', 'thanks', 'cheers')) return pick(['Anytime! That is what I am here for.', 'My pleasure — anything else?', `You're welcome! ${name} always happy to help.`]);
  if (has(t, 'bye', 'goodnight', 'see you')) return `Talk soon! ${name} signing off — have a great one.`;
  if (has(t, 'voice', 'clone', 'sound like')) return 'This voice was built in Reachmark Audio — matched, designed or stock — and wired straight into my agent runtime.';
  const flavour = persona.includes('playful') ? pick(['Ha! ', 'Ooh, ', 'Fun one — ']) : persona.includes('calm') || persona.includes('warm') ? pick(['Sure — ', 'Of course. ', '']) : pick(['Right — ', 'Okay, ', '']);
  return flavour + pick([
    `that is not in my brief yet, but I have noted it. Try me on ${kb[0] ? norm(kb[0]).slice(0, 34) : 'my role'}?`,
    'I do not have that detail on file. ' + (kb.slice(0, 2).join('; ') || 'Ask about my role.'),
    'hmm, beyond my notes — but stay on the line and I will keep it in character.',
  ]) + tail(persona);
}
function tail(persona) {
  if (persona.includes('playful')) return pick([' 😄', ' — enjoy!', '']);
  if (persona.includes('concise')) return '';
  return pick(['', '', ' Happy to go deeper on anything.']);
}
module.exports = { respond };
