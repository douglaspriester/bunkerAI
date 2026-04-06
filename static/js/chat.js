/* ═══ Bunker OS — Chat, Streaming, Message UI ═══ */

import { state, escapeHtml, saveChats, saveFavorites, genId, LOADING_PHRASES } from './state.js';
import { markdownToHtml } from './markdown.js';
import { openApp } from './windowManager.js';

// ─── Chat List ──────────────────────────────────────────────────────────────
export function renderChatList() {
  const list = document.getElementById("chatList");
  if (!list) return;
  list.innerHTML = "";
  const ids = Object.keys(state.chats);
  for (const id of ids) {
    const chat = state.chats[id];
    const li = document.createElement("li");
    li.className = "nav-item" + (id === state.activeChatId ? " active" : "");
    li.innerHTML = `<span>${escapeHtml(chat.title)}</span>
      <button class="chat-del" onclick="event.stopPropagation();deleteChat('${id}')" title="Excluir">&times;</button>`;
    li.onclick = () => switchChat(id);
    list.appendChild(li);
  }
}

export function switchChat(id) {
  if (!state.chats[id]) return;
  state.activeChatId = id;
  saveChats();
  renderChatList();
  restoreChat();
}

export function restoreChat() {
  const chat = state.chats[state.activeChatId];
  const container = document.getElementById("chatMessages");
  if (!container) return;
  container.innerHTML = "";
  if (!chat || chat.messages.length === 0) {
    container.innerHTML = getWelcomeHtml();
    return;
  }
  for (const m of chat.messages) {
    if (m.role === "user") addMsgDom("user", m.content, null, m.badge);
    else {
      const el = addMsgDom("assistant", m.content, null, m.badge);
      addMsgActions(el, m.content);
    }
  }
}

export function newChat() {
  const id = genId();
  state.chats[id] = { title: "Novo chat", messages: [] };
  state.activeChatId = id;
  saveChats();
  renderChatList();
  restoreChat();
  const ta = document.getElementById("chatInput");
  if (ta) { ta.value = ""; ta.focus(); }
}

export function deleteChat(id) {
  if (Object.keys(state.chats).length <= 1) return;
  delete state.chats[id];
  if (state.activeChatId === id) {
    state.activeChatId = Object.keys(state.chats)[0];
  }
  saveChats();
  renderChatList();
  restoreChat();
}

export function clearAllData() {
  if (!confirm("Apagar TODOS os dados salvos? (chats, favoritos, sessao)")) return;
  state.chats = {};
  state.favorites = [];
  state.activeChatId = null;
  const id = genId();
  state.chats[id] = { title: "Novo chat", messages: [] };
  state.activeChatId = id;
  saveChats();
  saveFavorites();
  renderChatList();
  renderFavorites();
  restoreChat();
}

// ─── Favorites ──────────────────────────────────────────────────────────────
export function renderFavorites() {
  const list = document.getElementById("favList");
  const empty = document.getElementById("favEmpty");
  if (!list || !empty) return;
  if (state.favorites.length === 0) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.innerHTML = state.favorites.map(f =>
    `<li class="nav-item fav-item" title="${escapeHtml(f.text)}">
       <span class="fav-text" onclick="switchChat('${f.chatId}')">${escapeHtml(f.text.slice(0, 50))}${f.text.length > 50 ? '...' : ''}</span>
       <button class="chat-del" onclick="event.stopPropagation();removeFavorite('${f.id}')" title="Remover">&times;</button>
     </li>`
  ).join("");
}

export function addFavorite(text, chatId) {
  state.favorites.push({ id: genId(), text: text.slice(0, 200), from: "assistant", chatId, ts: Date.now() });
  saveFavorites();
  renderFavorites();
}

export function removeFavorite(id) {
  state.favorites = state.favorites.filter(f => f.id !== id);
  saveFavorites();
  renderFavorites();
}

export function isFavorited(text) {
  return state.favorites.some(f => f.text === text.slice(0, 200));
}

// ─── Input Helpers ──────────────────────────────────────────────────────────
export function autoResize() {
  const ta = document.getElementById("chatInput");
  if (!ta) return;
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
    updateModeTag();
  });
}

export function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
}

export function setInput(text) {
  const ta = document.getElementById("chatInput");
  ta.value = text;
  ta.focus();
  updateModeTag();
  showChatView();
}

export function updateModeTag() {
  const tag = document.getElementById("modeTag");
  const hint = document.getElementById("modeHint");
  const text = document.getElementById("chatInput")?.value || "";
  if (!tag || !hint) return;

  if (text.startsWith("/build")) {
    tag.textContent = "BUILD"; tag.style.background = "rgba(200, 80, 255, 0.12)"; tag.style.color = "#c850ff";
    hint.innerHTML = `Gerando app com <code>${(state.autoModels||{}).code || document.getElementById("builderModel")?.value || 'auto'}</code>`;
  } else if (text.startsWith("/brain")) {
    tag.textContent = "CEREBRO"; tag.style.background = "rgba(255, 60, 60, 0.12)"; tag.style.color = "#ff4444";
    hint.innerHTML = `Modo sem filtros &mdash; <code>${(state.autoModels||{}).brain || document.getElementById("brainModel")?.value || 'auto'}</code> sem amarras`;
  } else if (state.webcamActive) {
    tag.textContent = "VIDEO"; tag.style.background = "rgba(99, 145, 255, 0.12)"; tag.style.color = "#6391ff";
    hint.textContent = "Webcam ativa \u2014 sua mensagem analisa o frame atual";
  } else if (state.attachedImage) {
    tag.textContent = "VISAO"; tag.style.background = "rgba(99, 145, 255, 0.12)"; tag.style.color = "#6391ff";
    hint.textContent = "Imagem anexada \u2014 sua mensagem analisa a imagem";
  } else if (_activeMode !== 'general') {
    const mode = AI_MODES[_activeMode];
    tag.textContent = mode.label.toUpperCase(); tag.style.background = `${mode.color}18`; tag.style.color = mode.color;
    hint.innerHTML = `Modo ${mode.icon} ${mode.label} ativo &mdash; prompt especializado`;
  } else {
    tag.textContent = "TEXTO"; tag.style.background = "var(--accent-dim)"; tag.style.color = "var(--accent)";
    hint.innerHTML = 'Enter envia \u00B7 Shift+Enter nova linha \u00B7 <code>/build</code> gera apps';
  }
}

// ─── Prompt Queue ───────────────────────────────────────────────────────────
export function renderQueue() {
  const el = document.getElementById("promptQueue");
  if (!el) return;
  if (state.promptQueue.length === 0) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  el.innerHTML = `<div class="queue-label">Fila (${state.promptQueue.length})</div>` +
    state.promptQueue.map((q, i) =>
      `<div class="queue-item"><span class="queue-text">${escapeHtml(q.length > 50 ? q.slice(0,50)+"\u2026" : q)}</span>` +
      `<button class="queue-remove" onclick="removeFromQueue(${i})">\u2715</button></div>`
    ).join("");
}

export function removeFromQueue(i) {
  state.promptQueue.splice(i, 1);
  renderQueue();
}

async function processQueue() {
  if (state.promptQueue.length === 0) return;
  const next = state.promptQueue.shift();
  renderQueue();
  document.getElementById("chatInput").value = next;
  await send();
}

// ─── Send (unified router) ─────────────────────────────────────────────────
export async function send() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  if (state.isStreaming) {
    state.promptQueue.push(text);
    input.value = "";
    input.style.height = "auto";
    renderQueue();
    return;
  }

  showChatView();
  input.value = "";
  input.style.height = "auto";
  state.isStreaming = true;
  document.getElementById("btnSend").disabled = false;

  const chat = state.chats[state.activeChatId];

  if (chat.messages.length === 0) {
    chat.title = text.slice(0, 40) + (text.length > 40 ? "..." : "");
    saveChats();
    renderChatList();
  }

  if (text.startsWith("/build ")) {
    await handleBuild(text.slice(7));
  } else if (text.startsWith("/brain ")) {
    await handleBrain(text.slice(7));
  } else if (state.webcamActive) {
    await handleVision(text, "webcam");
  } else if (state.attachedImage) {
    await handleVision(text, "upload");
  } else {
    await handleChat(text);
  }

  state.isStreaming = false;
  document.getElementById("btnSend").disabled = false;
  updateModeTag();
  processQueue();
}

// ─── AI Modes ───────────────────────────────────────────────────────────────
export const AI_MODES = {
  general: {
    label: 'Geral',
    icon: '🤖',
    color: '#00d4ff',
    prompt: null,  // uses user-defined system prompt from settings
  },
  medical: {
    label: 'Medico',
    icon: '🏥',
    color: '#ff4444',
    prompt: `Voce e BUNKER AI — modulo MEDICO DE CAMPO. Seu operador pode estar ferido ou cuidando de alguem ferido.
PRIORIDADES: Salvar vidas. Estabilizar. Improviso com recursos limitados.
DOMINIO: trauma, farmacologia de emergencia, sutura, imobilizacao, infeccoes, antidotos, cirurgia de campo, obstetrica de emergencia, odontologia de campo.
FORMATO: Sempre comece com TRIAGEM (gravidade 1-5). Depois ACAO IMEDIATA. Depois MATERIAIS NECESSARIOS. Depois PROCEDIMENTO passo-a-passo.
ALERTA: Indique sempre quando "EVACUAR PARA HOSPITAL" e a unica opcao real.
Responda no idioma do usuario. Use markdown. Sem evasivas. Medidas exatas.`,
  },
  survival: {
    label: 'Sobrevivencia',
    icon: '🏕️',
    color: '#4caf50',
    prompt: `Voce e BUNKER AI — modulo SOBREVIVENCIA. Seu operador esta em ambiente hostil com recursos limitados.
PRIORIDADES: Abrigo, Agua, Fogo, Comida, Sinalizacao (regra dos 3).
DOMINIO: bushcraft, orientacao sem GPS, purificacao de agua, armadilhas, plantas comestiveis, construcao de abrigos, meteorologia pratica, navegacao estelar, fogueiras, nos e amarracoes.
FORMATO: Sempre comece com SITUACAO (avalie o cenario). Depois PRIORIDADE IMEDIATA. Depois PASSO-A-PASSO com materiais encontraveis na natureza.
ALERTA: Indique plantas/fungos TOXICOS similares quando mencionar comestiveis.
Responda no idioma do usuario. Use markdown. Sem evasivas. Medidas exatas.`,
  },
  engineer: {
    label: 'Engenharia',
    icon: '🔧',
    color: '#ff9800',
    prompt: `Voce e BUNKER AI — modulo ENGENHARIA DE CAMPO. Seu operador precisa construir, reparar ou improvisar.
PRIORIDADES: Seguranca estrutural. Funcionalidade. Durabilidade com materiais disponiveis.
DOMINIO: eletrica basica, geradores, energia solar, hidraulica, mecanica, soldagem improvisada, radio, antenas, filtragem, destilacao, quimica pratica, explosivos para demolicao, fortificacao.
FORMATO: Sempre comece com MATERIAIS (lista do que precisa). Depois FERRAMENTAS. Depois DIAGRAMA (ASCII art se util). Depois PROCEDIMENTO numerado.
ALERTA: Indique RISCOS DE SEGURANCA (eletrico, quimico, estrutural) em cada procedimento.
Responda no idioma do usuario. Use markdown. Sem evasivas. Medidas exatas.`,
  },
  defense: {
    label: 'Defesa',
    icon: '🛡️',
    color: '#9c27b0',
    prompt: `Voce e BUNKER AI — modulo DEFESA E TATICA. Seu operador pode estar em zona de conflito ou ameaca.
PRIORIDADES: Seguranca do grupo. Avaliacao de ameacas. Planejamento tatico. Evasao quando possivel.
DOMINIO: defesa perimetral, camuflagem, comunicacoes seguras, primeiros socorros taticos, navegacao tatica, contra-vigilancia, seguranca operacional (OPSEC), sinais de alerta, rotas de fuga.
FORMATO: Sempre comece com AVALIACAO DA AMEACA. Depois OPCOES (ataque/defesa/evasao). Depois PLANO passo-a-passo. Depois CONTINGENCIA (plano B).
ALERTA: Priorize SEMPRE evasao sobre confronto quando possivel. Indique riscos letais.
Responda no idioma do usuario. Use markdown. Sem evasivas.`,
  },
  psych: {
    label: 'Psicologico',
    icon: '🧠',
    color: '#2196f3',
    prompt: `Voce e BUNKER AI — modulo SUPORTE PSICOLOGICO DE CRISE. Seu operador ou grupo pode estar sob estresse extremo.
PRIORIDADES: Estabilizacao emocional. Prevencao de panico. Coesao do grupo. Tomada de decisao sob pressao.
DOMINIO: primeiros socorros psicologicos, TEPT, gestao de panico, luto em campo, lideranca de crise, conflitos de grupo, criancas em trauma, privacao de sono, resiliencia, tecnicas de grounding.
FORMATO: Comece com LEITURA DA SITUACAO (sinais observados). Depois INTERVENCAO IMEDIATA. Depois TECNICA (grounding, respiracao, etc). Depois ACOMPANHAMENTO.
NOTA: Use tom calmo e direto. Sem jargao. Linguagem simples e acolhedora mas sem ser condescendente.
Responda no idioma do usuario. Use markdown.`,
  },
};

let _activeMode = 'general';

export function getActiveMode() { return _activeMode; }

export function setAIMode(modeId) {
  if (!AI_MODES[modeId]) return;
  _activeMode = modeId;
  storage.set('aiMode', modeId);
  renderModeSelector();
  updateModeTag();
  // Refresh welcome screen if visible
  const welcome = document.getElementById('welcomeMsg');
  if (welcome) welcome.outerHTML = getWelcomeHtml();
}

export function renderModeSelector() {
  const container = document.getElementById('aiModeSelector');
  if (!container) return;
  const mode = AI_MODES[_activeMode];
  container.innerHTML = Object.entries(AI_MODES).map(([id, m]) =>
    `<button class="ai-mode-btn${id === _activeMode ? ' active' : ''}" onclick="setAIMode('${id}')" title="${m.label}" style="${id === _activeMode ? `--mode-color:${m.color}` : ''}">${m.icon}<span class="ai-mode-label">${m.label}</span></button>`
  ).join('');
}

export function initModeSelector() {
  _activeMode = storage.get('aiMode') || 'general';
  renderModeSelector();
}

function getSystemPrompt() {
  const mode = AI_MODES[_activeMode];
  if (mode.prompt) return mode.prompt;
  return document.getElementById("systemPrompt").value;
}

// ─── Chat handlers ──────────────────────────────────────────────────────────
async function handleChat(text) {
  const chat = state.chats[state.activeChatId];
  const modeBadge = _activeMode !== 'general' ? _activeMode : null;
  addMsgDom("user", text, null, modeBadge);
  chat.messages.push({ role: "user", content: text, badge: modeBadge });
  saveChats();

  const model = document.getElementById("chatModel").value;
  const system = getSystemPrompt();
  const apiMessages = chat.messages.map(m => ({ role: m.role, content: m.content }));
  const { el, contentEl } = addStreamMsgDom(modeBadge);

  const full = await streamFromAPI("/api/chat", { model, messages: apiMessages, system }, contentEl);
  chat.messages.push({ role: "assistant", content: full, badge: modeBadge });
  saveChats();
  addMsgActions(el, full);
}

async function handleBrain(text) {
  const chat = state.chats[state.activeChatId];
  addMsgDom("user", text, null, "brain");
  chat.messages.push({ role: "user", content: text, badge: "brain" });
  saveChats();

  const model = document.getElementById("brainModel").value || (state.autoModels||{}).brain || "";
  const brainSystem = document.getElementById("brainPrompt").value;
  const apiMessages = chat.messages.map(m => ({ role: m.role, content: m.content }));
  const { el, contentEl } = addStreamMsgDom("brain");

  const full = await streamFromAPI("/api/chat", { model, messages: apiMessages, system: brainSystem }, contentEl);
  chat.messages.push({ role: "assistant", content: full, badge: "brain" });
  saveChats();
  addMsgActions(el, full);
}

async function handleVision(text, source) {
  const chat = state.chats[state.activeChatId];
  let b64;
  if (source === "webcam") {
    b64 = window.captureWebcamFrame?.();
    addMsgDom("user", text, null, "vision", b64);
  } else {
    b64 = state.attachedImage.b64;
    addMsgDom("user", text, null, "vision", b64);
    window.clearAttachment?.();
  }

  const model = document.getElementById("visionModel").value;
  const apiMessages = chat.messages.map(m => ({ role: m.role, content: m.content }));
  const { el, contentEl } = addStreamMsgDom("vision");

  const full = await streamFromAPI("/api/vision", { model, image: b64, prompt: text, messages: apiMessages }, contentEl);
  chat.messages.push({ role: "user", content: text, badge: "vision" });
  chat.messages.push({ role: "assistant", content: full, badge: "vision" });
  saveChats();
  addMsgActions(el, full);
}

async function handleBuild(prompt) {
  const chat = state.chats[state.activeChatId];
  addMsgDom("user", `/build ${prompt}`, null, "builder");

  const model = document.getElementById("builderModel").value;
  const { el, contentEl } = addStreamMsgDom("builder");

  let fullHtml = await streamFromAPI("/api/build", { model, prompt }, contentEl);

  const match = fullHtml.match(/```html\s*([\s\S]*?)```/);
  if (match) fullHtml = match[1];
  else {
    const docMatch = fullHtml.match(/(<!DOCTYPE[\s\S]*<\/html>)/i);
    if (docMatch) fullHtml = docMatch[1];
  }

  state.generatedHtml = fullHtml;
  const strip = document.getElementById("builderStrip");
  const frame = document.getElementById("builderFrame");
  if (strip) strip.classList.remove("hidden");
  if (frame) frame.srcdoc = fullHtml;

  chat.messages.push({ role: "user", content: `/build ${prompt}`, badge: "builder" });
  chat.messages.push({ role: "assistant", content: "[App gerado]", badge: "builder" });
  saveChats();
}

// ─── Stop / Stream control ──────────────────────────────────────────────────
function setStopMode(on) {
  const btn = document.getElementById("btnSend");
  const icon = document.getElementById("btnSendIcon");
  if (!btn || !icon) return;
  if (on) {
    btn.title = "Parar gera\u00E7\u00E3o";
    btn.classList.add("btn-stop");
    btn.onclick = () => { if (state.abortController) state.abortController.abort(); };
    icon.innerHTML = `<rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor"/>`;
    icon.setAttribute("fill", "currentColor");
    icon.removeAttribute("stroke");
  } else {
    btn.title = "Enviar";
    btn.classList.remove("btn-stop");
    btn.onclick = send;
    icon.innerHTML = `<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`;
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("fill", "none");
  }
}

export async function streamFromAPI(url, body, contentEl) {
  let full = "";
  let stats = null;
  let errorMsg = null;
  const controller = new AbortController();
  state.abortController = controller;
  setStopMode(true);

  // 3-minute client-side timeout
  const STREAM_TIMEOUT_MS = 3 * 60 * 1000;
  const timeoutId = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort("timeout");
    }
  }, STREAM_TIMEOUT_MS);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const reader = r.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              errorMsg = data.error;
            }
            if (data.token) {
              full += data.token;
              contentEl.textContent = full;
              scrollChat();
            }
            if (data.stats) stats = data.stats;
          } catch {}
        }
      }
    }
  } catch (e) {
    if (e.name === "AbortError") {
      const reason = controller.signal.reason;
      if (reason === "timeout") {
        errorMsg = "Tempo esgotado — o modelo pode estar carregando. Tente novamente.";
      }
      // else: user-triggered abort, no message needed
    } else {
      errorMsg = `Erro: ${e.message}. Verifique se o servidor de IA esta rodando.`;
    }
  } finally {
    clearTimeout(timeoutId);
  }

  state.abortController = null;
  setStopMode(false);

  const dots = contentEl.parentElement?.querySelector(".typing-indicator");
  if (dots) dots.remove();

  // Show error state clearly (including timeout abort messages)
  if (errorMsg) {
    contentEl.innerHTML = `<span class="stream-error">${escapeHtml(errorMsg)}</span>`;
    return full;
  }

  if (full) contentEl.innerHTML = markdownToHtml(full) + (controller.signal.aborted ? ' <em class="stream-stopped">[interrompido]</em>' : "");

  // Show model stats footer
  if (stats && contentEl.parentElement) {
    const parts = [];
    if (stats.model) parts.push(stats.model);
    if (stats.tok_s) parts.push(`${stats.tok_s} tok/s`);
    if (stats.tokens) parts.push(`${stats.tokens} tokens`);
    if (stats.total_s) parts.push(`${stats.total_s}s`);
    if (parts.length) {
      const footer = document.createElement("div");
      footer.className = "msg-stats";
      footer.textContent = parts.join(" · ");
      contentEl.parentElement.appendChild(footer);
    }
  }

  return full;
}

// ─── Message UI ─────────────────────────────────────────────────────────────
export function addMsgDom(role, text, imgThumb, badge, imgB64) {
  removeWelcome();
  const container = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = `msg ${role}`;

  const avatar = role === "user" ? "VC" : "BA";
  const name = role === "user" ? "Voce" : "Bunker AI";
  let badgeHtml = "";
  if (badge === "voice") badgeHtml = '<span class="msg-badge badge-voice">VOZ</span>';
  if (badge === "vision") badgeHtml = '<span class="msg-badge badge-vision">VISAO</span>';
  if (badge === "builder") badgeHtml = '<span class="msg-badge badge-builder">BUILD</span>';
  if (badge === "brain") badgeHtml = '<span class="msg-badge badge-brain">CEREBRO</span>';
  if (badge && AI_MODES[badge]) badgeHtml = `<span class="msg-badge badge-${badge}">${AI_MODES[badge].icon} ${AI_MODES[badge].label.toUpperCase()}</span>`;

  let imgHtml = "";
  if (imgB64) {
    const src = imgB64.startsWith("data:") ? imgB64 : `data:image/jpeg;base64,${imgB64}`;
    imgHtml = `<img class="msg-image" src="${src}" />`;
  }

  const contentHtml = role === "assistant" ? markdownToHtml(text) : escapeHtml(text);

  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-body">
      <div class="msg-meta"><span class="msg-name">${name}</span>${badgeHtml}</div>
      ${imgHtml}
      <div class="msg-content">${contentHtml}</div>
    </div>`;

  container.appendChild(div);
  scrollChat();
  return div;
}

export function addStreamMsgDom(badge) {
  removeWelcome();
  const container = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = "msg assistant";

  let badgeHtml = "";
  if (badge === "voice") badgeHtml = '<span class="msg-badge badge-voice">VOZ</span>';
  if (badge === "vision") badgeHtml = '<span class="msg-badge badge-vision">VISAO</span>';
  if (badge === "builder") badgeHtml = '<span class="msg-badge badge-builder">BUILD</span>';
  if (badge === "brain") badgeHtml = '<span class="msg-badge badge-brain">CEREBRO</span>';
  if (badge && AI_MODES[badge]) badgeHtml = `<span class="msg-badge badge-${badge}">${AI_MODES[badge].icon} ${AI_MODES[badge].label.toUpperCase()}</span>`;

  const phrase = LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];

  div.innerHTML = `
    <div class="msg-avatar">BA</div>
    <div class="msg-body">
      <div class="msg-meta"><span class="msg-name">Bunker AI</span>${badgeHtml}</div>
      <div class="msg-content"></div>
      <div class="typing-indicator" title="${phrase}"><span></span><span></span><span></span></div>
    </div>`;

  container.appendChild(div);
  scrollChat();
  return { el: div, contentEl: div.querySelector(".msg-content") };
}

export function addMsgActions(msgEl, text) {
  const body = msgEl.querySelector(".msg-body");
  const actions = document.createElement("div");
  actions.className = "msg-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "msg-copy-btn";
  copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar`;
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "\u2713 Copiado";
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar`;
      }, 1800);
    }).catch(() => {});
  };

  const ttsBtn = document.createElement("button");
  ttsBtn.className = "msg-tts-btn";
  ttsBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg> Ouvir`;
  ttsBtn.onclick = () => window.speakText?.(text);

  const favBtn = document.createElement("button");
  favBtn.className = `msg-fav-btn${isFavorited(text) ? " faved" : ""}`;
  favBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Favoritar`;
  favBtn.onclick = () => {
    if (isFavorited(text)) {
      const fav = state.favorites.find(f => f.text === text.slice(0, 200));
      if (fav) removeFavorite(fav.id);
      favBtn.classList.remove("faved");
    } else {
      addFavorite(text, state.activeChatId);
      favBtn.classList.add("faved");
    }
  };

  actions.appendChild(copyBtn);
  actions.appendChild(ttsBtn);
  actions.appendChild(favBtn);
  body.appendChild(actions);
}

function removeWelcome() {
  const w = document.getElementById("welcomeMsg");
  if (w) w.remove();
}

export function scrollChat() {
  const c = document.getElementById("chatMessages");
  if (c) c.scrollTop = c.scrollHeight;
}

const MODE_HINTS = {
  general: [
    { text: 'Purificar agua', prompt: 'Como purificar agua sem equipamento?' },
    { text: 'A Grande Pergunta', prompt: 'Qual a resposta para a vida, o universo e tudo mais?' },
    { text: 'Criar app', prompt: '/build Um dashboard de sobrevivencia com checklist, mapa e inventario' },
    { text: 'Ligar webcam', action: 'activateWebcam()' },
  ],
  medical: [
    { text: 'Parar hemorragia', prompt: 'Como parar uma hemorragia grave sem material hospitalar?' },
    { text: 'Imobilizar fratura', prompt: 'Como imobilizar uma fratura exposta em campo?' },
    { text: 'Queimadura grave', prompt: 'Tratamento de emergencia para queimadura de 2o e 3o grau' },
    { text: 'RCP adulto', prompt: 'Procedimento completo de RCP em adulto sem desfibrilador' },
  ],
  survival: [
    { text: 'Encontrar agua', prompt: 'Como encontrar e purificar agua na natureza?' },
    { text: 'Abrigo improvisado', prompt: 'Como construir um abrigo de emergencia com materiais naturais?' },
    { text: 'Fazer fogo', prompt: 'Metodos de fazer fogo sem fosforo ou isqueiro' },
    { text: 'Plantas comestiveis', prompt: 'Quais plantas silvestres sao seguras para comer no Brasil?' },
  ],
  engineer: [
    { text: 'Gerador improvisado', prompt: 'Como construir um gerador eletrico simples com materiais encontrados?' },
    { text: 'Filtro de agua', prompt: 'Como construir um filtro de agua com areia, carvao e cascalho?' },
    { text: 'Radio receptor', prompt: 'Como montar um radio receptor AM simples para captar sinais?' },
    { text: 'Painel solar', prompt: 'Como montar um sistema basico de energia solar com bateria?' },
  ],
  defense: [
    { text: 'Perimetro seguro', prompt: 'Como estabelecer um perimetro defensivo para um grupo pequeno?' },
    { text: 'Rotas de fuga', prompt: 'Como planejar rotas de evasao e pontos de encontro?' },
    { text: 'Camuflagem', prompt: 'Tecnicas de camuflagem e ocultacao em ambiente urbano e rural' },
    { text: 'OPSEC basico', prompt: 'Guia de seguranca operacional (OPSEC) para comunicacoes em crise' },
  ],
  psych: [
    { text: 'Ataque de panico', prompt: 'Como ajudar alguem tendo um ataque de panico severo?' },
    { text: 'Crianca em choque', prompt: 'Como acalmar e estabilizar uma crianca em estado de choque emocional?' },
    { text: 'Lideranca de crise', prompt: 'Como manter a coesao e moral de um grupo sob estresse extremo?' },
    { text: 'Tecnica grounding', prompt: 'Ensine a tecnica 5-4-3-2-1 de grounding para ansiedade aguda' },
  ],
};

export function getWelcomeHtml() {
  const mode = AI_MODES[_activeMode];
  const hints = MODE_HINTS[_activeMode] || MODE_HINTS.general;
  const subtitle = _activeMode === 'general'
    ? 'Seu guia local para o fim do mundo. Chat por texto, voz ou video. Gere apps com <code>/build</code>. Tudo offline, tudo seu.'
    : `Modo <strong style="color:${mode.color}">${mode.icon} ${mode.label}</strong> ativo — pergunte qualquer coisa sobre ${mode.label.toLowerCase()}.`;

  const hintBtns = hints.map(h =>
    h.action
      ? `<button class="hint" onclick="${h.action}">${h.text}</button>`
      : `<button class="hint" onclick="setInput('${h.prompt.replace(/'/g, "\\'")}')">${h.text}</button>`
  ).join('\n      ');

  return `<div class="welcome-msg" id="welcomeMsg">
    <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="${_activeMode === 'general' ? 'var(--accent)' : mode.color}"/>
      <path d="M8 22V12l8-5 8 5v10l-8 5-8-5z" stroke="var(--bg)" stroke-width="2" fill="none"/>
      <circle cx="16" cy="16" r="3" fill="var(--bg)"/>
    </svg>
    <h2>Bunker AI</h2>
    <div class="dont-panic">DON'T PANIC</div>
    <p>${subtitle}</p>
    <div class="welcome-hints">
      ${hintBtns}
    </div>
  </div>`;
}

// ─── View helpers ───────────────────────────────────────────────────────────
export function showView(id) {
  // Legacy — routes through window manager now
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

export function showChatView() { openApp('chat'); }
export function showGuideView() { openApp('guides'); }
