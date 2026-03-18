#!/bin/bash
# ═══ Bunker AI — 100% OFFLINE — DON'T PANIC ═══
# Zero internet. Zero downloads. Tudo ja esta aqui.

cd "$(dirname "$0")"

echo ""
echo "  ██████  ██    ██ ███    ██ ██   ██ ███████ ██████"
echo "  ██   ██ ██    ██ ████   ██ ██  ██  ██      ██   ██"
echo "  ██████  ██    ██ ██ ██  ██ █████   █████   ██████"
echo "  ██   ██ ██    ██ ██  ██ ██ ██  ██  ██      ██   ██"
echo "  ██████   ██████  ██   ████ ██   ██ ███████ ██   ██"
echo ""
echo "  100% Offline · DON'T PANIC"
echo ""

# ─── Activate venv ───────────────────────────────────────────
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    echo "[OK] Python: $(python3 --version 2>&1)"
else
    echo "[!!] Ambiente virtual nao encontrado."
    echo "     Executando setup inicial (precisa de internet APENAS AGORA)..."
    echo ""

    PY=""
    command -v python3 &>/dev/null && PY="python3"
    command -v python &>/dev/null && PY="${PY:-python}"
    if [ -z "$PY" ]; then
        echo "[ERRO] Python nao encontrado. Instale Python 3.10+: https://python.org"
        exit 1
    fi

    echo "[..] Criando ambiente virtual..."
    $PY -m venv venv
    source venv/bin/activate

    echo "[..] Instalando dependencias core..."
    pip install --upgrade pip 2>/dev/null
    pip install \
        "fastapi==0.115.0" \
        "uvicorn==0.30.6" \
        "httpx==0.27.2" \
        "python-multipart==0.0.9" \
        "psutil>=5.9.0" \
        "aiosqlite>=0.20.0"

    echo "[..] Instalando modulos opcionais..."
    pip install "edge-tts>=6.1.12" 2>/dev/null || true
    pip install "pyttsx3" 2>/dev/null || true
    pip install "soundfile>=0.12.0" 2>/dev/null || true
    pip install "faster-whisper>=1.0.0" 2>/dev/null || true
    pip install "kokoro-onnx>=0.4.0" 2>/dev/null || true

    echo "[OK] Setup completo. Da proxima vez nao precisa de internet."
    echo ""
fi

# ─── Verify core dep ────────────────────────────────────────
if ! python3 -c "import uvicorn" 2>/dev/null; then
    echo "[ERRO] uvicorn nao instalado. Delete 'venv/' e rode novamente com internet."
    exit 1
fi

# ─── Create data dirs ───────────────────────────────────────
mkdir -p data/db data/guides data/protocols data/books data/games data/zim \
         static/maps kokoro_models generated_apps tts_cache models 2>/dev/null

# ─── Ollama ─────────────────────────────────────────────────
OLLAMA_OK=false
if curl -s --max-time 2 http://localhost:11434/api/tags &>/dev/null; then
    OLLAMA_OK=true
elif command -v ollama &>/dev/null; then
    ollama serve &>/dev/null &
    for i in 1 2 3 4 5; do
        sleep 1
        curl -s --max-time 1 http://localhost:11434/api/tags &>/dev/null && OLLAMA_OK=true && break
    done
fi

if [ "$OLLAMA_OK" = true ]; then
    MC=$(curl -s http://localhost:11434/api/tags | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('models',[])))" 2>/dev/null || echo 0)
    echo "[OK] Ollama ($MC modelos)"
else
    echo "[--] Ollama nao encontrado (ok se usando GGUF locais)"
fi

# ─── Local GGUF models ──────────────────────────────────────
GC=$(ls models/*.gguf 2>/dev/null | wc -l | tr -d ' ')
[ "$GC" -gt 0 ] && echo "[OK] $GC modelo(s) GGUF em models/"

# ─── Launch ─────────────────────────────────────────────────
PORT=8888
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  🟢  Bunker AI: http://localhost:$PORT"
echo "  Ctrl+C para parar"
echo "══════════════════════════════════════════════════════════════"
echo ""

# Auto-open browser
if command -v open &>/dev/null; then
    (sleep 2 && open "http://localhost:$PORT") &
elif command -v xdg-open &>/dev/null; then
    (sleep 2 && xdg-open "http://localhost:$PORT") &
fi

python3 -m uvicorn server:app --host 0.0.0.0 --port $PORT
