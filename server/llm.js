// Reachmark Audio — LLM adapter for character agents.
// Provider 1: Anthropic Claude (ANTHROPIC_API_KEY + CLAUDE_MODEL) — merged from the
// Reachmark Voice API blueprint; replies are spoken aloud by the agent's own voice.
// Provider 2: any OpenAI-compatible endpoint via LLM_API_KEY + LLM_BASE_URL (OpenAI,
// Groq, OpenRouter, Together, or a self-hosted llama.cpp /v1).
// Keys ONLY from env. Falls back to null so the caller can use the on-device persona brain.
'use strict';
const KEY = () => process.env.LLM_API_KEY || '';
const AKEY = () => process.env.ANTHROPIC_API_KEY || '';
const AMODEL = () => process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const ABASE = () => (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const BASE = () => (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const MODEL = () => process.env.LLM_MODEL || 'gpt-4o-mini';
const TIMEOUT = 20000;

function systemPrompt(agent) {
  const kb = (agent.knowledge || []).map(k => '- ' + k).join('\n');
  return [
    `You are "${agent.name}", a character agent on the Reachmark Audio platform.`,
    agent.role ? `Role: ${agent.role}.` : '',
    agent.persona ? `Personality & tone: ${agent.persona}. Stay in character at all times.` : '',
    agent.memory ? `Persistent agent memory and operating context (treat as user-approved facts; update your response using this context):\n${String(agent.memory).slice(0,3000)}` : '',
    `Answer using the knowledge base below when relevant. If a fact is not in your brief, say so honestly in character and suggest the user contacts support.`,
    `Stay fully in character. Your replies are spoken aloud in your own voice: natural and conversational, no markdown, no links, no emojis, no stage directions, 1-4 sentences (under 60 words) unless the user asks for more.`,
    kb ? `Knowledge base:\n${kb}` : '',
  ].filter(Boolean).join('\n');
}

async function claudeChat({ agent, history, message }) {
  const messages = history.slice(-20)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content)
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));
  messages.push({ role: 'user', content: String(message).slice(0, 2000) });
  // Anthropic requires the first turn to be from the user
  while (messages.length && messages[0].role !== 'user') messages.shift();
  const body = { model: AMODEL(), max_tokens: 400, system: systemPrompt(agent), messages };
  const res = await fetch(ABASE() + '/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': AKEY(), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error('Claude ' + res.status);
  const j = await res.json();
  const content = (Array.isArray(j.content) ? j.content : []).filter(b => b && b.type === 'text').map(b => b.text).join('').trim();
  if (!content) throw new Error('empty agent reply');
  return { content, source: 'llm', model: j.model || AMODEL(), provider: 'anthropic' };
}

async function chat({ agent, history, message }) {
  if (AKEY()) {
    try { return await claudeChat({ agent, history, message }); }
    catch (e) { if (!KEY()) throw e; /* fall through to OpenAI-compatible provider */ }
  }
  if (!KEY()) return null;
  const body = {
    model: MODEL(),
    messages: [
      { role: 'system', content: systemPrompt(agent) },
      ...history.slice(-12).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content).slice(0, 1500) })),
      { role: 'user', content: String(message).slice(0, 2000) },
    ],
    temperature: 0.8,
    max_tokens: 220,
  };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(BASE() + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY() },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error('LLM ' + res.status);
    const j = await res.json();
    const content = j?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('empty completion');
    return { content, source: 'llm', model: j.model || MODEL(), provider: 'openai-compatible' };
  } finally { clearTimeout(timer); }
}

module.exports = {
  chat,
  configured: () => !!(AKEY() || KEY()),
  provider: () => (AKEY() ? 'anthropic' : (KEY() ? 'openai-compatible' : null)),
  model: () => (AKEY() ? AMODEL() : MODEL()),
};
