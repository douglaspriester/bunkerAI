<p align="center">
  <strong>BUNKER AI — DON'T PANIC</strong><br>
  <em>Sistema operacional de sobrevivencia com IA 100% local</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.10%2B-blue?logo=python&logoColor=white" alt="Python 3.10+">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="Licença MIT">
  <img src="https://img.shields.io/badge/offline-100%25-brightgreen" alt="100% Offline">
  <img src="https://img.shields.io/badge/LLM-Ollama%20%2F%20llama.cpp-orange" alt="Ollama / llama.cpp">
  <img src="https://img.shields.io/github/last-commit/douglaspriester/bunkerAI" alt="Último Commit">
  <img src="https://img.shields.io/github/stars/douglaspriester/bunkerAI?style=social" alt="GitHub Stars">
</p>

> "A resposta para a vida, o universo e tudo mais e 42.
> Mas primeiro, certifique-se de que voce sabe onde esta sua toalha."

Sistema operacional de sobrevivencia com IA 100% local. Desktop completo no browser
com LLM offline, voz, visao, mapas, guias, gerador de apps e muito mais.

Inspirado no Guia do Mochileiro das Galaxias, TARS (Interstellar), Mother (Alien) e Deep Thought.

**[English version](README.md)**

## Features

### IA Local
- **Chat** — Conversa com LLM local via Ollama (Gemma3, Phi4, Dolphin3)
- **Voz** — STT offline (Whisper) + TTS (Piper, Kokoro, pyttsx3, edge-tts)
- **Visao** — Webcam ao vivo + analise de imagens com modelos multimodais
- **Cerebro** — Modo `/brain` com Dolphin3 sem filtros para informacao bruta
- **RAG** — Base de conhecimento indexada: o chat consulta guias, protocolos e seus documentos automaticamente
- **App Builder** — `/build` + descricao = app completo gerado ao vivo
- **Geracao de Imagem** — Stable Diffusion local integrado

### Conhecimento Offline
- **16 Guias de Sobrevivencia** — Agua, fogo, abrigo, plantas medicinais, navegacao, radio, e mais
- **10 Protocolos de Emergencia** — Arvores de decisao interativas (RCP, hemorragia, queimaduras...)
- **Wikipedia Offline** — Kiwix integrado com busca (arquivos ZIM)
- **Biblioteca Offline** — Baixe ZIMs de Wikipedia, iFixit, Wikibooks, Stack Overflow e mais
- **Upload de Documentos** — Indexe seus proprios .txt/.md/.csv na base de conhecimento

### Apps do Sistema
- **Mapa Offline** — Leaflet + PMTiles + GPS + marcadores de sobrevivencia
- **Navegacao sem GPS** — Orientacao por estrelas, sombras, sol, bussola analogica
- **Inventario** — Controle de suprimentos por categoria com validade
- **Diario** — Log de sobrevivencia com categorias e contador de dias
- **Bloco de Notas / Word / Excel** — Editores integrados com auto-save
- **Tarefas** — Gerenciador com prioridade, categoria e status
- **Calculadora / Timer / Conversor** — Ferramentas utilitarias
- **Codigo Morse / Alfabeto Fonetico** — Comunicacao de emergencia
- **Agua Segura / Farmacia / Racionamento** — Calculadoras de sobrevivencia
- **Jogos** — 8 jogos HTML5 + emulador de ROMs (GB, GBA, NES)
- **Leitor de Livros** — EPUB reader com tracking de progresso
- **Terminal + Gerenciador de Arquivos** — Acesso ao sistema
- **Construtor de Pendrive** — Cria versao portatil em USB

### Desktop
- **Interface tipo OS** — Janelas arrastaveis, barra de tarefas, menu iniciar
- **Desktop estilo Apple/iPad** (v4.1) — 8 apps essenciais na tela + **Launchpad fullscreen** com busca e categorias para os demais
- **Configuracoes como janela** — arrastar, minimizar, maximizar (antes era drawer lateral)
- **Role-play com Personagens** — mini-chat isolado por personagem (TARS, HAL, MOTHER, Deep Thought, Ford Prefect, Survivor) com historico proprio
- **Kokoro TTS 100% offline** — instalacao 1-click (pip + modelo ONNX automaticos)
- **5 wallpapers** — Incluindo Starfield, Matrix e Aurora
- **Atalhos de teclado** — Ctrl+K (busca), Alt+Tab, F1 (atalhos), F2 (menu)
- **Boot screen** — Animacao de inicializacao estilo BIOS

## Inicio Rapido

### Windows
```bat
start.bat
```

### Linux / Mac
```bash
chmod +x start.sh
./start.sh
```

O script faz tudo automaticamente:
1. Verifica Python e Ollama
2. Cria ambiente virtual e instala dependencias
3. Baixa modelos, bibliotecas e conteudo offline
4. Inicia o servidor em http://localhost:8888

### Pre-requisitos

| Software | Download | Obrigatorio |
|----------|----------|-------------|
| Python 3.10+ | https://python.org | Sim |
| Ollama | https://ollama.ai | Sim |
| GPU NVIDIA 8GB+ | — | Recomendado |

## Modelos

| Uso | Modelo | Tamanho | Por que |
|-----|--------|---------|---------|
| Chat geral + Visao | `gemma3:12b` | ~8 GB | Multimodal nativo |
| App Builder (codigo) | `qwen2.5-coder:14b` | ~9 GB | Melhor modelo de codigo |
| Chat rapido | `phi4` | ~9 GB | Ultra rapido |
| Cerebro (sem filtros) | `dolphin3` | ~5 GB | Sem censura |
| Embeddings (RAG) | `nomic-embed-text` | ~274 MB | Busca semantica |

> Baixados automaticamente. Total ~31GB no cache do Ollama.

## Documentacao

- **[CLAUDE.md](CLAUDE.md)** — Guia para AI agents trabalharem no codigo
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Mapa completo da arquitetura
- **[docs/API.md](docs/API.md)** — Referencia de todos os endpoints da API
- **[ROADMAP.md](ROADMAP.md)** — Historico e proximos passos

## Troubleshooting

| Problema | Solucao |
|----------|---------|
| "Ollama offline" | Rode `ollama serve` no terminal |
| Modelos nao aparecem | `ollama list` para verificar |
| Voz nao funciona | Use Chrome (Web Speech API) |
| Mapa sem tiles | Coloque .pmtiles em `static/maps/` |
| VRAM insuficiente | Use modelos menores: `gemma3:4b`, `phi4-mini` |
| RAG sem embeddings | O modelo `nomic-embed-text` e baixado automaticamente |

---

*DON'T PANIC — Bunker AI*

---

## Licenca

MIT — veja [LICENSE](LICENSE).
