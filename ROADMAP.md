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

## Em Andamento
- [ ] Fase 5: Frontend — Livros (epub.js) + Jogos (iframe) + Wikipedia (Kiwix)
- [ ] Fase 6: **Bunker OS — Desktop Environment**
  - Area de trabalho com icones de apps
  - Janelas arrastaveis/redimensionaveis com barra de titulo (minimizar, maximizar, fechar)
  - Barra de tarefas inferior (relogio, status sistema, apps abertos, launcher)
  - Window manager: z-index, foco, minimizar para taskbar
  - Todos os modulos existentes viram "apps" em janelas
- [ ] Fase 7: **Apps Nativos do Bunker OS**
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
- [ ] Fase 8: App Builder Melhorado (split-view estilo Lovable)
- [ ] Fase 9: Avatar Companion (Live2D)
- [ ] Fase 10: Conteudo Denso (+19 guias, +6 protocolos)

## Apps do Bunker OS

### Core Apps (ja existem como modulos)
| App | Icone | Funcionalidade | Status |
|-----|-------|----------------|--------|
| AI Chat | 🤖 | Chat com LLM local, visao, voz | ✅ Funcional |
| Guias | 📋 | 15 guias de sobrevivencia | ✅ 6 escritos |
| Protocolos | 🚨 | Arvores de decisao emergencia | ✅ 4 criados |
| Suprimentos | 📦 | CRUD + dashboard + categorias | ✅ Funcional |
| Diario | 📓 | Entries + calendario + status | ✅ Funcional |
| Livros | 📚 | Leitor epub offline | 🔧 Em progresso |
| Jogos | 🎮 | 8 jogos HTML5 self-contained | ✅ 8 criados |
| Mapas | 🗺️ | PMTiles offline | ✅ Funcional |
| Wikipedia | 🌐 | Kiwix iframe | ✅ Funcional |
| Builder | 🔨 | Gera apps HTML com AI | ✅ Funcional |
| Personagens | 🎭 | Character cards para AI | ✅ Funcional |
| TTS | 🔊 | Text-to-speech config | ✅ Funcional |

### Novos Apps (Bunker OS exclusivos)
| App | Icone | Funcionalidade |
|-----|-------|----------------|
| Bloco de Notas | 📝 | Editor de texto puro, multiplas notas |
| Word Simples | 📄 | Rich text: bold, italic, listas, headings |
| Excel Simples | 📊 | Grid 26x100, formulas SUM/AVG/COUNT/IF |
| Config Sistema | ⚙️ | Modelos, TTS, tema, sobre |

### Arquitetura do Window Manager
```
Desktop (fullscreen)
├── Wallpaper (CSS gradient ou imagem)
├── App Icons (grid, double-click abre)
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
