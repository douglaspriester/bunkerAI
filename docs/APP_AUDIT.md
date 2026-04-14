# Bunker AI — Auditoria de Apps

> Gerado em Abril 2026. 43 apps no desktop, 47 no total (4 são hidden/sub-telas).

Legenda: ✅ Funcionando | ⚠️ Parcial | ❌ Quebrado / Não implementado

---

## 🤖 IA & Chat

| App | Função | Status | Observação |
|-----|--------|--------|------------|
| **AI Chat** | Chat com LLM local, 6 modos (Geral, Médico, Sobrevivência, Engenharia, Defesa, Psicológico), RAG automático, streaming SSE | ✅ | Core do sistema |
| **Companheiro** | Avatar 3D (Three.js + VRM), lip-sync, expressões, gestos, animações idle/think/happy | ✅ | Requer WebGL. Fallback geométrico se sem GPU |
| **Personagens** | Gerenciar personalidades do Guide Companion (Deep Thought, TARS, MOTHER, HAL, Ford, Survivor) | ✅ | |
| **Texto p/ Voz** | TTS com 4 engines em cascata: Kokoro → Piper → pyttsx3 → edge-tts | ✅ | edge-tts requer internet |
| **Gerador IA** | Geração de imagens via modelo local (Stable Diffusion / Ollama vision) | ⚠️ | Requer modelo de imagem instalado |
| **Modelos** | Gerenciador de modelos Ollama: listar, baixar, remover, trocar modelo ativo | ✅ | |
| **App Builder** | Gera mini-apps HTML com IA a partir de descrição em texto natural | ✅ | |

---

## 📚 Conhecimento

| App | Função | Status | Observação |
|-----|--------|--------|------------|
| **Guias** | 16 guias de sobrevivência em Markdown com progresso, scroll tracking, leitura estimada | ✅ | |
| **Protocolos** | 10 protocolos de emergência como árvores de decisão interativas | ✅ | |
| **Wikipedia** | Browser embutido para arquivos ZIM via Kiwix (offline) | ✅ | Requer ZIM instalado + kiwix-serve rodando |
| **Livros** | Leitor de EPUB (epub.js) com tema escuro, progresso, busca | ✅ | Requer .epub em data/books/ |
| **Referência** | Referência rápida de sobrevivência: nós, knots, sinais, códigos, medidas | ✅ | |
| **Downloads** | Download Manager de conteúdo offline: ZIMs (Wikipedia, Wikibooks, iFixit…), mapas | ✅ | URLs atualizadas Abr/2026 |

---

## 🏥 Sobrevivência — Saúde

| App | Função | Status | Observação |
|-----|--------|--------|------------|
| **Primeiros Socorros** | Referência rápida: RCP, hemorragia, queimaduras, fraturas, envenenamento, choque | ✅ | |
| **Farmácia** | Inventário de medicamentos + dosagens + interações + banco de remédios offline | ✅ | |
| **Água Segura** | Calculadora de purificação: cloro, iodo, fervura, SODIS. Volumes e tempo de contato | ✅ | |

---

## 🏕️ Sobrevivência — Campo

| App | Função | Status | Observação |
|-----|--------|--------|------------|
| **Mapas** | Mapa offline (Leaflet + PMTiles), marcadores de sobrevivência, layers, busca | ✅ | Requer arquivo .pmtiles em static/maps/ |
| **Plantas** | Banco de dados de plantas: comestíveis, medicinais, tóxicas, com fotos e uso | ✅ | |
| **Abrigos** | Guia interativo de construção de abrigos por tipo e condição climática | ✅ | |
| **Energia** | Geração de energia off-grid: solar, eólica, biomassa, baterias, cálculos | ✅ | |
| **Navegação** | Orientação sem GPS: estrelas, sol, sombras, bússola, relógio, pontos cardeais | ✅ | |
| **Rações** | Calculadora de racionamento: calorias por pessoa, dias de suprimento, déficit | ✅ | |
| **Suprimentos** | Inventário de suprimentos com validade, categoria, alerta de estoque baixo | ✅ | |

---

## 📡 Comunicação & Ferramentas de Campo

| App | Função | Status | Observação |
|-----|--------|--------|------------|
| **Rádio** | Referência de frequências de emergência por região (Brasil, EUA, Internacional) | ⚠️ | View existe, conteúdo OK, mas **não está no openMap** (não abre pelo desktop) |
| **Código Morse** | Encoder/decoder Morse + tabela + prática com áudio | ✅ | |
| **Fonético NATO** | Alfabeto fonético NATO com pronúncia + exercício de memorização | ✅ | |
| **Sol / Lua** | Calculadora de nascer/pôr do sol, horário dourado, fases da lua por localização | ✅ | |
| **Criptografia** | Ferramentas de encoding/criptografia: Base64, Hex, Caesar, XOR, hashes | ✅ | |
| **Clima** | Estação meteorológica: sensor local via API do servidor, histórico, previsão | ✅ | Requer sensor ou API meteorológica configurada |

---

## 📋 Produtividade

| App | Função | Status | Observação |
|-----|--------|--------|------------|
| **Diário** | Diário de sobrevivência com humor, data, categorias, busca, exportação | ✅ | |
| **Tarefas** | Gerenciador de tarefas com prioridade, status, data, categoria | ✅ | |
| **Bloco de Notas** | Editor de texto simples com múltiplas notas, salvo no SQLite | ✅ | |
| **Documento** | Editor de texto rico (Word-like): títulos, listas, negrito, itálico, exportar | ✅ | |
| **Planilha** | Planilhas com fórmulas básicas, múltiplas abas, exportar CSV | ✅ | |
| **Checklists** | Checklists reutilizáveis por categoria (go-bag, abrigo, médico, etc.) | ✅ | |
| **Paint** | Editor de imagem canvas: pincel, formas, cores, texto, exportar PNG | ✅ | |

---

## 🔧 Ferramentas do Sistema

| App | Função | Status | Observação |
|-----|--------|--------|------------|
| **Calculadora** | Calculadora científica com histórico | ✅ | |
| **Timer** | Timer + cronômetro + alarme sonoro | ✅ | |
| **Conversor** | Conversor de unidades: peso, distância, temperatura, volume, área, pressão | ✅ | |
| **Arquivos** | Gerenciador de arquivos do projeto (sandboxed em FILEMGR_ROOT) | ✅ | |
| **Mídia** | Player de áudio/vídeo para arquivos locais | ✅ | |
| **Monitor** | Monitor de sistema: CPU, RAM, disco, backend IA, modelos carregados | ✅ | |

---

## 🎮 Entretenimento

| App | Função | Status | Observação |
|-----|--------|--------|------------|
| **Jogos** | 8 jogos HTML5 embutidos + emulador RetroArch (GB, GBA, NES) com ROMs incluídas | ✅ | |

---

## ⚙️ Sistema

| App | Função | Status | Observação |
|-----|--------|--------|------------|
| **Preparar Pendrive** | Assistente para criar pendrive de sobrevivência bootável com o Bunker AI | ✅ | |
| **Configurações** | Tema, wallpaper, modelo IA, voz, personalidade, layout | ✅ | |

---

## 🔴 Problemas Identificados

| Problema | Impacto | Correção |
|----------|---------|----------|
| **Rádio** não está no `openMap` em main.js | Médio — app não abre pelo desktop/start menu | Adicionar `radio: () => window.radioInit?.()` no openMap e criar função init em apps.js |
| **ZIM URLs** estavam com 404 (2024 → 2026) | Alto — downloads falhavam | ✅ Corrigido em Abr/2026 |
| **Gerador IA** requer modelo de imagem | Baixo — maioria não tem | Melhorar mensagem de erro quando modelo não disponível |
| **Clima** requer sensor/API | Baixo — fallback já existe | OK por enquanto |

---

## 📊 Resumo

| Categoria | Total | ✅ OK | ⚠️ Parcial | ❌ Quebrado |
|-----------|-------|-------|-----------|------------|
| IA & Chat | 7 | 6 | 1 | 0 |
| Conhecimento | 6 | 6 | 0 | 0 |
| Saúde | 3 | 3 | 0 | 0 |
| Campo | 7 | 7 | 0 | 0 |
| Comunicação | 6 | 5 | 1 | 0 |
| Produtividade | 7 | 7 | 0 | 0 |
| Sistema/Tools | 6 | 6 | 0 | 0 |
| Entretenimento | 1 | 1 | 0 | 0 |
| Sistema | 2 | 2 | 0 | 0 |
| **TOTAL** | **45** | **43** | **2** | **0** |

**43/45 funcionando (96%).** Os 2 parciais são o Rádio (não abre pelo desktop) e o Gerador IA (depende de modelo extra).
