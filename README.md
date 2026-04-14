<p align="center">
  <strong>BUNKER AI</strong><br>
  <em>Offline survival OS with local AI — voice, vision, RAG, 40+ apps</em>
</p>

<p align="center">
  <a href="README.pt-BR.md">Portugues</a> · <a href="docs/ARCHITECTURE.md">Architecture</a> · <a href="docs/API.md">API Reference</a> · <a href="ROADMAP.md">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.10%2B-blue?logo=python&logoColor=white" alt="Python 3.10+">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
  <img src="https://img.shields.io/badge/offline-100%25-brightgreen" alt="100% Offline">
  <img src="https://img.shields.io/badge/LLM-Ollama%20%2F%20llama.cpp-orange" alt="Ollama / llama.cpp">
  <img src="https://img.shields.io/github/last-commit/douglaspriester/bunkerAI" alt="Last Commit">
  <img src="https://img.shields.io/github/stars/douglaspriester/bunkerAI?style=social" alt="GitHub Stars">
</p>

---

> *"The answer to life, the universe and everything is 42.
> But first, make sure you know where your towel is."*

Bunker AI is a **fully offline survival operating system** that runs in the browser. It combines a local LLM backend with a desktop-like interface, 40+ applications, survival guides, offline maps, voice control, image generation, and a RAG-powered knowledge base — all running on your machine with **zero internet required** after initial setup.

Inspired by *The Hitchhiker's Guide to the Galaxy*, *Interstellar* (TARS), *Alien* (Mother), and *2001* (HAL 9000).

## Highlights

| Category | What you get |
|----------|-------------|
| **Local AI** | Chat with uncensored LLM, voice input/output, webcam vision, app generator, image generation |
| **Knowledge Base** | 16 survival guides, 10 emergency protocols, offline Wikipedia (Kiwix), RAG search across all content |
| **Offline Library** | Download ZIM archives: Wikipedia, iFixit, Wikibooks, Stack Overflow, Project Gutenberg, and more |
| **Survival Tools** | Water purification calculator, first aid, pharmacy, food rationing, shelter builder, plant database |
| **Maps** | Offline vector maps (PMTiles), GPS tracking, survival markers, celestial navigation |
| **Desktop** | Draggable windows, taskbar, start menu, wallpapers, keyboard shortcuts, boot screen |
| **Office** | Notepad, word processor, spreadsheet, paint, file manager, terminal |
| **Media** | 8 HTML5 games, ROM emulator (GB/GBA/NES), EPUB reader, media player |

## Quick Start

### Windows
```bat
start.bat
```

### Linux / macOS
```bash
chmod +x start.sh
./start.sh
```

The script handles everything automatically:
1. Checks Python and Ollama
2. Creates virtual environment and installs dependencies
3. Downloads models, libraries, and offline content
4. Starts the server at http://localhost:8888

### Prerequisites

| Software | Required | Notes |
|----------|----------|-------|
| [Python 3.10+](https://python.org) | Yes | Backend runtime |
| [Ollama](https://ollama.ai) | Yes | Local LLM inference |
| NVIDIA GPU 8GB+ | Recommended | CPU works but slower |

## Models

| Purpose | Model | Size | Why |
|---------|-------|------|-----|
| Chat + Vision | `gemma3:12b` | ~8 GB | Native multimodal |
| Code generation | `qwen2.5-coder:14b` | ~9 GB | Best code model |
| Fast chat | `phi4` | ~9 GB | Ultra fast inference |
| Uncensored | `dolphin3` | ~5 GB | No safety filters |
| Embeddings (RAG) | `nomic-embed-text` | ~274 MB | Semantic search |

> All models are downloaded automatically on first run. Total: ~31 GB in Ollama cache.

## How It Works

### RAG (Retrieval-Augmented Generation)

Bunker AI automatically indexes all survival guides and protocols at startup. When you ask a question:

1. Searches the knowledge base using FTS5 + semantic embeddings
2. Injects relevant context into the LLM prompt
3. The model responds with grounded information from your knowledge base

You can also upload your own documents (.txt, .md, .csv) to expand the knowledge base.

### Offline Library (ZIM Manager)

Download curated offline content archives directly from the app:
- **Wikipedia** — Full, mini, or medical subsets
- **iFixit** — Repair manuals for everything
- **Wikibooks** — Engineering, agriculture, construction
- **Stack Overflow** — Programming and engineering
- **Project Gutenberg** — Thousands of books

Each ZIM is searchable through Kiwix and can be indexed into the RAG system.

### Offline Maps

Two modes:
- **Online** — CartoDB Dark Matter tiles (default, needs internet)
- **Offline** — PMTiles (single file per region, zero internet)

Survival markers: water, shelter, danger, food, medical, supplies.
Distance measurement with Haversine formula.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python FastAPI (single file) |
| Frontend | Vanilla HTML/CSS/JS (zero frameworks, zero build step) |
| LLM | Ollama + llama.cpp (auto-detected) |
| Database | SQLite (single file) |
| Maps | Leaflet + Protomaps/PMTiles |
| STT | faster-whisper (offline) |
| TTS | Piper / Kokoro / pyttsx3 / edge-tts |
| Search | SQLite FTS5 + Ollama embeddings |
| Wikipedia | Kiwix (kiwix-serve) |
| Images | Stable Diffusion (local) |

## Project Structure

```
bunkerAI/
├── server.py              # Backend — all API routes (~4500 lines)
├── setup_downloads.py     # First-run setup and downloads
├── start.sh / start.bat   # Launch scripts
├── static/                # Frontend (HTML/CSS/JS, served directly)
│   ├── index.html         # Main interface (~3400 lines)
│   ├── style.css          # Dark cyberpunk theme (~11600 lines)
│   └── js/                # ES modules (chat, apps, windowManager, etc.)
├── data/
│   ├── guides/            # 16 survival guides (Markdown)
│   ├── protocols/         # 10 emergency protocols (JSON decision trees)
│   ├── games/             # 8 HTML5 games
│   ├── books/             # EPUB files
│   ├── zim/               # ZIM archives (Wikipedia, iFixit, etc.)
│   └── db/                # SQLite database
├── docs/                  # Developer documentation
│   ├── ARCHITECTURE.md    # Full architecture map
│   └── API.md             # 80+ endpoint reference
├── CLAUDE.md              # Guide for AI coding agents
└── ROADMAP.md             # Development history and future plans
```

## Documentation

- **[CLAUDE.md](CLAUDE.md)** — Guide for AI agents working on this codebase
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Complete architecture map
- **[docs/API.md](docs/API.md)** — All 80+ API endpoints
- **[ROADMAP.md](ROADMAP.md)** — Past phases and future roadmap

## Design Principles

1. **100% offline** — everything works without internet after initial setup
2. **Zero telemetry** — no data leaves your machine
3. **Portable monolith** — copy `server.py` + `static/` to USB and run
4. **No build step** — no webpack, npm, or compilation
5. **Uncensored by default** — censorship can cost lives in emergencies
6. **Single SQLite DB** — no Redis, Postgres, or extra databases
7. **Vanilla JS** — no React, Vue, or framework dependencies

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Ollama offline" | Run `ollama serve` in a terminal |
| Models not showing | Run `ollama list` to check |
| Voice not working | Use Chrome (Web Speech API) |
| Map has no tiles | Place `.pmtiles` files in `static/maps/` |
| Not enough VRAM | Use smaller models: `gemma3:4b`, `phi4-mini` |
| RAG not working | The `nomic-embed-text` model is downloaded automatically |

## References

### Sci-Fi
- The Hitchhiker's Guide to the Galaxy (Douglas Adams) — DON'T PANIC
- Interstellar — TARS
- Alien — Mother (Nostromo)
- 2001: A Space Odyssey — HAL 9000
- Wool/Silo (Hugh Howey) — life in bunkers

### Survival
- SAS Survival Handbook (John Wiseman)
- Bushcraft 101 (Dave Canterbury)
- How to Invent Everything (Ryan North)

---

*DON'T PANIC — Bunker AI*
