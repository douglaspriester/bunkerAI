# CLAUDE.md — Bunker AI (bunkeros)

## O que é
OS de sobrevivência offline-first com IA local — desktop no browser, sem internet após setup inicial.
Apelido futuro: **bunkeros**. Tema cyberpunk sci-fi (TARS, HAL 9000, Mother). UI em PT-BR.

## Stack principal
- Backend: Python FastAPI (`server.py` — monolítico, ~4500 linhas)
- Frontend: HTML/CSS/JS vanilla, zero frameworks, zero build step
- LLM: Ollama ou llama.cpp (auto-detectado no startup)
- DB: SQLite (`data/db/bunker.db`)
- Mapas: Leaflet + PMTiles (offline)
- STT: faster-whisper | TTS: Piper / Kokoro / pyttsx3 / edge-tts
- Python 3.10+, GPU 8GB+ recomendada

## Rodar local
```bash
./start.sh           # macOS/Linux — cria venv, checa deps, sobe em :8888
start.bat            # Windows
# ou direto:
python3 server.py
```
Portas: `8888` (app), `8889` (Kiwix/Wikipedia), `11434` (Ollama).

## Testar
```bash
# Syntax check rápido
python3 -c "import ast; ast.parse(open('server.py').read()); print('OK')"
```
Não há test framework configurado. Para endpoints, usar FastAPI `TestClient` diretamente.

## Build / Deploy
100% offline — não tem deploy em cloud. Build portátil para USB:
```bash
python3 build_portable.py
```

## Estrutura de arquivos importante
- `server.py` — TODO o backend: rotas, LLM proxy, RAG, streaming SSE
- `static/index.html` — único HTML, todos os painéis (~3400 linhas)
- `static/style.css` — estilos dark cyberpunk (~11600 linhas)
- `static/js/apps.js` — lógica de TODOS os 40+ apps (~14000 linhas)
- `static/js/main.js` — entry point, wires callbacks, inicializa tudo
- `static/js/state.js` — estado global + persistência localStorage
- `static/js/windowManager.js` — desktop window manager (drag, resize, z-index)
- `static/js/chat.js` — chat UI + streaming SSE + 6 modos de IA
- `static/js/guide-companion.js` — 6 personalidades IA (TARS, HAL, Mother, etc.)
- `data/guides/*.md` — 16 guias de sobrevivência (auto-indexados no RAG)
- `data/protocols/*.json` — 10 decision trees de emergência
- `data/db/bunker.db` — SQLite (suprimentos, diário, notas, tasks, RAG chunks)

## Convenções e gotchas
- `server.py` é **monolítico — não quebrar** em múltiplos arquivos (portabilidade USB é requisito)
- `apps.js` tem ~14k linhas — intencional; cada app tem header `// ─── APP NAME ───`
- Funções chamadas de `onclick=""` HTML **devem estar em `window.functionName`**
- Todo texto visível ao usuário em **PT-BR**
- **Nunca adicionar dependência de internet** — offline é requisito duro
- **Nunca adicionar build step** (webpack, npm, etc.) — `static/` é servido direto
- RAG auto-indexa guides + protocols no startup; reindexar: `POST /api/rag/reindex`
- `BACKEND` global = "ollama" | "llama.cpp" | "none" — nunca hardcodar URLs Ollama, usar `OLLAMA_BASE`
- 8 apps no desktop; os demais ficam no **Launchpad** (overlay fullscreen, macOS-style)
- Settings é janela normal (`#settingsView`); `toggleConfig()` é alias de back-compat
- Seções em `server.py` marcadas com `# ─── Section Name ─────...`
- Seções em `style.css` marcadas com `/* ═══ SECTION NAME ═══ */`

### App Registration Pattern (novo app)
1. HTML panel em `index.html`: `<div class="panel-view hidden" id="{app}View">`
2. Init em `main.js` → `openMap`: `{appId}: () => window.{appId}Init?.()`
3. Lógica em `apps.js`: `window.{appId}Init = function() { ... }`
4. Estilos em `style.css` com section header

### Chat AI Modes (6)
`general`, `medical`, `survival`, `engineer`, `defense`, `psych` — gerenciados em `chat.js`.

### Guide Companion Personalities (6)
`deepThought`, `tars`, `mother`, `hal`, `ford`, `survivor` — em `guide-companion.js`.
Reusados no app **Personagens** para role-play com histórico isolado por personagem em localStorage.

## Pessoas/contas associadas
- Desenvolvedor: Douglas Priester (`douglaspriester`)

## Referências externas
- GitHub: https://github.com/douglaspriester/bunkerAI
- Docs internas: `docs/` e este CLAUDE.md
