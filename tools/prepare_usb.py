#!/usr/bin/env python3
"""
Bunker AI — USB Model Preparation
Analyzes free disk space and helps user pick the best models for their drive.
"""

import os
import sys
import shutil
import subprocess
import urllib.request

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")

# ── Full model catalog (ordered by priority: uncensored first) ───────────────

CATALOG = [
    # ── Uncensored (priority) ──
    {
        "id": "dolphin3-3b",
        "name": "Dolphin 3.0 3B Uncensored",
        "filename": "dolphin-3.0-llama3.2-3b-Q4_K_M.gguf",
        "url": "https://huggingface.co/bartowski/dolphin-3.0-llama3.2-3b-GGUF/resolve/main/dolphin-3.0-llama3.2-3b-Q4_K_M.gguf",
        "size_gb": 2.0,
        "requires_gpu": False,
        "gpu_vram_min": 0,
        "uncensored": True,
        "tags": "uncensored · CPU/GPU · leve",
    },
    {
        "id": "dolphin-8b",
        "name": "Dolphin 8B Uncensored",
        "filename": "dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf",
        "url": "https://huggingface.co/bartowski/dolphin-2.9.4-llama3.1-8b-GGUF/resolve/main/dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf",
        "size_gb": 4.9,
        "requires_gpu": True,
        "gpu_vram_min": 6000,
        "uncensored": True,
        "tags": "uncensored · GPU 6GB+ · melhor qualidade",
    },
    # ── Vision ──
    {
        "id": "gemma3-4b-vision",
        "name": "Gemma 3 4B Vision",
        "filename": "gemma-3-4b-it-Q4_K_M.gguf",
        "url": "https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q4_K_M.gguf",
        "size_gb": 3.0,
        "requires_gpu": True,
        "gpu_vram_min": 4000,
        "uncensored": False,
        "tags": "vision · webcam/scanner · GPU 4GB+",
    },
    # ── Code ──
    {
        "id": "qwen25-coder-7b",
        "name": "Qwen 2.5 Coder 7B",
        "filename": "qwen2.5-coder-7b-instruct-q4_k_m.gguf",
        "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf",
        "size_gb": 4.7,
        "requires_gpu": True,
        "gpu_vram_min": 6000,
        "uncensored": False,
        "tags": "code · programacao · GPU 6GB+",
    },
    {
        "id": "qwen25-coder-3b",
        "name": "Qwen 2.5 Coder 3B",
        "filename": "qwen2.5-coder-3b-instruct-q4_k_m.gguf",
        "url": "https://huggingface.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf",
        "size_gb": 2.0,
        "requires_gpu": False,
        "gpu_vram_min": 0,
        "uncensored": False,
        "tags": "code · programacao · CPU/GPU",
    },
    # ── General fallback ──
    {
        "id": "qwen25-1.5b",
        "name": "Qwen 2.5 1.5B (CPU leve)",
        "filename": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "url": "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "size_gb": 1.1,
        "requires_gpu": False,
        "gpu_vram_min": 0,
        "uncensored": False,
        "tags": "chat · CPU · leve",
    },
]

# Emergency model is always included in the repo — not in CATALOG
# (no need to download: models/qwen2.5-0.5b-instruct-q4_k_m.gguf)


def detect_gpu():
    """Detect NVIDIA GPU and return (has_gpu, vram_mb)."""
    try:
        r = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=3,
        )
        if r.returncode == 0:
            return True, int(r.stdout.strip().split("\n")[0])
    except Exception:
        pass
    return False, 0


def get_free_space_gb(path):
    """Get free disk space in GB."""
    usage = shutil.disk_usage(path)
    return usage.free / (1024 ** 3)


def detect_filesystem(path):
    """Detect filesystem type. Returns 'fat32', 'ntfs', 'ext4', etc. or 'unknown'."""
    # Windows: use vol/fsutil or wmic
    if sys.platform == "win32":
        try:
            drive = os.path.splitdrive(os.path.abspath(path))[0] + "\\"
            r = subprocess.run(
                ["fsutil", "fsinfo", "volumeinfo", drive],
                capture_output=True, text=True, timeout=5,
            )
            for line in r.stdout.splitlines():
                if "File System Name" in line or "Nome do Sistema" in line:
                    fs = line.split(":")[-1].strip().lower()
                    if "fat32" in fs or "fat" in fs:
                        return "fat32"
                    elif "exfat" in fs:
                        return "exfat"
                    elif "ntfs" in fs:
                        return "ntfs"
                    return fs
        except Exception:
            pass
    # Linux/Mac: use df -T or mount
    else:
        try:
            r = subprocess.run(["df", "-T", os.path.abspath(path)],
                               capture_output=True, text=True, timeout=5)
            if r.returncode == 0:
                lines = r.stdout.strip().split("\n")
                if len(lines) >= 2:
                    fs = lines[1].split()[1].lower()
                    if "fat" in fs or "vfat" in fs:
                        return "fat32"
                    return fs
        except Exception:
            pass
    return "unknown"


FAT32_MAX_FILE_GB = 3.99  # FAT32 limit is 4GB - 1 byte


def get_already_downloaded():
    """Return set of filenames already in models/."""
    if not os.path.isdir(MODELS_DIR):
        return set()
    return {f for f in os.listdir(MODELS_DIR) if f.endswith(".gguf")}


def format_size(gb):
    """Format size nicely."""
    if gb < 1:
        return f"{int(gb * 1024)} MB"
    return f"{gb:.1f} GB"


def download_model(model):
    """Download a model with progress display."""
    os.makedirs(MODELS_DIR, exist_ok=True)
    filepath = os.path.join(MODELS_DIR, model["filename"])

    if os.path.exists(filepath):
        existing_size = os.path.getsize(filepath) / (1024 ** 3)
        if existing_size > model["size_gb"] * 0.9:
            print(f"  [OK] {model['name']} ja existe")
            return True

    print(f"  [..] Baixando {model['name']} ({format_size(model['size_gb'])})...")

    try:
        req = urllib.request.Request(model["url"], headers={"User-Agent": "BunkerAI/4.0"})
        with urllib.request.urlopen(req, timeout=3600) as resp:
            total = int(resp.headers.get("Content-Length", 0))
            downloaded = 0
            chunk_size = 1024 * 512
            last_pct = -1

            with open(filepath, "wb") as f:
                while True:
                    chunk = resp.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = int(downloaded * 100 / total)
                        if pct != last_pct and pct % 5 == 0:
                            bar = "#" * (pct // 5) + "-" * (20 - pct // 5)
                            print(f"\r  [{bar}] {pct}%", end="", flush=True)
                            last_pct = pct

        print(f"\r  [OK] {model['name']} baixado com sucesso!          ")
        return True
    except Exception as e:
        print(f"\r  [ERRO] Falha ao baixar {model['name']}: {e}")
        if os.path.exists(filepath):
            os.unlink(filepath)
        return False


def main():
    print()
    print("=" * 60)
    print("  BUNKER AI — Preparacao de Pendrive / USB Offline")
    print("=" * 60)
    print()

    # ── Detect hardware ──
    has_gpu, vram = detect_gpu()
    if has_gpu:
        print(f"  [GPU] NVIDIA detectada — {vram} MB VRAM")
    else:
        print("  [CPU] Nenhuma GPU detectada — modelos CPU serao priorizados")

    # ── Detect RAM ──
    try:
        import psutil
        ram_mb = int(psutil.virtual_memory().total / (1024 * 1024))
    except Exception:
        ram_mb = 0
    if ram_mb > 0:
        print(f"  [RAM] {ram_mb} MB ({ram_mb // 1024} GB)")
        if ram_mb < 4000:
            print("  [!!] RAM baixa — modelos grandes podem nao funcionar neste PC")
            print("       Mas o pendrive pode ser usado em PCs mais potentes!")

    # ── Detect filesystem ──
    target_path = MODELS_DIR if os.path.isdir(MODELS_DIR) else os.getcwd()
    fs_type = detect_filesystem(target_path)
    is_fat32 = fs_type == "fat32"
    if is_fat32:
        print(f"  [!!] Sistema de arquivos: FAT32 — limite de 4 GB por arquivo!")
        print("       Modelos maiores que 4 GB serao excluidos automaticamente.")
        print("       Dica: formate o pendrive como exFAT para modelos maiores.")
    elif fs_type != "unknown":
        print(f"  [DISCO] Sistema de arquivos: {fs_type.upper()}")

    # ── Detect free space ──
    free_gb = get_free_space_gb(target_path)
    print(f"  [DISCO] Espaco livre: {format_size(free_gb)}")

    # ── Already downloaded ──
    downloaded = get_already_downloaded()
    if downloaded:
        print(f"  [MODELOS] Ja baixados: {len(downloaded)}")
        for fn in sorted(downloaded):
            size = os.path.getsize(os.path.join(MODELS_DIR, fn)) / (1024 ** 3)
            print(f"    - {fn} ({format_size(size)})")

    # ── Filter catalog: what fits and isn't downloaded ──
    available = []
    for m in CATALOG:
        if m["filename"] in downloaded:
            continue
        if m["size_gb"] > free_gb - 0.5:  # leave 500MB buffer
            continue
        if is_fat32 and m["size_gb"] > FAT32_MAX_FILE_GB:
            continue  # skip models that won't fit on FAT32
        available.append(m)

    if not available:
        print()
        print("  Nenhum modelo adicional cabe no espaco disponivel.")
        print("  Libere espaco ou use um pendrive maior.")
        print()
        return

    # ── Auto-recommend based on hardware + space ──
    recommended = set()
    # Always recommend uncensored base
    for m in available:
        if m["id"] == "dolphin3-3b":
            recommended.add(m["id"])
    # If GPU and space, recommend bigger dolphin
    if has_gpu and vram >= 6000:
        for m in available:
            if m["id"] == "dolphin-8b":
                recommended.add(m["id"])
    # If GPU, recommend vision
    if has_gpu and vram >= 4000:
        for m in available:
            if m["id"] == "gemma3-4b-vision":
                recommended.add(m["id"])
    # If space available, recommend coder
    total_recommended = sum(m["size_gb"] for m in available if m["id"] in recommended)
    if free_gb - total_recommended > 5:
        for m in available:
            if "coder" in m["id"] and (not m["requires_gpu"] or (has_gpu and vram >= m["gpu_vram_min"])):
                recommended.add(m["id"])
                break

    # ── Show catalog ──
    print()
    print("-" * 60)
    print("  Modelos disponiveis para download:")
    print("-" * 60)
    print()

    total_selected = 0.0
    for i, m in enumerate(available, 1):
        is_rec = m["id"] in recommended
        marker = "*" if is_rec else " "
        gpu_warn = ""
        if m["requires_gpu"] and not has_gpu:
            gpu_warn = " [!GPU necessaria]"
        unc = " [UNCENSORED]" if m["uncensored"] else ""

        print(f"  {marker} [{i}] {m['name']}{unc}")
        print(f"        {format_size(m['size_gb'])} · {m['tags']}{gpu_warn}")
        print()

    if recommended:
        rec_models = [m for m in available if m["id"] in recommended]
        rec_total = sum(m["size_gb"] for m in rec_models)
        rec_names = ", ".join(m["name"] for m in rec_models)
        print(f"  * Recomendado para seu hardware: {rec_names}")
        print(f"    Total: {format_size(rec_total)} / {format_size(free_gb)} livre")
    print()

    # ── Ask user ──
    print("  Opcoes:")
    print(f"    [R] Baixar recomendados ({len(recommended)} modelos)")
    print(f"    [T] Baixar TODOS que cabem ({len(available)} modelos)")
    print("    [E] Escolher manualmente (ex: 1,3,4)")
    print("    [P] Pular — nao baixar modelos agora")
    print()

    choice = input("  Escolha [R/T/E/P]: ").strip().upper()

    selected = []
    if choice == "R":
        selected = [m for m in available if m["id"] in recommended]
    elif choice == "T":
        selected = list(available)
    elif choice == "E":
        nums = input("  Digite os numeros separados por virgula (ex: 1,3): ").strip()
        try:
            indices = [int(n.strip()) - 1 for n in nums.split(",") if n.strip()]
            selected = [available[i] for i in indices if 0 <= i < len(available)]
        except (ValueError, IndexError):
            print("  [!!] Entrada invalida.")
            return
    elif choice == "P":
        print("  [OK] Nenhum modelo baixado.")
        return
    else:
        print("  [!!] Opcao invalida.")
        return

    if not selected:
        print("  [!!] Nenhum modelo selecionado.")
        return

    # ── Verify space ──
    total_size = sum(m["size_gb"] for m in selected)
    if total_size > free_gb - 0.5:
        print(f"  [!!] Espaco insuficiente: precisa {format_size(total_size)}, tem {format_size(free_gb)}")
        print("  Removendo modelos maiores ate caber...")
        selected.sort(key=lambda m: m["size_gb"])
        fitted = []
        running_total = 0
        for m in selected:
            if running_total + m["size_gb"] <= free_gb - 0.5:
                fitted.append(m)
                running_total += m["size_gb"]
        selected = fitted
        if not selected:
            print("  [!!] Nenhum modelo cabe.")
            return

    # ── GPU warnings ──
    gpu_models = [m for m in selected if m["requires_gpu"] and not has_gpu]
    if gpu_models:
        print()
        names = ", ".join(m["name"] for m in gpu_models)
        print(f"  [!] Aviso: {names} precisam de GPU.")
        print("      Vao funcionar, mas serao LENTOS em CPU.")
        cont = input("  Continuar mesmo assim? [s/n]: ").strip().lower()
        if cont != "s":
            selected = [m for m in selected if m not in gpu_models]
            if not selected:
                print("  [OK] Nenhum modelo baixado.")
                return

    # ── Download ──
    total_size = sum(m["size_gb"] for m in selected)
    print()
    print(f"  Baixando {len(selected)} modelo(s) — {format_size(total_size)} total")
    print("-" * 60)

    ok = 0
    for m in selected:
        if download_model(m):
            ok += 1
            free_gb -= m["size_gb"]

    # ── Summary ──
    print()
    print("=" * 60)
    print(f"  {ok}/{len(selected)} modelos baixados com sucesso!")

    all_downloaded = get_already_downloaded()
    total_models_size = sum(
        os.path.getsize(os.path.join(MODELS_DIR, f)) / (1024 ** 3)
        for f in all_downloaded
    )
    remaining = get_free_space_gb(MODELS_DIR)

    print(f"  Total em models/: {len(all_downloaded)} arquivos ({format_size(total_models_size)})")
    print(f"  Espaco livre restante: {format_size(remaining)}")
    print("=" * 60)
    print()


# ─── Games / ROMs section ────────────────────────────────────────────────────

GAMES_BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "games")

# Homebrew ROM catalog — all free/open-source, legal to distribute
GAMES_CATALOG = [
    {
        "system": "nes",
        "name": "Alter Ego",
        "filename": "alter-ego.nes",
        "url": "https://raw.githubusercontent.com/nicklausw/nes-homebrew-starter-games/main/alter-ego.nes",
        "size_kb": 40,
    },
    {
        "system": "nes",
        "name": "Blade Buster",
        "filename": "blade-buster.nes",
        "url": "https://raw.githubusercontent.com/nicklausw/nes-homebrew-starter-games/main/blade-buster.nes",
        "size_kb": 128,
    },
    {
        "system": "gb",
        "name": "Tobu Tobu Girl",
        "filename": "tobu-tobu-girl.gb",
        "url": "https://tangramgames.dk/tobutobugirl/tobutobugirl.gb",
        "size_kb": 64,
    },
    {
        "system": "gba",
        "name": "Celeste Classic",
        "filename": "celeste-classic.gba",
        "url": "https://github.com/nicklausw/gba-homebrew-starter-games/raw/main/celeste-classic.gba",
        "size_kb": 256,
    },
]


def count_roms():
    """Count ROMs already in static/games/."""
    count = 0
    rom_exts = {".nes", ".smc", ".sfc", ".gb", ".gbc", ".gba", ".md", ".gen"}
    for dirpath, _, filenames in os.walk(GAMES_BASE):
        for f in filenames:
            if os.path.splitext(f)[1].lower() in rom_exts:
                count += 1
    return count


def offer_games_download():
    """Ask user if they want to add games/ROMs."""
    print()
    print("=" * 60)
    print("  JOGOS — Emulador Retro (NES, SNES, Game Boy, GBA, Genesis)")
    print("=" * 60)
    print()

    existing = count_roms()
    if existing > 0:
        print(f"  [OK] {existing} ROM(s) ja presentes")
    else:
        print("  [--] Nenhuma ROM encontrada")

    print()
    print("  Opcoes:")
    print("    [B] Baixar jogos homebrew inclusos (gratuitos/legais)")
    print("    [I] Informacoes sobre como adicionar seus proprios jogos")
    print("    [P] Pular")
    print()

    choice = input("  Escolha [B/I/P]: ").strip().upper()

    if choice == "B":
        download_homebrew_games()
    elif choice == "I":
        print()
        print("  Para adicionar seus proprios jogos:")
        print(f"    1. Copie arquivos .nes para: {os.path.join(GAMES_BASE, 'nes')}")
        print(f"    2. Copie arquivos .gb/.gbc para: {os.path.join(GAMES_BASE, 'gb')}")
        print(f"    3. Copie arquivos .gba para: {os.path.join(GAMES_BASE, 'gba')}")
        print(f"    4. Copie arquivos .smc/.sfc para: {os.path.join(GAMES_BASE, 'snes')}")
        print(f"    5. Copie arquivos .md/.gen para: {os.path.join(GAMES_BASE, 'genesis')}")
        print()
        print("  Os jogos aparecerao automaticamente no app 'Jogos' do Bunker OS.")
        print("  Use apenas jogos homebrew ou que voce possua legalmente.")
        print()
    else:
        print("  [OK] Jogos pulados.")


def download_homebrew_games():
    """Download homebrew game ROMs."""
    print()
    ok = 0
    for game in GAMES_CATALOG:
        sys_dir = os.path.join(GAMES_BASE, game["system"])
        os.makedirs(sys_dir, exist_ok=True)
        filepath = os.path.join(sys_dir, game["filename"])

        if os.path.exists(filepath):
            print(f"  [OK] {game['name']} ({game['system'].upper()}) ja existe")
            ok += 1
            continue

        print(f"  [..] Baixando {game['name']} ({game['system'].upper()})...", end="", flush=True)
        try:
            req = urllib.request.Request(game["url"], headers={"User-Agent": "BunkerAI/4.0"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                with open(filepath, "wb") as f:
                    f.write(resp.read())
            print(f" OK ({game['size_kb']} KB)")
            ok += 1
        except Exception as e:
            print(f" ERRO: {e}")
            if os.path.exists(filepath):
                os.unlink(filepath)

    print()
    print(f"  {ok}/{len(GAMES_CATALOG)} jogos homebrew prontos!")
    total = count_roms()
    print(f"  Total de ROMs: {total}")
    print()


EMU_CDN = "https://cdn.emulatorjs.org/stable/data"
EMU_CORES = {
    "fceumm": "cores/fceumm-legacy-wasm.data",
    "snes9x": "cores/snes9x-legacy-wasm.data",
    "gambatte": "cores/gambatte-legacy-wasm.data",
    "mgba": "cores/mgba-legacy-wasm.data",
    "genesis_plus_gx": "cores/genesis_plus_gx-legacy-wasm.data",
}
EMU_SUPPORT_FILES = [
    "emulator.min.js",
    "emulator.min.css",
    "loader.js",
    "compression/extract7z.js",
]

def offer_emulator_download():
    """Download EmulatorJS cores for fully offline play."""
    emu_dir = Path("static") / "emulator"
    cores_dir = emu_dir / "cores"
    print("═" * 55)
    print("  EMULATORJS — Cores para jogo offline")
    print("═" * 55)
    existing = sum(1 for c in EMU_CORES.values() if (emu_dir / c).exists())
    print(f"  Cores instalados: {existing}/{len(EMU_CORES)}")
    if existing == len(EMU_CORES):
        print("  ✔ Todos os cores já estão instalados!")
        return
    choice = input("\n  [D] Baixar cores  [S] Pular\n  > ").strip().upper()
    if choice != "D":
        return
    cores_dir.mkdir(parents=True, exist_ok=True)
    comp_dir = emu_dir / "compression"
    comp_dir.mkdir(parents=True, exist_ok=True)
    # Download cores
    for name, path in EMU_CORES.items():
        dest = emu_dir / path
        if dest.exists():
            print(f"  ✔ {name} já existe")
            continue
        url = f"{EMU_CDN}/{path}"
        print(f"  ⬇ Baixando {name}...", end=" ", flush=True)
        try:
            urllib.request.urlretrieve(url, str(dest))
            sz = dest.stat().st_size / 1024 / 1024
            print(f"OK ({sz:.1f} MB)")
        except Exception as e:
            print(f"ERRO: {e}")
    # Download support files
    for path in EMU_SUPPORT_FILES:
        dest = emu_dir / path
        if dest.exists():
            continue
        url = f"{EMU_CDN}/{path}"
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(url, str(dest))
        except Exception:
            pass
    print("  ✔ Cores do emulador instalados!")
    print()


# ── Map regions for offline use ────────────────────────────────────────────────

MAPS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "maps")
PROTOMAPS_BUILD = "https://build.protomaps.com/20260317.pmtiles"

MAP_REGIONS = [
    {"id": "world_basic", "name": "Mundo Basico (zoom 0-5)", "maxzoom": 5, "bbox": "-180,-85,180,85", "est_mb": 17},
    {"id": "brazil", "name": "Brasil (zoom 0-10)", "maxzoom": 10, "bbox": "-74.0,-34.0,-34.0,6.0", "est_mb": 250},
    {"id": "south_america", "name": "America do Sul (zoom 0-8)", "maxzoom": 8, "bbox": "-82.0,-56.0,-34.0,13.0", "est_mb": 200},
    {"id": "north_america", "name": "America do Norte (zoom 0-8)", "maxzoom": 8, "bbox": "-170.0,15.0,-50.0,72.0", "est_mb": 300},
    {"id": "europe", "name": "Europa (zoom 0-8)", "maxzoom": 8, "bbox": "-25.0,34.0,45.0,72.0", "est_mb": 350},
]


def offer_maps_download():
    """Offer offline map downloads."""
    print("\n" + "=" * 60)
    print("🗺️  MAPAS OFFLINE")
    print("=" * 60)
    print("Mapas sao ESSENCIAIS para sobrevivencia (navegacao, rotas, pontos de agua).\n")

    os.makedirs(MAPS_DIR, exist_ok=True)
    existing = [f for f in os.listdir(MAPS_DIR) if f.endswith(".pmtiles")]
    if existing:
        print(f"  Mapas ja instalados: {', '.join(existing)}")

    # Check for pmtiles CLI
    pmtiles_bin = shutil.which("pmtiles")
    if not pmtiles_bin:
        tools_dir = os.path.dirname(os.path.abspath(__file__))
        for name in ["pmtiles.exe", "pmtiles"]:
            candidate = os.path.join(tools_dir, name)
            if os.path.exists(candidate):
                pmtiles_bin = candidate
                break

    if not pmtiles_bin:
        print("  ⚠ pmtiles CLI nao encontrado. Baixe em:")
        print("    https://github.com/protomaps/go-pmtiles/releases")
        print("    Coloque em tools/pmtiles.exe e rode novamente.")
        print()
        resp = input("  [P] Pular mapas: ").strip().upper()
        return

    print("  Opcoes:")
    print(f"  [M] Mapa mundial basico (~17 MB) [RECOMENDADO]")
    print(f"  [B] Brasil detalhado (~250 MB)")
    print(f"  [A] America do Sul (~200 MB)")
    print(f"  [T] Todos os mapas basicos")
    print(f"  [P] Pular")
    print()

    choice = input("  Escolha [M/B/A/T/P]: ").strip().upper()

    to_download = []
    if choice == "M":
        to_download = [MAP_REGIONS[0]]
    elif choice == "B":
        to_download = [MAP_REGIONS[0], MAP_REGIONS[1]]  # world basic + brazil
    elif choice == "A":
        to_download = [MAP_REGIONS[0], MAP_REGIONS[2]]  # world basic + south america
    elif choice == "T":
        to_download = MAP_REGIONS[:3]  # world + brazil + south america
    elif choice == "P":
        print("  Pulando mapas.")
        return
    else:
        print("  Opcao invalida, pulando.")
        return

    for region in to_download:
        outfile = os.path.join(MAPS_DIR, f"{region['id']}.pmtiles")
        if os.path.exists(outfile):
            size_mb = os.path.getsize(outfile) / (1024 * 1024)
            print(f"  ✓ {region['name']} ja existe ({size_mb:.1f} MB)")
            continue

        print(f"\n  Baixando {region['name']} (~{region['est_mb']} MB)...")
        print(f"  Isso pode levar alguns minutos...")

        cmd = [
            pmtiles_bin, "extract",
            PROTOMAPS_BUILD, outfile,
            f"--maxzoom={region['maxzoom']}",
            f"--bbox={region['bbox']}",
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
            if result.returncode == 0 and os.path.exists(outfile):
                size_mb = os.path.getsize(outfile) / (1024 * 1024)
                print(f"  ✓ {region['name']} — {size_mb:.1f} MB")
            else:
                print(f"  ✗ Erro: {result.stderr[:200]}")
        except subprocess.TimeoutExpired:
            print(f"  ✗ Timeout (mapa muito grande?)")
        except Exception as e:
            print(f"  ✗ Erro: {e}")

    total = [f for f in os.listdir(MAPS_DIR) if f.endswith(".pmtiles")]
    print(f"\n  {len(total)} mapa(s) offline prontos!")


def main_with_games():
    """Extended main that also offers games and maps after models."""
    main()
    offer_games_download()
    offer_emulator_download()
    offer_maps_download()


if __name__ == "__main__":
    main_with_games()
