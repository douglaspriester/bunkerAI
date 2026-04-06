"""System endpoints: health, models, backend detection, terminal, image generation, setup."""

import asyncio
import json
import os
import platform
import re
import shutil
import socket
import sqlite3
import subprocess
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, File, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

import routes.config as cfg
from routes.tts_stt import check_kokoro, check_piper, check_pyttsx3, get_whisper_model

router = APIRouter(tags=["system"])


# ─── GPU / RAM detection ──────────────────────────────────────────────────────

def _detect_gpu() -> tuple:
    """Detect GPU and return (has_gpu, vram_mb)."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=3,
        )
        if result.returncode == 0:
            vram = int(result.stdout.strip().split("\n")[0])
            return True, vram
    except Exception:
        pass
    return False, 0


def _detect_ram_mb() -> int:
    """Detect available system RAM in MB."""
    try:
        import psutil
        return int(psutil.virtual_memory().total / (1024 * 1024))
    except Exception:
        pass
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    return int(line.split()[1]) // 1024
    except Exception:
        pass
    return 0


# ─── llama.cpp server helpers ─────────────────────────────────────────────────

async def _wait_for_server(url: str, timeout: int = 15) -> bool:
    """Wait for a server to respond at url. Returns True if up."""
    for _ in range(timeout):
        await asyncio.sleep(1)
        try:
            async with httpx.AsyncClient(timeout=2) as c:
                r = await c.get(url)
                if r.status_code == 200:
                    return True
        except Exception:
            pass
    return False


async def _auto_start_llama_server(gguf_path: Path) -> bool:
    """Start llama.cpp server using llama-cpp-python (pip) or standalone binary."""
    import sys

    port = 8070
    has_gpu, vram = _detect_gpu()
    ctx = 4096 if has_gpu and vram >= 6000 else 2048
    gpu_layers = "-1" if has_gpu else "0"

    # Strategy 1: llama-cpp-python (embedded via pip)
    try:
        import llama_cpp  # noqa: F401
        python_bin = sys.executable
        cmd = [
            python_bin, "-m", "llama_cpp.server",
            "--model", str(gguf_path),
            "--port", str(port),
            "--host", "0.0.0.0",
            "--n_ctx", str(ctx),
            "--n_gpu_layers", gpu_layers,
        ]
        print(f"[LLM] Iniciando llama-cpp-python server com {gguf_path.name} (porta {port})...")
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        if await _wait_for_server(f"http://localhost:{port}/v1/models"):
            cfg.BACKEND = "llama.cpp"
            cfg.LLAMA_CPP_URL = f"http://localhost:{port}"
            cfg._resolve_all_models([gguf_path.stem])
            print(f"[LLM] Backend: llama-cpp-python ({gguf_path.name})")
            return True

        print("[LLM] llama-cpp-python server nao iniciou a tempo.")
    except ImportError:
        print("[LLM] llama-cpp-python nao instalado, tentando binario standalone...")
    except Exception as e:
        print(f"[LLM] Erro llama-cpp-python: {e}")

    # Strategy 2: Standalone llama-server binary
    server_bin = None
    for name in ["llama-server", "llama-server.exe"]:
        candidate = Path("runtime/llama") / name
        if candidate.exists():
            server_bin = str(candidate)
            break
    if not server_bin:
        server_bin = shutil.which("llama-server") or shutil.which("llama-cpp-server")

    if not server_bin:
        print(f"[LLM] GGUF encontrado ({gguf_path.name}) mas nenhum servidor llama disponivel.")
        print("[LLM] Instale: pip install llama-cpp-python")
        return False

    try:
        cmd = [server_bin, "-m", str(gguf_path), "--port", str(port), "-c", str(ctx),
               "--host", "0.0.0.0", "-ngl", gpu_layers]
        print(f"[LLM] Iniciando llama-server binario com {gguf_path.name} (porta {port})...")
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        if await _wait_for_server(f"http://localhost:{port}/v1/models"):
            cfg.BACKEND = "llama.cpp"
            cfg.LLAMA_CPP_URL = f"http://localhost:{port}"
            cfg._resolve_all_models([gguf_path.stem])
            print(f"[LLM] Backend: llama-server binario ({gguf_path.name})")
            return True

        print("[LLM] llama-server binario nao iniciou a tempo.")
    except Exception as e:
        print(f"[LLM] Erro llama-server binario: {e}")

    return False


async def _auto_pull_base_model():
    """Auto-pull a base model if Ollama is running but has no models."""
    has_gpu, vram = _detect_gpu()

    if has_gpu and vram >= 6000:
        model = "dolphin3:8b"
    elif has_gpu and vram >= 4000:
        model = "dolphin3:latest"
    elif has_gpu and vram >= 2000:
        model = "dolphin-phi:2.7b"
    else:
        model = "dolphin-phi:2.7b"

    print(f"[LLM] Nenhum modelo. Baixando modelo base: {model} (GPU: {f'{vram}MB' if has_gpu else 'nao'})...")

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(3600.0)) as c:
            async with c.stream("POST", f"{cfg.OLLAMA_BASE}/api/pull",
                                json={"name": model, "stream": True}) as resp:
                last_pct = -1
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        total = data.get("total", 0)
                        completed = data.get("completed", 0)
                        if total > 0:
                            pct = int(completed * 100 / total)
                            if pct != last_pct and pct % 10 == 0:
                                print(f"[LLM] Baixando {model}: {pct}%")
                                last_pct = pct
                        if data.get("status") == "success":
                            print(f"[LLM] Modelo {model} baixado com sucesso!")
                            r2 = await c.get(f"{cfg.OLLAMA_BASE}/api/tags")
                            names = [m["name"] for m in r2.json().get("models", [])]
                            cfg._resolve_all_models(names)
                    except (json.JSONDecodeError, KeyError):
                        pass
    except Exception as e:
        print(f"[LLM] Erro ao baixar modelo base: {e}")


async def _auto_download_gguf():
    """Auto-download a GGUF model when no Ollama and no local models exist."""
    import urllib.request

    has_gpu, vram = _detect_gpu()
    ram_mb = _detect_ram_mb()

    await asyncio.sleep(1)

    if ram_mb > 0 and ram_mb < 2000:
        target_id = "qwen25-0.5b-emergency"
        print(f"[LLM] RAM muito baixa ({ram_mb}MB) — usando modelo de emergencia")
    elif ram_mb > 0 and ram_mb < 3000:
        target_id = "qwen25-1.5b-cpu"
        print(f"[LLM] RAM baixa ({ram_mb}MB) — usando modelo leve")
    elif has_gpu and vram >= 6000 and ram_mb >= 8000:
        target_id = "dolphin-8b-gpu"
    elif has_gpu and vram >= 3000:
        target_id = "dolphin3-3b-uncensored"
    else:
        target_id = "dolphin3-3b-uncensored"

    model = next((m for m in cfg.GGUF_REGISTRY if m["id"] == target_id), None)
    if not model:
        print("[LLM] Nenhum modelo no registro GGUF.")
        return

    filepath = cfg.MODELS_DIR / model["filename"]
    if filepath.exists() and filepath.stat().st_size > model["size_gb"] * 0.9 * 1024**3:
        print(f"[LLM] GGUF ja existe: {filepath.name}")
        await _auto_start_llama_server(filepath)
        return

    print(f"[LLM] Baixando modelo GGUF: {model['name']} ({model['size_gb']} GB)...")
    print(f"[LLM] Hardware: GPU={'sim ' + str(vram) + 'MB' if has_gpu else 'nao'}")
    cfg._auto_download_status = {
        "status": "downloading",
        "model": model["name"],
        "model_id": target_id,
        "percent": 0,
        "size_gb": model["size_gb"],
    }

    try:
        req = urllib.request.Request(model["url"], headers={"User-Agent": "BunkerAI/4.0"})
        with urllib.request.urlopen(req, timeout=3600) as resp:
            total = int(resp.headers.get("Content-Length", 0))
            downloaded = 0
            chunk_size = 1024 * 512

            with open(filepath, "wb") as f:
                last_pct = -1
                while True:
                    chunk = resp.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = int(downloaded * 100 / total)
                        cfg._auto_download_status["percent"] = pct
                        if pct != last_pct and pct % 10 == 0:
                            print(f"[LLM] Baixando GGUF: {pct}%")
                            last_pct = pct

        print(f"[LLM] GGUF {model['name']} baixado com sucesso!")
        cfg._auto_download_status = {"status": "complete", "model": model["name"], "percent": 100}
        await _auto_start_llama_server(filepath)

    except Exception as e:
        print(f"[LLM] Erro ao baixar GGUF: {e}")
        cfg._auto_download_status = {"status": "error", "model": model["name"], "error": str(e)}
        if filepath.exists() and filepath.stat().st_size < 1000:
            filepath.unlink()


# ─── Startup: backend detection ───────────────────────────────────────────────

async def detect_backend():
    """Auto-detect LLM backend: Ollama or llama.cpp."""
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{cfg.OLLAMA_BASE}/api/tags")
            if r.status_code == 200:
                models = r.json().get("models", [])
                names = [m["name"] for m in models]
                cfg.BACKEND = "ollama"
                print(f"[LLM] Backend: Ollama ({len(names)} modelos)")
                if names:
                    cfg._resolve_all_models(names)
                else:
                    asyncio.create_task(_auto_pull_base_model())
                return
    except Exception:
        pass

    llama_urls = [cfg.LLAMA_CPP_URL] if cfg.LLAMA_CPP_URL else ["http://localhost:8070", "http://localhost:8080"]
    for url in llama_urls:
        if not url:
            continue
        try:
            async with httpx.AsyncClient(timeout=3) as c:
                r = await c.get(f"{url}/v1/models")
                if r.status_code == 200:
                    cfg.BACKEND = "llama.cpp"
                    cfg.LLAMA_CPP_URL = url
                    data = r.json()
                    mods = data.get("data", [])
                    names = [m.get("id", cfg.LLAMA_CPP_MODEL) for m in mods] if mods else [cfg.LLAMA_CPP_MODEL]
                    cfg._resolve_all_models(names)
                    print(f"[LLM] Backend: llama.cpp em {url}")
                    return
        except Exception:
            pass

    gguf_files = sorted(Path("models").glob("*.gguf")) if Path("models").exists() else []
    if gguf_files:
        started = await _auto_start_llama_server(gguf_files[0])
        if started:
            return

    print("[LLM] Nenhum backend LLM detectado.")
    cfg.BACKEND = "none"
    asyncio.create_task(_auto_download_gguf())


# ─── Config endpoints ─────────────────────────────────────────────────────────

@router.post("/api/config/offline")
async def set_offline_mode(request: Request):
    """Toggle offline mode."""
    body = await request.json()
    cfg.OFFLINE_MODE = bool(body.get("offline", False))
    print(f"[CONFIG] Offline mode: {'ON' if cfg.OFFLINE_MODE else 'OFF'}")
    return {"offline": cfg.OFFLINE_MODE}


@router.get("/api/config/offline")
async def get_offline_mode():
    return {"offline": cfg.OFFLINE_MODE}


# ─── Health ───────────────────────────────────────────────────────────────────

@router.get("/api/health")
async def health():
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
    for model_id, info in cfg.PIPER_MODELS.items():
        onnx = cfg.VOICE_MODELS_DIR / f"{model_id}.onnx"
        piper_models_status[model_id] = {
            **info,
            "downloaded": onnx.exists() and onnx.stat().st_size > 1000,
        }

    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{cfg.OLLAMA_BASE}/api/tags")
            models = r.json().get("models", [])
            names = [m["name"] for m in models]
            vision = [n for n in names if any(v in n.lower() for v in [
                "llava", "bakllava", "gemma3", "moondream", "minicpm",
                "llama3.2-vision", "granite3", "granite-vision"
            ])]
            cfg.BACKEND = "ollama"
            if names:
                cfg._resolve_all_models(names)
            return {
                "status": "online",
                "backend": "ollama",
                "ollama": cfg.OLLAMA_BASE,
                "models": names,
                "vision_models": vision,
                "auto_models": dict(cfg._auto_models),
                "stt": "whisper" if whisper_ok else "browser",
                "tts": tts_engine,
                "stt_ready": whisper_ok,
                "tts_offline": kokoro_ok or piper_ok or pyttsx3_ok,
                "kokoro_available": kokoro_ok,
                "piper_available": piper_ok,
                "pyttsx3_available": pyttsx3_ok,
                "piper_models": piper_models_status,
                "offline_mode": cfg.OFFLINE_MODE,
            }
    except Exception:
        pass

    if cfg.LLAMA_CPP_URL:
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.get(f"{cfg.LLAMA_CPP_URL}/v1/models")
                data = r.json()
                models = data.get("data", [])
                names = [m.get("id", cfg.LLAMA_CPP_MODEL) for m in models] if models else [cfg.LLAMA_CPP_MODEL]
                cfg.BACKEND = "llama.cpp"
                return {
                    "status": "online",
                    "backend": "llama.cpp",
                    "ollama": cfg.LLAMA_CPP_URL,
                    "models": names,
                    "vision_models": [],
                    "stt": "whisper" if whisper_ok else "browser",
                    "tts": tts_engine,
                    "stt_ready": whisper_ok,
                    "tts_offline": kokoro_ok or piper_ok or pyttsx3_ok,
                    "kokoro_available": kokoro_ok,
                    "piper_available": piper_ok,
                    "pyttsx3_available": pyttsx3_ok,
                    "piper_models": piper_models_status,
                    "portable": True,
                }
        except Exception:
            pass

    return {
        "status": "offline",
        "backend": "none",
        "models": [],
        "vision_models": [],
        "auto_download": dict(cfg._auto_download_status) if cfg._auto_download_status else None,
        "stt": "browser",
        "tts": tts_engine,
        "stt_ready": False,
        "tts_offline": kokoro_ok or piper_ok or pyttsx3_ok,
        "kokoro_available": kokoro_ok,
        "piper_available": piper_ok,
        "pyttsx3_available": pyttsx3_ok,
        "piper_models": piper_models_status,
        "offline_mode": cfg.OFFLINE_MODE,
    }


# ─── Model management ─────────────────────────────────────────────────────────

_MODEL_NAME_RE = re.compile(r'^[a-zA-Z0-9_.:\-/]+$')
_MODEL_NAME_TRAVERSAL_RE = re.compile(r'\.\.')

@router.post("/api/models/pull")
async def pull_model(request: Request):
    body = await request.json()
    model = body.get("model", "").strip()

    if not model:
        return JSONResponse({"error": "model name required"}, status_code=400)
    if not _MODEL_NAME_RE.match(model) or _MODEL_NAME_TRAVERSAL_RE.search(model):
        return JSONResponse({"error": "Invalid model name. Only letters, numbers, :._-/ allowed (no ..)."}, status_code=400)
    if len(model) > 200:
        return JSONResponse({"error": "Model name too long"}, status_code=400)

    async def generate():
        async with httpx.AsyncClient(timeout=httpx.Timeout(3600.0)) as c:
            async with c.stream("POST", f"{cfg.OLLAMA_BASE}/api/pull", json={"name": model, "stream": True}) as resp:
                async for line in resp.aiter_lines():
                    if line.strip():
                        yield f"data: {line}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/api/models/recommended")
async def recommended_models():
    """Return recommended models based on detected hardware."""
    has_gpu = False
    gpu_vram = 0
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            has_gpu = True
            gpu_vram = int(result.stdout.strip().split("\n")[0]) // 1024
    except Exception:
        pass

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
        "backend": cfg.BACKEND,
        "models": models,
    }


@router.get("/api/models/local")
async def list_local_models():
    """List locally downloaded GGUF models + their status."""
    result = []
    for model in cfg.GGUF_REGISTRY:
        filepath = cfg.MODELS_DIR / model["filename"]
        downloaded = filepath.exists()
        size_on_disk = filepath.stat().st_size if downloaded else 0
        expected_size = int(model["size_gb"] * 1024 * 1024 * 1024)
        complete = downloaded and size_on_disk > expected_size * 0.9

        result.append({
            **model,
            "downloaded": complete,
            "partial": downloaded and not complete,
            "size_on_disk": size_on_disk,
            "path": model["filename"] if complete else None,
            "downloading": model["id"] in cfg._active_downloads,
        })

    known_files = {m["filename"] for m in cfg.GGUF_REGISTRY}
    for f in cfg.MODELS_DIR.glob("*.gguf"):
        if f.name not in known_files:
            result.append({
                "id": f.stem,
                "name": f.stem,
                "filename": f.name,
                "size_gb": round(f.stat().st_size / (1024**3), 1),
                "type": "unknown",
                "desc": "Modelo GGUF adicionado manualmente",
                "uncensored": False,
                "tags": ["custom"],
                "downloaded": True,
                "partial": False,
                "size_on_disk": f.stat().st_size,
                "path": f.name,
                "downloading": False,
            })

    return {"models": result, "models_dir": str(cfg.MODELS_DIR)}


@router.post("/api/models/local/download")
async def download_local_model(request: Request, background_tasks: BackgroundTasks):
    """Start downloading a GGUF model in the background."""
    body = await request.json()
    model_id = body.get("model_id", "")

    model = next((m for m in cfg.GGUF_REGISTRY if m["id"] == model_id), None)
    if not model:
        return JSONResponse({"error": f"Modelo '{model_id}' nao encontrado"}, 404)

    filepath = cfg.MODELS_DIR / model["filename"]
    if filepath.exists() and filepath.stat().st_size > model["size_gb"] * 0.9 * 1024**3:
        return {"status": "already_downloaded", "path": str(filepath)}

    if model_id in cfg._active_downloads:
        return {"status": "already_downloading", "progress": cfg._active_downloads[model_id]}

    cfg._active_downloads[model_id] = {"percent": 0, "downloaded": 0, "total": 0, "speed": ""}
    background_tasks.add_task(_download_gguf, model)
    return {"status": "started", "model_id": model_id}


@router.get("/api/models/local/progress/{model_id}")
async def download_progress(model_id: str):
    """Check download progress for a model."""
    if model_id in cfg._active_downloads:
        return {"status": "downloading", **cfg._active_downloads[model_id]}

    model = next((m for m in cfg.GGUF_REGISTRY if m["id"] == model_id), None)
    if model:
        filepath = cfg.MODELS_DIR / model["filename"]
        if filepath.exists() and filepath.stat().st_size > model["size_gb"] * 0.9 * 1024**3:
            return {"status": "complete", "percent": 100}

    return {"status": "idle", "percent": 0}


async def _download_gguf(model: dict):
    """Background task to download a GGUF model."""
    import urllib.request

    filepath = cfg.MODELS_DIR / model["filename"]
    model_id = model["id"]
    url = model["url"]

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BunkerAI/4.0"})
        with urllib.request.urlopen(req, timeout=3600) as resp:
            total = int(resp.headers.get("Content-Length", 0))
            cfg._active_downloads[model_id]["total"] = total
            downloaded = 0
            chunk_size = 1024 * 512

            with open(filepath, "wb") as f:
                last_time = time.time()
                last_bytes = 0
                while True:
                    chunk = resp.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)

                    now = time.time()
                    elapsed = now - last_time
                    if elapsed > 0.5:
                        speed = (downloaded - last_bytes) / elapsed
                        speed_str = f"{speed / (1024*1024):.1f} MB/s" if speed > 1024*1024 else f"{speed / 1024:.0f} KB/s"
                        cfg._active_downloads[model_id].update({
                            "percent": round(downloaded / total * 100, 1) if total else 0,
                            "downloaded": downloaded,
                            "speed": speed_str,
                        })
                        last_time = now
                        last_bytes = downloaded

        cfg._active_downloads[model_id]["percent"] = 100
        print(f"[MODEL] {model['name']} downloaded: {filepath}")
    except Exception as e:
        cfg._active_downloads[model_id]["error"] = str(e)
        print(f"[MODEL] Download failed for {model['name']}: {e}")
        if filepath.exists() and filepath.stat().st_size < 1000:
            filepath.unlink()
    finally:
        await asyncio.sleep(30)
        cfg._active_downloads.pop(model_id, None)


@router.delete("/api/models/local/{model_id}")
async def delete_local_model(model_id: str):
    """Delete a locally downloaded GGUF model."""
    model = next((m for m in cfg.GGUF_REGISTRY if m["id"] == model_id), None)
    if not model:
        return JSONResponse({"error": "Modelo nao encontrado"}, 404)

    filepath = cfg.MODELS_DIR / model["filename"]
    if filepath.exists():
        filepath.unlink()
        return {"status": "deleted", "model_id": model_id}
    return {"status": "not_found"}


# ─── Setup / Status ───────────────────────────────────────────────────────────

@router.get("/api/setup/status")
async def setup_status():
    """Report what offline content has been downloaded."""
    return {
        "setup_complete": (cfg.DATA_DIR / ".setup_complete").exists(),
        "guides": len(list(cfg.GUIDES_DIR.glob("*.md"))),
        "protocols": len([f for f in cfg.PROTOCOLS_DIR.glob("*.json") if f.name != "_index.json"]),
        "books": len(list(cfg.BOOKS_DIR.glob("*.epub"))),
        "games": len(list(cfg.GAMES_DIR.glob("*.html"))),
        "zim_files": len(list((cfg.DATA_DIR / "zim").glob("*.zim"))),
        "maps": len(list(cfg.MAPS_DIR.glob("*.pmtiles"))),
        "kiwix_binary": (Path("tools") / "kiwix-serve.exe").exists() or shutil.which("kiwix-serve") is not None,
        "db_exists": cfg.DB_PATH.exists(),
    }


@router.get("/api/status")
async def system_status():
    """System health: CPU, RAM, disk, IP, uptime, server info."""
    uptime_sec = int(time.time() - cfg.SERVER_START_TIME)

    ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    cpu_pct = ram_pct = ram_used_mb = ram_total_mb = None
    disk_pct = disk_free_gb = disk_total_gb = None
    cpu_count = None
    net_ok = False
    gpu_name = None
    try:
        import psutil
        try:
            cpu_pct = psutil.cpu_percent(interval=0.1)
        except Exception:
            pass
        try:
            cpu_count = psutil.cpu_count(logical=True)
        except Exception:
            pass
        try:
            vm = psutil.virtual_memory()
            ram_pct = round(vm.percent, 1)
            ram_used_mb = round(vm.used / 1024 / 1024)
            ram_total_mb = round(vm.total / 1024 / 1024)
        except Exception:
            pass
        try:
            d = psutil.disk_usage(str(Path.cwd()))
            disk_pct = round(d.percent, 1)
            disk_free_gb = round(d.free / 1024 / 1024 / 1024, 1)
            disk_total_gb = round(d.total / 1024 / 1024 / 1024, 1)
        except Exception:
            pass
    except ImportError:
        pass

    try:
        s = socket.create_connection(("8.8.8.8", 53), timeout=2)
        s.close()
        net_ok = True
    except Exception:
        net_ok = False

    try:
        r = subprocess.run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                          capture_output=True, text=True, timeout=3)
        if r.returncode == 0 and r.stdout.strip():
            gpu_name = r.stdout.strip().split("\n")[0]
    except Exception:
        pass

    content = {
        "guides": len(list(cfg.GUIDES_DIR.glob("*.md"))),
        "protocols": len([f for f in cfg.PROTOCOLS_DIR.glob("*.json") if f.name != "_index.json"]),
        "books": len(list(cfg.BOOKS_DIR.glob("*.epub"))),
        "games": len(list(cfg.GAMES_DIR.glob("*.html"))),
        "zim_files": len(list((cfg.DATA_DIR / "zim").glob("*.zim"))),
        "maps": len(list(cfg.MAPS_DIR.glob("*.pmtiles"))),
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
        "offline_mode": cfg.OFFLINE_MODE,
        "content": content,
        "server_time": datetime.now().isoformat(),
    }


# ─── Terminal ─────────────────────────────────────────────────────────────────

@router.post("/api/terminal")
async def terminal_exec(request: Request):
    if cfg._check_rate_limit("terminal", request.client.host if request.client else "local"):
        return JSONResponse({"output": "bunker-sh: limite de taxa excedido. Aguarde.", "exit_code": 1}, status_code=429)
    body = await request.json()
    cmd = body.get("command", "").strip()
    if not cmd:
        return {"output": "", "exit_code": 0}
    if len(cmd) > 1000:
        return {"output": "bunker-sh: comando muito longo (max 1000 chars)", "exit_code": 1}

    # Parse command into tokens (no shell=True to prevent injection via ;, &&, |, $(), etc.)
    import shlex
    try:
        args = shlex.split(cmd)
    except ValueError as e:
        return {"output": f"bunker-sh: erro de parse: {e}", "exit_code": 1}

    if not args:
        return {"output": "", "exit_code": 0}

    base_cmd = Path(args[0]).name.lower()
    if base_cmd.endswith(".exe"):
        base_cmd = base_cmd[:-4]

    if base_cmd not in cfg.TERMINAL_ALLOWED_CMDS:
        return {"output": f"bunker-sh: {base_cmd}: comando nao permitido\nComandos permitidos: {', '.join(sorted(cfg.TERMINAL_ALLOWED_CMDS))}", "exit_code": 1}

    # Reject any argument containing shell metacharacters.
    # Even with shell=False these chars can confuse some programs or indicate
    # an injection attempt; rejecting them early is the safest approach.
    _SHELL_META_RE = re.compile(r'[;|&$`<>(){}\\]')
    for arg in args[1:]:
        if _SHELL_META_RE.search(arg):
            return {"output": f"bunker-sh: argumento invalido contendo metacaracter de shell", "exit_code": 1}

    # Resolve the actual binary path to prevent path-traversal bypasses
    binary = shutil.which(args[0]) or args[0]
    exec_args = [binary] + args[1:]

    try:
        result = subprocess.run(
            exec_args, shell=False, capture_output=True, text=True,
            timeout=15, cwd=str(Path.cwd()),
        )
        output = result.stdout + result.stderr
        return {"output": output.rstrip(), "exit_code": result.returncode}
    except FileNotFoundError:
        return {"output": f"bunker-sh: {base_cmd}: comando nao encontrado", "exit_code": 127}
    except subprocess.TimeoutExpired:
        return {"output": "bunker-sh: tempo limite excedido (15s)", "exit_code": 124}
    except Exception as e:
        return {"output": f"bunker-sh: erro interno", "exit_code": 1}


# ─── Image generation ─────────────────────────────────────────────────────────

@router.get("/api/imagine/status")
async def imagine_status():
    """Check if sd-server is running and reachable."""
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get(f"{cfg.SD_SERVER_URL}/")
            return {"available": resp.status_code == 200, "url": cfg.SD_SERVER_URL}
    except Exception:
        return {"available": False, "url": cfg.SD_SERVER_URL}


@router.post("/api/imagine/generate")
async def imagine_generate(request: Request):
    """Generate an image via sd-server and return it."""
    body = await request.json()
    prompt = body.get("prompt", "")
    steps = int(body.get("steps", 20))
    width = int(body.get("width", 512))
    height = int(body.get("height", 512))
    cfg_scale = float(body.get("cfg_scale", 7.0))

    if not prompt:
        return JSONResponse({"error": "prompt is required"}, status_code=400)

    if steps <= 1:
        cfg_scale = 0.0

    try:
        payload = {
            "prompt": prompt,
            "steps": steps,
            "width": width,
            "height": height,
            "cfg_scale": cfg_scale,
        }
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{cfg.SD_SERVER_URL}/v1/images/generations", json=payload)
            if resp.status_code != 200:
                return JSONResponse({"error": f"sd-server error: {resp.status_code}"}, status_code=502)

            data = resp.json()
            if "data" in data and len(data["data"]) > 0:
                img_b64 = data["data"][0].get("b64_json", "")
                if img_b64:
                    import base64
                    img_bytes = base64.b64decode(img_b64)
                    fname = f"img_{int(time.time())}_{hash(prompt) & 0xFFFF:04x}.png"
                    fpath = cfg.GENERATED_IMAGES_DIR / fname
                    fpath.write_bytes(img_bytes)
                    return {"image": f"/api/imagine/view/{fname}", "filename": fname}

            return JSONResponse({"error": "No image data in response"}, status_code=502)
    except httpx.ConnectError:
        return JSONResponse({
            "error": "sd-server não está rodando. Inicie com: sd-server -m modelo.gguf --listen-port 7860"
        }, status_code=503)
    except Exception as e:
        print(f"[IMAGINE] generate error: {e}")
        return JSONResponse({"error": "Erro ao gerar imagem"}, status_code=500)


@router.get("/api/imagine/view/{filename}")
async def imagine_view(filename: str):
    """Serve a generated image."""
    safe = Path(filename).name
    fpath = cfg.GENERATED_IMAGES_DIR / safe
    if not fpath.exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(fpath, media_type="image/png")


@router.get("/api/imagine/history")
async def imagine_history():
    """List previously generated images."""
    images = []
    if cfg.GENERATED_IMAGES_DIR.exists():
        for f in sorted(cfg.GENERATED_IMAGES_DIR.glob("*.png"), key=lambda x: x.stat().st_mtime, reverse=True):
            images.append({
                "filename": f.name,
                "url": f"/api/imagine/view/{f.name}",
                "size_kb": f.stat().st_size // 1024,
            })
    return {"images": images[:50]}
