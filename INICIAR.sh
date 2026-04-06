#!/bin/bash
set -e
cd "$(dirname "$0")/app"

echo "╔══════════════════════════════╗"
echo "║      BunkerAI — Boot         ║"
echo "╚══════════════════════════════╝"

# Detectar RAM
RAM_GB=$(free -g 2>/dev/null | awk '/^Mem:/{print $2}')
if [ -z "$RAM_GB" ]; then
    RAM_GB=$(awk '/MemTotal/{printf "%d", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo 0)
fi
echo "[HW] RAM: ${RAM_GB}GB"

# Detectar GPU
GPU_TYPE="cpu"
LLAMA_PID=""
if command -v nvidia-smi &>/dev/null && nvidia-smi &>/dev/null; then
    GPU_TYPE="nvidia"
    echo "[HW] GPU: NVIDIA"
else
    echo "[HW] GPU: nenhuma detectada, modo CPU"
fi

# Escolher modelo com base no hardware
MODEL=""
if [ -f "models/dolphin-8b-q4.gguf" ] && ([ "$GPU_TYPE" = "nvidia" ] || [ "$RAM_GB" -ge 16 ]); then
    MODEL="models/dolphin-8b-q4.gguf"
    echo "[LLM] Modelo: 8B (uncensored)"
elif [ -f "models/dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf" ] && ([ "$GPU_TYPE" = "nvidia" ] || [ "$RAM_GB" -ge 16 ]); then
    MODEL="models/dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf"
    echo "[LLM] Modelo: 8B Q4 (uncensored)"
elif [ -f "models/dolphin-1b-q4.gguf" ]; then
    MODEL="models/dolphin-1b-q4.gguf"
    echo "[LLM] Modelo: 1B leve (CPU)"
elif [ -f "models/dolphin-2.9.4-llama3.1-1b-Q4_K_M.gguf" ]; then
    MODEL="models/dolphin-2.9.4-llama3.1-1b-Q4_K_M.gguf"
    echo "[LLM] Modelo: 1B Q4 leve (CPU)"
else
    # Fallback: usa qualquer .gguf encontrado
    MODEL=$(ls models/*.gguf 2>/dev/null | head -1)
    if [ -z "$MODEL" ]; then
        echo "[ERRO] Nenhum modelo GGUF encontrado em models/"
        echo "Execute: python build_portable.py para baixar os modelos"
        read -p "Pressione Enter para sair..."
        exit 1
    fi
    echo "[LLM] Modelo: $MODEL (fallback)"
fi

# Encerrar llama-server em execucao anterior
pkill -f "llama-server" 2>/dev/null || true
sleep 1

# Iniciar llama-server
LLAMA_BIN="bin/linux/llama-server"
if [ -f "$LLAMA_BIN" ]; then
    chmod +x "$LLAMA_BIN"
    # Usar layers GPU se NVIDIA detectada
    N_GPU_LAYERS=0
    [ "$GPU_TYPE" = "nvidia" ] && N_GPU_LAYERS=35

    "$LLAMA_BIN" \
        --model "$MODEL" \
        --port 8070 \
        --host 127.0.0.1 \
        --ctx-size 4096 \
        --n-gpu-layers $N_GPU_LAYERS \
        --log-disable \
        > /tmp/bunker_llama.log 2>&1 &
    LLAMA_PID=$!
    echo "[LLM] llama-server iniciado (PID $LLAMA_PID)"
    sleep 2
else
    echo "[AVISO] llama-server nao encontrado em $LLAMA_BIN — continuando sem LLM local"
fi

# Ativar ambiente virtual Python
if [ -d "venv/bin" ]; then
    source venv/bin/activate
    echo "[PY] venv ativado"
elif command -v python3 &>/dev/null; then
    echo "[PY] Usando python3 do sistema"
fi

# Iniciar backend FastAPI
echo "[WEB] Iniciando servidor BunkerAI..."
python3 server.py > /tmp/bunker_server.log 2>&1 &
SERVER_PID=$!
sleep 3

# Verificar se o servidor subiu
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "[ERRO] Servidor falhou ao iniciar. Log:"
    tail -20 /tmp/bunker_server.log
    read -p "Pressione Enter para sair..."
    exit 1
fi

# Abrir navegador
echo "[OK] Abrindo http://localhost:8888"
xdg-open "http://localhost:8888" 2>/dev/null || open "http://localhost:8888" 2>/dev/null || true

echo ""
echo "=== BunkerAI rodando ==="
echo "Logs: /tmp/bunker_server.log"
echo "Para encerrar: Ctrl+C ou feche esta janela"
echo ""

# Limpar processos ao encerrar
cleanup() {
    echo ""
    echo "Encerrando BunkerAI..."
    kill $SERVER_PID 2>/dev/null || true
    kill $LLAMA_PID 2>/dev/null || true
    pkill -f "llama-server" 2>/dev/null || true
    echo "Encerrado."
}
trap cleanup EXIT INT TERM
wait $SERVER_PID
