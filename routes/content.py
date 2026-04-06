"""Content endpoints: guides, protocols, supplies, books, games, journal, notes, tasks."""

import json
import sqlite3
from datetime import date, datetime
from pathlib import Path

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response

import routes.config as cfg

router = APIRouter(tags=["content"])


# ─── DB helper ────────────────────────────────────────────────────────────────

def _db():
    """Get a SQLite connection with row factory."""
    conn = sqlite3.connect(str(cfg.DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


# ─── Guides ──────────────────────────────────────────────────────────────────

@router.get("/api/guides")
async def list_guides():
    """List all guides from data/guides/_index.json."""
    idx = cfg.GUIDES_DIR / "_index.json"
    if idx.exists():
        return JSONResponse(json.loads(idx.read_text(encoding="utf-8")))
    guides = []
    for f in sorted(cfg.GUIDES_DIR.glob("*.md")):
        guides.append({"id": f.stem, "title": f.stem.replace("-", " ").title(), "category": "geral"})
    return guides


@router.get("/api/guides/{guide_id}")
async def get_guide(guide_id: str):
    """Return markdown content of a guide."""
    safe = Path(guide_id).stem
    for subdir in [cfg.GUIDES_DIR, cfg.GUIDES_DIR / "disaster-specific"]:
        fp = subdir / f"{safe}.md"
        if fp.exists():
            return Response(fp.read_text(encoding="utf-8"), media_type="text/markdown")
    return JSONResponse({"error": "Guide not found"}, status_code=404)


# ─── Protocols ───────────────────────────────────────────────────────────────

@router.get("/api/protocols")
async def list_protocols():
    """List all emergency protocols."""
    idx = cfg.PROTOCOLS_DIR / "_index.json"
    if idx.exists():
        return JSONResponse(json.loads(idx.read_text(encoding="utf-8")))
    protocols = []
    for f in sorted(cfg.PROTOCOLS_DIR.glob("*.json")):
        if f.name == "_index.json":
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            protocols.append({"id": f.stem, "title": data.get("title", f.stem), "urgency": data.get("urgency", "normal")})
        except json.JSONDecodeError:
            pass
    return protocols


@router.get("/api/protocols/{proto_id}")
async def get_protocol(proto_id: str):
    """Return full decision tree for a protocol."""
    safe = Path(proto_id).stem
    fp = cfg.PROTOCOLS_DIR / f"{safe}.json"
    if fp.exists():
        return JSONResponse(json.loads(fp.read_text(encoding="utf-8")))
    return JSONResponse({"error": "Protocol not found"}, status_code=404)


# ─── Supplies ────────────────────────────────────────────────────────────────

@router.get("/api/supplies")
async def list_supplies(category: str = None):
    """List supplies, optionally filtered by category."""
    conn = _db()
    if category:
        rows = conn.execute("SELECT * FROM supplies WHERE category = ? ORDER BY expiry", (category,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM supplies ORDER BY category, expiry").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/api/supplies/summary")
async def supplies_summary():
    """Aggregated supply dashboard."""
    conn = _db()
    total = conn.execute("SELECT COUNT(*) as c FROM supplies").fetchone()["c"]
    today = date.today().isoformat()
    expiring_7 = conn.execute(
        "SELECT COUNT(*) as c FROM supplies WHERE expiry IS NOT NULL AND expiry != '' AND expiry <= date(?, '+7 days')", (today,)
    ).fetchone()["c"]
    expiring_30 = conn.execute(
        "SELECT COUNT(*) as c FROM supplies WHERE expiry IS NOT NULL AND expiry != '' AND expiry <= date(?, '+30 days')", (today,)
    ).fetchone()["c"]
    categories = conn.execute(
        "SELECT category, COUNT(*) as count, SUM(quantity) as total_qty FROM supplies GROUP BY category ORDER BY count DESC"
    ).fetchall()
    conn.close()
    return {
        "total": total,
        "expiring_7d": expiring_7,
        "expiring_30d": expiring_30,
        "categories": [dict(r) for r in categories],
    }


@router.post("/api/supplies")
async def create_supply(request: Request):
    body = await request.json()
    conn = _db()
    cur = conn.execute(
        "INSERT INTO supplies (name, category, quantity, unit, expiry, notes) VALUES (?, ?, ?, ?, ?, ?)",
        (body.get("name", ""), body.get("category", "outros"), body.get("quantity", 0),
         body.get("unit", "un"), body.get("expiry", ""), body.get("notes", "")),
    )
    conn.commit()
    item_id = cur.lastrowid
    row = conn.execute("SELECT * FROM supplies WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    return dict(row)


@router.put("/api/supplies/{item_id}")
async def update_supply(item_id: int, request: Request):
    body = await request.json()
    conn = _db()
    fields = []
    values = []
    for key in ("name", "category", "quantity", "unit", "expiry", "notes"):
        if key in body:
            fields.append(f"{key} = ?")
            values.append(body[key])
    if not fields:
        conn.close()
        return JSONResponse({"error": "No fields to update"}, status_code=400)
    fields.append("updated_at = datetime('now','localtime')")
    values.append(item_id)
    conn.execute(f"UPDATE supplies SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    row = conn.execute("SELECT * FROM supplies WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    if row:
        return dict(row)
    return JSONResponse({"error": "Not found"}, status_code=404)


@router.delete("/api/supplies/{item_id}")
async def delete_supply(item_id: int):
    conn = _db()
    conn.execute("DELETE FROM supplies WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    return {"deleted": True, "id": item_id}


# ─── Books ────────────────────────────────────────────────────────────────────

@router.get("/api/books")
async def list_books(q: str = None):
    """List books, optionally search by title/author."""
    conn = _db()
    if q:
        rows = conn.execute(
            "SELECT * FROM books WHERE title LIKE ? OR author LIKE ? ORDER BY title",
            (f"%{q}%", f"%{q}%"),
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM books ORDER BY title").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/api/books/{book_id}/file")
async def serve_book(book_id: int):
    """Serve EPUB file."""
    conn = _db()
    row = conn.execute("SELECT * FROM books WHERE id = ?", (book_id,)).fetchone()
    conn.close()
    if not row:
        return JSONResponse({"error": "Book not found"}, status_code=404)
    fp = cfg.BOOKS_DIR / row["file"]
    if fp.exists():
        return FileResponse(str(fp), media_type="application/epub+zip", filename=row["file"])
    return JSONResponse({"error": "File not found"}, status_code=404)


@router.put("/api/books/{book_id}/progress")
async def update_book_progress(book_id: int, request: Request):
    body = await request.json()
    conn = _db()
    conn.execute("UPDATE books SET read_pct = ? WHERE id = ?", (body.get("read_pct", 0), book_id))
    conn.commit()
    conn.close()
    return {"updated": True, "id": book_id}


# ─── Games ───────────────────────────────────────────────────────────────────

@router.get("/api/games")
async def list_games():
    """List available games (HTML + ROM-based)."""
    games = []
    idx = cfg.GAMES_DIR / "_index.json"
    if idx.exists():
        data = json.loads(idx.read_text(encoding="utf-8"))
        if isinstance(data, list):
            games.extend(data)
    else:
        for f in sorted(cfg.GAMES_DIR.glob("*.html")):
            games.append({"id": f.stem, "name": f.stem.replace("-", " ").title(), "file": f.name, "type": "html"})

    for sys_id, exts in cfg.EMU_EXTENSIONS.items():
        sys_dir = cfg.ROMS_DIR / sys_id
        if not sys_dir.is_dir():
            continue
        for ext in exts:
            for rom in sorted(sys_dir.glob(f"*{ext}")):
                title = rom.stem.replace("-", " ").replace("_", " ").title()
                games.append({
                    "id": f"rom:{sys_id}:{rom.name}",
                    "name": title,
                    "title": title,
                    "system": sys_id,
                    "type": "rom",
                    "core": cfg.EMU_CORES.get(sys_id, sys_id),
                })
    return games


@router.get("/api/games/rom-player")
async def rom_player(system: str, rom: str):
    """Generate an EmulatorJS player page for a given ROM."""
    safe_sys = Path(system).name
    safe_rom = Path(rom).name
    rom_path = cfg.ROMS_DIR / safe_sys / safe_rom
    if not rom_path.exists():
        return JSONResponse({"error": "ROM not found"}, status_code=404)
    core = cfg.EMU_CORES.get(safe_sys, safe_sys)
    title = safe_rom.rsplit(".", 1)[0].replace("-", " ").replace("_", " ").title()
    local_cores = cfg.ROMS_DIR.parent / "emulator" / "cores"
    if local_cores.is_dir() and any(local_cores.iterdir()):
        ejs_data = "/emulator/"
        ejs_loader = "/emulator/loader.js"
    else:
        ejs_data = "https://cdn.emulatorjs.org/stable/data/"
        ejs_loader = "https://cdn.emulatorjs.org/stable/data/loader.js"
    html = f"""<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><title>{title}</title>
<style>body{{margin:0;background:#000;overflow:hidden}}#game{{width:100vw;height:100vh}}</style>
</head><body>
<div id="game"></div>
<script>
  EJS_player = '#game';
  EJS_gameUrl = '/games/{safe_sys}/{safe_rom}';
  EJS_core = '{core}';
  EJS_pathtodata = '{ejs_data}';
  EJS_startOnLoaded = true;
  EJS_color = '#1a73e8';
  EJS_backgroundBlur = true;
</script>
<script src="{ejs_loader}"></script>
</body></html>"""
    return HTMLResponse(html)


@router.get("/api/games/{name}")
async def serve_game(name: str):
    """Serve a game HTML file."""
    safe = Path(name).stem
    fp = cfg.GAMES_DIR / f"{safe}.html"
    if fp.exists():
        return HTMLResponse(fp.read_text(encoding="utf-8"))
    return JSONResponse({"error": "Game not found"}, status_code=404)


# ─── Journal ─────────────────────────────────────────────────────────────────

@router.get("/api/journal")
async def list_journal(limit: int = 30):
    """List journal entries, newest first."""
    conn = _db()
    rows = conn.execute("SELECT * FROM journal ORDER BY date DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/api/journal")
async def upsert_journal(request: Request):
    """Create or update journal entry for a date."""
    body = await request.json()
    entry_date = body.get("date", date.today().isoformat())
    content = body.get("content", "")
    mood = body.get("mood", "neutral")
    conn = _db()
    conn.execute(
        "INSERT INTO journal (date, content, mood) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET content=?, mood=?",
        (entry_date, content, mood, content, mood),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM journal WHERE date = ?", (entry_date,)).fetchone()
    conn.close()
    return dict(row)


# ─── Kiwix ───────────────────────────────────────────────────────────────────

@router.get("/api/kiwix/status")
async def kiwix_status():
    """Check if Kiwix is running and list ZIM files."""
    zim_dir = cfg.DATA_DIR / "zim"
    zims = []
    if zim_dir.exists():
        for f in sorted(zim_dir.glob("*.zim")):
            size_gb = f.stat().st_size / (1024 ** 3)
            zims.append({"name": f.stem, "file": f.name, "size_gb": round(size_gb, 2)})

    running = False
    try:
        async with httpx.AsyncClient(timeout=2) as c:
            r = await c.get("http://localhost:8889/")
            running = r.status_code == 200
    except Exception:
        pass

    return {"running": running, "port": 8889, "zim_files": zims}


@router.get("/api/kiwix/{path:path}")
async def kiwix_proxy(path: str, request: Request):
    """Proxy requests to Kiwix server to avoid iframe cross-origin issues."""
    try:
        url = f"http://localhost:8889/{path}"
        qs = str(request.query_params)
        if qs:
            url += f"?{qs}"
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(url)
            content_type = r.headers.get("content-type", "text/html")
            return Response(content=r.content, status_code=r.status_code,
                          media_type=content_type)
    except Exception:
        return JSONResponse({"error": "Kiwix unavailable"}, status_code=503)


# ─── Notes ───────────────────────────────────────────────────────────────────

@router.get("/api/notes")
async def list_notes(doc_type: str = None):
    conn = _db()
    if doc_type:
        rows = conn.execute(
            "SELECT id, title, doc_type, created_at, updated_at FROM notes WHERE doc_type=? ORDER BY updated_at DESC",
            (doc_type,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, title, doc_type, created_at, updated_at FROM notes ORDER BY updated_at DESC"
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/api/notes/{note_id}")
async def get_note(note_id: int):
    conn = _db()
    row = conn.execute("SELECT * FROM notes WHERE id=?", (note_id,)).fetchone()
    conn.close()
    if not row:
        return JSONResponse({"error": "not found"}, 404)
    return dict(row)


@router.post("/api/notes")
async def create_note(request: Request):
    data = await request.json()
    title = data.get("title", "Sem titulo")
    content = data.get("content", "")
    doc_type = data.get("doc_type", "text")
    conn = _db()
    cur = conn.execute(
        "INSERT INTO notes (title, content, doc_type) VALUES (?, ?, ?)",
        (title, content, doc_type)
    )
    conn.commit()
    note_id = cur.lastrowid
    conn.close()
    return {"id": note_id, "title": title, "doc_type": doc_type}


@router.put("/api/notes/{note_id}")
async def update_note(note_id: int, request: Request):
    data = await request.json()
    conn = _db()
    fields = []
    values = []
    for key in ("title", "content", "doc_type"):
        if key in data:
            fields.append(f"{key}=?")
            values.append(data[key])
    if fields:
        fields.append("updated_at=datetime('now','localtime')")
        values.append(note_id)
        conn.execute(f"UPDATE notes SET {', '.join(fields)} WHERE id=?", values)
        conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/api/notes/{note_id}")
async def delete_note(note_id: int):
    conn = _db()
    conn.execute("DELETE FROM notes WHERE id=?", (note_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── Tasks ───────────────────────────────────────────────────────────────────

@router.get("/api/tasks")
async def list_tasks(status: str = None, category: str = None):
    conn = _db()
    sql = "SELECT * FROM tasks"
    params = []
    conditions = []
    if status:
        conditions.append("status=?")
        params.append(status)
    if category:
        conditions.append("category=?")
        params.append(category)
    if conditions:
        sql += " WHERE " + " AND ".join(conditions)
    sql += " ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, due_date ASC NULLS LAST, created_at DESC"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/api/tasks")
async def create_task(request: Request):
    body = await request.json()
    title = body.get("title", "").strip()
    if not title:
        return JSONResponse({"error": "Titulo obrigatorio"}, status_code=400)
    conn = _db()
    cur = conn.execute(
        "INSERT INTO tasks (title, description, priority, category, due_date) VALUES (?,?,?,?,?)",
        (title, body.get("description", ""), body.get("priority", "medium"),
         body.get("category", "geral"), body.get("due_date")),
    )
    conn.commit()
    task_id = cur.lastrowid
    row = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    conn.close()
    return dict(row)


@router.put("/api/tasks/{task_id}")
async def update_task(task_id: int, request: Request):
    body = await request.json()
    conn = _db()
    fields = []
    params = []
    for key in ("title", "description", "priority", "status", "due_date", "category"):
        if key in body:
            fields.append(f"{key}=?")
            params.append(body[key])
    if not fields:
        conn.close()
        return JSONResponse({"error": "Nada para atualizar"}, status_code=400)
    fields.append("updated_at=datetime('now','localtime')")
    params.append(task_id)
    conn.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id=?", params)
    conn.commit()
    row = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    conn.close()
    return dict(row) if row else {"ok": True}


@router.delete("/api/tasks/{task_id}")
async def delete_task(task_id: int):
    conn = _db()
    conn.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── File Manager ─────────────────────────────────────────────────────────────

FILEMGR_ROOT = Path.cwd()


@router.get("/api/files")
async def list_files(path: str = "."):
    target = (FILEMGR_ROOT / path).resolve()
    if not str(target).startswith(str(FILEMGR_ROOT.resolve())):
        return JSONResponse({"error": "Acesso negado"}, status_code=403)
    if not target.is_dir():
        return JSONResponse({"error": "Diretorio nao encontrado"}, status_code=404)

    items = []
    try:
        for entry in sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
            if entry.name.startswith(".") or entry.name in ("__pycache__", "node_modules", ".git"):
                continue
            stat = entry.stat()
            items.append({
                "name": entry.name,
                "type": "dir" if entry.is_dir() else "file",
                "size": stat.st_size if entry.is_file() else None,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "ext": entry.suffix.lower() if entry.is_file() else None,
            })
    except PermissionError:
        return JSONResponse({"error": "Permissao negada"}, status_code=403)

    rel = str(target.relative_to(FILEMGR_ROOT)).replace("\\", "/")
    if rel == ".":
        rel = ""
    return {"path": rel, "items": items}


@router.get("/api/files/read")
async def read_file(path: str, raw: str = ""):
    target = (FILEMGR_ROOT / path).resolve()
    if not str(target).startswith(str(FILEMGR_ROOT.resolve())):
        return JSONResponse({"error": "Acesso negado"}, status_code=403)
    if not target.is_file():
        return JSONResponse({"error": "Arquivo nao encontrado"}, status_code=404)

    if raw == "1":
        media_types = {
            ".mp4": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska",
            ".avi": "video/x-msvideo", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
            ".wav": "audio/wav", ".m4a": "audio/mp4", ".flac": "audio/flac",
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".gif": "image/gif", ".webp": "image/webp", ".pdf": "application/pdf",
        }
        ext = target.suffix.lower()
        mt = media_types.get(ext, "application/octet-stream")
        return FileResponse(target, media_type=mt)

    text_exts = {".txt", ".md", ".py", ".js", ".css", ".html", ".json", ".yaml", ".yml",
                 ".toml", ".cfg", ".ini", ".sh", ".bat", ".csv", ".log", ".xml", ".sql", ".env"}
    if target.suffix.lower() not in text_exts:
        return {"content": f"[Arquivo binario: {target.suffix}, {target.stat().st_size} bytes]", "binary": True}

    try:
        content = target.read_text(encoding="utf-8", errors="replace")
        if len(content) > 102400:
            content = content[:102400] + "\n\n... [truncado em 100KB]"
        return {"content": content, "binary": False, "size": target.stat().st_size}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
