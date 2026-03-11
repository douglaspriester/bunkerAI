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
from pathlib import Path

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

OLLAMA_BASE = os.getenv("OLLAMA_URL", "http://localhost:11434")
GENERATED_DIR = Path("generated_apps")
GENERATED_DIR.mkdir(exist_ok=True)
TTS_DIR = Path("tts_cache")
TTS_DIR.mkdir(exist_ok=True)
MAPS_DIR = Path("static/maps")
MAPS_DIR.mkdir(parents=True, exist_ok=True)
VOICE_MODELS_DIR = Path("voice_models")
VOICE_MODELS_DIR.mkdir(exist_ok=True)

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


# ─── Static ──────────────────────────────────────────────────────────────────

app.mount("/", StaticFiles(directory="static", html=True), name="static")
