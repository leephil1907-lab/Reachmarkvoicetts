"""Private GPU worker for Reachmark Voice Lab.

CosyVoice 3 supports zero-shot voice cloning and natural-language instructions
for delivery/emotion. This worker keeps uploaded reference audio private.
"""
from __future__ import annotations
import base64, hmac, io, json, os, re, secrets, threading, time, shutil, sys
from pathlib import Path
from typing import Literal
import soundfile as sf
import torch
import torchaudio
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from modelscope import snapshot_download
from pydantic import BaseModel, Field

sys.path.insert(0, "/app/CosyVoice")
sys.path.insert(0, "/app/CosyVoice/third_party/Matcha-TTS")

ROOT = Path(os.getenv("VOICE_WORKER_DATA", "/data/voice-worker"))
VOICES, CACHE = ROOT / "voices", ROOT / "models"
MODEL_ID = os.getenv("COSYVOICE_MODEL_ID", "FunAudioLLM/Fun-CosyVoice3-0.5B-2512")
TOKEN = os.getenv("VOICE_WORKER_TOKEN", "")
MAX_SAMPLE_BYTES, MAX_TEXT = 20 * 1024 * 1024, 1200
ROOT.mkdir(parents=True, exist_ok=True)
VOICES.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)
app = FastAPI(title="Reachmark Private Voice Worker", docs_url=None, redoc_url=None)
engine_lock = threading.Lock()
model = None
device, engine_error, ready = "cpu", None, False

def require_token(value: str | None):
    if not TOKEN or not value or not hmac.compare_digest(TOKEN, value):
        raise HTTPException(status_code=401, detail="Worker authentication required.")

def safe_id(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", value or ""):
        raise HTTPException(status_code=400, detail="Invalid voice id.")
    return value

def voice_dir(voice_id: str) -> Path:
    return VOICES / safe_id(voice_id)

def list_voices() -> list[dict]:
    rows = []
    for folder in VOICES.iterdir():
        if not folder.is_dir() or not (folder / "reference.wav").is_file():
            continue
        try:
            meta = json.loads((folder / "profile.json").read_text(encoding="utf-8"))
            rows.append({"id": folder.name, "name": meta.get("name", folder.name), "created": meta.get("created")})
        except Exception:
            continue
    return sorted(rows, key=lambda item: item.get("created", 0), reverse=True)

def load_model():
    global model, device, engine_error, ready
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    try:
        from cosyvoice.cli.cosyvoice import AutoModel
        model_dir = snapshot_download(MODEL_ID, cache_dir=str(CACHE))
        model = AutoModel(model_dir=model_dir)
        ready, engine_error = True, None
        print(f"[voice-worker] CosyVoice 3 ready on {device}: {model_dir}")
    except Exception as exc:
        ready, engine_error = False, str(exc)[:500]
        print(f"[voice-worker] model load failed: {engine_error}")

@app.on_event("startup")
def startup():
    load_model()

@app.get("/v1/health")
def health(x_worker_token: str | None = Header(default=None)):
    require_token(x_worker_token)
    return {
        "ok": True, "ready": ready, "engine": "CosyVoice 3",
        "device": device, "error": engine_error if not ready else None,
        "capabilities": {
            "zero_shot_voice_cloning": ready,
            "instruction_controlled_delivery": ready,
            "emotion_and_prosody_instructions": ready
        }
    }

@app.get("/v1/voices")
def voices(x_worker_token: str | None = Header(default=None)):
    require_token(x_worker_token)
    return {"voices": list_voices()}

class CloneRequest(BaseModel):
    name: str = Field(default="Private test voice", max_length=60)
    notes: str = Field(default="", max_length=200)
    sample_base64: str
    consent: bool = False

@app.post("/v1/clone")
def clone_voice(body: CloneRequest, x_worker_token: str | None = Header(default=None)):
    require_token(x_worker_token)
    if not ready or model is None:
        raise HTTPException(status_code=503, detail="CosyVoice model is not ready.")
    if body.consent is not True:
        raise HTTPException(status_code=400, detail="Voice permission confirmation is required.")
    try:
        raw = base64.b64decode(body.sample_base64, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Sample must be valid base64 PCM WAV audio.")
    if not raw or len(raw) > MAX_SAMPLE_BYTES:
        raise HTTPException(status_code=413, detail="Sample must be 20 MB or smaller.")
    if raw[:4] != b"RIFF" or raw[8:12] != b"WAVE":
        raise HTTPException(status_code=415, detail="Please provide a PCM WAV sample.")
    try:
        audio, sr = sf.read(io.BytesIO(raw), dtype="float32", always_2d=True)
    except Exception as exc:
        raise HTTPException(status_code=415, detail="Could not decode WAV sample.") from exc
    seconds = len(audio) / float(sr)
    if seconds < 3 or seconds > 60:
        raise HTTPException(status_code=422, detail="Use a clean sample between 3 and 60 seconds.")
    # CosyVoice prompt audio is most reliable as clean, mono 16 kHz speech.
    mono = audio.mean(axis=1)
    voice_id = "v_" + secrets.token_hex(8)
    folder = voice_dir(voice_id)
    folder.mkdir(parents=True, exist_ok=False)
    reference_path = folder / "reference.wav"
    try:
        tensor = torch.from_numpy(mono.copy()).float().unsqueeze(0)
        if sr != 16000:
            tensor = torchaudio.functional.resample(tensor, sr, 16000)
        torchaudio.save(str(reference_path), tensor.cpu(), 16000)
        profile = {
            "id": voice_id, "name": body.name.strip() or "Private test voice",
            "notes": body.notes.strip(), "created": int(time.time() * 1000),
            "duration_seconds": round(seconds, 1), "sample_rate": 16000,
            "engine": "CosyVoice 3"
        }
        (folder / "profile.json").write_text(json.dumps(profile), encoding="utf-8")
    except Exception as exc:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(status_code=422, detail="Could not prepare the voice reference. Try a clear, single-speaker recording.") from exc
    return {"voice": {"id": voice_id, "name": profile["name"], "created": profile["created"], "engine": profile["engine"]}}

class SynthesizeRequest(BaseModel):
    voice_id: str
    text: str = Field(min_length=1, max_length=MAX_TEXT)
    style: Literal["conversational", "warm", "excited", "empathetic", "calm"] = "conversational"
    pacing: Literal["natural", "measured", "brisk"] = "natural"

STYLE_INSTRUCTIONS = {
    "conversational": "Speak naturally and conversationally, with relaxed, clear phrasing.",
    "warm": "Speak warmly and reassuringly, with a friendly tone and gentle intonation.",
    "excited": "Speak with excited, upbeat energy, lively intonation, and clear emphasis.",
    "empathetic": "Speak empathetically and gently, with caring intonation and thoughtful pauses.",
    "calm": "Speak calmly and evenly, with measured pacing and a composed tone."
}
PACING_INSTRUCTIONS = {
    "natural": "Use a natural speaking pace.",
    "measured": "Speak a little more slowly, with clear pauses between ideas.",
    "brisk": "Speak slightly briskly while keeping every word clear."
}

@app.post("/v1/synthesize")
def synthesize(body: SynthesizeRequest, x_worker_token: str | None = Header(default=None)):
    require_token(x_worker_token)
    if not ready or model is None:
        raise HTTPException(status_code=503, detail="CosyVoice model is not ready.")
    folder = voice_dir(body.voice_id)
    reference_path = folder / "reference.wav"
    if not reference_path.exists():
        raise HTTPException(status_code=404, detail="Saved voice not found.")
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required.")
    try:
        from cosyvoice.utils.file_utils import load_wav
        prompt_speech_16k = load_wav(str(reference_path), 16000)
        instruction = STYLE_INSTRUCTIONS[body.style] + " " + PACING_INSTRUCTIONS[body.pacing]
        with engine_lock:
            chunks = list(model.inference_instruct2(text, instruction, prompt_speech_16k, stream=False))
        if not chunks:
            raise RuntimeError("CosyVoice returned no audio chunks.")
        speech = torch.cat([chunk["tts_speech"].detach().cpu() for chunk in chunks], dim=-1)
        buffer = io.BytesIO()
        torchaudio.save(buffer, speech, model.sample_rate, format="wav")
        return Response(content=buffer.getvalue(), media_type="audio/wav",
                        headers={"Content-Disposition": 'inline; filename="reachmark-voice-sample.wav"'})
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[voice-worker] synthesis failed: {str(exc)[:300]}")
        raise HTTPException(status_code=502, detail="Could not generate speech. Check the worker logs and try a shorter phrase.") from exc
