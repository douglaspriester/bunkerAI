#!/usr/bin/env python3
"""
build_portable.py — Monta o pacote portátil do Bunker AI para pendrive.

Baixa automaticamente:
  - Python embeddable (Windows)
  - llama-server (llama.cpp)
  - Modelo GGUF built-in (Qwen2.5-1.5B-Instruct, ~1GB, roda em CPU)
  - Dependências pip (offline wheel cache)

Uso:
  python build_portable.py [--output PASTA] [--model URL_GGUF] [--skip-model]

Resultado:
  Uma pasta pronta pra copiar pro pendrive com INICIAR.bat na raiz.

DON'T PANIC.
"""

import argparse
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────

PYTHON_VERSION = "3.11.9"
PYTHON_EMBED_URL = f"https://www.python.org/ftp/python/{PYTHON_VERSION}/python-{PYTHON_VERSION}-embed-amd64.zip"

# llama.cpp releases — usando b5200 (estável)
LLAMA_CPP_VERSION = "b5200"
LLAMA_CPP_URLS = {
    "windows": f"https://github.com/ggml-org/llama.cpp/releases/download/{LLAMA_CPP_VERSION}/llama-{LLAMA_CPP_VERSION}-bin-win-cpu-x64.zip",
    "linux": f"https://github.com/ggml-org/llama.cpp/releases/download/{LLAMA_CPP_VERSION}/llama-{LLAMA_CPP_VERSION}-bin-ubuntu-x64.zip",
}

# ─── Modelos built-in (UNCENSORED por padrao) ────────────────────────────────
# Filosofia: Em cenarios de sobrevivencia, censura pode custar vidas.
# Todos os modelos built-in sao uncensored ou sem filtros de seguranca.
#
# Tres modelos embutidos:
#   1. CPU: Dolphin-2.9.4-Llama3.1-1B Q4_K_M (~0.8 GB) — uncensored, roda em qualquer PC
#   2. GPU: Dolphin-2.9.4-Llama3.1-8B Q4_K_M (~4.9 GB) — uncensored, texto completo
#   3. GPU: Gemma-3-4B-Instruct Q4_K_M (~3.0 GB) — multimodal (texto + visao)
#
# O launcher detecta se tem GPU e escolhe o melhor automaticamente.
# O usuario pode baixar modelos maiores depois pelo app se tiver internet.

BUILTIN_MODELS = [
    {
        "name": "CPU — Dolphin 1B (uncensored)",
        "filename": "dolphin-2.9.4-llama3.1-1b-Q4_K_M.gguf",
        "url": "https://huggingface.co/bartowski/dolphin-2.9.4-llama3.1-1b-GGUF/resolve/main/dolphin-2.9.4-llama3.1-1b-Q4_K_M.gguf",
        "size_gb": 0.8,
        "type": "cpu",
        "desc": "Modelo leve uncensored para CPU. Roda em qualquer PC.",
        "uncensored": True,
    },
    {
        "name": "GPU — Dolphin 8B (uncensored)",
        "filename": "dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf",
        "url": "https://huggingface.co/bartowski/dolphin-2.9.4-llama3.1-8b-GGUF/resolve/main/dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf",
        "size_gb": 4.9,
        "type": "gpu",
        "desc": "Modelo principal uncensored. GPU com 6GB+ VRAM.",
        "uncensored": True,
    },
    {
        "name": "GPU — Gemma 3 4B (texto + visao)",
        "filename": "gemma-3-4b-it-Q4_K_M.gguf",
        "url": "https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q4_K_M.gguf",
        "size_gb": 3.0,
        "type": "gpu",
        "desc": "Modelo multimodal com visao. GPU com 4GB+ VRAM.",
        "uncensored": False,
    },
]

# Pacotes pip necessários (sem os opcionais pesados como whisper/pyttsx3)
PIP_PACKAGES = [
    "fastapi==0.115.0",
    "uvicorn==0.30.6",
    "httpx==0.27.2",
    "python-multipart==0.0.9",
    "psutil>=5.9.0",
]

ROOT = Path(__file__).resolve().parent

# ── ANSI helpers ──────────────────────────────────────────────────────────────

_COLOR = hasattr(sys.stdout, "isatty") and sys.stdout.isatty()
def _c(code, text): return f"\033[{code}m{text}\033[0m" if _COLOR else text
def green(t):  return _c("32", t)
def yellow(t): return _c("33", t)
def cyan(t):   return _c("36", t)
def bold(t):   return _c("1", t)
def info(msg): print(f"  {green('[OK]')}  {msg}")
def warn(msg): print(f"  {yellow('[!!]')}  {msg}")
def step(msg): print(f"\n{bold(cyan('>>>'))} {bold(msg)}")


# ── Download helper ───────────────────────────────────────────────────────────

def download(url: str, dest: Path, desc: str = ""):
    """Download with progress."""
    label = desc or dest.name
    print(f"  [DL] {label}...", end="", flush=True)

    req = urllib.request.Request(url, headers={"User-Agent": "BunkerAI-Builder/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            total = int(resp.headers.get("Content-Length", 0))
            data = bytearray()
            chunk_size = 1024 * 256
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                data.extend(chunk)
                if total:
                    pct = len(data) * 100 // total
                    mb = len(data) / 1048576
                    print(f"\r  [DL] {label}... {pct}% ({mb:.1f} MB)", end="", flush=True)

            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            mb = len(data) / 1048576
            print(f"\r  {green('[OK]')}  {label} ({mb:.1f} MB)")
            return True
    except Exception as e:
        print(f"\r  {yellow('[!!]')}  {label} — erro: {e}")
        return False


def extract_zip(zip_path: Path, dest_dir: Path):
    """Extract zip to directory."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(dest_dir)


# ── Build steps ───────────────────────────────────────────────────────────────

def build_portable(output_dir: Path, skip_model: bool = False, cpu_only: bool = False):
    """Assemble the portable package."""

    print()
    print(bold("  ╔══════════════════════════════════════════════════╗"))
    print(bold("  ║   BUNKER AI — Build Portátil para Pendrive      ║"))
    print(bold("  ║   DON'T PANIC                                   ║"))
    print(bold("  ╚══════════════════════════════════════════════════╝"))
    print()

    os_name = "windows" if platform.system() == "Windows" else "linux"

    if output_dir.exists():
        print(f"  Pasta de saida ja existe: {output_dir}")
        print(f"  Limpando...")
        shutil.rmtree(output_dir)

    output_dir.mkdir(parents=True, exist_ok=True)
    runtime_dir = output_dir / "runtime"
    runtime_dir.mkdir(exist_ok=True)
    tmp_dir = output_dir / "_tmp"
    tmp_dir.mkdir(exist_ok=True)

    # ─── 1. Python embeddable ────────────────────────────────────────────────
    step("1/5 — Python embeddable")

    if os_name == "windows":
        python_zip = tmp_dir / "python-embed.zip"
        python_dir = runtime_dir / "python"
        if download(PYTHON_EMBED_URL, python_zip, f"Python {PYTHON_VERSION} embeddable"):
            extract_zip(python_zip, python_dir)

            # Enable pip in embedded Python: uncomment 'import site' in python3XX._pth
            pth_files = list(python_dir.glob("python*._pth"))
            for pth in pth_files:
                content = pth.read_text()
                content = content.replace("#import site", "import site")
                pth.write_text(content)

            # Install pip
            get_pip = tmp_dir / "get-pip.py"
            download("https://bootstrap.pypa.io/get-pip.py", get_pip, "get-pip.py")
            python_exe = python_dir / "python.exe"
            subprocess.run([str(python_exe), str(get_pip), "--no-warn-script-location"],
                          capture_output=True, cwd=str(python_dir))

            # Install core packages
            step("  Instalando pacotes pip...")
            pip_exe = python_dir / "Scripts" / "pip.exe"
            if pip_exe.exists():
                for pkg in PIP_PACKAGES:
                    subprocess.run(
                        [str(pip_exe), "install", "--no-warn-script-location", pkg],
                        capture_output=True,
                    )
                    info(f"  {pkg}")
            else:
                warn("pip nao instalado — pacotes serao instalados na primeira execucao")
        else:
            warn("Falha ao baixar Python embeddable")
    else:
        info("Linux: usando Python do sistema (python3)")

    # ─── 2. llama.cpp server ─────────────────────────────────────────────────
    step("2/5 — llama.cpp server")

    llama_url = LLAMA_CPP_URLS.get(os_name)
    if llama_url:
        llama_zip = tmp_dir / "llama-cpp.zip"
        llama_dir = runtime_dir / "llama"
        if download(llama_url, llama_zip, f"llama.cpp {LLAMA_CPP_VERSION}"):
            extract_zip(llama_zip, llama_dir)
            # Find the server binary
            server_names = ["llama-server.exe", "llama-server", "server.exe", "server"]
            found = False
            for root_dir, dirs, files in os.walk(str(llama_dir)):
                for sn in server_names:
                    if sn in files:
                        src = Path(root_dir) / sn
                        dst = llama_dir / sn
                        if src != dst:
                            shutil.copy2(src, dst)
                        found = True
                        info(f"llama-server encontrado: {sn}")
                        break
                if found:
                    break
            if not found:
                warn("llama-server nao encontrado no pacote — verifique manualmente")
        else:
            warn("Falha ao baixar llama.cpp")
    else:
        warn(f"Plataforma {os_name} nao suportada para download automatico")

    # ─── 3. Modelos GGUF ────────────────────────────────────────────────────
    step("3/5 — Modelos LLM built-in")

    models_dir = output_dir / "models"
    models_dir.mkdir(exist_ok=True)

    if skip_model:
        warn("Download de modelos pulado (--skip-model)")
        warn("Coloque arquivos .gguf em models/ manualmente")
    else:
        models_to_dl = BUILTIN_MODELS
        if cpu_only:
            models_to_dl = [m for m in BUILTIN_MODELS if m["type"] == "cpu"]
            info("Modo --cpu-only: baixando apenas modelo CPU")

        for model_info in models_to_dl:
            model_path = models_dir / model_info["filename"]
            label = f"{model_info['name']} (~{model_info['size_gb']:.0f} GB)"
            if not download(model_info["url"], model_path, label):
                warn(f"Falha ao baixar {model_info['filename']}")

    # Write model manifest for the launcher
    import json as _json
    manifest = {
        "builtin": [
            {"filename": m["filename"], "type": m["type"], "desc": m["desc"]}
            for m in BUILTIN_MODELS
        ],
        "recommended": [
            {"name": "dolphin3", "desc": "Chat uncensored (principal)", "size": "~5 GB", "requires": "GPU 6GB+", "uncensored": True},
            {"name": "dolphin-llama3.1:8b", "desc": "Chat uncensored avancado", "size": "~5 GB", "requires": "GPU 6GB+", "uncensored": True},
            {"name": "llava-llama3:8b", "desc": "Visao + Chat (multimodal)", "size": "~5 GB", "requires": "GPU 6GB+"},
            {"name": "qwen2.5-coder:7b", "desc": "App Builder / codigo", "size": "~5 GB", "requires": "GPU 6GB+"},
            {"name": "gemma3:12b", "desc": "Chat + Visao completo", "size": "~8 GB", "requires": "GPU 8GB+"},
        ],
    }
    (models_dir / "manifest.json").write_text(_json.dumps(manifest, indent=2, ensure_ascii=False))

    # ─── 4. Copiar app ──────────────────────────────────────────────────────
    step("4/5 — Copiando app Bunker AI")

    # Copy app files
    app_files = [
        "server.py", "setup_downloads.py", "requirements.txt",
    ]
    for f in app_files:
        src = ROOT / f
        if src.exists():
            shutil.copy2(src, output_dir / f)
            info(f)

    # Copy directories
    app_dirs = ["static", "data"]
    for d in app_dirs:
        src = ROOT / d
        if src.is_dir():
            shutil.copytree(src, output_dir / d, dirs_exist_ok=True,
                           ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".git"))
            info(f"{d}/")

    # Create required dirs
    for d in ["generated_apps", "tts_cache", "voice_models"]:
        (output_dir / d).mkdir(exist_ok=True)

    # ─── 5. Criar launchers ─────────────────────────────────────────────────
    step("5/5 — Criando launchers")

    # Write INICIAR.bat
    iniciar_bat = output_dir / "INICIAR.bat"
    iniciar_bat.write_text(_INICIAR_BAT, encoding="utf-8")
    info("INICIAR.bat")

    # Write INICIAR.sh
    iniciar_sh = output_dir / "INICIAR.sh"
    iniciar_sh.write_text(_INICIAR_SH, encoding="utf-8")
    info("INICIAR.sh")

    # Write portable config marker
    (output_dir / ".portable").write_text("bunker-ai-portable\n")

    # ─── Cleanup ────────────────────────────────────────────────────────────
    shutil.rmtree(tmp_dir, ignore_errors=True)

    # ─── Summary ────────────────────────────────────────────────────────────
    total_size = sum(f.stat().st_size for f in output_dir.rglob("*") if f.is_file())
    total_mb = total_size / 1048576

    print()
    print(bold("  ╔══════════════════════════════════════════════════╗"))
    print(bold(f"  ║   BUILD COMPLETO!                                ║"))
    print(bold("  ╚══════════════════════════════════════════════════╝"))
    print()
    print(f"  Pasta:    {output_dir.resolve()}")
    print(f"  Tamanho:  {total_mb:.0f} MB")
    print()
    print(f"  Para usar:")
    print(f"    1. Copie a pasta '{output_dir.name}' para o pendrive")
    print(f"    2. No PC destino, double-click em {bold('INICIAR.bat')}")
    print(f"    3. Abra o navegador em http://localhost:8888")
    print()
    dp = "DON'T PANIC"
    print(f"  {bold(dp)}")
    print()


# ── Launcher scripts ──────────────────────────────────────────────────────────

_INICIAR_BAT = r"""@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title Bunker AI — Modo Portavel

echo.
echo  ____              _               _    ___
echo ^| __ ) _   _ _ __ ^| ^| _____ _ __  ^/ ^|  ^|_ _^|
echo ^|  _ \^| ^| ^| ^| '_ \^| ^|/ / _ \ '__^| ^|  ^|   ^| ^|
echo ^| ^|_) ^| ^|_^| ^| ^| ^| ^|   ^<  __/ ^|    ^|  ^|   ^| ^|
echo ^|____/ \__,_^|_^| ^|_^|_^|\_\___^|_^|    ^|  ^|  ^|___^|
echo.
echo   MODO PORTAVEL — DON'T PANIC
echo.

REM ---- Ir para pasta do script ----
cd /d "%~dp0"

REM ---- Detectar Python ----
set "PYTHON_EXE="

REM Primeiro: Python embarcado
if exist "runtime\python\python.exe" (
    set "PYTHON_EXE=%~dp0runtime\python\python.exe"
    echo [OK] Python portavel encontrado
    goto :python_ok
)

REM Fallback: Python do sistema
where python >nul 2>&1
if !errorlevel! equ 0 (
    set "PYTHON_EXE=python"
    echo [OK] Python do sistema encontrado
    goto :python_ok
)

echo [ERRO] Python nao encontrado!
echo        O Python embarcado deveria estar em runtime\python\
echo        Ou instale Python 3.10+ do https://python.org
pause
exit /b 1

:python_ok

REM ---- Instalar deps se necessario ----
!PYTHON_EXE! -c "import fastapi" >nul 2>&1
if !errorlevel! neq 0 (
    echo [..] Instalando dependencias Python...
    !PYTHON_EXE! -m pip install -q -r requirements.txt 2>nul
)

REM ---- Detectar Ollama ----
set "USE_LLAMA_CPP=0"
curl -s http://localhost:11434/api/tags >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Ollama detectado — usando como backend
    goto :start_server
)

echo [--] Ollama nao encontrado — usando modelo embutido

REM ---- Detectar GPU ----
set "HAS_GPU=0"
set "MODEL_FILE="
nvidia-smi >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] GPU NVIDIA detectada!
    set "HAS_GPU=1"
    REM Prioridade: Dolphin 8B (uncensored GPU) > Gemma 4B (multimodal GPU)
    for %%f in (models\dolphin*8b*.gguf) do (
        if not defined MODEL_FILE (
            set "MODEL_FILE=%%f"
            echo [OK] Modelo GPU uncensored: %%~nxf
        )
    )
    if not defined MODEL_FILE (
        for %%f in (models\gemma*.gguf) do (
            set "MODEL_FILE=%%f"
            echo [OK] Modelo GPU multimodal: %%~nxf
        )
    )
)

REM Fallback: modelo CPU (Dolphin 1B uncensored)
if not defined MODEL_FILE (
    for %%f in (models\dolphin*1b*.gguf) do (
        if not defined MODEL_FILE (
            set "MODEL_FILE=%%f"
            echo [OK] Modelo CPU uncensored: %%~nxf
        )
    )
)
REM Last resort: any model
if not defined MODEL_FILE (
    for %%f in (models\*.gguf) do (
        if not defined MODEL_FILE (
            set "MODEL_FILE=%%f"
            echo [OK] Modelo: %%~nxf
        )
    )
)

if not defined MODEL_FILE (
    echo [ERRO] Nenhum modelo .gguf encontrado em models\
    echo        Coloque um modelo .gguf na pasta models\
    pause
    exit /b 1
)

REM ---- Configurar GPU/CPU para llama-server ----
set "LLAMA_EXTRA_ARGS="
if "!HAS_GPU!"=="1" (
    set "LLAMA_EXTRA_ARGS=-ngl 99"
    echo [OK] Usando GPU para aceleracao
) else (
    echo [--] Sem GPU — rodando em CPU (mais lento, mas funciona^)
)

REM ---- Encontrar llama-server ----
set "LLAMA_SERVER="
if exist "runtime\llama\llama-server.exe" set "LLAMA_SERVER=runtime\llama\llama-server.exe"
if not defined LLAMA_SERVER (
    for /r "runtime\llama" %%f in (llama-server.exe) do set "LLAMA_SERVER=%%f"
)

if not defined LLAMA_SERVER (
    echo [ERRO] llama-server.exe nao encontrado em runtime\llama\
    pause
    exit /b 1
)

REM ---- Iniciar llama-server ----
echo [..] Iniciando LLM local (pode demorar na primeira vez)...
set "LLAMA_PORT=8070"
start "" /b "!LLAMA_SERVER!" -m "!MODEL_FILE!" --port !LLAMA_PORT! --host 127.0.0.1 -c 4096 -np 1 !LLAMA_EXTRA_ARGS! >nul 2>&1

REM Aguardar llama-server ficar pronto
echo [..] Aguardando LLM carregar modelo...
set "RETRY=0"
:wait_llama
timeout /t 2 /nobreak >nul
curl -s http://127.0.0.1:!LLAMA_PORT!/v1/models >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] LLM pronto!
    goto :llama_ready
)
set /a RETRY+=1
if !RETRY! lss 30 (
    echo [..] Aguardando... (!RETRY!/30)
    goto :wait_llama
)
echo [!!] LLM demorou demais para iniciar. Continuando mesmo assim...

:llama_ready
set "USE_LLAMA_CPP=1"
set "LLAMA_CPP_URL=http://127.0.0.1:!LLAMA_PORT!"

:start_server

REM ---- Setup primeiro uso ----
if not exist "data\guides\_index.json" (
    if exist "setup_downloads.py" (
        echo [..] Configurando conteudo offline...
        !PYTHON_EXE! setup_downloads.py
    )
)

REM ---- Criar diretorios ----
if not exist "data\db" mkdir "data\db" 2>nul
if not exist "generated_apps" mkdir "generated_apps" 2>nul
if not exist "tts_cache" mkdir "tts_cache" 2>nul
if not exist "static\maps" mkdir "static\maps" 2>nul

echo.
echo ================================================================
echo   Bunker AI rodando em: http://localhost:8888
echo   Aperte Ctrl+C para parar
echo ================================================================
echo.

REM ---- Abrir navegador ----
start "" http://localhost:8888

REM ---- Iniciar servidor ----
if "!USE_LLAMA_CPP!"=="1" (
    set "LLAMA_CPP_URL=http://127.0.0.1:!LLAMA_PORT!"
    set "LLAMA_CPP_MODEL=built-in"
)

!PYTHON_EXE! -m uvicorn server:app --host 0.0.0.0 --port 8888

echo.
echo [!!] Servidor parou.
pause
exit /b 0
"""

_INICIAR_SH = r"""#!/bin/bash
# ═══ Bunker AI — Modo Portável — DON'T PANIC ═══
set -e

echo ""
echo "  ██████  ██    ██ ███    ██ ██   ██ ███████ ██████"
echo "  ██   ██ ██    ██ ████   ██ ██  ██  ██      ██   ██"
echo "  ██████  ██    ██ ██ ██  ██ █████   █████   ██████"
echo "  ██   ██ ██    ██ ██  ██ ██ ██  ██  ██      ██   ██"
echo "  ██████   ██████  ██   ████ ██   ██ ███████ ██   ██"
echo ""
echo "  MODO PORTAVEL — DON'T PANIC"
echo ""

cd "$(dirname "$0")"

# ─── Python ─────────────────────────────────────────────
PYTHON_EXE=""
if command -v python3 &> /dev/null; then
    PYTHON_EXE="python3"
    echo "[OK] Python3 encontrado"
elif command -v python &> /dev/null; then
    PYTHON_EXE="python"
    echo "[OK] Python encontrado"
else
    echo "[ERRO] Python nao encontrado! Instale python3."
    exit 1
fi

# ─── Deps ─────────────────────────────────────────────
$PYTHON_EXE -c "import fastapi" 2>/dev/null || {
    echo "[..] Instalando dependencias..."
    $PYTHON_EXE -m pip install -q -r requirements.txt 2>/dev/null
}

# ─── Detectar Backend ─────────────────────────────────
USE_LLAMA_CPP=0

if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "[OK] Ollama detectado"
else
    echo "[--] Ollama nao encontrado — usando modelo embutido"

    # Prioridade: Dolphin 8B (uncensored GPU) > Dolphin 1B (CPU) > qualquer .gguf
    MODEL_FILE=""
    if command -v nvidia-smi &>/dev/null; then
        echo "[OK] GPU NVIDIA detectada"
        MODEL_FILE=$(find models/ -name "dolphin*8b*.gguf" 2>/dev/null | head -1)
        [ -n "$MODEL_FILE" ] && GPU_ARGS="-ngl 99"
    fi
    [ -z "$MODEL_FILE" ] && MODEL_FILE=$(find models/ -name "dolphin*1b*.gguf" 2>/dev/null | head -1)
    [ -z "$MODEL_FILE" ] && MODEL_FILE=$(find models/ -name "*.gguf" 2>/dev/null | head -1)
    if [ -z "$MODEL_FILE" ]; then
        echo "[ERRO] Nenhum modelo .gguf em models/"
        exit 1
    fi
    echo "[OK] Modelo: $(basename $MODEL_FILE)"

    LLAMA_SERVER=""
    for f in runtime/llama/llama-server runtime/llama/build/bin/llama-server; do
        [ -x "$f" ] && LLAMA_SERVER="$f" && break
    done

    if [ -z "$LLAMA_SERVER" ]; then
        LLAMA_SERVER=$(find runtime/llama -name "llama-server" -type f 2>/dev/null | head -1)
    fi

    if [ -z "$LLAMA_SERVER" ]; then
        echo "[ERRO] llama-server nao encontrado em runtime/llama/"
        exit 1
    fi

    chmod +x "$LLAMA_SERVER"
    LLAMA_PORT=8070
    echo "[..] Iniciando LLM local..."
    "$LLAMA_SERVER" -m "$MODEL_FILE" --port $LLAMA_PORT --host 127.0.0.1 -c 4096 -np 1 ${GPU_ARGS:-} &>/dev/null &
    LLAMA_PID=$!

    echo "[..] Aguardando LLM carregar..."
    for i in $(seq 1 30); do
        if curl -s "http://127.0.0.1:$LLAMA_PORT/v1/models" > /dev/null 2>&1; then
            echo "[OK] LLM pronto!"
            break
        fi
        sleep 2
        echo "[..] Aguardando... ($i/30)"
    done

    USE_LLAMA_CPP=1
    export LLAMA_CPP_URL="http://127.0.0.1:$LLAMA_PORT"
    export LLAMA_CPP_MODEL="built-in"
fi

# ─── Dirs ─────────────────────────────────────────────
mkdir -p data/db generated_apps tts_cache static/maps

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Bunker AI rodando em: http://localhost:8888"
echo "  Aperte Ctrl+C para parar"
echo "══════════════════════════════════════════════════════════════"
echo ""

$PYTHON_EXE -m uvicorn server:app --host 0.0.0.0 --port 8888

# Cleanup
[ -n "$LLAMA_PID" ] && kill $LLAMA_PID 2>/dev/null
"""


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bunker AI — Build Portátil para Pendrive")
    parser.add_argument("--output", "-o", default="BunkerAI-Portable",
                       help="Pasta de saída (default: BunkerAI-Portable)")
    parser.add_argument("--skip-model", action="store_true",
                       help="Pular download dos modelos (coloque manualmente depois)")
    parser.add_argument("--cpu-only", action="store_true",
                       help="Baixar apenas o modelo CPU (pendrive menor, ~1 GB)")
    args = parser.parse_args()

    output = Path(args.output)
    build_portable(output, skip_model=args.skip_model, cpu_only=args.cpu_only)
