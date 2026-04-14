# Plano de Lançamento — Bunker AI

> Salvo em Abril 2026. Executar após auditoria de apps e polish final.

## Contexto

O produto está pronto (43 apps, RAG, voz, companheiro 3D, Wikipedia offline, mapas).
O gap atual é **visibilidade** — o NOMAD tem 11K+ stars, nós temos zero.

---

## Fase A — Video Demo (1–2 dias)

Video de ~3 min mostrando o sistema ao vivo. Roteiro:

1. Boot screen (5s) → desktop com todos os apps
2. Chat → pergunta de sobrevivência → resposta com RAG citando guia
3. Ativar voz → falar → sistema responder em áudio
4. Mapa offline → adicionar marcador
5. Guia de Primeiros Socorros + protocolo de emergência (arvore de decisão)
6. Companion 3D animado
7. Tela final: "100% offline. Zero cloud. Zero telemetria."

**Ferramentas:** OBS + Kdenlive ou CapCut. 1080p, legenda em inglês.

---

## Fase B — Textos dos Posts (meio dia)

Cada comunidade quer um ângulo diferente:

### r/selfhosted
- Foco: self-hosting, offline-first, nada sai da máquina
- Gancho: "I built an offline survival OS that runs on a USB stick"
- Mencionar: Docker em breve, start.sh já funciona

### r/LocalLLaMA
- Foco: Ollama + llama.cpp, Dolphin uncensored, RAG local, TTS Kokoro
- Gancho: "Bunker AI — local LLM with RAG, voice, vision and 43 offline apps"
- Mencionar: dual backend, 5 modelos no registry, sem censura

### r/preppers
- Foco: uso real em emergências, sem internet, 43 apps, Wikipedia offline
- Gancho: "What if you had an AI assistant that works when the grid goes down?"
- Mencionar: primeiros socorros, mapas, guias de sobrevivência, farmácia offline

### Hacker News (Show HN)
- Foco técnico: monolito portátil, FastAPI + Vanilla JS, USB-ready
- Formato: "Show HN: Bunker AI — offline survival OS with local LLM (FastAPI + Vanilla JS)"
- Mencionar: arquitetura, RAG FTS5, sem build step

### DEV.to
- Artigo: "Como construí um OS de sobrevivência offline com FastAPI + Ollama"
- ~1500 palavras, screenshots, código de exemplo
- Link para GitHub no final

**Ordem de publicação:** postar com 1–2 dias de intervalo, não tudo junto.

---

## Fase C — Pré-lançamento Técnico (1 dia, paralelo)

Dois ajustes que aumentam conversão antes de postar:

### 1. Dockerfile + docker-compose.yml
A primeira pergunta no r/selfhosted vai ser "tem Docker?". Estrutura:
```yaml
services:
  bunker:
    build: .
    ports: ["8888:8888"]
    volumes:
      - ./data:/app/data
      - ./models:/app/models
      - ./static/maps:/app/static/maps
  ollama:
    image: ollama/ollama
    volumes:
      - ollama_data:/root/.ollama
```

### 2. One-liner de instalação
```bash
curl -fsSL https://raw.githubusercontent.com/douglaspriester/bunkerAI/main/install.sh | bash
```
Coloca no README como primeiro passo — converte muito mais do que "clone e configure".

---

## Cronograma Sugerido

| Dia | Ação |
|-----|------|
| 1–2 | Gravar e editar video demo |
| 3   | Dockerfile + one-liner install |
| 4   | Postar r/selfhosted + r/LocalLLaMA |
| 5   | Postar r/preppers + Hacker News |
| 6   | Artigo DEV.to |
| 7+  | Responder comentários, coletar feedback, iterar |

---

## Métricas de Sucesso

| Métrica | Meta 30 dias |
|---------|-------------|
| GitHub Stars | 500+ |
| Forks | 50+ |
| Issues abertas | 20+ (sinal de adoção) |
| Reddit upvotes (melhor post) | 200+ |

---

> Próximo passo quando retornar a este plano: checar se Dockerfile foi feito, gravar o video.
