# Bunker AI → Bunker OS — Roadmap

> "In the beginning the Universe was created. This has made a lot of people very angry
> and been widely regarded as a bad move." — Douglas Adams

## Visao Geral

**Bunker OS** — Um sistema operacional compacto estilo desktop para sobrevivencia offline.
Interface tipo OS com area de trabalho, janelas arrastaveis, barra de tarefas, relogio e apps.
Roda num PC com placa de video boa, sem internet, usando modelos locais via Ollama.

---

## Fases Completadas

### Fase 1-5: Fundacao
- [x] Backend FastAPI + SQLite + Kiwix integration
- [x] Auto-Setup (start.bat/sh + setup_downloads.py)
- [x] Frontend — Guias Dinamicos + Protocolos + Busca
- [x] Tracker de Suprimentos + Diario + Calendario + Relogio
- [x] Livros (epub.js) + Jogos (8 HTML5) + Wikipedia (Kiwix)

### Fase 6: Bunker OS — Desktop Environment
- [x] Area de trabalho com icones (grid, double-click)
- [x] Janelas arrastaveis/redimensionaveis com title bar
- [x] Barra de tarefas (relogio, status, apps abertos, start menu)
- [x] Window manager: z-index, foco, minimize, cascade

### Fase 7: Apps Nativos
- [x] 30+ apps integrados (Notepad, Word, Excel, Calculator, Timer, etc.)
- [x] Character system com personalidades e vozes

### Fase 8: App Builder + Polish
- [x] Boot screen BIOS, wallpapers, atalhos de teclado
- [x] Window snapping, Alt+Tab, context menu, toast notifications
- [x] Start menu com busca, shutdown animation

### Fase 10: Conteudo Denso
- [x] 15 guias de sobrevivencia ilustrados
- [x] 11 protocolos de emergencia (arvores de decisao)
- [x] 80 entradas de referencia rapida + SOS widget

### Fase 11: Modularizacao + UX
- [x] ES Modules (main.js, chat.js, state.js, apps.js, windowManager.js, markdown.js)
- [x] Spotlight / Command Palette (Ctrl+K)
- [x] Terminal, File Manager, Paint, Agenda/Tasks
- [x] Drag-and-drop para icones do desktop

### Fase 12: Modo Portavel Pendrive + Dual Backend
- [x] build_portable.py — pacote completo para pendrive
- [x] Python embarcado + llama-server + modelos GGUF
- [x] Auto-deteccao GPU, dual backend (Ollama / llama.cpp)

### Fase 13: Uncensored + Kokoro TTS
- [x] Dolphin3 como modelo padrao (uncensored by default)
- [x] Kokoro TTS (82M params, near-human) como engine principal
- [x] Cascade: Kokoro > Piper > pyttsx3 > edge-tts
- [x] Vozes pt-BR, en-US, es

---

## Em Andamento

### Fase 14: O Guia — AI Companion

> "The Hitchhiker's Guide to the Galaxy is a wholly remarkable book.
> Perhaps the most remarkable... certainly the most successful book
> ever to come out of the great publishing corporations of Ursa Minor."

A ideia: transformar a IA do Bunker OS num **companion interativo** — tipo o proprio
Guia do Mochileiro. Um dispositivo/entidade que voce consulta, que tem personalidade,
que responde com contexto, que SABE coisas sobre sobrevivencia e te guia.

Pense num cruzamento entre:
- **O Guia** (Mochileiro das Galaxias) — enciclopedia interativa com personalidade
- **Pokedex** (Pokemon) — interface compacta, scanner, banco de dados visual
- **TARS** (Interstellar) — humor ajustavel, companionship, pragmatismo
- **Pip-Boy** (Fallout) — wearable computer com stats, mapa, inventario
- **Cortana/Jarvis** — assistente com voz e presenca visual

#### UI do Companion

**Conceito: "The Guide"**
- Widget persistente no desktop (mini-window ou sidebar)
- Avatar animado (Live2D ou sprite-based) com expressoes
- Indicador de "humor" e "modo" visivel
- Quick-access: perguntas rapidas sem abrir o chat completo
- Notificacoes proativas ("Voce nao registrou agua hoje", "Fase da lua: cheia")
- Scanner mode: apontar webcam e receber analise instantanea

**Personalidades Pre-Built:**
- 🌌 **Deep Thought** — filosofico, pausado, responde com profundidade
- 🤖 **TARS** — sarcastico, pratico, humor ajustavel (1-100%)
- 👩‍💻 **Mother** — maternal, protocolar, sistematico
- 🔴 **HAL** — calmo, preciso, levemente inquietante
- 🧠 **Ford Prefect** — aventureiro, improviso, "don't panic"
- 🛡️ **Sobrevivente** — direto, sem frescura, foco em acao

#### Implementacao Tecnica
- [ ] Widget companion no desktop (mini-window sempre visivel)
- [ ] Sistema de expressoes/emocoes (sprite sheets ou Live2D)
- [ ] Notificacoes proativas baseadas em contexto
- [ ] Scanner mode (webcam → analise rapida)
- [ ] Quick-ask (pergunta sem abrir chat completo)
- [ ] Indicador visual de modo/humor/personalidade ativa
- [ ] Animacoes de idle, thinking, speaking, alert

---

## Proximas Fases

### Fase 15: PWA + Offline Total
- [ ] Service Worker para cache completo
- [ ] Manifest.json para install como app
- [ ] Sync em background quando internet disponivel
- [ ] Push notifications locais (lembretes de agua, comida, check-ins)

### Fase 16: RAG Local — Base de Conhecimento
- [ ] Indexacao de todos os guias/protocolos como embeddings
- [ ] Busca semantica offline (com modelo de embeddings local)
- [ ] Upload de documentos proprios (PDF, TXT, EPUB)
- [ ] A IA consulta a base antes de responder
- [ ] Citacoes com link para o guia/protocolo fonte

### Fase 17: Mesh Network + P2P
- [ ] Comunicacao entre instancias do Bunker OS via rede local
- [ ] Compartilhamento de suprimentos/status entre bunkers
- [ ] Chat P2P entre sobreviventes
- [ ] Integracao com Meshtastic/LoRa (MESH-API)

### Fase 18: Manual de Auto-Compreensao
- [ ] manual.md detalhado para o modelo entender o proprio sistema
- [ ] API de introspecção para a IA consultar seu proprio codigo
- [ ] Contexto automatico sobre estado do sistema nas respostas

### Fase 19: Nanoclaw — Self-Modification
- [ ] Agente que modifica o proprio codigo de forma controlada
- [ ] Lock por pasta/arquivo para seguranca
- [ ] Sandbox de testes antes de aplicar mudancas
- [ ] Rollback automatico se algo quebrar
- [ ] Log de todas alteracoes feitas pelo agente

---

## Apps do Bunker OS

### Core Apps
| App | Icone | Status |
|-----|-------|--------|
| AI Chat | 🤖 | ✅ Funcional |
| Guias | 📋 | ✅ 15 escritos |
| Protocolos | 🚨 | ✅ 11 criados |
| Suprimentos | 📦 | ✅ Funcional |
| Diario | 📓 | ✅ Funcional |
| Livros | 📚 | ✅ Funcional |
| Jogos | 🎮 | ✅ 8 criados |
| Mapas | 🗺️ | ✅ Funcional |
| Wikipedia | 🌐 | ✅ Funcional |
| Builder | 🔨 | ✅ Funcional |
| Personagens | 🎭 | ✅ Funcional |
| Referencia | 📖 | ✅ 80 entradas |

### Utilitarios
| App | Icone | Status |
|-----|-------|--------|
| Bloco de Notas | 📝 | ✅ Funcional |
| Word | 📄 | ✅ Funcional |
| Excel | 📊 | ✅ Funcional |
| Monitor | 💻 | ✅ Funcional |
| Calculadora | 🖩 | ✅ Funcional |
| Timer | ⏱️ | ✅ Funcional |
| Conversor | 🔢 | ✅ Funcional |
| Checklists | ✅ | ✅ Funcional |
| Bussola | 🧭 | ✅ Funcional |
| Morse | 📡 | ✅ Funcional |
| Radio | 📻 | ✅ Funcional |
| NATO | 🎙️ | ✅ Funcional |
| Sol/Lua | ☀️ | ✅ Funcional |
| Agua Segura | 💧 | ✅ Funcional |
| Agenda | 📋 | ✅ Funcional |
| File Manager | 💾 | ✅ Funcional |
| Paint | 🎨 | ✅ Funcional |
| Terminal | 📻 | ✅ Funcional |

---

## Projetos de Referencia no GitHub

### Ollama UIs
- **Open WebUI** (open-webui/open-webui) — 127k+ stars, a referencia em UI para Ollama
- **Lobe Chat** (lobehub/lobe-chat) — UI bonita com plugins e PWA
- **Ollama GUI** (HelgeSverre/ollama-gui) — interface leve e clean

### Offline-First AI
- **LocalAI** (mudler/LocalAI) — alternativa open-source ao OpenAI, sem GPU
- **ToolNeuron** (Siddhesh2377/ToolNeuron) — AI on-device Android com RAG, TTS/STT
- **SOLA** (FlorSanders/Smart_Offline_LLM_Assistant) — assistente offline-first com voz
- **Local-Talking-LLM** (vndee/local-talking-llm) — LLM com voz estilo Jarvis
- **Leon** (leon-ai/leon) — assistente pessoal open-source

### Emergencia & Sobrevivencia
- **SafeGuardian-LLM** (Ashoka74/SafeGuardian-LLM) — plataforma de resposta emergencial com IA
- **awesome-disastertech** (DisasterTechCrew/awesome-disastertech) — curadoria de projetos de emergencia
- **MESH-API** — Off-Grid AI com LoRa mesh, GPS alerts via SMS

### Potencial para Integracao
- **Meshtastic** — comunicacao LoRa mesh off-grid (Fase 17)
- **Kiwix** — Wikipedia offline (ja integrado)
- **epub.js** — leitor EPUB (ja integrado)
- **Kokoro** — TTS near-human (ja integrado)

---

## Filosofia

> "Em cenarios de sobrevivencia, censura pode custar vidas."

- **Uncensored by default** — Dolphin3 sem filtros
- **Offline-first** — tudo funciona sem internet
- **Privacy by design** — zero telemetria, zero cloud
- **Sci-fi soul** — a interface tem alma, nao e so ferramenta
- **DON'T PANIC** — a IA te acalma enquanto te ajuda

---

*"So long, and thanks for all the fish." — Bunker AI v3*
