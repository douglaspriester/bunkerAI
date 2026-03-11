# Bunker AI — DON'T PANIC

> "A resposta para a vida, o universo e tudo mais é 42.
> Mas primeiro, certifique-se de que você sabe onde está sua toalha."

App de IA 100% local para o fim do mundo. Inspirado no Guia do Mochileiro das Galáxias,
TARS (Interstellar), Mother (Alien) e Deep Thought.

## O que faz

Tudo num chat unificado:

- **Texto** — Chat direto com LLM local via Ollama
- **Voz** — Segure o mic, fale, o LLM responde em áudio (STT + TTS)
- **Vídeo** — Webcam ao vivo, o LLM analisa o que vê (modelos multimodais)
- **Imagem** — Arraste ou anexe fotos para análise
- **Cérebro** — Modo `/brain` com Dolphin3 sem filtros/censura para informação bruta
- **App Builder** — Digite `/build` + descrição = app completo gerado ao vivo
- **Mapa Offline** — Leaflet com GPS, marcadores e medição de distância
- **Guias de Sobrevivência** — 6 guias ilustrados (abrigo, fogo, água, urbano, primeiros socorros, navegação)
- **100% offline** — Sem internet, sem cloud, sem tracking

## Início Rápido

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
1. Verifica se Python e Ollama estão instalados
2. Tenta iniciar o Ollama se não estiver rodando
3. **Baixa os 4 modelos necessários** (só no primeiro uso)
4. Cria ambiente virtual Python e instala dependências
5. Inicia o servidor em http://localhost:8888

### Pré-requisitos

| Software | Download | Obrigatório |
|----------|----------|-------------|
| Python 3.10+ | https://python.org | Sim |
| Ollama | https://ollama.ai | Sim |
| GPU NVIDIA 8GB+ | — | Recomendado |

## Modelos (RTX 3060 12GB)

O `start.bat` / `start.sh` baixa automaticamente:

| Uso | Modelo | Tamanho | Por quê |
|-----|--------|---------|---------|
| Chat geral + Visão | `gemma3:12b` | ~8 GB | Multimodal nativo, melhor custo/benefício |
| App Builder (código) | `qwen2.5-coder:14b` | ~9 GB | Melhor modelo de código para 12GB VRAM |
| Chat rápido | `phi4` | ~9 GB | Ultra rápido para iteração |
| Cérebro (sem filtros) | `dolphin3` | ~5 GB | Sem censura, sem guardrails, informação bruta |

> Os modelos são baixados uma vez e ficam no cache do Ollama (~31GB total).
> Você pode baixar modelos adicionais pelo painel de configurações do app.

## Mapa Offline

O mapa funciona em dois modos:

### Online (padrão)
Usa tiles do CartoDB Dark Matter via internet. Funciona imediatamente.

### 100% Offline com PMTiles
Para mapa sem internet, coloque um arquivo `.pmtiles` na pasta `static/maps/`:

```bash
# 1. Instale o CLI do PMTiles
npm install -g pmtiles
# ou: go install github.com/protomaps/go-pmtiles/cmd/pmtiles@latest

# 2. Extraia o mapa do Brasil (bbox completo, ~300MB com zoom 12)
pmtiles extract \
  https://build.protomaps.com/20250101.pmtiles \
  static/maps/brasil.pmtiles \
  --bbox=-74,-34,-35,5 \
  --maxzoom=12

# Ou uma região menor (ex: São Paulo, ~30MB)
pmtiles extract \
  https://build.protomaps.com/20250101.pmtiles \
  static/maps/sp.pmtiles \
  --bbox=-47.5,-24.2,-45.5,-23.0 \
  --maxzoom=14
```

O app detecta automaticamente o `.pmtiles` e muda para modo offline.
O status aparece no painel de configurações e na barra de informação do mapa.

### Funcionalidades do Mapa
- **GPS** — Geolocalização automática (precisa de HTTPS ou localhost)
- **Marcadores** — Adicione pontos com nome, persistidos localmente
- **Medição** — Calcule distâncias entre pontos (Haversine)
- **Coordenadas** — Exibe lat/lng ao mover o mouse

## Como usar

| Ação | Como |
|------|------|
| Chat normal | Digita e envia |
| Voz | Segura o botão do mic |
| Webcam | Clica no ícone de vídeo, depois digita pergunta |
| Anexar foto | Arrasta ou clica no ícone de imagem |
| Criar app | `/build descrição do app` |
| Modo cérebro | `/brain sua pergunta` |
| Mapa | Menu lateral → "Mapa Offline" |
| Guias | Menu lateral → seção "Guias" |
| Baixar modelo | Configurações → campo "Baixar Modelo" |
| Favoritar | Botão de estrela nas mensagens ou guias |

## Estrutura do Projeto

```
bunker-ai/
├── server.py          # Backend FastAPI (chat, vision, TTS, builder, maps)
├── requirements.txt   # Dependências Python
├── start.bat          # Inicializador Windows (pull automático)
├── start.sh           # Inicializador Linux/Mac (pull automático)
├── README.md
└── static/
    ├── index.html     # Frontend principal
    ├── style.css      # Estilos (tema dark cyberpunk)
    ├── app.js         # Lógica do app (~1700 linhas)
    ├── img/           # Ilustrações dos guias
    │   ├── guide-shelter.jpg
    │   ├── guide-fire.jpg
    │   ├── guide-water.jpg
    │   ├── guide-urban.jpg
    │   ├── guide-firstaid.jpg
    │   └── guide-navigation.jpg
    └── maps/          # Coloque seus .pmtiles aqui
        └── (brasil.pmtiles)
```

## Referências & Inspiração

### Sci-Fi
- **Guia do Mochileiro das Galáxias** (Douglas Adams) — DON'T PANIC, 42, Deep Thought
- **Interstellar** — TARS e seu nível de humor ajustável
- **Alien** — Mother, o computador da Nostromo
- **2001** — HAL 9000 ("I can do that, Dave")
- **Neuromancer** (William Gibson) — cyberpunk, IA local
- **Snow Crash** (Neal Stephenson) — metaverso e hackers
- **The Road** (Cormac McCarthy) — sobrevivência pós-apocalíptica
- **Station Eleven** (Emily St. John Mandel) — civilização depois do colapso
- **Wool/Silo** (Hugh Howey) — vida em bunkers subterrâneos
- **Metro 2033** (Dmitry Glukhovsky) — sobrevivência no metrô

### Livros de Sobrevivência
- **SAS Survival Handbook** (John Wiseman) — o clássico absoluto
- **Bushcraft 101** (Dave Canterbury) — habilidades práticas
- **Deep Survival** (Laurence Gonzales) — psicologia de sobrevivência
- **When All Hell Breaks Loose** (Cody Lundin) — improvisação com itens do dia-a-dia
- **98.6 Degrees** (Cody Lundin) — fundamentos de manter-se vivo
- **How to Invent Everything** (Ryan North) — reconstruir a civilização do zero
- **Nuclear War Survival Skills** — o nome diz tudo
- **The Encyclopedia of Country Living** (Carla Emery) — autossuficiência

## Stack

- **Backend:** FastAPI + httpx (proxy Ollama) + Range Requests (PMTiles)
- **Frontend:** HTML/CSS/JS vanilla (zero frameworks)
- **LLM:** Ollama (qualquer modelo GGUF)
- **Mapa:** Leaflet 1.9.4 + Protomaps/PMTiles (offline)
- **STT:** faster-whisper (offline, GPU) → Web Speech API (fallback)
- **TTS:** Piper TTS (offline) → edge-tts (online fallback)
- **Persistência:** localStorage (histórico, favoritos, marcadores)

## Troubleshooting

| Problema | Solução |
|----------|---------|
| "Ollama offline" | Rode `ollama serve` no terminal |
| Modelos não aparecem | Verifique com `ollama list` |
| Voz não funciona | Use Chrome (Web Speech API) |
| Mapa sem tiles | Sem internet? Coloque um .pmtiles em `static/maps/` |
| Erro ao iniciar | Verifique se Python 3.10+ está instalado |
| VRAM insuficiente | Use modelos menores: `gemma3:4b`, `phi4-mini` |

---

*DON'T PANIC — Bunker AI*
