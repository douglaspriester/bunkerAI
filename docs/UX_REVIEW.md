# Bunker AI — Revisão de UX Completa

> Revisão visual executada em Abril 2026. Todos os 45+ apps foram abertos e inspecionados.

---

## ✅ Status Geral

**45/49 apps totalmente funcionais.** A grande maioria está excelente — UI consistente, cyberpunk escuro, PT-BR, responsiva. Os problemas abaixo são pontuais e corrigíveis.

---

## 🔴 Bugs / Inconsistências a Corrigir

### 1. Calculadora — não é científica
- **Problema:** O arquivo `APP_AUDIT.md` descreve como "Científica com histórico de operações", mas a UI mostra apenas uma calculadora básica (C, ±, %, ÷, ×, -, +, =). Sem funções trigonométricas, log, potência, etc. Sem histórico de operações visível.
- **Impacto:** Médio — engenheiros e técnicos esperam calculadora científica offline.
- **Correção:** Adicionar (a) histórico de operações como lista abaixo da calculadora, e (b) toggle "Científica" que expande botões sin/cos/tan/log/ln/^/√.

### 2. Personagens — abre vazio sem personagens padrão
- **Problema:** O app abre com "Nenhum personagem criado. Crie assistentes com personalidades únicas!" — mas os 6 personagens padrão (TARS, HAL 9000, MOTHER, Deep Thought, Ford Prefect, Survivor) já existem no sistema (`guide-companion.js`). Usuários não sabem que existem e não sabem como acessá-los.
- **Impacto:** Médio — oportunidade de showcasear um diferencial do produto logo na abertura.
- **Correção:** Pré-popular o app com os 6 personagens padrão como cards somente-leitura (sem opção de excluir os embutidos), mostrando nome, descrição e estilo. Adicionar botão "+ Criar Personalizado" para novos.

### 3. App Builder — empty state não tem atalho para o chat
- **Problema:** O empty state instrui o usuário a usar `/build` no chat, mas não há link ou botão direto. Usuário precisa fechar o app, abrir o chat e lembrar o comando.
- **Impacto:** Baixo — mas é fricção desnecessária.
- **Correção:** Adicionar botão "Abrir Chat com /build" no empty state que abre o chat e já insere o texto `/build ` no input.

---

## 🟡 Sugestões de Melhoria (não-críticas)

### 4. Desktop com 44 ícones — navegação densa
- Com todos os apps no desktop, a tela fica lotada. Em resolução menor pode ser difícil encontrar apps.
- **Sugestão:** Adicionar scroll suave vertical ao desktop, ou agrupar ícones por categoria com separadores visuais (ex: linha divisória + label "IA", "Sobrevivência", etc.).

### 5. Configurações — painel lateral inconsistente
- Todas as janelas abrem como janelas flutuantes gerenciáveis (drag, resize, minimize). Configurações abre como painel lateral fixo à direita.
- Não é um bug, mas cria inconsistência. Poderia ter botão fechar no painel (`X`) mais visível, ou ser opção "abrir como janela".

### 6. Clima — mensagem de "sem sensor" poderia ser mais informativa
- O app exibe "--- hPa / Sem leituras" sem explicar como conectar sensor ou que pode inserir manualmente.
- **Sugestão:** Adicionar dica: "Insira leituras manuais pelo campo abaixo. 2 leituras mínimas para gerar tendência."

### 7. Personagens — integração com chat não é clara
- Usuários que criarem um personagem podem não saber como ativá-lo no chat.
- **Sugestão:** Card de personagem deveria ter botão "Usar no Chat" que abre o chat com aquela personalidade ativa.

### 8. TTS — Kokoro não instalado sem instrução de instalação automatizada
- Configurações mostra "Não instalado (pip install kokoro-onnx)" como texto simples — o usuário técnico entende, mas o não-técnico não.
- **Sugestão:** Substituir o texto por botão "Instalar Kokoro Offline" que executa a instalação automaticamente via API backend.

---

## ✅ O que está Excelente

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

---

## 📊 Resumo

| Categoria | Status |
|-----------|--------|
| Bugs críticos | 0 |
| Inconsistências UX | 3 (Calculadora, Personagens, Builder) |
| Sugestões de polish | 5 |
| Apps funcionando corretamente | 45/49 |
| Apps parciais (dependem de conteúdo externo) | 4 (Mapas, Wikipedia, Livros, Clima) |

---

> Próximo passo: aplicar correções dos itens 1, 2 e 3.
