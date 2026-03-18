#!/bin/bash
# ═══ Bunker AI — Duplo-clique para iniciar (macOS) ═══
# Este arquivo pode ficar na pasta raiz ou uma pasta acima do app.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Detecta onde está o app (mesma pasta ou subpasta)
if [ -f "$SCRIPT_DIR/server.py" ]; then
    APP_DIR="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/app/server.py" ]; then
    APP_DIR="$SCRIPT_DIR/app"
elif [ -f "$SCRIPT_DIR/bunker/server.py" ]; then
    APP_DIR="$SCRIPT_DIR/bunker"
else
    # Tenta qualquer subpasta com server.py
    APP_DIR=$(find "$SCRIPT_DIR" -maxdepth 2 -name "server.py" -exec dirname {} \; | head -1)
fi

if [ -z "$APP_DIR" ] || [ ! -f "$APP_DIR/server.py" ]; then
    echo "ERRO: Nao encontrei o Bunker AI."
    echo "Coloque este arquivo na mesma pasta ou uma pasta acima do server.py"
    read -n1
    exit 1
fi

cd "$APP_DIR"
trap 'echo ""; echo "Pressione qualquer tecla para fechar..."; read -n1' EXIT
bash start.sh
