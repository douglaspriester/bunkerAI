# Changelog

All notable changes to BunkerAI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-04-14

First public release. Offline-first "operating system" that runs in the browser.

### Added

**Local AI**
- Chat with uncensored LLMs via Ollama + llama.cpp (auto-detect)
- Default model lineup: gemma3:12b (chat+vision), qwen2.5-coder:14b, phi4 (fast), dolphin3 (uncensored), nomic-embed-text (embeddings)
- Voice in (faster-whisper STT) and out (Piper / Kokoro / edge-tts)
- Webcam vision
- Local image generation (Stable Diffusion)
- In-app app generator

**Knowledge Base**
- 16 survival guides (water, food, shelter, first aid, plant identification, etc.)
- 10 emergency protocols as JSON decision trees
- Offline Wikipedia, iFixit, Project Gutenberg, Stack Overflow via Kiwix ZIM files
- RAG over ingested docs with SQLite FTS5 + nomic-embed-text hybrid retrieval

**Offline Maps**
- Leaflet + Protomaps (PMTiles) — fully offline
- GPS support
- Survival markers: water, shelter, hazards, food, medical, supplies
- Celestial navigation reference

**Mini Desktop Environment**
- Draggable windows, taskbar, start menu, boot screen, keyboard shortcuts
- Cyberpunk dark theme
- Apps: notepad, word processor, spreadsheet, paint, terminal, file manager

**Media & Games**
- 8 HTML5 games
- ROM emulator (GB / GBA / NES)
- EPUB reader
- Media player

**Survival Tools**
- Water purification reference
- First aid and pharmacy database
- Ration planner
- Shelter guides
- Plant database

### Stack
- Python FastAPI backend, single `server.py` file (~4500 lines)
- Vanilla HTML / CSS / JS frontend — no framework, no build step
- SQLite for all persistent state
- Ollama + llama.cpp for LLM inference
- Leaflet + Protomaps for maps

### Design principles
- 100% offline after initial setup
- Zero telemetry, zero external calls
- Portable monolith — copy `server.py` + `static/` to a USB stick and run anywhere
- No build step
- Uncensored by default

### Requirements
- Python 3.10+
- Ollama
- NVIDIA GPU 8GB+ recommended (CPU works, just slower)

[0.1.0]: https://github.com/douglaspriester/bunkerAI/releases/tag/v0.1.0
