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


if __name__ == "__main__":
    main()
