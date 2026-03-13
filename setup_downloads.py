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
    DATA / "db",
    DATA / "zim",
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

ZIM_URL = "https://download.kiwix.org/zim/wikipedia/wikipedia_en_all_mini_2025-12.zim"
ZIM_DEST = DATA / "zim" / "wikipedia_en_all_mini_2025-12.zim"


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

# ── PMTiles placeholder ──────────────────────────────────────────────────────

def setup_pmtiles_placeholder() -> None:
    step("PMTiles map data")
    maps_dir = STATIC / "maps"
    maps_dir.mkdir(parents=True, exist_ok=True)
    readme = maps_dir / "README.txt"
    if not readme.exists():
        readme.write_text(
            "Place .pmtiles files here for offline map support.\n\n"
            "Recommended: Brazil base map (protomaps.com or custom extract).\n"
            "The server exposes files from this folder at /maps/<filename>.\n",
            encoding="utf-8",
        )
        info("Created maps/README.txt placeholder")
    else:
        info("maps/ directory ready")

# ── SQLite book catalog ──────────────────────────────────────────────────────

BUNKER_DB = DATA / "db" / "bunker.db"


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

    # PMTiles placeholder
    setup_pmtiles_placeholder()

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
