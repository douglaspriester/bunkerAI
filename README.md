# Bunker AI — DON'T PANIC

> "A resposta para a vida, o universo e tudo mais e 42.
> Mas primeiro, certifique-se de que voce sabe onde esta sua toalha."

Sistema operacional de sobrevivencia 100% offline com IA local.
Inspirado no Guia do Mochileiro das Galaxias, TARS (Interstellar), Mother (Alien) e Deep Thought.

## O que e

**Bunker OS** — Um desktop environment completo rodando no navegador, com 30+ apps integrados e IA local via Ollama. Zero internet, zero cloud, zero tracking.

### IA Multimodal
- **Texto** — Chat com LLM local (Dolphin3 uncensored por padrao)
- **Voz** — STT (faster-whisper offline) + TTS (Kokoro near-human, Piper, edge-tts)
- **Visao** — Webcam ao vivo + analise de imagens com modelos multimodais
- **5 Modos IA** — Medico, Sobrevivencia, Engenheiro, Defesa, Psicologia
- **App Builder** — `/build` + descricao = app completo gerado ao vivo
- **Personagens** — Sistema de avatares com personalidades e vozes customizaveis

### Desktop Environment (Bunker OS)
- Boot screen estilo BIOS com animacao
- Janelas arrastaveis/redimensionaveis com window manager completo
- Barra de tarefas, start menu, system tray com relogio
- Spotlight/Command Palette (Ctrl+K) com busca global
- Alt+Tab, window snapping, atalhos de teclado
- 5 wallpapers tematicos com persistencia
- Context menu, drag-and-drop de icones

### 30+ Apps Integrados

**Core:**
| App | Funcionalidade |
|-----|----------------|
| 🤖 AI Chat | Chat multimodal com 5 modos IA |
| 📋 Guias | 15 guias ilustrados de sobrevivencia |
| 🚨 Protocolos | 11 arvores de decisao de emergencia |
| 📦 Suprimentos | CRUD + dashboard + categorias |
| 📓 Diario | Entries + calendario + relogio |
| 📚 Livros | Leitor EPUB offline (epub.js) |
| 🎮 Jogos | 8 jogos HTML5 (xadrez, sudoku, tetris, etc.) |
| 🗺️ Mapas | Offline com PMTiles + GPS + marcadores |
| 🌐 Wikipedia | Offline via Kiwix (ZIM) |
| 🔨 App Builder | Gera apps HTML com IA + preview ao vivo |
| 🎭 Personagens | Character cards para personalizar a IA |
| 📖 Referencia | 80 entradas de sobrevivencia + SOS widget |

**Utilitarios:**
| App | Funcionalidade |
|-----|----------------|
| 📝 Bloco de Notas | Multi-notas, salva em SQLite |
| 📄 Word | Rich text (bold, italic, listas, headings) |
| 📊 Excel | Grid 10x30, formulas SUM/AVG/COUNT/MIN/MAX/IF |
| 💻 Monitor | CPU, RAM, disco, uptime, auto-refresh |
| 🖩 Calculadora | Operacoes, ±, % |
| ⏱️ Timer | Cronometro + contagem regressiva + voltas |
| 🔢 Conversor | Temperatura, distancia, peso, volume, velocidade |
| ✅ Checklists | Templates de sobrevivencia com progresso |
| 🧭 Bussola | Sensor ou manual, direcoes cardeais |
| 📡 Codigo Morse | Tradutor texto↔morse, audio SOS |
| 📻 Frequencias | Emergencia, HAM, codigos Q |
| 🎙️ Fonetico NATO | A→Alpha, referencia completa |
| ☀️ Sol / Lua | Nascer/por do sol, golden hour, fases |
| 💧 Agua Segura | Calculadora purificacao (cloro, iodo, fervura, SODIS) |
| 📋 Agenda | Tasks com CRUD, prioridades, datas |
| 💾 File Manager | Navegacao de diretorios e preview |
| 🎨 Paint | Brush, eraser, line, rect, circle, fill |
| 📻 Terminal | Sandbox com allowlist de comandos |

### Conteudo de Sobrevivencia

**15 Guias Ilustrados:**
Agua, Fogo, Abrigo, Primeiros Socorros, Alimentacao, Navegacao, Radio, Higiene, Defesa, Saude Mental, Energia, Ferramentas, Nos e Cordas, Plantas Medicinais, Previsao do Tempo

**11 Protocolos de Emergencia (arvores de decisao):**
RCP, Hemorragia, Engasgo, Queimaduras, Fraturas, Hipotermia, Desidratacao, Picada de Cobra, Infeccao, Choque

**80 Entradas de Referencia Rapida:**
Sinalizacao, abrigo, agua, medico, ferramentas e mais.

## Inicio Rapido

### Linux / Mac
```bash
chmod +x start.sh
./start.sh
```

### Windows
```bat
start.bat
```

O script faz tudo automaticamente:
1. Verifica Python 3.10+ e Ollama
2. Baixa os 4 modelos necessarios (so no primeiro uso)
3. Cria venv e instala dependencias
4. Inicia o servidor em http://localhost:8888

### Pre-requisitos

| Software | Download | Obrigatorio |
|----------|----------|-------------|
| Python 3.10+ | python.org | Sim |
| Ollama | ollama.ai | Sim |
| GPU 8GB+ VRAM | — | Recomendado |

## Modelos

| Uso | Modelo | Tamanho | Por que |
|-----|--------|---------|---------|
| Chat (padrao) | `dolphin3` | ~5 GB | Uncensored, sem guardrails |
| Visao | `gemma3:12b` | ~8 GB | Multimodal nativo |
| Codigo | `qwen2.5-coder:14b` | ~9 GB | Melhor modelo de codigo para 12GB VRAM |
| Rapido | `phi4` | ~9 GB | Ultra rapido para iteracao |
| Alternativo | `dolphin-llama3.1:8b` | ~5 GB | Uncensored avancado |

> Filosofia: **modelos uncensored por padrao**. Em cenarios de sobrevivencia, censura pode custar vidas.

## TTS (Text-to-Speech)

Cascade de engines com fallback automatico:
1. **Kokoro** (82M params, near-human) — pt-BR, en-US, es
2. **Piper** — offline, leve
3. **pyttsx3** — fallback local
4. **edge-tts** — fallback online

## Mapa Offline

Funciona em dois modos:

**Online (padrao):** Tiles do CartoDB Dark Matter via internet.

**100% Offline com PMTiles:**
```bash
# Instale o CLI
npm install -g pmtiles

# Extraia o Brasil (~300MB, zoom 12)
pmtiles extract \
  https://build.protomaps.com/20250101.pmtiles \
  static/maps/brasil.pmtiles \
  --bbox=-74,-34,-35,5 --maxzoom=12

# Ou Sao Paulo (~30MB, zoom 14)
pmtiles extract \
  https://build.protomaps.com/20250101.pmtiles \
  static/maps/sp.pmtiles \
  --bbox=-47.5,-24.2,-45.5,-23.0 --maxzoom=14
```

**Funcionalidades:** GPS, marcadores persistentes, medicao de distancia (Haversine), coordenadas em tempo real.

## Modo Portavel (Pendrive)

```bash
python build_portable.py
```

Gera pacote completo para Windows/Linux com:
- Python embarcado + llama-server
- Modelos GGUF built-in (CPU + GPU)
- Auto-deteccao de GPU via nvidia-smi
- Dual backend: Ollama (primario) / llama.cpp (fallback)
- Chromium portavel

## Estrutura do Projeto

```
bunkerAI/
├── server.py              # Backend FastAPI (~2000 linhas)
├── requirements.txt       # Dependencias Python
├── start.sh / start.bat   # Inicializadores com auto-setup
├── build_portable.py      # Builder de pacote portavel
├── setup_downloads.py     # Setup inicial (indexes, SQLite, dirs)
├── static/
│   ├── index.html         # Frontend principal
│   ├── style.css          # Tema dark cyberpunk
│   ├── js/
│   │   ├── main.js        # Entry point + imports
│   │   ├── state.js       # State management (localStorage)
│   │   ├── chat.js        # Chat, streaming, modos IA
│   │   ├── windowManager.js # Desktop environment
│   │   ├── apps.js        # 30+ apps (~5200 linhas)
│   │   └── markdown.js    # Renderer markdown→HTML
│   ├── fonts/             # 11 Google Fonts bundled (WOFF2)
│   ├── lib/               # Leaflet, PMTiles, epub.js, jszip, minisearch
│   ├── img/               # Ilustracoes dos guias
│   └── maps/              # .pmtiles para modo offline
├── data/
│   ├── guides/            # 15 guias markdown
│   ├── protocols/         # 11 protocolos JSON (arvores de decisao)
│   ├── games/             # 8 jogos HTML5 self-contained
│   ├── books/             # EPUBs offline
│   ├── zim/               # Wikipedia offline (Kiwix ZIM)
│   └── db/                # SQLite (suprimentos, diario, notas)
└── kokoro_models/         # Modelos Kokoro TTS (download automatico)
```

## Stack

- **Backend:** FastAPI + Uvicorn + httpx + aiosqlite
- **Frontend:** HTML/CSS/JS vanilla (ES Modules, zero frameworks)
- **LLM:** Ollama (primario) / llama.cpp (fallback portavel)
- **Mapa:** Leaflet 1.9.4 + Protomaps/PMTiles
- **STT:** faster-whisper (offline, GPU) → Web Speech API (fallback)
- **TTS:** Kokoro → Piper → pyttsx3 → edge-tts (cascade)
- **Persistencia:** localStorage + SQLite (aiosqlite)
- **Busca:** MiniSearch (client-side full-text search)

## Atalhos de Teclado

| Atalho | Acao |
|--------|------|
| Ctrl+K | Spotlight / Command Palette |
| Alt+Tab | Alternar janelas |
| Ctrl+W | Fechar janela |
| Ctrl+M | Minimizar janela |
| Ctrl+Shift+N | Novo Bloco de Notas |
| Esc | Fechar menu / modal |
| F1 | Ajuda |

## Troubleshooting

| Problema | Solucao |
|----------|---------|
| "Ollama offline" | Rode `ollama serve` no terminal |
| Modelos nao aparecem | `ollama list` para verificar |
| Voz nao funciona | Use Chrome (Web Speech API) |
| Mapa sem tiles | Coloque um .pmtiles em `static/maps/` |
| Erro ao iniciar | Python 3.10+ instalado? |
| VRAM insuficiente | Use modelos menores: `gemma3:4b`, `phi4-mini` |
| TTS sem audio | Kokoro baixa automatico, aguarde o download |

## Referencias & Inspiracao

### Sci-Fi
- **Guia do Mochileiro das Galaxias** (Douglas Adams) — DON'T PANIC, 42, Deep Thought
- **Interstellar** — TARS e seu nivel de humor ajustavel
- **Alien** — Mother, o computador da Nostromo
- **2001** — HAL 9000 ("I can do that, Dave")
- **Neuromancer** (William Gibson) — cyberpunk, IA local
- **Snow Crash** (Neal Stephenson) — metaverso e hackers
- **Wool/Silo** (Hugh Howey) — vida em bunkers subterraneos

### Sobrevivencia
- **SAS Survival Handbook** (John Wiseman)
- **Bushcraft 101** (Dave Canterbury)
- **How to Invent Everything** (Ryan North) — reconstruir a civilizacao do zero

---

*DON'T PANIC — Bunker AI v3*
