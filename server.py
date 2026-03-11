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
    """Check if piper-tts is available"""
    global _piper_available
    if _piper_available is None:
        _piper_available = shutil.which("piper") is not None
        if not _piper_available:
            # Try python module
            try:
                import piper
                _piper_available = True
            except ImportError:
                _piper_available = False
        if _piper_available:
            print("[TTS] Piper TTS available (offline)")
        else:
            print("[TTS] Piper not found — using edge-tts (online)")
    return _piper_available


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

            return {
                "status": "online",
                "ollama": OLLAMA_BASE,
                "models": names,
                "vision_models": vision,
                "stt": "whisper" if whisper_ok else "browser",
                "tts": "piper" if piper_ok else "edge-tts",
                "stt_ready": whisper_ok,
                "tts_offline": piper_ok,
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
    engine = body.get("engine", "auto")  # "auto", "piper", "edge-tts"
    if not text:
        return JSONResponse({"error": "No text"}, status_code=400)

    filename = f"{uuid.uuid4().hex}.mp3"
    filepath = TTS_DIR / filename

    # Try piper first if requested or auto
    if engine in ("auto", "piper") and check_piper():
        try:
            result = await _tts_piper(text, filepath, voice)
            if result:
                background_tasks.add_task(os.unlink, str(result))
                return FileResponse(str(result), media_type="audio/mpeg", filename=result.name)
        except Exception as e:
            print(f"[TTS] Piper error: {e}, falling back to edge-tts")

    # Fallback: edge-tts (online)
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(str(filepath))
        background_tasks.add_task(os.unlink, str(filepath))
        return FileResponse(str(filepath), media_type="audio/mpeg", filename=filename)
    except Exception as e:
        return JSONResponse({"error": str(e), "hint": "edge-tts precisa de internet"}, status_code=500)


async def _tts_piper(text: str, filepath: Path, voice: str) -> Path | None:
    """Generate audio with Piper TTS (offline)"""
    # Map edge-tts voice names to piper model names
    piper_voice_map = {
        "pt-BR-AntonioNeural": "pt_BR-faber-medium",
        "pt-BR-FranciscaNeural": "pt_BR-faber-medium",
        "en-US-GuyNeural": "en_US-lessac-medium",
        "en-US-JennyNeural": "en_US-amy-medium",
    }
    piper_model = piper_voice_map.get(voice, "pt_BR-faber-medium")

    wav_path = filepath.with_suffix(".wav")

    # Try using piper CLI
    if shutil.which("piper"):
        proc = await asyncio.create_subprocess_exec(
            "piper",
            "--model", piper_model,
            "--output_file", str(wav_path),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate(input=text.encode("utf-8"))
        if proc.returncode == 0 and wav_path.exists():
            # Convert to mp3 if ffmpeg available
            if shutil.which("ffmpeg"):
                mp3_proc = await asyncio.create_subprocess_exec(
                    "ffmpeg", "-y", "-i", str(wav_path), "-q:a", "4", str(filepath),
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                )
                await mp3_proc.wait()
                wav_path.unlink(missing_ok=True)
                if filepath.exists():
                    return filepath
            else:
                # Return wav if no ffmpeg
                return wav_path

    # Try python module
    try:
        import piper
        voice_obj = piper.PiperVoice.load(piper_model)
        with open(str(wav_path), "wb") as f:
            voice_obj.synthesize(text, f)
        return wav_path
    except Exception:
        pass

    return None


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
