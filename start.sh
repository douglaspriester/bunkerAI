#!/bin/bash
# ═══ Bunker AI — 100% OFFLINE — DON'T PANIC ═══

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

# ─── Helper: create data dirs ─────────────────────────────────────────────
create_dirs() {
    mkdir -p data/db data/guides data/protocols data/books data/games data/zim \
             static/maps kokoro_models generated_apps tts_cache models voice_models 2>/dev/null
}

# ─── Helper: find Python ──────────────────────────────────────────────────
find_python() {
    if command -v python3 &>/dev/null; then echo "python3"
    elif command -v python &>/dev/null; then echo "python"
    else echo ""; fi
}

# ─── Helper: install venv ─────────────────────────────────────────────────
do_install() {
    local PY
    PY=$(find_python)
    if [ -z "$PY" ]; then
        echo "[ERRO] Python nao encontrado. Instale Python 3.10+: https://python.org"
        exit 1
    fi
    echo "[OK] Python: $($PY --version 2>&1)"

    echo "[..] Criando ambiente virtual..."
    $PY -m venv venv
    source venv/bin/activate

    echo "[..] Instalando dependencias..."
    pip install --upgrade pip 2>/dev/null
    pip install -q -r requirements.txt 2>/dev/null
    echo "[OK] Dependencias instaladas"
    create_dirs
}

# ─── Helper: check/start Ollama ───────────────────────────────────────────
check_ollama() {
    if curl -s --max-time 2 http://localhost:11434/api/tags &>/dev/null; then
        return 0
    elif command -v ollama &>/dev/null; then
        echo "[..] Iniciando Ollama..."
        ollama serve &>/dev/null &
        for i in 1 2 3 4 5; do
            sleep 1
            curl -s --max-time 1 http://localhost:11434/api/tags &>/dev/null && return 0
        done
    fi
    return 1
}

# ─── Helper: launch server ────────────────────────────────────────────────
do_launch() {
    echo "[..] Verificando Ollama..."
    if check_ollama; then
        MC=$(curl -s http://localhost:11434/api/tags | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('models',[])))" 2>/dev/null || echo 0)
        echo "[OK] Ollama ($MC modelos)"
    else
        echo "[--] Ollama nao encontrado (ok se usando modelos GGUF locais)"
    fi

    local GC
    GC=$(ls models/*.gguf 2>/dev/null | wc -l | tr -d ' ')
    [ "$GC" -gt 0 ] && echo "[OK] $GC modelo(s) GGUF em models/"

    # Verify core dep
    if ! python3 -c "import uvicorn" 2>/dev/null; then
        echo "[ERRO] uvicorn nao instalado. Escolha 'Reinstalar' no menu."
        exit 1
    fi

    # Find available port
    PORT=8888
    if ! python3 -c "import socket; s=socket.socket(); s.bind(('',8888)); s.close()" 2>/dev/null; then
        echo "[!!] Porta 8888 ocupada, tentando 8889..."
        PORT=8889
        if ! python3 -c "import socket; s=socket.socket(); s.bind(('',8889)); s.close()" 2>/dev/null; then
            echo "[!!] Porta 8889 tambem ocupada, tentando 9999..."
            PORT=9999
        fi
    fi

    echo ""
    echo "══════════════════════════════════════════════════════════════"
    echo "  Bunker AI: http://localhost:$PORT"
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
}

# ═══════════════════════════════════════════════════════════════════════════
#  Detect installation state — fast boot if already installed
# ═══════════════════════════════════════════════════════════════════════════

# Check if venv exists but was created on another OS (USB portability)
if [ -d "venv" ] && [ ! -f "venv/bin/activate" ]; then
    echo "[!!] Ambiente virtual de outro sistema detectado (Windows?)"
    echo "[..] Recriando venv para este sistema (modelos e dados mantidos)..."
    rm -rf venv
    do_install
fi

if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    echo "[OK] Ambiente virtual ativado: $(python3 --version 2>&1)"
    create_dirs
    do_launch
    exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════
#  First run — show menu
# ═══════════════════════════════════════════════════════════════════════════

echo "================================================================"
echo "  O que deseja fazer?"
echo "================================================================"
echo ""
echo "  [1] Instalar Bunker AI (primeira vez)"
echo "  [2] Instalar em pendrive/USB (100% offline com modelos)"
echo "  [3] Reinstalar (corrigir instalacao corrompida)"
echo "  [4] Sair"
echo ""
read -p "  Escolha [1-4]: " CHOICE

case "$CHOICE" in
    1)
        do_install

        # Verify emergency model
        if [ -f "models/qwen2.5-0.5b-instruct-q4_k_m.gguf" ]; then
            echo "[OK] Modelo de emergencia presente (469 MB)"
        else
            echo "[!!] Modelo de emergencia nao encontrado em models/"
            echo "[..] Baixando modelo de emergencia (~469MB)..."
            python3 -c "import urllib.request,os;os.makedirs('models',exist_ok=True);urllib.request.urlretrieve('https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf','models/qwen2.5-0.5b-instruct-q4_k_m.gguf');print('[OK] Modelo de emergencia pronto')"
        fi

        echo ""
        echo "================================================================"
        echo "  Deseja baixar modelos ADICIONAIS? (melhor qualidade offline)"
        echo "================================================================"
        echo ""
        echo "  [S] Sim — escolher modelos extras (uncensored, vision, code...)"
        echo "  [N] Nao — usar so o modelo de emergencia por agora"
        echo ""
        read -p "  Escolha [S/N]: " DL
        if [ "$DL" = "s" ] || [ "$DL" = "S" ]; then
            python3 tools/prepare_usb.py
        fi
        echo ""
        echo "================================================================"
        echo "  Instalacao concluida! Iniciando Bunker AI..."
        echo "================================================================"
        echo ""
        do_launch
        ;;
    2)
        do_install
        python3 tools/prepare_usb.py

        echo ""
        echo "================================================================"
        echo "  Instalacao USB concluida!"
        echo "================================================================"
        echo ""
        do_launch
        ;;
    3)
        echo ""
        echo "[!!] Isso vai reinstalar o ambiente Python (dados mantidos)."
        read -p "  Confirma? [s/n]: " CONFIRM
        if [ "$CONFIRM" = "s" ] || [ "$CONFIRM" = "S" ]; then
            echo "[..] Removendo ambiente virtual antigo..."
            rm -rf venv
            echo "[OK] Ambiente removido"
            do_install
            echo ""
            echo "================================================================"
            echo "  Reinstalacao concluida! Iniciando Bunker AI..."
            echo "================================================================"
            echo ""
            do_launch
        fi
        ;;
    4)
        exit 0
        ;;
    *)
        echo "[!!] Opcao invalida."
        exit 1
        ;;
esac
