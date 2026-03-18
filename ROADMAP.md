# Bunker AI → Bunker OS — Roadmap

## Visao Geral

**Bunker OS** — Um sistema operacional compacto estilo desktop para sobrevivencia offline.
Interface tipo OS com area de trabalho, janelas arrastáveis, barra de tarefas, relogio e apps.
Roda num PC com placa de video boa, sem internet, usando modelos locais via Ollama.

## Fases Completadas
- [x] Fase 1: Backend — Novos endpoints + SQLite + Kiwix
- [x] Fase 2: Auto-Setup (start.bat + setup_downloads.py)
- [x] Fase 3: Frontend — Guias Dinamicos + Protocolos + Busca
- [x] Fase 4: Frontend — Tracker de Suprimentos + Diario (+ Relogio, Calendario, Status do Servidor)
- [x] Fase 5: Frontend — Livros (epub.js reader) + Jogos (iframe) + Wikipedia (Kiwix)
- [x] Fase 6: **Bunker OS — Desktop Environment**
  - Area de trabalho com icones de apps (grid, double-click abre)
  - Janelas arrastaveis/redimensionaveis com barra de titulo (minimizar, maximizar, fechar)
  - Barra de tarefas inferior (relogio, status sistema, apps abertos, start menu)
  - Window manager: z-index, foco, minimizar para taskbar, cascade positioning
  - Todos os modulos existentes viram "apps" em janelas
  - Start menu com lista de todos os apps

## Em Andamento
- [x] Fase 7: **Apps Nativos do Bunker OS** (Notepad, Word, Excel adicionados)
  - 🤖 AI Chat (gemma3 / dolphin3)
  - 📋 Guias de Sobrevivencia
  - 🚨 Protocolos de Emergencia
  - 📦 Tracker de Suprimentos
  - 📓 Diario + Calendario + Relogio
  - 📚 Leitor de Livros (epub.js)
  - 🎮 Jogos (8 jogos HTML5)
  - 🗺️ Mapas Offline (PMTiles)
  - 🌐 Wikipedia Offline (Kiwix)
  - 🔨 App Builder (code + preview)
  - 📝 Bloco de Notas (simples, salva em SQLite)
  - 📄 Word Simples (rich text, bold/italic/listas, salva HTML)
  - 📊 Excel Simples (grid com formulas basicas, salva CSV/JSON)
  - 🎭 Avatar Companion (Live2D)
  - ⚙️ Configuracoes do Sistema
- [x] Fase 8: App Builder Melhorado + Polish
  - Apps salvos abrem em janelas OS (iframe dentro de window)
  - Boot screen com animacao de inicializacao estilo BIOS
  - Relogio do taskbar com segundos + tooltip de data
  - Focus window ao clicar em qualquer parte da janela
  - Right-click context menu no desktop (abrir apps, trocar wallpaper, fechar todas janelas)
  - 5 wallpapers (default, starfield, grid, aurora, matrix) com persistencia em localStorage
  - Atalhos de teclado: Ctrl+W fechar, Ctrl+M minimizar, Ctrl+Shift+N abrir notepad, Esc fechar menu
  - Auto-save de editores (Notepad/Word/Excel) ao fechar janela
  - Start menu com opcao Reiniciar + separador
  - Duplo clique no relogio abre Diario, duplo clique no status abre Config
  - Titulo dinamico do chat com nome do personagem ativo
  - Toast notifications para auto-save e eventos do sistema
  - Window snapping (arrastar para bordas = snap left/right/maximize)
  - Alt+Tab para alternar entre janelas
  - Organizar janelas em grid (tile windows)
  - Start menu com busca de apps + Enter para abrir
  - Animacao de shutdown com overlay
  - Botao Desligar no start menu
- [ ] Fase 9: Avatar Companion (Live2D)
- [x] Fase 10: Conteudo Denso (15 guias, 10 protocolos) — COMPLETO
- [x] Fase 11: **Modularizacao + UX** (ES Modules + Spotlight + Terminal + Paint + File Manager)
  - Refatoracao de app.js monolitico em ES Modules (main.js, chat.js, state.js, apps.js, etc.)
  - Spotlight / Command Palette (Ctrl+K) com busca de apps e acoes rapidas
  - Terminal integrado com allowlist de comandos seguros
  - File Manager com navegacao de diretorios e preview
  - Paint com ferramentas de desenho (brush, eraser, line, rect, circle, fill)
  - Agenda/Tasks com CRUD, prioridades e datas
  - Drag-and-drop para reordenar icones do desktop
  - Atalhos de teclado expandidos (F1, Ctrl+Shift+C, Ctrl+Shift+A)
- [x] Fase 12: **Modo Portavel Pendrive + Dual Backend**
  - build_portable.py monta pacote completo para pendrive
  - Python embarcado + llama-server + modelos GGUF built-in
  - Auto-deteccao GPU via nvidia-smi com offload automatico
  - Dual backend: Ollama (primario) / llama.cpp (fallback portavel)
  - Modelo CPU (Dolphin 1B uncensored) + GPU (Dolphin 8B uncensored + Gemma 3 4B multimodal)
  - API /api/models/recommended com deteccao de hardware
  - INICIAR.bat / INICIAR.sh para Windows e Linux
- [x] Fase 13: **Uncensored + Kokoro TTS**
  - Filosofia: modelos uncensored por padrao (censura pode custar vidas)
  - Dolphin3 como modelo padrao de chat (substituiu gemma3:12b)
  - Kokoro TTS (82M params, near-human) como engine TTS principal
  - Cascade: Kokoro > Piper > pyttsx3 > edge-tts
  - Vozes pt-BR, en-US, es com Kokoro (pm_alex, af_heart, etc.)
  - Download de modelos Kokoro via /api/tts/kokoro/download
  - Modelos built-in portaveis atualizados para Dolphin uncensored
- [x] Fase 14: **The Guide — AI Companion Widget**
  - Widget persistente no desktop (canto inferior direito)
  - Avatar sprite-based com expressoes ASCII por mood (idle, thinking, happy, alert, sleeping)
  - 6 personalidades: Deep Thought, TARS, MOTHER, HAL 9000, Ford Prefect, Sobrevivente
  - Quick-ask: perguntas rapidas sem abrir o chat completo
  - Quick actions: grid de atalhos (Emergencia, Guias, Radio, Mapa, Suprimentos, Diario)
  - Dicas proativas contextuais por modo IA ativo (medical, survival, etc.)
  - Indicador visual de modo/personalidade ativa
  - Integracao com sistema de modos — atualiza ao trocar modo no chat
  - Modulo ES puro: static/js/guide-companion.js
  - Scanner mode stub (futura integracao com webcam)

---

## Fase 15: Distribuicao Portatil Definitiva

**Objetivo:** 1 download → pendrive → qualquer PC → duplo-clique → funciona. ZERO internet.

### Problema Atual
O Ollama nao e portatil — instala no sistema e guarda modelos em ~/.ollama/models.
O start.sh precisa de internet na primeira vez para criar venv e instalar deps.

### Solucao: Pacote Auto-Contido com llama.cpp

O `build_portable.py` existente ja faz 80% do trabalho. Falta:

#### 15.1 — Estrutura Final do Pacote

```
BunkerAI/                              (~12-15 GB)
├── INICIAR.command                     ← Mac: duplo-clique
├── INICIAR.bat                         ← Windows: duplo-clique
├── LEIA-ME.txt                         ← Instrucoes
│
└── app/                                ← Tudo aqui dentro
    ├── server.py                       ← Backend FastAPI
    ├── start.sh / start.bat            ← Launcher interno
    ├── static/                         ← Frontend completo
    │   ├── js/                         ← ES Modules
    │   ├── fonts/                      ← Google Fonts local
    │   ├── lib/                        ← Leaflet, epub.js, etc.
    │   └── style.css
    ├── data/                           ← Conteudo offline
    │   ├── guides/                     ← 15 guias markdown
    │   ├── protocols/                  ← 11 protocolos JSON
    │   ├── games/                      ← 8 jogos HTML5
    │   ├── books/                      ← Biblioteca (epub opcionais)
    │   └── zim/                        ← Wikipedia (ZIM opcional)
    │
    ├── models/                         ← LLMs GGUF embutidos
    │   ├── dolphin-1b-q4.gguf         ← CPU leve (~0.8 GB)
    │   ├── dolphin-8b-q4.gguf         ← Principal uncensored (~4.9 GB)
    │   └── gemma3-4b-q4.gguf          ← Visao/multimodal (~3.0 GB)
    │
    ├── bin/                            ← Binarios llama.cpp
    │   ├── mac/                        ← llama-server (macOS universal)
    │   │   └── llama-server
    │   ├── win/                        ← llama-server.exe (Windows x64)
    │   │   └── llama-server.exe
    │   └── linux/                      ← llama-server (Linux x64)
    │       └── llama-server
    │
    ├── python/                         ← Python embarcado (Windows only)
    │   └── python-3.11-embed-amd64/
    │
    ├── venv/                           ← Ambiente virtual pre-construido
    │   └── (todas as deps ja instaladas)
    │
    └── kokoro_models/                  ← TTS Kokoro (opcional, ~300MB)
        └── kokoro-v1.0.onnx
```

#### 15.2 — Launcher Inteligente

O INICIAR.command/bat na raiz detecta automaticamente:
1. OS (Mac/Windows/Linux)
2. GPU disponivel (nvidia-smi / system_profiler)
3. RAM disponivel
4. Escolhe modelo: GPU (dolphin-8b) se possivel, senao CPU (dolphin-1b)
5. Inicia llama-server com o modelo certo
6. Inicia server.py
7. Abre browser

Sequencia de boot (~3 segundos):
```
INICIAR.command
  → detecta OS + hardware
  → inicia llama-server (background, porta 8070)
  → ativa venv
  → inicia uvicorn (porta 8888)
  → abre http://localhost:8888
```

#### 15.3 — Tarefas de Implementacao

- [ ] **build_portable.py v2** — Atualizar script de build:
  - [ ] Baixar binarios llama.cpp para Mac (universal), Windows (x64), Linux (x64)
  - [ ] Baixar 3 modelos GGUF (CPU + GPU + Vision)
  - [ ] Criar venv pre-construido com todas as deps
  - [ ] Empacotar Python embarcado (Windows only, Mac/Linux usam system Python)
  - [ ] Gerar estrutura de pastas final
  - [ ] Flag --light para pacote leve (~2GB, so modelo CPU)
  - [ ] Flag --full para pacote completo (~15GB, 3 modelos + Kokoro + Wikipedia ZIM)

- [ ] **Launcher Mac** — INICIAR.command v2:
  - [ ] Auto-detecta hardware (sysctl para RAM, system_profiler para GPU)
  - [ ] Inicia llama-server com modelo apropriado
  - [ ] Cria venv se nao existir (fallback, idealmente ja vem pronto)
  - [ ] Nao tenta baixar nada da internet

- [ ] **Launcher Windows** — INICIAR.bat v2:
  - [ ] Usa Python embarcado da pasta python/ se existir
  - [ ] Detecta GPU via nvidia-smi ou wmic
  - [ ] Mesmo fluxo do Mac

- [ ] **server.py update** — Tri-backend:
  - [ ] Backend 1: Ollama (dev mode, se rodando)
  - [ ] Backend 2: llama.cpp local (modo portatil, autodetect)
  - [ ] Backend 3: llamafile (futuro, single-file)
  - [ ] Auto-selecao de backend na inicializacao

- [ ] **UI: Download Manager** — Painel no app para gerenciar modelos:
  - [ ] Listar modelos disponiveis vs instalados
  - [ ] Progresso de download com barra visual
  - [ ] Detectar hardware e recomendar modelos
  - [ ] Funciona tanto com Ollama (dev) quanto llama.cpp (portatil)

#### 15.4 — Modelos Recomendados (Março 2026)

| Modelo | Tamanho | Tipo | Uso | Uncensored |
|--------|---------|------|-----|------------|
| Dolphin 1B Q4 | ~0.8 GB | CPU | Fallback leve, qualquer PC | Sim |
| Dolphin 8B Q4 | ~4.9 GB | GPU 6GB+ | Chat principal | Sim |
| Gemma 3 4B Q4 | ~3.0 GB | GPU 4GB+ | Visao/webcam/scanner | Nao |
| Qwen 2.5 Coder 7B Q4 | ~5 GB | GPU 6GB+ | App Builder (opcional) | Nao |

**Nota sobre modelos:** O HuggingFace e a fonte para GGUFs. Bartowski publica quantizacoes Q4_K_M otimizadas para quase todos os modelos populares.

#### 15.5 — Opcao Nuclear: Llamafile

Para o MAXIMO de portabilidade, considerar llamafile (Mozilla):
- Modelo + runtime empacotados em UM UNICO executavel
- Roda no Mac, Windows e Linux sem instalacao
- Inclui servidor HTTP com API compativel com OpenAI
- Desvantagem: menos flexivel, 1 modelo por arquivo, nao troca de modelo on-the-fly

Fluxo llamafile:
```
BunkerAI/
├── INICIAR.command
├── dolphin-8b.llamafile         ← ~5GB, roda direto!
└── app/
    └── (frontend + server.py)
```

**Decisao:** Manter llama.cpp como primary (mais flexivel, multi-modelo), llamafile como futuro fallback.

---

## Fase 16: Evolucao do Guide Companion (Futuro)

- [ ] Scanner Mode real: webcam → llama.cpp vision → analise instantanea no widget
- [ ] Notificacoes proativas com dados reais (agua, suprimentos, diario)
- [ ] Animacoes SVG para o avatar (substituir ASCII por sprite sheets)
- [ ] Vozes por personalidade (cada personalidade com voz TTS diferente)
- [ ] Modo "Pokedex": apontar camera → identificar planta/animal/objeto
- [ ] Humor adaptativo: muda baseado em atividade do usuario
- [ ] Integracao com ARWES (framework UI sci-fi) para visual futurista

---

## Apps do Bunker OS

### Core Apps (ja existem como modulos)
| App | Icone | Funcionalidade | Status |
|-----|-------|----------------|--------|
| AI Chat | 🤖 | Chat com LLM local, visao, voz | ✅ Funcional |
| Guias | 📋 | 15 guias de sobrevivencia | ✅ 15 escritos |
| Protocolos | 🚨 | Arvores de decisao emergencia | ✅ 10 criados |
| Suprimentos | 📦 | CRUD + dashboard + categorias | ✅ Funcional |
| Diario | 📓 | Entries + calendario + status | ✅ Funcional |
| Livros | 📚 | Leitor epub offline (epub.js) | ✅ Funcional |
| Jogos | 🎮 | 8 jogos HTML5 self-contained | ✅ 8 criados |
| Mapas | 🗺️ | PMTiles offline | ✅ Funcional |
| Wikipedia | 🌐 | Kiwix iframe | ✅ Funcional |
| Builder | 🔨 | Gera apps HTML com AI | ✅ Funcional |
| Personagens | 🎭 | Character cards para AI | ✅ Funcional |
| TTS | 🔊 | Text-to-speech config | ✅ Funcional |
| The Guide | 📖 | Companion widget com personalidades | ✅ Funcional |

### Novos Apps (Bunker OS exclusivos)
| App | Icone | Funcionalidade | Status |
|-----|-------|----------------|--------|
| Bloco de Notas | 📝 | Editor de texto puro, multiplas notas, SQLite | ✅ Funcional |
| Word Simples | 📄 | Rich text: bold, italic, listas, headings, contenteditable | ✅ Funcional |
| Excel Simples | 📊 | Grid 10x30, formulas SUM/AVG/COUNT/MIN/MAX/IF | ✅ Funcional |
| Monitor Sistema | 💻 | CPU, RAM, disco, uptime, conteudo — auto-refresh 5s | ✅ Funcional |
| Calculadora | 🖩 | Calculadora com teclado, ±, %, operacoes | ✅ Funcional |
| Timer | ⏱️ | Cronometro + contagem regressiva + voltas | ✅ Funcional |
| Conversor | 🔢 | Temperatura, distancia, peso, volume, velocidade | ✅ Funcional |
| Checklists | ✅ | Listas com templates de sobrevivencia, progresso | ✅ Funcional |
| Codigo Morse | 📡 | Tradutor texto↔morse, audio, flash SOS, referencia | ✅ Funcional |
| Frequencias Radio | 📻 | Emergencia, HAM, codigos Q, dicas | ✅ Funcional |
| Fonetico NATO | 🎙️ | Tradutor A→Alpha, referencia completa | ✅ Funcional |
| Sol / Lua | ☀️ | Nascer/por do sol, golden hour, fase da lua | ✅ Funcional |
| Agua Segura | 💧 | Calculadora purificacao (cloro, iodo, fervura, SODIS) | ✅ Funcional |
| Media Player | 🎵 | Audio player com playlist | ✅ Funcional |
| Tarefas | 📌 | Task manager com prioridades | ✅ Funcional |
| Gerenciador Arquivos | 📁 | Navegacao de arquivos com preview | ✅ Funcional |
| Paint | 🎨 | Editor grafico com ferramentas de desenho | ✅ Funcional |
| Gerador IA | 🖼️ | Gerador de imagens com AI | ✅ Funcional |
| Referencia | 📖 | 80 entradas de referencia, 9 categorias | ✅ Funcional |
| Config Sistema | ⚙️ | Modelos, TTS, tema, sobre | ✅ Funcional (drawer) |

### Arquitetura do Window Manager
```
Desktop (fullscreen)
├── Wallpaper (CSS gradient ou imagem)
├── App Icons (grid, double-click abre)
├── Guide Widget (companion IA, canto inferior direito)
├── SOS Widget (emergencia, canto inferior direito)
├── Windows[] (draggable, resizable)
│   ├── Title bar (icone + titulo + min/max/close)
│   ├── Content (cada app renderiza aqui)
│   └── Resize handle (canto inferior direito)
└── Taskbar (bottom, fixed)
    ├── Start/Launcher button
    ├── Running apps (click = focus/minimize)
    ├── System tray (status icons)
    └── Clock (HH:MM:SS + data)
```

---

## Ideias Futuras

### README/Manual.md para Auto-Compreensao do Modelo
**Prioridade:** Media
**Descricao:** Criar um `README/manual.md` MUITO bem detalhado, para que o proprio modelo de IA consiga entender como o Bunker AI funciona internamente.

### Integracao Nanoclaw + Lock por Pasta
**Prioridade:** Baixa (exploratoria)
**Descricao:** Integrar o nanoclaw com sistema de lock por pasta, para que o proprio modelo/agente consiga acessar seu codigo interno de forma controlada e segura.

**Requisitos:**
- Sistema de permissoes por diretorio
- Lock file para evitar conflitos de escrita
- Log de todas as alteracoes feitas pelo agente
- Rollback automatico se algo quebrar
- Sandbox de testes antes de aplicar mudancas no codigo principal

**Nota:** Essa ideia depende do manual.md estar completo primeiro.

### RAG Local com Documentos do Usuario
**Prioridade:** Media
**Descricao:** Implementar Retrieval-Augmented Generation usando documentos locais.
- Indexar PDFs, TXTs, markdowns do usuario
- Embeddings locais (sentence-transformers via llama.cpp)
- Busca semantica offline
- Referencia: easy-local-rag (AllAboutAI-YT)

### Whisper.cpp WASM (STT no Browser)
**Prioridade:** Media
**Descricao:** Substituir faster-whisper (Python) por whisper.cpp compilado em WASM.
- Roda 100% no browser, sem backend
- Elimina dependencia de Python para STT
- Modelo tiny/base sufficient para comandos de voz
- Referencia: whisper.cpp WASM (ggml-org)

### Visual Sci-Fi com ARWES
**Prioridade:** Baixa (estetica)
**Descricao:** Integrar framework ARWES para UI sci-fi futurista.
- Componentes animados com efeito glitch/holografico
- Perfeito para o tema Bunker/sobrevivencia
- Referencia: arwes (github.com/arwes/arwes)
