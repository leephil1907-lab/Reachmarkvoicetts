# Reachmark Voice

Reachmark Voice is the dedicated home for the Reachmark AI voice platform: text-to-speech, voice cloning, AI agents, conversations, and automation.

This repository is being established as the canonical holding for the Reachmark Voice application, separate from the main Reachmark business platform.

## Architecture

- Next.js App Router + TypeScript
- Tailwind CSS + Framer Motion
- Self-hosted TTS target: Coqui XTTS v2
- Self-hosted LLM target: llama.cpp with an open model
- Future STT target: Whisper
- Server-side adapters for `/api/tts` and `/api/agent/chat`
- GPU services designed to run as always-on daemons

## Source lineage

The initial Reachmark Voice application currently lives in the `leephil1907-lab/balletsite` repository. This repository is the intended long-term canonical holding for that application.
