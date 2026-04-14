# Bunker AI — Roadmap

> Objetivo: ser o melhor sistema offline de sobrevivencia com IA do mundo.
> Referencia competitiva: Project NOMAD (11K+ stars) — e ultrapassar.

## Status Atual

**38K+ linhas de codigo** | **43 apps** | **80+ endpoints** | **16 guias** | **10 protocolos**

O Bunker AI ja e tecnicamente superior ao NOMAD em IA (RAG, voz, visao, app builder, geracao de imagem).
O NOMAD e superior em volume de conteudo offline e visibilidade/comunidade.

> **Ultima atualizacao:** Abril 2026 — Fase 17 ~70% concluida, onboarding Wi-Fi, ZIMs corrigidos, todos os 43 apps no desktop.

---

## Fases Completadas

### Fase 1-5: Fundacao
- [x] Backend FastAPI + SQLite + Kiwix
- [x] Auto-setup (start.bat/sh + setup_downloads.py)
- [x] Guias dinamicos + Protocolos + Busca global
- [x] Tracker de Suprimentos + Diario + Calendario
- [x] Livros (epub.js) + Jogos (8 HTML5) + Wikipedia (Kiwix)

### Fase 6: Desktop Environment
- [x] Area de trabalho com icones, janelas arrastaveis/redimensionaveis
- [x] Barra de tarefas, window manager, z-index, start menu
- [x] Window snapping, Alt+Tab, tile windows, cascade positioning

### Fase 7-8: Apps Nativos + Polish
- [x] Notepad, Word, Excel, Paint, File Manager, Terminal
- [x] Calculadora, Timer, Conversor, Checklist, Morse, Fonetico NATO
- [x] App Builder (gera apps com IA) + apps salvos em janelas
- [x] Boot screen, wallpapers, atalhos de teclado, context menu, toast notifications
- [x] Monitor de Sistema, Media Player, Tarefas

### Fase 9-10: Conteudo + Companion
- [x] 16 guias de sobrevivencia (~6500 linhas de conteudo)
- [x] 10 protocolos de emergencia (arvores de decisao interativas)
- [x] Companion 3D (Three.js + VRM, lip-sync, expressoes, gestos)
- [x] The Guide widget (6 personalidades: Deep Thought, TARS, MOTHER, HAL, Ford, Survivor)

### Fase 11: Modularizacao + UX
- [x] Refatoracao em ES Modules (main.js, chat.js, state.js, apps.js, etc.)
- [x] Spotlight / Command Palette (Ctrl+K)
- [x] 6 modos de IA: Geral, Medico, Sobrevivencia, Engenharia, Defesa, Psicologico

### Fase 12-13: Portabilidade + Uncensored
- [x] build_portable.py — pacote USB com Python embarcado + llama.cpp
- [x] Dual backend: Ollama (primario) / llama.cpp (fallback)
- [x] Dolphin3 uncensored como modelo padrao
- [x] Kokoro TTS (near-human) + cascade de 4 engines TTS
- [x] 5 modelos GGUF no registry

### Fase 14: Guide Companion
- [x] Widget persistente com 6 personalidades sci-fi
- [x] Quick-ask, quick actions, dicas proativas por modo
- [x] Moods animados (idle, thinking, happy, alert, sleeping)

### Fase 15: Apps de Sobrevivencia Especializados
- [x] Agua Segura — calculadora de purificacao (cloro, iodo, fervura, SODIS)
- [x] Farmacia — inventario de medicamentos + dosagens
- [x] Abrigo — guia interativo de construcao
- [x] Energia — geracao de energia + baterias
- [x] Navegacao — orientacao sem GPS (estrelas, sol, sombras, bussola)
- [x] Plantas — banco de dados de plantas comestiveis/medicinais
- [x] Racionamento — calculadora de racionamento alimentar
- [x] Crypto — ferramentas de criptografia/encoding
- [x] Primeiros Socorros — referencia rapida de emergencia

### Fase 16: RAG + Kiwix + Documentacao
- [x] RAG Engine — FTS5 + Ollama embeddings, auto-indexa guias/protocolos
- [x] RAG no chat — injeta contexto automaticamente nas respostas
- [x] Upload de documentos do usuario (.txt, .md, .csv)
- [x] Kiwix frontend completo (antes 70%, agora 100%)
- [x] Kiwix cross-platform (Linux + macOS + Windows)
- [x] Guide progress tracking (scroll tracking + marcar como lido)
- [x] CLAUDE.md — guia para AI agents
- [x] docs/ARCHITECTURE.md — mapa tecnico completo
- [x] docs/API.md — referencia de 80+ endpoints
- [x] README.md reescrito com badges + screenshots (8 capturas 2x DPI)
- [x] README.pt-BR.md — versao completa em portugues
- [x] .gitignore atualizado (tts_cache, generated_images, phase14-guide)
- [x] Fix compatibilidade Python 3.9 (str | None → Optional[str])

### Sessao Abril 2026 — UX + Bugfixes
- [x] Todos os 43 apps visiveis no desktop (antes so 14)
- [x] Nomes curtos para todos os icones do desktop
- [x] Tela "Wikipedia offline" com botao direto para Download Manager
- [x] URLs do catalogo ZIM corrigidas (2024 → 2026, novo formato maxi/nopic)
- [x] Onboarding: novo passo Wi-Fi (Step 3) — detecta conexao e oferece downloads
- [x] Onboarding: checkboxes com itens essenciais pre-selecionados (medicina, wikibooks, mapa)
- [x] Onboarding: barra de progresso SSE durante downloads

---

## Em Andamento: Fase 17 — Biblioteca de Conteudo Offline (~70% concluida)

**Objetivo:** Igualar e ultrapassar o NOMAD em volume de conteudo offline.

**Principio:** O NOMAD oferece terabytes de ZIMs pre-prontos. Nos vamos oferecer
um **download manager inteligente** que permite ao usuario escolher exatamente
o que precisa, sem desperdicar espaco.

### 17.1 — ZIM Download Manager (UI) ✅ Concluido
- [x] Painel "Conteudo Offline" no app com categorias
- [x] Catalogo de ZIMs: Wikipedia Medicina, Wikibooks, iFixit, Wikivoyage, Wikipedia Mini, Gutenberg
- [x] Estimativa de tamanho antes do download
- [x] Progresso de download com SSE
- [x] Listar ZIMs instalados com tamanho e opcao de remover
- [x] URLs atualizadas para versoes 2026 (corrige HTTP 404)
- [x] Atalho no onboarding — passo Wi-Fi oferece downloads na primeira vez
- [x] Atalho na tela de Wikipedia offline → abre Download Manager

### 17.2 — Catalogo de ZIMs Curado ✅ Concluido (parcial)
- [x] Wikipedia Medicina (2.1 GB) — diagnosticos, procedimentos, farmacologia
- [x] Wikibooks sem imagens (2.9 GB) — engenharia, agricultura, construcao
- [x] iFixit (3.3 GB) — manuais de reparo de eletronica e equipamentos
- [x] Wikivoyage (1.0 GB) — guias geograficos e culturais
- [x] Wikipedia Mini (12 GB) — enciclopedia completa resumida
- [x] Project Gutenberg (206 GB) — 70K+ livros de dominio publico
- [ ] Stack Overflow — programacao/engenharia (a adicionar)
- [ ] OpenStax — livros didaticos abertos (fisica, quimica, biologia)

### 17.3 — Indexacao RAG dos ZIMs ⏳ Pendente
- [ ] Indexar conteudo dos ZIMs no RAG (opcional, por ZIM)
- [ ] Quando o usuario perguntar algo, o RAG busca nos ZIMs tambem
- [ ] Combinar busca Kiwix nativa + RAG semantico
- [ ] Busca unificada que busca em TODOS os ZIMs instalados

**Esforco restante:** Baixo (17.3) | **Impacto:** Alto | **Vantagem vs NOMAD:** Download seletivo ao inves de tudo-ou-nada

---

## Fase 18 — Routing e Navegacao nos Mapas

**Objetivo:** Calcular rotas A→B offline, igualando NOMAD em mapas.

### 18.1 — Routing Engine Offline
- [ ] Integrar OSRM (Open Source Routing Machine) em modo offline
- [ ] Pre-extrair dados de routing por regiao (junto com PMTiles)
- [ ] Ou: implementar A* simplificado sobre dados OSM extraidos
- [ ] Interface: clicar ponto A, clicar ponto B, ver rota no mapa

### 18.2 — Mapa Melhorado
- [ ] Geocoding offline (buscar por nome de cidade/rua)
- [ ] POI search (buscar hospitais, agua, abrigos no mapa)
- [ ] Perfil de elevacao da rota
- [ ] Estimativa de tempo a pe / veiculo
- [ ] Exportar rota como lista de instrucoes

### 18.3 — Manter Diferenciais Unicos
- [ ] Manter app de navegacao por estrelas/sol (diferencial que NOMAD nao tem)
- [ ] Integrar bussola do dispositivo (DeviceOrientation API)
- [ ] Modo "trilha" — gravar percurso GPS e salvar como track

**Esforco:** Alto | **Impacto:** Medio | **Vantagem vs NOMAD:** Nosso mapa ja tem marcadores de sobrevivencia + nav por estrelas

---

## Fase 19 — Docker + Self-Hosting

**Objetivo:** Abrir para publico de homelab/self-hosters.

### 19.1 — Dockerfile + docker-compose.yml
- [ ] Dockerfile multi-stage (build + runtime)
- [ ] docker-compose.yml com Ollama como servico separado
- [ ] Volume mounts para data/, models/, static/maps/
- [ ] Variavel OLLAMA_URL para apontar para Ollama externo
- [ ] Health check no compose

### 19.2 — Deploy Guides
- [ ] One-liner de instalacao: `curl -fsSL ... | bash`
- [ ] Guia para Raspberry Pi 5 (sem GPU, modelo CPU)
- [ ] Guia para Synology/QNAP NAS
- [ ] Guia para servidor com GPU (melhor experiencia)

### 19.3 — Manter Simplicidade
- [ ] Docker e OPCIONAL — start.sh continua sendo o padrao
- [ ] Nao adicionar dependencia de Docker para nada
- [ ] O monolito server.py + static/ continua funcionando sozinho

**Esforco:** Medio | **Impacto:** Medio | **Vantagem vs NOMAD:** Nos temos AMBOS — nativo E Docker

---

## Fase 20 — Internacionalizacao + Visibilidade

**Objetivo:** Colocar o Bunker AI no mapa mundial.

### 20.1 — README Bilingue
- [x] README.md reescrito com tagline, badges, screenshots, instalacao
- [x] README.pt-BR.md — versao completa em portugues
- [x] Badges: Python, License, Offline, LLM, Last Commit, Stars
- [x] Screenshots: 8 capturas de tela 2x DPI no README
- [ ] GIF/video demo no README (boot → chat → voz → mapa → guia) ← proximo impacto alto
- [ ] Publicar no GitHub Pages uma landing page

### 20.2 — Lancamento
- [ ] Post no r/selfhosted (maior publico de offline-first)
- [ ] Post no r/LocalLLaMA (comunidade de LLMs locais)
- [ ] Post no r/preppers (publico-alvo direto)
- [ ] Post no Hacker News (Show HN)
- [ ] Post no DEV.to com artigo tecnico
- [ ] Video demo no YouTube (~3 min)

### 20.3 — i18n (internacionalizacao)
- [ ] Extrair strings de UI para arquivo de traducao (json)
- [ ] Suporte a ingles como idioma alternativo
- [ ] Guias traduzidos para ingles (pode ser feito pelo proprio LLM)
- [ ] Auto-detectar idioma do browser

**Esforco:** Medio | **Impacto:** Altissimo | **Meta:** Ultrapassar NOMAD em stars

---

## Fase 21 — IA Avancada

**Objetivo:** Features de IA que ninguem mais tem.

### 21.1 — RAG Avancado
- [ ] Indexar PDFs (PyMuPDF ou pdfplumber, sem OCR)
- [ ] Indexar conteudo dos ZIMs no pipeline RAG
- [ ] Multi-query RAG: reformular pergunta em 3 variantes e buscar todas
- [ ] Citacoes com link direto para o trecho fonte
- [ ] Painel "Base de Conhecimento" para visualizar o que esta indexado

### 21.2 — Agentes Autonomos
- [ ] Agente "Diagnostico" — faz perguntas iterativas para chegar ao diagnostico
- [ ] Agente "Planejador" — cria planos de acao multi-passo para situacoes
- [ ] Agente "Instrutor" — ensina habilidades passo a passo com verificacao
- [ ] Tool use: agentes podem consultar RAG, suprimentos, clima, mapa

### 21.3 — Whisper.cpp WASM
- [ ] STT 100% no browser (sem backend Python)
- [ ] Modelo tiny/base para comandos de voz
- [ ] Elimina dependencia de faster-whisper
- [ ] Funciona ate em PCs fracos

### 21.4 — Modo Pokedex
- [ ] Apontar camera → identificar planta/animal/objeto
- [ ] Usar modelo vision (Gemma3) para analise
- [ ] Cross-reference com banco de plantas e guias
- [ ] Mostrar: comestivel? medicinal? perigoso? como usar?

**Esforco:** Alto | **Impacto:** Enorme | **Vantagem vs NOMAD:** NOMAD nunca tera isso

---

## Fase 22 — Polish e Experiencia

**Objetivo:** Deixar tudo impecavel.

### 22.1 — Visual
- [ ] Temas adicionais (light mode, amber terminal, green phosphor)
- [ ] Animacoes ARWES (sci-fi holografico) como opcao
- [ ] Icones customizados para cada app (SVG, nao emoji)
- [ ] Splash screen personalizada por personalidade do Guide

### 22.2 — Onboarding
- [x] Wizard de primeiro uso — 5 passos: idioma, modelo, status, Wi-Fi downloads, pronto
- [x] Passo Wi-Fi: detecta conexao, oferece ZIMs + mapas com progresso SSE
- [ ] Tour guiado pelo sistema (highlight cada area)
- [ ] Sugestoes contextuais ("Voce ainda nao leu o guia de Agua")
- [ ] Achievement system (badges por guias lidos, dias de diario, etc.)

### 22.3 — Performance
- [ ] Lazy loading de apps (nao carregar todos os 14K de apps.js de uma vez)
- [ ] Service Worker para cache offline real (PWA)
- [ ] Compressao de embeddings (quantizar para int8)
- [ ] Paginacao na busca RAG para grandes bases

### 22.4 — Multi-usuario (futuro distante)
- [ ] Perfis de usuario com senha
- [ ] Cada usuario tem seus chats, notas, suprimentos
- [ ] Admin pode gerenciar modelos e conteudo
- [ ] Util para bunker/abrigo comunitario

---

## Resumo Estrategico

### O que esta feito (Fases 1–17 parcial)

| Area             | Progresso       | Notas |
|------------------|-----------------|-------|
| IA / RAG         | ██████████ 90%  | RAG, voz, visao, 6 modos, companion 3D |
| Apps / Desktop   | ██████████ 95%  | 43 apps, todos visiveis, window manager |
| Conteudo Offline | ███████░░░ 70%  | ZIMs OK, RAG dos ZIMs pendente |
| Mapas            | ██████░░░░ 60%  | PMTiles OK, routing/geocoding pendente |
| Onboarding / UX  | ████████░░ 80%  | Wizard 5 passos, Wi-Fi step, tour pendente |
| Documentacao     | █████████░ 90%  | README, CLAUDE.md, API.md, badges, prints |
| Deploy / Docker  | ██░░░░░░░░ 20%  | Apenas start.sh, Docker pendente |
| Visibilidade     | ███░░░░░░░ 30%  | README pronto, lancamento pendente |
| IA Avancada      | █████░░░░░ 50%  | RAG basico OK, agentes/Pokedex pendente |

### Proximo passo recomendado (maior ROI)

1. **Video demo** (Fase 20.1) — 3 min mostrando boot→chat→voz→mapa = viral potential
2. **Lancamento Reddit** (Fase 20.2) — r/selfhosted + r/LocalLLaMA + r/preppers
3. **RAG dos ZIMs** (Fase 17.3) — diferencial impossivel de replicar no NOMAD

```
                    Abril/26  Fase 18   Fase 19   Fase 20   Fase 21
IA / RAG            █████████ █████████ █████████ █████████ ████████████
Conteudo Offline    ███████   █████████ █████████ █████████ ██████████
Mapas               ██████    █████████ █████████ █████████ ██████████
Deploy              ██        ██        █████████ █████████ ██████████
Visibilidade        ███       ███       ███       █████████ ██████████
IA Avancada         █████     █████     █████     █████     ████████████

NOMAD (referencia)  ██████    ██████    ██████    ██████    ██████
```

**Fase 20 (lancamento)** e o maior alavanca agora — o produto ja esta pronto.
**Fase 21 (Pokedex + agentes)** abre vantagem impossivel de alcançar.

---

## Principios Inegociaveis

1. **100% offline** — tudo funciona sem internet apos setup inicial
2. **Zero telemetria** — nenhum dado sai da maquina
3. **Monolito portatil** — server.py + static/ = copia pra USB e roda
4. **Sem build step** — nada de webpack, npm, compilacao
5. **Uncensored por padrao** — censura pode custar vidas em emergencia
6. **SQLite unico** — sem Redis, Postgres, ou bancos extras
7. **Vanilla JS** — sem React, Vue, ou frameworks que exigem build

> DON'T PANIC — Bunker AI
