"""
Bunker AI v4 — Backend FastAPI
Chat unificado: texto, visao, voz (STT offline + TTS offline/online), app builder, mapa, guias.
DON'T PANIC.
"""

import asyncio
import json
import os
import re
import uuid
import tempfile
import subprocess
import shutil
import sqlite3
import time
import platform
import socket
from datetime import datetime, date
from pathlib import Path

SERVER_START_TIME = time.time()

import httpx
from fastapi import BackgroundTasks, FastAPI, UploadFile, File, Form, Request
from fastapi.responses import (
    StreamingResponse,
    FileResponse,
    HTMLResponse,
    JSONResponse,
    Response,
)
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Bunker AI")


@app.on_event("startup")
async def _detect_backend():
    """Auto-detect LLM backend: Ollama or llama.cpp."""
    global BACKEND, LLAMA_CPP_URL
    import httpx as _hx

    # Try Ollama
    try:
        async with _hx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{OLLAMA_BASE}/api/tags")
            if r.status_code == 200:
                models = r.json().get("models", [])
                BACKEND = "ollama"
                print(f"[LLM] Backend: Ollama ({len(models)} modelos)")
                return
    except Exception:
        pass

    # Try llama.cpp (check env or default port)
    llama_urls = [LLAMA_CPP_URL] if LLAMA_CPP_URL else ["http://localhost:8070", "http://localhost:8080"]
    for url in llama_urls:
        if not url:
            continue
        try:
            async with _hx.AsyncClient(timeout=3) as c:
                r = await c.get(f"{url}/v1/models")
                if r.status_code == 200:
                    BACKEND = "llama.cpp"
                    LLAMA_CPP_URL = url
                    print(f"[LLM] Backend: llama.cpp em {url}")
                    return
        except Exception:
            pass

    print("[LLM] Nenhum backend LLM detectado. Chat estara offline.")


# ─── Simple rate limiter ──────────────────────────────────────────────────────
from collections import defaultdict
_rate_buckets = defaultdict(list)  # { key: [timestamps] }
RATE_LIMITS = {
    "terminal": (10, 60),    # 10 requests per 60 seconds
    "chat": (30, 60),        # 30 requests per 60 seconds
    "build": (10, 60),       # 10 requests per 60 seconds
    "tts": (20, 60),         # 20 requests per 60 seconds
}

def _check_rate_limit(key: str, client_ip: str = "local") -> bool:
    """Returns True if rate limited (should block)."""
    if key not in RATE_LIMITS:
        return False
    max_req, window = RATE_LIMITS[key]
    bucket_key = f"{key}:{client_ip}"
    now = time.time()
    # Prune old entries
    _rate_buckets[bucket_key] = [t for t in _rate_buckets[bucket_key] if t > now - window]
    if len(_rate_buckets[bucket_key]) >= max_req:
        return True
    _rate_buckets[bucket_key].append(now)
    return False


OLLAMA_BASE = os.getenv("OLLAMA_URL", "http://localhost:11434")
# llama.cpp server (portable mode) — set via env or auto-detected
LLAMA_CPP_URL = os.getenv("LLAMA_CPP_URL", "")  # e.g. "http://localhost:8070"
LLAMA_CPP_MODEL = os.getenv("LLAMA_CPP_MODEL", "built-in")  # model name for display
BACKEND = "ollama"  # will be set to "llama.cpp" if detected
OFFLINE_MODE = False  # set via /api/config/offline — blocks edge-tts and online fallbacks
GENERATED_DIR = Path("generated_apps")
GENERATED_DIR.mkdir(exist_ok=True)
TTS_DIR = Path("tts_cache")
TTS_DIR.mkdir(exist_ok=True)
MAPS_DIR = Path("static/maps")
MAPS_DIR.mkdir(parents=True, exist_ok=True)
VOICE_MODELS_DIR = Path("voice_models")
VOICE_MODELS_DIR.mkdir(exist_ok=True)
DATA_DIR = Path("data")
GUIDES_DIR = DATA_DIR / "guides"
PROTOCOLS_DIR = DATA_DIR / "protocols"
BOOKS_DIR = DATA_DIR / "books"
GAMES_DIR = DATA_DIR / "games"
DB_PATH = DATA_DIR / "db" / "bunker.db"

# Ensure data dirs exist
for d in [GUIDES_DIR, PROTOCOLS_DIR, BOOKS_DIR, GAMES_DIR, DATA_DIR / "db", DATA_DIR / "zim", DATA_DIR / "avatar"]:
    d.mkdir(parents=True, exist_ok=True)

# ─── Lazy-loaded voice engines ────────────────────────────────────────────────
_whisper_model = None
_piper_available = None
_pyttsx3_available = None
_kokoro_instance = None
_kokoro_available = None

# ─── Piper model catalog ──────────────────────────────────────────────────────
PIPER_HF_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"
PIPER_MODELS = {
    "pt_BR-faber-medium": {
        "lang": "pt", "lang_code": "pt_BR", "speaker": "faber", "quality": "medium",
        "desc": "Português BR — Masculino (recomendado)", "size_mb": 63,
    },
    "pt_BR-edresson-low": {
        "lang": "pt", "lang_code": "pt_BR", "speaker": "edresson", "quality": "low",
        "desc": "Português BR — Masculino (rápido)", "size_mb": 28,
    },
    "en_US-lessac-medium": {
        "lang": "en", "lang_code": "en_US", "speaker": "lessac", "quality": "medium",
        "desc": "English US — Male", "size_mb": 63,
    },
    "en_US-amy-medium": {
        "lang": "en", "lang_code": "en_US", "speaker": "amy", "quality": "medium",
        "desc": "English US — Female", "size_mb": 63,
    },
    "es_ES-mls_9972-low": {
        "lang": "es", "lang_code": "es_ES", "speaker": "mls_9972", "quality": "low",
        "desc": "Español — Male", "size_mb": 28,
    },
}


def get_whisper_model():
    """Lazy-load faster-whisper model"""
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            model_size = os.getenv("WHISPER_MODEL", "base")
            device = "cuda" if _check_cuda() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            print(f"[STT] Loading faster-whisper ({model_size}) on {device}...")
            _whisper_model = WhisperModel(model_size, device=device, compute_type=compute_type)
            print(f"[STT] faster-whisper ready on {device}")
        except ImportError:
            print("[STT] faster-whisper not installed — pip install faster-whisper")
            _whisper_model = False
        except Exception as e:
            print(f"[STT] faster-whisper error: {e}")
            _whisper_model = False
    return _whisper_model if _whisper_model is not False else None


def _check_cuda():
    """Check if CUDA is available"""
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


def check_piper():
    """Check if piper CLI binary is available AND local .onnx models exist"""
    global _piper_available
    if _piper_available is None:
        has_binary = shutil.which("piper") is not None
        has_models = any(VOICE_MODELS_DIR.glob("*.onnx")) if VOICE_MODELS_DIR.exists() else False
        if not has_binary:
            try:
                import piper
                has_binary = True
            except ImportError:
                pass
        _piper_available = has_binary and has_models
        if _piper_available:
            print(f"[TTS] Piper TTS available (offline) — {list(VOICE_MODELS_DIR.glob('*.onnx'))[:3]}")
        elif has_binary and not has_models:
            print("[TTS] Piper binary found but no .onnx models — download via /api/tts/download-piper-model")
        else:
            print("[TTS] Piper not found — will use pyttsx3 or edge-tts")
    return _piper_available


def check_pyttsx3():
    """Check if pyttsx3 with system voices is available"""
    global _pyttsx3_available
    if _pyttsx3_available is None:
        try:
            import pyttsx3
            engine = pyttsx3.init()
            voices = engine.getProperty("voices")
            engine.stop()
            _pyttsx3_available = bool(voices)
            if _pyttsx3_available:
                print(f"[TTS] pyttsx3 available — {len(voices)} system voice(s)")
        except Exception as e:
            print(f"[TTS] pyttsx3 not available: {e}")
            _pyttsx3_available = False
    return _pyttsx3_available


async def _tts_pyttsx3(text: str, filepath: Path, voice_id: str = None) -> Path | None:
    """Generate audio with pyttsx3 (OS TTS engine — Windows SAPI5/macOS/Linux)"""
    import concurrent.futures
    try:
        import pyttsx3
        wav_path = filepath.with_suffix(".wav")

        def _synth():
            engine = pyttsx3.init()
            voices = engine.getProperty("voices")
            if voice_id:
                for v in voices:
                    if voice_id in str(v.id) or voice_id.lower() in v.name.lower():
                        engine.setProperty("voice", v.id)
                        break
            else:
                # Prefer Portuguese if available
                pt = next((v for v in voices if any(
                    x in v.name.lower() for x in ["portuguese", "brasil", "brazil", "zira", "heloisa", "pt"]
                )), None)
                if pt:
                    engine.setProperty("voice", pt.id)
            engine.setProperty("rate", 175)
            engine.setProperty("volume", 0.9)
            engine.save_to_file(text, str(wav_path))
            engine.runAndWait()
            engine.stop()
            return wav_path.exists() and wav_path.stat().st_size > 100

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            ok = await loop.run_in_executor(pool, _synth)

        if ok and wav_path.exists():
            if shutil.which("ffmpeg"):
                proc = await asyncio.create_subprocess_exec(
                    "ffmpeg", "-y", "-i", str(wav_path), "-q:a", "4", str(filepath),
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                )
                await proc.wait()
                wav_path.unlink(missing_ok=True)
                return filepath if filepath.exists() else None
            else:
                return wav_path  # serve WAV directly
    except Exception as e:
        print(f"[TTS] pyttsx3 error: {e}")
    return None


# ─── Kokoro TTS (best offline quality) ───────────────────────────────────────
KOKORO_MODELS_DIR = Path("kokoro_models")
KOKORO_MODELS_DIR.mkdir(exist_ok=True)

# Kokoro voice map: edge-tts voice name → kokoro voice + lang
KOKORO_VOICE_MAP = {
    "pt-BR-AntonioNeural": ("pm_alex", "pt-br"),
    "pt-BR-FranciscaNeural": ("pf_dora", "pt-br"),
    "en-US-GuyNeural": ("am_adam", "en-us"),
    "en-US-JennyNeural": ("af_heart", "en-us"),
    "es-ES-AlvaroNeural": ("em_alex", "es"),
}

KOKORO_VOICES = {
    "pt-br": [
        {"id": "pm_alex", "name": "Alex (Masculino)", "lang": "pt-br"},
        {"id": "pm_santa", "name": "Santa (Masculino)", "lang": "pt-br"},
        {"id": "pf_dora", "name": "Dora (Feminino)", "lang": "pt-br"},
    ],
    "en-us": [
        {"id": "af_heart", "name": "Heart (Female)", "lang": "en-us"},
        {"id": "af_sarah", "name": "Sarah (Female)", "lang": "en-us"},
        {"id": "af_nova", "name": "Nova (Female)", "lang": "en-us"},
        {"id": "am_adam", "name": "Adam (Male)", "lang": "en-us"},
        {"id": "am_michael", "name": "Michael (Male)", "lang": "en-us"},
    ],
    "es": [
        {"id": "ef_dora", "name": "Dora (Femenino)", "lang": "es"},
        {"id": "em_alex", "name": "Alex (Masculino)", "lang": "es"},
    ],
}


def check_kokoro():
    """Check if kokoro-onnx is installed and model files exist"""
    global _kokoro_available
    if _kokoro_available is None:
        try:
            import kokoro_onnx  # noqa: F401
            # Check for model files
            onnx_path = KOKORO_MODELS_DIR / "kokoro-v1.0.onnx"
            voices_path = KOKORO_MODELS_DIR / "voices-v1.0.bin"
            if onnx_path.exists() and voices_path.exists():
                _kokoro_available = True
                print(f"[TTS] Kokoro TTS available (offline, 82M params)")
            else:
                _kokoro_available = False
                print("[TTS] kokoro-onnx installed but models not found — download via /api/tts/kokoro/download")
        except ImportError:
            _kokoro_available = False
            print("[TTS] kokoro-onnx not installed — pip install kokoro-onnx soundfile")
    return _kokoro_available


def _get_kokoro():
    """Lazy-load Kokoro instance (singleton)"""
    global _kokoro_instance
    if _kokoro_instance is None and check_kokoro():
        try:
            from kokoro_onnx import Kokoro
            onnx_path = KOKORO_MODELS_DIR / "kokoro-v1.0.onnx"
            voices_path = KOKORO_MODELS_DIR / "voices-v1.0.bin"
            _kokoro_instance = Kokoro(str(onnx_path), str(voices_path))
            print("[TTS] Kokoro model loaded")
        except Exception as e:
            print(f"[TTS] Kokoro load error: {e}")
            _kokoro_instance = False
    return _kokoro_instance if _kokoro_instance is not False else None


async def _tts_kokoro(text: str, filepath: Path, voice: str) -> Path | None:
    """Generate audio with Kokoro TTS (best offline quality, 82M model)"""
    import concurrent.futures

    kokoro = _get_kokoro()
    if not kokoro:
        return None

    # Map edge-tts voice to kokoro voice+lang, or use direct kokoro voice
    if voice.startswith("kokoro:"):
        voice_id = voice.split(":", 1)[1]
        # Detect lang from voice prefix
        lang = {"p": "pt-br", "a": "en-us", "b": "en-gb", "e": "es", "f": "fr"}.get(voice_id[0], "en-us")
    else:
        voice_id, lang = KOKORO_VOICE_MAP.get(voice, ("pm_alex", "pt-br"))

    wav_path = filepath.with_suffix(".wav")

    def _synth():
        samples, sr = kokoro.create(text, voice=voice_id, speed=1.0, lang=lang)
        import soundfile as sf
        sf.write(str(wav_path), samples, sr)
        return wav_path

    try:
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            result = await loop.run_in_executor(pool, _synth)

        if result and result.exists():
            # Convert to mp3 if ffmpeg available
            if shutil.which("ffmpeg"):
                mp3_proc = await asyncio.create_subprocess_exec(
                    "ffmpeg", "-y", "-i", str(wav_path), "-q:a", "4", str(filepath),
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                )
                await mp3_proc.wait()
                wav_path.unlink(missing_ok=True)
                return filepath if filepath.exists() else None
            else:
                return wav_path
    except Exception as e:
        print(f"[TTS] Kokoro error: {e}")
    return None


# ─── Shared streaming helper ─────────────────────────────────────────────────

def _chat_stream(payload: dict, timeout: float = 300.0) -> StreamingResponse:
    """Stream chat tokens as SSE — supports Ollama and llama.cpp backends."""
    if BACKEND == "llama.cpp" and LLAMA_CPP_URL:
        return _chat_stream_llamacpp(payload, timeout)
    return _chat_stream_ollama(payload, timeout)


def _chat_stream_ollama(payload: dict, timeout: float) -> StreamingResponse:
    """Stream from Ollama /api/chat."""
    async def generate():
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as c:
            async with c.stream("POST", f"{OLLAMA_BASE}/api/chat", json=payload) as resp:
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        token = chunk.get("message", {}).get("content", "")
                        if token:
                            yield f"data: {json.dumps({'token': token})}\n\n"
                        if chunk.get("done"):
                            yield f"data: {json.dumps({'done': True})}\n\n"
                    except json.JSONDecodeError:
                        pass
    return StreamingResponse(generate(), media_type="text/event-stream")


def _chat_stream_llamacpp(payload: dict, timeout: float) -> StreamingResponse:
    """Stream from llama.cpp server (OpenAI-compatible /v1/chat/completions)."""
    # Convert Ollama payload → OpenAI format
    messages = payload.get("messages", [])
    # llama.cpp doesn't support images in the same way, strip them for text-only
    oai_messages = []
    for m in messages:
        msg = {"role": m.get("role", "user"), "content": m.get("content", "")}
        oai_messages.append(msg)

    oai_payload = {
        "messages": oai_messages,
        "stream": True,
        "temperature": payload.get("options", {}).get("temperature", 0.7),
        "max_tokens": payload.get("options", {}).get("num_predict", 2048),
    }

    async def generate():
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as c:
                async with c.stream(
                    "POST", f"{LLAMA_CPP_URL}/v1/chat/completions",
                    json=oai_payload,
                    headers={"Content-Type": "application/json"},
                ) as resp:
                    async for line in resp.aiter_lines():
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue
                        data = line[6:]
                        if data == "[DONE]":
                            yield f"data: {json.dumps({'done': True})}\n\n"
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            token = delta.get("content", "")
                            if token:
                                yield f"data: {json.dumps({'token': token})}\n\n"
                        except (json.JSONDecodeError, IndexError, KeyError):
                            pass
        except httpx.ConnectError:
            yield f"data: {json.dumps({'token': '[Erro: servidor LLM nao conectado]'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")


# ─── Config ──────────────────────────────────────────────────────────────────

@app.post("/api/config/offline")
async def set_offline_mode(request: Request):
    """Toggle offline mode — blocks edge-tts and online fallbacks."""
    global OFFLINE_MODE
    body = await request.json()
    OFFLINE_MODE = bool(body.get("offline", False))
    print(f"[CONFIG] Offline mode: {'ON' if OFFLINE_MODE else 'OFF'}")
    return {"offline": OFFLINE_MODE}


@app.get("/api/config/offline")
async def get_offline_mode():
    return {"offline": OFFLINE_MODE}


# ─── Health / Models ─────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    global BACKEND

    # Voice capabilities (backend-independent)
    whisper_ok = get_whisper_model() is not None
    kokoro_ok = check_kokoro()
    piper_ok = check_piper()
    pyttsx3_ok = check_pyttsx3()
    if kokoro_ok:
        tts_engine = "kokoro"
    elif piper_ok:
        tts_engine = "piper"
    elif pyttsx3_ok:
        tts_engine = "pyttsx3"
    else:
        tts_engine = "edge-tts"

    piper_models_status = {}
    for model_id, info in PIPER_MODELS.items():
        onnx = VOICE_MODELS_DIR / f"{model_id}.onnx"
        piper_models_status[model_id] = {
            **info,
            "downloaded": onnx.exists() and onnx.stat().st_size > 1000,
        }

    # Try Ollama first
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{OLLAMA_BASE}/api/tags")
            models = r.json().get("models", [])
            names = [m["name"] for m in models]
            vision = [n for n in names if any(v in n.lower() for v in [
                "llava", "bakllava", "gemma3", "moondream", "minicpm",
                "llama3.2-vision", "granite3", "granite-vision"
            ])]
            BACKEND = "ollama"
            return {
                "status": "online",
                "backend": "ollama",
                "ollama": OLLAMA_BASE,
                "models": names,
                "vision_models": vision,
                "stt": "whisper" if whisper_ok else "browser",
                "tts": tts_engine,
                "stt_ready": whisper_ok,
                "tts_offline": kokoro_ok or piper_ok or pyttsx3_ok,
                "kokoro_available": kokoro_ok,
                "piper_available": piper_ok,
                "pyttsx3_available": pyttsx3_ok,
                "piper_models": piper_models_status,
                "offline_mode": OFFLINE_MODE,
            }
    except Exception:
        pass

    # Fallback: try llama.cpp server
    if LLAMA_CPP_URL:
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.get(f"{LLAMA_CPP_URL}/v1/models")
                data = r.json()
                models = data.get("data", [])
                names = [m.get("id", LLAMA_CPP_MODEL) for m in models] if models else [LLAMA_CPP_MODEL]
                BACKEND = "llama.cpp"
                return {
                    "status": "online",
                    "backend": "llama.cpp",
                    "ollama": LLAMA_CPP_URL,
                    "models": names,
                    "vision_models": [],
                    "stt": "whisper" if whisper_ok else "browser",
                    "tts": tts_engine,
                    "stt_ready": whisper_ok,
                    "tts_offline": piper_ok or pyttsx3_ok,
                    "piper_available": piper_ok,
                    "pyttsx3_available": pyttsx3_ok,
                    "piper_models": piper_models_status,
                    "portable": True,
                }
        except Exception:
            pass

    # Both offline
    return {
        "status": "offline",
        "backend": "none",
        "models": [],
        "vision_models": [],
        "stt": "browser",
        "tts": tts_engine,
        "stt_ready": False,
        "tts_offline": kokoro_ok or piper_ok or pyttsx3_ok,
        "kokoro_available": kokoro_ok,
        "piper_available": piper_ok,
        "pyttsx3_available": pyttsx3_ok,
        "piper_models": piper_models_status,
        "offline_mode": OFFLINE_MODE,
    }


# ─── STT (Speech-to-Text) — Whisper offline ─────────────────────────────────

@app.post("/api/stt")
async def speech_to_text(audio: UploadFile = File(...), language: str = Form("pt")):
    """Transcribe audio using faster-whisper (offline) or return error"""
    model = get_whisper_model()
    if model is None:
        return JSONResponse(
            {"error": "STT offline nao disponivel. Instale: pip install faster-whisper", "use_browser": True},
            status_code=503,
        )

    # Save uploaded audio to temp file
    suffix = Path(audio.filename).suffix if audio.filename else ".webm"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        content = await audio.read()
        tmp.write(content)
        tmp.close()

        # Transcribe
        segments, info = model.transcribe(
            tmp.name,
            language=language if language != "auto" else None,
            beam_size=5,
            vad_filter=True,
        )

        text = " ".join(segment.text.strip() for segment in segments)
        return {
            "text": text,
            "language": info.language,
            "language_probability": round(info.language_probability, 2),
            "engine": "whisper",
        }
    except Exception as e:
        return JSONResponse({"error": str(e), "use_browser": True}, status_code=500)
    finally:
        os.unlink(tmp.name)


# ─── TTS (Text-to-Speech) — Kokoro > Piper > pyttsx3 > edge-tts ─────────────

@app.post("/api/tts")
async def tts(request: Request, background_tasks: BackgroundTasks):
    body = await request.json()
    text = body.get("text", "")
    voice = body.get("voice", "pt-BR-AntonioNeural")
    engine = body.get("engine", "auto")  # "auto", "kokoro", "piper", "pyttsx3", "edge-tts"
    voice_id = body.get("voice_id", None)   # pyttsx3 system voice ID
    kokoro_voice = body.get("kokoro_voice", None)  # direct kokoro voice ID
    if not text:
        return JSONResponse({"error": "No text"}, status_code=400)

    filename = f"{uuid.uuid4().hex}.mp3"
    filepath = TTS_DIR / filename

    # 1. Try Kokoro (best offline quality — 82M model, near-human)
    if engine in ("auto", "kokoro") and check_kokoro():
        try:
            # If kokoro_voice specified, override the mapping
            effective_voice = voice
            if kokoro_voice:
                # Create a fake mapping entry to pass through
                effective_voice = f"kokoro:{kokoro_voice}"
            result = await _tts_kokoro(text, filepath, effective_voice)
            if result:
                mt = "audio/mpeg" if result.suffix == ".mp3" else "audio/wav"
                background_tasks.add_task(os.unlink, str(result))
                return FileResponse(str(result), media_type=mt, filename=result.name)
        except Exception as e:
            print(f"[TTS] Kokoro error: {e}, trying Piper")

    # 2. Try Piper (good offline quality)
    if engine in ("auto", "piper") and check_piper():
        try:
            result = await _tts_piper(text, filepath, voice)
            if result:
                mt = "audio/mpeg" if result.suffix == ".mp3" else "audio/wav"
                background_tasks.add_task(os.unlink, str(result))
                return FileResponse(str(result), media_type=mt, filename=result.name)
        except Exception as e:
            print(f"[TTS] Piper error: {e}, trying pyttsx3")

    # 3. Try pyttsx3 (system TTS — offline, no model download needed)
    if engine in ("auto", "pyttsx3") and check_pyttsx3():
        try:
            result = await _tts_pyttsx3(text, filepath, voice_id)
            if result:
                mt = "audio/mpeg" if result.suffix == ".mp3" else "audio/wav"
                background_tasks.add_task(os.unlink, str(result))
                return FileResponse(str(result), media_type=mt, filename=result.name)
        except Exception as e:
            print(f"[TTS] pyttsx3 error: {e}, falling back to edge-tts")

    # 4. Fallback: edge-tts (requires internet — blocked in offline mode)
    if OFFLINE_MODE:
        return JSONResponse({"error": "Modo offline ativo. Instale Kokoro TTS para voz offline.", "offline": True}, status_code=503)
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(str(filepath))
        background_tasks.add_task(os.unlink, str(filepath))
        return FileResponse(str(filepath), media_type="audio/mpeg", filename=filename)
    except Exception as e:
        return JSONResponse({"error": str(e), "hint": "edge-tts precisa de internet"}, status_code=500)


async def _tts_piper(text: str, filepath: Path, voice: str) -> Path | None:
    """Generate audio with Piper TTS (offline) using local .onnx model"""
    # Map edge-tts voice names to piper model IDs
    piper_voice_map = {
        "pt-BR-AntonioNeural": "pt_BR-faber-medium",
        "pt-BR-FranciscaNeural": "pt_BR-faber-medium",
        "en-US-GuyNeural": "en_US-lessac-medium",
        "en-US-JennyNeural": "en_US-amy-medium",
    }
    piper_model_id = piper_voice_map.get(voice, "pt_BR-faber-medium")

    # Find a downloaded model — prefer the mapped one, then any available
    model_path = VOICE_MODELS_DIR / f"{piper_model_id}.onnx"
    if not model_path.exists():
        onnx_files = list(VOICE_MODELS_DIR.glob("*.onnx"))
        if not onnx_files:
            return None
        model_path = onnx_files[0]

    wav_path = filepath.with_suffix(".wav")

    if shutil.which("piper"):
        proc = await asyncio.create_subprocess_exec(
            "piper",
            "--model", str(model_path),
            "--output_file", str(wav_path),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate(input=text.encode("utf-8"))
        if proc.returncode == 0 and wav_path.exists():
            if shutil.which("ffmpeg"):
                mp3_proc = await asyncio.create_subprocess_exec(
                    "ffmpeg", "-y", "-i", str(wav_path), "-q:a", "4", str(filepath),
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                )
                await mp3_proc.wait()
                wav_path.unlink(missing_ok=True)
                return filepath if filepath.exists() else None
            else:
                return wav_path

    try:
        import piper as piper_module
        voice_obj = piper_module.PiperVoice.load(str(model_path))
        with open(str(wav_path), "wb") as f:
            voice_obj.synthesize(text, f)
        return wav_path
    except Exception:
        pass

    return None


# ─── TTS: Piper model management ─────────────────────────────────────────────

@app.get("/api/tts/piper-models")
async def list_piper_models():
    """List available Piper models with download status"""
    result = {}
    for model_id, info in PIPER_MODELS.items():
        onnx = VOICE_MODELS_DIR / f"{model_id}.onnx"
        downloaded = onnx.exists() and onnx.stat().st_size > 1000
        result[model_id] = {**info, "downloaded": downloaded}
    return {"models": result, "models_dir": str(VOICE_MODELS_DIR.resolve())}


@app.post("/api/tts/download-piper-model")
async def download_piper_model(request: Request):
    """Stream download progress of a Piper .onnx voice model via SSE"""
    body = await request.json()
    model_id = body.get("model_id", "")

    if model_id not in PIPER_MODELS:
        return JSONResponse({"error": f"Unknown model: {model_id}"}, status_code=400)

    info = PIPER_MODELS[model_id]
    lang = info["lang"]
    lang_code = info["lang_code"]
    speaker = info["speaker"]
    quality = info["quality"]

    onnx_filename = f"{model_id}.onnx"
    json_filename = f"{model_id}.onnx.json"
    onnx_url = f"{PIPER_HF_BASE}/{lang}/{lang_code}/{speaker}/{quality}/{lang_code}-{speaker}-{quality}.onnx"
    json_url = f"{PIPER_HF_BASE}/{lang}/{lang_code}/{speaker}/{quality}/{lang_code}-{speaker}-{quality}.onnx.json"

    onnx_dest = VOICE_MODELS_DIR / onnx_filename
    json_dest = VOICE_MODELS_DIR / json_filename

    async def generate():
        global _piper_available
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(600.0), follow_redirects=True) as client:
                # Download JSON config first (small)
                yield f"data: {json.dumps({'status': 'downloading', 'file': json_filename, 'progress': 0})}\n\n"
                r = await client.get(json_url)
                if r.status_code == 200:
                    json_dest.write_bytes(r.content)
                    yield f"data: {json.dumps({'status': 'downloading', 'file': json_filename, 'progress': 100})}\n\n"

                # Stream ONNX model (large)
                total_bytes = info["size_mb"] * 1024 * 1024
                downloaded_bytes = 0
                yield f"data: {json.dumps({'status': 'downloading', 'file': onnx_filename, 'progress': 0, 'total_mb': info['size_mb']})}\n\n"

                async with client.stream("GET", onnx_url) as resp:
                    if resp.status_code != 200:
                        yield f"data: {json.dumps({'status': 'error', 'error': f'HTTP {resp.status_code}'})}\n\n"
                        return

                    content_length = int(resp.headers.get("content-length", total_bytes))
                    with open(onnx_dest, "wb") as f:
                        last_pct = -1
                        async for chunk in resp.aiter_bytes(chunk_size=65536):
                            f.write(chunk)
                            downloaded_bytes += len(chunk)
                            pct = min(99, int(downloaded_bytes / content_length * 100))
                            if pct != last_pct:
                                last_pct = pct
                                mb = downloaded_bytes / (1024 * 1024)
                                yield f"data: {json.dumps({'status': 'downloading', 'file': onnx_filename, 'progress': pct, 'mb': round(mb, 1)})}\n\n"

                # Verify and finish
                if onnx_dest.exists() and onnx_dest.stat().st_size > 1000:
                    _piper_available = None  # reset so check_piper() re-evaluates
                    yield f"data: {json.dumps({'status': 'done', 'model_id': model_id, 'file': onnx_filename})}\n\n"
                else:
                    yield f"data: {json.dumps({'status': 'error', 'error': 'Download incomplete'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/api/tts/pyttsx3/voices")
async def list_pyttsx3_voices():
    """List available system TTS voices (pyttsx3)"""
    if not check_pyttsx3():
        return JSONResponse({"error": "pyttsx3 not available"}, status_code=503)
    try:
        import pyttsx3
        import concurrent.futures

        def _get_voices():
            engine = pyttsx3.init()
            voices = engine.getProperty("voices")
            result = [{"id": v.id, "name": v.name, "languages": v.languages} for v in voices]
            engine.stop()
            return result

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            voices = await loop.run_in_executor(pool, _get_voices)
        return {"voices": voices}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ─── TTS: Kokoro model management ────────────────────────────────────────────

KOKORO_ONNX_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
KOKORO_VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"


@app.get("/api/tts/kokoro/status")
async def kokoro_status():
    """Check Kokoro TTS status: installed, model downloaded, available voices"""
    has_pkg = False
    try:
        import kokoro_onnx  # noqa: F401
        has_pkg = True
    except ImportError:
        pass

    onnx_path = KOKORO_MODELS_DIR / "kokoro-v1.0.onnx"
    voices_path = KOKORO_MODELS_DIR / "voices-v1.0.bin"
    has_models = onnx_path.exists() and voices_path.exists()

    return {
        "installed": has_pkg,
        "models_downloaded": has_models,
        "available": has_pkg and has_models,
        "model_size_mb": 300,
        "voices": KOKORO_VOICES,
        "models_dir": str(KOKORO_MODELS_DIR.resolve()),
    }


@app.post("/api/tts/kokoro/download")
async def download_kokoro_model():
    """Stream download progress of Kokoro TTS models via SSE"""
    onnx_dest = KOKORO_MODELS_DIR / "kokoro-v1.0.onnx"
    voices_dest = KOKORO_MODELS_DIR / "voices-v1.0.bin"

    async def generate():
        global _kokoro_available, _kokoro_instance
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(600.0), follow_redirects=True) as client:
                # Download voices.bin first (small, ~2MB)
                yield f"data: {json.dumps({'status': 'downloading', 'file': 'voices-v1.0.bin', 'progress': 0})}\n\n"
                r = await client.get(KOKORO_VOICES_URL)
                if r.status_code == 200:
                    voices_dest.write_bytes(r.content)
                    yield f"data: {json.dumps({'status': 'downloading', 'file': 'voices-v1.0.bin', 'progress': 100})}\n\n"
                else:
                    yield f"data: {json.dumps({'status': 'error', 'error': f'HTTP {r.status_code} downloading voices'})}\n\n"
                    return

                # Stream ONNX model (large, ~300MB)
                yield f"data: {json.dumps({'status': 'downloading', 'file': 'kokoro-v1.0.onnx', 'progress': 0, 'total_mb': 300})}\n\n"

                async with client.stream("GET", KOKORO_ONNX_URL) as resp:
                    if resp.status_code != 200:
                        yield f"data: {json.dumps({'status': 'error', 'error': f'HTTP {resp.status_code}'})}\n\n"
                        return

                    content_length = int(resp.headers.get("content-length", 300 * 1024 * 1024))
                    downloaded = 0
                    last_pct = -1
                    with open(onnx_dest, "wb") as f:
                        async for chunk in resp.aiter_bytes(chunk_size=65536):
                            f.write(chunk)
                            downloaded += len(chunk)
                            pct = min(99, int(downloaded / content_length * 100))
                            if pct != last_pct:
                                last_pct = pct
                                mb = downloaded / (1024 * 1024)
                                yield f"data: {json.dumps({'status': 'downloading', 'file': 'kokoro-v1.0.onnx', 'progress': pct, 'mb': round(mb, 1)})}\n\n"

                if onnx_dest.exists() and onnx_dest.stat().st_size > 1000:
                    _kokoro_available = None  # reset check
                    _kokoro_instance = None   # reset singleton
                    yield f"data: {json.dumps({'status': 'done', 'message': 'Kokoro TTS pronto!'})}\n\n"
                else:
                    yield f"data: {json.dumps({'status': 'error', 'error': 'Download incomplete'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/api/tts/kokoro/voices")
async def list_kokoro_voices():
    """List all Kokoro voices grouped by language"""
    return {"voices": KOKORO_VOICES, "available": check_kokoro()}


# ─── Chat (streaming) — texto puro ──────────────────────────────────────────

@app.post("/api/chat")
async def chat(request: Request):
    if _check_rate_limit("chat", request.client.host if request.client else "local"):
        return JSONResponse({"error": "Limite de taxa excedido. Aguarde."}, status_code=429)
    body = await request.json()
    model = body.get("model", "dolphin3")
    messages = body.get("messages", [])
    system = body.get("system", "")

    msgs = list(messages)
    if system:
        msgs = [{"role": "system", "content": system}] + msgs

    return _chat_stream({"model": model, "messages": msgs, "stream": True})


# ─── Vision (base64) — webcam ou upload ──────────────────────────────────────

@app.post("/api/vision")
async def vision(request: Request):
    body = await request.json()
    img_b64 = body.get("image", "")
    prompt = body.get("prompt", "Descreva o que voce ve nesta imagem.")
    model = body.get("model", "llava-llama3:8b")  # needs multimodal model for vision
    messages = body.get("messages", [])

    if "," in img_b64:
        img_b64 = img_b64.split(",", 1)[1]

    msgs = list(messages)
    msgs.append({"role": "user", "content": prompt, "images": [img_b64]})

    return _chat_stream({"model": model, "messages": msgs, "stream": True})


@app.post("/api/vision/upload")
async def vision_upload(
    image: UploadFile = File(...),
    prompt: str = Form("Descreva esta imagem em detalhes."),
    model: str = Form("llava-llama3:8b"),
):
    import base64
    img_bytes = await image.read()
    img_b64 = base64.b64encode(img_bytes).decode()

    return _chat_stream({
        "model": model,
        "messages": [{"role": "user", "content": prompt, "images": [img_b64]}],
        "stream": True,
    })


# ─── App Builder ─────────────────────────────────────────────────────────────

@app.post("/api/build")
async def build_app(request: Request):
    body = await request.json()
    prompt = body.get("prompt", "")
    model = body.get("model", "qwen2.5-coder:14b")

    system_prompt = """Voce e um engenheiro frontend expert. Quando o usuario descrever um app ou site,
gere um arquivo HTML COMPLETO e funcional com CSS e JavaScript inline.

REGRAS OBRIGATORIAS:
- Retorne APENAS o codigo HTML completo, comecando com <!DOCTYPE html> e terminando com </html>
- NAO inclua explicacoes, markdown, ou blocos de codigo. Apenas HTML puro.
- Use CSS moderno (flexbox, grid, variaveis CSS)
- Use JavaScript vanilla (sem frameworks)
- Design responsivo e bonito por padrao
- Tema escuro moderno como padrao
- Use icones SVG inline quando necessario
- O app deve ser 100% funcional e interativo
- Use cores vibrantes e gradientes para um visual moderno
- Fontes: use Google Fonts via CDN (Inter, Space Grotesk, JetBrains Mono)
- NUNCA use placeholder — sempre gere conteudo real e funcional"""

    return _chat_stream({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Crie o seguinte app/site: {prompt}"},
        ],
        "stream": True,
    }, timeout=600.0)


@app.post("/api/build/save")
async def save_app(request: Request):
    body = await request.json()
    html = body.get("html", "")
    raw_name = body.get("name", f"app-{uuid.uuid4().hex[:8]}")
    # Sanitize: only alphanumeric, hyphens, underscores; max 64 chars
    safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", raw_name)[:64] or f"app-{uuid.uuid4().hex[:8]}"
    app_dir = GENERATED_DIR / safe_name
    app_dir.mkdir(parents=True, exist_ok=True)
    (app_dir / "index.html").write_text(html, encoding="utf-8")
    return {"saved": True, "path": str(app_dir), "name": safe_name}


@app.get("/api/build/list")
async def list_apps():
    apps = []
    if GENERATED_DIR.exists():
        for d in sorted(GENERATED_DIR.iterdir()):
            if d.is_dir() and (d / "index.html").exists():
                apps.append({"name": d.name, "path": str(d), "size": (d / "index.html").stat().st_size})
    return {"apps": apps}


@app.delete("/api/build/{name}")
async def delete_app(name: str):
    safe_name = Path(name).name
    if not safe_name or safe_name != name:
        return JSONResponse({"error": "Invalid name"}, status_code=400)
    app_dir = GENERATED_DIR / safe_name
    if app_dir.exists() and app_dir.is_dir():
        shutil.rmtree(app_dir)
        return {"deleted": True, "name": safe_name}
    return JSONResponse({"error": "App not found"}, status_code=404)


@app.get("/api/build/preview/{name}")
async def preview_app(name: str):
    # Prevent path traversal: strip to bare filename
    safe_name = Path(name).name
    if not safe_name or safe_name != name:
        return JSONResponse({"error": "Invalid name"}, status_code=400)
    filepath = GENERATED_DIR / safe_name / "index.html"
    if filepath.exists() and filepath.is_file():
        return HTMLResponse(filepath.read_text(encoding="utf-8"))
    return JSONResponse({"error": "App not found"}, status_code=404)


# ─── Offline Maps (PMTiles with Range Requests) ─────────────────────────────

@app.get("/api/maps")
async def list_maps():
    """List .pmtiles files available in static/maps/"""
    maps = []
    if MAPS_DIR.exists():
        for f in sorted(MAPS_DIR.iterdir()):
            if f.suffix == ".pmtiles":
                size_mb = f.stat().st_size / (1024 * 1024)
                maps.append({"name": f.stem, "file": f.name, "size_mb": round(size_mb, 1)})
    return {"maps": maps, "dir": str(MAPS_DIR.resolve())}


@app.head("/maps/{filename}")
@app.get("/maps/{filename}")
async def serve_pmtiles(filename: str, request: Request):
    """Serve .pmtiles files with Range Request support (required by PMTiles spec)"""
    # Prevent path traversal: only bare filename with .pmtiles extension allowed
    safe_name = Path(filename).name
    if not safe_name or safe_name != filename or not safe_name.endswith(".pmtiles"):
        return JSONResponse({"error": "Map not found"}, status_code=404)
    filepath = MAPS_DIR / safe_name
    if not filepath.exists():
        return JSONResponse({"error": "Map not found"}, status_code=404)

    file_size = filepath.stat().st_size
    range_header = request.headers.get("range")

    if range_header:
        range_str = range_header.replace("bytes=", "")
        parts = range_str.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        with open(filepath, "rb") as f:
            f.seek(start)
            data = f.read(length)

        return Response(
            content=data,
            status_code=206,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Content-Length": str(length),
                "Content-Type": "application/octet-stream",
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "Content-Range, Content-Length",
            },
        )
    else:
        return Response(
            content=b"",
            status_code=200,
            headers={
                "Content-Length": str(file_size),
                "Content-Type": "application/octet-stream",
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
            },
        )


# ─── Pull model ──────────────────────────────────────────────────────────────

@app.post("/api/models/pull")
async def pull_model(request: Request):
    body = await request.json()
    model = body.get("model", "")

    async def generate():
        async with httpx.AsyncClient(timeout=httpx.Timeout(3600.0)) as c:
            async with c.stream("POST", f"{OLLAMA_BASE}/api/pull", json={"name": model, "stream": True}) as resp:
                async for line in resp.aiter_lines():
                    if line.strip():
                        yield f"data: {line}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/api/models/recommended")
async def recommended_models():
    """Return recommended models based on detected hardware."""
    # Check GPU
    has_gpu = False
    gpu_vram = 0
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            has_gpu = True
            gpu_vram = int(result.stdout.strip().split("\n")[0]) // 1024  # GB
    except Exception:
        pass

    # Prioritize uncensored models — no safety filters in survival scenarios
    models = [
        {"name": "dolphin3", "desc": "Chat sem censura (principal)", "size": "~5 GB",
         "requires": "GPU 6GB+", "priority": 1, "available": gpu_vram >= 6,
         "uncensored": True, "tags": ["chat", "default"]},
        {"name": "dolphin-llama3.1:8b", "desc": "Chat uncensored (avancado)", "size": "~5 GB",
         "requires": "GPU 6GB+", "priority": 2, "available": gpu_vram >= 6,
         "uncensored": True, "tags": ["chat"]},
        {"name": "llava-llama3:8b", "desc": "Visao + Chat (multimodal)", "size": "~5 GB",
         "requires": "GPU 6GB+", "priority": 3, "available": gpu_vram >= 6,
         "uncensored": False, "tags": ["vision", "multimodal"]},
        {"name": "gemma3:4b", "desc": "Visao compacto (multimodal)", "size": "~3 GB",
         "requires": "GPU 4GB+", "priority": 4, "available": gpu_vram >= 4,
         "uncensored": False, "tags": ["vision", "multimodal", "compact"]},
        {"name": "qwen2.5-coder:7b", "desc": "App Builder + codigo", "size": "~5 GB",
         "requires": "GPU 6GB+", "priority": 5, "available": gpu_vram >= 6,
         "uncensored": False, "tags": ["code", "builder"]},
        {"name": "gemma3:12b", "desc": "Chat + Visao completo", "size": "~8 GB",
         "requires": "GPU 8GB+", "priority": 6, "available": gpu_vram >= 8,
         "uncensored": False, "tags": ["vision", "multimodal", "large"]},
        {"name": "phi4-mini", "desc": "Chat rapido e leve", "size": "~2.5 GB",
         "requires": "GPU 4GB+ ou CPU", "priority": 7, "available": True,
         "uncensored": False, "tags": ["chat", "compact", "cpu"]},
    ]

    return {
        "has_gpu": has_gpu,
        "gpu_vram_gb": gpu_vram,
        "backend": BACKEND,
        "models": models,
    }


# ─── SQLite setup ────────────────────────────────────────────────────────────

def _init_db():
    """Create tables if they don't exist"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS supplies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT DEFAULT 'outros',
            quantity REAL DEFAULT 0,
            unit TEXT DEFAULT 'un',
            expiry TEXT,
            notes TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT DEFAULT '',
            file TEXT NOT NULL,
            lang TEXT DEFAULT 'pt',
            size_kb INTEGER DEFAULT 0,
            read_pct REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS journal (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT UNIQUE NOT NULL,
            content TEXT DEFAULT '',
            mood TEXT DEFAULT 'neutral',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT DEFAULT 'Sem titulo',
            content TEXT DEFAULT '',
            doc_type TEXT DEFAULT 'text',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'pending',
            due_date TEXT,
            category TEXT DEFAULT 'geral',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
    """)
    conn.close()

_init_db()


def _db():
    """Get a SQLite connection with row factory"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


# ─── Guides API ──────────────────────────────────────────────────────────────

@app.get("/api/guides")
async def list_guides():
    """List all guides from data/guides/_index.json"""
    idx = GUIDES_DIR / "_index.json"
    if idx.exists():
        return JSONResponse(json.loads(idx.read_text(encoding="utf-8")))
    # Fallback: scan directory for .md files
    guides = []
    for f in sorted(GUIDES_DIR.glob("*.md")):
        guides.append({"id": f.stem, "title": f.stem.replace("-", " ").title(), "category": "geral"})
    return guides


@app.get("/api/guides/{guide_id}")
async def get_guide(guide_id: str):
    """Return markdown content of a guide"""
    safe = Path(guide_id).stem
    # Check root and disaster-specific subdirectory
    for subdir in [GUIDES_DIR, GUIDES_DIR / "disaster-specific"]:
        fp = subdir / f"{safe}.md"
        if fp.exists():
            return Response(fp.read_text(encoding="utf-8"), media_type="text/markdown")
    return JSONResponse({"error": "Guide not found"}, status_code=404)


# ─── Protocols API ───────────────────────────────────────────────────────────

@app.get("/api/protocols")
async def list_protocols():
    """List all emergency protocols"""
    idx = PROTOCOLS_DIR / "_index.json"
    if idx.exists():
        return JSONResponse(json.loads(idx.read_text(encoding="utf-8")))
    protocols = []
    for f in sorted(PROTOCOLS_DIR.glob("*.json")):
        if f.name == "_index.json":
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            protocols.append({"id": f.stem, "title": data.get("title", f.stem), "urgency": data.get("urgency", "normal")})
        except json.JSONDecodeError:
            pass
    return protocols


@app.get("/api/protocols/{proto_id}")
async def get_protocol(proto_id: str):
    """Return full decision tree for a protocol"""
    safe = Path(proto_id).stem
    fp = PROTOCOLS_DIR / f"{safe}.json"
    if fp.exists():
        return JSONResponse(json.loads(fp.read_text(encoding="utf-8")))
    return JSONResponse({"error": "Protocol not found"}, status_code=404)


# ─── Supplies API (SQLite CRUD) ──────────────────────────────────────────────

@app.get("/api/supplies")
async def list_supplies(category: str = None):
    """List supplies, optionally filtered by category"""
    conn = _db()
    if category:
        rows = conn.execute("SELECT * FROM supplies WHERE category = ? ORDER BY expiry", (category,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM supplies ORDER BY category, expiry").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/supplies/summary")
async def supplies_summary():
    """Aggregated supply dashboard"""
    conn = _db()
    total = conn.execute("SELECT COUNT(*) as c FROM supplies").fetchone()["c"]
    today = date.today().isoformat()
    expiring_7 = conn.execute(
        "SELECT COUNT(*) as c FROM supplies WHERE expiry IS NOT NULL AND expiry != '' AND expiry <= date(?, '+7 days')", (today,)
    ).fetchone()["c"]
    expiring_30 = conn.execute(
        "SELECT COUNT(*) as c FROM supplies WHERE expiry IS NOT NULL AND expiry != '' AND expiry <= date(?, '+30 days')", (today,)
    ).fetchone()["c"]
    categories = conn.execute(
        "SELECT category, COUNT(*) as count, SUM(quantity) as total_qty FROM supplies GROUP BY category ORDER BY count DESC"
    ).fetchall()
    conn.close()
    return {
        "total": total,
        "expiring_7d": expiring_7,
        "expiring_30d": expiring_30,
        "categories": [dict(r) for r in categories],
    }


@app.post("/api/supplies")
async def create_supply(request: Request):
    body = await request.json()
    conn = _db()
    cur = conn.execute(
        "INSERT INTO supplies (name, category, quantity, unit, expiry, notes) VALUES (?, ?, ?, ?, ?, ?)",
        (body.get("name", ""), body.get("category", "outros"), body.get("quantity", 0),
         body.get("unit", "un"), body.get("expiry", ""), body.get("notes", "")),
    )
    conn.commit()
    item_id = cur.lastrowid
    row = conn.execute("SELECT * FROM supplies WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    return dict(row)


@app.put("/api/supplies/{item_id}")
async def update_supply(item_id: int, request: Request):
    body = await request.json()
    conn = _db()
    fields = []
    values = []
    for key in ("name", "category", "quantity", "unit", "expiry", "notes"):
        if key in body:
            fields.append(f"{key} = ?")
            values.append(body[key])
    if not fields:
        conn.close()
        return JSONResponse({"error": "No fields to update"}, status_code=400)
    fields.append("updated_at = datetime('now','localtime')")
    values.append(item_id)
    conn.execute(f"UPDATE supplies SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    row = conn.execute("SELECT * FROM supplies WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    if row:
        return dict(row)
    return JSONResponse({"error": "Not found"}, status_code=404)


@app.delete("/api/supplies/{item_id}")
async def delete_supply(item_id: int):
    conn = _db()
    conn.execute("DELETE FROM supplies WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    return {"deleted": True, "id": item_id}


# ─── Books API ───────────────────────────────────────────────────────────────

@app.get("/api/books")
async def list_books(q: str = None):
    """List books, optionally search by title/author"""
    conn = _db()
    if q:
        rows = conn.execute(
            "SELECT * FROM books WHERE title LIKE ? OR author LIKE ? ORDER BY title",
            (f"%{q}%", f"%{q}%"),
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM books ORDER BY title").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/books/{book_id}/file")
async def serve_book(book_id: int):
    """Serve EPUB file"""
    conn = _db()
    row = conn.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
    conn.close()
    if not row:
        return JSONResponse({"error": "Book not found"}, status_code=404)
    fp = BOOKS_DIR / row["file"]
    if fp.exists():
        return FileResponse(str(fp), media_type="application/epub+zip", filename=row["file"])
    return JSONResponse({"error": "File not found"}, status_code=404)


@app.put("/api/books/{book_id}/progress")
async def update_book_progress(book_id: int, request: Request):
    body = await request.json()
    conn = _db()
    conn.execute("UPDATE books SET read_pct = ? WHERE id = ?", (body.get("read_pct", 0), book_id))
    conn.commit()
    conn.close()
    return {"updated": True, "id": book_id}


# ─── Games API ───────────────────────────────────────────────────────────────

@app.get("/api/games")
async def list_games():
    """List available games"""
    idx = GAMES_DIR / "_index.json"
    if idx.exists():
        return JSONResponse(json.loads(idx.read_text(encoding="utf-8")))
    games = []
    for f in sorted(GAMES_DIR.glob("*.html")):
        games.append({"id": f.stem, "name": f.stem.replace("-", " ").title(), "file": f.name})
    return games


@app.get("/api/games/{name}")
async def serve_game(name: str):
    """Serve a game HTML file"""
    safe = Path(name).stem
    fp = GAMES_DIR / f"{safe}.html"
    if fp.exists():
        return HTMLResponse(fp.read_text(encoding="utf-8"))
    return JSONResponse({"error": "Game not found"}, status_code=404)


# ─── Journal API ─────────────────────────────────────────────────────────────

@app.get("/api/journal")
async def list_journal(limit: int = 30):
    """List journal entries, newest first"""
    conn = _db()
    rows = conn.execute("SELECT * FROM journal ORDER BY date DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/journal")
async def upsert_journal(request: Request):
    """Create or update journal entry for a date"""
    body = await request.json()
    entry_date = body.get("date", date.today().isoformat())
    content = body.get("content", "")
    mood = body.get("mood", "neutral")
    conn = _db()
    conn.execute(
        "INSERT INTO journal (date, content, mood) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET content=?, mood=?",
        (entry_date, content, mood, content, mood),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM journal WHERE date = ?", (entry_date,)).fetchone()
    conn.close()
    return dict(row)


# ─── Kiwix status ────────────────────────────────────────────────────────────

@app.get("/api/kiwix/status")
async def kiwix_status():
    """Check if Kiwix is running and list ZIM files"""
    zim_dir = DATA_DIR / "zim"
    zims = []
    if zim_dir.exists():
        for f in sorted(zim_dir.glob("*.zim")):
            size_gb = f.stat().st_size / (1024 ** 3)
            zims.append({"name": f.stem, "file": f.name, "size_gb": round(size_gb, 2)})

    # Check if kiwix-serve is running on port 8889
    running = False
    try:
        async with httpx.AsyncClient(timeout=2) as c:
            r = await c.get("http://localhost:8889/")
            running = r.status_code == 200
    except Exception:
        pass

    return {"running": running, "port": 8889, "zim_files": zims}


# ─── Setup status ────────────────────────────────────────────────────────────

@app.get("/api/setup/status")
async def setup_status():
    """Report what offline content has been downloaded"""
    return {
        "setup_complete": (DATA_DIR / ".setup_complete").exists(),
        "guides": len(list(GUIDES_DIR.glob("*.md"))),
        "protocols": len([f for f in PROTOCOLS_DIR.glob("*.json") if f.name != "_index.json"]),
        "books": len(list(BOOKS_DIR.glob("*.epub"))),
        "games": len(list(GAMES_DIR.glob("*.html"))),
        "zim_files": len(list((DATA_DIR / "zim").glob("*.zim"))),
        "maps": len(list(MAPS_DIR.glob("*.pmtiles"))),
        "kiwix_binary": (Path("tools") / "kiwix-serve.exe").exists() or shutil.which("kiwix-serve") is not None,
        "db_exists": DB_PATH.exists(),
    }


# ─── System status ───────────────────────────────────────────────────────────

@app.get("/api/status")
async def system_status():
    """System health: CPU, RAM, disk, IP, uptime, server info"""
    # Uptime
    uptime_sec = int(time.time() - SERVER_START_TIME)

    # Local IP (non-loopback)
    ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    # psutil stats (optional — graceful degradation if not installed)
    cpu_pct = ram_pct = ram_used_mb = ram_total_mb = None
    disk_pct = disk_free_gb = disk_total_gb = None
    cpu_count = None
    net_ok = False
    gpu_name = None
    try:
        import psutil
        cpu_pct = psutil.cpu_percent(interval=0.1)
        cpu_count = psutil.cpu_count(logical=True)
        vm = psutil.virtual_memory()
        ram_pct = round(vm.percent, 1)
        ram_used_mb = round(vm.used / 1024 / 1024)
        ram_total_mb = round(vm.total / 1024 / 1024)
        d = psutil.disk_usage(str(Path.home()))
        disk_pct = round(d.percent, 1)
        disk_free_gb = round(d.free / 1024 / 1024 / 1024, 1)
        disk_total_gb = round(d.total / 1024 / 1024 / 1024, 1)
    except ImportError:
        pass

    # Quick internet check (non-blocking, 2s timeout)
    try:
        s = socket.create_connection(("8.8.8.8", 53), timeout=2)
        s.close()
        net_ok = True
    except Exception:
        net_ok = False

    # GPU detection via nvidia-smi
    try:
        r = subprocess.run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                          capture_output=True, text=True, timeout=3)
        if r.returncode == 0 and r.stdout.strip():
            gpu_name = r.stdout.strip().split("\n")[0]
    except Exception:
        pass

    # Content summary
    content = {
        "guides": len(list(GUIDES_DIR.glob("*.md"))),
        "protocols": len([f for f in PROTOCOLS_DIR.glob("*.json") if f.name != "_index.json"]),
        "books": len(list(BOOKS_DIR.glob("*.epub"))),
        "games": len(list(GAMES_DIR.glob("*.html"))),
        "zim_files": len(list((DATA_DIR / "zim").glob("*.zim"))),
        "maps": len(list(MAPS_DIR.glob("*.pmtiles"))),
    }

    return {
        "ip": ip,
        "port": 8888,
        "hostname": platform.node(),
        "uptime_sec": uptime_sec,
        "python": platform.python_version(),
        "os": f"{platform.system()} {platform.release()}",
        "arch": platform.machine(),
        "cpu_pct": cpu_pct,
        "cpu_count": cpu_count,
        "gpu": gpu_name,
        "ram_pct": ram_pct,
        "ram_used_mb": ram_used_mb,
        "ram_total_mb": ram_total_mb,
        "disk_pct": disk_pct,
        "disk_free_gb": disk_free_gb,
        "disk_total_gb": disk_total_gb,
        "internet": net_ok,
        "offline_mode": OFFLINE_MODE,
        "content": content,
        "server_time": datetime.now().isoformat(),
    }


# ─── Notes API (Notepad / Word Simple) ────────────────────────────────────────

@app.get("/api/notes")
async def list_notes(doc_type: str = None):
    conn = _db()
    if doc_type:
        rows = conn.execute(
            "SELECT id, title, doc_type, created_at, updated_at FROM notes WHERE doc_type=? ORDER BY updated_at DESC",
            (doc_type,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, title, doc_type, created_at, updated_at FROM notes ORDER BY updated_at DESC"
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/notes/{note_id}")
async def get_note(note_id: int):
    conn = _db()
    row = conn.execute("SELECT * FROM notes WHERE id=?", (note_id,)).fetchone()
    conn.close()
    if not row:
        return JSONResponse({"error": "not found"}, 404)
    return dict(row)


@app.post("/api/notes")
async def create_note(request: Request):
    data = await request.json()
    title = data.get("title", "Sem titulo")
    content = data.get("content", "")
    doc_type = data.get("doc_type", "text")
    conn = _db()
    cur = conn.execute(
        "INSERT INTO notes (title, content, doc_type) VALUES (?, ?, ?)",
        (title, content, doc_type)
    )
    conn.commit()
    note_id = cur.lastrowid
    conn.close()
    return {"id": note_id, "title": title, "doc_type": doc_type}


@app.put("/api/notes/{note_id}")
async def update_note(note_id: int, request: Request):
    data = await request.json()
    conn = _db()
    fields = []
    values = []
    for key in ("title", "content", "doc_type"):
        if key in data:
            fields.append(f"{key}=?")
            values.append(data[key])
    if fields:
        fields.append("updated_at=datetime('now','localtime')")
        values.append(note_id)
        conn.execute(f"UPDATE notes SET {', '.join(fields)} WHERE id=?", values)
        conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: int):
    conn = _db()
    conn.execute("DELETE FROM notes WHERE id=?", (note_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── Tasks / Agenda API ───────────────────────────────────────────────────────

@app.get("/api/tasks")
async def list_tasks(status: str = None, category: str = None):
    conn = _db()
    sql = "SELECT * FROM tasks"
    params = []
    conditions = []
    if status:
        conditions.append("status=?")
        params.append(status)
    if category:
        conditions.append("category=?")
        params.append(category)
    if conditions:
        sql += " WHERE " + " AND ".join(conditions)
    sql += " ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, due_date ASC NULLS LAST, created_at DESC"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/tasks")
async def create_task(request: Request):
    body = await request.json()
    title = body.get("title", "").strip()
    if not title:
        return JSONResponse({"error": "Titulo obrigatorio"}, status_code=400)
    conn = _db()
    cur = conn.execute(
        "INSERT INTO tasks (title, description, priority, category, due_date) VALUES (?,?,?,?,?)",
        (title, body.get("description", ""), body.get("priority", "medium"),
         body.get("category", "geral"), body.get("due_date")),
    )
    conn.commit()
    task_id = cur.lastrowid
    row = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    conn.close()
    return dict(row)


@app.put("/api/tasks/{task_id}")
async def update_task(task_id: int, request: Request):
    body = await request.json()
    conn = _db()
    fields = []
    params = []
    for key in ("title", "description", "priority", "status", "due_date", "category"):
        if key in body:
            fields.append(f"{key}=?")
            params.append(body[key])
    if not fields:
        conn.close()
        return JSONResponse({"error": "Nada para atualizar"}, status_code=400)
    fields.append("updated_at=datetime('now','localtime')")
    params.append(task_id)
    conn.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id=?", params)
    conn.commit()
    row = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    conn.close()
    return dict(row) if row else {"ok": True}


@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: int):
    conn = _db()
    conn.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── Terminal ─────────────────────────────────────────────────────────────────

TERMINAL_ALLOWED_CMDS = {
    "ls", "dir", "cat", "type", "echo", "date", "whoami", "hostname",
    "pwd", "cd", "ping", "ipconfig", "ifconfig", "netstat", "nslookup",
    "df", "du", "free", "uptime", "uname", "env", "set", "tree",
    "head", "tail", "wc", "sort", "find", "grep", "which", "where",
    "python", "pip", "node", "npm", "git",
}


@app.post("/api/terminal")
async def terminal_exec(request: Request):
    if _check_rate_limit("terminal", request.client.host if request.client else "local"):
        return JSONResponse({"output": "bunker-sh: limite de taxa excedido. Aguarde.", "exit_code": 1}, status_code=429)
    body = await request.json()
    cmd = body.get("command", "").strip()
    if not cmd:
        return {"output": "", "exit_code": 0}
    if len(cmd) > 1000:
        return {"output": "bunker-sh: comando muito longo (max 1000 chars)", "exit_code": 1}

    # Extract the base command for allowlist check
    base_cmd = cmd.split()[0].split("/")[-1].split("\\")[-1].lower()
    # Remove .exe extension for Windows
    if base_cmd.endswith(".exe"):
        base_cmd = base_cmd[:-4]

    if base_cmd not in TERMINAL_ALLOWED_CMDS:
        return {"output": f"bunker-sh: {base_cmd}: comando nao permitido\nComandos permitidos: {', '.join(sorted(TERMINAL_ALLOWED_CMDS))}", "exit_code": 1}

    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True,
            timeout=15, cwd=str(Path.cwd()),
        )
        output = result.stdout + result.stderr
        return {"output": output.rstrip(), "exit_code": result.returncode}
    except subprocess.TimeoutExpired:
        return {"output": "bunker-sh: tempo limite excedido (15s)", "exit_code": 124}
    except Exception as e:
        return {"output": f"bunker-sh: erro: {e}", "exit_code": 1}


# ─── File Manager ─────────────────────────────────────────────────────────────

FILEMGR_ROOT = Path.cwd()


@app.get("/api/files")
async def list_files(path: str = "."):
    target = (FILEMGR_ROOT / path).resolve()
    # Prevent path traversal
    if not str(target).startswith(str(FILEMGR_ROOT.resolve())):
        return JSONResponse({"error": "Acesso negado"}, status_code=403)
    if not target.is_dir():
        return JSONResponse({"error": "Diretorio nao encontrado"}, status_code=404)

    items = []
    try:
        for entry in sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
            # Skip hidden and system dirs
            if entry.name.startswith(".") or entry.name in ("__pycache__", "node_modules", ".git"):
                continue
            stat = entry.stat()
            items.append({
                "name": entry.name,
                "type": "dir" if entry.is_dir() else "file",
                "size": stat.st_size if entry.is_file() else None,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "ext": entry.suffix.lower() if entry.is_file() else None,
            })
    except PermissionError:
        return JSONResponse({"error": "Permissao negada"}, status_code=403)

    rel = str(target.relative_to(FILEMGR_ROOT)).replace("\\", "/")
    if rel == ".":
        rel = ""
    return {"path": rel, "items": items}


@app.get("/api/files/read")
async def read_file(path: str, raw: str = ""):
    target = (FILEMGR_ROOT / path).resolve()
    if not str(target).startswith(str(FILEMGR_ROOT.resolve())):
        return JSONResponse({"error": "Acesso negado"}, status_code=403)
    if not target.is_file():
        return JSONResponse({"error": "Arquivo nao encontrado"}, status_code=404)

    # Raw mode: serve binary file directly (for media player)
    if raw == "1":
        media_types = {
            ".mp4": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska",
            ".avi": "video/x-msvideo", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
            ".wav": "audio/wav", ".m4a": "audio/mp4", ".flac": "audio/flac",
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".gif": "image/gif", ".webp": "image/webp", ".pdf": "application/pdf",
        }
        ext = target.suffix.lower()
        mt = media_types.get(ext, "application/octet-stream")
        return FileResponse(target, media_type=mt)

    # Only allow reading text files
    text_exts = {".txt", ".md", ".py", ".js", ".css", ".html", ".json", ".yaml", ".yml",
                 ".toml", ".cfg", ".ini", ".sh", ".bat", ".csv", ".log", ".xml", ".sql", ".env"}
    if target.suffix.lower() not in text_exts:
        return {"content": f"[Arquivo binario: {target.suffix}, {target.stat().st_size} bytes]", "binary": True}

    try:
        content = target.read_text(encoding="utf-8", errors="replace")
        # Limit to 100KB
        if len(content) > 102400:
            content = content[:102400] + "\n\n... [truncado em 100KB]"
        return {"content": content, "binary": False, "size": target.stat().st_size}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ─── Static ──────────────────────────────────────────────────────────────────

app.mount("/", StaticFiles(directory="static", html=True), name="static")
