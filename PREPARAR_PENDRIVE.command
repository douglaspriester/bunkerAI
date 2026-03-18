#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  BUNKER AI — Preparador de Pendrive (macOS)
#  Duplo-clique → seleciona pendrive → tudo pronto. Plug & play.
# ═══════════════════════════════════════════════════════════════

set -e
trap 'echo ""; echo "❌ Erro na linha $LINENO. Pressione qualquer tecla..."; read -n1' ERR
trap 'echo ""; echo "Pressione qualquer tecla para fechar..."; read -n1' EXIT

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Colors ──
G='\033[32m'; Y='\033[33m'; C='\033[36m'; B='\033[1m'; R='\033[0m'

echo ""
echo -e "${C}${B}"
echo "  ██████  ██    ██ ███    ██ ██   ██ ███████ ██████"
echo "  ██   ██ ██    ██ ████   ██ ██  ██  ██      ██   ██"
echo "  ██████  ██    ██ ██ ██  ██ █████   █████   ██████"
echo "  ██   ██ ██    ██ ██  ██ ██ ██  ██  ██      ██   ██"
echo "  ██████   ██████  ██   ████ ██   ██ ███████ ██   ██"
echo -e "${R}"
echo -e "  ${B}Preparador de Pendrive${R} — 100% Offline"
echo ""

# ── Sanity check ──
if [ ! -f "server.py" ]; then
    echo "❌ Execute este script de dentro da pasta do Bunker AI (onde server.py esta)."
    exit 1
fi

# ── List volumes ──
echo -e "${B}Selecione o destino:${R}"
echo ""

VOLUMES=()
i=1
for vol in /Volumes/*/; do
    vol_name=$(basename "$vol")
    # Skip system volumes
    [[ "$vol_name" == "Macintosh HD" ]] && continue
    [[ "$vol_name" == "Macintosh HD - Data" ]] && continue
    [[ "$vol_name" == "Recovery" ]] && continue
    [[ "$vol_name" == "Preboot" ]] && continue
    [[ "$vol_name" == "VM" ]] && continue
    [[ "$vol_name" == "Update" ]] && continue

    # Get free space
    free_bytes=$(df -k "$vol" 2>/dev/null | tail -1 | awk '{print $4}')
    free_gb=$(echo "scale=1; $free_bytes / 1048576" | bc 2>/dev/null || echo "?")

    VOLUMES+=("$vol")
    echo "  ${i}) ${vol_name}  (${free_gb} GB livre)"
    i=$((i + 1))
done

# Add custom option
echo "  ${i}) Digitar caminho manualmente..."
echo ""

read -p "Escolha [1-${i}]: " choice

if [ "$choice" -eq "$i" ] 2>/dev/null; then
    read -p "Caminho completo: " DEST_ROOT
else
    idx=$((choice - 1))
    if [ "$idx" -lt 0 ] || [ "$idx" -ge "${#VOLUMES[@]}" ]; then
        echo "❌ Opcao invalida."
        exit 1
    fi
    DEST_ROOT="${VOLUMES[$idx]}"
fi

# ── Validate destination ──
if [ ! -d "$DEST_ROOT" ]; then
    echo "❌ Caminho nao encontrado: $DEST_ROOT"
    exit 1
fi

DEST="${DEST_ROOT}/BunkerAI"

# ── Check free space ──
REQUIRED_GB=10
free_kb=$(df -k "$DEST_ROOT" 2>/dev/null | tail -1 | awk '{print $4}')
free_gb=$(echo "scale=1; $free_kb / 1048576" | bc 2>/dev/null || echo "999")

echo ""
echo -e "${B}Resumo:${R}"
echo "  Destino:     $DEST"
echo "  Necessario:  ~${REQUIRED_GB} GB"
echo "  Disponivel:  ${free_gb} GB"

if (( $(echo "$free_gb < $REQUIRED_GB" | bc -l 2>/dev/null || echo 0) )); then
    echo ""
    echo -e "${Y}⚠ Espaco pode ser insuficiente. Continuar mesmo assim?${R}"
fi

echo ""
read -p "Continuar? [S/n]: " confirm
confirm=${confirm:-S}
if [[ ! "$confirm" =~ ^[SsYy]$ ]]; then
    echo "Cancelado."
    exit 0
fi

echo ""
echo -e "${C}═══════════════════════════════════════════════════════${R}"
echo -e "${B}  Preparando pendrive... Isso pode demorar ~10 minutos.${R}"
echo -e "${C}═══════════════════════════════════════════════════════${R}"
echo ""

# ── Step 1: Create structure ──
echo -e "${G}[1/6]${R} Criando estrutura..."
mkdir -p "$DEST/app"

# ── Step 2: Copy app code ──
echo -e "${G}[2/6]${R} Copiando codigo do app..."

# Core files
for f in server.py requirements.txt LEIA-ME.txt; do
    [ -f "$f" ] && cp "$f" "$DEST/app/"
done

# Directories (exclude heavy stuff)
for d in static data; do
    if [ -d "$d" ]; then
        rsync -a --info=progress2 "$d/" "$DEST/app/$d/" 2>/dev/null || cp -R "$d" "$DEST/app/"
    fi
done

# Create launchers at root
cat > "$DEST/INICIAR.command" << 'LAUNCHER'
#!/bin/bash
cd "$(dirname "$0")/app"
trap 'echo ""; echo "Pressione qualquer tecla para fechar..."; read -n1' EXIT
bash start.sh
LAUNCHER
chmod +x "$DEST/INICIAR.command"

cat > "$DEST/INICIAR.bat" << 'LAUNCHER_WIN'
@echo off
cd /d "%~dp0\app"
call start.bat
LAUNCHER_WIN

# Copy start scripts
[ -f "start.sh" ] && cp "start.sh" "$DEST/app/" && chmod +x "$DEST/app/start.sh"
[ -f "start.bat" ] && cp "start.bat" "$DEST/app/"

# Copy LEIA-ME to root
[ -f "LEIA-ME.txt" ] && cp "LEIA-ME.txt" "$DEST/"

echo "  ✅ Codigo copiado"

# ── Step 3: Copy/download models ──
echo -e "${G}[3/6]${R} Preparando modelos de IA..."
mkdir -p "$DEST/app/models"

download_model() {
    local filename=$1
    local url=$2
    local desc=$3
    local dest="$DEST/app/models/$filename"

    if [ -f "$dest" ] && [ "$(stat -f%z "$dest" 2>/dev/null || stat -c%s "$dest" 2>/dev/null)" -gt 100000000 ]; then
        echo "  ✅ $desc (ja existe)"
        return
    fi

    # Check local copy first
    if [ -f "models/$filename" ] && [ "$(stat -f%z "models/$filename" 2>/dev/null || stat -c%s "models/$filename" 2>/dev/null)" -gt 100000000 ]; then
        echo "  📋 $desc (copiando local...)"
        cp "models/$filename" "$dest"
        echo "  ✅ $desc copiado"
        return
    fi

    # Download
    echo "  ⬇ $desc (baixando...)"
    curl -L --progress-bar -o "$dest" "$url"
    if [ -f "$dest" ] && [ "$(stat -f%z "$dest" 2>/dev/null || stat -c%s "$dest" 2>/dev/null)" -gt 100000000 ]; then
        echo "  ✅ $desc baixado"
    else
        echo "  ❌ Falha ao baixar $desc"
        rm -f "$dest"
    fi
}

download_model "qwen2.5-1.5b-instruct-q4_k_m.gguf" \
    "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf" \
    "Qwen 1.5B CPU (1.1 GB)"

download_model "dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf" \
    "https://huggingface.co/bartowski/dolphin-2.9.4-llama3.1-8b-GGUF/resolve/main/dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf" \
    "Dolphin 8B GPU (4.6 GB)"

download_model "gemma-3-4b-it-Q4_K_M.gguf" \
    "https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q4_K_M.gguf" \
    "Gemma 3 4B Vision (2.4 GB)"

# ── Step 4: Copy/download llama-server ──
echo -e "${G}[4/6]${R} Preparando llama-server..."
mkdir -p "$DEST/app/bin/mac"

if [ -f "bin/mac/llama-server" ]; then
    cp "bin/mac/llama-server" "$DEST/app/bin/mac/"
    chmod +x "$DEST/app/bin/mac/llama-server"
    echo "  ✅ llama-server copiado"
else
    echo "  ⬇ Baixando llama-server..."
    LLAMA_ZIP="/tmp/llama-mac-build.zip"
    curl -L --progress-bar -o "$LLAMA_ZIP" \
        "https://github.com/ggml-org/llama.cpp/releases/download/b5200/llama-b5200-bin-macos-arm64.zip"
    LLAMA_TMP="/tmp/llama-mac-extract"
    rm -rf "$LLAMA_TMP"
    unzip -q -o "$LLAMA_ZIP" -d "$LLAMA_TMP"
    LLAMA_BIN=$(find "$LLAMA_TMP" -name "llama-server" -type f | head -1)
    if [ -n "$LLAMA_BIN" ]; then
        cp "$LLAMA_BIN" "$DEST/app/bin/mac/llama-server"
        chmod +x "$DEST/app/bin/mac/llama-server"
        echo "  ✅ llama-server baixado"
    else
        echo "  ❌ llama-server nao encontrado no zip"
    fi
    rm -rf "$LLAMA_TMP" "$LLAMA_ZIP"
fi

# ── Step 5: Create venv ──
echo -e "${G}[5/6]${R} Criando ambiente Python..."

if [ -d "$DEST/app/venv" ] && [ -f "$DEST/app/venv/bin/activate" ]; then
    echo "  ✅ venv ja existe"
else
    if command -v python3 &>/dev/null; then
        python3 -m venv "$DEST/app/venv"
        source "$DEST/app/venv/bin/activate"
        pip install -q -r "$DEST/app/requirements.txt" 2>/dev/null
        deactivate
        echo "  ✅ venv criado e dependencias instaladas"
    else
        echo "  ⚠ Python3 nao encontrado — venv sera criado na primeira execucao"
    fi
fi

# ── Step 6: Verify ──
echo -e "${G}[6/6]${R} Verificando..."

TOTAL_SIZE=$(du -sh "$DEST" 2>/dev/null | awk '{print $1}')
ERRORS=0

check_file() {
    if [ -f "$1" ]; then
        echo "  ✅ $(basename "$1")"
    else
        echo "  ❌ FALTANDO: $1"
        ERRORS=$((ERRORS + 1))
    fi
}

check_file "$DEST/INICIAR.command"
check_file "$DEST/app/server.py"
check_file "$DEST/app/start.sh"
check_file "$DEST/app/bin/mac/llama-server"
check_file "$DEST/app/models/qwen2.5-1.5b-instruct-q4_k_m.gguf"
check_file "$DEST/app/models/dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf"
check_file "$DEST/app/models/gemma-3-4b-it-Q4_K_M.gguf"

echo ""
echo -e "${C}═══════════════════════════════════════════════════════${R}"
if [ "$ERRORS" -eq 0 ]; then
    echo -e "  ${G}${B}✅  PENDRIVE PRONTO!${R}  Tamanho total: ${TOTAL_SIZE}"
    echo ""
    echo "  Estrutura:"
    echo "    ${DEST}/"
    echo "    ├── INICIAR.command  ← duplo-clique no Mac"
    echo "    ├── INICIAR.bat      ← duplo-clique no Windows"
    echo "    ├── LEIA-ME.txt"
    echo "    └── app/             ← tudo aqui dentro"
    echo ""
    echo "  Como usar:"
    echo "    1. Plugue o pendrive em qualquer Mac"
    echo "    2. Duplo-clique em INICIAR.command"
    echo "    3. Pronto! 100% offline."
else
    echo -e "  ${Y}⚠  Pendrive preparado com ${ERRORS} arquivo(s) faltando.${R}"
    echo "  Tamanho: ${TOTAL_SIZE}"
fi
echo -e "${C}═══════════════════════════════════════════════════════${R}"
