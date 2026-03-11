#!/bin/bash
# ═══ Bunker AI — DON'T PANIC ═══

set -e

echo ""
echo "  ██████  ██    ██ ███    ██ ██   ██ ███████ ██████"
echo "  ██   ██ ██    ██ ████   ██ ██  ██  ██      ██   ██"
echo "  ██████  ██    ██ ██ ██  ██ █████   █████   ██████"
echo "  ██   ██ ██    ██ ██  ██ ██ ██  ██  ██      ██   ██"
echo "  ██████   ██████  ██   ████ ██   ██ ███████ ██   ██"
echo ""
echo "  100% Local · DON'T PANIC"
echo ""

cd "$(dirname "$0")"

# ─── Check Python ─────────────────────────────────────────────
if ! command -v python3 &> /dev/null; then
    echo "[ERRO] Python3 nao encontrado."
    echo "       Linux: sudo apt install python3 python3-venv"
    echo "       Mac:   brew install python3"
    exit 1
fi
echo "[OK] Python3 encontrado"

# ─── Check Ollama ─────────────────────────────────────────────
echo "[..] Verificando Ollama..."
OLLAMA_OK=false

if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    OLLAMA_OK=true
else
    echo "[!!] Ollama nao detectado. Tentando iniciar..."
    if command -v ollama &> /dev/null; then
        ollama serve &>/dev/null &
        sleep 3
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            OLLAMA_OK=true
        fi
    fi
fi

if [ "$OLLAMA_OK" = true ]; then
    echo "[OK] Ollama rodando"
    MODELS=$(curl -s http://localhost:11434/api/tags | python3 -c "import sys,json; models=json.load(sys.stdin).get('models',[]); print(', '.join(m['name'] for m in models))" 2>/dev/null || echo "")
    if [ -n "$MODELS" ]; then
        echo "     Modelos atuais: $MODELS"
    fi
else
    echo "[!!] Ollama nao esta rodando."
    echo "     Baixe em: https://ollama.ai"
    echo "     Depois rode: ollama serve"
    echo ""
    echo "     Continuando sem Ollama (voce pode configurar depois)..."
fi

# ─── Pull Required Models ─────────────────────────────────────
if [ "$OLLAMA_OK" = true ]; then
    echo ""
    echo "[..] Verificando modelos necessarios..."
    echo "     (primeiro download pode demorar, mas so acontece uma vez)"
    echo ""

    pull_if_missing() {
        local model=$1
        local desc=$2
        if curl -s http://localhost:11434/api/tags | python3 -c "
import sys, json
models = json.load(sys.stdin).get('models', [])
names = [m['name'] for m in models]
sys.exit(0 if '$model' in names else 1)
" 2>/dev/null; then
            echo "[OK] $model ja instalado"
        else
            echo "[DL] Baixando $model ($desc)..."
            if ollama pull "$model"; then
                echo "[OK] $model pronto"
            else
                echo "[!!] Falha ao baixar $model — voce pode baixar depois pelo app"
            fi
        fi
    }

    pull_if_missing "gemma3:12b"          "chat + visao — ~8GB"
    pull_if_missing "qwen2.5-coder:14b"   "app builder — ~9GB"
    pull_if_missing "phi4"                 "modelo rapido — ~9GB"
    pull_if_missing "dolphin3"             "cerebro sem filtros — ~5GB"
fi

# ─── Python venv + deps ──────────────────────────────────────
echo ""
if [ ! -d "venv" ]; then
    echo "[..] Criando ambiente virtual Python..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "[..] Instalando dependencias Python..."
pip install -q -r requirements.txt 2>/dev/null

# ─── Offline map hint ─────────────────────────────────────────
mkdir -p static/maps
if ! ls static/maps/*.pmtiles &>/dev/null 2>&1; then
    echo ""
    echo "[MAPA] Para mapa 100% offline, coloque um .pmtiles em static/maps/"
    echo "       Gere o seu:"
    echo "       pmtiles extract https://build.protomaps.com/20250101.pmtiles brasil.pmtiles --bbox=-74,-34,-35,5 --maxzoom=12"
    echo "       Ou baixe em: https://protomaps.com"
fi

# ─── Launch ───────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  Bunker AI rodando em: http://localhost:8888"
echo "  Aperte Ctrl+C para parar"
echo "══════════════════════════════════════════════════════════════"
echo ""

python3 -m uvicorn server:app --host 0.0.0.0 --port 8888 --reload
