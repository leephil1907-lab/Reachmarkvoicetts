// Reachmark Audio — character agent conversation brain.
// Persona-grounded responder: intents + knowledge retrieval over the agent's own facts.
// (Stands in for the llama.cpp adapter in Reachmarkvoicetts lib/server/backend.ts; swap
//  REACHMARK_AGENT_URL in when a GPU node is attached — same contract.)
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9\s₦$]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (t, ...w) => w.some(x => t.includes(x));

export function respond(agent, input) {
  const t = norm(input);
  const name = agent.name.split(' ')[0];
  const kb = agent.knowledge || [];
  const persona = norm(agent.persona || '');

  // 1. knowledge retrieval
  let best = null, bestScore = 0;
  for (const line of kb) {
    const lt = norm(line);
    const words = t.split(' ').filter(w => w.length > 2);
    let s = 0;
    for (const w of words) if (lt.includes(w)) s++;
    if (s > bestScore) { bestScore = s; best = line; }
  }
  if (best && bestScore >= 1) {
    const lead = pick([
      `Good question — here's what I know:`, `From my brief:`, `Yes — ${best.split(' ')[0].toLowerCase()}… let me put it this way:`, `I can help with that.`,
    ]);
    return lead + ' ' + best + maybeTail(persona);
  }

  // 2. intents
  if (has(t, 'hello', 'hi ', 'hey', 'good morning', 'good evening', 'how far')) return pick([agent.greeting, `Hey there! ${name} on the line — what can I do for you?`, `Hello! You reached ${agent.name}. ${agent.role ? agent.role + '.' : ''} How can I help?`]);
  if (has(t, 'your name', 'who are you', 'who am i talking')) return `I'm ${agent.name}, ${agent.role || 'a Reachmark character agent'}. My voice was built in Reachmark Audio, and everything I say is spoken with it — including calls like this one.`;
  if (has(t, 'what can you do', 'help me', 'capabilities', 'able to')) return `I can answer anything in my brief${kb.length ? ` (${kb.length} facts loaded)` : ''}, hold a conversation in character, and join voice calls with my own voice. Ask me about ${kb[0] ? norm(kb[0]).slice(0, 40) : 'my work'} — or anything about ${agent.role || 'my domain'}.`;
  if (has(t, 'price', 'cost', 'how much', 'charge')) { const p = kb.find(k => has(norm(k), 'price', 'cost', '₦', '$', 'naira')); return p ? `Pricing? ${p}` : `I don't have a price sheet in my brief yet — but the team can quote you exactly. Anything else?`; }
  if (has(t, 'time', 'hour', 'open', 'close', 'schedule')) { const p = kb.find(k => has(norm(k), 'hour', 'time', 'am', 'pm', 'open')); return p ? p : `My hours aren't in my brief, but I answer calls any time you see me ringing.`; }
  if (has(t, 'thank', 'thanks', 'cheers', 'appreciate')) return pick([`Anytime! That's what I'm here for.`, `My pleasure — anything else?`, `You're welcome! ${name} always happy to help.`]);
  if (has(t, 'bye', 'goodnight', 'see you', 'later')) return `Talk soon! ${name} signing off — have a great one.`;
  if (has(t, 'voice', 'sound like', 'clone')) return `This voice was built in Reachmark Audio — cloned or designed, then wired straight into my agent runtime. Pretty wild, right?`;
  if (has(t, 'reachmark')) return `Reachmark Audio is the merged voice platform: neural TTS, voice cloning, dubbing, lip sync and character agents — one engine hub. I'm one of its characters.`;

  // 3. persona-flavoured fallback
  const flavour = persona.includes('playful') || persona.includes('fun') ? pick(['Ha! ', 'Ooh, ', 'Fun one — ']) : persona.includes('calm') || persona.includes('warm') ? pick(['Sure — ', 'Of course. ', '']) : pick(['Right — ', 'Okay, ', '']);
  return flavour + pick([
    `that's not in my brief yet, but I've noted it. Try me on ${kb[0] ? norm(kb[0]).slice(0, 34) : 'my role'}?`,
    `I don't have that detail on file. As ${agent.role || 'your agent'}, I'm strongest on: ` + (kb.slice(0, 2).join('; ') || 'my persona'),
    `hmm, beyond my notes — but stay on the line and I'll keep it in character. What else can I help with?`,
    `good one! My knowledge base doesn't cover it yet; the team can add it in the agent builder.`,
  ]) + maybeTail(persona);
}
const pick = a => a[Math.floor(Math.random() * a.length)];
function maybeTail(persona) {
  if (persona.includes('playful')) return pick([' 😄', ' — enjoy!', '']);
  if (persona.includes('concise')) return '';
  return pick(['', '', ' Happy to go deeper on anything.']);
}
