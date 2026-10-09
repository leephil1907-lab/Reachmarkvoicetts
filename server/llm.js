// Reachmark Audio — LLM adapter for character agents.
// OpenAI-compatible chat completions. Key ONLY from env (LLM_API_KEY).
// Providers: any OpenAI-compatible endpoint via LLM_BASE_URL (OpenAI, Groq, OpenRouter,
// Together, or a self-hosted llama.cpp /v1). Falls back to null so the caller can use
// the on-device persona brain.
'use strict';
const KEY = () => process.env.LLM_API_KEY || '';
const BASE = () => (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const MODEL = () => process.env.LLM_MODEL || 'gpt-4o-mini';
const TIMEOUT = 20000;

function systemPrompt(agent) {
  const kb = (agent.knowledge || []).map(k => '- ' + k).join('\n');
  return [
    `You are "${agent.name}", a character agent on the Reachmark Audio platform.`,
    agent.role ? `Role: ${agent.role}.` : '',
    agent.persona ? `Personality & tone: ${agent.persona}. Stay in character at all times.` : '',
    `Answer using the knowledge base below when relevant. If a fact is not in your brief, say so honestly in character and suggest the user contacts support.`,
    `Keep replies conversational and speakable aloud: 1-4 sentences, no markdown, no links, no emoji lists.`,
    kb ? `Knowledge base:\n${kb}` : '',
  ].filter(Boolean).join('\n');
}

async function chat({ agent, history, message }) {
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
    return { content, source: 'llm', model: j.model || MODEL() };
  } finally { clearTimeout(timer); }
}

module.exports = { chat, configured: () => !!KEY(), model: MODEL };
