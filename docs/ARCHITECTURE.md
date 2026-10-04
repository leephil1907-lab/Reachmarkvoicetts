# Reachmark Voice architecture

Reachmark Voice is designed as a self-hosted voice platform with a Next.js control plane and private model runtimes.

## Runtime

```text
Browser
  |
  v
Next.js / Vercel
  |-- /api/tts ------> private XTTS service
  |-- /api/agent/chat -> private llama.cpp service
  |-- /api/health
  |
  +-- Voice Studio
  +-- Agent Builder
  +-- Conversations
  +-- Automation
```

## Environment

- `REACHMARK_TTS_URL`: server-side URL for the XTTS `/synthesize` endpoint.
- `REACHMARK_AGENT_URL`: server-side URL for the llama.cpp OpenAI-compatible chat endpoint.
- `REACHMARK_AGENT_MODEL`: model identifier sent to llama.cpp; defaults to `dolphin-3.0-8b`.
- `REACHMARK_BACKEND_TOKEN`: optional shared service token for private runtimes.

Never expose these as `NEXT_PUBLIC_*` variables.

## Model adapters

The UI talks only to Reachmark API routes. The adapters in `lib/server/backend.ts` normalize backend responses so the frontend is independent of the model vendor/runtime.

The LLM adapter accepts both a native `{ content }` response and the OpenAI-compatible llama.cpp shape `{ choices: [{ message: { content } }] }`.

## GPU services

The repository includes systemd units under `infra/systemd/`. The default units bind model servers to `127.0.0.1`; use a private network gateway when Next.js is hosted on a different machine.

## Next platform layers

1. Persistent voice storage and voice metadata.
2. Authentication and per-user authorization.
3. Voice-clone ingestion and quality validation.
4. Agent persistence, tools and knowledge sources.
5. Streaming STT/TTS for real-time calls.
6. Conversation transcripts, summaries and analytics.
7. Workflow execution and webhook integrations.
