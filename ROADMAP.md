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

### Novos Apps (Bunker OS exclusivos)
| App | Icone | Funcionalidade | Status |
|-----|-------|----------------|--------|
| Bloco de Notas | 📝 | Editor de texto puro, multiplas notas, SQLite | ✅ Funcional |
| Word Simples | 📄 | Rich text: bold, italic, listas, headings, contenteditable | ✅ Funcional |
| Excel Simples | 📊 | Grid 10x30, formulas SUM/AVG/COUNT/MIN/MAX/IF | ✅ Funcional |
| Monitor Sistema | 💻 | CPU, RAM, disco, uptime, conteudo — auto-refresh 5s | ✅ Funcional |
| Config Sistema | ⚙️ | Modelos, TTS, tema, sobre | ✅ Funcional (drawer) |

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
