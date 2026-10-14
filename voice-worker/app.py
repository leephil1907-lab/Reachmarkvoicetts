"""Private GPU worker for Reachmark Voice Lab.

Uses OpenVoice V2 for voice-tone cloning and MeloTTS for source speech.
Delivery presets currently influence pacing and phrasing; they do not guarantee
emotion-level prosody control.
"""
from __future__ import annotations
import base64, hmac, io, os, re, secrets, tempfile, threading, time, json, shutil
from pathlib import Path
from typing import Literal
import soundfile as sf
import torch
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from huggingface_hub import snapshot_download
from pydantic import BaseModel, Field

ROOT = Path(os.getenv("VOICE_WORKER_DATA", "/data/voice-worker"))
VOICES, TMP = ROOT / "voices", ROOT / "tmp"
CHECKPOINTS = Path(os.getenv("OPENVOICE_CHECKPOINTS", "/app/checkpoints_v2"))
TOKEN = os.getenv("VOICE_WORKER_TOKEN", "")
MAX_SAMPLE_BYTES, MAX_TEXT = 20 * 1024 * 1024, 1200
ROOT.mkdir(parents=True, exist_ok=True)
VOICES.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)
app = FastAPI(title="Reachmark Private Voice Worker", docs_url=None, redoc_url=None)
engine_lock = threading.Lock()
converter = tts_model = source_se = None
device, engine_error, ready = "cpu", None, False

def authorized(value: str | None) -> bool:
    return bool(TOKEN) and bool(value) and hmac.compare_digest(TOKEN, value)

def require_token(value: str | None):
    if not authorized(value):
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
        if not folder.is_dir() or not (folder / "embedding.pth").is_file():
            continue
        try:
            meta = json.loads((folder / "profile.json").read_text(encoding="utf-8"))
            rows.append({"id": folder.name, "name": meta.get("name", folder.name), "created": meta.get("created")})
        except Exception:
            continue
    return sorted(rows, key=lambda item: item.get("created", 0), reverse=True)

def load_models():
    global converter, tts_model, source_se, device, engine_error, ready
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    try:
        converter_dir = CHECKPOINTS / "converter"
        source_path = CHECKPOINTS / "base_speakers" / "ses" / "en-us.pth"
        if not (converter_dir / "config.json").exists() or not (converter_dir / "checkpoint.pth").exists() or not source_path.exists():
            CHECKPOINTS.mkdir(parents=True, exist_ok=True)
            snapshot_download(repo_id="myshell-ai/OpenVoiceV2", local_dir=str(CHECKPOINTS))
        from openvoice.api import ToneColorConverter
        from melo.api import TTS
        converter = ToneColorConverter(str(converter_dir / "config.json"), device=device)
        converter.load_ckpt(str(converter_dir / "checkpoint.pth"))
        source_se = torch.load(str(source_path), map_location=device, weights_only=False)
        tts_model = TTS(language="EN", device=device)
        ready, engine_error = True, None
        print(f"[voice-worker] OpenVoice V2 ready on {device}")
    except Exception as exc:
        ready, engine_error = False, str(exc)[:500]
        print(f"[voice-worker] model load failed: {engine_error}")

@app.on_event("startup")
def startup():
    load_models()

@app.get("/v1/health")
def health(x_worker_token: str | None = Header(default=None)):
    require_token(x_worker_token)
    return {
        "ok": True, "ready": ready, "engine": "OpenVoice V2 + MeloTTS",
        "device": device, "error": engine_error if not ready else None,
        "capabilities": {
            "voice_tone_cloning": ready, "speech_generation": ready,
            "delivery_presets": "experimental pacing and punctuation presets",
            "emotion_level_prosody": False
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
    if not ready or converter is None:
        raise HTTPException(status_code=503, detail="OpenVoice engine is not ready.")
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
    if audio.shape[1] > 2:
        audio = audio[:, :2]
    voice_id = "v_" + secrets.token_hex(8)
    folder = voice_dir(voice_id)
    folder.mkdir(parents=True, exist_ok=False)
    sample_path = folder / "reference.wav"
    sf.write(str(sample_path), audio, sr)
    try:
        from openvoice import se_extractor
        target_se, _ = se_extractor.get_se(str(sample_path), converter, vad=True)
        torch.save(target_se.detach().cpu(), str(folder / "embedding.pth"))
        profile = {
            "id": voice_id, "name": body.name.strip() or "Private test voice",
            "notes": body.notes.strip(), "created": int(time.time() * 1000),
            "duration_seconds": round(seconds, 1), "sample_rate": int(sr),
            "engine": "OpenVoice V2"
        }
        (folder / "profile.json").write_text(json.dumps(profile), encoding="utf-8")
    except Exception as exc:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(status_code=422, detail="Could not extract a stable voice embedding. Try a clearer single-speaker recording.") from exc
    return {"voice": {"id": voice_id, "name": profile["name"], "created": profile["created"], "engine": profile["engine"]}}

class SynthesizeRequest(BaseModel):
    voice_id: str
    text: str = Field(min_length=1, max_length=MAX_TEXT)
    style: Literal["conversational", "warm", "excited", "empathetic", "calm"] = "conversational"
    pacing: Literal["natural", "measured", "brisk"] = "natural"

@app.post("/v1/synthesize")
def synthesize(body: SynthesizeRequest, x_worker_token: str | None = Header(default=None)):
    require_token(x_worker_token)
    if not ready or converter is None or tts_model is None or source_se is None:
        raise HTTPException(status_code=503, detail="OpenVoice engine is not ready.")
    folder = voice_dir(body.voice_id)
    embedding_path = folder / "embedding.pth"
    if not embedding_path.exists():
        raise HTTPException(status_code=404, detail="Saved voice not found.")
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required.")
    speed = {"conversational": 1.0, "warm": 0.94, "excited": 1.08, "empathetic": 0.90, "calm": 0.90}[body.style]
    speed *= {"natural": 1.0, "measured": 0.92, "brisk": 1.08}[body.pacing]
    if body.style == "excited" and text[-1] not in "!?":
        text += "!"
    if body.style in ("warm", "empathetic") and len(text) > 80:
        text = text.replace("; ", ". ").replace(" — ", ", ")
    speaker_id = tts_model.hps.data.spk2id.get("EN-US")
    if speaker_id is None:
        speaker_id = next(iter(tts_model.hps.data.spk2id.values()))
    target_se = torch.load(str(embedding_path), map_location=device, weights_only=False)
    with tempfile.TemporaryDirectory(dir=str(TMP)) as tmp:
        source_path, output_path = str(Path(tmp) / "source.wav"), str(Path(tmp) / "cloned.wav")
        with engine_lock:
            tts_model.tts_to_file(text, speaker_id, source_path, speed=max(0.75, min(1.25, speed)))
            converter.convert(audio_src_path=source_path, src_se=source_se, tgt_se=target_se.to(device),
                              output_path=output_path, message="Generated by Reachmark Voice Lab")
        # Return a stable copy: TemporaryDirectory is removed after this handler exits.
        import io
        from fastapi.responses import Response
        with open(output_path, "rb") as audio_file:
            audio_bytes = audio_file.read()
        return Response(content=audio_bytes, media_type="audio/wav", headers={"Content-Disposition": 'inline; filename="reachmark-voice-sample.wav"'})
