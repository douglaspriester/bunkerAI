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


# ─── Shared streaming helper ─────────────────────────────────────────────────

def _chat_stream(payload: dict, timeout: float = 300.0) -> StreamingResponse:
    """Stream Ollama /api/chat tokens as SSE — used by chat, vision, and build."""
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


# ─── Health / Models ─────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{OLLAMA_BASE}/api/tags")
            models = r.json().get("models", [])
            names = [m["name"] for m in models]
            vision = [n for n in names if any(v in n.lower() for v in [
                "llava", "bakllava", "gemma3", "moondream", "minicpm",
                "llama3.2-vision", "granite3", "granite-vision"
            ])]

            # Voice capabilities
            whisper_ok = get_whisper_model() is not None
            piper_ok = check_piper()
            pyttsx3_ok = check_pyttsx3()

            # Determine best TTS
            if piper_ok:
                tts_engine = "piper"
            elif pyttsx3_ok:
                tts_engine = "pyttsx3"
            else:
                tts_engine = "edge-tts"

            # Piper model status
            piper_models_status = {}
            for model_id, info in PIPER_MODELS.items():
                onnx = VOICE_MODELS_DIR / f"{model_id}.onnx"
                piper_models_status[model_id] = {
                    **info,
                    "downloaded": onnx.exists() and onnx.stat().st_size > 1000,
                }

            return {
                "status": "online",
                "ollama": OLLAMA_BASE,
                "models": names,
                "vision_models": vision,
                "stt": "whisper" if whisper_ok else "browser",
                "tts": tts_engine,
                "stt_ready": whisper_ok,
                "tts_offline": piper_ok or pyttsx3_ok,
                "piper_available": piper_ok,
                "pyttsx3_available": pyttsx3_ok,
                "piper_models": piper_models_status,
            }
    except Exception as e:
        return {
            "status": "offline",
            "error": str(e),
            "models": [],
            "vision_models": [],
            "stt": "browser",
            "tts": "edge-tts",
            "stt_ready": False,
            "tts_offline": False,
            "piper_available": False,
            "pyttsx3_available": False,
            "piper_models": {},
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


# ─── TTS (Text-to-Speech) — Piper offline + edge-tts online ─────────────────

@app.post("/api/tts")
async def tts(request: Request, background_tasks: BackgroundTasks):
    body = await request.json()
    text = body.get("text", "")
    voice = body.get("voice", "pt-BR-AntonioNeural")
    engine = body.get("engine", "auto")  # "auto", "piper", "pyttsx3", "edge-tts"
    voice_id = body.get("voice_id", None)   # pyttsx3 system voice ID
    if not text:
        return JSONResponse({"error": "No text"}, status_code=400)

    filename = f"{uuid.uuid4().hex}.mp3"
    filepath = TTS_DIR / filename

    # 1. Try Piper (best offline quality)
    if engine in ("auto", "piper") and check_piper():
        try:
            result = await _tts_piper(text, filepath, voice)
            if result:
                mt = "audio/mpeg" if result.suffix == ".mp3" else "audio/wav"
                background_tasks.add_task(os.unlink, str(result))
                return FileResponse(str(result), media_type=mt, filename=result.name)
        except Exception as e:
            print(f"[TTS] Piper error: {e}, trying pyttsx3")

    # 2. Try pyttsx3 (system TTS — offline, no model download needed)
    if engine in ("auto", "pyttsx3") and check_pyttsx3():
        try:
            result = await _tts_pyttsx3(text, filepath, voice_id)
            if result:
                mt = "audio/mpeg" if result.suffix == ".mp3" else "audio/wav"
                background_tasks.add_task(os.unlink, str(result))
                return FileResponse(str(result), media_type=mt, filename=result.name)
        except Exception as e:
            print(f"[TTS] pyttsx3 error: {e}, falling back to edge-tts")

    # 3. Fallback: edge-tts (requires internet)
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


# ─── Chat (streaming) — texto puro ──────────────────────────────────────────

@app.post("/api/chat")
async def chat(request: Request):
    if _check_rate_limit("chat", request.client.host if request.client else "local"):
        return JSONResponse({"error": "Limite de taxa excedido. Aguarde."}, status_code=429)
    body = await request.json()
    model = body.get("model", "gemma3:12b")
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
    model = body.get("model", "gemma3:12b")
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
    model: str = Form("gemma3:12b"),
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
    try:
        import psutil
        cpu_pct = psutil.cpu_percent(interval=0.1)
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
        "uptime_sec": uptime_sec,
        "python": platform.python_version(),
        "os": f"{platform.system()} {platform.release()}",
        "cpu_pct": cpu_pct,
        "ram_pct": ram_pct,
        "ram_used_mb": ram_used_mb,
        "ram_total_mb": ram_total_mb,
        "disk_pct": disk_pct,
        "disk_free_gb": disk_free_gb,
        "disk_total_gb": disk_total_gb,
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
async def read_file(path: str):
    target = (FILEMGR_ROOT / path).resolve()
    if not str(target).startswith(str(FILEMGR_ROOT.resolve())):
        return JSONResponse({"error": "Acesso negado"}, status_code=403)
    if not target.is_file():
        return JSONResponse({"error": "Arquivo nao encontrado"}, status_code=404)

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
