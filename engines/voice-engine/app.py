"""Reachmark Voice Engine — self-hosted zero-shot voice cloning + multilingual TTS.

Runs Chatterbox Multilingual (Resemble AI, MIT licence, 23 languages) behind a tiny
authenticated HTTP API. The Reachmark Audio Node server calls it; no third-party voice
provider is involved. Best on an NVIDIA GPU (≈1–3 s per sentence); works on CPU but slowly.

  POST /v1/tts   multipart: text, language, [sample=wav/mp3/webm], exaggeration, cfg_weight
                 -> audio/wav          (header: Authorization: Bearer $VOICE_ENGINE_TOKEN)
  GET  /health   -> {ok, device, languages}
"""
import asyncio
import hmac
import io
import os
import tempfile
from contextlib import asynccontextmanager

import torch
import torchaudio
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response

TOKEN = os.environ.get("VOICE_ENGINE_TOKEN", "")
MAX_CHARS = int(os.environ.get("VOICE_ENGINE_MAX_CHARS", "1000"))
MAX_SAMPLE_BYTES = 20 * 1024 * 1024
MAX_REF_SECONDS = 30
DEVICE = os.environ.get("VOICE_ENGINE_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")

state = {"model": None, "langs": {}}
gen_lock = asyncio.Lock()  # one generation at a time per process (GPU memory safety)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not TOKEN:
        raise RuntimeError("VOICE_ENGINE_TOKEN must be set — refusing to start an open voice engine.")
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS, SUPPORTED_LANGUAGES

    state["model"] = await asyncio.to_thread(ChatterboxMultilingualTTS.from_pretrained, DEVICE)
    state["langs"] = dict(SUPPORTED_LANGUAGES)
    yield


app = FastAPI(title="Reachmark Voice Engine", lifespan=lifespan)


def check_auth(authorization: str | None):
    got = (authorization or "").removeprefix("Bearer ").strip()
    if not got or not hmac.compare_digest(got, TOKEN):
        raise HTTPException(401, "unauthorized")


@app.get("/health")
async def health():
    ready = state["model"] is not None
    return JSONResponse({"ok": ready, "device": DEVICE, "model": "chatterbox-multilingual", "languages": sorted(state["langs"])}, status_code=200 if ready else 503)


def trim_reference(raw: bytes) -> str:
    """Decode any browser/audio upload, mono-mix, cap to 30 s, return a temp wav path."""
    wav, sr = torchaudio.load(io.BytesIO(raw))
    wav = wav.mean(dim=0, keepdim=True)
    wav = wav[:, : sr * MAX_REF_SECONDS]
    if wav.shape[1] < sr * 3:
        raise HTTPException(422, "Reference sample too short — at least 3 seconds of speech are needed.")
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    torchaudio.save(path, wav, sr)
    return path


@app.post("/v1/tts")
async def tts(
    text: str = Form(...),
    language: str = Form("en"),
    exaggeration: float = Form(0.5),
    cfg_weight: float = Form(0.5),
    sample: UploadFile | None = File(None),
    authorization: str | None = Header(None),
):
    check_auth(authorization)
    model = state["model"]
    if model is None:
        raise HTTPException(503, "model still loading")
    text = text.strip()
    if not text or len(text) > MAX_CHARS:
        raise HTTPException(400, f"text must be 1-{MAX_CHARS} characters")
    lang = (language or "en").lower()[:2]
    if lang not in state["langs"]:
        raise HTTPException(400, "unsupported language: " + lang)
    ref_path = None
    try:
        if sample is not None:
            raw = await sample.read()
            if len(raw) > MAX_SAMPLE_BYTES:
                raise HTTPException(413, "sample too large")
            try:
                ref_path = await asyncio.to_thread(trim_reference, raw)
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(422, "Could not decode the reference audio.")

        def run():
            return model.generate(
                text, language_id=lang, audio_prompt_path=ref_path,
                exaggeration=max(0.25, min(2.0, exaggeration)), cfg_weight=max(0.0, min(1.0, cfg_weight)),
            )

        async with gen_lock:
            out = await asyncio.to_thread(run)
        buf = io.BytesIO()
        torchaudio.save(buf, out.cpu(), model.sr, format="wav")
        return Response(buf.getvalue(), media_type="audio/wav")
    finally:
        if ref_path:
            try:
                os.unlink(ref_path)
            except OSError:
                pass
