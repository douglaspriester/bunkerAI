# CLAUDE.md — AI Development Guide for Bunker AI

> This file is designed to be read by AI coding agents (Claude Code, Copilot, Cursor, etc.)
> working on this project. It describes the architecture, conventions, and critical knowledge
> needed to make safe, effective changes.

## What This Project Is

**Bunker AI** (a.k.a. **Bunker OS**) is an offline-first survival operating system with local AI.
It runs entirely without internet after initial setup. Think of it as a desktop OS in the browser
with a local LLM backend, survival guides, maps, tools, and multimedia.

- **Language**: Portuguese (Brazilian) — all UI text, guides, and user-facing strings are in PT-BR
- **Theme**: Sci-fi cyberpunk — inspired by Hitchhiker's Guide, Interstellar (TARS), Alien (Mother), HAL 9000
- **Philosophy**: 100% offline, zero telemetry, zero cloud, everything local

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| Backend | Python FastAPI | Single file: `server.py` (~4500 lines) |
| Frontend | Vanilla HTML/CSS/JS | Zero frameworks, ES modules, no build step |
| LLM | Ollama or llama.cpp | Auto-detected at startup |
| Database | SQLite | `data/db/bunker.db` — supplies, books, journal, notes, tasks, RAG, guide progress |
| Maps | Leaflet + PMTiles | Protomaps vector tiles for offline |
| STT | faster-whisper | Offline speech-to-text |
| TTS | Piper / Kokoro / pyttsx3 / edge-tts | Multiple engines, offline preferred |
| Search | SQLite FTS5 + Ollama embeddings | RAG system for knowledge retrieval |
| Wikipedia | Kiwix (kiwix-serve) | Serves ZIM files on port 8889 |

## Project Structure

```
bunkerAI/
├── server.py              # THE backend — all API routes, LLM proxy, RAG engine, everything
├── setup_downloads.py     # First-run setup: downloads models, libs, kiwix, ZIM files
├── requirements.txt       # Python dependencies
├── start.sh / start.bat   # Launch scripts (create venv, check deps, start server)
├── build_portable.py      # Builds portable USB version with embedded Python
├── INICIAR.bat/.command   # User-friendly double-click launchers
│
├── static/                # Frontend (served as static files)
│   ├── index.html         # Single HTML file — all panels, views, modals (~3400 lines)
│   ├── style.css          # All styles — dark cyberpunk theme (~11600 lines)
│   ├── js/
│   │   ├── main.js        # Entry point — wires app callbacks, initializes everything
│   │   ├── state.js       # Global state object, localStorage persistence, exports
│   │   ├── chat.js        # Chat UI, streaming SSE, message rendering
│   │   ├── apps.js        # ALL app logic (~14000 lines) — guides, maps, journal, wiki, etc.
│   │   ├── windowManager.js # Desktop window manager — drag, resize, minimize, z-index
│   │   ├── companion.js   # AI companion avatar (Three.js + VRM)
│   │   ├── voice-input.js # Microphone recording + STT
│   │   ├── guide-companion.js # AI personality system for guides (TARS, Mother, HAL, etc.)
│   │   └── markdown.js    # Markdown → HTML converter
│   ├── lib/               # Third-party libraries (Leaflet, epub.js, Three.js, MiniSearch, etc.)
│   ├── img/               # Guide illustrations
│   ├── fonts/             # System fonts (woff2)
│   ├── avatars/           # VRM 3D avatar + animation
│   ├── emulator/          # RetroArch JS emulator for ROMs
│   ├── games/             # ROM files (GB, GBA, NES)
│   └── maps/              # PMTiles offline map files
│
├── data/
│   ├── guides/            # 16 markdown survival guides + _index.json
│   ├── protocols/         # 10 JSON emergency decision trees + _index.json
│   ├── games/             # 8 HTML5 games + _index.json
│   ├── books/             # EPUB files (user-added)
│   ├── zim/               # Wikipedia ZIM files for Kiwix
│   ├── db/                # SQLite database (bunker.db)
│   ├── rag_uploads/       # User-uploaded documents for RAG
│   └── avatar/            # Custom avatar files
│
├── models/                # Local GGUF model files for llama.cpp fallback
├── tools/                 # kiwix-serve binary, pmtiles CLI, USB prep script
├── docs/                  # Developer documentation
└── CLAUDE.md              # THIS FILE
```

## Critical Architecture Rules

### 1. server.py is monolithic — by design
Everything is in one file. This is intentional for offline portability. Do NOT split it into
multiple files unless there is a very strong reason. When adding features, find the right section
(they're marked with `# ─── Section Name ───` comment headers) and add there.

### 2. Frontend is vanilla JS with ES modules
- `state.js` exports the global `state` object and persistence helpers
- `chat.js` handles chat UI and SSE streaming
- `apps.js` contains ALL application logic (maps, guides, journal, wiki, supplies, etc.)
- `windowManager.js` manages the desktop window system
- `main.js` wires everything together on page load
- **No build step** — files are served directly. No webpack, no bundler, no transpiler.
- Functions called from HTML `onclick` handlers must be on `window` scope

### 3. All data flows through SQLite or localStorage
- **SQLite** (`data/db/bunker.db`): supplies, books, journal, notes, tasks, RAG chunks, guide progress
- **localStorage**: chats, favorites, map markers, settings, wallpaper, window positions
- **Files**: guides (markdown), protocols (JSON), games (HTML), books (EPUB), maps (PMTiles)

### 4. LLM backend is auto-detected
```
Startup priority:
1. Check if Ollama is running → use Ollama API
2. Check if llama.cpp server is running → use OpenAI-compatible API
3. Try to start llama-cpp-python embedded server → use that
4. Set BACKEND = "none" → show "download a model" message
```
The global `BACKEND` variable controls this. Never hardcode Ollama URLs — use `OLLAMA_BASE`.

### 5. RAG system
- On startup, auto-indexes all guides + protocols into `rag_chunks` table
- Uses SQLite FTS5 for full-text search (zero dependencies)
- Uses Ollama embeddings (`nomic-embed-text`) for semantic search
- Auto-pulls the embedding model if not present
- Chat endpoint (`/api/chat`) automatically injects RAG context when `rag: true` (default)
- User can upload documents via `/api/rag/upload` for custom knowledge

## Database Schema

```sql
-- Core data
supplies        (id, name, category, quantity, unit, expiry, notes, created_at, updated_at)
books           (id, title, author, file, lang, size_kb, read_pct)
journal         (id, date, content, mood, created_at)
journal_logs    (id, content, category, mood, created_at)
notes           (id, title, content, doc_type, created_at, updated_at)
tasks           (id, title, description, priority, status, due_date, category, created_at, updated_at)

-- RAG system
rag_chunks      (id, source, source_id, title, chunk_index, content, embedding, created_at)
rag_fts         (content, source, source_id, title) -- FTS5 virtual table, content=rag_chunks
rag_documents   (id, filename, file_type, size_kb, chunk_count, indexed_at)

-- Guide progress
guide_progress  (id, guide_id UNIQUE, status, read_pct, last_read, notes)
```

## Key Global Variables (server.py)

| Variable | Type | Purpose |
|----------|------|---------|
| `BACKEND` | str | "ollama", "llama.cpp", or "none" |
| `OLLAMA_BASE` | str | Ollama API URL (default http://localhost:11434) |
| `LLAMA_CPP_URL` | str/None | llama.cpp server URL if detected |
| `DATA_DIR` | Path | `data/` |
| `DB_PATH` | Path | `data/db/bunker.db` |
| `GUIDES_DIR` | Path | `data/guides/` |
| `PROTOCOLS_DIR` | Path | `data/protocols/` |
| `_rag_indexed` | bool | Whether RAG indexing has completed |
| `_rag_embed_model` | str/None | Cached name of available embedding model |

## API Endpoint Patterns

All endpoints follow these patterns:
- `GET /api/{resource}` — list items
- `GET /api/{resource}/{id}` — get single item
- `POST /api/{resource}` — create/action
- `PUT /api/{resource}/{id}` — update
- `DELETE /api/{resource}/{id}` — delete

Chat/LLM endpoints return `StreamingResponse` with SSE format:
```
data: {"token": "partial text"}\n\n
data: {"done": true, "stats": {...}}\n\n
```

## Frontend App Registration

Every "app" (window) follows this pattern:

1. **HTML**: Panel defined in `index.html` as `<div class="panel-view hidden" id="{app}View">`
2. **JS init**: Function registered in `main.js` → `openMap` object: `{appId}: () => window.{appId}Init?.()`
3. **JS logic**: Implemented in `apps.js` as `window.{appId}Init = function() { ... }`
4. **CSS**: Styles in `style.css` under comment header `/* {APP_NAME} VIEW */`
5. **Window**: Created by `openApp('{appId}')` which calls `windowManager.js`

Desktop icons are defined in `index.html` `#desktop` section.
Start menu items are in the `#startMenu` section.
Taskbar pinned items are in `#taskbar`.

### Desktop & Launchpad (v4.1+)

Desktop shows only **8 essential apps** (Chat, Guias, Protocolos, Socorros, Suprimentos, Mapa, Diário, Notas). All other apps live in the **Launchpad** — a fullscreen overlay (macOS/iPadOS style) with glassmorphism, search, and category tabs. Config lives in `windowManager.js`:
- `DESKTOP_APPS` — array of the 8 essential app IDs (change order here)
- `APP_CATEGORIES` — grouping for Launchpad tabs (IA, Sobrevivência, Ofício, Ferramentas, Mídia, Sistema)
- Launchpad render uses `.lp-*` CSS classes in `style.css`

### Settings as a window (v4.1+)

Settings used to be a right-side drawer. It is now a regular `panel-view` window (`#settingsView`) managed by `windowManager.js` (`OS_APPS.settings` has `viewId: 'settingsView'`). `toggleConfig()` is kept as a back-compat alias that calls `openApp('settings')`. `window.settingsInit` runs on open to refresh status + Kokoro/offline toggles.

### All App IDs (40+)

**AI/Chat**: `chat`, `companion`, `characters`, `tts`
**Knowledge**: `guides`, `protocols`, `wiki`, `books`, `library`
**Survival Tools**: `supplies`, `firstaid`, `waterCalc`, `rations`, `plants`, `pharmacy`, `shelter`, `energy`, `navigation`, `survRef`
**Maps**: `map`
**Office**: `notepad`, `word`, `excel`, `paint`
**Utilities**: `calc`, `timer`, `converter`, `checklist`, `morse`, `phonetic`, `sun`, `crypto`, `tasks`
**Media**: `games`, `media`, `imagine`
**System**: `sysmon`, `modelMgr`, `weather`, `pendrive`, `fileManager`, `journal`, `builder`

### Chat AI Modes (6 modes)

The chat system has 6 specialized modes, each with a different system prompt:

| Mode ID | Label | Color | Domain |
|---------|-------|-------|--------|
| `general` | Geral | #00d4ff | Custom system prompt, general AI |
| `medical` | Medico | #ff4444 | Field medicine, trauma, triage |
| `survival` | Sobrevivencia | #4caf50 | Bushcraft, shelter, water, fire |
| `engineer` | Engenharia | #ff9800 | Mechanical, electrical, construction |
| `defense` | Defesa | #9c27b0 | Tactical, perimeter, OPSEC |
| `psych` | Psicologico | #2196f3 | Crisis counseling, trauma support |

Modes are managed in `chat.js`: `AI_MODES`, `getActiveMode()`, `setAIMode(modeId)`.

### Guide Companion Personalities (6 personalities)

The floating "Guide" widget (`guide-companion.js`) has 6 AI personalities:

| ID | Name | Style | Quirk |
|----|------|-------|-------|
| `deepThought` | Deep Thought | Philosophical | Everything relates to 42 |
| `tars` | TARS | Sarcastic-useful | Mentions humor percentage |
| `mother` | MOTHER | Clinical-protective | Terminal/computer style |
| `hal` | HAL 9000 | Polite-sinister | Calls everyone Dave |
| `ford` | Ford Prefect | Casual-alien | Obsessed with towels |
| `survivor` | Survivor | Direct-military | Tactical, concise |

The **Personagens app** (v4.1+) reuses these 6 personalities as role-play chats. Each card has a "💬 Conversar" button that opens an internal mini-chat (`#rpPane` inside `charactersView`) with per-character history persisted in `localStorage`. This keeps role-play isolated from the main chat. Relevant code in `apps.js`: `openRoleplay`, `sendRoleplayMessage`, `_renderRpMessages`, `_loadRoleplayStore`.

### 3D Companion Avatar

`companion.js` implements a full 3D avatar using Three.js + VRM:
- Model: `static/avatars/companion.vrm` (15MB)
- Animation: `static/avatars/idle_loop.vrma`
- Features: lip-sync (Web Audio API), blinking, breathing, gestures, facial expressions
- Fallback: geometric placeholder if VRM missing, text UI if no WebGL

## Coding Conventions

### Python (server.py)
- Functions prefixed with `_` are internal/private
- Section headers: `# ─── Section Name ─────...`
- Database access: `conn = _db()` → use → `conn.close()`
- Streaming: return `StreamingResponse(async_generator(), media_type="text/event-stream")`
- Error responses: `JSONResponse({"error": "message"}, status_code=4xx)`
- All file paths use `pathlib.Path`, never raw strings
- No type hints on endpoint functions (FastAPI infers from params)

### JavaScript (static/js/)
- ES module imports between JS files
- `window.functionName = function()` for anything called from HTML onclick
- State stored in `state.js` → exported `state` object
- Streaming: `streamFromAPI(url, body, contentEl)` in chat.js
- DOM IDs follow pattern: `{app}View`, `{app}Content`, `{app}Status`
- Toast notifications: `osToast('message')`
- Helper: `escapeHtml(text)` — always escape user content

### CSS (style.css)
- CSS custom properties for theming (defined in `:root`)
- Key variables: `--bg`, `--surface`, `--text`, `--accent`, `--border`
- Section headers: `/* ═══ SECTION NAME ═══ */`
- BEM-like naming: `.guide-card`, `.guide-card-icon`, `.guide-card-title`
- Mobile responsive via `@media (max-width: 768px)` at bottom

### Content (data/)
- Guides: Markdown files, ID = filename stem, `_index.json` for metadata
- Protocols: JSON decision trees with `steps[]`, each step has `id`, `type`, `title`, `content`
- Games: Self-contained HTML files, `_index.json` for metadata

## How to Add a New App

1. Add HTML panel in `index.html` inside `#mainArea`:
   ```html
   <div class="panel-view hidden" id="myAppView">...</div>
   ```
2. Add desktop icon in `#desktop` div
3. Register init in `main.js` → `openMap`:
   ```js
   myApp: () => window.myAppInit?.(),
   ```
4. Implement logic in `apps.js`:
   ```js
   window.myAppInit = function() { ... };
   ```
5. Add styles in `style.css` with section header
6. If backend needed, add endpoints in `server.py` in appropriate section

## How to Add a New API Endpoint

1. Find the right section in `server.py` (endpoints are grouped by feature)
2. Add the route decorator and async function:
   ```python
   @app.get("/api/myresource")
   async def my_endpoint():
       conn = _db()
       # ... logic ...
       conn.close()
       return {"data": result}
   ```
3. For streaming LLM responses, use `_chat_stream()` helper
4. For non-streaming LLM calls, use `_llm_complete()` helper

## How to Add Content to RAG

Content is automatically indexed if placed in:
- `data/guides/*.md` — added to RAG as source="guide"
- `data/protocols/*.json` — added to RAG as source="protocol"
- Uploaded via `/api/rag/upload` — stored as source="upload"

To force reindex: `POST /api/rag/reindex`

## Testing

No test framework is set up. To verify changes:
```python
# Syntax check
python3 -c "import ast; ast.parse(open('server.py').read()); print('OK')"

# API test with TestClient
from fastapi.testclient import TestClient
from server import app
client = TestClient(app)
r = client.get('/api/guides')
assert r.status_code == 200
```

## Security & Rate Limiting

- **Rate limiter**: Built into server.py. Limits: chat=30/min, terminal=10/min, build=10/min, tts=20/min
- **Terminal sandboxing**: `/api/terminal` only allows whitelisted commands (ls, cat, grep, find, pwd, whoami, etc.)
- **File manager sandboxing**: `/api/files` restricts browsing to `FILEMGR_ROOT` (project directory)
- **No auth**: The server is designed for localhost only. No authentication, no sessions.

## Common Pitfalls

1. **Don't break offline mode** — never add features that require internet to function.
   Online features (edge-tts, map tile fallback) must have offline alternatives.

2. **Don't add build steps** — no webpack, no npm, no compilation.
   The frontend must work by serving `static/` directly.

3. **Don't split server.py** — the monolith is intentional for portability.
   A single `server.py` can be copied to a USB stick and run anywhere.

4. **SQLite is the only database** — don't add Redis, Postgres, or any other DB.
   Everything must work with a single `.db` file.

5. **apps.js is huge (~14K lines)** — this is known. Each app is a section.
   Find the right section header before adding code.

6. **HTML onclick handlers need window scope** — functions called from
   `onclick="myFunc()"` in HTML must be assigned to `window.myFunc`.

7. **UI text is in Portuguese** — keep all user-facing strings in PT-BR.

8. **Don't add node_modules** — third-party JS libs go in `static/lib/` as single files.

## Environment

- **Port**: 8888 (main server), 8889 (Kiwix), 11434 (Ollama)
- **Python**: 3.10+ required
- **GPU**: NVIDIA 8GB+ recommended for LLM inference
- **Storage**: ~31GB for all Ollama models, ~400MB for Wikipedia ZIM
- **OS**: Windows, Linux, macOS (all supported)
