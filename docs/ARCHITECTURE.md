# Bunker AI — Architecture

> Complete technical map of the codebase. Designed for developers and AI agents.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (localhost:8888)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Chat    │ │  Guides  │ │  Maps    │ │  Apps    │ ...   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       │             │            │             │              │
│  ┌────┴─────────────┴────────────┴─────────────┴──────┐      │
│  │              Window Manager (windowManager.js)       │      │
│  └────────────────────────┬────────────────────────────┘      │
│                           │ ES modules                        │
│  ┌───────┐ ┌───────┐ ┌───┴────┐ ┌──────────┐ ┌──────────┐  │
│  │state.js│ │chat.js│ │apps.js │ │companion │ │voice-in  │  │
│  └───────┘ └───────┘ └────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTP/SSE
┌─────────────────────────────┴───────────────────────────────┐
│                   server.py (FastAPI :8888)                   │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Chat/LLM │ │ RAG      │ │ STT/TTS  │ │ Maps     │       │
│  │ Proxy    │ │ Engine   │ │ Engines  │ │ PMTiles  │       │
│  └────┬─────┘ └────┬─────┘ └──────────┘ └──────────┘       │
│       │             │                                        │
│  ┌────┴─────┐  ┌────┴─────┐  ┌──────────────────────────┐  │
│  │ Ollama   │  │ SQLite   │  │ File System              │  │
│  │ :11434   │  │ bunker.db│  │ guides/ protocols/ maps/ │  │
│  └──────────┘  └──────────┘  └──────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Kiwix (kiwix-serve :8889) — Wikipedia ZIM files      │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## server.py — Section Map

The backend is organized into clearly labeled sections (~4500 lines):

| Lines | Section | Description |
|-------|---------|-------------|
| 1-38 | Imports & App | FastAPI app creation, imports |
| 40-120 | Backend Detection | Auto-detect Ollama or llama.cpp at startup |
| 120-355 | GGUF Auto-download | Download fallback GGUF model if no LLM available |
| 361-404 | Kiwix Startup | Auto-start kiwix-serve with ZIM files |
| 407-500 | Rate Limiter | Simple rate limiting for API endpoints |
| 500-520 | Paths & Dirs | DATA_DIR, GUIDES_DIR, DB_PATH, etc. |
| 524-950 | Voice Engines | Piper TTS, pyttsx3, Kokoro, Whisper STT, edge-tts |
| 950-965 | Config | Offline config save/load |
| 967-1075 | Health & Status | /api/health, model listing |
| 1075-1435 | STT/TTS Endpoints | Speech-to-text, text-to-speech, voice model management |
| 1438-1520 | Chat & Vision | Core LLM chat (with RAG), vision analysis |
| 1520-1605 | App Builder | Code generation, save/list/delete apps |
| 1609-1810 | Maps | PMTiles serving, map download, available regions |
| 1813-2100 | Models | Ollama model pull, GGUF download/management |
| 2100-2150 | SQLite Setup | Database initialization, table creation |
| 2150-2400 | RAG Engine | Chunking, embeddings, search, indexing |
| 2400-2550 | RAG API | Status, search, upload, documents, reindex |
| 2550-2620 | Guides API | List, get, progress tracking |
| 2620-2650 | Protocols API | List, get protocol decision trees |
| 2650-2740 | Supplies | Inventory CRUD |
| 2740-2800 | Books | EPUB library, reading progress |
| 2800-2880 | Games | HTML5 games + ROM emulator |
| 2880-2945 | Journal | Daily journal + categorized logs |
| 2945-2990 | Kiwix API | Status check, proxy to kiwix-serve |
| 2990-3100 | System Status | Detailed system info (CPU, RAM, GPU, disk) |
| 3100-3240 | Notes & Tasks | Notepad, tasks with priorities/categories |
| 3280-3400 | Terminal & Files | Shell command execution, file browser |
| 3400-3560 | (Reserved) | Utility functions |
| 3560-4070 | Imagine | StableDiffusion image generation |
| 4070-4450 | Pendrive | USB portable build preparation |
| 4450-4466 | Static Mount | Middleware + static file serving |

## Frontend — File Map

### index.html (~3400 lines)

| Lines (approx) | Section | ID |
|-------|---------|-----|
| 1-50 | Head, meta, CSS links | — |
| 50-100 | Boot screen | `#bootScreen` |
| 100-200 | Desktop (app icons) | `#desktop` |
| 200-350 | Taskbar | `#taskbar` |
| 350-450 | Start Menu | `#startMenu` |
| 450-600 | Sidebar navigation | `#sidebar` |
| 600-750 | Chat view | `#chatView` |
| 750-850 | Settings panel | `#settingsView` |
| 850-1000 | Guides view | `#guidesView` |
| 1000-1050 | Protocols view | `#protocolsView` |
| 1050-1095 | Games view | `#gamesView`, `#gamePlayView` |
| 1095-1115 | Wiki view | `#wikiView` |
| 1115-1200 | Journal view | `#journalView` |
| 1200-1400 | Builder view | `#builderView` |
| 1400-1700 | Supplies view | `#suppliesView` |
| 1700-2000 | Map view | `#mapView` |
| 2000-2400 | Various app views | Notepad, Word, Excel, Sysmon, Calc, Timer, etc. |
| 2400-3000 | More app views | Tasks, FileManager, Paint, Imagine, Survival apps |
| 3000-3100 | Modals & overlays | Context menu, spotlight search, keyboard shortcuts |
| 3100-3200 | Onboarding wizard | `#onboardingWizard` — first-run setup |
| 3200-3300 | SOS Emergency | `#sosEmergencyOverlay` — emergency quick-access |
| 3200-3400 | Script tags (ES modules) | main.js import |

### style.css (~11600 lines)

| Lines (approx) | Section |
|-------|---------|
| 1-150 | CSS Variables (`:root`), reset, base typography |
| 150-400 | Boot screen, desktop, wallpapers |
| 400-700 | Taskbar, start menu, system tray |
| 700-1000 | Window manager (draggable windows, title bars) |
| 1000-1300 | Sidebar navigation |
| 1300-1700 | Chat view (messages, input, badges) |
| 1700-2000 | Settings panel |
| 2000-2100 | Guides grid, guide body, guide progress |
| 2100-2200 | Protocols grid, protocol steps |
| 2200-2400 | Games grid |
| 2400-2500 | Wiki view, search bar |
| 2500-2700 | Journal view |
| 2700-3200 | Builder view |
| 3200-3600 | Supplies view |
| 3600-4200 | Map view |
| 4200-5000 | Notepad, Word, Excel views |
| 5000-6000 | Tasks, Calculator, Timer, Converter views |
| 6000-7000 | File Manager, Paint, Imagine views |
| 7000-8000 | Companion, Morse, Phonetic, Navigation views |
| 8000-9500 | Survival apps (Water calc, Pharmacy, Shelter, Energy, etc.) |
| 9500-10500 | More survival apps, Pendrive builder |
| 10500-11000 | Modal dialogs, context menus, spotlight search |
| 11000-11600 | Responsive (@media), animations, scrollbars |

### JavaScript Modules

#### state.js (117 lines) — Global State
- Exports `state` object with all app state
- Exports `storage` helper (localStorage wrapper with fallback)
- Exports data caches: `guidesCache`, `guidesIndex`, `protocolsIndex`, `gamesIndex`
- Exports persistence: `loadPersistedData()`, `saveChats()`, `saveFavorites()`
- Exports helpers: `genId()`, `escapeHtml()`

#### main.js (268 lines) — Entry Point
- `wireAppCallbacks()` — registers init/close functions for every app ID
- `initSidebar()` — sidebar navigation events
- `initDesktop()` — desktop icon double-click handlers
- `initKeyboard()` — global keyboard shortcuts (Ctrl+K, Alt+Tab, F1, F2, Escape)
- `DOMContentLoaded` → loads persisted data → fetches models → wires everything

#### chat.js (714 lines) — Chat System
- `renderChatList()` — sidebar chat list
- `switchChat(id)` / `newChat()` / `deleteChat(id)` — chat management
- `restoreChat()` — rebuild chat DOM from state
- `sendMessage()` — normal chat flow (with model selection)
- `sendBrain()` — uncensored brain mode
- `streamFromAPI(url, body, el)` — **core SSE streaming function** used by all LLM features
- `addMsgDom()` / `addStreamMsgDom()` — message DOM helpers
- `getWelcomeHtml()` — welcome screen with tips

#### apps.js (~14000 lines) — All Application Logic
Major sections (by comment headers):

| Lines (approx) | Section | Key Functions |
|-------|---------|--------------|
| 1-110 | Imports, helpers | MiniSearch indexing, search |
| 110-230 | Guides | `loadGuidesIndex()`, `renderGuidesGrid()`, `openGuide()`, progress tracking |
| 230-320 | Protocols | `loadProtocolsIndex()`, `openProtocol()`, `renderProtocolStep()` |
| 320-550 | Favorites | `toggleFavorite()`, `showFavorites()` |
| 550-850 | Builder (App Builder) | `_builderInit()`, code generation, save/load apps |
| 850-1100 | Supplies | `loadSupplies()`, CRUD, summary |
| 1100-1400 | Settings | Model selection, TTS/STT config, theme settings |
| 1400-1800 | Books | EPUB reader with epub.js, pagination |
| 1800-2300 | Map | Leaflet init, PMTiles, GPS, markers, measurement, download |
| 2300-2500 | Games | Grid rendering, ROM player, iframe loading |
| 2500-2700 | TTS Panel | Voice selection, test playback |
| 2700-2850 | Books (reader) | Page navigation, keyboard shortcuts |
| 2850-2950 | Wiki/Kiwix | `_wikiInit()`, search, iframe management |
| 2950-3400 | Journal | Multi-entry log, categories, day counter, export |
| 3400-3700 | Companion | Avatar appearance, personality selection |
| 3700-4200 | Notepad | Simple text editor, auto-save |
| 4200-4700 | Word | Rich text editor (bold, italic, lists) |
| 4700-5300 | Excel | Grid spreadsheet with formula engine |
| 5300-5700 | System Monitor | CPU, RAM, disk graphs |
| 5700-6000 | Calculator | Scientific calculator |
| 6000-6300 | Timer | Countdown + stopwatch |
| 6300-6600 | Unit Converter | Length, weight, temperature, volume |
| 6600-7000 | Checklist | Reusable checklists with persistence |
| 7000-7300 | Morse Code | Encoder/decoder with audio playback |
| 7300-7600 | Phonetic Alphabet | NATO phonetic reference |
| 7600-7900 | Sun Calculator | Sunrise/sunset, golden hour |
| 7900-8200 | Water Calculator | Daily water needs by conditions |
| 8200-8600 | Media Player | Audio/video playback |
| 8600-9000 | Tasks | Task manager with priorities, categories, filters |
| 9000-9500 | File Manager | Directory browser, file viewer |
| 9500-9800 | Paint | Canvas drawing tool |
| 9800-10300 | Imagine | StableDiffusion UI, model management, gallery |
| 10300-10600 | Survival Reference | Quick-access survival data |
| 10600-10800 | Model Manager | Download/manage LLM models |
| 10800-11100 | Weather | Basic weather indicators |
| 11100-11500 | Pendrive | USB build wizard |
| 11500-11800 | First Aid | Quick emergency reference |
| 11800-12100 | Crypto | Encryption/encoding tools |
| 12100-12400 | Rations | Food rationing calculator |
| 12400-12700 | Plants | Edible/medicinal plant database |
| 12700-13000 | Navigation | GPS-free navigation (stars, sun, shadows) |
| 13000-13300 | Pharmacy | Medicine inventory + dosage reference |
| 13300-13600 | Shelter | Shelter building guide with interactive diagrams |
| 13600-14000 | Energy | Power generation + battery management |

#### windowManager.js (1320 lines) — Desktop Window System
- `openApp(appId)` — create/focus window for app
- `closeWindow(windowId)` — close and cleanup
- `minimizeWindow()` / `maximizeWindow()` — window state management
- Drag + resize handlers with collision detection
- Z-index management, focus tracking
- Taskbar integration (minimized windows show in taskbar)
- Cascade positioning for new windows

#### companion.js (700 lines) — AI Avatar
- Three.js + VRM model loading
- Idle animation playback
- Lip sync simulation
- Personality switching (TARS, Mother, HAL, Ford Prefect)

#### voice-input.js (190 lines) — Microphone Input
- MediaRecorder API for audio capture
- Sends to `/api/stt` for Whisper transcription
- Falls back to Web Speech API (browser STT)

#### guide-companion.js (470 lines) — Guide AI Personality
- 6 AI personalities with distinct system prompts
- Proactive tips every 5 minutes based on active context
- Context-aware suggestions using current guide/protocol

#### markdown.js (97 lines) — Markdown Renderer
- Lightweight markdown → HTML converter
- Supports: headers, bold, italic, code blocks, links, lists, tables, blockquotes
- No external dependency (not using marked.js or similar)

## Data Flow: Chat with RAG

```
User types message
       │
       ▼
chat.js: sendMessage()
       │
       ▼
streamFromAPI("/api/chat", {messages, model, system, rag: true})
       │
       ▼
server.py: /api/chat
       │
       ├─ rag=true? → rag_search(last_message, top_k=3)
       │                  │
       │                  ├─ FTS5 search (rag_fts table)
       │                  ├─ Semantic search (Ollama embeddings)
       │                  └─ Return top 3 chunks
       │
       ├─ Inject RAG context into system prompt
       │
       ▼
_chat_stream() → Ollama /api/chat (SSE)
       │
       ▼
SSE tokens → contentEl.innerHTML → user sees streaming response
```

## Data Flow: App Builder

```
User types "/build calculadora"
       │
       ▼
chat.js detects /build prefix → POST /api/build
       │
       ▼
server.py: Sends code-generation prompt to code model (qwen2.5-coder)
       │
       ▼
SSE stream of HTML/CSS/JS → preview iframe
       │
       ▼
User clicks "Save" → POST /api/build/save → generated_apps/{name}.html
```

## Data Flow: Voice

```
User holds mic button
       │
       ▼
voice-input.js: MediaRecorder captures audio blob
       │
       ▼
POST /api/stt (multipart audio) → faster-whisper → transcription text
       │
       ▼
Text inserted into chat input → sendMessage() → LLM response
       │
       ▼
POST /api/tts {text, engine} → Piper/Kokoro/pyttsx3/edge-tts → audio file
       │
       ▼
Browser plays audio response
```

## Third-Party Libraries (static/lib/)

| File | Library | Version | Purpose |
|------|---------|---------|---------|
| `leaflet.js` + `leaflet.css` | Leaflet | 1.9.4 | Map rendering |
| `pmtiles.js` | PMTiles | — | Read PMTiles archives |
| `protomaps-leaflet.js` | Protomaps | — | Vector tile rendering for Leaflet |
| `epub.min.js` | epub.js | — | EPUB book reader |
| `jszip.min.js` | JSZip | — | ZIP handling (for EPUB) |
| `minisearch.min.js` | MiniSearch | — | Client-side full-text search |
| `three.module.min.js` | Three.js | — | 3D rendering (avatar) |
| `three-vrm.module.js` | Three-VRM | — | VRM avatar model loader |
| `three-vrm-animation.module.js` | Three-VRM Animation | — | VRM animation playback |
| `GLTFLoader.js` | Three.js GLTF | — | 3D model loader |
| `emulator/` | EmulatorJS | — | RetroArch JS (Game Boy, GBA, NES) |

## Startup Sequence

```
1. start.sh / start.bat
   ├── Check Python 3.10+ installed
   ├── Check Ollama installed & running
   ├── Create venv if not exists
   ├── pip install -r requirements.txt
   ├── python setup_downloads.py (first run only)
   │   ├── Download JS libraries → static/lib/
   │   ├── Download Kiwix binary → tools/kiwix-serve
   │   ├── Download Wikipedia ZIM → data/zim/
   │   ├── Download PMTiles CLI → tools/
   │   ├── Extract world map → static/maps/
   │   ├── Scan books → populate SQLite
   │   └── Scan games → populate SQLite
   └── uvicorn server:app --port 8888

2. server.py startup events (async)
   ├── _detect_backend() → find Ollama or llama.cpp
   ├── _auto_start_kiwix() → launch kiwix-serve if ZIMs exist
   ├── _auto_download_gguf() → download fallback model if no LLM
   └── _startup_rag_index() → pull embed model + index guides/protocols
```

## Key Design Decisions

1. **Monolithic server.py**: Single file = single copy to USB = works everywhere.
   Trade-off: harder to navigate. Mitigated by clear section headers.

2. **Vanilla JS frontend**: No React/Vue/Svelte = no build step = no node_modules.
   Trade-off: apps.js is 14K lines. Mitigated by section organization.

3. **SQLite for everything**: One .db file for all structured data.
   Trade-off: no concurrent writes. Acceptable for single-user local app.

4. **Ollama as primary LLM**: Most user-friendly local LLM runtime.
   Fallback: llama.cpp for systems without Ollama.

5. **PMTiles over XYZ tiles**: Single file per region vs thousands of tile files.
   Much better for offline/USB scenarios.

6. **RAG with SQLite FTS5 + Ollama embeddings**: Zero extra dependencies.
   Trade-off: embeddings in JSON text column (not a vector DB). Acceptable for
   the scale of data (~200-500 chunks).

7. **Desktop metaphor (window manager)**: Familiar UI paradigm that works
   offline without explanation. Users know how to use windows.
