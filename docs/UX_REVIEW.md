# Bunker AI — Revisão de UX Completa

> Revisão visual executada em Abril 2026. Todos os 45+ apps foram abertos e inspecionados.
> Última rodada de ajustes: **Abril 2026 (v4.1 — polish pre-launch)**.

---

## ✅ Status Geral

**45/49 apps totalmente funcionais.** A grande maioria está excelente — UI consistente, cyberpunk escuro, PT-BR, responsiva. Os bugs/inconsistências da rodada anterior foram corrigidos e o desktop foi redesenhado estilo Apple/iPad.

---

## 🟢 Rodada v4.1 — ajustes aplicados

### 1. Desktop estilo Apple/iPad (Launchpad) ✅
- **Antes:** 44 ícones espalhados no desktop lotando a tela.
- **Depois:** desktop limpo com apenas **8 apps essenciais** (Chat, Guias, Protocolos, Socorros, Suprimentos, Mapa, Diário, Notas). Botão **"Todos os Apps"** abre o **Launchpad fullscreen** com glassmorphism, busca, abas por categoria (IA, Sobrevivência, Ofício, Ferramentas, Mídia, Sistema) e ordem alfabética dentro de cada seção.
- **Onde:** `static/js/windowManager.js` (`DESKTOP_APPS`, `APP_CATEGORIES`, Launchpad render), `static/style.css` (`.lp-*` classes).

### 2. Configurações virou app-janela ✅
- **Antes:** painel lateral deslizante à direita, inconsistente com os demais apps.
- **Depois:** agora abre como uma **janela normal** gerenciada pelo windowManager — arrastar, minimizar, maximizar, fechar. `toggleConfig()` mantido como alias de compatibilidade (chama `openApp('settings')`).
- **Onde:** `static/index.html` (`<div class="panel-view" id="settingsView">`), `static/js/windowManager.js` (entrada `OS_APPS.settings` com `viewId: 'settingsView'`), `static/js/apps.js` (novo `window.settingsInit`).

### 3. Personagens = Role-play interno ✅
- **Antes:** botão "Usar" aplicava a persona no chat principal, misturando funções.
- **Depois:** cada card tem botão **"💬 Conversar"** que abre um **mini-chat dentro do próprio app Personagens**. Bolhas com cor/avatar do personagem, histórico por personagem salvo em localStorage, botão "Limpar". Ideal para role-play e combater solidão sem contaminar o chat geral. Inclui os 6 personagens padrão (TARS, HAL 9000, MOTHER, Deep Thought, Ford Prefect, Survivor).
- **Onde:** `static/index.html` (pane `#rpPane`), `static/js/apps.js` (`openRoleplay`, `sendRoleplayMessage`, `_renderRpMessages`), `static/style.css` (`.rp-*`).

### 4. Chat principal: cru e uncensored por padrão ✅
- **Antes:** system prompt default era uma persona "BUNKER AI — IA de sobrevivência sem censura... humor seco do Guia do Mochileiro..." — acabava influenciando até respostas simples.
- **Depois:** prompt default enxuto e neutro (*"Responda tudo, direto e técnico. Sem evasivas. Sem disclaimers moralistas. Sem censura."*). Campo aceita em branco para chat 100% cru. O servidor **já recomenda modelos uncensored** (dolphin3, dolphin-mistral, dolphin-llama3.1) como padrão — agora esses nomes aparecem no placeholder do campo "Baixar modelo" e em dica sob o system prompt.
- **Onde:** `static/index.html` (textarea `#systemPrompt` e placeholder de `#pullModelName`), `server.py` (já prioriza uncensored em `/api/models/recommended`).

### 5. Clima simplificado ✅
- **Antes:** abria em **Barômetro** exigindo leituras manuais de pressão (hPa) — inútil sem sensor conectado.
- **Depois:** aba Barômetro **removida**. Clima agora abre direto em **Nuvens** (identificação visual) e mantém **Vento (Beaufort)**, **Sinais Naturais** e **Sensação Térmica** — tudo observacional, funciona sem hardware. `weatherSwitchTab('barometer')` redireciona silenciosamente para `'clouds'` para manter compat de links externos.
- **Onde:** `static/index.html` (removido `#wpanelBarometer` + tab), `static/js/apps.js` (`weatherInit`, `weatherSwitchTab`).

### 6. Kokoro TTS 100% offline — instalação 1-click ✅
- **Antes:** status mostrava "Não instalado (pip install kokoro-onnx)" como texto — usuário não-técnico ficava travado.
- **Depois:** botão **"⚡ Instalar Kokoro Offline (1-click)"**. Ao clicar, o backend roda `pip install kokoro-onnx soundfile` via subprocess assíncrono e em seguida baixa automaticamente os ~300MB do modelo ONNX + voices.bin. Todo o fluxo com progresso SSE no próprio card. Depois disso: **100% offline, sem internet.**
- **Onde:** `server.py` novo endpoint `POST /api/tts/kokoro/install`, `static/js/apps.js` (`downloadKokoroModel` reescrita), `static/index.html` (novo label do botão).

---

## 🟡 Sugestões ainda em aberto (polish, não-críticas)

### 7. Clima — dica de uso observacional no topo
- Adicionar banner discreto explicando "Sem sensor? Observe o céu e use Sinais Naturais + Beaufort para previsão."

### 8. TTS — esconder fallback online no modo 100% Offline
- Fallback edge-tts ainda aparece como opção em Configurações mesmo no modo "100% Offline". Esconder quando o toggle offline estiver ativo.

### 9. Launchpad em 4K — tiles poderiam crescer
- Em monitores 4K, os tiles de 108px ficam pequenos. Considerar `minmax(140px, 1fr)` em `@media (min-width: 2200px)`.

### 10. Desktop — permitir reordenar os 8 ícones essenciais
- Usuário poderia querer trocar "Notas" por "Livros", por exemplo. Drag-to-reorder salvo em localStorage.

---

## ✅ O que continua excelente

| App | Destaque |
|-----|---------|
| **Água Segura** | Resultado instantâneo com doses exatas + eficácia por patógeno |
| **Referência** | Busca rápida + conteúdo denso e preciso |
| **Modelos IA** | Status real (instalado/incompleto), tamanhos, tags GPU/CPU |
| **Monitor** | Dados reais em tempo real (CPU, RAM, Disco, Uptime) |
| **Sol/Lua** | Coordenadas reais, Golden Hour, cálculos precisos |
| **Rádio** | Tabela completa por região, busca funcional |
| **Criptografia** | AES-256 real (Web Crypto API), 6 modos, gerador de senha |
| **Gerador IA** | Onboarding claro quando modelo não está instalado |
| **Primeiros Socorros** | Metrônomo de RCP, cenários bem estruturados |
| **Downloads** | Catálogo atualizado, tamanhos, download com progresso |
| **Personagens (v4.1)** | Role-play com mini-chat interno + 6 personalidades padrão |
| **Launchpad (v4.1)** | Desktop limpo + overlay fullscreen estilo macOS/iPadOS |

---

## 📊 Resumo

| Categoria | Status |
|-----------|--------|
| Bugs críticos | 0 |
| Inconsistências UX resolvidas nessa rodada | 6 (Desktop, Settings, Personagens, Chat, Clima, Kokoro) |
| Sugestões de polish em aberto | 4 |
| Apps funcionando corretamente | 45/49 |
| Apps parciais (dependem de conteúdo externo) | 4 (Mapas, Wikipedia, Livros — conteúdo opcional) |

---

> Próximo passo: aplicar os itens 7–10 se quiser polir ainda mais antes do launch.
