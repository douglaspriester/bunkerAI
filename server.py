"""
Bunker AI v4 — Server entry point (thin orchestrator).
Chat unificado: texto, visao, voz (STT offline + TTS offline/online), app builder, mapa, guias.
DON'T PANIC.
"""

import asyncio
import platform
import shutil
import sqlite3
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

# ── Shared state must be imported first so all routers share the same module ──
import routes.config as cfg  # noqa: F401 — initialises dirs, shared globals

# ── Routers ───────────────────────────────────────────────────────────────────
from routes import chat, content, maps, rag, system, tts_stt

app = FastAPI(title="Bunker AI")


# ─── No-cache middleware for JS/CSS/HTML ──────────────────────────────────────
class NoCacheJSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path.endswith(('.js', '.css', '.html')) or path == '/':
            response.headers['Cache-Control'] = 'no-cache, must-revalidate'
        return response


app.add_middleware(NoCacheJSMiddleware)


# ─── Database initialisation ──────────────────────────────────────────────────

def _init_db():
    """Create SQLite tables if they don't exist."""
    conn = sqlite3.connect(str(cfg.DB_PATH))
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS supplies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT DEFAULT 'outros',
            quantity REAL DEFAULT 0,
            unit TEXT DEFAULT 'un',
            expiry TEXT,
            notes TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT DEFAULT '',
            file TEXT NOT NULL,
            lang TEXT DEFAULT 'pt',
            size_kb INTEGER DEFAULT 0,
            read_pct REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS journal (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT UNIQUE NOT NULL,
            content TEXT DEFAULT '',
            mood TEXT DEFAULT 'neutral',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT DEFAULT 'Sem titulo',
            content TEXT DEFAULT '',
            doc_type TEXT DEFAULT 'text',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime'))
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'pending',
            due_date TEXT,
            category TEXT DEFAULT 'geral',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_supplies_category ON supplies(category);
        CREATE INDEX IF NOT EXISTS idx_supplies_name     ON supplies(name);
        CREATE INDEX IF NOT EXISTS idx_supplies_expiry   ON supplies(expiry);
        CREATE INDEX IF NOT EXISTS idx_journal_date      ON journal(date);
        CREATE INDEX IF NOT EXISTS idx_notes_title       ON notes(title);
        CREATE INDEX IF NOT EXISTS idx_notes_updated     ON notes(updated_at);
        CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_category    ON tasks(category);
        CREATE INDEX IF NOT EXISTS idx_tasks_priority    ON tasks(priority);
        CREATE INDEX IF NOT EXISTS idx_tasks_due_date    ON tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_books_title       ON books(title);
    """)
    conn.close()


def _init_rag_db():
    """Create RAG SQLite tables if they don't exist."""
    db_path = Path("data/rag.db")
    db_path.parent.mkdir(exist_ok=True)
    con = sqlite3.connect(str(db_path))
    con.execute("""
        CREATE TABLE IF NOT EXISTS rag_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            chunk_text TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS rag_docs (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            chunk_count INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    con.execute("CREATE INDEX IF NOT EXISTS idx_rag_doc      ON rag_chunks(doc_id)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_rag_filename ON rag_chunks(filename)")
    con.commit()
    con.close()


_init_db()
_init_rag_db()


# ─── PWA icons ────────────────────────────────────────────────────────────────

def _ensure_pwa_icons():
    """Create minimal PWA icon placeholders if they don't exist."""
    import struct
    import zlib as _zlib
    img_dir = Path("static/img")
    img_dir.mkdir(exist_ok=True)

    def make_png(size: int) -> bytes:
        width = height = size
        color = (10, 10, 10, 255)
        raw = b''
        for y in range(height):
            raw += b'\x00'
            for x in range(width):
                raw += bytes(color)
        compressed = _zlib.compress(raw)

        def chunk(name: bytes, data: bytes) -> bytes:
            c = name + data
            return struct.pack('>I', len(data)) + c + struct.pack('>I', _zlib.crc32(c) & 0xffffffff)

        png = b'\x89PNG\r\n\x1a\n'
        png += chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
        png += chunk(b'IDAT', compressed)
        png += chunk(b'IEND', b'')
        return png

    for size in [192, 512]:
        icon_path = img_dir / f"icon-{size}.png"
        if not icon_path.exists():
            try:
                icon_path.write_bytes(make_png(size))
                print(f"[PWA] Icone criado: {icon_path}")
            except Exception as e:
                print(f"[PWA] Erro ao criar icone {size}: {e}")


_ensure_pwa_icons()


# ─── Startup events ───────────────────────────────────────────────────────────

@app.on_event("startup")
async def _startup_detect_backend():
    """Auto-detect LLM backend on startup."""
    await system.detect_backend()


@app.on_event("startup")
async def _auto_start_kiwix():
    """Auto-start Kiwix server if ZIM files exist."""
    import httpx as _hx

    try:
        async with _hx.AsyncClient(timeout=2) as c:
            r = await c.get("http://localhost:8889/")
            if r.status_code == 200:
                print("[WIKI] Kiwix ja rodando na porta 8889")
                return
    except Exception:
        pass

    zim_dir = cfg.DATA_DIR / "zim"
    zims = list(zim_dir.glob("*.zim")) if zim_dir.exists() else []
    if not zims:
        print("[WIKI] Nenhum arquivo ZIM encontrado")
        return

    kiwix_exe = None
    local_kiwix = Path("tools") / ("kiwix-serve.exe" if platform.system() == "Windows" else "kiwix-serve")
    if local_kiwix.exists():
        kiwix_exe = str(local_kiwix)
    else:
        kiwix_exe = shutil.which("kiwix-serve")

    if not kiwix_exe:
        print("[WIKI] kiwix-serve nao encontrado")
        return

    try:
        import subprocess
        zim_args = [str(z) for z in zims]
        subprocess.Popen(
            [kiwix_exe, "--port", "8889"] + zim_args,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        print(f"[WIKI] Kiwix iniciado com {len(zims)} arquivo(s) ZIM")
    except Exception as e:
        print(f"[WIKI] Falha ao iniciar Kiwix: {e}")


# ─── Include routers ──────────────────────────────────────────────────────────

app.include_router(system.router)
app.include_router(chat.router)
app.include_router(tts_stt.router)
app.include_router(content.router)
app.include_router(maps.router)
app.include_router(rag.router)


# ─── Ping (used by launchers for readiness checks) ────────────────────────────

@app.get("/api/ping")
async def ping():
    return {"ok": True}


# ─── PWA manifest ─────────────────────────────────────────────────────────────

@app.get("/manifest.json")
async def pwa_manifest():
    return FileResponse("static/manifest.json", media_type="application/manifest+json")


# ─── Static files (must be last — catches everything else) ───────────────────

app.mount("/", StaticFiles(directory="static", html=True), name="static")


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8888)
