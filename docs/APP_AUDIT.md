# Bunker AI — Auditoria de Apps

> Atualizado em Abril 2026. 47 apps registrados, 44 no desktop, 3 hidden/sub-telas.

Legenda: ✅ Funcionando | ⚠️ Parcial | ❌ Quebrado / Inacessível

---

## 🤖 IA & Chat (7 apps)

| App | Função | Status |
|-----|--------|--------|
| **AI Chat** | Chat com LLM local. 6 modos: Geral, Médico, Sobrevivência, Engenharia, Defesa, Psicológico. RAG automático, streaming SSE, anexar arquivos, webcam | ✅ |
| **Companheiro** | Avatar 3D (Three.js + VRM). Lip-sync, expressões, gestos, idle/think/happy. Fallback geométrico sem WebGL | ✅ |
| **Personagens** | Gerenciar personalidades do Guide Companion: Deep Thought, TARS, MOTHER, HAL 9000, Ford Prefect, Survivor | ✅ |
| **Texto p/ Voz** | TTS com 4 engines em cascata: Kokoro (near-human) → Piper → pyttsx3 → edge-tts. Seleção de voz e velocidade | ✅ |
| **Gerador IA** | Geração de imagens com modelo local. Histórico, enhancer, download | ⚠️ Requer modelo de imagem |
| **Modelos IA** | Gerenciador Ollama: listar, baixar, remover, trocar modelo ativo. Registry com 5 modelos recomendados | ✅ |
| **App Builder** | Gera mini-apps HTML completos via prompt de texto. Apps salvos e reaberráveis como janelas | ✅ |

---

## 📚 Conhecimento (6 apps)

| App | Função | Status |
|-----|--------|--------|
| **Guias** | 16 guias de sobrevivência em Markdown. Scroll tracking, progresso, tempo de leitura, favoritos | ✅ |
| **Protocolos** | 10 protocolos de emergência como árvores de decisão interativas. Navegação passo a passo | ✅ |
| **Wikipedia** | Browser embutido para arquivos ZIM via Kiwix. Busca interna, múltiplos ZIMs | ⚠️ Requer ZIM instalado |
| **Livros** | Leitor de EPUB (epub.js). Tema escuro, progresso de leitura, múltiplos livros | ⚠️ Requer .epub em data/books/ |
| **Referência** | Referência rápida de sobrevivência: nós, sinais de socorro, tabelas de medidas, códigos NATO, mapas de constelações | ✅ |
| **Downloads** | Download Manager: ZIMs (Wikipedia Medicina, Wikibooks, iFixit, Wikivoyage, Gutenberg), mapas PMTiles. Progresso SSE | ✅ |

---

## 🏥 Saúde (3 apps)

| App | Função | Status |
|-----|--------|--------|
| **Primeiros Socorros** | RCP com metrônomo, hemorragia, queimaduras, fraturas, choque, envenenamento, afogamento. Referência rápida por cenário | ✅ |
| **Farmácia** | Inventário de medicamentos + banco offline de remédios, dosagens, interações, contraindicações | ✅ |
| **Água Segura** | Calculadora de purificação: cloro, iodo, fervura, SODIS. Volumes, tempo de contato, dose por pessoa | ✅ |

---

## 🏕️ Campo & Sobrevivência (8 apps)

| App | Função | Status |
|-----|--------|--------|
| **Mapas** | Mapa offline (Leaflet + PMTiles). Marcadores de sobrevivência, layers, busca, download de regiões | ⚠️ Requer .pmtiles |
| **Plantas** | Banco de dados de plantas: comestíveis, medicinais, tóxicas. Filtros por tipo, região, uso | ✅ |
| **Abrigos** | Guia interativo de construção de abrigos por tipo (floresta, neve, deserto, urbano) e condição | ✅ |
| **Energia** | Off-grid: circuitos, baterias, solar, gerador, conservação, fogo. Calculadora solar | ✅ |
| **Navegação** | Orientação sem GPS: estrelas, bússola solar (sombras), distância a pé, leitura de mapas, relógio, cardeais pelo sol | ✅ |
| **Rações** | Calculadora de racionamento: calorias por pessoa, dias de suprimento, déficit, ajuste por atividade e clima | ✅ |
| **Suprimentos** | Inventário com validade, categoria, alerta de estoque baixo, exportar | ✅ |
| **Clima** | Estação meteorológica: barômetro, nuvens, vento, sinais naturais, previsão local | ⚠️ Requer sensor/API |

---

## 📡 Comunicação (5 apps)

| App | Função | Status |
|-----|--------|--------|
| **Rádio** | Referência de frequências de emergência por região: Brasil, EUA, Internacional. Busca e filtro por banda | ✅ |
| **Código Morse** | Encoder/decoder Morse, tabela completa, sinais de emergência, trainer com áudio | ✅ |
| **Fonético NATO** | Alfabeto fonético NATO com pronúncia, exercício de memorização interativo | ✅ |
| **Sol / Lua** | Nascer/pôr do sol, horário dourado, fases da lua, duração do dia. Por coordenadas ou cidade | ✅ |
| **Criptografia** | Base64, Hex, Caesar, ROT13, XOR, hashes MD5/SHA. Encode/decode + gerador de senhas | ✅ |

---

## 📋 Produtividade (7 apps)

| App | Função | Status |
|-----|--------|--------|
| **Diário** | Diário com humor, categorias, busca, gravação de áudio, exportação | ✅ |
| **Tarefas** | Gerenciador com prioridade (P1-P4), status, data, categoria, filtros | ✅ |
| **Bloco de Notas** | Múltiplas notas em SQLite, auto-save, busca | ✅ |
| **Documento** | Editor rich text (Word-like): títulos, listas, negrito, itálico, exportar | ✅ |
| **Planilha** | Grid 10×30 com fórmulas (SUM, AVG, MIN, MAX, IF), múltiplas abas, exportar CSV | ✅ |
| **Checklists** | Checklists reutilizáveis por categoria (go-bag, abrigo, médico, veículo). Auto-save | ✅ |
| **Paint** | Editor canvas: pincel, formas, borracha, texto, paleta, exportar PNG | ✅ |

---

## 🔧 Ferramentas (6 apps)

| App | Função | Status |
|-----|--------|--------|
| **Calculadora** | Científica com histórico de operações | ✅ |
| **Timer** | Timer regressivo + cronômetro + alarme sonoro | ✅ |
| **Conversor** | Peso, distância, temperatura, volume, área, pressão, combustível | ✅ |
| **Arquivos** | Gerenciador sandboxed: navegar, ler, abrir arquivos do projeto | ✅ |
| **Mídia** | Player de áudio/vídeo para arquivos locais (MP3, MP4, etc.) | ✅ |
| **Monitor** | CPU, RAM, disco, status do backend IA, modelo carregado, uptime | ✅ |

---

## 🎮 Entretenimento (1 app)

| App | Função | Status |
|-----|--------|--------|
| **Jogos** | 8 jogos HTML5 embutidos + emulador RetroArch (GB, GBA, NES) com ROMs incluídas | ✅ |

---

## ⚙️ Sistema (2 apps)

| App | Função | Status |
|-----|--------|--------|
| **Preparar Pendrive** | Assistente para criar pendrive de sobrevivência bootável. Estima espaço, prepara arquivos, valida | ✅ |
| **Configurações** | Tema, wallpaper, modelo IA, voz, personalidade, tamanho de fonte, modo offline | ✅ |

---

## 🔒 Apps Ocultos / Sub-telas (não no desktop)

| App | Como Acessar | Status |
|-----|-------------|--------|
| **Leitor de Livro** | Abre automaticamente ao clicar em um EPUB na Biblioteca | ✅ |
| **Jogo (Tela Cheia)** | Abre ao iniciar um jogo nos Jogos | ✅ |
| **Terminal** | Acessível via código (`openApp('terminal')`) — power user only, sandboxed | ✅ |
| **SOS Emergência** | Widget fixo no canto. Clique longo ativa modo fullscreen de emergência | ✅ |

---

## 🔴 Bugs Corrigidos Nesta Auditoria

| Bug | Correção |
|-----|----------|
| **Energia** não estava em OS_APPS — janela não abria | ✅ Adicionado ao OS_APPS, DESKTOP_APPS e categoria Sobrevivência |
| **Rádio** não estava no openMap — ícone não abria nada | ✅ Corrigido (radioInit registrado) |
| **ZIM URLs** 404 (formato 2024 → 2026) | ✅ Corrigido |

---

## 📊 Totais

| Categoria | Apps | ✅ | ⚠️ |
|-----------|------|----|----|
| IA & Chat | 7 | 6 | 1 |
| Conhecimento | 6 | 4 | 2 |
| Saúde | 3 | 3 | 0 |
| Campo | 8 | 7 | 1 |
| Comunicação | 5 | 5 | 0 |
| Produtividade | 7 | 7 | 0 |
| Ferramentas | 6 | 6 | 0 |
| Entretenimento | 1 | 1 | 0 |
| Sistema | 2 | 2 | 0 |
| Hidden | 4 | 4 | 0 |
| **TOTAL** | **49** | **45** | **4** |

**45/49 totalmente funcionais. Os 4 parciais dependem de conteúdo externo (modelo de imagem, ZIM, EPUB, sensor de clima) — não são bugs.**
