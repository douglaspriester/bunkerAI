#!/usr/bin/env python3
"""
setup_downloads.py — Auto-setup orchestrator for Bunker AI.

Called by start.bat after venv activation and pip install.
Creates directory structure, downloads external content, generates
embedded indexes, populates SQLite book catalog, and writes the
data/.setup_complete marker so subsequent launches skip setup.

Uses only Python stdlib (no third-party packages required).
"""

import json
import os
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
STATIC = ROOT / "static"
SETUP_MARKER = DATA / ".setup_complete"

DIRS = [
    DATA / "guides",
    DATA / "protocols",
    DATA / "games",
    DATA / "books",
    DATA / "media",
    DATA / "db",
    DATA / "zim",
    ROOT / "voice_models",
    STATIC / "lib",
    ROOT / "tools",
]

# ── ANSI helpers ─────────────────────────────────────────────────────────────

_COLOR = hasattr(sys.stdout, "isatty") and sys.stdout.isatty()

def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _COLOR else text

def green(t: str)  -> str: return _c("32", t)
def yellow(t: str) -> str: return _c("33", t)
def red(t: str)    -> str: return _c("31", t)
def cyan(t: str)   -> str: return _c("36", t)
def bold(t: str)   -> str: return _c("1", t)

def info(msg: str)    -> None: print(f"  {green('[OK]')}  {msg}")
def warn(msg: str)    -> None: print(f"  {yellow('[!!]')}  {msg}")
def fail(msg: str)    -> None: print(f"  {red('[ERR]')} {msg}")
def step(msg: str)    -> None: print(f"\n{bold(cyan('>>>'))} {bold(msg)}")

# ── Download infrastructure ──────────────────────────────────────────────────

def download_file(url: str, dest: Path, desc: str, min_size: int = 512) -> bool:
    """Download *url* to *dest* with a progress bar.

    * Skips if *dest* already exists and is larger than *min_size* bytes.
    * Supports resume via Content-Range when the server allows it.
    * Returns True on success, False on failure (never raises).
    """
    if dest.exists() and dest.stat().st_size > min_size:
        info(f"{desc} — already exists, skipping")
        return True

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    existing = tmp.stat().st_size if tmp.exists() else 0

    req = urllib.request.Request(url, headers={"User-Agent": "BunkerAI-Setup/1.0"})
    if existing > 0:
        req.add_header("Range", f"bytes={existing}-")

    try:
        resp = urllib.request.urlopen(req, timeout=60)
    except (urllib.error.URLError, OSError) as exc:
        fail(f"{desc} — connection failed: {exc}")
        return False

    # Determine total size
    content_length = resp.headers.get("Content-Length")
    if resp.status == 206:  # partial content — resume worked
        total = existing + int(content_length) if content_length else None
    else:
        total = int(content_length) if content_length else None
        existing = 0  # server didn't honor Range — start over

    mode = "ab" if resp.status == 206 else "wb"
    downloaded = existing
    chunk_size = 1 << 16  # 64 KiB

    try:
        with open(tmp, mode) as fp:
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                fp.write(chunk)
                downloaded += len(chunk)
                _print_progress(desc, downloaded, total)
        print()  # newline after progress
    except (OSError, urllib.error.URLError) as exc:
        print()
        fail(f"{desc} — download interrupted: {exc}")
        return False
    finally:
        resp.close()

    # Atomically rename tmp → dest
    try:
        if dest.exists():
            dest.unlink()
        tmp.rename(dest)
    except OSError:
        # Windows fallback: rename can fail if dest is locked
        import shutil
        shutil.move(str(tmp), str(dest))

    info(f"{desc} — {_human_size(downloaded)}")
    return True


def _print_progress(desc: str, current: int, total: int | None) -> None:
    if total and total > 0:
        pct = current * 100 / total
        bar_w = 30
        filled = int(bar_w * current / total)
        bar = "#" * filled + "-" * (bar_w - filled)
        line = f"\r  [DL]  {desc}  [{bar}] {pct:5.1f}%  {_human_size(current)}/{_human_size(total)}"
    else:
        line = f"\r  [DL]  {desc}  {_human_size(current)}"
    print(line, end="", flush=True)


def _human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if abs(n) < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024  # type: ignore[assignment]
    return f"{n:.1f} TB"

# ── Directory setup ──────────────────────────────────────────────────────────

def ensure_directories() -> None:
    step("Creating directory structure")
    for d in DIRS:
        d.mkdir(parents=True, exist_ok=True)
    info(f"Ensured {len(DIRS)} directories")

# ── Index generators ─────────────────────────────────────────────────────────

def _write_index(path: Path, data: list, label: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)
    info(f"{label} — {len(data)} entries written")


def generate_guides_index() -> None:
    step("Generating guides index")
    guides = [
        {"id": "water",              "title": "Purificação e Obtenção de Água",   "category": "essencial",       "icon": "\U0001f4a7"},
        {"id": "fire",               "title": "Técnicas de Fogo",                 "category": "essencial",       "icon": "\U0001f525"},
        {"id": "shelter",            "title": "Construção de Abrigos",            "category": "essencial",       "icon": "\U0001f3e0"},
        {"id": "firstaid",           "title": "Primeiros Socorros",               "category": "médico",          "icon": "\U0001f3e5"},
        {"id": "food-foraging",      "title": "Alimentação e Forrageamento",      "category": "essencial",       "icon": "\U0001f33f"},
        {"id": "navigation",         "title": "Navegação sem GPS",                "category": "mobilidade",      "icon": "\U0001f9ed"},
        {"id": "radio-comms",        "title": "Comunicação por Rádio",            "category": "comunicação",     "icon": "\U0001f4fb"},
        {"id": "hygiene-sanitation", "title": "Higiene e Saneamento",             "category": "saúde",           "icon": "\U0001f9fc"},
        {"id": "defense-security",   "title": "Defesa e Segurança",               "category": "segurança",       "icon": "\U0001f6e1\ufe0f"},
        {"id": "mental-health",      "title": "Saúde Mental e Resiliência",       "category": "saúde",           "icon": "\U0001f9e0"},
        {"id": "power-electricity",  "title": "Energia e Eletricidade",           "category": "infraestrutura",  "icon": "\u26a1"},
        {"id": "tools-repair",       "title": "Ferramentas e Reparos",            "category": "infraestrutura",  "icon": "\U0001f527"},
        {"id": "knots-ropes",        "title": "Nós e Cordas",                     "category": "habilidades",     "icon": "\U0001faa2"},
        {"id": "medicine-plants",    "title": "Plantas Medicinais",               "category": "médico",          "icon": "\U0001f331"},
        {"id": "weather-prediction", "title": "Previsão do Tempo",                "category": "mobilidade",      "icon": "\U0001f324\ufe0f"},
    ]
    _write_index(DATA / "guides" / "_index.json", guides, "Guides index")


def generate_protocols_index() -> None:
    step("Generating protocols index")
    protocols = [
        {"id": "cpr",             "title": "RCP — Ressuscitação Cardiopulmonar",    "urgency": "critical", "icon": "\u2764\ufe0f"},
        {"id": "bleeding",        "title": "Hemorragia Grave",                      "urgency": "critical", "icon": "\U0001fa78"},
        {"id": "choking",         "title": "Engasgo / Obstrução de Vias Aéreas",    "urgency": "critical", "icon": "\U0001f630"},
        {"id": "burn",            "title": "Queimaduras",                            "urgency": "high",     "icon": "\U0001f525"},
        {"id": "fracture",        "title": "Fraturas e Imobilização",                "urgency": "high",     "icon": "\U0001f9b4"},
        {"id": "hypothermia",     "title": "Hipotermia",                             "urgency": "high",     "icon": "\U0001f976"},
        {"id": "dehydration",     "title": "Desidratação",                           "urgency": "medium",   "icon": "\U0001f4a7"},
        {"id": "snake-bite",      "title": "Picada de Cobra",                        "urgency": "critical", "icon": "\U0001f40d"},
        {"id": "wound-infection", "title": "Infecção de Ferimentos",                 "urgency": "medium",   "icon": "\U0001fa79"},
        {"id": "shock",           "title": "Choque (Estado de Choque)",              "urgency": "critical", "icon": "\u26a1"},
    ]
    _write_index(DATA / "protocols" / "_index.json", protocols, "Protocols index")


def generate_games_index() -> None:
    step("Generating games index")
    games = [
        {"id": "snake",       "name": "Snake",        "icon": "\U0001f40d", "desc": "Clássico jogo da cobrinha"},
        {"id": "tetris",      "name": "Tetris",       "icon": "\U0001f9f1", "desc": "Encaixe os blocos"},
        {"id": "2048",        "name": "2048",          "icon": "\U0001f522", "desc": "Combine os números"},
        {"id": "minesweeper", "name": "Campo Minado",  "icon": "\U0001f4a3", "desc": "Encontre as minas"},
        {"id": "sudoku",      "name": "Sudoku",        "icon": "\U0001f4dd", "desc": "Preencha a grade 9x9"},
        {"id": "solitaire",   "name": "Paciência",     "icon": "\U0001f0cf", "desc": "Jogo de cartas clássico"},
        {"id": "chess",        "name": "Xadrez",       "icon": "\u265f\ufe0f", "desc": "Xadrez para 2 jogadores"},
        {"id": "checkers",     "name": "Damas",        "icon": "\u26ab",     "desc": "Jogo de damas clássico"},
    ]
    _write_index(DATA / "games" / "_index.json", games, "Games index")

# ── JS library downloads ─────────────────────────────────────────────────────

JS_LIBS = [
    (
        "https://cdn.jsdelivr.net/npm/minisearch/dist/minisearch.min.js",
        STATIC / "lib" / "minisearch.min.js",
        "MiniSearch",
    ),
    (
        "https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js",
        STATIC / "lib" / "epub.min.js",
        "epub.js 0.3.93",
    ),
    (
        "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
        STATIC / "lib" / "jszip.min.js",
        "JSZip 3.10.1",
    ),
]

# Also generate a lib index so the frontend can discover vendorized libs
def generate_lib_index() -> None:
    libs = []
    lib_dir = STATIC / "lib"
    if lib_dir.exists():
        for f in sorted(lib_dir.iterdir()):
            if f.is_file() and f.suffix == ".js":
                libs.append({"file": f.name, "size": f.stat().st_size})
    _write_index(lib_dir / "_index.json", libs, "Lib index")


def download_js_libs() -> None:
    step("Downloading JS libraries")
    for url, dest, desc in JS_LIBS:
        download_file(url, dest, desc, min_size=1024)
    generate_lib_index()

# ── Kiwix ────────────────────────────────────────────────────────────────────

KIWIX_URL = "https://download.kiwix.org/release/kiwix-tools/kiwix-tools_win-x86_64-3.8.1.zip"
KIWIX_EXE = ROOT / "tools" / "kiwix-serve.exe"

# Wikipedia mini — ~400MB (all articles, no images)
# Browse options at https://download.kiwix.org/zim/wikipedia/
# Using "mini" variant: text-only, smallest useful version
ZIM_URL = "https://download.kiwix.org/zim/wikipedia/wikipedia_en_all_mini_2024-10.zim"
ZIM_DEST = DATA / "zim" / "wikipedia_en_all_mini.zim"


def download_kiwix() -> None:
    step("Downloading Kiwix tools")
    if KIWIX_EXE.exists() and KIWIX_EXE.stat().st_size > 10_000:
        info("kiwix-serve.exe already present, skipping")
        return

    zip_dest = ROOT / "tools" / "kiwix-tools.zip"
    ok = download_file(KIWIX_URL, zip_dest, "kiwix-tools (Windows x86_64)")
    if not ok:
        warn("Could not download Kiwix tools — offline wiki will be unavailable")
        return

    # Extract kiwix-serve.exe from the zip
    try:
        with zipfile.ZipFile(zip_dest, "r") as zf:
            exe_found = False
            for member in zf.namelist():
                if member.endswith("kiwix-serve.exe"):
                    # Extract to tools/ flattening the internal directory
                    target = ROOT / "tools" / "kiwix-serve.exe"
                    with zf.open(member) as src, open(target, "wb") as dst:
                        dst.write(src.read())
                    exe_found = True
                    info("Extracted kiwix-serve.exe")
                    break
            if not exe_found:
                warn("kiwix-serve.exe not found inside the zip archive")
    except (zipfile.BadZipFile, OSError) as exc:
        fail(f"Failed to extract kiwix-tools: {exc}")
    finally:
        # Clean up the zip to save space
        try:
            zip_dest.unlink()
        except OSError:
            pass


def download_zim() -> None:
    step("Downloading Wikipedia ZIM (this may take a while)")
    if ZIM_DEST.exists() and ZIM_DEST.stat().st_size > 1_000_000:
        info("ZIM file already present, skipping")
        return

    warn(
        "Wikipedia mini ZIM is ~400 MB+. The URL may be outdated.\n"
        "         If download fails, manually place a .zim file in data/zim/\n"
        "         You can browse available ZIMs at https://download.kiwix.org/zim/"
    )
    ok = download_file(ZIM_URL, ZIM_DEST, "Wikipedia EN mini ZIM", min_size=1_000_000)
    if not ok:
        warn("ZIM download failed — you can download it manually later")

# ── PMTiles map download ─────────────────────────────────────────────────────

# Protomaps daily builds — full planet (~120GB) at build.protomaps.com/YYYYMMDD.pmtiles
# We use the `pmtiles` CLI to extract a low-zoom subset (~60MB world, zoom 0-6)
# If CLI is not available, we skip (user can manually place .pmtiles files)
PMTILES_DEST = STATIC / "maps" / "world.pmtiles"
PMTILES_CLI_URLS = {
    "win32": "https://github.com/protomaps/go-pmtiles/releases/latest/download/go-pmtiles_Windows_x86_64.zip",
    "linux": "https://github.com/protomaps/go-pmtiles/releases/latest/download/go-pmtiles_Linux_x86_64.tar.gz",
    "darwin": "https://github.com/protomaps/go-pmtiles/releases/latest/download/go-pmtiles_Darwin_arm64.tar.gz",
}
# Use a known good build date
PMTILES_BUILD_URL = "https://build.protomaps.com/20260217.pmtiles"


def download_pmtiles() -> None:
    step("Downloading offline world map (PMTiles)")
    maps_dir = STATIC / "maps"
    maps_dir.mkdir(parents=True, exist_ok=True)

    # Check if any .pmtiles already exists
    existing = list(maps_dir.glob("*.pmtiles"))
    if existing and any(f.stat().st_size > 100_000 for f in existing):
        info(f"Map file already present: {existing[0].name}, skipping")
        return

    # Try to find or download pmtiles CLI
    pmtiles_exe = _find_pmtiles_cli()
    if not pmtiles_exe:
        pmtiles_exe = _download_pmtiles_cli()

    if pmtiles_exe:
        # Extract low-zoom world map (~60 MB) via HTTP range requests
        info("Extraindo mapa mundial zoom 0-6 (pode levar alguns minutos)...")
        try:
            result = subprocess.run(
                [str(pmtiles_exe), "extract", PMTILES_BUILD_URL,
                 str(PMTILES_DEST), "--maxzoom=6"],
                capture_output=True, text=True, timeout=600,
            )
            if PMTILES_DEST.exists() and PMTILES_DEST.stat().st_size > 100_000:
                size_mb = PMTILES_DEST.stat().st_size / (1024 * 1024)
                info(f"Mapa mundial offline pronto! ({size_mb:.1f} MB)")
                return
            else:
                warn(f"pmtiles extract falhou: {result.stderr[:200]}")
        except (subprocess.TimeoutExpired, OSError) as e:
            warn(f"pmtiles extract erro: {e}")

    warn(
        "Nao foi possivel baixar mapa automaticamente.\n"
        "         Coloque arquivos .pmtiles em static/maps/ manualmente.\n"
        "         Ou instale o CLI: https://github.com/protomaps/go-pmtiles/releases"
    )


def _find_pmtiles_cli():
    """Check if pmtiles CLI is available on PATH or in tools/."""
    import shutil as _sh
    # Check PATH
    found = _sh.which("pmtiles")
    if found:
        return found
    # Check tools/ dir
    ext = ".exe" if sys.platform == "win32" else ""
    local = ROOT / "tools" / f"pmtiles{ext}"
    if local.exists():
        return str(local)
    return None


def _download_pmtiles_cli():
    """Download pmtiles CLI binary for current platform."""
    platform_key = "win32" if sys.platform == "win32" else ("darwin" if sys.platform == "darwin" else "linux")
    url = PMTILES_CLI_URLS.get(platform_key)
    if not url:
        return None

    ext = ".exe" if sys.platform == "win32" else ""
    dest_bin = ROOT / "tools" / f"pmtiles{ext}"
    if dest_bin.exists():
        return str(dest_bin)

    archive_name = url.split("/")[-1]
    archive_path = ROOT / "tools" / archive_name
    ok = download_file(url, archive_path, f"pmtiles CLI ({platform_key})", min_size=1000)
    if not ok:
        return None

    try:
        if archive_name.endswith(".zip"):
            with zipfile.ZipFile(archive_path, "r") as zf:
                for member in zf.namelist():
                    if "pmtiles" in member.lower() and (member.endswith(".exe") or "/" not in member):
                        with zf.open(member) as src, open(dest_bin, "wb") as dst:
                            dst.write(src.read())
                        break
        elif archive_name.endswith(".tar.gz"):
            import tarfile
            with tarfile.open(archive_path, "r:gz") as tf:
                for member in tf.getmembers():
                    if "pmtiles" in member.name.lower() and member.isfile():
                        f = tf.extractfile(member)
                        if f:
                            dest_bin.write_bytes(f.read())
                        break
            if dest_bin.exists() and sys.platform != "win32":
                os.chmod(str(dest_bin), 0o755)

        archive_path.unlink(missing_ok=True)

        if dest_bin.exists() and dest_bin.stat().st_size > 1000:
            info(f"pmtiles CLI instalado em tools/")
            return str(dest_bin)
    except Exception as e:
        warn(f"Falha ao extrair pmtiles CLI: {e}")
        archive_path.unlink(missing_ok=True)

    return None

# ── SQLite book catalog ──────────────────────────────────────────────────────

BUNKER_DB = DATA / "db" / "bunker.db"

# ─── Built-in books (public domain, survival-related) ────────────────────────
# From Project Gutenberg and Standard Ebooks — free for redistribution
BUILTIN_BOOKS = [
    # ─── Sobrevivência & Habilidades ───
    {
        "url": "https://www.gutenberg.org/ebooks/44653.epub3.images",
        "filename": "Manual-Woodcraft-Camping-Beard.epub",
        "title": "Manual of Woodcraft and Camping",
    },
    {
        "url": "https://www.gutenberg.org/ebooks/56210.epub3.images",
        "filename": "Book-of-Camp-Lore-Woodcraft.epub",
        "title": "The Book of Camp-Lore and Woodcraft",
    },
    {
        "url": "https://www.gutenberg.org/ebooks/28255.epub3.images",
        "filename": "Art-of-War-Sun-Tzu.epub",
        "title": "A Arte da Guerra — Sun Tzu",
    },
    {
        "url": "https://www.gutenberg.org/ebooks/18241.epub3.images",
        "filename": "Boy-Scout-Handbook-1911.epub",
        "title": "Boy Scout Handbook (1911)",
    },
    {
        "url": "https://www.gutenberg.org/ebooks/13882.epub3.images",
        "filename": "Bushcraft-Handbook-Australia.epub",
        "title": "The Bushman's Handbook",
    },
    # ─── Aventura & Ficção ───
    {
        "url": "https://www.gutenberg.org/ebooks/1184.epub3.images",
        "filename": "Count-of-Monte-Cristo-Dumas.epub",
        "title": "O Conde de Monte Cristo",
    },
    {
        "url": "https://www.gutenberg.org/ebooks/345.epub3.images",
        "filename": "Dracula-Bram-Stoker.epub",
        "title": "Drácula — Bram Stoker",
    },
    {
        "url": "https://www.gutenberg.org/ebooks/84.epub3.images",
        "filename": "Frankenstein-Mary-Shelley.epub",
        "title": "Frankenstein",
    },
    {
        "url": "https://www.gutenberg.org/ebooks/2701.epub3.images",
        "filename": "Moby-Dick-Herman-Melville.epub",
        "title": "Moby Dick",
    },
    {
        "url": "https://www.gutenberg.org/ebooks/1661.epub3.images",
        "filename": "Sherlock-Holmes-Adventures.epub",
        "title": "Aventuras de Sherlock Holmes",
    },
    {
        "url": "https://www.gutenberg.org/ebooks/215.epub3.images",
        "filename": "Call-of-the-Wild-Jack-London.epub",
        "title": "O Chamado da Selva — Jack London",
    },
    {
        "url": "https://www.gutenberg.org/ebooks/5740.epub3.images",
        "filename": "Scarlet-Pimpernel-Orczy.epub",
        "title": "The Scarlet Pimpernel",
    },
    # ─── Ciência & Conhecimento ───
    {
        "url": "https://www.gutenberg.org/ebooks/36.epub3.images",
        "filename": "War-of-the-Worlds-HG-Wells.epub",
        "title": "Guerra dos Mundos — H.G. Wells",
    },
    {
        "url": "https://www.gutenberg.org/ebooks/4300.epub3.images",
        "filename": "Ulysses-James-Joyce.epub",
        "title": "Ulysses — James Joyce",
    },
    {
        "url": "https://www.gutenberg.org/ebooks/1342.epub3.images",
        "filename": "Pride-and-Prejudice-Austen.epub",
        "title": "Orgulho e Preconceito",
    },
]

# ─── Built-in music (public domain classical/jazz, lightweight MP3/OGG) ──────
# From Musopen.org, IMSLP, and Internet Archive — royalty-free recordings
BUILTIN_MUSIC = [
    # Classical — small MP3 files, iconic pieces
    {
        "url": "https://archive.org/download/DebussyClairDeLune/Debussy-ClairDeLune.mp3",
        "filename": "Debussy-Clair-de-Lune.mp3",
        "title": "Debussy — Clair de Lune",
    },
    {
        "url": "https://archive.org/download/ErikSatieGymnopedies/Gymnopedie1.mp3",
        "filename": "Satie-Gymnopedie-No1.mp3",
        "title": "Satie — Gymnopédie No.1",
    },
    {
        "url": "https://archive.org/download/BachCelloSuiteNo1/01-prelude.mp3",
        "filename": "Bach-Cello-Suite-1-Prelude.mp3",
        "title": "Bach — Cello Suite No.1 Prelude",
    },
    {
        "url": "https://archive.org/download/MoonlightSonata_201802/beethoven_moonlight_sonata.mp3",
        "filename": "Beethoven-Moonlight-Sonata.mp3",
        "title": "Beethoven — Moonlight Sonata",
    },
    {
        "url": "https://archive.org/download/ChopinNocturneOpus9No2/chopinnocturne.mp3",
        "filename": "Chopin-Nocturne-Op9-No2.mp3",
        "title": "Chopin — Nocturne Op.9 No.2",
    },
    # Jazz — public domain classics
    {
        "url": "https://archive.org/download/DavebrubeckTakeFive/Dave%20Brubeck%20-%20Take%20Five.mp3",
        "filename": "Brubeck-Take-Five.mp3",
        "title": "Dave Brubeck — Take Five",
    },
    {
        "url": "https://archive.org/download/LouisArmstrongWhatAWonderfulWorld/Louis%20Armstrong%20-%20What%20A%20Wonderful%20World.mp3",
        "filename": "Armstrong-What-A-Wonderful-World.mp3",
        "title": "Louis Armstrong — What a Wonderful World",
    },
]


def download_builtin_books():
    """Download free survival/adventure books from Project Gutenberg."""
    step("Downloading built-in books")
    books_dir = DATA / "books"
    books_dir.mkdir(parents=True, exist_ok=True)

    for book in BUILTIN_BOOKS:
        dest = books_dir / book["filename"]
        if dest.exists():
            info(f"  {book['title']} (ja existe)")
            continue
        ok = _download_file(book["url"], dest, book["title"])
        if not ok:
            warn(f"  Falha: {book['title']}")


def download_builtin_music():
    """Download free classical/jazz music from Internet Archive."""
    step("Downloading built-in music")
    media_dir = DATA / "media"
    media_dir.mkdir(parents=True, exist_ok=True)

    for track in BUILTIN_MUSIC:
        dest = media_dir / track["filename"]
        if dest.exists():
            info(f"  {track['title']} (ja existe)")
            continue
        ok = _download_file(track["url"], dest, track["title"])
        if not ok:
            warn(f"  Falha: {track['title']}")


def _download_file(url, dest, label=""):
    """Download a file with error handling."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BunkerAI/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            dest.write_bytes(data)
            mb = len(data) / 1048576
            info(f"  {label or dest.name} ({mb:.1f} MB)")
            return True
    except Exception as e:
        warn(f"  {label}: {e}")
        return False


# ── Piper TTS model (pre-download) ──────────────────────────────────────────

PIPER_HF_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"
PIPER_DEFAULT_MODEL = {
    "id": "pt_BR-faber-medium",
    "lang": "pt", "lang_code": "pt_BR", "speaker": "faber", "quality": "medium",
    "desc": "Português BR — Masculino (recomendado)", "size_mb": 63,
}


def download_piper_model():
    """Pre-download the default Piper TTS voice model so the setup modal doesn't appear."""
    step("Downloading default TTS voice model (Piper)")
    voice_dir = ROOT / "voice_models"
    voice_dir.mkdir(parents=True, exist_ok=True)

    m = PIPER_DEFAULT_MODEL
    onnx_file = voice_dir / f"{m['id']}.onnx"
    json_file = voice_dir / f"{m['id']}.onnx.json"

    base = f"{PIPER_HF_BASE}/{m['lang']}/{m['lang_code']}/{m['speaker']}/{m['quality']}"
    onnx_url = f"{base}/{m['lang_code']}-{m['speaker']}-{m['quality']}.onnx"
    json_url = f"{base}/{m['lang_code']}-{m['speaker']}-{m['quality']}.onnx.json"

    # Download .onnx model (~63 MB)
    download_file(onnx_url, onnx_file, f"Piper TTS — {m['desc']}", min_size=1000)
    # Download .onnx.json config (tiny)
    download_file(json_url, json_file, f"Piper TTS config", min_size=50)


def _title_from_filename(name: str) -> str:
    """Derive a human-readable title from an epub filename."""
    stem = Path(name).stem
    for ch in ("-", "_", "."):
        stem = stem.replace(ch, " ")
    return stem.strip().title()


def scan_and_catalog_books() -> None:
    step("Scanning book catalog")
    books_dir = DATA / "books"
    books_dir.mkdir(parents=True, exist_ok=True)

    epubs = list(books_dir.glob("*.epub"))

    conn = sqlite3.connect(str(BUNKER_DB))
    cur = conn.cursor()
    # Use the same schema as server.py
    cur.execute("""
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT DEFAULT '',
            file TEXT NOT NULL,
            lang TEXT DEFAULT 'pt',
            size_kb INTEGER DEFAULT 0,
            read_pct REAL DEFAULT 0
        )
    """)
    conn.commit()

    inserted = 0
    skipped = 0
    for epub in epubs:
        filename = epub.name
        # Check if already cataloged
        cur.execute("SELECT 1 FROM books WHERE file = ?", (filename,))
        if cur.fetchone():
            skipped += 1
            continue
        title = _title_from_filename(epub.name)
        size_kb = epub.stat().st_size // 1024
        cur.execute(
            "INSERT INTO books (title, author, file, lang, size_kb) VALUES (?, ?, ?, ?, ?)",
            (title, "", filename, "pt", size_kb),
        )
        inserted += 1

    conn.commit()
    conn.close()

    total = inserted + skipped
    info(f"Books DB: {total} epub(s) found, {inserted} new, {skipped} already cataloged")

# ── Setup marker ─────────────────────────────────────────────────────────────

def create_setup_marker() -> None:
    SETUP_MARKER.parent.mkdir(parents=True, exist_ok=True)
    SETUP_MARKER.write_text(
        f"Setup completed at {time.strftime('%Y-%m-%d %H:%M:%S')}\n",
        encoding="utf-8",
    )
    info("Setup marker written")

# ── Banner ───────────────────────────────────────────────────────────────────

BANNER = r"""
 ____              _               _    ___
| __ ) _   _ _ __ | | _____ _ __  / \  |_ _|
|  _ \| | | | '_ \| |/ / _ \ '__|| _ \  | |
| |_) | |_| | | | |   <  __/ |  / ___ \ | |
|____/ \__,_|_| |_|_|\_\___|_| /_/   \_\___|

        S E T U P   O R C H E S T R A T O R
"""

# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    print(bold(cyan(BANNER)))

    if SETUP_MARKER.exists():
        info("Setup already complete — remove data/.setup_complete to re-run")
        return

    t0 = time.time()

    ensure_directories()

    # Generated indexes
    generate_guides_index()
    generate_protocols_index()
    generate_games_index()

    # External downloads
    download_js_libs()
    download_kiwix()
    download_zim()

    # Download free survival-related books + music
    download_builtin_books()
    download_builtin_music()

    # Pre-download default TTS voice
    download_piper_model()

    # Download offline map
    download_pmtiles()

    # Book catalog
    scan_and_catalog_books()

    # Mark done
    create_setup_marker()

    elapsed = time.time() - t0
    print(f"\n{bold(green('Setup complete'))} in {elapsed:.1f}s")
    print(
        f"  Guides:    {DATA / 'guides' / '_index.json'}\n"
        f"  Protocols: {DATA / 'protocols' / '_index.json'}\n"
        f"  Games:     {DATA / 'games' / '_index.json'}\n"
        f"  Books DB:  {BUNKER_DB}\n"
        f"  Libs:      {STATIC / 'lib'}\n"
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{yellow('Setup interrupted by user.')}")
        sys.exit(130)
