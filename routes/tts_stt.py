"""TTS (Text-to-Speech) and STT (Speech-to-Text) endpoints."""

import asyncio
import json
import os
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, BackgroundTasks, File, Form, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

import routes.config as cfg

# ─── SSRF protection ─────────────────────────────────────────────────────────

ALLOWED_DOWNLOAD_HOSTS = {
    'huggingface.co', 'cdn-lfs.huggingface.co', 'cdn-lfs-us-1.huggingface.co',
    'github.com', 'objects.githubusercontent.com', 'raw.githubusercontent.com',
    'github-releases.githubusercontent.com',
}


def _validate_download_url(url: str) -> bool:
    """Return True only if url points to an allowed host over http(s)."""
    try:
        p = urlparse(url)
        return p.scheme in ('https', 'http') and (p.hostname or '') in ALLOWED_DOWNLOAD_HOSTS
    except Exception:
        return False


# ─── TTS limits ──────────────────────────────────────────────────────────────

_MAX_TTS_CHARS = 5000  # prevent very long synthesis requests from hanging

router = APIRouter(tags=["tts_stt"])


# ─── STT helpers ─────────────────────────────────────────────────────────────

def _check_cuda() -> bool:
    """Check if CUDA is available."""
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


def get_whisper_model():
    """Lazy-load faster-whisper model."""
    if cfg._whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            model_size = os.getenv("WHISPER_MODEL", "base")
            device = "cuda" if _check_cuda() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            print(f"[STT] Loading faster-whisper ({model_size}) on {device}...")
            cfg._whisper_model = WhisperModel(model_size, device=device, compute_type=compute_type)
            print(f"[STT] faster-whisper ready on {device}")
        except ImportError:
            print("[STT] faster-whisper not installed — pip install faster-whisper")
            cfg._whisper_model = False
        except Exception as e:
            print(f"[STT] faster-whisper error: {e}")
            cfg._whisper_model = False
    return cfg._whisper_model if cfg._whisper_model is not False else None


# ─── TTS helpers ─────────────────────────────────────────────────────────────

def check_piper() -> bool:
    """Check if piper CLI binary is available AND local .onnx models exist."""
    if cfg._piper_available is None:
        has_binary = shutil.which("piper") is not None
        has_models = any(cfg.VOICE_MODELS_DIR.glob("*.onnx")) if cfg.VOICE_MODELS_DIR.exists() else False
        if not has_binary:
            try:
                import piper  # noqa: F401
                has_binary = True
            except ImportError:
                pass
        cfg._piper_available = has_binary and has_models
        if cfg._piper_available:
            print(f"[TTS] Piper TTS available (offline) — {list(cfg.VOICE_MODELS_DIR.glob('*.onnx'))[:3]}")
        elif has_binary and not has_models:
            print("[TTS] Piper binary found but no .onnx models — download via /api/tts/download-piper-model")
        else:
            print("[TTS] Piper not found — will use pyttsx3 or edge-tts")
    return cfg._piper_available


def check_pyttsx3() -> bool:
    """Check if pyttsx3 with system voices is available."""
    if cfg._pyttsx3_available is None:
        try:
            import pyttsx3
            engine = pyttsx3.init()
            voices = engine.getProperty("voices")
            engine.stop()
            cfg._pyttsx3_available = bool(voices)
            if cfg._pyttsx3_available:
                print(f"[TTS] pyttsx3 available — {len(voices)} system voice(s)")
        except Exception as e:
            print(f"[TTS] pyttsx3 not available: {e}")
            cfg._pyttsx3_available = False
    return cfg._pyttsx3_available


def check_kokoro() -> bool:
    """Check if kokoro-onnx is installed and model files exist."""
    if cfg._kokoro_available is None:
        try:
            import kokoro_onnx  # noqa: F401
            onnx_path = cfg.KOKORO_MODELS_DIR / "kokoro-v1.0.onnx"
            voices_path = cfg.KOKORO_MODELS_DIR / "voices-v1.0.bin"
            if onnx_path.exists() and voices_path.exists():
                cfg._kokoro_available = True
                print("[TTS] Kokoro TTS available (offline, 82M params)")
            else:
                cfg._kokoro_available = False
                print("[TTS] kokoro-onnx installed but models not found — download via /api/tts/kokoro/download")
        except ImportError:
            cfg._kokoro_available = False
            print("[TTS] kokoro-onnx not installed — pip install kokoro-onnx soundfile")
    return cfg._kokoro_available


def _get_kokoro():
    """Lazy-load Kokoro singleton."""
    if cfg._kokoro_instance is None and check_kokoro():
        try:
            from kokoro_onnx import Kokoro
            onnx_path = cfg.KOKORO_MODELS_DIR / "kokoro-v1.0.onnx"
            voices_path = cfg.KOKORO_MODELS_DIR / "voices-v1.0.bin"
            cfg._kokoro_instance = Kokoro(str(onnx_path), str(voices_path))
            print("[TTS] Kokoro model loaded")
        except Exception as e:
            print(f"[TTS] Kokoro load error: {e}")
            cfg._kokoro_instance = False
    return cfg._kokoro_instance if cfg._kokoro_instance is not False else None


async def _tts_kokoro(text: str, filepath: Path, voice: str) -> Optional[Path]:
    """Generate audio with Kokoro TTS."""
    import concurrent.futures

    kokoro = _get_kokoro()
    if not kokoro:
        return None

    if voice.startswith("kokoro:"):
        voice_id = voice.split(":", 1)[1]
        lang = {"p": "pt-br", "a": "en-us", "b": "en-gb", "e": "es", "f": "fr"}.get(voice_id[0], "en-us")
    else:
        voice_id, lang = cfg.KOKORO_VOICE_MAP.get(voice, ("pm_alex", "pt-br"))

    wav_path = filepath.with_suffix(".wav")

    def _synth():
        samples, sr = kokoro.create(text, voice=voice_id, speed=1.0, lang=lang)
        import soundfile as sf
        sf.write(str(wav_path), samples, sr)
        return wav_path

    try:
        loop = asyncio.get_running_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            result = await loop.run_in_executor(pool, _synth)

        if result and result.exists():
            if shutil.which("ffmpeg"):
                try:
                    mp3_proc = await asyncio.create_subprocess_exec(
                        "ffmpeg", "-y", "-i", str(wav_path), "-q:a", "4", str(filepath),
                        stdout=asyncio.subprocess.DEVNULL,
                        stderr=asyncio.subprocess.DEVNULL,
                    )
                    await mp3_proc.wait()
                    wav_path.unlink(missing_ok=True)
                    return filepath if filepath.exists() else None
                except (NotImplementedError, OSError):
                    return wav_path
            else:
                return wav_path
    except Exception as e:
        print(f"[TTS] Kokoro error: {type(e).__name__}: {e}")
    return None


async def _tts_piper(text: str, filepath: Path, voice: str) -> Optional[Path]:
    """Generate audio with Piper TTS (offline)."""
    piper_voice_map = {
        "pt-BR-AntonioNeural": "pt_BR-faber-medium",
        "pt-BR-FranciscaNeural": "pt_BR-faber-medium",
        "en-US-GuyNeural": "en_US-lessac-medium",
        "en-US-JennyNeural": "en_US-amy-medium",
    }
    piper_model_id = piper_voice_map.get(voice, "pt_BR-faber-medium")

    model_path = cfg.VOICE_MODELS_DIR / f"{piper_model_id}.onnx"
    if not model_path.exists():
        onnx_files = list(cfg.VOICE_MODELS_DIR.glob("*.onnx"))
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

        def _piper_synth():
            voice_obj = piper_module.PiperVoice.load(str(model_path))
            with open(str(wav_path), "wb") as f:
                voice_obj.synthesize(text, f)
            return wav_path.exists() and wav_path.stat().st_size > 100

        ok = await asyncio.to_thread(_piper_synth)
        if ok:
            return wav_path
    except Exception:
        pass

    return None


async def _tts_pyttsx3(text: str, filepath: Path, voice_id: str = None) -> Optional[Path]:
    """Generate audio with pyttsx3 (OS TTS engine)."""
    import concurrent.futures
    try:
        import pyttsx3
        wav_path = filepath.with_suffix(".wav")

        def _synth():
            try:
                import pythoncom
                pythoncom.CoInitialize()
            except ImportError:
                pass
            try:
                engine = pyttsx3.init()
                voices = engine.getProperty("voices")
                if voice_id:
                    for v in voices:
                        if voice_id in str(v.id) or voice_id.lower() in v.name.lower():
                            engine.setProperty("voice", v.id)
                            break
                else:
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
            except Exception as inner_e:
                print(f"[TTS] pyttsx3 synth error: {inner_e}")
                return False
            finally:
                try:
                    import pythoncom
                    pythoncom.CoUninitialize()
                except (ImportError, Exception):
                    pass

        loop = asyncio.get_running_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            ok = await loop.run_in_executor(pool, _synth)

        if ok and wav_path.exists():
            if shutil.which("ffmpeg"):
                try:
                    proc = await asyncio.create_subprocess_exec(
                        "ffmpeg", "-y", "-i", str(wav_path), "-q:a", "4", str(filepath),
                        stdout=asyncio.subprocess.DEVNULL,
                        stderr=asyncio.subprocess.DEVNULL,
                    )
                    await proc.wait()
                    wav_path.unlink(missing_ok=True)
                    return filepath if filepath.exists() else None
                except (NotImplementedError, OSError):
                    return wav_path
            else:
                return wav_path
    except Exception as e:
        import traceback
        print(f"[TTS] pyttsx3 error: {type(e).__name__}: {e}")
        traceback.print_exc()
    return None


# ─── Endpoints ────────────────────────────────────────────────────────────────

_MAX_STT_BYTES = 8 * 1024 * 1024  # 8 MB — approx. 60 s of browser WebM at typical quality


@router.post("/api/stt")
async def speech_to_text(audio: UploadFile = File(...), language: str = Form("pt")):
    """Transcribe audio using faster-whisper (offline) or return error."""
    model = get_whisper_model()
    if model is None:
        return JSONResponse(
            {"error": "STT offline nao disponivel. Instale: pip install faster-whisper", "use_browser": True},
            status_code=503,
        )

    content = await audio.read()
    if not content or len(content) < 100:
        return JSONResponse({"error": "Audio vazio ou muito curto", "use_browser": True}, status_code=400)
    if len(content) > _MAX_STT_BYTES:
        return JSONResponse(
            {"error": f"Audio muito longo (max ~60s / 8MB). Recebido: {len(content) // 1024}KB", "use_browser": True},
            status_code=400,
        )

    suffix = Path(audio.filename).suffix if audio.filename else ".webm"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp_path = tmp.name
    try:
        tmp.write(content)
        tmp.close()

        def _transcribe():
            segs, inf = model.transcribe(
                tmp_path,
                language=language if language != "auto" else None,
                beam_size=5,
                vad_filter=True,
            )
            return list(segs), inf

        segments, info = await asyncio.to_thread(_transcribe)

        text = " ".join(segment.text.strip() for segment in segments)
        return {
            "text": text,
            "language": info.language,
            "language_probability": round(info.language_probability, 2),
            "engine": "whisper",
        }
    except Exception as e:
        print(f"[STT] transcription error: {e}")
        return JSONResponse({"error": "Erro na transcricao de audio", "use_browser": True}, status_code=500)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@router.post("/api/tts")
async def tts(request: Request, background_tasks: BackgroundTasks):
    body = await request.json()
    text = body.get("text", "")
    voice = body.get("voice", "pt-BR-AntonioNeural")
    engine = body.get("engine", "auto")
    voice_id = body.get("voice_id", None)
    kokoro_voice = body.get("kokoro_voice", None)
    if not text:
        return JSONResponse({"error": "No text"}, status_code=400)
    if len(text) > _MAX_TTS_CHARS:
        return JSONResponse(
            {"error": f"Texto muito longo (max {_MAX_TTS_CHARS} caracteres)"},
            status_code=400,
        )

    filename = f"{uuid.uuid4().hex}.mp3"
    filepath = cfg.TTS_DIR / filename

    # 1. Kokoro (best offline quality)
    if engine in ("auto", "kokoro") and check_kokoro():
        try:
            effective_voice = voice
            if kokoro_voice:
                effective_voice = f"kokoro:{kokoro_voice}"
            result = await _tts_kokoro(text, filepath, effective_voice)
            if result:
                mt = "audio/mpeg" if result.suffix == ".mp3" else "audio/wav"
                background_tasks.add_task(os.unlink, str(result))
                return FileResponse(str(result), media_type=mt, filename=result.name)
        except Exception as e:
            print(f"[TTS] Kokoro error: {e}, trying Piper")

    # 2. Piper
    if engine in ("auto", "piper") and check_piper():
        try:
            result = await _tts_piper(text, filepath, voice)
            if result:
                mt = "audio/mpeg" if result.suffix == ".mp3" else "audio/wav"
                background_tasks.add_task(os.unlink, str(result))
                return FileResponse(str(result), media_type=mt, filename=result.name)
        except Exception as e:
            print(f"[TTS] Piper error: {e}, trying pyttsx3")

    # 3. pyttsx3
    if engine in ("auto", "pyttsx3") and check_pyttsx3():
        try:
            result = await _tts_pyttsx3(text, filepath, voice_id)
            if result:
                mt = "audio/mpeg" if result.suffix == ".mp3" else "audio/wav"
                background_tasks.add_task(os.unlink, str(result))
                return FileResponse(str(result), media_type=mt, filename=result.name)
        except Exception as e:
            print(f"[TTS] pyttsx3 error: {e}, falling back to edge-tts")

    # 4. edge-tts (requires internet)
    if engine in ("auto", "edge-tts"):
        if cfg.OFFLINE_MODE:
            return JSONResponse(
                {"error": "Modo offline ativo. Instale Kokoro TTS para voz offline.", "offline": True},
                status_code=503,
            )
        try:
            import edge_tts
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(str(filepath))
            background_tasks.add_task(os.unlink, str(filepath))
            return FileResponse(str(filepath), media_type="audio/mpeg", filename=filename)
        except Exception as e:
            print(f"[TTS] edge-tts error: {e}")
            # Clean up any partial file that may have been created
            if filepath.exists():
                filepath.unlink(missing_ok=True)
            return JSONResponse({"error": "Erro no edge-tts. Verifique a conexao com a internet.", "hint": "edge-tts precisa de internet"}, status_code=500)

    # If a specific engine was requested and is not available, or all auto engines failed
    if engine == "auto":
        return JSONResponse(
            {"error": "Nenhum engine TTS disponivel"},
            status_code=503,
        )
    return JSONResponse(
        {"error": f"Engine '{engine}' nao disponivel", "available": "kokoro, piper, pyttsx3, edge-tts"},
        status_code=503,
    )


@router.get("/api/tts/piper-models")
async def list_piper_models():
    """List available Piper models with download status."""
    result = {}
    for model_id, info in cfg.PIPER_MODELS.items():
        onnx = cfg.VOICE_MODELS_DIR / f"{model_id}.onnx"
        downloaded = onnx.exists() and onnx.stat().st_size > 1000
        result[model_id] = {**info, "downloaded": downloaded}
    return {"models": result, "models_dir": str(cfg.VOICE_MODELS_DIR.resolve())}


@router.post("/api/tts/download-piper-model")
async def download_piper_model(request: Request):
    """Stream download progress of a Piper .onnx voice model via SSE."""
    body = await request.json()
    model_id = body.get("model_id", "")

    if model_id not in cfg.PIPER_MODELS:
        return JSONResponse({"error": f"Unknown model: {model_id}"}, status_code=400)

    info = cfg.PIPER_MODELS[model_id]
    lang = info["lang"]
    lang_code = info["lang_code"]
    speaker = info["speaker"]
    quality = info["quality"]

    onnx_filename = f"{model_id}.onnx"
    json_filename = f"{model_id}.onnx.json"
    onnx_url = f"{cfg.PIPER_HF_BASE}/{lang}/{lang_code}/{speaker}/{quality}/{lang_code}-{speaker}-{quality}.onnx"
    json_url = f"{cfg.PIPER_HF_BASE}/{lang}/{lang_code}/{speaker}/{quality}/{lang_code}-{speaker}-{quality}.onnx.json"

    if not _validate_download_url(onnx_url) or not _validate_download_url(json_url):
        return JSONResponse({"error": "URL nao permitida"}, status_code=400)

    onnx_dest = cfg.VOICE_MODELS_DIR / onnx_filename
    json_dest = cfg.VOICE_MODELS_DIR / json_filename

    async def generate():
        _completed = False
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(600.0), follow_redirects=True) as client:
                yield f"data: {json.dumps({'status': 'downloading', 'file': json_filename, 'progress': 0})}\n\n"
                r = await client.get(json_url)
                if r.status_code == 200:
                    json_dest.write_bytes(r.content)
                    yield f"data: {json.dumps({'status': 'downloading', 'file': json_filename, 'progress': 100})}\n\n"

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

                if onnx_dest.exists() and onnx_dest.stat().st_size > 1000:
                    _completed = True
                    cfg._piper_available = None  # reset so check_piper() re-evaluates
                    yield f"data: {json.dumps({'status': 'done', 'model_id': model_id, 'file': onnx_filename})}\n\n"
                else:
                    onnx_dest.unlink(missing_ok=True)
                    yield f"data: {json.dumps({'status': 'error', 'error': 'Download incomplete'})}\n\n"

        except Exception as e:
            print(f"[TTS] Piper download error: {e}")
            if not _completed:
                onnx_dest.unlink(missing_ok=True)
            yield f"data: {json.dumps({'status': 'error', 'error': 'Erro ao baixar modelo Piper'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/api/tts/pyttsx3/voices")
async def list_pyttsx3_voices():
    """List available system TTS voices (pyttsx3)."""
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

        loop = asyncio.get_running_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            voices = await loop.run_in_executor(pool, _get_voices)
        return {"voices": voices}
    except Exception as e:
        print(f"[TTS] pyttsx3 list voices error: {e}")
        return JSONResponse({"error": "Erro ao listar vozes do sistema"}, status_code=500)


@router.get("/api/tts/kokoro/status")
async def kokoro_status():
    """Check Kokoro TTS status."""
    has_pkg = False
    try:
        import kokoro_onnx  # noqa: F401
        has_pkg = True
    except ImportError:
        pass

    onnx_path = cfg.KOKORO_MODELS_DIR / "kokoro-v1.0.onnx"
    voices_path = cfg.KOKORO_MODELS_DIR / "voices-v1.0.bin"
    has_models = onnx_path.exists() and voices_path.exists()

    return {
        "installed": has_pkg,
        "models_downloaded": has_models,
        "available": has_pkg and has_models,
        "model_size_mb": 300,
        "voices": cfg.KOKORO_VOICES,
        "models_dir": str(cfg.KOKORO_MODELS_DIR.resolve()),
    }


@router.post("/api/tts/kokoro/download")
async def download_kokoro_model():
    """Stream download progress of Kokoro TTS models via SSE."""
    if not _validate_download_url(cfg.KOKORO_ONNX_URL) or not _validate_download_url(cfg.KOKORO_VOICES_URL):
        return JSONResponse({"error": "URL nao permitida"}, status_code=400)

    onnx_dest = cfg.KOKORO_MODELS_DIR / "kokoro-v1.0.onnx"
    voices_dest = cfg.KOKORO_MODELS_DIR / "voices-v1.0.bin"

    async def generate():
        _completed = False
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(600.0), follow_redirects=True) as client:
                yield f"data: {json.dumps({'status': 'downloading', 'file': 'voices-v1.0.bin', 'progress': 0})}\n\n"
                r = await client.get(cfg.KOKORO_VOICES_URL)
                if r.status_code == 200:
                    voices_dest.write_bytes(r.content)
                    yield f"data: {json.dumps({'status': 'downloading', 'file': 'voices-v1.0.bin', 'progress': 100})}\n\n"
                else:
                    yield f"data: {json.dumps({'status': 'error', 'error': f'HTTP {r.status_code} downloading voices'})}\n\n"
                    return

                yield f"data: {json.dumps({'status': 'downloading', 'file': 'kokoro-v1.0.onnx', 'progress': 0, 'total_mb': 300})}\n\n"

                async with client.stream("GET", cfg.KOKORO_ONNX_URL) as resp:
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
                    _completed = True
                    cfg._kokoro_available = None  # reset check
                    cfg._kokoro_instance = None   # reset singleton
                    yield f"data: {json.dumps({'status': 'done', 'message': 'Kokoro TTS pronto!'})}\n\n"
                else:
                    onnx_dest.unlink(missing_ok=True)
                    yield f"data: {json.dumps({'status': 'error', 'error': 'Download incomplete'})}\n\n"
        except Exception as e:
            print(f"[TTS] Kokoro download error: {e}")
            if not _completed:
                onnx_dest.unlink(missing_ok=True)
            yield f"data: {json.dumps({'status': 'error', 'error': 'Erro ao baixar modelo Kokoro'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/api/tts/kokoro/voices")
async def list_kokoro_voices():
    """List all Kokoro voices grouped by language."""
    return {"voices": cfg.KOKORO_VOICES, "available": check_kokoro()}
