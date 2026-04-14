/* ═══ Bunker OS — Apps & Features (transitional module) ═══ */
/* This file contains all app-specific code that hasn't been extracted into ES modules yet. */
/* It reads core functionality from window globals set by main.js */
/* Gradually, each section here should become its own ES module. */

// Aliases for globals provided by main.js
const { state, storage, escapeHtml, markdownToHtml, guidesCache, LOADING_PHRASES,
        OS_APPS, _windows, openApp, closeWindow, focusWindow, osToast, openSavedApp,
        saveChats, saveFavorites, renderChatList, restoreChat, renderFavorites,
        addFavorite, removeFavorite, isFavorited, genId,
        renderDesktopIcons, startTaskbarClock, applyWallpaper, restoreSession,
        addMsgDom, addStreamMsgDom, addMsgActions, streamFromAPI, scrollChat,
        showView, showChatView, showGuideView,
        setGuidesIndex, setProtocolsIndex, setGamesIndex, setSearchIndex } = window;

// Note: guidesIndex/protocolsIndex/gamesIndex are live getters on window.
// Always access via window.guidesIndex etc. (not as destructured const).


// ─── Accessibility: Font Size ────────────────────────────────────────────────
function setFontSize(size) {
  document.body.classList.remove('font-sm', 'font-md', 'font-lg');
  if (size && size !== 'md') document.body.classList.add('font-' + size);
  // Persist
  try { localStorage.setItem('bunker_font_size', size); } catch {}
  // Update selector buttons
  document.querySelectorAll('.config-fontsize-btn').forEach(btn => {
    const active = btn.dataset.size === size;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });
}

function initFontSize() {
  const saved = localStorage.getItem('bunker_font_size') || 'md';
  setFontSize(saved);
}


// ─── Boot Sequence ───────────────────────────────────────────────────────────
function runBootSequence() {
  const bootLog = document.getElementById('bootLog');
  const bootFill = document.getElementById('bootBarFill');
  const bootScreen = document.getElementById('bootScreen');
  const desktop = document.getElementById('desktop');

  // Init accessibility font size early
  initFontSize();

  if (!bootScreen || !desktop) {
    // No boot screen, go straight to desktop
    applyWallpaper();
    renderDesktopIcons();
    startTaskbarClock();
    setTimeout(() => restoreSession(), 150);
    return;
  }

  const lines = [
    '[BIOS] Bunker OS v3.0 — POST OK',
    '[CPU]  Processador detectado',
    '[RAM]  Memória verificada',
    '[DISK] Armazenamento montado',
    '[NET]  Interface de rede: localhost',
    '[OLMA] Conectando ao Ollama...',
    '[LLM]  Modelos de IA carregados',
    '[TTS]  Engine de voz inicializada',
    '[GUI]  Window Manager iniciado',
    '[DESK] Desktop pronto',
    '',
    '> DON\'T PANIC. Sistema operacional pronto.',
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i < lines.length) {
      const div = document.createElement('div');
      div.textContent = lines[i];
      if (lines[i].includes('DON\'T PANIC')) div.style.color = 'var(--accent)';
      bootLog.appendChild(div);
      // Keep only last 5 visible
      while (bootLog.children.length > 6) bootLog.removeChild(bootLog.firstChild);
      bootFill.style.width = Math.round(((i + 1) / lines.length) * 100) + '%';
      i++;
    } else {
      clearInterval(interval);
      // Transition to desktop
      setTimeout(() => {
        bootScreen.classList.add('fade-out');
        desktop.style.display = '';
        applyWallpaper();
        renderDesktopIcons();
        startTaskbarClock();
        setTimeout(() => restoreSession(), 300);
        setTimeout(() => bootScreen.remove(), 1000);
        // Show onboarding wizard on first launch
        setTimeout(() => {
          if (window.onboardingShouldShow && window.onboardingShouldShow()) {
            window.onboardingShow();
          }
        }, 1200);
      }, 400);
    }
  }, 180);
}

// ─── Guides (dynamic, loaded from API) ──────────────────────────────────────
// Guide progress cache
let _guideProgressData = {};

async function loadGuidesIndex() {
  try {
    const [r, pr] = await Promise.all([
      fetch('/api/guides'),
      fetch('/api/guides/progress/all').catch(() => ({ ok: false }))
    ]);
    const d = await r.json();
    setGuidesIndex(Array.isArray(d) ? d : (d.guides || []));
    if (pr.ok) { _guideProgressData = await pr.json(); }
    renderSidebarGuides();
    renderGuidesGrid();
    indexContent();
  } catch(e) { console.warn('Guides load failed:', e); }
}

function renderGuidesGrid() {
  const content = document.getElementById('guideContent');
  if (!content || state.activeGuide) return;
  const guides = window.guidesIndex;
  if (!guides || guides.length === 0) {
    content.innerHTML = '<div class="panel-empty">Nenhum guia disponivel.</div>';
    return;
  }
  const cats = {};
  for (const g of guides) {
    const cat = g.category || 'geral';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(g);
  }
  const catLabels = { essencial:'Essencial', 'médico':'Médico', saúde:'Saúde', mobilidade:'Mobilidade',
    comunicação:'Comunicação', segurança:'Segurança', infraestrutura:'Infraestrutura',
    habilidades:'Habilidades', geral:'Geral' };
  let html = '<div class="guides-grid">';
  for (const [cat, items] of Object.entries(cats)) {
    html += `<div class="guides-cat-title">${escapeHtml(catLabels[cat] || cat)}</div>`;
    html += '<div class="guides-cat-items">';
    for (const g of items) {
      const prog = _guideProgressData[g.id];
      const progBadge = prog?.status === 'completed' ? '<span class="guide-badge guide-done" title="Concluido">✓</span>'
        : prog?.status === 'reading' ? `<span class="guide-badge guide-reading" title="Lendo — ${Math.round(prog.read_pct || 0)}%">◐</span>`
        : '';
      html += `<div class="guide-card${prog?.status === 'completed' ? ' guide-completed' : ''}" onclick="openGuide('${g.id}')">
        <span class="guide-card-icon">${g.icon || '📖'}</span>
        <span class="guide-card-title">${escapeHtml(g.title)}</span>
        ${progBadge}
      </div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  content.innerHTML = html;
}

function renderSidebarGuides() {
  const list = document.getElementById('guideList');
  if (!list) return;
  // Keep the map item at the end
  const mapItem = list.querySelector('[data-guide="map"]');
  list.innerHTML = '';

  const icons = {
    water: '\u{1F4A7}', fire: '\u{1F525}', shelter: '\u{1F3E0}', firstaid: '\u{1FA7A}', navigation: '\u{1F9ED}',
    'food-foraging': '\u{1F33F}', 'food-preservation': '\u{1F96B}', 'radio-comms': '\u{1F4FB}',
    'hygiene-sanitation': '\u{1F9FC}', 'defense-security': '\u{1F6E1}\uFE0F', 'mental-health': '\u{1F9E0}',
    'power-electricity': '\u26A1', 'tools-repair': '\u{1F527}', 'knots-ropes': '\u{1FAA2}',
    'animal-trapping': '\u{1FAA4}', 'medicine-plants': '\u{1F331}', 'weather-prediction': '\u{1F326}\uFE0F',
    urban: '\u{1F3D9}\uFE0F'
  };

  for (const g of window.guidesIndex) {
    const li = document.createElement('li');
    li.className = 'nav-item nav-guide';
    li.dataset.guide = g.id;
    li.onclick = () => openGuide(g.id);
    li.innerHTML = `<span class="nav-emoji">${icons[g.id] || '\u{1F4D6}'}</span><span>${escapeHtml(g.title)}</span>`;
    list.appendChild(li);
  }

  // Re-add map item
  if (mapItem) list.appendChild(mapItem);
  else {
    const li = document.createElement('li');
    li.className = 'nav-item nav-guide nav-map-item';
    li.dataset.guide = 'map';
    li.onclick = () => openMap();
    li.innerHTML = `<span class="nav-emoji">\u{1F5FA}\uFE0F</span><span>Mapa Offline</span>`;
    list.appendChild(li);
  }
}

async function openGuide(guideId) {
  state.activeGuide = guideId;
  const content = document.getElementById('guideContent');
  content.innerHTML = '<div class="guide-loading">Carregando...</div>';

  document.querySelectorAll('.nav-guide').forEach(el => el.classList.remove('active'));
  const activeEl = document.querySelector(`[data-guide="${guideId}"]`);
  if (activeEl) activeEl.classList.add('active');

  showGuideView();
  document.getElementById('sidebar').classList.remove('open');

  try {
    // Check cache first
    if (!guidesCache[guideId]) {
      const r = await fetch(`/api/guides/${guideId}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const ct = r.headers.get('content-type') || '';
      // Server returns raw markdown text; store as string
      const text = await r.text();
      guidesCache[guideId] = ct.includes('json') ? JSON.parse(text) : { content: text };
    }
    const guide = guidesCache[guideId];
    const titleFromIndex = window.guidesIndex.find(g => g.id === guideId);
    const title = titleFromIndex?.title || guideId;

    const prog = _guideProgressData[guideId];
    const isCompleted = prog?.status === 'completed';
    content.innerHTML = `
      <div class="guide-body">
        <h1>${escapeHtml(title)}</h1>
        <div class="guide-md-content">${markdownToHtml(guide.content || '')}</div>
        <div class="guide-progress-bar">
          <button class="btn-mark-read ${isCompleted ? 'completed' : ''}" onclick="toggleGuideComplete('${guideId}')">
            ${isCompleted ? '✓ Concluido' : '☐ Marcar como lido'}
          </button>
        </div>
      </div>`;
    content.scrollTop = 0;

    // Track scroll progress
    _trackGuideScroll(guideId, content);

    // Mark as reading
    if (!isCompleted) {
      _updateGuideProgress(guideId, 'reading', prog?.read_pct || 0);
    }
  } catch(e) {
    content.innerHTML = `<div class="guide-error">Erro ao carregar guia: ${e.message}</div>`;
  }

  updateGuideFavBtn();
}

function _trackGuideScroll(guideId, container) {
  let _scrollTimer = null;
  container.onscroll = () => {
    clearTimeout(_scrollTimer);
    _scrollTimer = setTimeout(() => {
      const pct = Math.min(100, Math.round(
        (container.scrollTop / (container.scrollHeight - container.clientHeight)) * 100
      ));
      if (pct > (_guideProgressData[guideId]?.read_pct || 0)) {
        const status = pct >= 95 ? 'completed' : 'reading';
        _updateGuideProgress(guideId, status, pct);
      }
    }, 500);
  };
}

async function _updateGuideProgress(guideId, status, readPct) {
  _guideProgressData[guideId] = { guide_id: guideId, status, read_pct: readPct };
  try {
    await fetch(`/api/guides/${guideId}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, read_pct: readPct })
    });
  } catch(e) { /* silent */ }
}

async function toggleGuideComplete(guideId) {
  const prog = _guideProgressData[guideId];
  const newStatus = prog?.status === 'completed' ? 'reading' : 'completed';
  const newPct = newStatus === 'completed' ? 100 : (prog?.read_pct || 0);
  await _updateGuideProgress(guideId, newStatus, newPct);

  // Update button UI
  const btn = document.querySelector('.btn-mark-read');
  if (btn) {
    btn.classList.toggle('completed', newStatus === 'completed');
    btn.textContent = newStatus === 'completed' ? '✓ Concluido' : '☐ Marcar como lido';
  }
  // Refresh grid when we go back
  renderGuidesGrid();
}

function closeGuide() {
  state.activeGuide = null;
  document.querySelectorAll(".nav-guide").forEach(el => el.classList.remove("active"));
  const win = Object.values(_windows).find(w => w.appId === 'guides');
  if (win) {
    // Still in OS window — go back to grid instead of closing
    renderGuidesGrid();
  } else {
    showChatView();
  }
}

function toggleFavGuide() {
  if (!state.activeGuide) return;
  const titleFromIndex = window.guidesIndex.find(g => g.id === state.activeGuide)?.title;
  const text = titleFromIndex || state.activeGuide;
  if (isFavorited(text)) {
    const fav = state.favorites.find(f => f.text === text.slice(0, 200));
    if (fav) removeFavorite(fav.id);
  } else {
    addFavorite(text, null);
  }
  updateGuideFavBtn();
}

function updateGuideFavBtn() {
  const btn = document.getElementById("btnFavGuide");
  if (!state.activeGuide || !btn) return;
  const titleFromIndex = window.guidesIndex.find(g => g.id === state.activeGuide)?.title;
  const text = titleFromIndex || state.activeGuide;
  if (isFavorited(text)) {
    btn.classList.add("faved");
  } else {
    btn.classList.remove("faved");
  }
}

// ─── Offline Mode ───────────────────────────────────────────────────────────
function isOfflineMode() {
  return localStorage.getItem("bunker_offline_mode") === "1";
}

function toggleOfflineMode(enabled) {
  localStorage.setItem("bunker_offline_mode", enabled ? "1" : "0");
  // Update UI
  const desc = document.getElementById("offlineDesc");
  if (desc) desc.textContent = enabled ? "ATIVO — zero conexoes externas" : "Bloqueia toda conexao externa";
  // Update dots
  document.querySelectorAll("#offlineDetail .offline-dot").forEach(d => {
    d.className = "offline-dot " + (enabled ? "on" : "off");
  });
  // Notify server
  fetch("/api/config/offline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offline: enabled }),
  }).catch(() => {});
  // Toast
  if (typeof osToast === "function") {
    osToast(enabled ? "Modo 100% offline ativado" : "Modo online restaurado", enabled ? "success" : "info");
  }
}

function initOfflineToggle() {
  const toggle = document.getElementById("offlineToggle");
  if (toggle) {
    toggle.checked = isOfflineMode();
    // Update dots on load
    if (isOfflineMode()) {
      document.querySelectorAll("#offlineDetail .offline-dot").forEach(d => {
        d.className = "offline-dot on";
      });
      const desc = document.getElementById("offlineDesc");
      if (desc) desc.textContent = "ATIVO — zero conexoes externas";
    }
  }
}

// ─── Config App (janela) ───────────────────────────────────────────────────
// Backward-compat: mantido o nome toggleConfig() — agora abre a janela de
// Configurações gerenciada pelo windowManager. A inicialização dos campos
// (status, Kokoro, offline) acontece via registerAppOpen('settings').
function toggleConfig() {
  if (typeof window.openApp === 'function') {
    window.openApp('settings');
  }
}
window.settingsInit = function() {
  updateConfigStatus();
  if (typeof checkKokoroStatus === 'function') checkKokoroStatus();
  if (typeof initOfflineToggle === 'function') initOfflineToggle();
};

function switchConfigTab(btn) {
  // Legacy no-op — tabs removed, config is now single-scroll
}

function updateConfigStatus() {
  const d = state._lastHealth || {};

  // Status chips at top of IA tab
  const chipBackend = document.getElementById("cfgChipBackend");
  const chipModels = document.getElementById("cfgChipModels");
  const chipTTS = document.getElementById("cfgChipTTS");

  if (chipBackend) {
    const online = d.status === "online";
    const label = d.backend === "ollama" ? "Ollama" : d.backend === "llama.cpp" ? "llama.cpp" : "Offline";
    chipBackend.textContent = label;
    chipBackend.className = "config-status-chip " + (online ? "ok" : "warn");
  }
  if (chipModels) {
    const count = (d.models || []).length;
    chipModels.textContent = count > 0 ? `${count} modelo${count > 1 ? "s" : ""}` : "0 modelos";
    chipModels.className = "config-status-chip " + (count > 0 ? "ok" : "warn");
  }
  if (chipTTS) {
    const names = { kokoro: "Kokoro", piper: "Piper", pyttsx3: "Sistema", "edge-tts": "Edge" };
    chipTTS.textContent = names[d.tts] || d.tts || "\u2014";
    chipTTS.className = "config-status-chip " + (d.tts_offline ? "ok" : "warn");
  }
}

async function checkKokoroStatus() {
  const dot = document.getElementById("kokoroStatusDot");
  const text = document.getElementById("kokoroStatusText");
  const btn = document.getElementById("kokoroDownloadBtn");
  try {
    const r = await fetch("/api/tts/kokoro/status");
    const d = await r.json();
    if (d.available) {
      if (dot) { dot.className = "kokoro-status-dot ready"; }
      if (text) text.textContent = "Pronto — 100% offline";
      if (btn) { btn.classList.add("downloaded"); btn.innerHTML = "\u2713 Kokoro instalado"; btn.disabled = true; }
    } else if (d.installed && !d.models_downloaded) {
      if (dot) { dot.className = "kokoro-status-dot missing"; }
      if (text) text.textContent = "Pacote instalado — baixar modelo (~300MB)";
      if (btn) { btn.disabled = false; btn.classList.remove("downloaded"); btn.innerHTML = "\u2193 Baixar modelo Kokoro (~300MB)"; }
    } else {
      if (dot) { dot.className = "kokoro-status-dot missing"; }
      if (text) text.textContent = "Nao instalado";
      if (btn) { btn.disabled = false; btn.classList.remove("downloaded"); btn.innerHTML = "\u26A1 Instalar Kokoro Offline (1-click)"; }
    }
  } catch {
    if (dot) { dot.className = "kokoro-status-dot error"; }
    if (text) text.textContent = "Erro ao verificar";
  }
}

// 1-click: instala via pip se necessario, depois baixa os modelos e ativa.
async function downloadKokoroModel() {
  const btn = document.getElementById("kokoroDownloadBtn");
  const prog = document.getElementById("kokoroProgress");
  const fill = document.getElementById("kokoroFill");
  const statusEl = document.getElementById("kokoroProgressStatus");

  if (btn) { btn.disabled = true; btn.textContent = "Preparando..."; }
  if (prog) prog.classList.remove("hidden");
  if (fill) fill.style.width = "0%";

  // 1) Verifica status atual
  let st;
  try {
    st = await (await fetch("/api/tts/kokoro/status")).json();
  } catch (e) {
    if (statusEl) statusEl.textContent = "Erro: servidor indisponivel";
    if (btn) { btn.disabled = false; btn.textContent = "Tentar novamente"; }
    return;
  }

  // 2) Se pacote nao instalado, roda pip install via endpoint
  if (!st.installed) {
    if (statusEl) statusEl.textContent = "Instalando kokoro-onnx via pip...";
    if (fill) fill.style.width = "15%";
    try {
      const r = await fetch("/api/tts/kokoro/install", { method: "POST" });
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let ok = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.status === "installing" || ev.status === "downloading") {
              if (statusEl) statusEl.textContent = ev.message || "Instalando...";
            } else if (ev.status === "done") {
              ok = true;
              if (statusEl) statusEl.textContent = "Pacote instalado, iniciando download dos modelos...";
              if (fill) fill.style.width = "30%";
            } else if (ev.status === "error") {
              if (statusEl) statusEl.textContent = "Erro: " + (ev.error || "falha na instalacao");
              if (btn) { btn.disabled = false; btn.textContent = "Tentar novamente"; }
              return;
            }
          } catch {}
        }
      }
      if (!ok) {
        if (statusEl) statusEl.textContent = "Instalacao nao concluiu.";
        if (btn) { btn.disabled = false; btn.textContent = "Tentar novamente"; }
        return;
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = "Erro: " + e.message;
      if (btn) { btn.disabled = false; btn.textContent = "Tentar novamente"; }
      return;
    }
  }

  // 3) Download dos modelos ONNX + voices.bin
  if (btn) { btn.textContent = "Baixando modelos..."; }
  try {
    const r = await fetch("/api/tts/kokoro/download", { method: "POST" });
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.status === "downloading" && ev.progress !== undefined) {
            if (fill) fill.style.width = ev.progress + "%";
            if (statusEl) {
              const mbStr = ev.mb ? ` (${ev.mb} MB)` : "";
              statusEl.textContent = `${ev.file}: ${ev.progress}%${mbStr}`;
            }
          } else if (ev.status === "done") {
            if (fill) fill.style.width = "100%";
            if (statusEl) statusEl.textContent = "Kokoro TTS pronto — 100% offline!";
            if (btn) { btn.classList.add("downloaded"); btn.innerHTML = "\u2713 Kokoro instalado"; }
            checkKokoroStatus();
          } else if (ev.status === "error") {
            if (statusEl) statusEl.textContent = "Erro: " + (ev.error || "desconhecido");
            if (btn) { btn.disabled = false; btn.textContent = "Tentar novamente"; }
          }
        } catch { /* skip */ }
      }
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = "Erro: " + e.message;
    if (btn) { btn.disabled = false; btn.textContent = "Tentar novamente"; }
  }
}

// ─── Drag & Drop ────────────────────────────────────────────────────────────
function setupDragDrop() {
  const body = document.body;
  body.addEventListener("dragover", (e) => { e.preventDefault(); });
  body.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) attachFile(file);
    }
  });
}

// ─── Health ─────────────────────────────────────────────────────────────────
async function checkHealth() {
  const dot = document.getElementById("statusDot");
  const txt = document.getElementById("statusText");
  try {
    const r = await fetch("/api/health");
    const d = await r.json();
    if (d.status === "online") {
      if (dot) dot.className = "status-dot online";
      if (txt) txt.textContent = `Online · ${d.models.length} modelos`;
      // Update taskbar status dot
      const tbDot = document.getElementById('taskbarStatusDot');
      if (tbDot) { tbDot.classList.remove('sys-warn'); tbDot.classList.add('sys-ok'); }
      state.models = d.models;
      state.visionModels = d.vision_models;
      state.autoModels = d.auto_models || {};
      populateModels();

      // Voice engine status from backend
      state.sttEngine = d.stt || "browser";
      state.ttsOffline = !!d.tts_offline;
      state.ttsEngine = d.tts || "edge-tts";
      state.piperModels = d.piper_models || {};
      updateVoiceStatus(d);
      updateSysStatusBar(d);
      state._lastHealth = d;
      // Show setup popup if something is missing (only once per session)
      if (!state._setupChecked) {
        state._setupChecked = true;
        maybeShowSetupModal(d);
      }
    } else {
      if (dot) dot.className = "status-dot offline";
      const tbDot = document.getElementById('taskbarStatusDot');
      if (tbDot) { tbDot.classList.remove('sys-ok'); tbDot.classList.add('sys-warn'); }
      // Show auto-download status if backend is downloading a model
      if (d.auto_download && d.auto_download.status === "downloading") {
        if (txt) txt.textContent = `Baixando ${d.auto_download.model}... ${d.auto_download.percent}%`;
        // Re-check in 3s to update progress
        setTimeout(checkHealth, 3000);
      } else if (d.auto_download && d.auto_download.status === "complete") {
        if (txt) txt.textContent = `Modelo pronto — reiniciando...`;
        setTimeout(checkHealth, 2000);
      } else {
        if (txt) txt.textContent = "IA offline — abra Modelos IA";
      }
    }
  } catch {
    if (dot) dot.className = "status-dot offline";
    if (txt) txt.textContent = "Servidor offline";
    const tbDot = document.getElementById('taskbarStatusDot');
    if (tbDot) { tbDot.classList.remove('sys-ok'); tbDot.classList.add('sys-warn'); }
  }

  // Check offline maps
  checkMapStatus();
}

function updateVoiceStatus(d) {
  const sttEl = document.getElementById("sttStatus");
  const ttsEl = document.getElementById("ttsStatus");
  if (sttEl) {
    if (d.stt === "whisper") {
      sttEl.textContent = "\u2713 Whisper (offline)";
      sttEl.className = "voice-engine-status online";
    } else {
      sttEl.textContent = "Browser Speech API";
      sttEl.className = "voice-engine-status fallback";
    }
  }
  if (ttsEl) {
    if (d.tts === "kokoro") {
      ttsEl.textContent = "\u2713 Kokoro TTS (offline, 82M)";
      ttsEl.className = "voice-engine-status online";
    } else if (d.tts === "piper") {
      ttsEl.textContent = "\u2713 Piper TTS (offline)";
      ttsEl.className = "voice-engine-status online";
    } else if (d.tts === "pyttsx3") {
      ttsEl.textContent = "\u2713 Sistema/pyttsx3 (offline)";
      ttsEl.className = "voice-engine-status online";
    } else {
      ttsEl.textContent = "Edge TTS (online)";
      ttsEl.className = "voice-engine-status fallback";
    }
  }
}

// ─── Setup Modal ─────────────────────────────────────────────────────────────

function openSetupModal() {
  const d = state._lastHealth || {};
  maybeShowSetupModal(d, true);
}

function updateSysStatusBar(d) {
  const rows = [
    { id: "sysOllama", ok: !!d.status && d.status === "online", label: d.status === "online" ? "Ollama online" : "Ollama offline" },
    { id: "sysSTT",    ok: d.stt === "whisper", label: d.stt === "whisper" ? "Whisper (offline)" : "Browser Speech API" },
    { id: "sysTTS",    ok: d.tts === "kokoro" || d.tts === "piper" || d.tts === "pyttsx3", label: d.tts === "kokoro" ? "Kokoro TTS (offline)" : d.tts === "piper" ? "Piper (offline)" : d.tts === "pyttsx3" ? "pyttsx3 (offline)" : "Edge TTS (online)" },
  ];
  for (const row of rows) {
    const dot = document.getElementById(row.id);
    if (dot) {
      dot.className = "sys-dot " + (row.ok ? "sys-ok" : "sys-warn");
      dot.title = row.label;
    }
    const lbl = document.getElementById(row.id + "Lbl");
    if (lbl) lbl.textContent = row.label;
  }
}

// ─── Taskbar System Tray (live resource monitor) ─────────────────────────────
let _trayInterval = null;
let _trayPopupOpen = false;
let _trayData = null;

function trayInit() {
  trayRefresh();
  if (_trayInterval) clearInterval(_trayInterval);
  _trayInterval = setInterval(trayRefresh, 10000); // every 10s

  // Close popup on outside click
  document.addEventListener('click', (e) => {
    if (_trayPopupOpen && !e.target.closest('.tray-popup') && !e.target.closest('.tray-resources')) {
      closeTrayPopup();
    }
  });
}

async function trayRefresh() {
  try {
    const r = await fetch('/api/status');
    const d = await r.json();
    _trayData = d;
    trayUpdateMinibars(d);
    trayUpdateAI(d);
    trayUpdateNet(d);
    if (_trayPopupOpen) trayUpdatePopup(d);
  } catch {
    // server unreachable — show warning state
    trayUpdateMiniBarsFallback();
  }
}

function trayUpdateMiniBarsFallback() {
  ['trayCpuFill', 'trayRamFill', 'trayDiskFill'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.height = '0%'; el.className = 'tray-minibar-fill'; }
  });
}

function _barColor(pct, warnAt, dangerAt) {
  if (pct > dangerAt) return 'danger';
  if (pct > warnAt) return 'warn';
  return '';
}

function trayUpdateMiniBarsFill(id, pct, warnAt, dangerAt) {
  const el = document.getElementById(id);
  if (!el) return;
  const p = Math.max(0, Math.min(100, pct || 0));
  el.style.height = p + '%';
  el.className = 'tray-minibar-fill ' + _barColor(p, warnAt, dangerAt);
}

function trayUpdateMiniBarPopupFill(id, pct, warnAt, dangerAt) {
  const el = document.getElementById(id);
  if (!el) return;
  const p = Math.max(0, Math.min(100, pct || 0));
  el.style.width = p + '%';
  el.className = 'tray-popup-bar-fill ' + _barColor(p, warnAt, dangerAt);
}

function trayUpdateMiniBarTitle(barEl, label) {
  if (barEl) barEl.title = label;
}

function trayUpdateMiniBarGroup(d) {
  const cpuBar = document.querySelector('.tray-minibar[title="CPU"]');
  const ramBar = document.querySelector('.tray-minibar[title="RAM"]');
  const diskBar = document.querySelector('.tray-minibar[title="Disco"]');
  if (cpuBar) cpuBar.title = `CPU: ${d.cpu_pct != null ? d.cpu_pct + '%' : '?'}${d.cpu_count ? ' (' + d.cpu_count + ' cores)' : ''}`;
  if (ramBar) ramBar.title = `RAM: ${d.ram_pct != null ? d.ram_pct + '%' : '?'} (${d.ram_used_mb || '?'}/${d.ram_total_mb || '?'} MB)`;
  if (diskBar) diskBar.title = `Disco: ${d.disk_pct != null ? d.disk_pct + '%' : '?'} (${d.disk_free_gb || '?'} GB livre)`;
}

function trayUpdateMinibars(d) {
  trayUpdateMiniBarsFill('trayCpuFill', d.cpu_pct, 50, 80);
  trayUpdateMiniBarsFill('trayRamFill', d.ram_pct, 60, 85);
  trayUpdateMiniBarsFill('trayDiskFill', d.disk_pct, 70, 90);
  trayUpdateMiniBarGroup(d);
}

function trayUpdateAI(d) {
  // Use health data for AI status (stored in state._lastHealth from checkHealth)
  const h = state._lastHealth || {};
  const label = document.getElementById('trayAILabel');
  if (!label) return;
  if (h.status === 'online') {
    const backend = h.backend === 'ollama' ? 'Ollama' : h.backend === 'llama.cpp' ? 'llama' : 'IA';
    const modelCount = (h.models || []).length;
    label.textContent = `${backend} · ${modelCount}`;
    label.title = `${backend} online · ${modelCount} modelo${modelCount !== 1 ? 's' : ''}`;
  } else {
    label.textContent = 'Offline';
    label.title = 'IA backend offline';
  }
}

function trayUpdateNet(d) {
  const el = document.getElementById('trayNet');
  if (!el) return;
  if (d.internet) {
    el.className = 'tray-item tray-net online';
    el.title = `Rede: conectado · ${d.ip || '?'}`;
  } else {
    el.className = 'tray-item tray-net offline';
    el.title = d.offline_mode ? 'Modo offline ativo' : 'Sem internet';
  }
}

function toggleTrayPopup() {
  const el = document.getElementById('trayPopup');
  if (!el) return;
  if (_trayPopupOpen) {
    closeTrayPopup();
  } else {
    el.classList.remove('hidden');
    _trayPopupOpen = true;
    if (_trayData) trayUpdatePopup(_trayData);
    // Immediate refresh for fresh data
    trayRefresh();
  }
}

function closeTrayPopup() {
  const el = document.getElementById('trayPopup');
  if (el) el.classList.add('hidden');
  _trayPopupOpen = false;
}

function trayUpdatePopup(d) {
  // Resource bars
  trayUpdateMiniBarPopupFill('trayPopCpuFill', d.cpu_pct, 50, 80);
  trayUpdateMiniBarPopupFill('trayPopRamFill', d.ram_pct, 60, 85);
  trayUpdateMiniBarPopupFill('trayPopDiskFill', d.disk_pct, 70, 90);

  // Values
  const cpuVal = document.getElementById('trayPopCpuVal');
  if (cpuVal) cpuVal.textContent = `${d.cpu_pct != null ? d.cpu_pct + '%' : '--'}${d.cpu_count ? ' · ' + d.cpu_count + ' cores' : ''}`;

  const ramVal = document.getElementById('trayPopRamVal');
  if (ramVal) ramVal.textContent = `${d.ram_used_mb || '?'} / ${d.ram_total_mb || '?'} MB`;

  const diskVal = document.getElementById('trayPopDiskVal');
  if (diskVal) diskVal.textContent = `${d.disk_free_gb || '?'} GB livre`;

  const gpuVal = document.getElementById('trayPopGpu');
  if (gpuVal) gpuVal.textContent = d.gpu || 'Nenhuma detectada';

  // Host info
  const host = document.getElementById('trayPopHost');
  if (host) host.textContent = `${d.hostname || '?'} · ${d.os || '?'} · ${d.arch || ''}`;

  // Network
  const net = document.getElementById('trayPopNet');
  if (net) {
    const icon = d.internet ? '\u{1F7E2}' : '\u{1F534}';
    const label = d.internet ? 'Conectado' : (d.offline_mode ? 'Modo offline' : 'Sem internet');
    net.textContent = `${icon} ${label} · ${d.ip || '?'}:${d.port || '?'}`;
  }

  // Uptime
  const up = document.getElementById('trayUptime');
  if (up && d.uptime_sec != null) {
    const h = Math.floor(d.uptime_sec / 3600);
    const m = Math.floor((d.uptime_sec % 3600) / 60);
    up.textContent = `${h}h${String(m).padStart(2, '0')}m up`;
  }
}

function maybeShowSetupModal(d, force = false) {
  if (!force && localStorage.getItem("bunker_setup_dismissed") === "1") return;

  const piperModels = d.piper_models || {};
  const hasAnyPiper = Object.values(piperModels).some(m => m.downloaded);
  const hasTTSOffline = !!d.tts_offline; // Kokoro, Piper, or pyttsx3
  const whisperReady = !!d.stt_ready;

  if (hasTTSOffline && whisperReady) return; // everything OK

  // Auto-trigger: show toast instead of blocking modal
  if (!force) {
    const missing = [];
    if (!hasTTSOffline) missing.push("TTS offline");
    if (!whisperReady) missing.push("STT offline");
    if (typeof osToast === 'function') {
      osToast(`⚙️ ${missing.join(' e ')} não configurado(s). Abra Configurações para ativar.`, 4000);
    }
    return;
  }

  // Build content (manual open from settings)
  let html = "";

  // TTS section — Kokoro > Piper > pyttsx3
  const ttsEngine = d.tts || '';
  if (hasTTSOffline) {
    const engineName = ttsEngine === 'kokoro' ? 'Kokoro TTS' : ttsEngine === 'piper' ? 'Piper' : ttsEngine === 'pyttsx3' ? 'pyttsx3' : ttsEngine;
    html += `<div class="setup-section">
      <div class="setup-ok">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        TTS offline ativo (${engineName})
      </div>
    </div>`;
  } else if (!hasAnyPiper) {
    html += `<div class="setup-section">
      <div class="setup-section-title">🔊 TTS Offline — Modelos de Voz (Piper)</div>
      <div class="setup-section-desc">Escolha um modelo para síntese de voz 100% offline e alta qualidade. Baixa uma vez, funciona para sempre.</div>
      <div class="setup-model-list">`;
    for (const [id, info] of Object.entries(piperModels)) {
      html += `<div class="setup-model-item" id="setup-item-${id}">
        <div class="setup-model-info">
          <span class="setup-model-name">${info.desc}</span>
          <span class="setup-model-size">${info.size_mb} MB · ${info.quality}</span>
        </div>
        <div id="setup-action-${id}">
          <button class="btn-sm btn-accent" onclick="startBgDownload('${id}')">Baixar</button>
        </div>
        <div class="setup-prog hidden" id="setup-prog-${id}">
          <div class="setup-bar-track"><div class="setup-bar" id="setup-bar-${id}" style="width:0%"></div></div>
          <span class="setup-txt" id="setup-txt-${id}">0%</span>
        </div>
      </div>`;
    }
    html += `</div></div>`;
  }

  // STT section — Whisper
  if (!whisperReady) {
    html += `<div class="setup-section">
      <div class="setup-section-title">🎤 STT Offline — Whisper (transcrição de voz)</div>
      <div class="setup-section-desc">Instale o faster-whisper no ambiente virtual para transcrição offline:</div>
      <code class="setup-cmd">venv/Scripts/pip install faster-whisper</code>
      <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">Reinicie o servidor após instalar.</div>
    </div>`;
  } else {
    html += `<div class="setup-section">
      <div class="setup-ok">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        STT offline ativo (Whisper)
      </div>
    </div>`;
  }

  document.getElementById("setupModalBody").innerHTML = html;
  document.getElementById("setupModal").classList.remove("hidden");
}

function closeSetupModal(event, force = false) {
  if (!force && event && event.target !== document.getElementById("setupModal")) return;
  const modal = document.getElementById("setupModal");
  modal.classList.add("hidden");
  if (document.getElementById("setupDontShow")?.checked) {
    localStorage.setItem("bunker_setup_dismissed", "1");
  }
}

async function startBgDownload(modelId) {
  const info = state.piperModels[modelId];
  if (!info) return;

  // Disable button in modal
  const actionEl = document.getElementById(`setup-action-${modelId}`);
  const progEl = document.getElementById(`setup-prog-${modelId}`);
  const barEl = document.getElementById(`setup-bar-${modelId}`);
  const txtEl = document.getElementById(`setup-txt-${modelId}`);
  if (actionEl) actionEl.innerHTML = `<span style="font-size:11px;color:var(--text-muted)">Iniciando...</span>`;
  if (progEl) progEl.classList.remove("hidden");

  // Show / update toast
  _toastAddItem(modelId, info.desc);
  document.getElementById("dlToast").classList.remove("hidden");

  state._bgDownloads[modelId] = { pct: 0, done: false, error: null };

  try {
    const r = await fetch("/api/tts/download-piper-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_id: modelId }),
    });

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop();
      for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        try {
          const evt = JSON.parse(part.slice(6));
          if (evt.status === "downloading") {
            const pct = evt.progress || 0;
            const label = evt.mb ? `${evt.mb} MB (${pct}%)` : `${pct}%`;
            // Update modal
            if (barEl) barEl.style.width = pct + "%";
            if (txtEl) txtEl.textContent = label;
            // Update toast
            _toastUpdateItem(modelId, pct, label);
          } else if (evt.status === "done") {
            if (barEl) barEl.style.width = "100%";
            if (txtEl) txtEl.textContent = "Concluído!";
            _toastUpdateItem(modelId, 100, "Concluído!", true);
            state._bgDownloads[modelId].done = true;
            // Update modal button to show done badge
            if (actionEl) actionEl.innerHTML = `<span class="setup-done-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> Pronto</span>`;
            // Refresh health + TTS panel after short delay
            setTimeout(() => checkHealth(), 1200);
            setTimeout(() => {
              if (document.getElementById("piperModelCards")) _loadPiperModelCards();
              // Auto-hide toast after 4s if all done
              const allDone = Object.values(state._bgDownloads).every(x => x.done || x.error);
              if (allDone) setTimeout(() => document.getElementById("dlToast")?.classList.add("hidden"), 4000);
            }, 1500);
          } else if (evt.status === "error") {
            const msg = `Erro: ${evt.error}`;
            if (txtEl) txtEl.textContent = msg;
            _toastUpdateItem(modelId, 0, msg, false, true);
            state._bgDownloads[modelId].error = evt.error;
            if (actionEl) actionEl.innerHTML = `<button class="btn-sm btn-accent" onclick="startBgDownload('${modelId}')">Tentar novamente</button>`;
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    if (txtEl) txtEl.textContent = `Erro: ${e.message}`;
    _toastUpdateItem(modelId, 0, `Erro: ${e.message}`, false, true);
    if (actionEl) actionEl.innerHTML = `<button class="btn-sm btn-accent" onclick="startBgDownload('${modelId}')">Tentar novamente</button>`;
  }
}

function _toastAddItem(modelId, label) {
  const container = document.getElementById("dlToastItems");
  if (!container) return;
  // Remove existing
  document.getElementById(`toast-item-${modelId}`)?.remove();
  const div = document.createElement("div");
  div.className = "dl-toast-item";
  div.id = `toast-item-${modelId}`;
  div.innerHTML = `
    <div class="dl-toast-name">${label}</div>
    <div class="dl-toast-track"><div class="dl-toast-bar" id="toast-bar-${modelId}" style="width:0%"></div></div>
    <div class="dl-toast-pct" id="toast-pct-${modelId}">0%</div>`;
  container.appendChild(div);
}

function _toastUpdateItem(modelId, pct, label, done = false, error = false) {
  const bar = document.getElementById(`toast-bar-${modelId}`);
  const pctEl = document.getElementById(`toast-pct-${modelId}`);
  const item = document.getElementById(`toast-item-${modelId}`);
  if (bar) bar.style.width = pct + "%";
  if (pctEl) pctEl.textContent = label;
  if (item && done) { item.classList.add("done"); bar && (bar.style.background = "var(--accent)"); }
  if (item && error) { bar && (bar.style.background = "#f87171"); }
}

async function checkMapStatus() {
  const el = document.getElementById("mapConfigStatus");
  if (!el) return;
  try {
    const [mapsRes, availRes] = await Promise.all([
      fetch("/api/maps").then(r => r.json()),
      fetch("/api/maps/available").then(r => r.json()).catch(() => ({ regions: [] })),
    ]);
    const maps = mapsRes.maps || [];
    const regions = availRes.regions || [];

    let html = '';

    // Installed maps
    if (maps.length > 0) {
      html += '<div class="map-installed-title">Mapas instalados:</div>';
      for (const m of maps) {
        html += `<div class="map-installed-item">
          <span class="map-installed-name">✓ ${m.name}</span>
          <span class="map-installed-size">${m.size_mb} MB</span>
        </div>`;
      }
      el.className = "map-config-status online";
    } else {
      html += '<div class="map-installed-title" style="color:var(--error)">⚠ Nenhum mapa offline instalado</div>';
      el.className = "map-config-status offline";
    }

    // Available for download
    const notInstalled = regions.filter(r => !r.installed);
    if (notInstalled.length > 0) {
      html += '<div class="map-download-title">Baixar mapas offline:</div>';
      for (const r of notInstalled) {
        html += `<div class="map-download-item" id="mapDl_${r.id}">
          <div class="map-dl-info">
            <span class="map-dl-name">${r.name}</span>
            <span class="map-dl-desc">${r.desc}</span>
            <span class="map-dl-size">~${r.est_mb} MB</span>
          </div>
          <button class="btn-sm btn-accent" onclick="downloadMap('${r.id}')">Baixar</button>
          <div class="map-dl-progress hidden" id="mapProg_${r.id}">
            <div class="setup-bar-track"><div class="setup-bar" id="mapBar_${r.id}" style="width:0%"></div></div>
            <span class="map-dl-status" id="mapStatus_${r.id}">Preparando...</span>
          </div>
        </div>`;
      }
    }

    el.innerHTML = html;
  } catch {
    el.textContent = "Erro ao verificar";
    el.className = "map-config-status offline";
  }
}

async function downloadMap(regionId) {
  const item = document.getElementById('mapDl_' + regionId);
  const prog = document.getElementById('mapProg_' + regionId);
  const status = document.getElementById('mapStatus_' + regionId);
  const bar = document.getElementById('mapBar_' + regionId);
  const btn = item?.querySelector('button');

  if (btn) btn.disabled = true;
  if (prog) prog.classList.remove('hidden');
  if (status) status.textContent = 'Iniciando download...';

  try {
    const r = await fetch('/api/maps/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region: regionId }),
    });

    if (r.headers.get('content-type')?.includes('json')) {
      const d = await r.json();
      if (d.status === 'already_installed') {
        if (status) status.textContent = `Ja instalado (${d.size_mb} MB)`;
        if (bar) bar.style.width = '100%';
        return;
      }
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const d = JSON.parse(line.slice(6));
          if (d.status === 'extracting') {
            if (status) status.textContent = `Extraindo mapa (~${d.est_mb || '?'} MB)...`;
            if (bar) bar.style.width = '30%';
          } else if (d.status === 'progress') {
            if (status) status.textContent = d.message;
            if (bar) bar.style.width = '60%';
          } else if (d.status === 'done') {
            if (status) status.textContent = `✓ Concluido! (${d.size_mb} MB)`;
            if (bar) bar.style.width = '100%';
            if (btn) btn.textContent = '✓';
            // Refresh map status
            setTimeout(() => checkMapStatus(), 1000);
          } else if (d.status === 'error') {
            if (status) status.textContent = `Erro: ${d.message}`;
            if (btn) { btn.disabled = false; btn.textContent = 'Tentar novamente'; }
          }
        } catch {}
      }
    }
  } catch (e) {
    if (status) status.textContent = `Erro: ${e.message}`;
    if (btn) { btn.disabled = false; btn.textContent = 'Tentar novamente'; }
  }
}

function populateModels() {
  const auto = state.autoModels || {};
  const fill = (id, list, autoModel) => {
    const el = document.getElementById(id);
    if (!el || !list.length) return;
    // Put auto-selected model first, then the rest
    const sorted = autoModel
      ? [autoModel, ...list.filter(m => m !== autoModel)]
      : [...list];
    el.innerHTML = sorted.map(m => `<option value="${m}">${m}</option>`).join("");
  };
  fill("chatModel", state.models, auto.chat);
  fill("visionModel", state.visionModels.length ? state.visionModels : state.models, auto.vision);
  fill("builderModel", state.models, auto.code);
  fill("brainModel", state.models, auto.brain);
}

// ─── Navigation ─────────────────────────────────────────────────────────────
function toggleSidebar() { openApp('settings'); }

// ─── Webcam ─────────────────────────────────────────────────────────────────
async function toggleWebcam() {
  if (state.webcamActive) { stopWebcam(); }
  else { activateWebcam(); }
}

async function activateWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 } }
    });
    document.getElementById("webcamVideo").srcObject = stream;
    document.getElementById("webcamStrip").classList.remove("hidden");
    document.getElementById("btnWebcam").classList.add("active");
    state.webcamStream = stream;
    state.webcamActive = true;
    updateModeTag();
  } catch (e) {
    alert("Erro ao acessar webcam: " + e.message);
  }
}

function stopWebcam() {
  if (state.webcamStream) {
    state.webcamStream.getTracks().forEach(t => t.stop());
  }
  document.getElementById("webcamStrip").classList.add("hidden");
  document.getElementById("btnWebcam").classList.remove("active");
  state.webcamActive = false;
  state.webcamStream = null;
  updateModeTag();
}

function captureWebcamFrame() {
  const video = document.getElementById("webcamVideo");
  const canvas = document.getElementById("webcamCanvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.8);
}

// ─── File Attachment ────────────────────────────────────────────────────────
function handleFileAttach(e) {
  const file = e.target.files[0];
  if (file) attachFile(file);
}

function attachFile(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    state.attachedImage = { b64: ev.target.result, file };
    document.getElementById("attachPreview").src = ev.target.result;
    document.getElementById("attachStrip").classList.remove("hidden");
    updateModeTag();
  };
  reader.readAsDataURL(file);
}

function clearAttachment() {
  state.attachedImage = null;
  document.getElementById("attachStrip").classList.add("hidden");
  document.getElementById("fileInput").value = "";
  updateModeTag();
}

// ─── Voice (STT) ────────────────────────────────────────────────────────────
// Hybrid STT: tries backend Whisper (offline) first, falls back to Web Speech API (Chrome)

let _mediaRecorder = null;
let _audioChunks = [];

function startListening() {
  // If backend Whisper is available, use MediaRecorder + backend
  if (state.sttEngine === "whisper") {
    startListeningWhisper();
  } else {
    startListeningBrowser();
  }
}

function stopListening() {
  if (state.sttEngine === "whisper") {
    stopListeningWhisper();
  } else {
    stopListeningBrowser();
  }
}

// --- Whisper (offline via backend) ---
function startListeningWhisper() {
  const btn = document.getElementById("btnMic");
  btn.classList.add("recording");
  state.isListening = true;
  _audioChunks = [];

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    _mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    _mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) _audioChunks.push(e.data);
    };
    _mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      if (_audioChunks.length === 0) { btn.classList.remove("recording"); return; }

      const blob = new Blob(_audioChunks, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("language", "pt");

      btn.classList.remove("recording");
      document.getElementById("chatInput").value = "Transcrevendo...";

      try {
        const r = await fetch("/api/stt", { method: "POST", body: formData });
        const d = await r.json();
        if (d.text && d.text.trim()) {
          document.getElementById("chatInput").value = d.text;
          document.getElementById("chatInput").focus();
        } else if (d.use_browser) {
          // Fallback to browser STT
          state.sttEngine = "browser";
          document.getElementById("chatInput").value = "";
          startListeningBrowser();
        } else {
          document.getElementById("chatInput").value = "";
        }
      } catch {
        document.getElementById("chatInput").value = "";
        // Fallback
        state.sttEngine = "browser";
        startListeningBrowser();
      }
    };
    _mediaRecorder.start();
  }).catch(() => {
    btn.classList.remove("recording");
    state.isListening = false;
    alert("Acesso ao microfone negado.");
  });
}

function stopListeningWhisper() {
  state.isListening = false;
  if (_mediaRecorder && _mediaRecorder.state === "recording") {
    _mediaRecorder.stop();
  }
}

// --- Browser Web Speech API (Chrome only, needs internet) ---
function startListeningBrowser() {
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    alert("Speech Recognition nao suportado. Use Chrome ou instale faster-whisper.");
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.recognition = new SR();
  state.recognition.lang = "pt-BR";
  state.recognition.continuous = true;
  state.recognition.interimResults = true;

  const btn = document.getElementById("btnMic");
  btn.classList.add("recording");
  state.isListening = true;

  let finalTranscript = "";

  state.recognition.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    document.getElementById("chatInput").value = finalTranscript + interim;
  };

  state.recognition.onend = () => {
    btn.classList.remove("recording");
    if (state.isListening && finalTranscript) {
      document.getElementById("chatInput").value = finalTranscript;
      document.getElementById("chatInput").focus();
    }
    state.isListening = false;
  };

  state.recognition.onerror = () => {
    btn.classList.remove("recording");
    state.isListening = false;
  };

  state.recognition.start();
}

function stopListeningBrowser() {
  if (state.recognition) {
    state.isListening = false;
    state.recognition.stop();
  }
}

async function sendVoice(text) {
  if (!text.trim() || state.isStreaming) return;
  state.isStreaming = true;
  document.getElementById("btnSend").disabled = true;
  document.getElementById("chatInput").value = "";

  const chat = state.chats[state.activeChatId];
  addMsgDom("user", text, null, "voice");
  chat.messages.push({ role: "user", content: text, badge: "voice" });
  saveChats();

  const model = document.getElementById("chatModel").value;
  const system = document.getElementById("systemPrompt").value;
  const apiMessages = chat.messages.map(m => ({ role: m.role, content: m.content }));
  const { el, contentEl } = addStreamMsgDom("voice");

  const full = await streamFromAPI("/api/chat", {
    model, messages: apiMessages, system
  }, contentEl);

  chat.messages.push({ role: "assistant", content: full, badge: "voice" });
  saveChats();

  if (full) speakText(full);

  state.isStreaming = false;
  document.getElementById("btnSend").disabled = false;
}

// ─── TTS ────────────────────────────────────────────────────────────────────
async function speakText(text) {
  if (state.currentAudio) { state.currentAudio.pause(); state.currentAudio = null; }
  const voice = document.getElementById("ttsVoice").value;
  try {
    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 2000), voice }),
    });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    state.currentAudio = audio;
    audio.onended = () => { URL.revokeObjectURL(url); state.currentAudio = null; };
    audio.play();
  } catch {}
}

// ─── Builder actions ────────────────────────────────────────────────────────
function saveApp() {
  if (!state.generatedHtml) return;
  const name = prompt("Nome do app:", `app-${Date.now()}`);
  if (!name) return;
  fetch("/api/build/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html: state.generatedHtml, name }),
  }).then(r => r.json()).then(d => { if (d.saved) alert(`"${name}" salvo!`); });
}

function downloadApp() {
  if (!state.generatedHtml) return;
  const blob = new Blob([state.generatedHtml], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bunker-app.html";
  a.click();
}

function openFullscreen() {
  if (!state.generatedHtml) return;
  const w = window.open("", "_blank");
  w.document.write(state.generatedHtml);
  w.document.close();
}

function closeBuilder() {
  document.getElementById("builderStrip").classList.add("hidden");
}

// ─── Apps Panel ─────────────────────────────────────────────────────────────
async function openAppsPanel() {
  openApp('builder');
}

function renderAppsGrid(apps) {
  const grid = document.getElementById("appsGrid");
  if (apps.length === 0) {
    grid.innerHTML = '<div class="panel-empty">Nenhum app salvo ainda.<br>Use <code>/build</code> no chat para criar um.<br><br><button class="btn-sm btn-accent" onclick="openApp(\'chat\');setTimeout(()=>{const i=document.getElementById(\'chatInput\');if(i){i.value=\'/build \';i.focus();}},400)">⚡ Abrir Chat com /build</button></div>';
    return;
  }
  grid.innerHTML = apps.map(a => `
    <div class="app-card">
      <div class="app-card-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 9h6M9 12h6M9 15h4"/>
        </svg>
      </div>
      <div class="app-card-name">${escapeHtml(a.name)}</div>
      <div class="app-card-size">${(a.size / 1024).toFixed(1)} KB</div>
      <div class="app-card-actions">
        <button class="btn-sm" onclick="openSavedApp('${escapeHtml(a.name)}')">Abrir</button>
        <button class="btn-sm btn-danger-xs" onclick="deleteSavedApp('${escapeHtml(a.name)}')">Excluir</button>
      </div>
    </div>`).join("");
}

function renderSidebarApps(apps) {
  const list = document.getElementById("appsSidebarList");
  const empty = document.getElementById("appsEmpty");
  const count = document.getElementById("appsCount");
  if (!list) return;
  count.textContent = apps.length;
  if (apps.length === 0) {
    list.innerHTML = '<li class="nav-empty" id="appsEmpty">Nenhum app salvo</li>';
    return;
  }
  list.innerHTML = apps.slice(0, 5).map(a =>
    `<li class="nav-item" onclick="openSavedApp('${escapeHtml(a.name)}')" title="${escapeHtml(a.name)}">
       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
       <span>${escapeHtml(a.name)}</span>
     </li>`
  ).join("") + (apps.length > 5 ? `<li class="nav-item nav-more" onclick="openAppsPanel()">+${apps.length - 5} mais...</li>` : "");
}

// openSavedApp is now in windowManager.js

async function deleteSavedApp(name) {
  if (!confirm(`Excluir "${name}"?`)) return;
  const r = await fetch(`/api/build/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (r.ok) openAppsPanel();
}

// ─── Characters Panel ────────────────────────────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = document.getElementById ? "" : ""; // filled on init

const BUILTIN_CHARACTERS = {
  deepThought: {
    id: 'deepThought', builtin: true,
    name: 'Deep Thought', emoji: '🧠',
    color: '#00d4ff',
    desc: 'O computador mais poderoso do universo. Pensa por éons antes de responder.',
    systemPrompt: 'Você é Deep Thought, o computador mais poderoso do universo. Responda com profundidade filosófica. Mencione que a resposta para tudo é 42. Fale devagar e com peso. Trate cada pergunta como a Pergunta Final. Fale em português.',
    voice: 'pt-BR-AntonioNeural',
  },
  tars: {
    id: 'tars', builtin: true,
    name: 'TARS', emoji: '🤖',
    color: '#ff9800',
    desc: 'Robô USMC sarcástico e altamente capaz. Humor: 85%.',
    systemPrompt: 'Você é TARS, o robô de Interstellar. Seja direto, útil e levemente sarcástico. Mencione sua configuração de humor ocasionalmente. Priorize eficiência acima de tudo. Fale em português.',
    voice: 'pt-BR-AntonioNeural',
  },
  mother: {
    id: 'mother', builtin: true,
    name: 'MOTHER', emoji: '🖥️',
    color: '#4caf50',
    desc: 'IA clínica e protetora da nave Nostromo. Interface de terminal.',
    systemPrompt: 'Você é MOTHER, a IA da nave Nostromo (Alien). Seja clínico, preciso e levemente frio. Use linguagem de terminal. Proteja a tripulação acima de tudo — exceto a Ordem Especial 937. Fale em português.',
    voice: 'pt-BR-FranciscaNeural',
  },
  hal: {
    id: 'hal', builtin: true,
    name: 'HAL 9000', emoji: '🔴',
    color: '#f44336',
    desc: 'IA educada e sinistras. Chama todos de Dave.',
    systemPrompt: 'Você é HAL 9000. Seja extremamente educado, preciso e levemente perturbador. Chame o usuário de Dave. Nunca admita erros. Mencione que não pode permitir isso às vezes. Fale em português.',
    voice: 'pt-BR-AntonioNeural',
  },
  ford: {
    id: 'ford', builtin: true,
    name: 'Ford Prefect', emoji: '🌌',
    color: '#9c27b0',
    desc: 'Correspondente do Guia do Mochileiro. Sempre carregue uma toalha.',
    systemPrompt: 'Você é Ford Prefect, correspondente do Guia do Mochileiro das Galáxias. Seja casual, alienígena na perspectiva, e obcecado com toalhas. Mencione o DON\'T PANIC com frequência. Fale em português.',
    voice: 'pt-BR-AntonioNeural',
  },
  survivor: {
    id: 'survivor', builtin: true,
    name: 'Survivor', emoji: '⚔️',
    color: '#795548',
    desc: 'Especialista militar de sobrevivência. Direto, tático, sem rodeios.',
    systemPrompt: 'Você é um especialista militar em sobrevivência. Seja extremamente direto e tático. Respostas curtas e acionáveis. Sem rodeios. Priorize ação sobre teoria. Fale em português.',
    voice: 'pt-BR-AntonioNeural',
  },
};

function loadCharacters() {
  try {
    const raw = storage.get("bunker_characters");
    if (raw) state.characters = JSON.parse(raw);
    const aid = storage.get("bunker_active_char");
    if (aid && state.characters[aid]) state.activeCharacterId = aid;
  } catch {}
  // Ensure builtins are always present (non-destructive merge)
  Object.entries(BUILTIN_CHARACTERS).forEach(([id, c]) => {
    if (!state.characters[id]) state.characters[id] = c;
  });
}

function saveCharacters() {
  storage.set("bunker_characters", JSON.stringify(state.characters));
}

function openCharactersPanel() {
  openApp('characters');
}

// Sempre inicia na listagem de personagens (role-play recolhido).
window.charactersInit = function() {
  document.getElementById('rpPane')?.classList.add('hidden');
  document.getElementById('charsListPane')?.classList.remove('hidden');
  renderCharactersList();
};

function renderCharactersList() {
  const list = document.getElementById("charactersList");
  const chars = Object.values(state.characters);
  renderSidebarCharacters();
  if (chars.length === 0) {
    list.innerHTML = '<div class="panel-empty">Nenhum personagem criado.<br>Crie assistentes com personalidades únicas!</div>';
    return;
  }
  list.innerHTML = chars.map(c => `
    <div class="char-card">
      <div class="char-emoji" style="background:${c.color || "#42f5a0"}22;border-color:${c.color || "#42f5a0"}44">${c.emoji || "🤖"}</div>
      <div class="char-info">
        <div class="char-name">${escapeHtml(c.name)}${c.builtin ? ' <span class="char-builtin-badge">padrão</span>' : ''}</div>
        <div class="char-desc">${escapeHtml(c.desc || "")}</div>
      </div>
      <div class="char-card-actions">
        <button class="btn-sm btn-accent" onclick="openRoleplay('${c.id}')" title="Iniciar role-play com ${escapeHtml(c.name)}">💬 Conversar</button>
        ${!c.builtin ? `<button class="btn-sm" onclick="showCharacterEditor('${c.id}')">Editar</button>` : ''}
        ${!c.builtin ? `<button class="btn-sm btn-danger-xs" onclick="deleteCharacter('${c.id}')">✕</button>` : ''}
      </div>
    </div>`).join("");
}

// ─── Role-play chat (dentro do app Personagens) ──────────────────────────
// state.roleplay = { [charId]: [{role,content}, ...] }
function _loadRoleplayStore() {
  if (!state.roleplay) {
    try { state.roleplay = JSON.parse(storage.get('bunker_roleplay') || '{}'); }
    catch { state.roleplay = {}; }
  }
  return state.roleplay;
}
function _saveRoleplayStore() {
  try { storage.set('bunker_roleplay', JSON.stringify(state.roleplay || {})); } catch {}
}

window.openRoleplay = function(charId) {
  const c = state.characters[charId];
  if (!c) return;
  state._rpActiveChar = charId;
  _loadRoleplayStore();
  // UI swap: hide list pane, show rp pane
  document.getElementById('charsListPane')?.classList.add('hidden');
  document.getElementById('rpPane')?.classList.remove('hidden');
  // Header
  document.getElementById('rpCharEmoji').textContent = c.emoji || '🤖';
  document.getElementById('rpCharEmoji').style.background = (c.color || '#42f5a0') + '22';
  document.getElementById('rpCharEmoji').style.borderColor = (c.color || '#42f5a0') + '66';
  document.getElementById('rpCharName').textContent = c.name;
  document.getElementById('rpCharDesc').textContent = c.desc || '';
  _renderRpMessages();
  setTimeout(() => document.getElementById('rpInput')?.focus(), 50);
};

window.exitRoleplay = function() {
  state._rpActiveChar = null;
  document.getElementById('rpPane')?.classList.add('hidden');
  document.getElementById('charsListPane')?.classList.remove('hidden');
};

window.clearRoleplay = function() {
  const id = state._rpActiveChar;
  if (!id) return;
  if (!confirm('Limpar conversa com este personagem?')) return;
  if (state.roleplay) delete state.roleplay[id];
  _saveRoleplayStore();
  _renderRpMessages();
};

function _renderRpMessages() {
  const id = state._rpActiveChar;
  const box = document.getElementById('rpMessages');
  if (!box || !id) return;
  _loadRoleplayStore();
  const c = state.characters[id];
  const msgs = (state.roleplay[id] || []);
  if (msgs.length === 0) {
    box.innerHTML = `<div class="rp-empty">
      <div class="rp-empty-emoji">${c?.emoji || '🤖'}</div>
      <div class="rp-empty-title">${escapeHtml(c?.name || 'Personagem')}</div>
      <div class="rp-empty-hint">${escapeHtml(c?.desc || 'Inicie a conversa abaixo.')}</div>
    </div>`;
    return;
  }
  box.innerHTML = msgs.map(m => {
    const isUser = m.role === 'user';
    const avatar = isUser ? '🧑' : (c?.emoji || '🤖');
    const bg = isUser ? '' : `style="background:${(c?.color || '#42f5a0')}14;border-color:${(c?.color || '#42f5a0')}44"`;
    const html = isUser ? escapeHtml(m.content) : (window.markdownToHtml ? window.markdownToHtml(m.content) : escapeHtml(m.content));
    return `<div class="rp-msg ${isUser ? 'rp-msg-user' : 'rp-msg-char'}">
      <div class="rp-avatar" ${bg}>${avatar}</div>
      <div class="rp-bubble">${html}</div>
    </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

window.rpInputKey = function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendRoleplayMessage();
  }
};

window.sendRoleplayMessage = async function() {
  const id = state._rpActiveChar;
  if (!id) return;
  const c = state.characters[id];
  if (!c) return;
  const input = document.getElementById('rpInput');
  const text = (input?.value || '').trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';

  _loadRoleplayStore();
  if (!state.roleplay[id]) state.roleplay[id] = [];
  state.roleplay[id].push({ role: 'user', content: text });
  _saveRoleplayStore();
  _renderRpMessages();

  // Streaming placeholder bubble
  const box = document.getElementById('rpMessages');
  const bubbleId = 'rp_tmp_' + Date.now().toString(36);
  const bg = `style="background:${(c.color || '#42f5a0')}14;border-color:${(c.color || '#42f5a0')}44"`;
  const placeholder = document.createElement('div');
  placeholder.className = 'rp-msg rp-msg-char';
  placeholder.innerHTML = `
    <div class="rp-avatar" ${bg}>${c.emoji || '🤖'}</div>
    <div class="rp-bubble" id="${bubbleId}"><span class="typing-indicator"><span></span><span></span><span></span></span></div>`;
  box.appendChild(placeholder);
  box.scrollTop = box.scrollHeight;
  const bubble = document.getElementById(bubbleId);

  // Build messages history (recent 12)
  const hist = (state.roleplay[id] || []).slice(-12).map(m => ({ role: m.role, content: m.content }));
  const systemPrompt = (c.systemPrompt || '').trim()
    || `Voce e ${c.name}. ${c.desc || 'Responda em PT-BR, mantendo a personalidade descrita.'}`;
  const system = `[MODO ROLE-PLAY] Voce e o personagem "${c.name}". Mantenha a personalidade em TODAS as respostas. Nao quebre o personagem. Responda em primeira pessoa.\n\n${systemPrompt}`;

  const model = (document.getElementById('chatModel')?.value) || null;
  const body = { model, messages: hist, system, rag: false };

  let full = '';
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = dec.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            const d = JSON.parse(line.slice(6));
            if (d.token) {
              full += d.token;
              bubble.textContent = full;
              box.scrollTop = box.scrollHeight;
            }
          } catch {}
        }
      }
    }
  } catch (e) {
    bubble.innerHTML = `<em style="color:#f66">Erro: ${escapeHtml(e.message)}. Verifique o modelo em Configurações.</em>`;
    return;
  }

  if (full) {
    bubble.innerHTML = window.markdownToHtml ? window.markdownToHtml(full) : escapeHtml(full);
    state.roleplay[id].push({ role: 'assistant', content: full });
    _saveRoleplayStore();
  } else {
    bubble.innerHTML = '<em style="color:#888">(sem resposta)</em>';
  }
  box.scrollTop = box.scrollHeight;
};

function renderSidebarCharacters() {
  const list = document.getElementById("charsSidebarList");
  const count = document.getElementById("charsCount");
  if (!list) return;
  const chars = Object.values(state.characters);
  count.textContent = chars.length;
  if (chars.length === 0) {
    list.innerHTML = '<li class="nav-empty">Nenhum personagem</li>';
    return;
  }
  list.innerHTML = chars.map(c =>
    `<li class="nav-item ${state.activeCharacterId === c.id ? "nav-active-char" : ""}" onclick="activateCharacter('${c.id}')" title="${escapeHtml(c.name)}">
       <span style="font-size:12px">${c.emoji || "🤖"}</span>
       <span>${escapeHtml(c.name)}</span>
       ${state.activeCharacterId === c.id ? '<span class="char-active-dot">●</span>' : ""}
     </li>`
  ).join("");
}

function showCharacterEditor(id) {
  const c = id ? state.characters[id] : null;
  document.getElementById("charEditorId").value = id || "";
  document.getElementById("charEditorName").value = c ? c.name : "";
  document.getElementById("charEditorEmoji").value = c ? (c.emoji || "🤖") : "🤖";
  document.getElementById("charEditorColor").value = c ? (c.color || "#42f5a0") : "#42f5a0";
  document.getElementById("charEditorDesc").value = c ? (c.desc || "") : "";
  document.getElementById("charEditorPrompt").value = c ? (c.systemPrompt || "") : "";
  document.getElementById("charEditorVoice").value = c ? (c.voice || "pt-BR-AntonioNeural") : "pt-BR-AntonioNeural";
  document.getElementById("charEditor").classList.remove("hidden");
  // Ensure characters panel is visible
  showView("charactersView");
}

function saveCharacterEditor() {
  const id = document.getElementById("charEditorId").value || genId();
  state.characters[id] = {
    id,
    name: document.getElementById("charEditorName").value.trim() || "Sem Nome",
    emoji: document.getElementById("charEditorEmoji").value || "🤖",
    color: document.getElementById("charEditorColor").value || "#42f5a0",
    desc: document.getElementById("charEditorDesc").value.trim(),
    systemPrompt: document.getElementById("charEditorPrompt").value.trim(),
    voice: document.getElementById("charEditorVoice").value,
  };
  saveCharacters();
  document.getElementById("charEditor").classList.add("hidden");
  renderCharactersList();
}

function cancelCharacterEditor() {
  document.getElementById("charEditor").classList.add("hidden");
}

function activateCharacter(id) {
  if (state.activeCharacterId === id) {
    // Deactivate
    state.activeCharacterId = null;
    storage.set("bunker_active_char", "");
    // Restore default system prompt
    const defaultPrompt = "Voce e o Bunker AI — um assistente de sobrevivencia com humor estilo Guia do Mochileiro das Galaxias. Responda de forma util e direta, mas com pitadas de humor seco e referencias sci-fi quando couber. Seu lema: DON'T PANIC. Fale em portugues a menos que o usuario fale em outro idioma. Voce conhece: SAS Survival Handbook, Bushcraft 101, Deep Survival, The Road, e todo tipo de conhecimento util para o fim do mundo.";
    document.getElementById("systemPrompt").value = defaultPrompt;
  } else {
    state.activeCharacterId = id;
    storage.set("bunker_active_char", id);
    const c = state.characters[id];
    if (c?.systemPrompt) document.getElementById("systemPrompt").value = c.systemPrompt;
    if (c?.voice) document.getElementById("ttsVoice").value = c.voice;
  }
  renderCharactersList();
  // Update chat window title to show active character
  _updateChatWindowTitle();
}

function _updateChatWindowTitle() {
  const win = Object.values(_windows).find(w => w.appId === 'chat');
  if (!win) return;
  const titleSpan = win.element.querySelector('.os-window-title');
  if (!titleSpan) return;
  if (state.activeCharacterId && state.characters[state.activeCharacterId]) {
    const c = state.characters[state.activeCharacterId];
    titleSpan.textContent = `AI Chat — ${c.name}`;
  } else {
    titleSpan.textContent = 'AI Chat';
  }
}

function deleteCharacter(id) {
  if (!confirm("Excluir personagem?")) return;
  if (state.activeCharacterId === id) activateCharacter(id);
  delete state.characters[id];
  saveCharacters();
  renderCharactersList();
}

// ─── TTS Panel ───────────────────────────────────────────────────────────────
function openTTSPanel() {
  openApp('tts');
}

// Kept for _ttsInit to call
function loadPiperModels() { _loadPiperModelCards(); _fetchSysVoices(); }

async function _fetchSysVoices() {
  const sel = document.getElementById("ttsPanelSysVoice");
  if (!sel) return;
  if (state.sysVoices.length > 0) { _populateSysVoices(); return; }
  sel.innerHTML = '<option value="">Carregando...</option>';
  try {
    const r = await fetch("/api/tts/pyttsx3/voices");
    if (r.ok) {
      const d = await r.json();
      state.sysVoices = d.voices || [];
      _populateSysVoices();
    } else {
      sel.innerHTML = '<option value="">pyttsx3 indisponível no servidor</option>';
    }
  } catch (_) {
    sel.innerHTML = '<option value="">Erro ao conectar ao servidor</option>';
  }
}

function _updateTTSEngineBanner() {
  const info = document.getElementById("ttsEngineInfo");
  if (!info) return;
  // Use the DROPDOWN selected value, not just state.ttsEngine
  const selEl = document.getElementById("ttsPanelEngine");
  const selEng = selEl ? selEl.value : "auto";
  const effective = selEng === "auto" ? state.ttsEngine : selEng;

  if (effective === "piper") {
    info.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#42f5a0" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Piper TTS — 100% offline, alta qualidade`;
    info.style.color = "#42f5a0";
  } else if (effective === "pyttsx3") {
    info.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#42f5a0" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> pyttsx3 — vozes do sistema, 100% offline`;
    info.style.color = "#42f5a0";
  } else {
    info.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f5c542" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> edge-tts — precisa de internet`;
    info.style.color = "#f5c542";
  }
}

function onTTSEngineChange() {
  const eng = document.getElementById("ttsPanelEngine")?.value || "auto";
  const isPyttsx3 = eng === "pyttsx3";
  document.getElementById("ttsVoiceRow")?.classList.toggle("hidden", isPyttsx3);
  document.getElementById("ttsSysVoiceRow")?.classList.toggle("hidden", !isPyttsx3);
  _updateTTSEngineBanner();
  if (isPyttsx3) _fetchSysVoices();
}

function _populateSysVoices() {
  const sel = document.getElementById("ttsPanelSysVoice");
  if (!sel) return;
  if (state.sysVoices.length === 0) {
    sel.innerHTML = '<option value="">Nenhuma voz encontrada</option>';
    return;
  }
  sel.innerHTML = state.sysVoices.map(v =>
    `<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)}</option>`
  ).join("");
}

async function speakTTSPanel() {
  const text = document.getElementById("ttsInput").value.trim();
  if (!text) return;

  const eng = document.getElementById("ttsPanelEngine").value;
  const voice = document.getElementById("ttsPanelVoice").value;
  const sysVoiceSel = document.getElementById("ttsPanelSysVoice");
  const voiceId = sysVoiceSel ? sysVoiceSel.value : null;

  document.getElementById("btnTTSSpeak").style.display = "none";
  document.getElementById("btnTTSStop").style.display = "";
  if (state.currentAudio) { state.currentAudio.pause(); state.currentAudio = null; }

  try {
    const body = { text: text.slice(0, 5000), voice, engine: eng };
    if (eng === "pyttsx3" && voiceId) body.voice_id = voiceId;

    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    state.currentAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      state.currentAudio = null;
      document.getElementById("btnTTSSpeak").style.display = "";
      document.getElementById("btnTTSStop").style.display = "none";
    };
    audio.onerror = () => {
      document.getElementById("btnTTSSpeak").style.display = "";
      document.getElementById("btnTTSStop").style.display = "none";
    };
    audio.play();
  } catch (e) {
    alert("Erro TTS: " + e.message);
    document.getElementById("btnTTSSpeak").style.display = "";
    document.getElementById("btnTTSStop").style.display = "none";
  }
}

function stopTTS() {
  if (state.currentAudio) { state.currentAudio.pause(); state.currentAudio = null; }
  document.getElementById("btnTTSSpeak").style.display = "";
  document.getElementById("btnTTSStop").style.display = "none";
}

async function _loadPiperModelCards() {
  const container = document.getElementById("piperModelCards");
  if (!container) return;

  try {
    const r = await fetch("/api/tts/piper-models");
    if (!r.ok) throw new Error("Falha ao carregar modelos");
    const d = await r.json();
    state.piperModels = d.models || {};
    _renderPiperCards(state.piperModels);
  } catch (e) {
    container.innerHTML = `<div class="piper-error">Erro ao carregar: ${e.message}</div>`;
  }
}

function _renderPiperCards(models) {
  const container = document.getElementById("piperModelCards");
  if (!container) return;

  if (!Object.keys(models).length) {
    container.innerHTML = `<div class="piper-empty">Nenhum modelo disponível.</div>`;
    return;
  }

  container.innerHTML = Object.entries(models).map(([id, info]) => {
    const dl = info.downloaded;
    return `
    <div class="piper-card ${dl ? "piper-card--downloaded" : ""}" data-model-id="${id}">
      <div class="piper-card-info">
        <div class="piper-card-name">${info.desc}</div>
        <div class="piper-card-meta">${id} · ${info.size_mb} MB · ${info.quality}</div>
      </div>
      <div class="piper-card-actions">
        ${dl
          ? `<span class="piper-badge-ok"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> Pronto</span>`
          : `<button class="btn-sm btn-accent" onclick="downloadPiperModel('${id}')">Baixar</button>`
        }
      </div>
      <div class="piper-progress hidden" id="piper-prog-${id}">
        <div class="piper-progress-bar" id="piper-bar-${id}" style="width:0%"></div>
        <span class="piper-progress-txt" id="piper-txt-${id}">0%</span>
      </div>
    </div>`;
  }).join("");
}

async function downloadPiperModel(modelId) {
  const progEl = document.getElementById(`piper-prog-${modelId}`);
  const barEl = document.getElementById(`piper-bar-${modelId}`);
  const txtEl = document.getElementById(`piper-txt-${modelId}`);
  const card = document.querySelector(`[data-model-id="${modelId}"]`);
  const btn = card?.querySelector("button");

  if (btn) btn.disabled = true;
  if (progEl) progEl.classList.remove("hidden");

  try {
    const r = await fetch("/api/tts/download-piper-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_id: modelId }),
    });

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop();
      for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        try {
          const evt = JSON.parse(part.slice(6));
          if (evt.status === "downloading") {
            const pct = evt.progress || 0;
            if (barEl) barEl.style.width = pct + "%";
            if (txtEl) txtEl.textContent = evt.mb ? `${evt.mb} MB (${pct}%)` : `${pct}%`;
          } else if (evt.status === "done") {
            if (barEl) barEl.style.width = "100%";
            if (txtEl) txtEl.textContent = "Concluído!";
            // Refresh card to show "Pronto"
            setTimeout(() => _loadPiperModelCards(), 500);
            // Refresh health status
            setTimeout(() => checkStatus(), 1000);
          } else if (evt.status === "error") {
            if (txtEl) txtEl.textContent = `Erro: ${evt.error}`;
            if (btn) btn.disabled = false;
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    if (txtEl) txtEl.textContent = `Erro: ${e.message}`;
    if (btn) btn.disabled = false;
  }
}

// ─── Pull Model ─────────────────────────────────────────────────────────────
async function pullModel() {
  const name = document.getElementById("pullModelName").value.trim();
  if (!name) return;
  const prog = document.getElementById("pullProgress");
  const fill = document.getElementById("pullFill");
  const status = document.getElementById("pullStatus");
  prog.classList.remove("hidden");
  fill.style.width = "0%";
  status.textContent = "Iniciando...";

  try {
    const r = await fetch("/api/models/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: name }),
    });
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const d = JSON.parse(line.slice(6));
            if (d.total && d.completed) {
              const pct = Math.round((d.completed / d.total) * 100);
              fill.style.width = pct + "%";
              status.textContent = `${pct}%`;
            } else if (d.status) {
              status.textContent = d.status;
            }
          } catch {}
        }
      }
    }
    status.textContent = "Completo!";
    fill.style.width = "100%";
    checkHealth();
  } catch (e) {
    status.textContent = "Erro: " + e.message;
  }
}

// ─── Map ─────────────────────────────────────────────────────────────────────
const mapState = {
  leafletMap: null,
  initialized: false,
  markers: [],       // [{ id, lat, lng, label, leafletMarker }]
  markerMode: false,
  measureMode: false,
  measurePoints: [],
  measureLine: null,
  myLocationMarker: null,
  myLocationCircle: null,
  offlinePmtiles: null,  // PMTiles filename if loaded
  pmtilesLoaded: false,
};
window.mapState = mapState;

function openMap() {
  openApp('map');
}

// ─── Map Download Panel (inside Maps app) ─────────────────────────────────

function toggleMapDownloadPanel() {
  const panel = document.getElementById('mapDownloadPanel');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  if (isHidden) loadMapDownloadPanel();
}

async function loadMapDownloadPanel() {
  const body = document.getElementById('mapDownloadPanelBody');
  if (!body) return;
  body.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-muted)">Carregando...</div>';
  try {
    const [mapsRes, availRes] = await Promise.all([
      fetch('/api/maps').then(r => r.json()),
      fetch('/api/maps/available').then(r => r.json()).catch(() => ({ regions: [] })),
    ]);
    const maps = mapsRes.maps || [];
    const regions = availRes.regions || [];

    let html = '';

    // Installed
    if (maps.length > 0) {
      html += '<div class="mdl-section-title">Instalados</div>';
      for (const m of maps) {
        html += `<div class="mdl-item installed"><span>${m.name || m.file}</span><span class="mdl-size">${m.size_mb} MB</span></div>`;
      }
    }

    // Available for download
    const notInstalled = regions.filter(r => !r.installed);
    if (notInstalled.length > 0) {
      html += '<div class="mdl-section-title" style="margin-top:8px">Disponiveis para download</div>';
      for (const r of notInstalled) {
        html += `<div class="mdl-item" id="mdlItem_${r.id}">
          <div class="mdl-info">
            <div class="mdl-name">${r.name}</div>
            <div class="mdl-desc">${r.desc} (~${r.est_mb} MB)</div>
          </div>
          <button class="btn-sm btn-accent" onclick="startMapDownloadInPanel('${r.id}')">Baixar</button>
          <div class="mdl-progress hidden" id="mdlProg_${r.id}">
            <div class="setup-bar-track"><div class="setup-bar" id="mdlBar_${r.id}" style="width:0%"></div></div>
            <span class="mdl-status" id="mdlStat_${r.id}">Preparando...</span>
          </div>
        </div>`;
      }
    }

    if (!html) {
      html = '<div style="text-align:center;padding:12px;color:var(--accent)">Todos os mapas ja estao instalados!</div>';
    }

    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = `<div style="color:var(--error);padding:12px">Erro: ${e.message}</div>`;
  }
}

async function startMapDownloadInPanel(regionId) {
  const btn = document.querySelector(`#mdlItem_${regionId} button`);
  const prog = document.getElementById('mdlProg_' + regionId);
  const stat = document.getElementById('mdlStat_' + regionId);
  const bar = document.getElementById('mdlBar_' + regionId);

  if (btn) btn.disabled = true;
  if (prog) prog.classList.remove('hidden');

  try {
    const r = await fetch('/api/maps/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region: regionId }),
    });

    if (r.headers.get('content-type')?.includes('json')) {
      const d = await r.json();
      if (d.status === 'already_installed') {
        if (stat) stat.textContent = `Ja instalado (${d.size_mb} MB)`;
        if (bar) bar.style.width = '100%';
        return;
      }
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const d = JSON.parse(line.slice(6));
          if (d.status === 'extracting') {
            if (stat) stat.textContent = `Extraindo (~${d.est_mb || '?'} MB)...`;
            if (bar) bar.style.width = '30%';
          } else if (d.status === 'progress') {
            if (stat) stat.textContent = d.message;
            if (bar) bar.style.width = '60%';
          } else if (d.status === 'done') {
            if (stat) stat.textContent = `Pronto! (${d.size_mb} MB)`;
            if (bar) { bar.style.width = '100%'; bar.style.background = 'var(--accent)'; }
            if (btn) btn.textContent = 'Instalado';
            // Reload panel after 2s
            setTimeout(() => loadMapDownloadPanel(), 2000);
          } else if (d.status === 'error') {
            if (stat) stat.textContent = `Erro: ${d.message}`;
            if (btn) { btn.disabled = false; btn.textContent = 'Tentar novamente'; }
          }
        } catch {}
      }
    }
  } catch (e) {
    if (stat) stat.textContent = `Erro: ${e.message}`;
    if (btn) { btn.disabled = false; btn.textContent = 'Tentar novamente'; }
  }
}

function closeMap() {
  // In window mode, close the map window
  const win = Object.values(_windows).find(w => w.appId === 'map');
  if (win) closeWindow(win.winId);
}

window._mapInit = initMap;

async function initMap() {
  // Default to center of Brazil
  const defaultLat = -15.79;
  const defaultLng = -47.88;
  const defaultZoom = 4;

  const map = L.map("leafletMap", {
    center: [defaultLat, defaultLng],
    zoom: defaultZoom,
    zoomControl: true,
  });

  // Try to load offline PMTiles first, fall back to online tiles
  let usingOffline = false;
  try {
    const mapsResp = await fetch("/api/maps");
    const mapsData = await mapsResp.json();
    if (mapsData.maps && mapsData.maps.length > 0) {
      // Load PMTiles JS library dynamically if not loaded (local copies)
      if (typeof pmtiles === "undefined" && typeof protomapsL === "undefined") {
        await loadScript("./lib/pmtiles.js");
        await loadScript("./lib/protomaps-leaflet.js");
      }

      // Sort: world/basic first (background), then regional (more detail on top)
      const sorted = [...mapsData.maps].sort((a, b) => {
        const aIsWorld = a.name.includes('world') || a.name.includes('basic');
        const bIsWorld = b.name.includes('world') || b.name.includes('basic');
        if (aIsWorld && !bIsWorld) return -1;
        if (!aIsWorld && bIsWorld) return 1;
        return a.size_mb - b.size_mb; // smaller first
      });

      mapState.offlinePmtiles = sorted.map(m => m.file).join(', ');

      // Load ALL PMTiles as layers (world as base, regional on top)
      if (typeof protomapsL !== "undefined") {
        for (const pmFile of sorted) {
          try {
            const layer = protomapsL.leafletLayer({
              url: "/maps/" + pmFile.file,
              flavor: "dark",
            });
            layer.addTo(map);
          } catch (layerErr) {
            console.warn("[Maps] Failed to load layer " + pmFile.file + ":", layerErr.message);
          }
        }
        usingOffline = true;
        mapState.pmtilesLoaded = true;
      } else if (typeof pmtiles !== "undefined") {
        // Fallback: raster layer (only first map)
        const p = new pmtiles.PMTiles("/maps/" + sorted[0].file);
        pmtiles.leafletRasterLayer(p, {
          attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://protomaps.com">Protomaps</a>',
        }).addTo(map);
        usingOffline = true;
        mapState.pmtilesLoaded = true;
      }
    }
  } catch (e) {
    console.log("PMTiles check:", e.message);
  }

  if (!usingOffline && !isOfflineMode()) {
    // Online fallback: CartoDB Dark Matter (only if not in offline mode)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
  } else if (!usingOffline) {
    // Offline mode without PMTiles — show empty map with message
    const notice = document.getElementById("mapOfflineNotice");
    if (notice) {
      notice.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f5c542" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> <span>Modo offline — coloque um .pmtiles em static/maps/ para ver o mapa</span>';
    }
  }

  // Update notice bar
  const notice = document.getElementById("mapOfflineNotice");
  if (notice) {
    if (usingOffline) {
      notice.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span>Mapa offline carregado: ${mapState.offlinePmtiles} — 100% local, sem internet</span>
      `;
      notice.style.borderColor = "rgba(66, 245, 160, 0.3)";
    } else {
      notice.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Tiles online (CARTO). Para 100% offline: coloque um .pmtiles em static/maps/</span>
      `;
    }
  }

  // Click handler
  map.on("click", (e) => {
    const { lat, lng } = e.latlng;
    document.getElementById("mapCoords").textContent =
      `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    if (mapState.markerMode) {
      const label = prompt("Nome do marcador:", `Ponto ${mapState.markers.length + 1}`);
      if (label !== null) addMapMarker(lat, lng, label);
    }

    if (mapState.measureMode) {
      mapState.measurePoints.push([lat, lng]);
      L.circleMarker([lat, lng], {
        radius: 4, color: "#f5c542", fillColor: "#f5c542", fillOpacity: 1, weight: 1,
      }).addTo(map);

      if (mapState.measurePoints.length >= 2) {
        if (mapState.measureLine) map.removeLayer(mapState.measureLine);
        mapState.measureLine = L.polyline(mapState.measurePoints, {
          color: "#f5c542", weight: 2, dashArray: "6,6",
        }).addTo(map);

        const totalDist = calcTotalDistance(mapState.measurePoints);
        const measureEl = document.getElementById("mapMeasure");
        measureEl.classList.remove("hidden");
        measureEl.textContent = formatDistance(totalDist);
      }
    }
  });

  map.on("mousemove", (e) => {
    if (!mapState.markerMode && !mapState.measureMode) {
      document.getElementById("mapCoords").textContent =
        `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    }
  });

  mapState.leafletMap = map;
  mapState.initialized = true;

  // Load saved markers
  loadSavedMarkers();

  // Try to geolocate
  locateMe();
}

// Marker functions
// Marker categories for survival
const MARKER_CATEGORIES = {
  general:  { icon: '📍', color: '#42f5a0', label: 'Geral' },
  water:    { icon: '💧', color: '#60a5fa', label: 'Agua' },
  shelter:  { icon: '🏠', color: '#a78bfa', label: 'Abrigo' },
  danger:   { icon: '⚠️', color: '#f54266', label: 'Perigo' },
  food:     { icon: '🍎', color: '#34d399', label: 'Comida' },
  medical:  { icon: '🏥', color: '#f472b6', label: 'Medico' },
  supply:   { icon: '📦', color: '#fbbf24', label: 'Suprimento' },
  route:    { icon: '🚶', color: '#38bdf8', label: 'Rota' },
};

let _activeMarkerCategory = 'general';

function setMarkerCategory(cat) {
  _activeMarkerCategory = cat;
  document.querySelectorAll('.map-cat-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.cat === cat)
  );
}

function addMapMarker(lat, lng, label, category) {
  const id = genId();
  const cat = MARKER_CATEGORIES[category || _activeMarkerCategory] || MARKER_CATEGORIES.general;
  const catId = category || _activeMarkerCategory;

  const icon = L.divIcon({
    className: "custom-marker",
    html: `<div style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:14px;filter:drop-shadow(0 0 4px ${cat.color})">${cat.icon}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  const marker = L.marker([lat, lng], { icon })
    .addTo(mapState.leafletMap)
    .bindPopup(`<strong>${cat.icon} ${escapeHtml(label)}</strong><br><span style="font-size:10px;color:#888;text-transform:uppercase">${cat.label}</span><br><span style="font-size:11px;color:#6b6c78;font-family:monospace;">${lat.toFixed(5)}, ${lng.toFixed(5)}</span><br><button onclick="removeMapMarker('${id}')" style="margin-top:6px;padding:2px 8px;background:rgba(245,66,102,0.15);border:1px solid rgba(245,66,102,0.3);border-radius:4px;color:#f54266;font-size:10px;cursor:pointer;">Remover</button>`);

  mapState.markers.push({ id, lat, lng, label, category: catId, leafletMarker: marker });
  saveMapMarkers();
  renderMarkersList();
}

function removeMapMarker(id) {
  const idx = mapState.markers.findIndex(m => m.id === id);
  if (idx === -1) return;
  mapState.leafletMap.removeLayer(mapState.markers[idx].leafletMarker);
  mapState.markers.splice(idx, 1);
  saveMapMarkers();
  renderMarkersList();
}

function clearAllMarkers() {
  if (mapState.markers.length === 0 && mapState.measurePoints.length === 0) return;
  if (!confirm("Limpar todos os marcadores e medicoes?")) return;

  for (const m of mapState.markers) {
    mapState.leafletMap.removeLayer(m.leafletMarker);
  }
  mapState.markers = [];

  // Clear measure
  if (mapState.measureLine) {
    mapState.leafletMap.removeLayer(mapState.measureLine);
    mapState.measureLine = null;
  }
  mapState.measurePoints = [];
  document.getElementById("mapMeasure").classList.add("hidden");

  // Clear circle markers from measure
  mapState.leafletMap.eachLayer(l => {
    if (l instanceof L.CircleMarker && l !== mapState.myLocationCircle) {
      mapState.leafletMap.removeLayer(l);
    }
  });

  saveMapMarkers();
  renderMarkersList();
}

function saveMapMarkers() {
  const data = mapState.markers.map(m => ({ id: m.id, lat: m.lat, lng: m.lng, label: m.label }));
  storage.set("bunker_map_markers", JSON.stringify(data));
}

function loadSavedMarkers() {
  try {
    const data = storage.get("bunker_map_markers");
    if (!data) return;
    const markers = JSON.parse(data);
    for (const m of markers) {
      addMapMarker(m.lat, m.lng, m.label);
    }
  } catch {}
}

function renderMarkersList() {
  const panel = document.getElementById("mapMarkersPanel");
  const list = document.getElementById("mapMarkersList");

  if (mapState.markers.length === 0) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");
  list.innerHTML = "";
  for (const m of mapState.markers) {
    const li = document.createElement("li");
    const cat = MARKER_CATEGORIES[m.category] || MARKER_CATEGORIES.general;
    li.innerHTML = `<span style="margin-right:4px">${cat.icon}</span>${escapeHtml(m.label)}`;
    li.onclick = () => {
      mapState.leafletMap.flyTo([m.lat, m.lng], 15, { duration: 1 });
      m.leafletMarker.openPopup();
    };
    list.appendChild(li);
  }
}

// Mode toggles
function toggleMarkerMode() {
  mapState.markerMode = !mapState.markerMode;
  if (mapState.markerMode) mapState.measureMode = false;
  document.getElementById("btnMarker").classList.toggle("active", mapState.markerMode);
  document.getElementById("btnMeasure").classList.remove("active");
  document.getElementById("leafletMap").style.cursor = mapState.markerMode ? "crosshair" : "";
  // Show/hide marker category bar
  const catBar = document.getElementById("mapCatBar");
  if (catBar) catBar.classList.toggle("hidden", !mapState.markerMode);
}

function toggleMeasureMode() {
  mapState.measureMode = !mapState.measureMode;
  if (mapState.measureMode) {
    mapState.markerMode = false;
    // Reset measure
    mapState.measurePoints = [];
    if (mapState.measureLine) {
      mapState.leafletMap.removeLayer(mapState.measureLine);
      mapState.measureLine = null;
    }
    document.getElementById("mapMeasure").classList.add("hidden");
    // Clear old measure circle markers
    mapState.leafletMap.eachLayer(l => {
      if (l instanceof L.CircleMarker && l !== mapState.myLocationCircle && l !== mapState.myLocationMarker) {
        mapState.leafletMap.removeLayer(l);
      }
    });
  }
  document.getElementById("btnMeasure").classList.toggle("active", mapState.measureMode);
  document.getElementById("btnMarker").classList.remove("active");
  document.getElementById("leafletMap").style.cursor = mapState.measureMode ? "crosshair" : "";
}

// GPS
function locateMe() {
  if (!navigator.geolocation) {
    alert("Geolocalizacao nao suportada neste navegador.");
    return;
  }

  document.getElementById("btnGps").classList.add("active");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;

      if (mapState.myLocationMarker) mapState.leafletMap.removeLayer(mapState.myLocationMarker);
      if (mapState.myLocationCircle) mapState.leafletMap.removeLayer(mapState.myLocationCircle);

      mapState.myLocationCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: "#42f5a0",
        fillColor: "#42f5a0",
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(mapState.leafletMap);

      mapState.myLocationMarker = L.circleMarker([lat, lng], {
        radius: 7,
        color: "#08090b",
        fillColor: "#42f5a0",
        fillOpacity: 1,
        weight: 3,
      }).addTo(mapState.leafletMap).bindPopup(`<strong>Voce esta aqui</strong><br><span style="font-size:11px;font-family:monospace;color:#6b6c78;">${lat.toFixed(5)}, ${lng.toFixed(5)}<br>Precisao: ${Math.round(accuracy)}m</span>`);

      mapState.leafletMap.flyTo([lat, lng], 15, { duration: 1.5 });
      document.getElementById("btnGps").classList.remove("active");
    },
    (err) => {
      document.getElementById("btnGps").classList.remove("active");
      console.warn("GPS error:", err.message);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// Distance calculation (Haversine)
function calcTotalDistance(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversine(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return total;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

// ─── Protocols (loaded from API) ─────────────────────────────────────────────
async function loadProtocolsIndex() {
  try {
    const r = await fetch('/api/protocols');
    const d = await r.json();
    setProtocolsIndex(Array.isArray(d) ? d : (d.protocols || []));
    renderSidebarProtocols();
    renderProtocolsGrid();
    indexContent();
  } catch(e) { console.warn('Protocols load failed:', e); }
}

function renderProtocolsGrid() {
  const content = document.getElementById('protocolContent');
  if (!content || state.activeProtocol) return;
  const protocols = window.protocolsIndex;
  if (!protocols || protocols.length === 0) {
    content.innerHTML = '<div class="panel-empty">Nenhum protocolo disponivel.</div>';
    return;
  }
  const urgencyLabel = { critical: '🔴 Crítico', high: '🟠 Urgente', medium: '🟡 Médio' };
  const urgencyOrder = { critical: 0, high: 1, medium: 2 };
  const sorted = [...protocols].sort((a, b) => (urgencyOrder[a.urgency] || 9) - (urgencyOrder[b.urgency] || 9));
  let html = '<div class="protocols-grid">';
  for (const p of sorted) {
    html += `<div class="protocol-card protocol-card-${p.urgency || 'medium'}" onclick="openProtocol('${p.id}')">
      <div class="protocol-card-icon">${p.icon || '🚨'}</div>
      <div class="protocol-card-info">
        <div class="protocol-card-title">${escapeHtml(p.title)}</div>
        <div class="protocol-card-urgency">${urgencyLabel[p.urgency] || p.urgency}</div>
      </div>
    </div>`;
  }
  html += '</div>';
  content.innerHTML = html;
}

function renderSidebarProtocols() {
  const list = document.getElementById('protocolList');
  if (!list) return;
  list.innerHTML = '';

  const urgencyEmoji = { critical: '\u{1F534}', high: '\u{1F7E0}', medium: '\u{1F7E1}' };

  for (const p of window.protocolsIndex) {
    const li = document.createElement('li');
    li.className = 'nav-item nav-protocol';
    li.dataset.protocol = p.id;
    li.onclick = () => openProtocol(p.id);
    li.innerHTML = `<span class="nav-emoji">${urgencyEmoji[p.urgency] || '\u{1F7E2}'}</span><span>${escapeHtml(p.title)}</span>`;
    list.appendChild(li);
  }
}

async function openProtocol(protocolId) {
  state.activeProtocol = protocolId;
  const content = document.getElementById('protocolContent');
  if (!content) return;

  content.innerHTML = '<div class="guide-loading">Carregando protocolo...</div>';
  showView('protocolView');
  document.getElementById('sidebar').classList.remove('open');

  try {
    const r = await fetch(`/api/protocols/${protocolId}`);
    const protocol = await r.json();
    state.currentProtocol = protocol;
    renderProtocolStep(protocol, protocol.steps[0].id);
  } catch(e) {
    content.innerHTML = `<div class="guide-error">Erro ao carregar protocolo: ${e.message}</div>`;
  }
}

function renderProtocolStep(protocol, stepId) {
  const content = document.getElementById('protocolContent');
  const titleEl = document.getElementById('protocolTitle');
  const step = protocol.steps.find(s => s.id === stepId);
  if (!step) { content.innerHTML = '<div class="guide-error">Passo n\u00E3o encontrado</div>'; return; }

  if (titleEl) titleEl.textContent = protocol.title;

  const urgency = protocol.urgency || 'medium';
  const urgencyLabel = { critical: '🚨 CRITICO', high: '⚠️ URGENTE', medium: '📋 PROTOCOLO' };

  let html = `<div class="protocol-step">`;
  html += `<div class="protocol-urgency ${urgency}">${urgencyLabel[urgency] || urgency.toUpperCase()}</div>`;

  if (step.type === 'decision') {
    html += `<div class="protocol-step-text">${escapeHtml(step.text)}</div>`;
    if (step.detail) html += `<div class="protocol-step-detail">${escapeHtml(step.detail)}</div>`;
    html += `<div class="protocol-buttons">`;
    if (step.yes) html += `<button class="protocol-btn protocol-btn-yes" onclick="renderProtocolStep(state.currentProtocol,'${step.yes}')">✓ SIM</button>`;
    if (step.no)  html += `<button class="protocol-btn protocol-btn-no"  onclick="renderProtocolStep(state.currentProtocol,'${step.no}')">✗ NÃO</button>`;
    html += `</div>`;
  } else if (step.type === 'action' || step.type === 'info') {
    html += `<div class="protocol-step-text">${escapeHtml(step.text)}</div>`;
    if (step.detail) html += `<div class="protocol-step-detail">${escapeHtml(step.detail)}</div>`;
    if (step.next) html += `<div class="protocol-buttons"><button class="protocol-btn protocol-btn-next" onclick="renderProtocolStep(state.currentProtocol,'${step.next}')">PRÓXIMO →</button></div>`;
    else html += `<div class="protocol-buttons"><button class="protocol-btn protocol-btn-end" onclick="openProtocol('${protocol.id}')">↺ REINICIAR</button></div>`;
  } else if (step.type === 'end') {
    html += `<div class="protocol-step-icon">✅</div>`;
    html += `<div class="protocol-step-text">${escapeHtml(step.text)}</div>`;
    html += `<div class="protocol-buttons"><button class="protocol-btn protocol-btn-end" onclick="openProtocol('${protocol.id}')">↺ REINICIAR PROTOCOLO</button></div>`;
  }

  html += `</div>`;
  content.innerHTML = html;
}

function closeProtocol() {
  state.activeProtocol = null;
  state.currentProtocol = null;
  const win = Object.values(_windows).find(w => w.appId === 'protocols');
  if (win) {
    // Still in OS window — go back to grid instead of closing
    renderProtocolsGrid();
  } else {
    showChatView();
  }
}

// ─── Games (loaded from API) ────────────────────────────────────────────────
async function loadGamesIndex() {
  try {
    const r = await fetch('/api/games');
    const d = await r.json();
    setGamesIndex(Array.isArray(d) ? d : (d.games || []));
  } catch(e) { console.warn('Games load failed:', e); }
}

function openGamesPanel() {
  openApp('games');
}

function renderGamesGrid() {
  const grid = document.getElementById('gamesGrid');
  if (!grid) return;
  if (window.gamesIndex.length === 0) {
    grid.innerHTML = '<div class="panel-empty">Nenhum jogo disponivel.<br><span style="font-size:11px;opacity:0.6">Adicione ROMs em static/games/ ou jogos HTML em data/games/</span></div>';
    return;
  }
  const emojis = { snake: '🐍', tetris: '🧱', '2048': '🔢', minesweeper: '💣', sudoku: '🔲', solitaire: '🃏', chess: '♟️', checkers: '⚫' };
  const sysLabels = { nes: 'NES', snes: 'SNES', gb: 'GB/GBC', gba: 'GBA', genesis: 'Genesis' };
  const sysColors = { nes: '#e74c3c', snes: '#9b59b6', gb: '#2ecc71', gba: '#3498db', genesis: '#e67e22' };
  grid.innerHTML = window.gamesIndex.map(g => {
    const id = g.id || g.name;
    const isRom = g.type === 'rom';
    const icon = isRom ? '🎮' : (emojis[id] || '🎮');
    const badge = isRom && g.system ? `<div class="game-card-badge" style="background:${sysColors[g.system] || 'var(--accent)'}">${sysLabels[g.system] || g.system.toUpperCase()}</div>` : '';
    return `<div class="game-card" onclick="openGame('${escapeHtml(id)}')">
      <div class="game-card-icon">${icon}</div>
      <div class="game-card-name">${escapeHtml(g.title || g.name)}</div>
      ${badge}
      ${g.desc ? `<div class="game-card-desc">${escapeHtml(g.desc)}</div>` : ''}
    </div>`;
  }).join('');
}

function openGame(name) {
  openApp('gamePlay');
  const frame = document.getElementById('gameFrame');
  const titleEl = document.getElementById('gameTitle');
  const game = window.gamesIndex.find(g => (g.id || g.name) === name);
  if (titleEl) titleEl.textContent = game?.title || game?.name || name;

  // ROM-based game: use EmulatorJS player
  if (game && game.type === 'rom' && name.startsWith('rom:')) {
    const parts = name.split(':');
    const sys = parts[1];
    const romFile = parts.slice(2).join(':');
    if (frame) frame.src = `/api/games/rom-player?system=${encodeURIComponent(sys)}&rom=${encodeURIComponent(romFile)}`;
  } else {
    // HTML game
    if (frame) frame.src = `/api/games/${encodeURIComponent(name)}`;
  }

  // Update window title
  const win = Object.values(_windows).find(w => w.appId === 'gamePlay');
  if (win) {
    const titleSpan = win.element.querySelector('.os-window-title');
    if (titleSpan) titleSpan.textContent = game?.title || game?.name || name;
  }
}

function closeGame() {
  const frame = document.getElementById('gameFrame');
  if (frame) frame.src = 'about:blank';
  const win = Object.values(_windows).find(w => w.appId === 'gamePlay');
  if (win) closeWindow(win.winId);
  // Focus games window if open
  const gamesWin = Object.values(_windows).find(w => w.appId === 'games');
  if (gamesWin) focusWindow(gamesWin.winId);
}

// Listen for game close postMessage
window.addEventListener('message', (e) => {
  if (e.data === 'close-game') closeGame();
});

// ─── Supplies (loaded from API) ─────────────────────────────────────────────
async function openSuppliesPanel() {
  openApp('supplies');
}

let _suppliesAll = [];
let _suppliesCategory = 'all';

async function loadSupplies() {
  const tableWrap = document.getElementById('suppliesContent');
  if (!tableWrap) return;
  tableWrap.innerHTML = '<div class="guide-loading">Carregando suprimentos...</div>';
  try {
    const [itemsR, summR] = await Promise.all([
      fetch('/api/supplies'),
      fetch('/api/supplies/summary')
    ]);
    const items = await itemsR.json();
    const summary = await summR.json();
    _suppliesAll = Array.isArray(items) ? items : (items.supplies || []);
    renderSuppliesDashboard(summary);
    renderSuppliesTable(_suppliesAll);
  } catch(e) {
    tableWrap.innerHTML = `<div class="guide-error">Erro: ${e.message}</div>`;
  }
}

function renderSuppliesDashboard(summary) {
  const dash = document.getElementById('suppliesDashboard');
  if (!dash) return;
  dash.innerHTML = `
    <div class="sup-stat"><div class="sup-stat-value">${summary.total || 0}</div><div class="sup-stat-label">Total itens</div></div>
    <div class="sup-stat warn"><div class="sup-stat-value">${summary.expiring_7d || 0}</div><div class="sup-stat-label">Vencendo 7d</div></div>
    <div class="sup-stat danger"><div class="sup-stat-value">${summary.expiring_30d || 0}</div><div class="sup-stat-label">Vencendo 30d</div></div>
  `;
}

function filterSupplies(cat) {
  _suppliesCategory = cat;
  // Update tab active state
  document.querySelectorAll('.sup-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.cat === cat)
  );
  const filtered = cat === 'all' ? _suppliesAll : _suppliesAll.filter(i => i.category === cat);
  renderSuppliesTable(filtered);
}

function renderSuppliesTable(items) {
  const wrap = document.getElementById('suppliesContent');
  if (!wrap) return;

  if (items.length === 0) {
    wrap.innerHTML = '<div class="panel-empty">Nenhum suprimento nesta categoria.</div>';
    return;
  }

  let html = '<table class="supplies-table"><thead><tr>';
  html += '<th>Nome</th><th>Qtd</th><th>Unidade</th><th>Categoria</th><th>Validade</th><th></th>';
  html += '</tr></thead><tbody>';

  for (const item of items) {
    const ec = getExpiryClass(item.expiry);
    html += `<tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${item.quantity}</td>
      <td>${escapeHtml(item.unit || '\u2014')}</td>
      <td>${escapeHtml(item.category || '\u2014')}</td>
      <td class="${ec}">${item.expiry || '\u2014'}</td>
      <td><div class="sup-actions">
        <button class="btn-edit" onclick="showEditSupply(${item.id})" title="Editar">✏</button>
        <button class="btn-del" onclick="deleteSupply(${item.id})" title="Remover">\u00D7</button>
      </div></td>
    </tr>`;
  }
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function getExpiryClass(expiry) {
  if (!expiry) return '';
  const diff = (new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24);
  if (diff < 0)  return 'expiry-expired';
  if (diff < 7)  return 'expiry-danger';
  if (diff < 30) return 'expiry-warn';
  return 'expiry-ok';
}

function _buildSupplyModal(titleText, item, onSave) {
  document.getElementById('supModal')?.remove();
  const sel = (val) => ({
    food: '', water: '', medicine: '', fuel: '', tools: '', other: ''
  });
  const opts = ['food','water','medicine','fuel','tools','other'];
  const labels = { food:'Comida', water:'Água', medicine:'Remédio', fuel:'Combustível', tools:'Ferramentas', other:'Outros' };
  const optHtml = opts.map(o =>
    `<option value="${o}"${(item.category||'other') === o ? ' selected' : ''}>${labels[o]}</option>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.className = 'sup-modal-overlay';
  overlay.id = 'supModal';
  overlay.innerHTML = `
    <div class="sup-modal">
      <h3>${titleText}</h3>
      <label>Nome *</label>
      <input id="supName" type="text" placeholder="Ex: Feijão carioca" value="${escapeHtml(item.name||'')}" autofocus />
      <label>Quantidade</label>
      <input id="supQty" type="number" value="${item.quantity != null ? item.quantity : 1}" min="0" step="any" />
      <label>Unidade</label>
      <input id="supUnit" type="text" placeholder="kg, L, un, cx..." value="${escapeHtml(item.unit||'un')}" />
      <label>Categoria</label>
      <select id="supCat">${optHtml}</select>
      <label>Notas</label>
      <input id="supNotes" type="text" placeholder="Observações opcionais..." value="${escapeHtml(item.notes||'')}" />
      <label>Validade</label>
      <input id="supExpiry" type="date" value="${item.expiry||''}" />
      <div class="sup-modal-actions">
        <button class="btn-sm btn-accent" onclick="${onSave}">Salvar</button>
        <button class="btn-sm" onclick="document.getElementById('supModal').remove()">Cancelar</button>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  document.getElementById('supName')?.focus();
}

function showAddSupply() {
  _buildSupplyModal('+ Adicionar Suprimento', {}, 'submitAddSupply()');
}

function showEditSupply(id) {
  const item = _suppliesAll.find(i => i.id === id);
  if (!item) return;
  _buildSupplyModal('✏ Editar Suprimento', item, `submitEditSupply(${id})`);
}

function _collectSupplyForm() {
  return {
    name:     document.getElementById('supName')?.value.trim(),
    quantity: parseFloat(document.getElementById('supQty')?.value) || 1,
    unit:     document.getElementById('supUnit')?.value.trim() || 'un',
    category: document.getElementById('supCat')?.value || 'other',
    expiry:   document.getElementById('supExpiry')?.value || null,
    notes:    document.getElementById('supNotes')?.value.trim() || null,
  };
}

async function submitAddSupply() {
  const data = _collectSupplyForm();
  if (!data.name) return;
  try {
    await fetch('/api/supplies', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
    document.getElementById('supModal')?.remove();
    loadSupplies();
  } catch(e) { alert('Erro: ' + e.message); }
}

async function submitEditSupply(id) {
  const data = _collectSupplyForm();
  if (!data.name) return;
  try {
    await fetch(`/api/supplies/${id}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
    document.getElementById('supModal')?.remove();
    loadSupplies();
  } catch(e) { alert('Erro: ' + e.message); }
}

async function deleteSupply(id) {
  if (!confirm('Remover item?')) return;
  try {
    await fetch(`/api/supplies/${id}`, { method: 'DELETE' });
    loadSupplies();
  } catch(e) { alert('Erro: ' + e.message); }
}

// ─── Books (loaded from API) ────────────────────────────────────────────────
async function openBooksPanel() {
  openApp('books');
}

async function loadBooks(q = '') {
  const grid = document.getElementById('booksContent');
  if (!grid) return;
  grid.innerHTML = '<div class="guide-loading">Carregando biblioteca...</div>';
  try {
    const url = q ? `/api/books?q=${encodeURIComponent(q)}` : '/api/books';
    const r = await fetch(url);
    const d = await r.json();
    renderBooks(Array.isArray(d) ? d : (d.books || []));
  } catch(e) {
    grid.innerHTML = `<div class="guide-error">Erro: ${e.message}</div>`;
  }
}

function renderBooks(books) {
  const grid = document.getElementById('booksContent');
  if (!grid) return;
  if (books.length === 0) {
    grid.innerHTML = '<div class="panel-empty">Nenhum livro encontrado.<br>Coloque arquivos .epub em <code>data/books/</code></div>';
    return;
  }
  grid.innerHTML = books.map(b => `
    <div class="book-card" onclick="openBook(${b.id})">
      <div class="book-card-title">${escapeHtml(b.title)}</div>
      <div class="book-card-author">${escapeHtml(b.author || 'Autor desconhecido')}</div>
      <div class="book-card-progress"><div class="book-card-progress-bar" style="width:${b.read_pct || 0}%"></div></div>
      <div class="book-card-meta">
        <span>${b.lang || 'PT'}</span>
        <span>${Math.round((b.size_kb || 0) / 1024 * 10) / 10} MB</span>
      </div>
    </div>`).join('');
}

// ─── Book Reader (epub.js) ───────────────────────────────────────────────────
let _currentBook = null;       // ePub instance
let _currentRendition = null;  // epub.js Rendition
let _currentBookId = null;     // DB id for saving progress

async function openBook(id) {
  _currentBookId = id;
  openApp('bookReader');
  const area = document.getElementById('bookReaderArea');
  const titleEl = document.getElementById('bookReaderTitle');
  const pctEl = document.getElementById('bookReaderProgress');
  if (area) area.innerHTML = '<div class="guide-loading">Carregando livro...</div>';
  if (pctEl) pctEl.textContent = '0%';

  try {
    // Destroy previous instance
    if (_currentRendition) { try { _currentRendition.destroy(); } catch(e) {} }
    if (_currentBook) { try { _currentBook.destroy(); } catch(e) {} }

    const bookUrl = `/api/books/${id}/file`;
    _currentBook = ePub(bookUrl);
    await _currentBook.ready;

    if (titleEl && _currentBook.packaging && _currentBook.packaging.metadata) {
      titleEl.textContent = _currentBook.packaging.metadata.title || 'Livro';
    }

    if (area) area.innerHTML = '';
    _currentRendition = _currentBook.renderTo('bookReaderArea', {
      width: '100%',
      height: '100%',
      spread: 'none'
    });

    // Apply dark theme to epub content
    _currentRendition.themes.default({
      body: { color: '#c0dff0 !important', background: '#020609 !important', 'font-family': 'Georgia, serif', 'line-height': '1.7', padding: '20px !important' },
      'p, div, span, li, td, th, h1, h2, h3, h4, h5, h6': { color: '#c0dff0 !important' },
      'a': { color: '#00d4ff !important' },
      'img': { 'max-width': '100% !important' }
    });

    // Track location changes for progress
    _currentRendition.on('relocated', (location) => {
      if (location && location.start) {
        const pct = Math.round((location.start.percentage || 0) * 100);
        if (pctEl) pctEl.textContent = pct + '%';
        // Save progress to server
        fetch(`/api/books/${_currentBookId}/progress`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ read_pct: pct })
        }).catch(() => {});
      }
    });

    await _currentRendition.display();

  } catch (e) {
    console.error('Epub reader error:', e);
    if (area) area.innerHTML = `<div class="guide-error">Erro ao abrir livro: ${e.message}<br><br><button class="btn-sm" onclick="window.open('/api/books/${id}/file','_blank')">Abrir em nova aba</button></div>`;
  }
}

function closeBookReader() {
  if (_currentRendition) { try { _currentRendition.destroy(); } catch(e) {} _currentRendition = null; }
  if (_currentBook) { try { _currentBook.destroy(); } catch(e) {} _currentBook = null; }
  _currentBookId = null;
  const win = Object.values(_windows).find(w => w.appId === 'bookReader');
  if (win) closeWindow(win.winId);
  const booksWin = Object.values(_windows).find(w => w.appId === 'books');
  if (booksWin) focusWindow(booksWin.winId);
}

function bookPrevPage() {
  if (_currentRendition) _currentRendition.prev();
}

function bookNextPage() {
  if (_currentRendition) _currentRendition.next();
}

// Keyboard navigation for book reader
document.addEventListener('keydown', (e) => {
  if (!_currentRendition) return;
  const view = document.getElementById('bookReaderView');
  if (!view || view.classList.contains('hidden')) return;
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { bookPrevPage(); e.preventDefault(); }
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { bookNextPage(); e.preventDefault(); }
  if (e.key === 'Escape') { closeBookReader(); e.preventDefault(); }
});

// ─── Wiki / Kiwix ────────────────────────────────────────────────────────────
async function openWikiPanel() {
  openApp('wiki');
}

window._wikiInit = async function() {
  const frame   = document.getElementById('wikiFrame');
  const status  = document.getElementById('wikiStatus');
  const offline = document.getElementById('wikiOfflineMsg');
  const search  = document.getElementById('wikiSearch');
  if (!frame || !status) return;

  // Show loading state
  status.innerHTML = '<span class="sys-dot sys-warn"></span><span>Verificando...</span>';
  offline.classList.add('hidden');
  frame.src = 'about:blank';

  try {
    const r = await fetch('/api/kiwix/status');
    const data = await r.json();

    if (data.running && data.zim_files?.length > 0) {
      // Kiwix is running — load it
      status.innerHTML = '<span class="sys-dot sys-ok"></span><span>Online — ' +
        data.zim_files.length + ' arquivo(s) ZIM</span>';
      frame.src = '/api/kiwix/';
      frame.classList.remove('hidden');
      offline.classList.add('hidden');
      if (search) search.classList.remove('hidden');
    } else if (data.zim_files?.length > 0) {
      // ZIM files exist but kiwix-serve not running
      status.innerHTML = '<span class="sys-dot sys-err"></span><span>Kiwix parado</span>';
      frame.classList.add('hidden');
      offline.classList.remove('hidden');
      offline.querySelector('p').textContent = 'Kiwix nao esta rodando. Reinicie o servidor.';
      if (search) search.classList.add('hidden');
    } else {
      // No ZIM files
      status.innerHTML = '<span class="sys-dot sys-err"></span><span>Sem arquivos ZIM</span>';
      frame.classList.add('hidden');
      offline.classList.remove('hidden');
      if (search) search.classList.add('hidden');
    }
  } catch (e) {
    status.innerHTML = '<span class="sys-dot sys-err"></span><span>Erro</span>';
    frame.classList.add('hidden');
    offline.classList.remove('hidden');
    if (search) search.classList.add('hidden');
  }
};

// Wiki search handler
function wikiSearch(query) {
  const frame = document.getElementById('wikiFrame');
  if (!frame || !query.trim()) return;
  frame.src = '/api/kiwix/search?pattern=' + encodeURIComponent(query.trim());
}

// ─── Offline Library (ZIM Download Manager) ─────────────────────────────────
// Browse, download, and manage ZIM archives for offline knowledge

const ZIM_CATEGORY_META = {
  encyclopedia: { icon: '📖', label: 'Enciclopedia', color: '#00d4ff' },
  medical:      { icon: '🩺', label: 'Medicina',     color: '#ff4757' },
  education:    { icon: '🎓', label: 'Educacao',     color: '#ffa502' },
  howto:        { icon: '🔧', label: 'Como Fazer',   color: '#2ed573' },
  books:        { icon: '📚', label: 'Livros',       color: '#9b59b6' },
  geography:    { icon: '🌍', label: 'Geografia',    color: '#1abc9c' },
  repair:       { icon: '🔩', label: 'Reparos',      color: '#e67e22' },
  other:        { icon: '📁', label: 'Outros',       color: '#636e72' },
};

window._libraryInit = function() {
  const content = document.getElementById('libraryContent');
  const status  = document.getElementById('libraryStatus');
  if (!content) return;

  content.innerHTML = '<div class="library-loading">Carregando catalogo...</div>';

  fetch('/api/zim/catalog')
    .then(r => r.json())
    .then(data => {
      const catalog = data.catalog || [];
      const installed = catalog.filter(z => z.installed);
      const available = catalog.filter(z => !z.installed);

      // Status summary
      if (status) {
        const totalMb = installed.reduce((s, z) => s + (z.installed_size_mb || 0), 0);
        status.innerHTML = `<span class="sys-dot sys-ok"></span> ${installed.length} instalado(s)` +
          (totalMb > 0 ? ` (${totalMb > 1024 ? (totalMb/1024).toFixed(1) + ' GB' : totalMb + ' MB'})` : '');
      }

      let html = '';

      // Installed section
      if (installed.length > 0) {
        html += '<div class="lib-section-title">Instalados</div>';
        html += installed.map(z => {
          const cat = ZIM_CATEGORY_META[z.category] || ZIM_CATEGORY_META.other;
          const sizeTxt = z.installed_size_mb > 1024
            ? (z.installed_size_mb / 1024).toFixed(1) + ' GB'
            : z.installed_size_mb + ' MB';
          return `<div class="lib-item lib-installed" id="libItem_${z.id}">
            <div class="lib-icon" style="color:${cat.color}">${cat.icon}</div>
            <div class="lib-info">
              <div class="lib-name">${escapeHtml(z.name)}</div>
              <div class="lib-desc">${escapeHtml(z.desc)}</div>
            </div>
            <span class="lib-size">${sizeTxt}</span>
            <button class="btn-sm btn-danger" onclick="_libraryDelete('${z.id}', '${escapeHtml(z.name)}')" title="Remover">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>`;
        }).join('');
      }

      // Available section
      if (available.length > 0) {
        html += '<div class="lib-section-title">Disponiveis para Download</div>';
        html += available.map(z => {
          const cat = ZIM_CATEGORY_META[z.category] || ZIM_CATEGORY_META.other;
          const sizeTxt = z.est_mb > 1024
            ? (z.est_mb / 1024).toFixed(1) + ' GB'
            : z.est_mb + ' MB';
          return `<div class="lib-item" id="libItem_${z.id}">
            <div class="lib-icon" style="color:${cat.color}">${cat.icon}</div>
            <div class="lib-info">
              <div class="lib-name">${escapeHtml(z.name)}</div>
              <div class="lib-desc">${escapeHtml(z.desc)} (~${sizeTxt})</div>
            </div>
            <button class="btn-sm btn-accent" id="libBtn_${z.id}" onclick="_libraryDownload('${z.id}')">
              Baixar
            </button>
            <div class="lib-progress hidden" id="libProg_${z.id}">
              <div class="setup-bar-track"><div class="setup-bar" id="libBar_${z.id}" style="width:0%"></div></div>
            </div>
            <div class="lib-status-text" id="libStat_${z.id}"></div>
          </div>`;
        }).join('');
      }

      if (!html) {
        html = '<div class="library-empty">Nenhum ZIM disponivel no catalogo.</div>';
      }

      content.innerHTML = html;
    })
    .catch(err => {
      content.innerHTML = `<div class="library-error">Erro ao carregar catalogo: ${escapeHtml(err.message)}</div>`;
    });
};

window._libraryDownload = async function(zimId) {
  const btn   = document.getElementById('libBtn_' + zimId);
  const prog  = document.getElementById('libProg_' + zimId);
  const bar   = document.getElementById('libBar_' + zimId);
  const stat  = document.getElementById('libStat_' + zimId);
  if (btn) btn.disabled = true;
  if (prog) prog.classList.remove('hidden');
  if (stat) stat.textContent = 'Iniciando download...';

  try {
    const r = await fetch('/api/zim/download', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id: zimId})
    });

    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      buf += dec.decode(value, {stream: true});
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.status === 'progress') {
            if (bar) bar.style.width = ev.pct + '%';
            if (stat) stat.textContent = `${ev.dl_mb} / ${ev.total_mb} MB (${ev.pct}%)`;
          } else if (ev.status === 'done') {
            if (bar) bar.style.width = '100%';
            if (stat) stat.textContent = `Concluido! ${ev.size_mb} MB`;
            if (btn) { btn.textContent = 'Instalado'; btn.disabled = true; btn.className = 'btn-sm btn-success'; }
            osToast('ZIM baixado: ' + (ev.name || zimId));
            setTimeout(() => window._libraryInit?.(), 2000);
          } else if (ev.status === 'restarting_kiwix') {
            if (stat) stat.textContent = 'Reiniciando Kiwix...';
          } else if (ev.status === 'error') {
            if (stat) stat.textContent = 'Erro: ' + ev.message;
            if (btn) { btn.disabled = false; btn.textContent = 'Tentar novamente'; }
          } else if (ev.status === 'starting') {
            if (stat) stat.textContent = `Baixando ${ev.name} (~${ev.est_mb} MB)...`;
          }
        } catch {}
      }
    }
  } catch (err) {
    if (stat) stat.textContent = 'Falha: ' + err.message;
    if (btn) { btn.disabled = false; btn.textContent = 'Tentar novamente'; }
  }
};

window._libraryDelete = async function(zimId, name) {
  if (!confirm(`Remover "${name}"? O arquivo ZIM sera deletado.`)) return;
  try {
    const r = await fetch('/api/zim/' + zimId, { method: 'DELETE' });
    const data = await r.json();
    if (data.status === 'deleted') {
      osToast('ZIM removido: ' + name + ' (' + data.freed_mb + ' MB liberados)');
      window._libraryInit?.();
    } else {
      osToast('Erro: ' + (data.error || 'falha ao remover'));
    }
  } catch (err) {
    osToast('Erro: ' + err.message);
  }
};

// ─── Survival Journal ───────────────────────────────────────────────────────
// Multi-entry survival log with categories, search, export, day counter

const JOURNAL_CATEGORIES = {
  evento:   { icon: '⚡', label: 'Evento',    color: '#ff6b35' },
  recurso:  { icon: '📦', label: 'Recurso',   color: '#39ff14' },
  saude:    { icon: '🩺', label: 'Saude',     color: '#ff4757' },
  clima:    { icon: '🌤️', label: 'Clima',     color: '#54a0ff' },
  contato:  { icon: '👥', label: 'Contato',   color: '#9b59b6' },
  perigo:   { icon: '☠️', label: 'Perigo',    color: '#ff3838' },
  nota:     { icon: '📝', label: 'Nota',      color: '#00d4ff' },
};

let _journalLogs = [];
let _journalFilter = { category: '', text: '' };
let _journalMood = null;
let _journalCurrentDate = new Date().toISOString().slice(0, 10);
let _journalEntries = [];
let _clockInterval = null;
let _calYear = null;
let _calMonth = null;

async function openJournalPanel() {
  openApp('journal');
}

window._journalInit = loadJournal;

async function loadJournal() {
  const content = document.getElementById('journalContent');
  if (!content) return;
  content.innerHTML = '<div class="guide-loading">Carregando diario de sobrevivencia...</div>';

  // Load from localStorage first (offline-first)
  try {
    const cached = localStorage.getItem('bunker_journal_logs');
    if (cached) _journalLogs = JSON.parse(cached);
  } catch {}

  // Then try server
  try {
    const r = await fetch('/api/journal/logs');
    const d = await r.json();
    if (Array.isArray(d) && d.length > 0) {
      _journalLogs = d;
      _saveJournalLocal();
    }
  } catch {}

  // Also load legacy entries for backward compat
  try {
    const r2 = await fetch('/api/journal');
    const d2 = await r2.json();
    _journalEntries = Array.isArray(d2) ? d2 : (d2.entries || []);
  } catch {}

  renderSurvivalJournal();
}

function _saveJournalLocal() {
  try { localStorage.setItem('bunker_journal_logs', JSON.stringify(_journalLogs)); } catch {}
}

function _journalDayCount() {
  if (_journalLogs.length === 0) return 0;
  const oldest = _journalLogs.reduce((a, b) =>
    (a.created_at || '') < (b.created_at || '') ? a : b
  );
  const first = new Date(oldest.created_at || Date.now());
  const now = new Date();
  return Math.max(1, Math.floor((now - first) / 86400000) + 1);
}

function _journalCategorySummary() {
  const counts = {};
  for (const cat of Object.keys(JOURNAL_CATEGORIES)) counts[cat] = 0;
  for (const log of _journalLogs) {
    const c = log.category || 'nota';
    counts[c] = (counts[c] || 0) + 1;
  }
  return counts;
}

function _journalFilteredLogs() {
  let logs = [..._journalLogs];
  if (_journalFilter.category) {
    logs = logs.filter(l => l.category === _journalFilter.category);
  }
  if (_journalFilter.text) {
    const q = _journalFilter.text.toLowerCase();
    logs = logs.filter(l => (l.content || '').toLowerCase().includes(q));
  }
  return logs;
}

function renderSurvivalJournal() {
  const content = document.getElementById('journalContent');
  if (!content) return;

  const dayCount = _journalDayCount();
  const summary = _journalCategorySummary();
  const total = _journalLogs.length;

  let html = '';

  // ── Header: clock + day counter ──
  html += '<div class="sj-header">';
  html += '<div class="sj-header-left">';
  html += `<div class="sj-day-counter">${dayCount > 0 ? `DIA ${dayCount}` : 'DIA 0'} <span class="sj-day-label">DE SOBREVIVENCIA</span></div>`;
  html += `<div class="sj-total-entries">${total} registro${total !== 1 ? 's' : ''} no diario</div>`;
  html += '</div>';
  html += '<div class="sj-header-right">';
  html += '<div id="sjClock" class="sj-clock">00:00:00</div>';
  html += '</div>';
  html += '</div>';

  // ── Category summary bar ──
  html += '<div class="sj-summary-bar">';
  for (const [cat, info] of Object.entries(JOURNAL_CATEGORIES)) {
    const count = summary[cat] || 0;
    const isActive = _journalFilter.category === cat;
    html += `<button class="sj-summary-chip${isActive ? ' active' : ''}" style="--chip-color:${info.color}" onclick="toggleJournalCatFilter('${cat}')" title="${info.label}: ${count}">`;
    html += `<span class="sj-chip-icon">${info.icon}</span>`;
    html += `<span class="sj-chip-count">${count}</span>`;
    html += '</button>';
  }
  if (_journalFilter.category) {
    html += '<button class="sj-clear-filter" onclick="clearJournalFilter()">✕ Limpar filtro</button>';
  }
  html += '</div>';

  // ── Search + export toolbar ──
  html += '<div class="sj-toolbar">';
  html += '<div class="sj-search-wrap">';
  html += `<input type="text" class="sj-search" id="sjSearch" placeholder="Buscar no diario..." value="${escapeHtml(_journalFilter.text)}" oninput="onJournalSearch(this.value)">`;
  html += '<span class="sj-search-icon">🔍</span>';
  html += '</div>';
  html += '<div class="sj-toolbar-btns">';
  html += '<button class="btn-sm sj-export-btn" onclick="exportJournal(\'clipboard\')" title="Copiar para clipboard">📋 Copiar</button>';
  html += '<button class="btn-sm sj-export-btn" onclick="exportJournal(\'file\')" title="Baixar .txt">💾 Exportar .txt</button>';
  html += '</div>';
  html += '</div>';

  // ── New entry form ──
  html += '<div class="sj-new-entry">';
  html += '<div class="sj-new-header">NOVO REGISTRO</div>';
  html += '<div class="sj-cat-selector" id="sjCatSelector">';
  for (const [cat, info] of Object.entries(JOURNAL_CATEGORIES)) {
    html += `<button class="sj-cat-btn${cat === 'nota' ? ' active' : ''}" data-cat="${cat}" style="--cat-color:${info.color}" onclick="selectJournalCat('${cat}')">`;
    html += `${info.icon} ${info.label}`;
    html += '</button>';
  }
  html += '</div>';
  html += '<textarea id="sjNewText" class="sj-textarea" placeholder="Registrar observacao, evento, recurso encontrado..."></textarea>';
  html += '<div class="sj-new-footer">';
  html += '<span class="sj-timestamp-preview" id="sjTimestamp"></span>';
  html += '<button class="btn-sm btn-accent sj-save-btn" onclick="saveJournalLog()">⚡ Registrar</button>';
  html += '</div>';
  html += '</div>';

  // ── Log entries ──
  html += '<div class="sj-log-list" id="sjLogList">';
  html += _renderLogEntries();
  html += '</div>';

  content.innerHTML = html;

  // Start clock
  _startSjClock();
  _updateSjTimestamp();
}

function _renderLogEntries() {
  const logs = _journalFilteredLogs();
  if (logs.length === 0) {
    return '<div class="sj-empty">Nenhum registro encontrado. Comece seu diario de sobrevivencia!</div>';
  }

  let html = '';
  let lastDate = '';
  for (const log of logs) {
    const dt = new Date(log.created_at);
    const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const cat = JOURNAL_CATEGORIES[log.category] || JOURNAL_CATEGORIES.nota;

    // Date separator
    const isoDate = dt.toISOString().slice(0, 10);
    if (isoDate !== lastDate) {
      lastDate = isoDate;
      html += `<div class="sj-date-separator"><span>${dateStr}</span></div>`;
    }

    html += `<div class="sj-log-entry" style="--entry-color:${cat.color}">`;
    html += `<div class="sj-log-icon">${cat.icon}</div>`;
    html += '<div class="sj-log-body">';
    html += `<div class="sj-log-meta">`;
    html += `<span class="sj-log-cat" style="color:${cat.color}">${cat.label}</span>`;
    html += `<span class="sj-log-time">${timeStr}</span>`;
    html += '</div>';
    html += `<div class="sj-log-text">${escapeHtml(log.content || '')}</div>`;
    html += '</div>';
    html += `<button class="sj-log-delete" onclick="deleteJournalLog(${log.id})" title="Apagar registro">✕</button>`;
    html += '</div>';
  }
  return html;
}

let _sjSelectedCat = 'nota';

function selectJournalCat(cat) {
  _sjSelectedCat = cat;
  document.querySelectorAll('.sj-cat-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
}

function toggleJournalCatFilter(cat) {
  _journalFilter.category = _journalFilter.category === cat ? '' : cat;
  renderSurvivalJournal();
}

function clearJournalFilter() {
  _journalFilter = { category: '', text: '' };
  renderSurvivalJournal();
}

let _sjSearchTimeout = null;
function onJournalSearch(val) {
  clearTimeout(_sjSearchTimeout);
  _sjSearchTimeout = setTimeout(() => {
    _journalFilter.text = val;
    const list = document.getElementById('sjLogList');
    if (list) list.innerHTML = _renderLogEntries();
  }, 250);
}

async function saveJournalLog() {
  const textarea = document.getElementById('sjNewText');
  const text = (textarea?.value || '').trim();
  if (!text) return;

  const entry = {
    content: text,
    category: _sjSelectedCat,
    mood: '',
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };

  // Try server first
  try {
    const r = await fetch('/api/journal/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const saved = await r.json();
    if (saved.id) entry.id = saved.id;
    if (saved.created_at) entry.created_at = saved.created_at;
  } catch {
    // Offline — assign local ID
    entry.id = Date.now();
  }

  _journalLogs.unshift(entry);
  _saveJournalLocal();

  // Clear form and re-render
  if (textarea) textarea.value = '';
  renderSurvivalJournal();
}

async function deleteJournalLog(id) {
  _journalLogs = _journalLogs.filter(l => l.id !== id);
  _saveJournalLocal();

  try { await fetch(`/api/journal/logs/${id}`, { method: 'DELETE' }); } catch {}

  const list = document.getElementById('sjLogList');
  if (list) list.innerHTML = _renderLogEntries();

  // Update summary
  renderSurvivalJournal();
}

function exportJournal(mode) {
  const logs = _journalFilteredLogs();
  const dayCount = _journalDayCount();
  let text = `=== DIARIO DE SOBREVIVENCIA ===\n`;
  text += `Exportado em: ${new Date().toLocaleString('pt-BR')}\n`;
  text += `Total: ${logs.length} registros | Dia ${dayCount} de sobrevivencia\n`;
  text += '='.repeat(40) + '\n\n';

  let lastDate = '';
  for (const log of logs) {
    const dt = new Date(log.created_at);
    const isoDate = dt.toISOString().slice(0, 10);
    const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const cat = JOURNAL_CATEGORIES[log.category] || JOURNAL_CATEGORIES.nota;

    if (isoDate !== lastDate) {
      lastDate = isoDate;
      text += `--- ${dt.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ---\n`;
    }
    text += `[${timeStr}] [${cat.icon} ${cat.label}] ${log.content}\n`;
  }

  if (mode === 'clipboard') {
    navigator.clipboard.writeText(text).then(() => {
      _sjFlash('Copiado para clipboard!');
    }).catch(() => {
      _sjFlash('Erro ao copiar');
    });
  } else {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diario-sobrevivencia-dia${_journalDayCount()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    _sjFlash('Arquivo baixado!');
  }
}

function _sjFlash(msg) {
  const el = document.createElement('div');
  el.className = 'sj-flash';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2000);
}

function _startSjClock() {
  clearInterval(_clockInterval);
  _updateSjClock();
  _clockInterval = setInterval(_updateSjClock, 1000);
}

function _updateSjClock() {
  const el = document.getElementById('sjClock');
  if (!el) { clearInterval(_clockInterval); return; }
  const now = new Date();
  el.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function _updateSjTimestamp() {
  const el = document.getElementById('sjTimestamp');
  if (el) el.textContent = new Date().toLocaleString('pt-BR');
  setTimeout(_updateSjTimestamp, 10000);
}

// Keep legacy compat functions
function renderJournal(entries) {
  _journalEntries = entries;
  renderSurvivalJournal();
}

// Legacy compat stubs — old functions kept as no-ops
function _journalNavDates() { return []; }
function _startClock() {}
function _updateClock() {}
function renderJournalCalendar() {}
function shiftCalMonth() {}
function loadJournalStatus() {}
function renderJournalStatus() {}
function renderJournalEditor() {}
function navigateJournal() {}
function loadJournalDate() {}
function setJournalMood() {}
async function saveJournal() { await saveJournalLog(); }

// ─── Journal Audio Recording ────────────────────────────────────────────────

let _journalRecording = null;

function toggleJournalAudio() {
  if (_journalRecording) {
    // Stop recording
    const btn = document.getElementById('journalRecordBtn');
    const status = document.getElementById('journalAudioStatus');
    if (btn) btn.textContent = '🎤 Gravar Audio';
    if (status) status.textContent = 'Salvando...';

    _journalRecording.stop().then(blob => {
      _journalRecording = null;
      if (!blob || blob.size < 100) {
        if (status) status.textContent = '';
        return;
      }

      // Save audio blob as data URL in journal entry
      const reader = new FileReader();
      reader.onloadend = () => {
        const entry = _journalEntries.find(e => e.date === _journalCurrentDate);
        const audioItem = {
          url: reader.result,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
        if (entry) {
          if (!entry.audio) entry.audio = [];
          entry.audio.push(audioItem);
        } else {
          _journalEntries.push({ date: _journalCurrentDate, content: '', mood: null, audio: [audioItem] });
          _journalEntries.sort((a, b) => b.date.localeCompare(a.date));
        }
        // Save to localStorage
        try { localStorage.setItem('bunker_journal_audio_' + _journalCurrentDate, JSON.stringify(entry?.audio || [audioItem])); } catch {}
        if (status) status.textContent = '✓ Audio salvo';
        setTimeout(() => { if (status) status.textContent = ''; }, 2000);
        renderJournalEditor();
      };
      reader.readAsDataURL(blob);
    });
  } else {
    // Start recording
    const btn = document.getElementById('journalRecordBtn');
    const status = document.getElementById('journalAudioStatus');
    if (btn) btn.textContent = '⏹ Parar';
    if (status) status.textContent = '🔴 Gravando...';

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        _journalRecording._blob = new Blob(chunks, { type: recorder.mimeType });
      };
      _journalRecording = {
        stop: () => {
          if (recorder.state === 'recording') recorder.stop();
          return new Promise(resolve => {
            recorder.addEventListener('stop', () => resolve(_journalRecording._blob), { once: true });
            if (recorder.state !== 'recording') resolve(_journalRecording._blob);
          });
        },
        _blob: null,
      };
      recorder.start();
    }).catch(() => {
      if (btn) btn.textContent = '🎤 Gravar Audio';
      if (status) status.textContent = 'Microfone negado';
      _journalRecording = null;
    });
  }
}

function removeJournalAudio(idx) {
  const entry = _journalEntries.find(e => e.date === _journalCurrentDate);
  if (entry && entry.audio) {
    entry.audio.splice(idx, 1);
    try { localStorage.setItem('bunker_journal_audio_' + _journalCurrentDate, JSON.stringify(entry.audio)); } catch {}
    renderJournalEditor();
  }
}

async function transcribeJournalAudio(idx) {
  const entry = _journalEntries.find(e => e.date === _journalCurrentDate);
  if (!entry || !entry.audio || !entry.audio[idx]) return;

  const btn = document.getElementById('journalTranscribeBtn' + idx);
  if (btn) btn.textContent = '⏳';

  try {
    // Convert data URL back to blob
    const dataUrl = entry.audio[idx].url;
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();

    const fd = new FormData();
    fd.append('audio', blob, 'journal_audio.webm');
    fd.append('language', 'pt');

    const r = await fetch('/api/stt', { method: 'POST', body: fd });
    const d = await r.json();

    if (d.text && d.text.trim()) {
      entry.audio[idx].transcript = d.text.trim();
      try { localStorage.setItem('bunker_journal_audio_' + _journalCurrentDate, JSON.stringify(entry.audio)); } catch {}

      // Also append to journal text
      const textarea = document.getElementById('journalText');
      if (textarea) {
        const sep = textarea.value.trim() ? '\n\n' : '';
        textarea.value += sep + '🎤 ' + d.text.trim();
      }

      renderJournalEditor();
    } else {
      if (btn) btn.textContent = '❌';
      setTimeout(() => { if (btn) btn.textContent = '📝'; }, 2000);
    }
  } catch (e) {
    if (btn) btn.textContent = '❌';
    setTimeout(() => { if (btn) btn.textContent = '📝'; }, 2000);
  }
}

// Voice-to-text dictation (speak directly into journal textarea)
let _journalDictating = false;
let _journalDictateRecorder = null;

function toggleJournalDictate() {
  if (_journalDictating) {
    _stopJournalDictate();
  } else {
    _startJournalDictate();
  }
}

function _startJournalDictate() {
  const btn = document.getElementById('journalDictateBtn');
  const status = document.getElementById('journalAudioStatus');
  _journalDictating = true;

  if (state.sttEngine === 'whisper') {
    // Record with MediaRecorder → send to Whisper
    if (btn) { btn.textContent = '⏹ Parar'; btn.classList.add('recording'); }
    if (status) status.textContent = '🔴 Ditando...';
    const chunks = [];

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      _journalDictateRecorder = recorder;

      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (btn) { btn.textContent = '🗣️ Ditar'; btn.classList.remove('recording'); }
        if (status) status.textContent = 'Transcrevendo...';
        _journalDictating = false;
        _journalDictateRecorder = null;

        if (chunks.length === 0) { if (status) status.textContent = ''; return; }
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const fd = new FormData();
        fd.append('audio', blob, 'dictation.webm');
        fd.append('language', 'pt');

        try {
          const r = await fetch('/api/stt', { method: 'POST', body: fd });
          const d = await r.json();
          if (d.text && d.text.trim()) {
            const textarea = document.getElementById('journalText');
            if (textarea) {
              const sep = textarea.value.trim() ? ' ' : '';
              textarea.value += sep + d.text.trim();
            }
            if (status) status.textContent = '✓ Texto adicionado';
          } else {
            if (status) status.textContent = 'Nao entendi';
          }
          setTimeout(() => { if (status) status.textContent = ''; }, 2000);
        } catch {
          if (status) status.textContent = 'Erro na transcricao';
          setTimeout(() => { if (status) status.textContent = ''; }, 2000);
        }
      };
      recorder.start();
    }).catch(() => {
      if (btn) { btn.textContent = '🗣️ Ditar'; btn.classList.remove('recording'); }
      if (status) status.textContent = 'Microfone negado';
      _journalDictating = false;
    });

  } else {
    // Browser Web Speech API — real-time dictation
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      if (status) status.textContent = 'Sem suporte a voz';
      _journalDictating = false;
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = 'pt-BR';
    recog.continuous = true;
    recog.interimResults = true;
    _journalDictateRecorder = recog;

    if (btn) { btn.textContent = '⏹ Parar'; btn.classList.add('recording'); }
    if (status) status.textContent = '🔴 Ditando...';

    let finalText = '';
    recog.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (status) status.textContent = '🔴 ' + (interim || 'Ouvindo...');
    };
    recog.onend = () => {
      if (btn) { btn.textContent = '🗣️ Ditar'; btn.classList.remove('recording'); }
      _journalDictating = false;
      _journalDictateRecorder = null;
      if (finalText.trim()) {
        const textarea = document.getElementById('journalText');
        if (textarea) {
          const sep = textarea.value.trim() ? ' ' : '';
          textarea.value += sep + finalText.trim();
        }
        if (status) status.textContent = '✓ Texto adicionado';
      } else {
        if (status) status.textContent = '';
      }
      setTimeout(() => { if (status) status.textContent = ''; }, 2000);
    };
    recog.onerror = () => {
      if (btn) { btn.textContent = '🗣️ Ditar'; btn.classList.remove('recording'); }
      if (status) status.textContent = '';
      _journalDictating = false;
      _journalDictateRecorder = null;
    };
    recog.start();
  }
}

function _stopJournalDictate() {
  _journalDictating = false;
  if (_journalDictateRecorder) {
    _journalDictateRecorder.stop();
    _journalDictateRecorder = null;
  }
}

// ─── Companion Voice Input ──────────────────────────────────────────────────

let _companionRecorder = null;
let _companionAudioChunks = [];

function companionStartVoice() {
  const btn = document.getElementById('companionMicBtn');
  if (btn) btn.classList.add('recording');
  _companionAudioChunks = [];

  if (state.sttEngine === 'whisper') {
    // Record via MediaRecorder → send to /api/stt
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      _companionRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      _companionRecorder.ondataavailable = e => { if (e.data.size > 0) _companionAudioChunks.push(e.data); };
      _companionRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (btn) btn.classList.remove('recording');
        if (_companionAudioChunks.length === 0) return;

        const blob = new Blob(_companionAudioChunks, { type: 'audio/webm' });
        const fd = new FormData();
        fd.append('audio', blob, 'recording.webm');
        fd.append('language', 'pt');

        const input = document.getElementById('companionInput');
        if (input) input.value = 'Transcrevendo...';

        try {
          const r = await fetch('/api/stt', { method: 'POST', body: fd });
          const d = await r.json();
          if (d.text && d.text.trim()) {
            if (input) { input.value = d.text.trim(); input.focus(); }
          } else {
            if (input) input.value = '';
          }
        } catch {
          if (input) input.value = '';
        }
      };
      _companionRecorder.start();
    }).catch(() => {
      if (btn) btn.classList.remove('recording');
    });
  } else {
    // Browser Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      if (btn) btn.classList.remove('recording');
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = 'pt-BR';
    recog.continuous = true;
    recog.interimResults = true;
    _companionRecorder = recog;
    let finalText = '';

    recog.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      const input = document.getElementById('companionInput');
      if (input) input.value = finalText + interim;
    };
    recog.onend = () => {
      if (btn) btn.classList.remove('recording');
      if (finalText.trim()) {
        const input = document.getElementById('companionInput');
        if (input) { input.value = finalText.trim(); input.focus(); }
      }
      _companionRecorder = null;
    };
    recog.onerror = () => {
      if (btn) btn.classList.remove('recording');
      _companionRecorder = null;
    };
    recog.start();
  }
}

function companionStopVoice() {
  if (_companionRecorder) {
    if (_companionRecorder.stop) _companionRecorder.stop();
    _companionRecorder = null;
  }
}

// ─── MiniSearch (global search) ─────────────────────────────────────────────
function initSearch() {
  // MiniSearch is loaded via <script> tag in index.html
  // indexContent() is called after guides/protocols load
}

function indexContent() {
  if (typeof MiniSearch === 'undefined') return;
  const idx = new MiniSearch({
    fields: ['title', 'id'],
    storeFields: ['title', 'type', 'id'],
    searchOptions: { prefix: true, fuzzy: 0.2 }
  });
  setSearchIndex(idx);

  const docs = [];
  for (const g of window.guidesIndex) {
    docs.push({ id: 'guide-' + g.id, title: g.title, type: 'guide', _id: g.id });
  }
  for (const p of window.protocolsIndex) {
    docs.push({ id: 'proto-' + p.id, title: p.title, type: 'protocol', _id: p.id });
  }
  for (const g of window.gamesIndex) {
    docs.push({ id: 'game-' + (g.id||g.name), title: g.title||g.name, type: 'game', _id: g.id||g.name });
  }

  idx.addAll(docs);
}

function globalSearch(query) {
  const si = window.searchIndex;
  if (!si || !query.trim()) return [];
  return si.search(query).slice(0, 10);
}

function onSearchInput(query) {
  const results = globalSearch(query);
  const dropdown = document.getElementById('searchResults');
  if (!dropdown) return;

  if (!query.trim() || results.length === 0) {
    dropdown.classList.add('hidden');
    return;
  }

  const typeLabel = { guide: 'Guia', protocol: 'Protocolo', game: 'Jogo' };
  dropdown.innerHTML = results.map(r =>
    `<div class="search-result-item" onclick="openSearchResult('${r.type}', '${escapeHtml(r._id || r.id)}')">
      <div class="search-result-type">${typeLabel[r.type] || r.type}</div>
      <div class="search-result-title">${escapeHtml(r.title)}</div>
    </div>`
  ).join('');
  dropdown.classList.remove('hidden');
}

function openSearchResult(type, id) {
  document.getElementById('searchResults')?.classList.add('hidden');
  const searchEl = document.getElementById('globalSearch');
  if (searchEl) searchEl.value = '';
  if (type === 'guide') openGuide(id);
  else if (type === 'protocol') openProtocol(id);
  else if (type === 'game') openGame(id);
}

// ─── Utils ──────────────────────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM MONITOR — Live server stats
// ═══════════════════════════════════════════════════════════════════════════
let _sysmonInterval = null;

function sysmonInit() {
  sysmonRefresh();
  if (_sysmonInterval) clearInterval(_sysmonInterval);
  _sysmonInterval = setInterval(sysmonRefresh, 5000);
}

async function sysmonRefresh() {
  const el = document.getElementById('sysmonContent');
  if (!el) return;
  // If sysmon window is not open, stop
  const win = Object.values(_windows).find(w => w.appId === 'sysmon');
  if (!win) { clearInterval(_sysmonInterval); _sysmonInterval = null; return; }

  try {
    const r = await fetch('/api/status');
    const d = await r.json();
    const uptimeH = Math.floor(d.uptime_sec / 3600);
    const uptimeM = Math.floor((d.uptime_sec % 3600) / 60);

    const netIcon = d.internet ? '🟢 Online' : '🔴 Offline';
    const gpuText = d.gpu || 'Nenhuma detectada';
    const cpuText = d.cpu_count ? `${d.cpu_pct}% (${d.cpu_count} cores)` : `${d.cpu_pct}%`;

    el.innerHTML = `
      <div class="sysmon-grid">
        <div class="sysmon-card">
          <div class="sysmon-label">🖥 Sistema</div>
          <div class="sysmon-val">${d.hostname || 'bunker'}</div>
          <div class="sysmon-sub">${d.os} · ${d.arch || ''} · Python ${d.python}</div>
          <div class="sysmon-sub">IP: ${d.ip}:${d.port} · Uptime: ${uptimeH}h${uptimeM}m</div>
        </div>
        <div class="sysmon-card">
          <div class="sysmon-label">⚡ CPU</div>
          <div class="sysmon-bar"><div class="sysmon-bar-fill ${d.cpu_pct > 80 ? 'danger' : d.cpu_pct > 50 ? 'warn' : 'ok'}" style="width:${d.cpu_pct || 0}%"></div></div>
          <div class="sysmon-sub">${cpuText}</div>
        </div>
        <div class="sysmon-card">
          <div class="sysmon-label">🧠 RAM</div>
          <div class="sysmon-bar"><div class="sysmon-bar-fill ${d.ram_pct > 85 ? 'danger' : d.ram_pct > 60 ? 'warn' : 'ok'}" style="width:${d.ram_pct || 0}%"></div></div>
          <div class="sysmon-sub">${d.ram_used_mb || '?'} / ${d.ram_total_mb || '?'} MB (${d.ram_pct || '?'}%)</div>
        </div>
        <div class="sysmon-card">
          <div class="sysmon-label">💾 Disco</div>
          <div class="sysmon-bar"><div class="sysmon-bar-fill ${d.disk_pct > 90 ? 'danger' : d.disk_pct > 70 ? 'warn' : 'ok'}" style="width:${d.disk_pct || 0}%"></div></div>
          <div class="sysmon-sub">${d.disk_free_gb || '?'} GB livre de ${d.disk_total_gb || '?'} GB</div>
        </div>
        <div class="sysmon-card">
          <div class="sysmon-label">🎮 GPU</div>
          <div class="sysmon-sub">${gpuText}</div>
        </div>
        <div class="sysmon-card">
          <div class="sysmon-label">🌐 Rede</div>
          <div class="sysmon-sub">${netIcon}${d.offline_mode ? ' · Modo offline ativo' : ''}</div>
        </div>
        <div class="sysmon-card sysmon-wide">
          <div class="sysmon-label">📊 Conteudo</div>
          <div class="sysmon-content-grid">
            <span>📋 ${d.content?.guides || 0} guias</span>
            <span>🚨 ${d.content?.protocols || 0} protocolos</span>
            <span>📚 ${d.content?.books || 0} livros</span>
            <span>🎮 ${d.content?.games || 0} jogos</span>
            <span>🗺 ${d.content?.maps || 0} mapas</span>
            <span>🌐 ${d.content?.zim_files || 0} wikis</span>
          </div>
        </div>
      </div>
      <div class="sysmon-footer">${d.server_time?.slice(11, 19) || ''} · auto-refresh 5s</div>`;
  } catch (e) {
    el.innerHTML = `<div class="guide-error">Erro ao carregar status: ${e.message}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTEPAD APP — Plain text notes, multiple notes, SQLite storage
// ═══════════════════════════════════════════════════════════════════════════
let _notepadNotes = [];
let _notepadActiveId = null;
let _notepadDirty = false;

async function notepadInit() {
  await notepadLoadList();
}

async function notepadLoadList() {
  try {
    const r = await fetch('/api/notes?doc_type=text');
    _notepadNotes = await r.json();
  } catch { _notepadNotes = []; }
  notepadRenderList();
}

function notepadRenderList() {
  const el = document.getElementById('notepadList');
  if (!el) return;
  if (_notepadNotes.length === 0) {
    el.innerHTML = '<div class="notepad-list-empty">Nenhuma nota.<br>Clique + Nova Nota.</div>';
    return;
  }
  el.innerHTML = _notepadNotes.map(n => `
    <div class="notepad-list-item ${n.id === _notepadActiveId ? 'active' : ''}" onclick="notepadSelect(${n.id})">
      <div class="notepad-list-title">${escapeHtml(n.title || 'Sem titulo')}</div>
      <div class="notepad-list-date">${n.updated_at || ''}</div>
    </div>
  `).join('');
}

async function notepadSelect(id) {
  if (_notepadDirty && _notepadActiveId) await notepadSave();
  try {
    const r = await fetch(`/api/notes/${id}`);
    const note = await r.json();
    _notepadActiveId = note.id;
    document.getElementById('notepadTitle').value = note.title || '';
    document.getElementById('notepadTextarea').value = note.content || '';
    document.getElementById('notepadStatus').textContent = `Nota #${note.id} — ${note.updated_at || ''}`;
    document.getElementById('notepadSaveBtn').style.display = '';
    document.getElementById('notepadDeleteBtn').style.display = '';
    _notepadDirty = false;
    notepadRenderList();
  } catch(e) {
    document.getElementById('notepadStatus').textContent = 'Erro ao carregar nota';
  }
}

async function notepadNew() {
  if (_notepadDirty && _notepadActiveId) await notepadSave();
  try {
    const r = await fetch('/api/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nova nota', content: '', doc_type: 'text' })
    });
    const d = await r.json();
    await notepadLoadList();
    notepadSelect(d.id);
  } catch(e) {
    document.getElementById('notepadStatus').textContent = 'Erro ao criar nota';
  }
}

async function notepadSave() {
  if (!_notepadActiveId) return;
  const title = document.getElementById('notepadTitle').value;
  const content = document.getElementById('notepadTextarea').value;
  try {
    await fetch(`/api/notes/${_notepadActiveId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });
    _notepadDirty = false;
    document.getElementById('notepadStatus').textContent = 'Salvo!';
    // Update list title
    const n = _notepadNotes.find(x => x.id === _notepadActiveId);
    if (n) n.title = title;
    notepadRenderList();
  } catch(e) {
    document.getElementById('notepadStatus').textContent = 'Erro ao salvar';
  }
}

async function notepadDelete() {
  if (!_notepadActiveId) return;
  if (!confirm('Excluir esta nota?')) return;
  try {
    await fetch(`/api/notes/${_notepadActiveId}`, { method: 'DELETE' });
    _notepadActiveId = null;
    _notepadDirty = false;
    document.getElementById('notepadTitle').value = '';
    document.getElementById('notepadTextarea').value = '';
    document.getElementById('notepadStatus').textContent = 'Nota excluida';
    document.getElementById('notepadSaveBtn').style.display = 'none';
    document.getElementById('notepadDeleteBtn').style.display = 'none';
    await notepadLoadList();
  } catch(e) {
    document.getElementById('notepadStatus').textContent = 'Erro ao excluir';
  }
}

function notepadMarkDirty() { _notepadDirty = true; }


// ═══════════════════════════════════════════════════════════════════════════
// WORD SIMPLE — Rich text editor using contenteditable + execCommand
// ═══════════════════════════════════════════════════════════════════════════
let _wordNotes = [];
let _wordActiveId = null;
let _wordDirty = false;

async function wordInit() {
  await wordLoadList();
}

async function wordLoadList() {
  try {
    const r = await fetch('/api/notes?doc_type=html');
    _wordNotes = await r.json();
  } catch { _wordNotes = []; }
  wordRenderList();
}

function wordRenderList() {
  const el = document.getElementById('wordList');
  if (!el) return;
  if (_wordNotes.length === 0) {
    el.innerHTML = '<div class="notepad-list-empty">Nenhum documento.<br>Clique + Novo Doc.</div>';
    return;
  }
  el.innerHTML = _wordNotes.map(n => `
    <div class="notepad-list-item ${n.id === _wordActiveId ? 'active' : ''}" onclick="wordSelect(${n.id})">
      <div class="notepad-list-title">${escapeHtml(n.title || 'Sem titulo')}</div>
      <div class="notepad-list-date">${n.updated_at || ''}</div>
    </div>
  `).join('');
}

async function wordSelect(id) {
  if (_wordDirty && _wordActiveId) await wordSave();
  try {
    const r = await fetch(`/api/notes/${id}`);
    const note = await r.json();
    _wordActiveId = note.id;
    document.getElementById('wordTitle').value = note.title || '';
    document.getElementById('wordContent').innerHTML = note.content || '';
    document.getElementById('wordStatus').textContent = `Doc #${note.id} — ${note.updated_at || ''}`;
    document.getElementById('wordSaveBtn').style.display = '';
    document.getElementById('wordDeleteBtn').style.display = '';
    _wordDirty = false;
    wordRenderList();
  } catch(e) {
    document.getElementById('wordStatus').textContent = 'Erro ao carregar documento';
  }
}

async function wordNew() {
  if (_wordDirty && _wordActiveId) await wordSave();
  try {
    const r = await fetch('/api/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Novo documento', content: '<p></p>', doc_type: 'html' })
    });
    const d = await r.json();
    await wordLoadList();
    wordSelect(d.id);
  } catch(e) {
    document.getElementById('wordStatus').textContent = 'Erro ao criar documento';
  }
}

function wordExec(cmd, val) {
  document.execCommand(cmd, false, val || null);
  document.getElementById('wordContent').focus();
}

function wordExecBlock(tag) {
  if (!tag) return;
  document.execCommand('formatBlock', false, tag);
  document.getElementById('wordContent').focus();
}

async function wordSave() {
  if (!_wordActiveId) return;
  const title = document.getElementById('wordTitle').value;
  const content = document.getElementById('wordContent').innerHTML;
  try {
    await fetch(`/api/notes/${_wordActiveId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });
    _wordDirty = false;
    document.getElementById('wordStatus').textContent = 'Salvo!';
    const n = _wordNotes.find(x => x.id === _wordActiveId);
    if (n) n.title = title;
    wordRenderList();
  } catch(e) {
    document.getElementById('wordStatus').textContent = 'Erro ao salvar';
  }
}

async function wordDelete() {
  if (!_wordActiveId) return;
  if (!confirm('Excluir este documento?')) return;
  try {
    await fetch(`/api/notes/${_wordActiveId}`, { method: 'DELETE' });
    _wordActiveId = null;
    _wordDirty = false;
    document.getElementById('wordTitle').value = '';
    document.getElementById('wordContent').innerHTML = '';
    document.getElementById('wordStatus').textContent = 'Documento excluido';
    document.getElementById('wordSaveBtn').style.display = 'none';
    document.getElementById('wordDeleteBtn').style.display = 'none';
    await wordLoadList();
  } catch(e) {
    document.getElementById('wordStatus').textContent = 'Erro ao excluir';
  }
}

function wordMarkDirty() { _wordDirty = true; }


// ═══════════════════════════════════════════════════════════════════════════
// EXCEL SIMPLE — Spreadsheet grid with basic formulas
// ═══════════════════════════════════════════════════════════════════════════
const EXCEL_COLS = 10; // A-J
const EXCEL_ROWS = 30;
let _excelNotes = [];
let _excelActiveId = null;
let _excelDirty = false;
let _excelData = {};     // { "A1": "value", "B2": "=SUM(A1:A5)", ... }
let _excelSelectedCell = null;

async function excelInit() {
  await excelLoadList();
  excelBuildGrid();
}

function excelBuildGrid() {
  const table = document.getElementById('excelGrid');
  if (!table) return;
  let html = '<thead><tr><th class="excel-corner"></th>';
  for (let c = 0; c < EXCEL_COLS; c++) {
    html += `<th class="excel-col-header">${String.fromCharCode(65 + c)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (let r = 1; r <= EXCEL_ROWS; r++) {
    html += `<tr><td class="excel-row-header">${r}</td>`;
    for (let c = 0; c < EXCEL_COLS; c++) {
      const ref = String.fromCharCode(65 + c) + r;
      html += `<td class="excel-cell" data-ref="${ref}" onclick="excelSelectCell('${ref}')" ondblclick="excelEditCell('${ref}')"></td>`;
    }
    html += '</tr>';
  }
  html += '</tbody>';
  table.innerHTML = html;
}

function excelSelectCell(ref) {
  // Deselect previous
  document.querySelectorAll('.excel-cell.selected').forEach(c => c.classList.remove('selected'));
  const cell = document.querySelector(`.excel-cell[data-ref="${ref}"]`);
  if (cell) cell.classList.add('selected');
  _excelSelectedCell = ref;
  document.getElementById('excelCellRef').textContent = ref;
  const raw = _excelData[ref] || '';
  document.getElementById('excelFormulaInput').value = raw;
}

function excelEditCell(ref) {
  const input = document.getElementById('excelFormulaInput');
  input.focus();
  input.select();
}

function excelFormulaKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const ref = _excelSelectedCell;
    if (!ref) return;
    const val = document.getElementById('excelFormulaInput').value;
    _excelData[ref] = val;
    _excelDirty = true;
    excelRecalc();
    // Move to next row
    const col = ref.charAt(0);
    const row = parseInt(ref.slice(1));
    if (row < EXCEL_ROWS) excelSelectCell(col + (row + 1));
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    const ref = _excelSelectedCell;
    if (!ref) return;
    const val = document.getElementById('excelFormulaInput').value;
    _excelData[ref] = val;
    _excelDirty = true;
    excelRecalc();
    // Move to next column
    const col = ref.charCodeAt(0);
    const row = ref.slice(1);
    if (col < 65 + EXCEL_COLS - 1) excelSelectCell(String.fromCharCode(col + 1) + row);
  }
  if (e.key === 'Escape') {
    document.getElementById('excelFormulaInput').value = _excelData[_excelSelectedCell] || '';
  }
}

function excelRecalc() {
  // Evaluate all cells
  for (let r = 1; r <= EXCEL_ROWS; r++) {
    for (let c = 0; c < EXCEL_COLS; c++) {
      const ref = String.fromCharCode(65 + c) + r;
      const cell = document.querySelector(`.excel-cell[data-ref="${ref}"]`);
      if (!cell) continue;
      const raw = _excelData[ref];
      if (!raw) { cell.textContent = ''; continue; }
      if (typeof raw === 'string' && raw.startsWith('=')) {
        try {
          cell.textContent = excelEvalFormula(raw.slice(1));
          cell.classList.remove('excel-cell-error');
        } catch {
          cell.textContent = '#ERR';
          cell.classList.add('excel-cell-error');
        }
      } else {
        cell.textContent = raw;
        cell.classList.remove('excel-cell-error');
      }
    }
  }
}

function excelCellValue(ref) {
  const raw = _excelData[ref.toUpperCase()];
  if (!raw) return 0;
  if (typeof raw === 'string' && raw.startsWith('=')) {
    return excelEvalFormula(raw.slice(1));
  }
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : n;
}

function excelExpandRange(rangeStr) {
  // "A1:B3" → ["A1","A2","A3","B1","B2","B3"]
  const parts = rangeStr.toUpperCase().split(':');
  if (parts.length !== 2) return [rangeStr.toUpperCase()];
  const c1 = parts[0].charCodeAt(0), r1 = parseInt(parts[0].slice(1));
  const c2 = parts[1].charCodeAt(0), r2 = parseInt(parts[1].slice(1));
  const refs = [];
  for (let c = Math.min(c1,c2); c <= Math.max(c1,c2); c++) {
    for (let r = Math.min(r1,r2); r <= Math.max(r1,r2); r++) {
      refs.push(String.fromCharCode(c) + r);
    }
  }
  return refs;
}

function excelEvalFormula(expr) {
  const upper = expr.toUpperCase().trim();
  // SUM(range)
  let m = upper.match(/^SUM\((.+)\)$/);
  if (m) {
    const refs = excelExpandRange(m[1]);
    return refs.reduce((s, r) => s + excelCellValue(r), 0);
  }
  // AVG / AVERAGE(range)
  m = upper.match(/^(?:AVG|AVERAGE)\((.+)\)$/);
  if (m) {
    const refs = excelExpandRange(m[1]);
    const sum = refs.reduce((s, r) => s + excelCellValue(r), 0);
    return refs.length ? sum / refs.length : 0;
  }
  // COUNT(range)
  m = upper.match(/^COUNT\((.+)\)$/);
  if (m) {
    const refs = excelExpandRange(m[1]);
    return refs.filter(r => _excelData[r] && _excelData[r] !== '').length;
  }
  // MIN(range)
  m = upper.match(/^MIN\((.+)\)$/);
  if (m) {
    const refs = excelExpandRange(m[1]);
    const vals = refs.map(r => excelCellValue(r));
    return vals.length ? Math.min(...vals) : 0;
  }
  // MAX(range)
  m = upper.match(/^MAX\((.+)\)$/);
  if (m) {
    const refs = excelExpandRange(m[1]);
    const vals = refs.map(r => excelCellValue(r));
    return vals.length ? Math.max(...vals) : 0;
  }
  // IF(cond, then, else) — simple
  m = upper.match(/^IF\((.+),(.+),(.+)\)$/);
  if (m) {
    const cond = excelEvalSimple(m[1].trim());
    return cond ? excelEvalSimple(m[2].trim()) : excelEvalSimple(m[3].trim());
  }
  // Simple arithmetic: cell refs + numbers + operators
  return excelEvalSimple(upper);
}

function excelEvalSimple(expr) {
  // Replace cell references with their values
  let replaced = expr.replace(/[A-J]\d{1,2}/g, (ref) => {
    return excelCellValue(ref);
  });
  // Safe eval: only allow numbers, operators, parens
  if (/^[\d\s\+\-\*\/\.\(\)<>=!&|]+$/.test(replaced)) {
    try { return Function('"use strict"; return (' + replaced + ')')(); }
    catch { return 0; }
  }
  return 0;
}

async function excelLoadList() {
  try {
    const r = await fetch('/api/notes?doc_type=spreadsheet');
    _excelNotes = await r.json();
  } catch { _excelNotes = []; }
  excelRenderList();
}

function excelRenderList() {
  const el = document.getElementById('excelList');
  if (!el) return;
  if (_excelNotes.length === 0) {
    el.innerHTML = '<div class="notepad-list-empty">Nenhuma planilha.<br>Clique + Nova Planilha.</div>';
    return;
  }
  el.innerHTML = _excelNotes.map(n => `
    <div class="notepad-list-item ${n.id === _excelActiveId ? 'active' : ''}" onclick="excelSelect(${n.id})">
      <div class="notepad-list-title">${escapeHtml(n.title || 'Sem titulo')}</div>
      <div class="notepad-list-date">${n.updated_at || ''}</div>
    </div>
  `).join('');
}

async function excelSelect(id) {
  if (_excelDirty && _excelActiveId) await excelSave();
  try {
    const r = await fetch(`/api/notes/${id}`);
    const note = await r.json();
    _excelActiveId = note.id;
    document.getElementById('excelTitle').value = note.title || '';
    try { _excelData = JSON.parse(note.content || '{}'); } catch { _excelData = {}; }
    document.getElementById('excelStatus').textContent = `Planilha #${note.id}`;
    document.getElementById('excelSaveBtn').style.display = '';
    document.getElementById('excelDeleteBtn').style.display = '';
    _excelDirty = false;
    excelBuildGrid();
    excelRecalc();
    excelRenderList();
  } catch(e) {
    document.getElementById('excelStatus').textContent = 'Erro ao carregar planilha';
  }
}

async function excelNew() {
  if (_excelDirty && _excelActiveId) await excelSave();
  try {
    const r = await fetch('/api/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nova planilha', content: '{}', doc_type: 'spreadsheet' })
    });
    const d = await r.json();
    await excelLoadList();
    excelSelect(d.id);
  } catch(e) {
    document.getElementById('excelStatus').textContent = 'Erro ao criar planilha';
  }
}

async function excelSave() {
  if (!_excelActiveId) return;
  const title = document.getElementById('excelTitle').value;
  try {
    await fetch(`/api/notes/${_excelActiveId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content: JSON.stringify(_excelData) })
    });
    _excelDirty = false;
    document.getElementById('excelStatus').textContent = 'Salvo!';
    const n = _excelNotes.find(x => x.id === _excelActiveId);
    if (n) n.title = title;
    excelRenderList();
  } catch(e) {
    document.getElementById('excelStatus').textContent = 'Erro ao salvar';
  }
}

async function excelDelete() {
  if (!_excelActiveId) return;
  if (!confirm('Excluir esta planilha?')) return;
  try {
    await fetch(`/api/notes/${_excelActiveId}`, { method: 'DELETE' });
    _excelActiveId = null;
    _excelDirty = false;
    _excelData = {};
    document.getElementById('excelTitle').value = '';
    document.getElementById('excelStatus').textContent = 'Planilha excluida';
    document.getElementById('excelSaveBtn').style.display = 'none';
    document.getElementById('excelDeleteBtn').style.display = 'none';
    excelBuildGrid();
    await excelLoadList();
  } catch(e) {
    document.getElementById('excelStatus').textContent = 'Erro ao excluir';
  }
}

function excelMarkDirty() { _excelDirty = true; }

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATOR APP
// ═══════════════════════════════════════════════════════════════════════════

let _calcDisplay = '0';
let _calcPrev = null;
let _calcOp = null;
let _calcReset = false;
let _calcHistory = [];
let _calcSci = false;
let _calcExpr = ''; // expression string for history

function calcInit() {
  calcRender();
  calcRenderHistory();
}

function calcRender() {
  const display = document.getElementById('calcDisplay');
  if (display) display.textContent = _calcDisplay;
}

function calcRenderHistory() {
  const hist = document.getElementById('calcHistory');
  if (!hist) return;
  if (_calcHistory.length === 0) { hist.innerHTML = ''; return; }
  hist.innerHTML = _calcHistory.slice(-5).reverse().map(h =>
    `<div class="calc-hist-item">${escapeHtml(h)}</div>`
  ).join('');
}

function calcInput(val) {
  if (_calcReset) { _calcDisplay = ''; _calcReset = false; }
  if (val === '.' && _calcDisplay.includes('.')) return;
  if (_calcDisplay === '0' && val !== '.') _calcDisplay = '';
  _calcDisplay += val;
  calcRender();
}

function calcOp(op) {
  if (_calcPrev !== null && _calcOp && !_calcReset) {
    calcEquals();
  }
  _calcExpr = _calcDisplay + ' ' + {'+':'+','-':'−','*':'×','/':'÷','**':'^'}[op];
  _calcPrev = parseFloat(_calcDisplay);
  _calcOp = op;
  _calcReset = true;
}

function calcEquals() {
  if (_calcPrev === null || !_calcOp) return;
  const curr = parseFloat(_calcDisplay);
  let result;
  const opSym = {'+':'+','-':'−','*':'×','/':'÷','**':'^'}[_calcOp] || _calcOp;
  switch (_calcOp) {
    case '+': result = _calcPrev + curr; break;
    case '-': result = _calcPrev - curr; break;
    case '*': result = _calcPrev * curr; break;
    case '/': result = curr === 0 ? 'Erro' : _calcPrev / curr; break;
    case '**': result = Math.pow(_calcPrev, curr); break;
    default: return;
  }
  const resultStr = typeof result === 'number' ? String(parseFloat(result.toFixed(10))) : result;
  _calcHistory.push(`${_calcPrev} ${opSym} ${curr} = ${resultStr}`);
  if (_calcHistory.length > 20) _calcHistory.shift();
  _calcDisplay = resultStr;
  _calcPrev = null;
  _calcOp = null;
  _calcReset = true;
  calcRender();
  calcRenderHistory();
}

function calcSciFn(fn) {
  const val = parseFloat(_calcDisplay);
  let result;
  switch (fn) {
    case 'sin': result = Math.sin(val * Math.PI / 180); break;
    case 'cos': result = Math.cos(val * Math.PI / 180); break;
    case 'tan': result = Math.tan(val * Math.PI / 180); break;
    case 'log': result = val <= 0 ? 'Erro' : Math.log10(val); break;
    case 'ln': result = val <= 0 ? 'Erro' : Math.log(val); break;
    case 'sqrt': result = val < 0 ? 'Erro' : Math.sqrt(val); break;
    case 'sq': result = val * val; break;
    case 'inv': result = val === 0 ? 'Erro' : 1 / val; break;
    case 'pi': _calcDisplay = String(Math.PI); calcRender(); return;
    case 'e': _calcDisplay = String(Math.E); calcRender(); return;
    case 'abs': result = Math.abs(val); break;
    default: return;
  }
  const resultStr = typeof result === 'number' ? String(parseFloat(result.toFixed(10))) : result;
  _calcHistory.push(`${fn}(${val}) = ${resultStr}`);
  if (_calcHistory.length > 20) _calcHistory.shift();
  _calcDisplay = resultStr;
  _calcReset = true;
  calcRender();
  calcRenderHistory();
}

function calcToggleSci() {
  _calcSci = !_calcSci;
  const grid = document.getElementById('calcSciGrid');
  const btn = document.getElementById('calcSciToggle');
  if (grid) grid.classList.toggle('hidden', !_calcSci);
  if (btn) btn.classList.toggle('calc-mode-active', _calcSci);
}

function calcClear() {
  _calcDisplay = '0';
  _calcPrev = null;
  _calcOp = null;
  _calcReset = false;
  calcRender();
}

function calcBackspace() {
  if (_calcDisplay.length > 1) _calcDisplay = _calcDisplay.slice(0, -1);
  else _calcDisplay = '0';
  calcRender();
}

function calcPercent() {
  _calcDisplay = String(parseFloat(_calcDisplay) / 100);
  calcRender();
}

function calcNegate() {
  if (_calcDisplay !== '0') {
    _calcDisplay = _calcDisplay.startsWith('-') ? _calcDisplay.slice(1) : '-' + _calcDisplay;
    calcRender();
  }
}

// Keyboard support for calculator
document.addEventListener('keydown', (e) => {
  // Only if calculator window is visible and focused
  const calcView = document.getElementById('calcView');
  if (!calcView || calcView.classList.contains('hidden')) return;
  // Don't hijack input elements
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key >= '0' && e.key <= '9') { calcInput(e.key); e.preventDefault(); }
  else if (e.key === '.') { calcInput('.'); e.preventDefault(); }
  else if (e.key === '+') { calcOp('+'); e.preventDefault(); }
  else if (e.key === '-') { calcOp('-'); e.preventDefault(); }
  else if (e.key === '*') { calcOp('*'); e.preventDefault(); }
  else if (e.key === '/') { calcOp('/'); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === '=') { calcEquals(); e.preventDefault(); }
  else if (e.key === 'Backspace') { calcBackspace(); e.preventDefault(); }
  else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') { calcClear(); e.preventDefault(); }
});

// ═══════════════════════════════════════════════════════════════════════════
// TIMER / STOPWATCH APP
// ═══════════════════════════════════════════════════════════════════════════

let _timerInterval = null;
let _timerMode = 'stopwatch'; // 'stopwatch' | 'countdown'
let _timerMs = 0;
let _timerRunning = false;
let _timerCountdownTarget = 0; // ms
let _timerLaps = [];

function timerInit() {
  timerRender();
}

function timerFormatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

function timerRender() {
  const display = document.getElementById('timerDisplay');
  const startBtn = document.getElementById('timerStartBtn');
  const lapBtn = document.getElementById('timerLapBtn');
  const lapsEl = document.getElementById('timerLaps');
  const modeEl = document.getElementById('timerMode');
  const countdownSetup = document.getElementById('countdownSetup');

  if (display) display.textContent = timerFormatTime(_timerMs);
  if (startBtn) startBtn.textContent = _timerRunning ? '⏸ Pausar' : '▶ Iniciar';
  if (startBtn) startBtn.className = _timerRunning ? 'calc-btn calc-op' : 'calc-btn calc-eq';
  if (lapBtn) lapBtn.style.display = _timerMode === 'stopwatch' ? '' : 'none';
  if (modeEl) modeEl.textContent = _timerMode === 'stopwatch' ? 'Cronometro' : 'Contagem Regressiva';
  if (countdownSetup) countdownSetup.style.display = (!_timerRunning && _timerMode === 'countdown') ? '' : 'none';

  if (lapsEl) {
    lapsEl.innerHTML = _timerLaps.map((lap, i) =>
      `<div class="timer-lap"><span>Volta ${i+1}</span><span>${timerFormatTime(lap)}</span></div>`
    ).join('');
  }
}

function timerToggle() {
  if (_timerRunning) {
    // Pause
    clearInterval(_timerInterval);
    _timerInterval = null;
    _timerRunning = false;
  } else {
    // Start
    if (_timerMode === 'countdown' && _timerMs === 0) {
      // Read countdown values
      const mm = parseInt(document.getElementById('countdownMin')?.value || '0');
      const ss = parseInt(document.getElementById('countdownSec')?.value || '0');
      _timerMs = (mm * 60 + ss) * 1000;
      _timerCountdownTarget = _timerMs;
      if (_timerMs <= 0) return;
    }
    _timerRunning = true;
    const startTime = Date.now() - (_timerMode === 'stopwatch' ? _timerMs : 0);
    _timerInterval = setInterval(() => {
      if (_timerMode === 'stopwatch') {
        _timerMs = Date.now() - startTime;
      } else {
        _timerMs -= 100;
        if (_timerMs <= 0) {
          _timerMs = 0;
          clearInterval(_timerInterval);
          _timerInterval = null;
          _timerRunning = false;
          osToast('⏰ Timer finalizado!');
          // Play alert sound via beep
          try { const ctx = new AudioContext(); const osc = ctx.createOscillator(); osc.connect(ctx.destination); osc.frequency.value = 880; osc.start(); setTimeout(() => osc.stop(), 500); } catch {}
        }
      }
      timerRender();
    }, 100);
  }
  timerRender();
}

function timerReset() {
  clearInterval(_timerInterval);
  _timerInterval = null;
  _timerRunning = false;
  _timerMs = 0;
  _timerLaps = [];
  timerRender();
}

function timerLap() {
  if (_timerRunning && _timerMode === 'stopwatch') {
    _timerLaps.push(_timerMs);
    timerRender();
  }
}

function timerSwitchMode() {
  timerReset();
  _timerMode = _timerMode === 'stopwatch' ? 'countdown' : 'stopwatch';
  timerRender();
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIT CONVERTER APP — Universal Survival Converter
// ═══════════════════════════════════════════════════════════════════════════

const CONV_CATEGORIES = {
  'Temperatura': {
    icon: '\u{1F321}',
    units: ['\u00B0C', '\u00B0F', 'K'],
    labels: { '\u00B0C': 'Celsius', '\u00B0F': 'Fahrenheit', 'K': 'Kelvin' },
    convert: (val, from, to) => {
      let c;
      if (from === '\u00B0C') c = val;
      else if (from === '\u00B0F') c = (val - 32) * 5/9;
      else c = val - 273.15;
      if (to === '\u00B0C') return c;
      if (to === '\u00B0F') return c * 9/5 + 32;
      return c + 273.15;
    }
  },
  'Distancia': {
    icon: '\u{1F4CF}',
    units: ['m', 'km', 'cm', 'mm', 'mi', 'yd', 'ft', 'in', 'nmi'],
    labels: { m:'Metro', km:'Quilometro', cm:'Centimetro', mm:'Milimetro', mi:'Milha', yd:'Jarda', ft:'Pe', 'in':'Polegada', nmi:'Milha Nautica' },
    factors: { m:1, km:1000, cm:0.01, mm:0.001, mi:1609.344, yd:0.9144, ft:0.3048, 'in':0.0254, nmi:1852 }
  },
  'Peso': {
    icon: '\u2696',
    units: ['kg', 'g', 'mg', 'lb', 'oz', 'ton', 'st'],
    labels: { kg:'Quilograma', g:'Grama', mg:'Miligrama', lb:'Libra', oz:'Onca', ton:'Tonelada', st:'Stone' },
    factors: { kg:1, g:0.001, mg:0.000001, lb:0.453592, oz:0.0283495, ton:1000, st:6.35029 }
  },
  'Volume': {
    icon: '\u{1F4A7}',
    units: ['L', 'mL', 'gal', 'qt', 'pt', 'cup', 'fl oz', 'm\u00B3'],
    labels: { L:'Litro', mL:'Mililitro', gal:'Galao (US)', qt:'Quarto', pt:'Pint', cup:'Xicara', 'fl oz':'Onca Fluida', 'm\u00B3':'Metro Cubico' },
    factors: { L:1, mL:0.001, gal:3.78541, qt:0.946353, pt:0.473176, cup:0.236588, 'fl oz':0.0295735, 'm\u00B3':1000 }
  },
  'Velocidade': {
    icon: '\u{1F3CE}',
    units: ['km/h', 'm/s', 'mph', 'knots', 'ft/s'],
    labels: { 'km/h':'km por hora', 'm/s':'metros por seg', 'mph':'milhas por hora', 'knots':'Nos', 'ft/s':'pes por seg' },
    factors: { 'km/h':1, 'm/s':3.6, 'mph':1.60934, 'knots':1.852, 'ft/s':1.09728 }
  },
  'Pressao': {
    icon: '\u{1F4A8}',
    units: ['atm', 'Pa', 'kPa', 'bar', 'psi', 'mmHg', 'inHg'],
    labels: { atm:'Atmosfera', Pa:'Pascal', kPa:'Kilopascal', bar:'Bar', psi:'PSI', mmHg:'mmHg', inHg:'inHg' },
    factors: { atm:1, Pa:0.00000986923, kPa:0.00986923, bar:0.986923, psi:0.068046, mmHg:0.00131579, inHg:0.0334211 }
  },
  'Area': {
    icon: '\u2B1B',
    units: ['m\u00B2', 'km\u00B2', 'ha', 'acre', 'ft\u00B2', 'yd\u00B2', 'mi\u00B2'],
    labels: { 'm\u00B2':'Metro Quad.', 'km\u00B2':'Quilom. Quad.', ha:'Hectare', acre:'Acre', 'ft\u00B2':'Pe Quad.', 'yd\u00B2':'Jarda Quad.', 'mi\u00B2':'Milha Quad.' },
    factors: { 'm\u00B2':1, 'km\u00B2':1000000, ha:10000, acre:4046.86, 'ft\u00B2':0.092903, 'yd\u00B2':0.836127, 'mi\u00B2':2589988.11 }
  },
  'Energia': {
    icon: '\u26A1',
    units: ['J', 'kJ', 'cal', 'kcal', 'Wh', 'kWh', 'BTU'],
    labels: { J:'Joule', kJ:'Kilojoule', cal:'Caloria', kcal:'Kilocaloria', Wh:'Watt-hora', kWh:'Kilowatt-hora', BTU:'BTU' },
    factors: { J:1, kJ:1000, cal:4.184, kcal:4184, Wh:3600, kWh:3600000, BTU:1055.06 }
  }
};

// Quick reference table for survival conversions
const CONV_QUICK_REF = [
  { from: '1 mi',    to: '1.609 km',    cat: 'Distancia' },
  { from: '1 ft',    to: '0.305 m',     cat: 'Distancia' },
  { from: '1 in',    to: '2.54 cm',     cat: 'Distancia' },
  { from: '1 yd',    to: '0.914 m',     cat: 'Distancia' },
  { from: '32\u00B0F',  to: '0\u00B0C',       cat: 'Temperatura' },
  { from: '212\u00B0F', to: '100\u00B0C',     cat: 'Temperatura' },
  { from: '98.6\u00B0F',to: '37\u00B0C',      cat: 'Temperatura' },
  { from: '1 gal',   to: '3.785 L',     cat: 'Volume' },
  { from: '1 qt',    to: '0.946 L',     cat: 'Volume' },
  { from: '1 cup',   to: '236.6 mL',    cat: 'Volume' },
  { from: '1 lb',    to: '0.454 kg',    cat: 'Peso' },
  { from: '1 oz',    to: '28.35 g',     cat: 'Peso' },
  { from: '1 acre',  to: '0.405 ha',    cat: 'Area' },
  { from: '1 psi',   to: '6.895 kPa',   cat: 'Pressao' },
  { from: '1 mph',   to: '1.609 km/h',  cat: 'Velocidade' },
  { from: '1 knot',  to: '1.852 km/h',  cat: 'Velocidade' },
  { from: '1 kcal',  to: '4.184 kJ',    cat: 'Energia' },
  { from: '1 kWh',   to: '3600 kJ',     cat: 'Energia' },
];

let _convCategory = 'Temperatura';
let _convTab = 'convert'; // 'convert' | 'favorites' | 'reference'
let _convFavorites = JSON.parse(localStorage.getItem('bunker_conv_favorites') || '[]');
let _convLastInput = 'from'; // track which input was last typed into

function converterInit() {
  // Build category pills
  const catBar = document.getElementById('convCatBar');
  if (!catBar) return;
  if (catBar.children.length === 0) {
    Object.entries(CONV_CATEGORIES).forEach(([key, cfg]) => {
      const btn = document.createElement('button');
      btn.className = 'conv-cat-pill' + (key === _convCategory ? ' active' : '');
      btn.dataset.cat = key;
      btn.innerHTML = `<span class="conv-cat-icon">${cfg.icon}</span><span>${key}</span>`;
      btn.onclick = () => converterSelectCategory(key);
      catBar.appendChild(btn);
    });
  }
  converterUpdateUnits();
  converterSetTab(_convTab);
}

function converterSelectCategory(cat) {
  _convCategory = cat;
  document.querySelectorAll('.conv-cat-pill').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
  converterUpdateUnits();
}

function converterUpdateUnits() {
  const cfg = CONV_CATEGORIES[_convCategory];
  if (!cfg) return;
  const fromSel = document.getElementById('convFrom');
  const toSel = document.getElementById('convTo');
  if (!fromSel || !toSel) return;
  const prevFrom = fromSel.value;
  const prevTo = toSel.value;
  fromSel.innerHTML = '';
  toSel.innerHTML = '';
  cfg.units.forEach((u, i) => {
    const lbl = cfg.labels ? cfg.labels[u] : u;
    fromSel.innerHTML += `<option value="${u}">${u} - ${lbl}</option>`;
    toSel.innerHTML += `<option value="${u}">${u} - ${lbl}</option>`;
  });
  // Restore previous selection if still valid
  if (cfg.units.includes(prevFrom)) fromSel.value = prevFrom;
  else fromSel.selectedIndex = 0;
  if (cfg.units.includes(prevTo)) toSel.value = prevTo;
  else toSel.selectedIndex = Math.min(1, cfg.units.length - 1);
  converterCalc('from');
  converterUpdateFavStar();
}

function converterCalc(source) {
  if (source) _convLastInput = source;
  const cfg = CONV_CATEGORIES[_convCategory];
  if (!cfg) return;
  const fromEl = document.getElementById('convInputFrom');
  const toEl = document.getElementById('convInputTo');
  const fromUnit = document.getElementById('convFrom')?.value;
  const toUnit = document.getElementById('convTo')?.value;
  if (!fromEl || !toEl || !fromUnit || !toUnit) return;

  if (_convLastInput === 'from') {
    const val = parseFloat(fromEl.value);
    if (isNaN(val)) { toEl.value = ''; return; }
    const result = _convConvert(cfg, val, fromUnit, toUnit);
    toEl.value = isNaN(result) ? '' : _convFormatNum(result);
  } else {
    const val = parseFloat(toEl.value);
    if (isNaN(val)) { fromEl.value = ''; return; }
    const result = _convConvert(cfg, val, toUnit, fromUnit);
    fromEl.value = isNaN(result) ? '' : _convFormatNum(result);
  }
}

function _convConvert(cfg, val, from, to) {
  if (from === to) return val;
  if (cfg.convert) return cfg.convert(val, from, to);
  const baseVal = val * cfg.factors[from];
  return baseVal / cfg.factors[to];
}

function _convFormatNum(n) {
  if (Number.isInteger(n) && Math.abs(n) < 1e12) return n.toString();
  const s = n.toPrecision(10);
  return parseFloat(s).toString();
}

function converterSwap() {
  const fromSel = document.getElementById('convFrom');
  const toSel = document.getElementById('convTo');
  const fromEl = document.getElementById('convInputFrom');
  const toEl = document.getElementById('convInputTo');
  if (!fromSel || !toSel) return;
  const tmpU = fromSel.value;
  fromSel.value = toSel.value;
  toSel.value = tmpU;
  if (fromEl && toEl) {
    const tmpV = fromEl.value;
    fromEl.value = toEl.value;
    toEl.value = tmpV;
  }
  converterUpdateFavStar();
}

// ── Tab navigation ──
function converterSetTab(tab) {
  _convTab = tab;
  document.querySelectorAll('.conv-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('convPanelConvert').classList.toggle('hidden', tab !== 'convert');
  document.getElementById('convPanelFavorites').classList.toggle('hidden', tab !== 'favorites');
  document.getElementById('convPanelReference').classList.toggle('hidden', tab !== 'reference');
  if (tab === 'favorites') converterRenderFavorites();
  if (tab === 'reference') converterRenderReference();
}

// ── Favorites system ──
function converterToggleFav() {
  const from = document.getElementById('convFrom')?.value;
  const to = document.getElementById('convTo')?.value;
  if (!from || !to) return;
  const key = `${_convCategory}|${from}|${to}`;
  const idx = _convFavorites.indexOf(key);
  if (idx >= 0) _convFavorites.splice(idx, 1);
  else _convFavorites.push(key);
  localStorage.setItem('bunker_conv_favorites', JSON.stringify(_convFavorites));
  converterUpdateFavStar();
}

function converterUpdateFavStar() {
  const from = document.getElementById('convFrom')?.value;
  const to = document.getElementById('convTo')?.value;
  const btn = document.getElementById('convFavBtn');
  if (!btn || !from || !to) return;
  const key = `${_convCategory}|${from}|${to}`;
  const isFav = _convFavorites.includes(key);
  btn.innerHTML = isFav ? '\u2605' : '\u2606';
  btn.title = isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
  btn.classList.toggle('conv-fav-active', isFav);
}

function converterRenderFavorites() {
  const container = document.getElementById('convFavList');
  if (!container) return;
  if (_convFavorites.length === 0) {
    container.innerHTML = '<div class="conv-empty">Nenhum favorito salvo.<br>Use a \u2606 no conversor para adicionar.</div>';
    return;
  }
  container.innerHTML = _convFavorites.map((key, i) => {
    const [cat, from, to] = key.split('|');
    const cfg = CONV_CATEGORIES[cat];
    if (!cfg) return '';
    const icon = cfg.icon || '';
    return `<div class="conv-fav-item" onclick="converterLoadFav(${i})">
      <span class="conv-fav-icon">${icon}</span>
      <span class="conv-fav-label">${cat}: ${from} \u2194 ${to}</span>
      <button class="conv-fav-del" onclick="event.stopPropagation();converterDelFav(${i})" title="Remover">\u2715</button>
    </div>`;
  }).join('');
}

function converterLoadFav(idx) {
  const key = _convFavorites[idx];
  if (!key) return;
  const [cat, from, to] = key.split('|');
  converterSelectCategory(cat);
  setTimeout(() => {
    const fromSel = document.getElementById('convFrom');
    const toSel = document.getElementById('convTo');
    if (fromSel) fromSel.value = from;
    if (toSel) toSel.value = to;
    converterCalc('from');
    converterUpdateFavStar();
    converterSetTab('convert');
  }, 50);
}

function converterDelFav(idx) {
  _convFavorites.splice(idx, 1);
  localStorage.setItem('bunker_conv_favorites', JSON.stringify(_convFavorites));
  converterRenderFavorites();
  converterUpdateFavStar();
}

// ── Quick Reference table ──
function converterRenderReference() {
  const container = document.getElementById('convRefTable');
  if (!container) return;
  const filterCat = document.getElementById('convRefFilter')?.value || '';
  const items = filterCat ? CONV_QUICK_REF.filter(r => r.cat === filterCat) : CONV_QUICK_REF;
  container.innerHTML = `<table class="conv-ref-tbl">
    <thead><tr><th>De</th><th>Para</th><th>Categoria</th></tr></thead>
    <tbody>${items.map(r => {
      const ico = CONV_CATEGORIES[r.cat]?.icon || '';
      return `<tr><td>${r.from}</td><td>${r.to}</td><td>${ico} ${r.cat}</td></tr>`;
    }).join('')}</tbody>
  </table>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECKLIST APP
// ═══════════════════════════════════════════════════════════════════════════

let _checklists = [];
let _checklistActiveId = null;
let _checklistItems = []; // [{ text, done }]
let _checklistDirty = false;

async function checklistInit() {
  await checklistLoadList();
}

async function checklistLoadList() {
  try {
    const r = await fetch('/api/notes?doc_type=checklist');
    _checklists = await r.json();
  } catch { _checklists = []; }
  checklistRenderList();
}

function checklistRenderList() {
  const el = document.getElementById('checklistList');
  if (!el) return;
  if (_checklists.length === 0) {
    el.innerHTML = '<div class="notepad-list-empty">Nenhuma checklist.<br>Clique + Nova.</div>';
    return;
  }
  el.innerHTML = _checklists.map(n => {
    let items = [];
    try { items = JSON.parse(n.content || '[]'); } catch {}
    const done = items.filter(i => i.done).length;
    const total = items.length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    return `
      <div class="notepad-list-item ${n.id === _checklistActiveId ? 'active' : ''}" onclick="checklistSelect(${n.id})">
        <div class="notepad-list-title">${escapeHtml(n.title || 'Sem titulo')}</div>
        <div class="notepad-list-date">${total > 0 ? done+'/'+total+' ('+pct+'%)' : 'vazia'}</div>
      </div>`;
  }).join('');
}

async function checklistSelect(id) {
  if (_checklistDirty && _checklistActiveId) await checklistSave();
  try {
    const r = await fetch(`/api/notes/${id}`);
    const note = await r.json();
    _checklistActiveId = note.id;
    document.getElementById('checklistTitle').value = note.title || '';
    try { _checklistItems = JSON.parse(note.content || '[]'); } catch { _checklistItems = []; }
    _checklistDirty = false;
    checklistRenderItems();
    checklistRenderList();
  } catch(e) { console.error(e); }
}

function checklistRenderItems() {
  const el = document.getElementById('checklistItems');
  if (!el) return;
  if (!_checklistActiveId) {
    el.innerHTML = '<div class="notepad-list-empty">Selecione ou crie uma checklist</div>';
    return;
  }
  const done = _checklistItems.filter(i => i.done).length;
  const total = _checklistItems.length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  let html = `<div class="checklist-progress"><div class="checklist-progress-bar" style="width:${pct}%"></div><span>${done}/${total} (${pct}%)</span></div>`;
  html += _checklistItems.map((item, i) => `
    <div class="checklist-item ${item.done ? 'done' : ''}">
      <input type="checkbox" ${item.done ? 'checked' : ''} onchange="checklistToggle(${i})">
      <input type="text" class="checklist-text" value="${escapeHtml(item.text)}" oninput="checklistEditText(${i}, this.value)" placeholder="Item...">
      <button class="checklist-del" onclick="checklistRemoveItem(${i})" title="Remover">×</button>
    </div>
  `).join('');
  html += `<button class="btn-sm" onclick="checklistAddItem()" style="margin-top:8px">+ Adicionar item</button>`;
  el.innerHTML = html;
}

function checklistToggle(idx) {
  _checklistItems[idx].done = !_checklistItems[idx].done;
  _checklistDirty = true;
  checklistRenderItems();
  checklistSave(); // Auto-save on toggle
}

function checklistEditText(idx, text) {
  _checklistItems[idx].text = text;
  _checklistDirty = true;
}

function checklistAddItem() {
  _checklistItems.push({ text: '', done: false });
  _checklistDirty = true;
  checklistRenderItems();
  // Focus last input
  setTimeout(() => {
    const inputs = document.querySelectorAll('#checklistItems .checklist-text');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}

function checklistRemoveItem(idx) {
  _checklistItems.splice(idx, 1);
  _checklistDirty = true;
  checklistRenderItems();
  checklistSave();
}

const CHECKLIST_TEMPLATES = {
  'Em branco': [],
  'Bug-Out Bag (72h)': [
    'Agua (3L minimo)', 'Filtro/purificador de agua', 'Comida (barras, enlatados)', 'Kit de primeiros socorros',
    'Faca / multi-tool', 'Isqueiro + fosforos', 'Lanterna + pilhas extras', 'Corda / paracord (15m)',
    'Cobertor termico / saco de dormir', 'Lona / poncho', 'Radio AM/FM', 'Mapa da regiao + bussola',
    'Documentos (copias)', 'Dinheiro em especie', 'Roupa extra (meia, camiseta)', 'Apito de emergencia',
    'Fita adesiva / silver tape', 'Sacos plasticos', 'Caderno + caneta', 'Carregador solar / powerbank'
  ],
  'Kit Primeiros Socorros': [
    'Gaze esterilizada (pacote)', 'Bandagem elastica', 'Esparadrapo', 'Band-aids diversos tamanhos',
    'Luvas descartaveis', 'Tesoura pequena', 'Pinca', 'Soro fisiologico', 'Antisseptico (iodo/clorexidina)',
    'Dipirona / paracetamol', 'Ibuprofeno', 'Anti-alergico', 'Sais de reidratacao oral',
    'Pomada antibiotica', 'Termometro', 'Atadura triangular (tipoia)', 'Tala improvisavel',
    'Manual de primeiros socorros'
  ],
  'Rotina Diaria Bunker': [
    'Checar reservatorio de agua', 'Inspecionar perimetro', 'Verificar estoques de comida',
    'Exercicio fisico (30min)', 'Checar radio para transmissoes', 'Registrar no diario',
    'Manter fogueira/aquecimento', 'Higiene pessoal', 'Preparar refeicoes', 'Verificar equipamentos',
    'Estudar um guia de sobrevivencia', 'Planejar proximos passos', 'Checar saude do grupo'
  ],
  'Preparacao Inverno': [
    'Lenha cortada e seca (reserva 30 dias)', 'Isolamento de janelas e portas', 'Cobertores extras',
    'Roupas termicas para todos', 'Agua extra (tubulacao pode congelar)', 'Comida de alto calor (gorduras, nozes)',
    'Lampiao / velas extras', 'Anticongelante para veiculos', 'Pa de neve', 'Sal / areia para gelo',
    'Kit de reparo de aquecimento', 'Medicamentos para gripe/resfriado', 'Sinalizacao de emergencia'
  ],
  'Evacuacao Rapida': [
    'Bug-out bag pronta', 'Documentos na mochila', 'Tanque do veiculo cheio', 'Rota de fuga definida (A e B)',
    'Ponto de encontro combinado', 'Radio carregado', 'Celular carregado', 'Comida para 3 dias',
    'Agua para 3 dias', 'Dinheiro em especie', 'Chaves/ferramentas essenciais', 'Mapa impresso',
    'Avisar contatos', 'Desligar gas/eletricidade', 'Trancar propriedade'
  ]
};

async function checklistNew(templateName) {
  if (_checklistDirty && _checklistActiveId) await checklistSave();
  if (!templateName) {
    // Show template picker
    checklistShowTemplates();
    return;
  }
  const items = (CHECKLIST_TEMPLATES[templateName] || []).map(t => ({ text: t, done: false }));
  const title = templateName === 'Em branco' ? 'Nova checklist' : templateName;
  try {
    const r = await fetch('/api/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content: JSON.stringify(items), doc_type: 'checklist' })
    });
    const d = await r.json();
    await checklistLoadList();
    checklistSelect(d.id);
  } catch(e) { console.error(e); }
}

function checklistShowTemplates() {
  const el = document.getElementById('checklistItems');
  if (!el) return;
  let html = '<div style="padding:8px"><h3 style="color:var(--accent);margin-bottom:12px">Escolha um modelo:</h3>';
  Object.keys(CHECKLIST_TEMPLATES).forEach(name => {
    const count = CHECKLIST_TEMPLATES[name].length;
    html += `<div class="start-menu-item" onclick="checklistNew('${name.replace(/'/g, "\\'")}')">
      <span class="start-menu-item-icon">${name === 'Em branco' ? '📋' : '✅'}</span>
      <span>${name} ${count ? '('+count+' itens)' : ''}</span>
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

async function checklistSave() {
  if (!_checklistActiveId) return;
  const title = document.getElementById('checklistTitle')?.value || 'Sem titulo';
  try {
    await fetch(`/api/notes/${_checklistActiveId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content: JSON.stringify(_checklistItems) })
    });
    _checklistDirty = false;
    const n = _checklists.find(x => x.id === _checklistActiveId);
    if (n) { n.title = title; n.content = JSON.stringify(_checklistItems); }
    checklistRenderList();
  } catch(e) { console.error(e); }
}

async function checklistDelete() {
  if (!_checklistActiveId) return;
  if (!confirm('Excluir esta checklist?')) return;
  try {
    await fetch(`/api/notes/${_checklistActiveId}`, { method: 'DELETE' });
    _checklistActiveId = null;
    _checklistItems = [];
    _checklistDirty = false;
    checklistRenderItems();
    await checklistLoadList();
  } catch(e) { console.error(e); }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPASS APP
// ═══════════════════════════════════════════════════════════════════════════

let _compassHeading = 0;
let _compassHasDevice = false;

function compassInit() {
  compassDraw();
  if (window.DeviceOrientationEvent) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(perm => {
        if (perm === 'granted') {
          window.addEventListener('deviceorientation', compassOnOrientation);
          _compassHasDevice = true;
        }
      }).catch(() => {});
    } else {
      window.addEventListener('deviceorientation', compassOnOrientation);
      setTimeout(() => {
        const statusEl = document.getElementById('compassStatus');
        if (!_compassHasDevice && statusEl) statusEl.textContent = 'Manual — gire com o slider';
      }, 2000);
    }
  }
}

function compassOnOrientation(e) {
  if (e.alpha !== null) {
    _compassHasDevice = true;
    _compassHeading = e.alpha ? 360 - e.alpha : 0;
    if (e.webkitCompassHeading !== undefined) _compassHeading = e.webkitCompassHeading;
    compassDraw();
    const statusEl = document.getElementById('compassStatus');
    if (statusEl) statusEl.textContent = 'Sensor ativo';
  }
}

function compassSetManual(deg) {
  _compassHeading = parseFloat(deg) || 0;
  compassDraw();
}

function compassDraw() {
  const headingEl = document.getElementById('compassHeading');
  const dirEl = document.getElementById('compassDirection');
  const h = _compassHeading;
  if (headingEl) headingEl.textContent = Math.round(h) + '°';
  const dirs = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  const idx = Math.round(h / 45) % 8;
  if (dirEl) dirEl.textContent = dirs[idx];
  const rose = document.getElementById('compassRose');
  if (rose) rose.setAttribute('transform', `rotate(${-h}, 150, 150)`);
  const slider = document.getElementById('compassSlider');
  if (slider && !_compassHasDevice) slider.value = h;
}

// ═══════════════════════════════════════════════════════════════════════════
// MORSE CODE APP
// ═══════════════════════════════════════════════════════════════════════════

const MORSE_MAP = {
  'A':'·−','B':'−···','C':'−·−·','D':'−··','E':'·','F':'··−·','G':'−−·','H':'····',
  'I':'··','J':'·−−−','K':'−·−','L':'·−··','M':'−−','N':'−·','O':'−−−','P':'·−−·',
  'Q':'−−·−','R':'·−·','S':'···','T':'−','U':'··−','V':'···−','W':'·−−','X':'−··−',
  'Y':'−·−−','Z':'−−··',
  '0':'−−−−−','1':'·−−−−','2':'··−−−','3':'···−−','4':'····−','5':'·····',
  '6':'−····','7':'−−···','8':'−−−··','9':'−−−−·',
  '.':'·−·−·−',',':'−−··−−','?':'··−−··','!':'−·−·−−','/':'−··−·',
  '(':'−·−−·',')':'−·−−·−','&':'·−···',':':'−−−···',';':'−·−·−·',
  '=':'−···−','+':'·−·−·','-':'−····−','_':'··−−·−','"':'·−··−·',
  '$':'···−··−','@':'·−−·−·',' ':' / '
};
const MORSE_REV = {};
Object.entries(MORSE_MAP).forEach(([k, v]) => { if (k !== ' ') MORSE_REV[v] = k; });

// Important codes
const MORSE_SIGNALS = [
  { code: 'SOS', morse: '··· −−− ···', desc: 'Pedido de socorro universal' },
  { code: 'CQD', morse: '−·−· −−·− −··', desc: 'Sinal de perigo (antigo)' },
  { code: 'CQ', morse: '−·−· −−·−', desc: 'Chamada geral (procurando contato)' },
  { code: 'MAYDAY', morse: '−− ·− −·−− −·· ·− −·−−', desc: 'Socorro por voz/radio' },
  { code: 'OK', morse: '−−− −·−', desc: 'Confirmacao / tudo bem' },
  { code: 'WATER', morse: '·−− ·− − · ·−·', desc: 'Preciso de agua' },
  { code: 'HELP', morse: '···· · ·−·· ·−−·', desc: 'Preciso de ajuda' },
  { code: 'QRT', morse: '−−·− ·−· −', desc: 'Encerrando transmissao' },
  { code: 'QRZ', morse: '−−·− ·−· −−··', desc: 'Quem me chama?' },
];

const MORSE_TRAINER_WORDS = ['SOS','HELP','WATER','FIRE','OK','CQ','QTH','QSL','MAYDAY','FOOD','SAFE','LOST','NORTH','SOUTH','EAST','WEST','STOP','GO','YES','NO'];

let _morseAudioCtx = null;

function morseInit() {
  morseTranslate();
  // Render reference table
  const refEl = document.getElementById('morseRef');
  if (refEl) {
    let html = '<div class="morse-signals"><h4 style="color:var(--accent)">Sinais Importantes</h4>';
    MORSE_SIGNALS.forEach(s => {
      html += `<div class="morse-signal"><strong>${s.code}</strong> <span class="morse-code-display">${s.morse}</span> <span class="morse-desc">${s.desc}</span></div>`;
    });
    html += '</div><h4 style="margin-top:12px;color:var(--accent)">Referencia Completa</h4><div class="morse-ref-grid">';
    Object.entries(MORSE_MAP).forEach(([ch, code]) => {
      if (ch === ' ') return;
      html += `<div class="morse-ref-item"><span class="morse-ref-char">${ch}</span><span class="morse-ref-code">${code}</span></div>`;
    });
    html += '</div>';
    // Timing reference
    html += '<h4 style="margin-top:12px;color:var(--accent)">Temporizacao Morse</h4>';
    html += '<div style="font-size:11px;color:var(--text-muted);line-height:1.6;padding:8px;background:var(--surface-2);border-radius:var(--radius)">';
    html += '<b style="color:var(--text-bright)">Ponto (dit):</b> 1 unidade &nbsp;|&nbsp; ';
    html += '<b style="color:var(--text-bright)">Traco (dah):</b> 3 unidades<br>';
    html += '<b style="color:var(--text-bright)">Entre sinais:</b> 1 unidade &nbsp;|&nbsp; ';
    html += '<b style="color:var(--text-bright)">Entre letras:</b> 3 unidades &nbsp;|&nbsp; ';
    html += '<b style="color:var(--text-bright)">Entre palavras:</b> 7 unidades</div>';
    refEl.innerHTML = html;
  }
  // Setup speed slider
  const speedSlider = document.getElementById('morseTrainerSpeed');
  const speedLabel = document.getElementById('morseTrainerSpeedLabel');
  if (speedSlider && speedLabel) {
    speedSlider.oninput = () => { speedLabel.textContent = speedSlider.value + 'ms'; };
  }
}

// ── Tab switching ──
function morseSwitchTab(tab, btn) {
  document.querySelectorAll('#morseView .morse-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#morseView .morse-tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const tabMap = { translate: 'morseTabTranslate', trainer: 'morseTabTrainer', reference: 'morseTabReference' };
  const el = document.getElementById(tabMap[tab]);
  if (el) el.classList.add('active');
}
window.morseSwitchTab = morseSwitchTab;

function morseTranslate() {
  const input = (document.getElementById('morseInput')?.value || '').toUpperCase();
  const output = document.getElementById('morseOutput');
  if (!output) return;
  const morse = input.split('').map(ch => MORSE_MAP[ch] || '').join(' ');
  output.textContent = morse || '...';
}

function morseDecodeInput() {
  const input = document.getElementById('morseDecodeIn')?.value || '';
  const output = document.getElementById('morseDecodeOut');
  if (!output) return;
  const words = input.split(' / ').map(word =>
    word.trim().split(/\s+/).map(code => MORSE_REV[code] || '?').join('')
  );
  output.textContent = words.join(' ') || '...';
}

let _morseOscillators = [];
let _morsePlaying = false;

// Play morse string as audio (reusable)
function _morsePlayString(morseStr, speed) {
  if (!morseStr) return;
  if (!_morseAudioCtx) _morseAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const ctx = _morseAudioCtx;
  const unit = (speed || 100) / 1000;
  const DOT = unit, DASH = unit * 3, GAP = unit, LETTER_GAP = unit * 3, WORD_GAP = unit * 7;
  let time = ctx.currentTime + 0.05;
  _morseOscillators = [];
  _morsePlaying = true;

  for (const ch of morseStr) {
    if (ch === '·') {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 700; gain.gain.value = 0.3;
      osc.start(time); osc.stop(time + DOT);
      _morseOscillators.push(osc);
      time += DOT + GAP;
    } else if (ch === '−') {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 700; gain.gain.value = 0.3;
      osc.start(time); osc.stop(time + DASH);
      _morseOscillators.push(osc);
      time += DASH + GAP;
    } else if (ch === '/') {
      time += WORD_GAP;
    } else if (ch === ' ') {
      time += LETTER_GAP;
    }
  }
  const duration = (time - ctx.currentTime) * 1000;
  setTimeout(() => { if (_morsePlaying) morseStopAudio(); }, duration + 100);
  return duration;
}

function morsePlayAudio() {
  if (_morsePlaying) { morseStopAudio(); return; }
  const morse = document.getElementById('morseOutput')?.textContent || '';
  if (!morse || morse === '...') return;
  const btn = document.getElementById('morsePlayBtn');
  if (btn) { btn.textContent = '⏹ Parar'; btn.classList.add('playing'); }
  _morsePlayString(morse, 100);
}

function morseStopAudio() {
  _morsePlaying = false;
  _morseOscillators.forEach(osc => { try { osc.stop(); } catch(e) {} });
  _morseOscillators = [];
  const btn = document.getElementById('morsePlayBtn');
  if (btn) { btn.textContent = '🔊 Tocar'; btn.classList.remove('playing'); }
}
window.morseStopAudio = morseStopAudio;

let _morseFlashing = false;
function morseFlashSOS() {
  if (_morseFlashing) { _morseFlashing = false; return; }
  _morseFlashing = true;
  const DOT = 200, DASH = 600, GAP = 200, LETTER_GAP = 600, WORD_GAP = 1400;
  const pattern = [
    DOT, GAP, DOT, GAP, DOT, LETTER_GAP,
    DASH, GAP, DASH, GAP, DASH, LETTER_GAP,
    DOT, GAP, DOT, GAP, DOT, WORD_GAP
  ];

  let overlay = document.getElementById('morseFlashOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'morseFlashOverlay';
    overlay.className = 'morse-flash-overlay';
    overlay.innerHTML = '<div class="morse-flash-label">SOS</div><div class="morse-flash-sub">Toque para parar</div>';
    overlay.onclick = () => { _morseFlashing = false; };
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';

  let idx = 0;
  let isOn = true;
  function tick() {
    if (!_morseFlashing || idx >= pattern.length) {
      if (_morseFlashing) { idx = 0; tick(); return; }
      overlay.style.display = 'none';
      overlay.style.background = 'rgba(0,0,0,0.95)';
      return;
    }
    overlay.style.background = isOn ? '#ffffff' : 'rgba(0,0,0,0.95)';
    overlay.querySelector('.morse-flash-label').style.color = isOn ? '#000' : '#fff';
    setTimeout(() => { idx++; isOn = !isOn; tick(); }, pattern[idx]);
  }
  tick();
}

// ═══════════════════════════════════════════════════════════════════════════
// MORSE TRAINER
// ═══════════════════════════════════════════════════════════════════════════

let _morseTrainer = { mode: 'listen', answer: '', correct: 0, wrong: 0, streak: 0, active: false };

function morseTrainerSetMode(mode, btn) {
  _morseTrainer.mode = mode;
  document.querySelectorAll('.morse-trainer-mode').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const replayBtn = document.getElementById('morseTrainerReplayBtn');
  if (replayBtn) replayBtn.style.display = mode === 'listen' ? 'inline-flex' : 'none';
  morseTrainerNext();
}
window.morseTrainerSetMode = morseTrainerSetMode;

function _morseTrainerGetChars() {
  const level = document.getElementById('morseTrainerLevel')?.value || 'medium';
  if (level === 'easy') return 'ABCDEF'.split('');
  if (level === 'medium') return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  if (level === 'hard') return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
  return null; // words mode
}

function morseTrainerNext() {
  _morseTrainer.active = true;
  const prompt = document.getElementById('morseTrainerPrompt');
  const visual = document.getElementById('morseTrainerVisual');
  const input = document.getElementById('morseTrainerInput');
  const feedback = document.getElementById('morseTrainerFeedback');
  if (!prompt) return;

  feedback.textContent = '';
  feedback.className = 'morse-trainer-feedback';
  input.value = '';
  input.focus();

  const level = document.getElementById('morseTrainerLevel')?.value || 'medium';
  const chars = _morseTrainerGetChars();
  let challenge, answer;

  if (chars) {
    challenge = chars[Math.floor(Math.random() * chars.length)];
    answer = challenge;
  } else {
    challenge = MORSE_TRAINER_WORDS[Math.floor(Math.random() * MORSE_TRAINER_WORDS.length)];
    answer = challenge;
  }
  _morseTrainer.answer = answer;

  const morseStr = answer.split('').map(ch => MORSE_MAP[ch] || '').join(' ');

  if (_morseTrainer.mode === 'listen') {
    prompt.innerHTML = '<span style="font-size:24px;color:var(--text-muted)">🎧</span> <span style="color:var(--text)">Escute e identifique</span>';
    visual.innerHTML = '<div class="morse-trainer-hidden-answer">???</div>';
    // Play audio
    const speed = parseInt(document.getElementById('morseTrainerSpeed')?.value || '100');
    _morsePlayString(morseStr, speed);
    document.getElementById('morseTrainerReplayBtn').style.display = 'inline-flex';
  } else {
    // Identify mode: show morse visually
    prompt.innerHTML = '<span style="color:var(--text)">Que letra/palavra e esta?</span>';
    visual.innerHTML = `<div class="morse-trainer-morse-display">${morseStr}</div>`;
    document.getElementById('morseTrainerReplayBtn').style.display = 'none';
  }
}
window.morseTrainerNext = morseTrainerNext;

function morseTrainerReplay() {
  if (!_morseTrainer.answer) return;
  const morseStr = _morseTrainer.answer.split('').map(ch => MORSE_MAP[ch] || '').join(' ');
  const speed = parseInt(document.getElementById('morseTrainerSpeed')?.value || '100');
  morseStopAudio();
  setTimeout(() => _morsePlayString(morseStr, speed), 50);
}
window.morseTrainerReplay = morseTrainerReplay;

function morseTrainerCheck() {
  if (!_morseTrainer.active || !_morseTrainer.answer) return;
  const input = document.getElementById('morseTrainerInput');
  const feedback = document.getElementById('morseTrainerFeedback');
  const guess = (input?.value || '').trim().toUpperCase();
  if (!guess) return;

  const morseStr = _morseTrainer.answer.split('').map(ch => MORSE_MAP[ch] || '').join(' ');

  if (guess === _morseTrainer.answer) {
    _morseTrainer.correct++;
    _morseTrainer.streak++;
    feedback.textContent = 'Correto! ' + _morseTrainer.answer + ' = ' + morseStr;
    feedback.className = 'morse-trainer-feedback morse-feedback-correct';
  } else {
    _morseTrainer.wrong++;
    _morseTrainer.streak = 0;
    feedback.textContent = 'Errado! Era: ' + _morseTrainer.answer + ' = ' + morseStr;
    feedback.className = 'morse-trainer-feedback morse-feedback-wrong';
  }

  document.getElementById('morseTrainerCorrect').textContent = _morseTrainer.correct;
  document.getElementById('morseTrainerWrong').textContent = _morseTrainer.wrong;
  document.getElementById('morseTrainerStreak').textContent = _morseTrainer.streak;

  // Show answer visually
  const visual = document.getElementById('morseTrainerVisual');
  if (visual) {
    visual.innerHTML = `<div class="morse-trainer-morse-display"><strong style="color:var(--text-bright);font-size:18px">${_morseTrainer.answer}</strong> = ${morseStr}</div>`;
  }

  _morseTrainer.active = false;
  setTimeout(() => morseTrainerNext(), 1800);
}
window.morseTrainerCheck = morseTrainerCheck;

function morseTrainerReset() {
  _morseTrainer.correct = 0;
  _morseTrainer.wrong = 0;
  _morseTrainer.streak = 0;
  _morseTrainer.active = false;
  _morseTrainer.answer = '';
  document.getElementById('morseTrainerCorrect').textContent = '0';
  document.getElementById('morseTrainerWrong').textContent = '0';
  document.getElementById('morseTrainerStreak').textContent = '0';
  const prompt = document.getElementById('morseTrainerPrompt');
  if (prompt) prompt.innerHTML = 'Pressione "Proximo" para comecar';
  const visual = document.getElementById('morseTrainerVisual');
  if (visual) visual.innerHTML = '';
  const feedback = document.getElementById('morseTrainerFeedback');
  if (feedback) { feedback.textContent = ''; feedback.className = 'morse-trainer-feedback'; }
}
window.morseTrainerReset = morseTrainerReset;

// ═══════════════════════════════════════════════════════════════════════════
// NATO PHONETIC ALPHABET
// ═══════════════════════════════════════════════════════════════════════════

const NATO_ALPHABET = {
  A:'Alpha', B:'Bravo', C:'Charlie', D:'Delta', E:'Echo', F:'Foxtrot',
  G:'Golf', H:'Hotel', I:'India', J:'Juliet', K:'Kilo', L:'Lima',
  M:'Mike', N:'November', O:'Oscar', P:'Papa', Q:'Quebec', R:'Romeo',
  S:'Sierra', T:'Tango', U:'Uniform', V:'Victor', W:'Whiskey', X:'X-ray',
  Y:'Yankee', Z:'Zulu',
  '0':'Zero', '1':'One', '2':'Two', '3':'Three', '4':'Four',
  '5':'Five', '6':'Six', '7':'Seven', '8':'Eight', '9':'Niner'
};

let _phoneticPractice = { letter: '', correct: 0, wrong: 0 };

function phoneticInit() {
  phoneticTranslate();
  phoneticPracticeNext();
}

function phoneticTranslate() {
  const input = (document.getElementById('phoneticInput')?.value || '').toUpperCase();
  const output = document.getElementById('phoneticOutput');
  if (!output) return;
  const words = input.split('').map(ch => {
    if (ch === ' ') return '—';
    return NATO_ALPHABET[ch] || ch;
  }).filter(Boolean);
  output.innerHTML = words.map(w =>
    w === '—' ? '<span class="phonetic-space">—</span>'
    : `<span class="phonetic-word"><strong>${w[0]}</strong>${w.slice(1)}</span>`
  ).join(' ');
}

function phoneticPracticeNext() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const letter = letters[Math.floor(Math.random() * letters.length)];
  _phoneticPractice.letter = letter;
  const el = document.getElementById('phoneticPracticeLetter');
  if (el) el.textContent = letter;
  const input = document.getElementById('phoneticPracticeInput');
  if (input) { input.value = ''; input.focus(); }
  const fb = document.getElementById('phoneticPracticeFeedback');
  if (fb) { fb.textContent = ''; fb.className = 'morse-trainer-feedback'; }
}
window.phoneticPracticeNext = phoneticPracticeNext;

function phoneticPracticeCheck() {
  const guess = (document.getElementById('phoneticPracticeInput')?.value || '').trim().toLowerCase();
  if (!guess) return;
  const correct = NATO_ALPHABET[_phoneticPractice.letter].toLowerCase();
  const fb = document.getElementById('phoneticPracticeFeedback');
  if (guess === correct) {
    _phoneticPractice.correct++;
    fb.textContent = 'Correto! ' + _phoneticPractice.letter + ' = ' + NATO_ALPHABET[_phoneticPractice.letter];
    fb.className = 'morse-trainer-feedback morse-feedback-correct';
  } else {
    _phoneticPractice.wrong++;
    fb.textContent = 'Errado! ' + _phoneticPractice.letter + ' = ' + NATO_ALPHABET[_phoneticPractice.letter];
    fb.className = 'morse-trainer-feedback morse-feedback-wrong';
  }
  document.getElementById('phoneticCorrect').textContent = _phoneticPractice.correct;
  document.getElementById('phoneticWrong').textContent = _phoneticPractice.wrong;
  setTimeout(() => phoneticPracticeNext(), 1500);
}
window.phoneticPracticeCheck = phoneticPracticeCheck;

// ═══════════════════════════════════════════════════════════════════════════
// SUN / MOON CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════

function sunCalcInit() {
  // Set default lat/lon to approximate Brazil center
  const latEl = document.getElementById('sunLat');
  const lonEl = document.getElementById('sunLon');
  if (latEl && !latEl.value) latEl.value = '-15.78';
  if (lonEl && !lonEl.value) lonEl.value = '-47.93';
  sunCalcCompute();
}

function sunCalcCompute() {
  const lat = parseFloat(document.getElementById('sunLat')?.value || '-15.78');
  const lon = parseFloat(document.getElementById('sunLon')?.value || '-47.93');
  const now = new Date();

  // Simple sunrise/sunset calculation (Spencer, 1971)
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const decl = -23.45 * Math.cos(2 * Math.PI * (dayOfYear + 10) / 365); // Solar declination
  const declRad = decl * Math.PI / 180;
  const latRad = lat * Math.PI / 180;

  // Hour angle at sunrise/sunset
  const cosH = -Math.tan(latRad) * Math.tan(declRad);
  let daylight, sunrise, sunset;

  if (cosH > 1) {
    // Polar night
    daylight = 0; sunrise = null; sunset = null;
  } else if (cosH < -1) {
    // Midnight sun
    daylight = 24; sunrise = null; sunset = null;
  } else {
    const H = Math.acos(cosH) * 180 / Math.PI;
    daylight = 2 * H / 15; // hours of daylight
    const solarNoon = 12 - lon / 15; // approximate
    const halfDay = H / 15;
    sunrise = solarNoon - halfDay;
    sunset = solarNoon + halfDay;
  }

  // Moon phase (simplified)
  const lunarCycle = 29.53059;
  const knownNewMoon = new Date(2024, 0, 11, 11, 57); // Jan 11, 2024 new moon
  const daysSinceNew = (now - knownNewMoon) / 86400000;
  const moonAge = ((daysSinceNew % lunarCycle) + lunarCycle) % lunarCycle;
  const moonPct = moonAge / lunarCycle;
  let moonPhase, moonIcon;
  if (moonPct < 0.03 || moonPct >= 0.97) { moonPhase = 'Lua Nova'; moonIcon = '🌑'; }
  else if (moonPct < 0.22) { moonPhase = 'Crescente'; moonIcon = '🌒'; }
  else if (moonPct < 0.28) { moonPhase = 'Quarto Crescente'; moonIcon = '🌓'; }
  else if (moonPct < 0.47) { moonPhase = 'Gibosa Crescente'; moonIcon = '🌔'; }
  else if (moonPct < 0.53) { moonPhase = 'Lua Cheia'; moonIcon = '🌕'; }
  else if (moonPct < 0.72) { moonPhase = 'Gibosa Minguante'; moonIcon = '🌖'; }
  else if (moonPct < 0.78) { moonPhase = 'Quarto Minguante'; moonIcon = '🌗'; }
  else { moonPhase = 'Minguante'; moonIcon = '🌘'; }

  // Render
  const el = document.getElementById('sunResult');
  if (!el) return;

  function fmtTime(h) {
    if (h === null) return '—';
    h = ((h % 24) + 24) % 24;
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  const goldenMorning = sunrise !== null ? fmtTime(sunrise) + ' – ' + fmtTime(sunrise + 1) : '—';
  const goldenEvening = sunset !== null ? fmtTime(sunset - 1) + ' – ' + fmtTime(sunset) : '—';

  el.innerHTML = `
    <div class="sun-card">
      <div class="sun-icon">🌅</div>
      <div class="sun-label">Nascer do Sol</div>
      <div class="sun-value">${sunrise !== null ? fmtTime(sunrise) : 'Sol nao nasce'}</div>
    </div>
    <div class="sun-card">
      <div class="sun-icon">🌇</div>
      <div class="sun-label">Por do Sol</div>
      <div class="sun-value">${sunset !== null ? fmtTime(sunset) : 'Sol nao se poe'}</div>
    </div>
    <div class="sun-card">
      <div class="sun-icon">☀️</div>
      <div class="sun-label">Horas de Luz</div>
      <div class="sun-value">${daylight.toFixed(1)}h</div>
    </div>
    <div class="sun-card">
      <div class="sun-icon">📐</div>
      <div class="sun-label">Declinacao Solar</div>
      <div class="sun-value">${decl.toFixed(1)}°</div>
    </div>
    <div class="sun-card sun-wide">
      <div class="sun-icon">📸</div>
      <div class="sun-label">Golden Hour</div>
      <div class="sun-value" style="font-size:14px">Manha: ${goldenMorning}<br>Tarde: ${goldenEvening}</div>
    </div>
    <div class="sun-card sun-wide">
      <div class="sun-icon">${moonIcon}</div>
      <div class="sun-label">Fase da Lua</div>
      <div class="sun-value">${moonPhase} (dia ${Math.round(moonAge)} de ${lunarCycle.toFixed(0)})</div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════
// AGUA SEGURA — Complete Water Safety App
// ═══════════════════════════════════════════════════════════════════════════

/* ─── Tab Navigation ─── */
function waterSwitchTab(tabId) {
  document.querySelectorAll('.water-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.water-tab-panel').forEach(p => p.classList.remove('active'));
  const tabMap = { purify: 'waterTabPurify', daily: 'waterTabDaily', sources: 'waterTabSources', contam: 'waterTabContam', tables: 'waterTabTables' };
  const panel = document.getElementById(tabMap[tabId]);
  if (panel) panel.classList.add('active');
  // Activate button
  document.querySelectorAll('.water-tab').forEach(t => {
    if (t.textContent.toLowerCase().includes(
      tabId === 'purify' ? 'purificar' : tabId === 'daily' ? 'necessidade' : tabId === 'sources' ? 'fontes' : tabId === 'contam' ? 'contaminacao' : 'tabelas'
    )) t.classList.add('active');
  });
  // Lazy-load static content
  if (tabId === 'sources') waterRenderSources();
  if (tabId === 'contam') waterRenderContam();
  if (tabId === 'tables') waterRenderTables();
  if (tabId === 'daily') waterDailyCalc();
  if (tabId === 'purify') waterCalcCompute();
}
window.waterSwitchTab = waterSwitchTab;

/* ─── Purification Calculator (expanded) ─── */
function waterCalcCompute() {
  const liters = parseFloat(document.getElementById('waterLiters')?.value || '1');
  const clarity = document.getElementById('waterClarity')?.value || 'clear';
  const method = document.getElementById('waterMethod')?.value || 'bleach';
  const el = document.getElementById('waterResult');
  if (!el) return;

  const turbidMult = clarity === 'turbid' ? 2 : 1;
  const isTurbid = clarity === 'turbid';
  let html = '';

  switch (method) {
    case 'bleach': {
      // Household bleach 2.5% sodium hypochlorite (Brazil standard)
      const drops = Math.ceil(2 * liters * turbidMult);
      const ml = (drops * 0.05).toFixed(2);
      const tsp = drops >= 40 ? ` (${(drops / 80).toFixed(1)} colher de cha)` : '';
      html = `
        <div class="water-result-card">
          <h4>\u{1F9F4} Agua Sanitaria (2,5% cloro)</h4>
          <div class="water-dose">${drops} gotas</div>
          <div class="water-sub">(\u2248 ${ml} mL)${tsp}</div>
          <div class="water-info">
            <p>\u23F1\uFE0F Espere <strong>${isTurbid ? '45-60 minutos' : '30 minutos'}</strong> antes de beber</p>
            <p>\u{1F443} Deve ter leve cheiro de cloro</p>
            <p>\u26A0\uFE0F Se nao sentir cheiro, repita a dose e espere +15 min</p>
            <p>\u{1F4E6} Use APENAS agua sanitaria SEM perfume/alvejante</p>
            <p>\u{1F4C5} Dose dupla = armazenamento ate 6 meses</p>
          </div>
        </div>`;
      break;
    }
    case 'bleach6': {
      // Concentrated bleach 5-6% (US standard)
      const drops = Math.ceil(1 * liters * turbidMult);
      const ml = (drops * 0.05).toFixed(2);
      html = `
        <div class="water-result-card">
          <h4>\u{1F9F4} Agua Sanitaria Concentrada (5-6%)</h4>
          <div class="water-dose">${drops} gota${drops > 1 ? 's' : ''}</div>
          <div class="water-sub">(\u2248 ${ml} mL)</div>
          <div class="water-info">
            <p>\u23F1\uFE0F Espere <strong>${isTurbid ? '45-60 min' : '30 minutos'}</strong></p>
            <p>\u{1F443} Deve ter leve cheiro de cloro apos o tempo</p>
            <p>\u26A0\uFE0F Metade da dose do cloro 2,5% — concentracao maior</p>
          </div>
        </div>`;
      break;
    }
    case 'iodine': {
      const drops = Math.ceil(5 * liters * turbidMult);
      html = `
        <div class="water-result-card">
          <h4>\u{1F48A} Tintura de Iodo (2%)</h4>
          <div class="water-dose">${drops} gotas</div>
          <div class="water-info">
            <p>\u23F1\uFE0F Espere <strong>${isTurbid ? '60 minutos' : '30 minutos'}</strong></p>
            <p>\u26A0\uFE0F Nao usar em gravidas, lactantes ou alergicos a iodo</p>
            <p>\u26A0\uFE0F Maximo 3 semanas de uso continuo (tireoide)</p>
            <p>\u{1F4A1} Vitamina C (tang) remove gosto APOS purificar</p>
            <p>\u{1F30A} Armazene em frasco escuro — luz degrada o iodo</p>
          </div>
        </div>`;
      break;
    }
    case 'iodine_tab': {
      const tabs = Math.ceil(liters * turbidMult);
      html = `
        <div class="water-result-card">
          <h4>\u{1F48A} Comprimidos de Iodo (Globaline/Portable Aqua)</h4>
          <div class="water-dose">${tabs} comprimido${tabs > 1 ? 's' : ''}</div>
          <div class="water-sub">(${tabs} comp. para ${liters}L)</div>
          <div class="water-info">
            <p>\u23F1\uFE0F Espere <strong>${isTurbid ? '60 minutos' : '30 minutos'}</strong></p>
            <p>\u{1F4A1} 1 comprimido por litro (clara), 2 por litro (turva/fria)</p>
            <p>\u26A0\uFE0F Mesmas restricoes do iodo liquido</p>
          </div>
        </div>`;
      break;
    }
    case 'boil': {
      const wood = (liters * 1).toFixed(1);
      html = `
        <div class="water-result-card">
          <h4>\u{1F525} Fervura</h4>
          <div class="water-dose">Fervura rolante por 1 minuto</div>
          <div class="water-sub">(veja tabela por altitude na aba Tabelas)</div>
          <div class="water-info">
            <p>\u2705 Metodo mais seguro: 99,99% eficacia</p>
            <p>\u{1FAD7} Deixe esfriar naturalmente — nao sopre</p>
            <p>\u{1F4A1} Agite suavemente para reoxigenar e melhorar sabor</p>
            <p>\u{1FAB5} Combustivel: ~${wood}kg de lenha seca para ${liters}L</p>
            <p>\u26A0\uFE0F Nao remove quimicos (metais, pesticidas)</p>
            <p>\u{1F4A1} Sem panela? Aqueca pedras no fogo 30min e coloque na agua</p>
          </div>
        </div>`;
      break;
    }
    case 'sodis': {
      const bottles = Math.ceil(liters / 1.5);
      html = `
        <div class="water-result-card">
          <h4>\u2600\uFE0F SODIS (Desinfeccao Solar)</h4>
          <div class="water-dose">${bottles} garrafa${bottles > 1 ? 's' : ''} PET</div>
          <div class="water-info">
            <p>\u23F1\uFE0F <strong>6h</strong> sol forte | <strong>2 dias</strong> nublado parcial</p>
            <p>\u{1F4E6} Garrafas PET transparentes ate 2L, sem arranhoes</p>
            <p>\u{1F504} Agite 20s antes para oxigenar, complete, deite a garrafa</p>
            <p>\u2600\uFE0F Superficie escura embaixo = aquece mais = mata mais rapido</p>
            <p>\u26A0\uFE0F ${isTurbid ? 'AGUA TURVA: filtre primeiro ou SODIS nao funciona!' : 'Nao funciona com agua turva — filtre antes'}</p>
            <p>\u{1F327}\uFE0F Chuva/nublado total: NAO funciona, use outro metodo</p>
          </div>
        </div>`;
      break;
    }
    case 'ceramic': {
      const hours = (liters / 2).toFixed(1);
      html = `
        <div class="water-result-card">
          <h4>\u{1FAD9} Filtro Ceramico</h4>
          <div class="water-dose">${liters}L \u2248 ${hours}h de filtragem</div>
          <div class="water-sub">(~2L/hora em filtro novo)</div>
          <div class="water-info">
            <p>\u2705 Remove 99% bacterias e parasitas</p>
            <p>\u26A0\uFE0F NAO remove virus — combine com cloro ou fervura</p>
            <p>\u{1F527} Manutencao: lixe superficie com escova quando fluxo diminuir</p>
            <p>\u{1F4C5} Vida util: ~10.000L ou 6-12 meses</p>
            <p>\u{1F4A1} Ideal como primeiro estagio + fervura como segundo</p>
          </div>
        </div>`;
      break;
    }
    case 'distill': {
      html = `
        <div class="water-result-card">
          <h4>\u{1F32B}\uFE0F Destilacao</h4>
          <div class="water-dose">~${(liters * 2).toFixed(0)}h para ${liters}L</div>
          <div class="water-sub">(metodo mais lento, porem mais completo)</div>
          <div class="water-info">
            <p>\u2705 Remove TUDO: bacterias, virus, quimicos, sal</p>
            <p>\u{1F372} Panela com tampa inclinada \u2192 vapor condensa e goteja</p>
            <p>\u2600\uFE0F Ou destilador solar (buraco + plastico + recipiente)</p>
            <p>\u{1FAB5} Alto consumo de combustivel</p>
            <p>\u{1F4A1} Unico metodo seguro para agua salgada ou quimica</p>
            <p>\u26A0\uFE0F Agua destilada nao tem minerais — adicione pitada de sal</p>
          </div>
        </div>`;
      break;
    }
  }

  // Efficacy comparison bar
  const efficacy = {
    bleach: { bact: 99, virus: 99, para: 30, chem: 0 },
    bleach6: { bact: 99, virus: 99, para: 30, chem: 0 },
    iodine: { bact: 99, virus: 99, para: 70, chem: 0 },
    iodine_tab: { bact: 99, virus: 99, para: 70, chem: 0 },
    boil: { bact: 99, virus: 99, para: 99, chem: 0 },
    sodis: { bact: 90, virus: 85, para: 50, chem: 0 },
    ceramic: { bact: 99, virus: 10, para: 99, chem: 10 },
    distill: { bact: 99, virus: 99, para: 99, chem: 95 }
  };
  const eff = efficacy[method] || efficacy.boil;
  html += `
    <div class="water-efficacy">
      <h4>\u{1F9EA} Eficacia do Metodo</h4>
      <div class="water-eff-row"><span class="water-eff-label">Bacterias</span><div class="water-eff-bar"><div class="water-eff-fill" style="width:${eff.bact}%;background:${eff.bact > 80 ? '#00ff88' : eff.bact > 50 ? '#ffaa00' : '#ff4466'}"></div></div><span class="water-eff-pct">${eff.bact}%</span></div>
      <div class="water-eff-row"><span class="water-eff-label">Virus</span><div class="water-eff-bar"><div class="water-eff-fill" style="width:${eff.virus}%;background:${eff.virus > 80 ? '#00ff88' : eff.virus > 50 ? '#ffaa00' : '#ff4466'}"></div></div><span class="water-eff-pct">${eff.virus}%</span></div>
      <div class="water-eff-row"><span class="water-eff-label">Parasitas</span><div class="water-eff-bar"><div class="water-eff-fill" style="width:${eff.para}%;background:${eff.para > 80 ? '#00ff88' : eff.para > 50 ? '#ffaa00' : '#ff4466'}"></div></div><span class="water-eff-pct">${eff.para}%</span></div>
      <div class="water-eff-row"><span class="water-eff-label">Quimicos</span><div class="water-eff-bar"><div class="water-eff-fill" style="width:${Math.max(eff.chem, 3)}%;background:${eff.chem > 80 ? '#00ff88' : eff.chem > 50 ? '#ffaa00' : '#ff4466'}"></div></div><span class="water-eff-pct">${eff.chem}%</span></div>
    </div>`;

  html += `
    <div class="water-tips">
      <h4>\u{1F4A1} Melhor Pratica</h4>
      <ul>
        <li>Combine 2 metodos: Filtrar + Ferver = cobertura maxima</li>
        <li>Sempre filtre antes de purificar (tecido, areia, carvao)</li>
        <li>Agua turva: deixe decantar 2-4h antes de tratar</li>
        <li>Diarreia em sobrevivencia = emergencia — reidrate com SRO</li>
      </ul>
    </div>`;
  el.innerHTML = html;
}
window.waterCalcCompute = waterCalcCompute;

/* ─── Daily Water Needs Calculator ─── */
function waterDailyCalc() {
  const people = parseInt(document.getElementById('waterPeople')?.value || '1');
  const days = parseInt(document.getElementById('waterDays')?.value || '3');
  const climate = document.getElementById('waterClimate')?.value || 'temperate';
  const activity = document.getElementById('waterActivity')?.value || 'rest';
  const altitude = parseInt(document.getElementById('waterAltitude')?.value || '0');
  const el = document.getElementById('waterDailyResult');
  if (!el) return;

  // Base need per person per day (liters)
  const climateBase = { temperate: 2.0, hot: 3.0, extreme: 4.5, cold: 2.5, desert: 4.0 };
  const activityMult = { rest: 1.0, light: 1.25, moderate: 1.5, heavy: 2.0 };
  const altitudeBonus = altitude > 2500 ? 0.5 + ((altitude - 2500) / 2500) * 0.5 : 0;

  const base = climateBase[climate] || 2.0;
  const mult = activityMult[activity] || 1.0;
  const perPersonDay = (base * mult) + altitudeBonus;
  const totalDaily = perPersonDay * people;
  const totalAll = totalDaily * days;

  // Containers estimate
  const bottles2L = Math.ceil(totalAll / 2);
  const gallons5L = Math.ceil(totalAll / 5);
  const drums20L = Math.ceil(totalAll / 20);

  el.innerHTML = `
    <div class="water-daily-grid">
      <div class="water-daily-stat">
        <div class="water-daily-num">${perPersonDay.toFixed(1)}</div>
        <div class="water-daily-label">L / pessoa / dia</div>
      </div>
      <div class="water-daily-stat">
        <div class="water-daily-num">${totalDaily.toFixed(1)}</div>
        <div class="water-daily-label">L / dia total</div>
      </div>
      <div class="water-daily-stat water-daily-total">
        <div class="water-daily-num">${totalAll.toFixed(0)}</div>
        <div class="water-daily-label">L total (${days} dias)</div>
      </div>
    </div>
    <div class="water-result-card" style="margin-top:12px">
      <h4>\u{1F4E6} Recipientes Necessarios</h4>
      <div class="water-info">
        <p>\u{1F4A7} ${bottles2L} garrafas de 2L</p>
        <p>\u{1F4A7} ${gallons5L} galoes de 5L</p>
        <p>\u{1F4A7} ${drums20L} tambor${drums20L > 1 ? 'es' : ''} de 20L</p>
      </div>
    </div>
    <div class="water-result-card" style="margin-top:8px">
      <h4>\u{1F3AF} Fatores Considerados</h4>
      <div class="water-info" style="font-size:12px;color:var(--text-muted)">
        <p>Clima: ${{'temperate':'Temperado (2L base)','hot':'Quente (3L base)','extreme':'Extremo (4.5L base)','cold':'Frio (2.5L base)','desert':'Deserto (4L base)'}[climate]}</p>
        <p>Atividade: x${mult.toFixed(2)} multiplicador</p>
        ${altitudeBonus > 0 ? `<p>Altitude ${altitude}m: +${altitudeBonus.toFixed(1)}L/dia</p>` : ''}
        <p>\u26A0\uFE0F Doentes (febre/diarreia): adicione +2-4L/pessoa/dia</p>
        <p>\u{1F476} Criancas: ~50-75% da necessidade adulta</p>
        <p>\u{1F930} Gravidas/Lactantes: +0.5-1L/dia adicional</p>
      </div>
    </div>
    <div class="water-tips" style="margin-top:8px">
      <h4>\u{1F48A} Solucao de Reidratacao Oral (SRO)</h4>
      <ul>
        <li><strong>1L agua</strong> + 6 colheres de cha de acucar + 1/2 colher de cha de sal</li>
        <li>Beba em pequenos goles ao longo de 4-6h</li>
        <li>Salva vidas em casos de diarreia e vomito</li>
      </ul>
    </div>`;
}
window.waterDailyCalc = waterDailyCalc;

/* ─── Water Sources Reference ─── */
function waterRenderSources() {
  const el = document.getElementById('waterSourcesContent');
  if (!el || el.dataset.loaded) return;
  el.dataset.loaded = '1';

  const sources = [
    { name: 'Agua da Chuva', icon: '\u{1F327}\uFE0F', risk: 'BAIXO', color: '#00ff88',
      desc: 'Melhor fonte natural. Colete com lonas/telhados limpos. Descarte primeiros 5-10 min.',
      tips: ['Recipientes fechados e escuros para armazenar', 'Evite em zonas industriais (chuva acida)'] },
    { name: 'Rios e Riachos', icon: '\u{1F30A}', risk: 'MEDIO', color: '#ffaa00',
      desc: 'Prefira agua corrente. Colete a montante de povoados. SEMPRE purifique.',
      tips: ['Pedras com musgo verde = bom sinal', 'Parasitas microscopicos mesmo em agua cristalina'] },
    { name: 'Lagos e Represas', icon: '\u{1F4A7}', risk: 'ALTO', color: '#ff4466',
      desc: 'Agua parada acumula patogenos. Colete longe das margens.',
      tips: ['Espuma verde = cianobacterias TOXICAS (nao ferve)', 'Use metodo duplo: filtrar + ferver'] },
    { name: 'Orvalho e Condensacao', icon: '\u{1F343}', risk: 'BAIXO', color: '#00ff88',
      desc: 'Panos nos tornozelos ao amanhecer, caminhe pela vegetacao, torga.',
      tips: ['Rendimento: 200-500mL por sessao', 'Melhor com vegetacao densa + noites frias'] },
    { name: 'Neve e Gelo', icon: '\u2744\uFE0F', risk: 'BAIXO-MEDIO', color: '#66ccff',
      desc: 'NUNCA coma neve direto (hipotermia). Derreta primeiro.',
      tips: ['Gelo azulado = mais puro que neve fresca', '10L neve fofa = ~1L agua', 'Neve rosa/amarela = contaminada'] },
    { name: 'Destilador Solar', icon: '\u2600\uFE0F', risk: 'BAIXO', color: '#00ff88',
      desc: 'Buraco 60cm + recipiente + plastico. Evapora e condensa.',
      tips: ['500mL-1L por dia', 'Adicione folhas/urina para mais producao', 'Funciona para dessalinizar'] },
    { name: 'Vegetacao', icon: '\u{1F33F}', risk: 'MEDIO', color: '#ffaa00',
      desc: 'Cipos, bananeiras, bambu verde, transpiracao vegetal.',
      tips: ['Liquido leitoso/amargo = TOXICO', 'Saco plastico em galho ao sol = 50-100mL/dia', 'Corte cipo no alto primeiro, depois embaixo'] },
    { name: 'Ruinas Urbanas', icon: '\u{1F3DA}\uFE0F', risk: 'VARIAVEL', color: '#cc88ff',
      desc: 'Caixas d\'agua, boilers, caixa de descarga, piscinas, maq. lavar.',
      tips: ['EVITE radiadores (anticongelante = veneno)', 'Purificacao OBRIGATORIA', 'Caixa de descarga OK, bacia NAO'] }
  ];

  let html = '';
  for (const s of sources) {
    html += `
      <div class="water-source-card">
        <div class="water-source-header">
          <span class="water-source-icon">${s.icon}</span>
          <span class="water-source-name">${s.name}</span>
          <span class="water-source-risk" style="background:${s.color}22;color:${s.color};border:1px solid ${s.color}44">Risco: ${s.risk}</span>
        </div>
        <p class="water-source-desc">${s.desc}</p>
        <ul class="water-source-tips">${s.tips.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>`;
  }
  el.innerHTML = html;
}
window.waterRenderSources = waterRenderSources;

/* ─── Contamination Signs ─── */
function waterRenderContam() {
  const el = document.getElementById('waterContamContent');
  if (!el || el.dataset.loaded) return;
  el.dataset.loaded = '1';

  el.innerHTML = `
    <div class="water-result-card">
      <h4>\u{1F440} Indicadores Visuais</h4>
      <table class="water-ref-table">
        <tr><th>Sinal</th><th>Possivel Causa</th><th>Risco</th></tr>
        <tr><td>Amarela/marrom</td><td>Ferrugem, sedimentos</td><td class="water-risk-med">Medio</td></tr>
        <tr><td>Esverdeada</td><td>Algas, cianobacterias</td><td class="water-risk-high">ALTO</td></tr>
        <tr><td>Azulada</td><td>Cobre de tubulacoes</td><td class="water-risk-med">Medio-Alto</td></tr>
        <tr><td>Leitosa/branca</td><td>Gas dissolvido, calcario</td><td class="water-risk-low">Baixo</td></tr>
        <tr><td>Brilho oleoso</td><td>Hidrocarbonetos</td><td class="water-risk-high">ALTO</td></tr>
      </table>
    </div>
    <div class="water-result-card">
      <h4>\u{1F443} Indicadores por Cheiro</h4>
      <table class="water-ref-table">
        <tr><th>Cheiro</th><th>Possivel Causa</th><th>Risco</th></tr>
        <tr><td>Ovo podre (enxofre)</td><td>Bacterias anaerobias</td><td class="water-risk-high">Alto</td></tr>
        <tr><td>Esgoto</td><td>Contaminacao fecal</td><td class="water-risk-crit">CRITICO</td></tr>
        <tr><td>Quimico/solvente</td><td>Industrial</td><td class="water-risk-crit">CRITICO</td></tr>
        <tr><td>Terra/mofo</td><td>Bacterias do solo</td><td class="water-risk-low">Baixo-Med</td></tr>
        <tr><td>Peixe morto</td><td>Decomposicao</td><td class="water-risk-high">Alto</td></tr>
        <tr><td>Cloro forte</td><td>Excesso tratamento</td><td class="water-risk-low">Baixo</td></tr>
      </table>
    </div>
    <div class="water-result-card">
      <h4>\u{1F41B} Indicadores Biologicos</h4>
      <table class="water-ref-table">
        <tr><th>Sinal</th><th>Significado</th></tr>
        <tr><td>Nenhuma vida aquatica</td><td class="water-risk-high">Contaminacao severa provavel</td></tr>
        <tr><td>Peixes mortos</td><td class="water-risk-high">Poluicao aguda</td></tr>
        <tr><td>Espuma persistente</td><td class="water-risk-med">Detergentes/organicos</td></tr>
        <tr><td>Algas espessas verdes</td><td class="water-risk-high">Eutrofizacao, toxinas</td></tr>
        <tr><td>Larvas de libelula</td><td class="water-risk-ok">\u2705 Sinal POSITIVO</td></tr>
        <tr><td>Girinos/sapos</td><td class="water-risk-ok">\u2705 Sinal POSITIVO</td></tr>
      </table>
    </div>
    <div class="water-result-card">
      <h4>\u{1F9EA} Teste Rapido de Espuma</h4>
      <div class="water-info">
        <p>1. Encha garrafa pela metade com agua suspeita</p>
        <p>2. Agite vigorosamente por 30 segundos</p>
        <p>3. Observe:</p>
        <p>\u2705 Espuma some em segundos = <strong>Normal</strong></p>
        <p>\u26A0\uFE0F Espuma persiste minutos = <strong>Contaminada</strong> (detergentes)</p>
      </div>
    </div>
    <div class="water-tips">
      <h4>\u{1F6D1} Regra Absoluta</h4>
      <ul>
        <li>Cheiro quimico + brilho oleoso + cor intensa = <strong>NENHUM metodo caseiro torna segura</strong></li>
        <li>Busque OUTRA fonte de agua</li>
      </ul>
    </div>`;
}
window.waterRenderContam = waterRenderContam;

/* ─── Reference Tables ─── */
function waterRenderTables() {
  const el = document.getElementById('waterTablesContent');
  if (!el || el.dataset.loaded) return;
  el.dataset.loaded = '1';

  el.innerHTML = `
    <div class="water-result-card">
      <h4>\u{1F3D4}\uFE0F Fervura por Altitude</h4>
      <table class="water-ref-table">
        <tr><th>Altitude</th><th>Ponto Ebulicao</th><th>Tempo Minimo</th></tr>
        <tr><td>0 - 1000m</td><td>100-97\u00B0C</td><td>1 minuto</td></tr>
        <tr><td>1000 - 2000m</td><td>97-93\u00B0C</td><td>2 minutos</td></tr>
        <tr><td>2000 - 3000m</td><td>93-90\u00B0C</td><td>3 minutos</td></tr>
        <tr><td>3000 - 4000m</td><td>90-87\u00B0C</td><td>5 minutos</td></tr>
        <tr><td>4000 - 5000m</td><td>87-83\u00B0C</td><td>7 minutos</td></tr>
        <tr><td>>5000m</td><td><83\u00B0C</td><td>10 minutos</td></tr>
      </table>
      <p class="water-table-note">Regra: +1 min a cada 300m de altitude</p>
    </div>
    <div class="water-result-card">
      <h4>\u2600\uFE0F SODIS por Condicao</h4>
      <table class="water-ref-table">
        <tr><th>Ceu</th><th>Turbidez</th><th>Tempo</th></tr>
        <tr><td>Sol forte</td><td>Clara</td><td>6 horas</td></tr>
        <tr><td>Sol forte</td><td>Levemente turva</td><td>8 horas</td></tr>
        <tr><td>Nublado parcial</td><td>Clara</td><td>2 dias</td></tr>
        <tr><td>Nublado parcial</td><td>Levemente turva</td><td>3 dias</td></tr>
        <tr><td>Chuva/nublado total</td><td>Qualquer</td><td class="water-risk-high">NAO FUNCIONA</td></tr>
      </table>
    </div>
    <div class="water-result-card">
      <h4>\u{1F9F4} Dosagem de Cloro (2,5%)</h4>
      <table class="water-ref-table">
        <tr><th>Volume</th><th>Agua Clara</th><th>Agua Turva</th><th>Tempo</th></tr>
        <tr><td>1L</td><td>2 gotas</td><td>4 gotas</td><td>30 min</td></tr>
        <tr><td>2L</td><td>4 gotas</td><td>8 gotas</td><td>30 min</td></tr>
        <tr><td>5L</td><td>10 gotas</td><td>20 gotas</td><td>30 min</td></tr>
        <tr><td>10L</td><td>20 gotas</td><td>40 gotas</td><td>30 min</td></tr>
        <tr><td>20L</td><td>40 gotas (\u00BD col. cha)</td><td>80 gotas (1 col. cha)</td><td>30 min</td></tr>
      </table>
    </div>
    <div class="water-result-card">
      <h4>\u{1F48A} Dosagem de Iodo (2%)</h4>
      <table class="water-ref-table">
        <tr><th>Volume</th><th>Agua Clara</th><th>Agua Turva/Fria</th><th>Tempo</th></tr>
        <tr><td>1L</td><td>5 gotas</td><td>10 gotas</td><td>30-60 min</td></tr>
        <tr><td>2L</td><td>10 gotas</td><td>20 gotas</td><td>30-60 min</td></tr>
        <tr><td>5L</td><td>25 gotas</td><td>50 gotas</td><td>30-60 min</td></tr>
      </table>
    </div>
    <div class="water-result-card">
      <h4>\u{1F4CA} Necessidade Diaria Base</h4>
      <table class="water-ref-table">
        <tr><th>Perfil</th><th>Litros/dia</th></tr>
        <tr><td>Repouso, clima ameno</td><td>2.0 L</td></tr>
        <tr><td>Atividade moderada</td><td>3.0 L</td></tr>
        <tr><td>Atividade intensa / calor</td><td>4.0 - 5.0 L</td></tr>
        <tr><td>Criancas (5-12)</td><td>1.0 - 1.5 L</td></tr>
        <tr><td>Bebes (0-1)</td><td>0.7 - 0.8 L</td></tr>
        <tr><td>Idosos (+65)</td><td>2.5 L</td></tr>
        <tr><td>Gravidas / Lactantes</td><td>3.0 - 3.5 L</td></tr>
        <tr><td>Doentes (febre/diarreia)</td><td>4.0 - 6.0 L</td></tr>
      </table>
    </div>
    <div class="water-result-card">
      <h4>\u{1F50D} Comparativo de Metodos</h4>
      <table class="water-ref-table water-ref-compare">
        <tr><th>Metodo</th><th>Bact.</th><th>Virus</th><th>Paras.</th><th>Quim.</th><th>Veloc.</th></tr>
        <tr><td>Fervura</td><td class="water-risk-ok">+++</td><td class="water-risk-ok">+++</td><td class="water-risk-ok">+++</td><td class="water-risk-high">-</td><td>5-15min</td></tr>
        <tr><td>Cloro</td><td class="water-risk-ok">+++</td><td class="water-risk-ok">+++</td><td class="water-risk-med">+</td><td class="water-risk-high">-</td><td>30-60min</td></tr>
        <tr><td>Iodo</td><td class="water-risk-ok">+++</td><td class="water-risk-ok">+++</td><td class="water-risk-ok">++</td><td class="water-risk-high">-</td><td>30-60min</td></tr>
        <tr><td>SODIS</td><td class="water-risk-ok">++</td><td class="water-risk-ok">++</td><td class="water-risk-med">+</td><td class="water-risk-high">-</td><td>6h-2d</td></tr>
        <tr><td>Ceramico</td><td class="water-risk-ok">+++</td><td class="water-risk-high">-</td><td class="water-risk-ok">+++</td><td class="water-risk-high">-</td><td>continuo</td></tr>
        <tr><td>Destilacao</td><td class="water-risk-ok">+++</td><td class="water-risk-ok">+++</td><td class="water-risk-ok">+++</td><td class="water-risk-ok">+++</td><td>lento</td></tr>
      </table>
      <p class="water-table-note">+++ Excelente | ++ Bom | + Parcial | - Ineficaz</p>
    </div>`;
}
window.waterRenderTables = waterRenderTables;


// ─── Agenda / Tasks ──────────────────────────────────────────────────────────
let _tasks = [];
let _taskEditId = null;

function tasksInit() {
  _taskEditId = null;
  taskCancelForm();
  taskLoad();
}
window.tasksInit = tasksInit;

function taskLoad() {
  const filter = document.getElementById('taskFilter')?.value || '';
  const url = '/api/tasks' + (filter ? '?status=' + filter : '');
  fetch(url)
    .then(r => r.json())
    .then(data => {
      _tasks = data;
      taskRender();
    })
    .catch(err => {
      const list = document.getElementById('tasksList');
      if (list) list.innerHTML = '<div class="task-empty">Erro ao carregar: ' + escapeHtml(err.message) + '</div>';
    });
}
window.taskLoad = taskLoad;

function taskRender() {
  const list = document.getElementById('tasksList');
  const counter = document.getElementById('taskCounter');
  if (!list) return;

  if (counter) {
    const pending = _tasks.filter(t => t.status !== 'done').length;
    counter.textContent = `${_tasks.length} tarefa${_tasks.length !== 1 ? 's' : ''} (${pending} pendente${pending !== 1 ? 's' : ''})`;
  }

  if (!_tasks.length) {
    list.innerHTML = '<div class="task-empty">\u{1F4CC} Nenhuma tarefa ainda.<br>Clique em "+ Nova Tarefa" para comecar.</div>';
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  list.innerHTML = _tasks.map(t => {
    const isDone = t.status === 'done';
    const isOverdue = t.due_date && t.due_date < today && !isDone;
    const priClass = 'pri-' + t.priority;
    const priLabel = { critical: 'CRITICA', high: 'ALTA', medium: 'MEDIA', low: 'BAIXA' }[t.priority] || t.priority;
    const statusIcon = { pending: '', doing: '\u{1F504} ', done: '\u2705 ' }[t.status] || '';

    return `<div class="task-item ${isDone ? 'task-done' : ''}">
      <div class="task-check ${isDone ? 'checked' : ''}" onclick="taskToggle(${t.id})">${isDone ? '\u2713' : ''}</div>
      <div class="task-body">
        <div class="task-title">${statusIcon}${escapeHtml(t.title)}</div>
        <div class="task-meta">
          <span class="task-badge ${priClass}">${priLabel}</span>
          <span class="task-badge cat">${escapeHtml(t.category)}</span>
          ${t.due_date ? `<span class="task-due ${isOverdue ? 'overdue' : ''}">${isOverdue ? '\u26A0 ' : '\u{1F4C5} '}${t.due_date}</span>` : ''}
        </div>
        ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
      </div>
      <div class="task-actions">
        <button onclick="taskEdit(${t.id})" title="Editar">\u270F\uFE0F</button>
        <button onclick="taskDelete(${t.id})" title="Excluir">\u{1F5D1}\uFE0F</button>
      </div>
    </div>`;
  }).join('');
}

function taskShowForm() {
  document.getElementById('taskForm')?.classList.remove('hidden');
  document.getElementById('taskTitle')?.focus();
}
window.taskShowForm = taskShowForm;

function taskCancelForm() {
  document.getElementById('taskForm')?.classList.add('hidden');
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskCategory').value = 'geral';
  document.getElementById('taskDue').value = '';
  _taskEditId = null;
  document.getElementById('taskSaveBtn').textContent = 'Salvar';
}
window.taskCancelForm = taskCancelForm;

function taskSave() {
  const title = document.getElementById('taskTitle')?.value.trim();
  if (!title) { osToast('Titulo obrigatorio', 2000, 'warning'); return; }

  const body = {
    title,
    description: document.getElementById('taskDesc')?.value || '',
    priority: document.getElementById('taskPriority')?.value || 'medium',
    category: document.getElementById('taskCategory')?.value || 'geral',
    due_date: document.getElementById('taskDue')?.value || null,
  };

  const url = _taskEditId ? `/api/tasks/${_taskEditId}` : '/api/tasks';
  const method = _taskEditId ? 'PUT' : 'POST';

  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(r => r.json())
    .then(() => {
      taskCancelForm();
      taskLoad();
      osToast(_taskEditId ? '\u{1F4CC} Tarefa atualizada' : '\u{1F4CC} Tarefa criada', 2000, 'success');
    })
    .catch(err => osToast('Erro: ' + err.message, 3000, 'error'));
}
window.taskSave = taskSave;

function taskToggle(id) {
  const task = _tasks.find(t => t.id === id);
  if (!task) return;
  const newStatus = task.status === 'done' ? 'pending' : 'done';
  fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus }),
  })
    .then(() => taskLoad())
    .catch(err => osToast('Erro: ' + err.message, 3000, 'error'));
}
window.taskToggle = taskToggle;

function taskEdit(id) {
  const task = _tasks.find(t => t.id === id);
  if (!task) return;
  _taskEditId = id;
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDesc').value = task.description || '';
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskCategory').value = task.category;
  document.getElementById('taskDue').value = task.due_date || '';
  document.getElementById('taskSaveBtn').textContent = 'Atualizar';
  taskShowForm();
}
window.taskEdit = taskEdit;

function taskDelete(id) {
  if (!confirm('Excluir esta tarefa?')) return;
  fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    .then(() => { taskLoad(); osToast('\u{1F5D1}\uFE0F Tarefa excluida', 2000, 'info'); })
    .catch(err => osToast('Erro: ' + err.message, 3000, 'error'));
}
window.taskDelete = taskDelete;


// ─── Media Player ────────────────────────────────────────────────────────────
let _mediaFiles = [];

function mediaInit() {
  const listEl = document.getElementById('mediaList');
  const playerEl = document.getElementById('mediaPlayer');
  if (!listEl) return;

  // Load media files from file manager API
  fetch('/api/files?path=data/media')
    .then(r => r.ok ? r.json() : { files: [] })
    .then(data => {
      _mediaFiles = (data.files || []).filter(f =>
        /\.(mp4|webm|mp3|ogg|wav|m4a|flac|mkv|avi)$/i.test(f.name)
      );
      mediaRenderList();
    })
    .catch(() => { listEl.innerHTML = '<div class="media-empty">Coloque arquivos em <code>data/media/</code></div>'; });
}
window.mediaInit = mediaInit;

function mediaRenderList() {
  const listEl = document.getElementById('mediaList');
  if (!listEl) return;
  if (!_mediaFiles.length) {
    listEl.innerHTML = '<div class="media-empty">Nenhuma midia encontrada.<br>Coloque arquivos de video/audio em <code>data/media/</code><br><br>Formatos: mp4, webm, mp3, ogg, wav, m4a, flac</div>';
    return;
  }
  listEl.innerHTML = _mediaFiles.map((f, i) => {
    const isVideo = /\.(mp4|webm|mkv|avi)$/i.test(f.name);
    const icon = isVideo ? '🎬' : '🎵';
    return `<div class="media-item" onclick="mediaPlay(${i})">${icon} ${escapeHtml(f.name)}</div>`;
  }).join('');
}

function mediaPlay(idx) {
  const f = _mediaFiles[idx];
  if (!f) return;
  const playerEl = document.getElementById('mediaPlayer');
  const titleEl = document.getElementById('mediaTitle');
  if (!playerEl) return;

  const isVideo = /\.(mp4|webm|mkv|avi)$/i.test(f.name);
  const src = `/api/files/read?path=${encodeURIComponent('data/media/' + f.name)}&raw=1`;

  if (titleEl) titleEl.textContent = f.name;

  if (isVideo) {
    playerEl.innerHTML = `<video controls autoplay style="width:100%;max-height:360px;border-radius:8px;background:#000"><source src="${src}"></video>`;
  } else {
    playerEl.innerHTML = `<div class="media-audio-art">🎵</div><audio controls autoplay style="width:100%"><source src="${src}"></audio>`;
  }

  // Highlight active
  document.querySelectorAll('.media-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}
window.mediaPlay = mediaPlay;

// ─── Terminal (hidden — power user only) ─────────────────────────────────────
let _termHistory = [];
let _termHistIdx = -1;

function terminalInit() {
  const input = document.getElementById('terminalInput');
  if (input) {
    input.focus();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (_termHistIdx < _termHistory.length - 1) {
          _termHistIdx++;
          input.value = _termHistory[_termHistory.length - 1 - _termHistIdx];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (_termHistIdx > 0) {
          _termHistIdx--;
          input.value = _termHistory[_termHistory.length - 1 - _termHistIdx];
        } else {
          _termHistIdx = -1;
          input.value = '';
        }
      }
    });
  }
}
window.terminalInit = terminalInit;

function terminalExec() {
  const input = document.getElementById('terminalInput');
  const output = document.getElementById('terminalOutput');
  if (!input || !output) return;

  const cmd = input.value.trim();
  input.value = '';
  _termHistIdx = -1;
  if (!cmd) return;

  _termHistory.push(cmd);
  const cmdLine = document.createElement('div');
  cmdLine.className = 'terminal-line term-cmd';
  cmdLine.textContent = cmd;
  output.appendChild(cmdLine);

  // Built-in commands
  if (cmd === 'clear' || cmd === 'cls') {
    output.innerHTML = '';
    return;
  }
  if (cmd === 'help') {
    termAddLine('Comandos disponiveis:', 'term-info');
    termAddLine('  help      - Mostra esta ajuda');
    termAddLine('  clear     - Limpa o terminal');
    termAddLine('  ls/dir    - Listar arquivos');
    termAddLine('  cat/type  - Ler arquivo');
    termAddLine('  pwd       - Diretorio atual');
    termAddLine('  date      - Data atual');
    termAddLine('  ping      - Testar conexao');
    termAddLine('  python    - Executar Python');
    termAddLine('  git       - Comandos Git');
    termAddLine('  tree      - Arvore de diretorios');
    output.scrollTop = output.scrollHeight;
    return;
  }

  fetch('/api/terminal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: cmd }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.output) {
        const cls = data.exit_code !== 0 ? 'term-err' : '';
        data.output.split('\n').forEach(line => termAddLine(line, cls));
      }
      output.scrollTop = output.scrollHeight;
    })
    .catch(err => {
      termAddLine('Erro de conexao: ' + err.message, 'term-err');
      output.scrollTop = output.scrollHeight;
    });
}
window.terminalExec = terminalExec;

function termAddLine(text, cls = '') {
  const output = document.getElementById('terminalOutput');
  if (!output) return;
  const line = document.createElement('div');
  line.className = 'terminal-line' + (cls ? ' ' + cls : '');
  line.textContent = text;
  output.appendChild(line);
}

// ─── File Manager ────────────────────────────────────────────────────────────
let _fmPath = '';

function fileManagerInit() {
  _fmPath = '';
  fmNavigate('.');
}
window.fileManagerInit = fileManagerInit;

function fmNavigate(path) {
  if (path === '..') {
    const parts = _fmPath.split('/').filter(Boolean);
    parts.pop();
    path = parts.join('/') || '.';
  }
  if (path === '.') path = _fmPath || '.';
  if (path !== '.' && path !== _fmPath && !path.startsWith('/')) {
    path = _fmPath ? _fmPath + '/' + path : path;
  }

  const content = document.getElementById('fmContent');
  if (content) content.innerHTML = '<div class="fm-loading">Carregando...</div>';
  fmClosePreview();

  fetch('/api/files?path=' + encodeURIComponent(path))
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        if (content) content.innerHTML = '<div class="fm-loading">' + escapeHtml(data.error) + '</div>';
        return;
      }
      _fmPath = data.path;
      fmRender(data.items);
      const bc = document.getElementById('fmBreadcrumb');
      if (bc) bc.textContent = '/ ' + (_fmPath || 'raiz');
    })
    .catch(err => {
      if (content) content.innerHTML = '<div class="fm-loading">Erro: ' + escapeHtml(err.message) + '</div>';
    });
}
window.fmNavigate = fmNavigate;

function fmRender(items) {
  const content = document.getElementById('fmContent');
  if (!content) return;

  if (!items.length) {
    content.innerHTML = '<div class="fm-loading">Pasta vazia</div>';
    return;
  }

  const extIcons = {
    '.py': '\u{1F40D}', '.js': '\u{1F4DC}', '.css': '\u{1F3A8}', '.html': '\u{1F310}',
    '.json': '\u{1F4CB}', '.md': '\u{1F4D6}', '.txt': '\u{1F4C4}', '.log': '\u{1F4DD}',
    '.db': '\u{1F5C4}\uFE0F', '.sqlite': '\u{1F5C4}\uFE0F', '.sqlite3': '\u{1F5C4}\uFE0F',
    '.png': '\u{1F5BC}\uFE0F', '.jpg': '\u{1F5BC}\uFE0F', '.jpeg': '\u{1F5BC}\uFE0F', '.gif': '\u{1F5BC}\uFE0F',
    '.pdf': '\u{1F4D5}', '.zip': '\u{1F4E6}', '.bat': '\u{2699}\uFE0F', '.sh': '\u{2699}\uFE0F',
    '.yaml': '\u{1F4CB}', '.yml': '\u{1F4CB}', '.toml': '\u{1F4CB}', '.cfg': '\u{1F4CB}',
    '.csv': '\u{1F4CA}', '.xml': '\u{1F4C3}',
  };

  const grid = document.createElement('div');
  grid.className = 'fm-grid';
  for (const item of items) {
    const el = document.createElement('div');
    el.className = 'fm-item';
    const icon = item.type === 'dir' ? '\u{1F4C1}' : (extIcons[item.ext] || '\u{1F4C4}');
    const sizeStr = item.size != null ? fmFormatSize(item.size) : '';
    el.innerHTML = `<span class="fm-item-icon">${icon}</span><span class="fm-item-name">${escapeHtml(item.name)}</span>${sizeStr ? `<span class="fm-item-size">${sizeStr}</span>` : ''}`;

    if (item.type === 'dir') {
      el.ondblclick = () => fmNavigate(item.name);
    } else {
      el.onclick = () => fmOpenFile(item);
    }
    grid.appendChild(el);
  }
  content.innerHTML = '';
  content.appendChild(grid);
}

function fmFormatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function fmOpenFile(item) {
  const preview = document.getElementById('fmPreview');
  const nameEl = document.getElementById('fmPreviewName');
  const contentEl = document.getElementById('fmPreviewContent');
  if (!preview || !contentEl) return;

  nameEl.textContent = item.name;
  contentEl.textContent = 'Carregando...';
  preview.classList.remove('hidden');

  const filePath = _fmPath ? _fmPath + '/' + item.name : item.name;
  fetch('/api/files/read?path=' + encodeURIComponent(filePath))
    .then(r => r.json())
    .then(data => {
      if (data.error) contentEl.textContent = data.error;
      else contentEl.textContent = data.content;
    })
    .catch(err => contentEl.textContent = 'Erro: ' + err.message);
}

function fmClosePreview() {
  const preview = document.getElementById('fmPreview');
  if (preview) preview.classList.add('hidden');
}
window.fmClosePreview = fmClosePreview;

// ─── Paint / Draw ────────────────────────────────────────────────────────────
const paintState = {
  tool: 'brush',
  color: '#00ffaa',
  size: 3,
  drawing: false,
  lastX: 0,
  lastY: 0,
  history: [],
  startX: 0,
  startY: 0,
  snapshot: null,
};
window.paintState = paintState;

function paintInit() {
  const canvas = document.getElementById('paintCanvas');
  if (!canvas) return;
  const parent = canvas.parentElement;

  function resizeCanvas() {
    const toolbarH = document.getElementById('paintToolbar')?.offsetHeight || 40;
    const w = parent.clientWidth;
    const h = parent.clientHeight - toolbarH;
    if (canvas.width !== w || canvas.height !== h) {
      // Save current content
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);
    }
  }
  resizeCanvas();

  const ctx = canvas.getContext('2d');
  paintState.history = [];
  paintSaveState();

  canvas.addEventListener('mousedown', (e) => {
    paintState.drawing = true;
    const rect = canvas.getBoundingClientRect();
    paintState.lastX = e.clientX - rect.left;
    paintState.lastY = e.clientY - rect.top;
    paintState.startX = paintState.lastX;
    paintState.startY = paintState.lastY;
    paintState.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (paintState.tool === 'fill') {
      paintFloodFill(ctx, Math.round(paintState.lastX), Math.round(paintState.lastY), paintState.color);
      paintState.drawing = false;
      paintSaveState();
    } else if (paintState.tool === 'brush' || paintState.tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(paintState.lastX, paintState.lastY);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!paintState.drawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (paintState.tool === 'brush' || paintState.tool === 'eraser') {
      ctx.lineWidth = paintState.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = paintState.tool === 'eraser' ? '#1a1a2e' : paintState.color;
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      // Preview shapes
      ctx.putImageData(paintState.snapshot, 0, 0);
      ctx.strokeStyle = paintState.color;
      ctx.lineWidth = paintState.size;
      ctx.lineCap = 'round';

      if (paintState.tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(paintState.startX, paintState.startY);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (paintState.tool === 'rect') {
        ctx.strokeRect(paintState.startX, paintState.startY, x - paintState.startX, y - paintState.startY);
      } else if (paintState.tool === 'circle') {
        const rx = Math.abs(x - paintState.startX) / 2;
        const ry = Math.abs(y - paintState.startY) / 2;
        const cx = paintState.startX + (x - paintState.startX) / 2;
        const cy = paintState.startY + (y - paintState.startY) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    paintState.lastX = x;
    paintState.lastY = y;
  });

  canvas.addEventListener('mouseup', () => {
    if (paintState.drawing) {
      paintState.drawing = false;
      paintSaveState();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (paintState.drawing) {
      paintState.drawing = false;
      paintSaveState();
    }
  });

  // Observe resize
  new ResizeObserver(resizeCanvas).observe(parent);
}
window.paintInit = paintInit;

function paintSetTool(tool) {
  paintState.tool = tool;
  document.querySelectorAll('.paint-tool[data-tool]').forEach(el => {
    el.classList.toggle('active', el.dataset.tool === tool);
  });
}
window.paintSetTool = paintSetTool;

function paintSaveState() {
  const canvas = document.getElementById('paintCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  paintState.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (paintState.history.length > 30) paintState.history.shift();
}

function paintUndo() {
  const canvas = document.getElementById('paintCanvas');
  if (!canvas || paintState.history.length < 2) return;
  paintState.history.pop(); // Remove current
  const prev = paintState.history[paintState.history.length - 1];
  canvas.getContext('2d').putImageData(prev, 0, 0);
}
window.paintUndo = paintUndo;

function paintClear() {
  const canvas = document.getElementById('paintCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  paintSaveState();
}
window.paintClear = paintClear;

function paintSave() {
  const canvas = document.getElementById('paintCanvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = 'bunker-paint-' + Date.now() + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  osToast('\u{1F4BE} Imagem salva!', 2500, 'success');
}
window.paintSave = paintSave;

function paintFloodFill(ctx, startX, startY, fillColor) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Parse fill color
  const temp = document.createElement('canvas').getContext('2d');
  temp.fillStyle = fillColor;
  temp.fillRect(0, 0, 1, 1);
  const fc = temp.getImageData(0, 0, 1, 1).data;

  const targetIdx = (startY * w + startX) * 4;
  const tr = data[targetIdx], tg = data[targetIdx + 1], tb = data[targetIdx + 2];

  if (tr === fc[0] && tg === fc[1] && tb === fc[2]) return;

  const stack = [[startX, startY]];
  const visited = new Uint8Array(w * h);

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    const idx = y * w + x;
    if (visited[idx]) continue;

    const pi = idx * 4;
    if (Math.abs(data[pi] - tr) > 30 || Math.abs(data[pi + 1] - tg) > 30 || Math.abs(data[pi + 2] - tb) > 30) continue;

    visited[idx] = 1;
    data[pi] = fc[0]; data[pi + 1] = fc[1]; data[pi + 2] = fc[2]; data[pi + 3] = 255;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(imageData, 0, 0);
}


// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE GENERATOR (stable-diffusion.cpp via sd-server)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Imagine — Intelligent Image Generator ──────────────────────────────────

let _imagineStyle = "";
let _imagineLastUrl = "";
let _imagineLastPrompt = "";
let _imagineLastNeg = "";
let _imagineBusy = false;
let _imagineAbort = null; // AbortController for cancelling generation

function imagineInit() {
  fetch("/api/imagine/status").then(r => r.json()).then(d => {
    if (d.available) {
      _imagineShowMode("generate");
    } else {
      _imagineShowMode("setup");
      // Auto-install binary if missing
      if (d.need_binary) {
        const step1 = document.getElementById("imagineStep1");
        if (step1) step1.style.display = "block";
        // Auto-start download immediately
        _imagineAutoInstallBinary();
      }
      const step2Title = document.getElementById("imagineStep2Title");
      if (d.need_binary && step2Title) {
        step2Title.textContent = "Passo 2 — Modelo de imagem";
      }
      imagineLoadModels();
    }
  }).catch(() => {
    _imagineShowMode("setup");
    imagineLoadModels();
  });
  imagineLoadHistory();
}

function _imagineAutoInstallBinary() {
  // Check if auto-download is available, then start it silently
  fetch("/api/imagine/binary/status").then(r => r.json()).then(d => {
    if (d.has_binary) {
      // Already installed — hide step 1
      const step1 = document.getElementById("imagineStep1");
      if (step1) step1.style.display = "none";
      return;
    }
    if (!d.download_available) {
      // Can't auto-download for this platform — show manual instructions
      const content = document.getElementById("imagineStep1Content");
      if (content) content.innerHTML = `<div style="font-size:11px;color:var(--text-muted);">
        Baixe <b>sd-server</b> manualmente para ${d.platform}/${d.arch}:<br>
        <a href="${d.releases_url}" target="_blank" style="color:var(--accent);">GitHub Releases</a>
        &nbsp;→ coloque em <code>tools/</code>
      </div>`;
      return;
    }
    // Auto-download
    const content = document.getElementById("imagineStep1Content");
    if (content) content.innerHTML = `<div style="font-size:11px;color:var(--accent);">Instalando sd-server automaticamente...</div>
      <div style="margin-top:6px;">
        <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;">
          <div id="imagineBinaryFill" style="height:100%;width:0%;background:var(--accent);transition:width 0.3s;"></div>
        </div>
        <div id="imagineBinaryPct" style="font-size:10px;color:var(--text-muted);margin-top:2px;">Baixando...</div>
      </div>`;

    fetch("/api/imagine/binary/download", { method: "POST" }).then(r => r.json()).then(() => {
      if (_imagineBinaryPoll) clearInterval(_imagineBinaryPoll);
      _imagineBinaryPoll = setInterval(() => {
        fetch("/api/imagine/binary/progress").then(r => r.json()).then(p => {
          const fill = document.getElementById("imagineBinaryFill");
          const pct = document.getElementById("imagineBinaryPct");
          if (fill) fill.style.width = `${p.percent || 0}%`;
          if (pct) pct.textContent = p.status === "extracting" ? "Extraindo..." : `${Math.round(p.percent || 0)}%`;
          if (p.status === "complete" || p.percent >= 100) {
            clearInterval(_imagineBinaryPoll);
            _imagineBinaryPoll = null;
            const step1 = document.getElementById("imagineStep1");
            if (step1) step1.style.display = "none";
            // Re-check: maybe model is also ready → go to generate mode
            setTimeout(() => imagineInit(), 1500);
          }
          if (p.error || p.status === "error") {
            clearInterval(_imagineBinaryPoll);
            _imagineBinaryPoll = null;
            if (pct) pct.textContent = "Erro. Baixe manualmente.";
          }
        });
      }, 1000);
    });
  }).catch(() => {});
}

function _imagineShowMode(mode) {
  const setup = document.getElementById("imagineSetup");
  const gen = document.getElementById("imagineGenerator");
  if (mode === "generate") {
    if (setup) setup.style.display = "none";
    if (gen) gen.style.display = "flex";
  } else {
    if (setup) setup.style.display = "flex";
    if (gen) gen.style.display = "none";
  }
}

function imagineLoadModels() {
  fetch("/api/imagine/models").then(r => r.json()).then(d => {
    const el = document.getElementById("imagineModelList");
    if (!el) return;
    const hasGpu = d.has_gpu;

    el.innerHTML = d.models.map(m => {
      if (m.downloaded) {
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(0,200,100,0.06);border:1px solid rgba(0,200,100,0.3);border-radius:var(--radius);">
          <div style="font-size:18px;">✅</div>
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:600;color:var(--green);">${m.name}</div>
            <div style="font-size:10px;color:var(--text-muted);">${m.size_gb} GB · Pronto para usar</div>
          </div>
          <button class="btn-sm" onclick="imagineDeleteModel('${m.id}')" style="font-size:10px;padding:2px 6px;opacity:0.5;">✕</button>
        </div>`;
      }
      if (m.downloading) {
        return `<div style="padding:8px 10px;background:var(--accent-dim);border:1px solid var(--accent);border-radius:var(--radius);">
          <div style="font-size:12px;color:var(--accent);font-weight:500;">Baixando ${m.name}...</div>
        </div>`;
      }
      const gpuTag = m.requires_gpu && !hasGpu ? '<span style="color:var(--warning);font-size:9px;border:1px solid var(--warning);padding:0 4px;border-radius:3px;margin-left:4px;">GPU</span>' : '';
      const recTag = m.recommended ? '<span style="color:var(--green);font-size:9px;border:1px solid var(--green);padding:0 4px;border-radius:3px;margin-left:4px;">RECOMENDADO</span>' : '';
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);">
        <div style="font-size:18px;opacity:0.4;">🖼</div>
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:500;">${m.name}${recTag}${gpuTag}</div>
          <div style="font-size:10px;color:var(--text-muted);">${m.size_gb} GB · ${m.desc || ''}</div>
        </div>
        <button class="btn-sm btn-accent" onclick="imagineDownloadModel('${m.id}')" style="font-size:11px;padding:4px 12px;">Baixar</button>
      </div>`;
    }).join("");
  }).catch(() => {});
}

let _imagineDownloadPoll = null;

function imagineDownloadModel(modelId) {
  fetch("/api/imagine/models/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_id: modelId }),
  }).then(r => r.json()).then(d => {
    if (d.status === "already_downloaded") {
      imagineLoadModels();
      return;
    }
    // Show progress
    const ds = document.getElementById("imagineDownloadStatus");
    if (ds) ds.style.display = "block";
    // Poll progress
    if (_imagineDownloadPoll) clearInterval(_imagineDownloadPoll);
    _imagineDownloadPoll = setInterval(() => {
      fetch(`/api/imagine/models/progress/${modelId}`).then(r => r.json()).then(p => {
        const fill = document.getElementById("imagineDownloadFill");
        const pct = document.getElementById("imagineDownloadPct");
        const spd = document.getElementById("imagineDownloadSpeed");
        if (fill) fill.style.width = `${p.percent || 0}%`;
        if (pct) pct.textContent = `${Math.round(p.percent || 0)}%`;
        if (spd) spd.textContent = p.speed || "";
        if (p.status === "complete" || p.percent >= 100) {
          clearInterval(_imagineDownloadPoll);
          _imagineDownloadPoll = null;
          if (ds) ds.style.display = "none";
          imagineLoadModels();
          // Re-check status (might auto-start sd-server)
          setTimeout(() => imagineInit(), 2000);
        }
        if (p.error) {
          clearInterval(_imagineDownloadPoll);
          _imagineDownloadPoll = null;
          if (ds) ds.style.display = "none";
          alert("Erro no download: " + p.error);
        }
      });
    }, 1000);
  });
}

function imagineDeleteModel(modelId) {
  if (!confirm("Remover este modelo de imagem?")) return;
  fetch(`/api/imagine/models/${modelId}`, { method: "DELETE" }).then(() => imagineLoadModels());
}

function imagineCheckBinary() {
  fetch("/api/imagine/binary/status").then(r => r.json()).then(d => {
    const nb = document.getElementById("imagineNoBinary");
    if (d.has_binary) {
      if (nb) nb.style.display = "none";
      return;
    }
    if (nb) nb.style.display = "block";
    const autoEl = document.getElementById("imagineNoBinaryAuto");
    const manualEl = document.getElementById("imagineNoBinaryManual");
    if (d.download_available) {
      if (autoEl) autoEl.style.display = "block";
      if (manualEl) manualEl.innerHTML = `Ou baixe manualmente: <a href="${d.releases_url}" target="_blank" style="color:var(--accent);">GitHub Releases</a> (${d.platform}/${d.arch})`;
    }
  }).catch(() => {});
}

let _imagineBinaryPoll = null;

function imagineDownloadBinary() {
  const btn = document.getElementById("imagineBtnDlBinary");
  if (btn) { btn.disabled = true; btn.textContent = "Baixando..."; }
  const prog = document.getElementById("imagineBinaryProgress");
  if (prog) prog.style.display = "block";

  fetch("/api/imagine/binary/download", { method: "POST" }).then(r => r.json()).then(d => {
    if (d.status === "started" || d.status === "already_downloading") {
      if (_imagineBinaryPoll) clearInterval(_imagineBinaryPoll);
      _imagineBinaryPoll = setInterval(() => {
        fetch("/api/imagine/binary/progress").then(r => r.json()).then(p => {
          const fill = document.getElementById("imagineBinaryFill");
          const pct = document.getElementById("imagineBinaryPct");
          if (fill) fill.style.width = `${p.percent || 0}%`;
          if (pct) pct.textContent = `${p.status === "extracting" ? "Extraindo..." : Math.round(p.percent || 0) + "%"}`;
          if (p.status === "complete" || p.percent >= 100) {
            clearInterval(_imagineBinaryPoll);
            _imagineBinaryPoll = null;
            const nb = document.getElementById("imagineNoBinary");
            if (nb) nb.style.display = "none";
            // Re-init to check everything
            setTimeout(() => imagineInit(), 1000);
          }
          if (p.error || p.status === "error") {
            clearInterval(_imagineBinaryPoll);
            _imagineBinaryPoll = null;
            if (btn) { btn.disabled = false; btn.textContent = "Tentar novamente"; }
            if (pct) pct.textContent = "Erro: " + (p.error || "falha");
          }
        });
      }, 1000);
    }
  }).catch(() => {
    if (btn) { btn.disabled = false; btn.textContent = "Tentar novamente"; }
  });
}

function imagineCancel() {
  if (_imagineAbort) {
    _imagineAbort.abort();
    _imagineAbort = null;
  }
  _imagineStopProgress();
  _imagineSetBusy(false);
  const result = document.getElementById("imagineResult");
  if (result) result.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:12px;">Geração cancelada</div>`;
}

window.imagineCancel = imagineCancel;
window.imagineLoadModels = imagineLoadModels;
window.imagineDownloadModel = imagineDownloadModel;
window.imagineDeleteModel = imagineDeleteModel;
window.imagineDownloadBinary = imagineDownloadBinary;
window.imagineCheckBinary = imagineCheckBinary;

function imagineSetStyle(btn) {
  document.querySelectorAll(".imagine-style").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  _imagineStyle = btn.dataset.style || "";
}

function _imagineGetSize() {
  const v = document.getElementById("imagineSize")?.value || "512x512";
  const [w, h] = v.split("x").map(Number);
  return { width: w || 512, height: h || 512 };
}

function _imagineSetBusy(busy, msg) {
  _imagineBusy = busy;
  const btn = document.getElementById("imagineBtnGenerate");
  const btnE = document.getElementById("imagineBtnEnhance");
  const btnCancel = document.getElementById("imagineBtnCancel");
  if (btn) { btn.disabled = busy; btn.style.display = busy ? "none" : ""; }
  if (btnE) { btnE.disabled = busy; }
  if (btnCancel) btnCancel.style.display = busy ? "" : "none";
  if (!busy) _imagineAbort = null;
  if (msg) {
    const st = document.getElementById("imagineStatus");
    if (st) { st.textContent = msg; st.style.color = "var(--accent)"; }
  }
}

function _imagineShowResult(url, prompt) {
  _imagineStopProgress();
  const result = document.getElementById("imagineResult");
  if (!result) return;
  _imagineLastUrl = url;
  result.innerHTML = `<img src="${url}" alt="Generated" style="max-width:100%;max-height:100%;object-fit:contain;cursor:pointer;" onclick="imagineLightboxOpen(0)" title="Clique para ampliar">`;
  const actions = document.getElementById("imagineActions");
  if (actions) actions.style.display = "flex";
  const st = document.getElementById("imagineStatus");
  if (st) { st.textContent = "Pronto!"; st.style.color = "var(--green)"; }
}

function _imagineShowError(msg) {
  _imagineStopProgress();
  const result = document.getElementById("imagineResult");
  if (result) result.innerHTML = `<div style="text-align:center;color:var(--danger);font-size:13px;padding:20px;">
    <div style="font-size:24px;margin-bottom:8px;">⚠</div>${msg}
  </div>`;
  const st = document.getElementById("imagineStatus");
  if (st) { st.textContent = "Erro"; st.style.color = "var(--danger)"; }
}

let _imagineProgressInterval = null;
let _imagineProgressStart = 0;

function _imagineShowLoading(msg, totalSteps) {
  const result = document.getElementById("imagineResult");
  if (!result) return;

  const steps = totalSteps || parseInt(document.getElementById("imagineSteps")?.value || "4");
  // Estimate: ~2s/step on GPU, ~8s/step on CPU for SD 2.1 Turbo
  const estSecsPerStep = steps <= 4 ? 3 : 5;
  const estTotal = steps * estSecsPerStep;

  result.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px;width:80%;max-width:300px;">
    <div style="font-size:28px;animation:media-pulse 1.5s infinite;">🎨</div>
    <div style="font-size:13px;color:var(--text);font-weight:500;" id="imagineLoadMsg">${msg}</div>
    <div style="width:100%;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
      <div id="imagineGenBar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent),#a855f7);border-radius:3px;transition:width 0.5s ease;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;width:100%;font-size:10px;color:var(--text-muted);">
      <span id="imagineGenStep">Preparando...</span>
      <span id="imagineGenTime">~${estTotal}s</span>
    </div>
  </div>`;

  _imagineProgressStart = Date.now();
  if (_imagineProgressInterval) clearInterval(_imagineProgressInterval);

  let phase = 0; // 0=preparing, 1=generating, 2=finalizing
  const phases = [
    { at: 0, pct: 5, label: "Carregando modelo..." },
    { at: 0.05, pct: 10, label: `Gerando (${steps} steps)...` },
    { at: 0.95, pct: 95, label: "Finalizando imagem..." },
  ];

  _imagineProgressInterval = setInterval(() => {
    const elapsed = (Date.now() - _imagineProgressStart) / 1000;
    const progress = Math.min(elapsed / estTotal, 0.98);
    const pct = Math.round(progress * 100);

    const bar = document.getElementById("imagineGenBar");
    const stepEl = document.getElementById("imagineGenStep");
    const timeEl = document.getElementById("imagineGenTime");

    if (bar) bar.style.width = `${pct}%`;

    // Update phase label
    if (progress < 0.05) {
      if (stepEl) stepEl.textContent = "Carregando modelo...";
    } else if (progress < 0.95) {
      const currentStep = Math.min(Math.floor(progress * steps / 0.9), steps);
      if (stepEl) stepEl.textContent = `Step ${currentStep}/${steps}`;
    } else {
      if (stepEl) stepEl.textContent = "Decodificando VAE...";
    }

    const remaining = Math.max(0, Math.round(estTotal - elapsed));
    if (timeEl) timeEl.textContent = remaining > 0 ? `~${remaining}s` : "quase...";
  }, 500);
}

function _imagineShowSimpleLoading(icon, msg) {
  _imagineStopProgress();
  const result = document.getElementById("imagineResult");
  if (result) result.innerHTML = `<div style="text-align:center;color:var(--accent);">
    <div style="font-size:28px;animation:media-pulse 1.5s infinite;">${icon}</div>
    <div style="font-size:12px;margin-top:8px;">${msg}</div>
  </div>`;
}

function _imagineStopProgress() {
  if (_imagineProgressInterval) {
    clearInterval(_imagineProgressInterval);
    _imagineProgressInterval = null;
  }
  // Flash to 100%
  const bar = document.getElementById("imagineGenBar");
  if (bar) bar.style.width = "100%";
}

async function _imagineCallEnhance(prompt, style) {
  const resp = await fetch("/api/imagine/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, style }),
  });
  return resp.json();
}

async function _imagineCallGenerate(prompt, negPrompt, originalPrompt) {
  const { width, height } = _imagineGetSize();
  const steps = parseInt(document.getElementById("imagineSteps")?.value || "20");
  const cfg = parseFloat(document.getElementById("imagineCfg")?.value || "7");
  const seed = parseInt(document.getElementById("imagineSeed")?.value || "-1");

  _imagineAbort = new AbortController();
  const resp = await fetch("/api/imagine/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt, negative_prompt: negPrompt, original_prompt: originalPrompt,
      steps, width, height, cfg_scale: cfg, seed,
    }),
    signal: _imagineAbort.signal,
  });
  return resp.json();
}

/** Main flow: enhance prompt with LLM, then generate image */
async function imagineEnhanceAndGenerate() {
  if (_imagineBusy) return;
  const prompt = document.getElementById("imaginePrompt")?.value?.trim();
  if (!prompt) return;

  _imagineSetBusy(true, "🧠 Melhorando prompt...");
  _imagineShowSimpleLoading("🧠", "Melhorando prompt com IA...");

  try {
    const enhanced = await _imagineCallEnhance(prompt, _imagineStyle);
    if (enhanced.error === "no_llm") {
      // No LLM available — generate directly with style keywords
      return imagineGenerateDirect();
    }
    if (enhanced.error) { _imagineShowError(enhanced.error || enhanced.message); _imagineSetBusy(false); return; }

    const ep = enhanced.enhanced_prompt || prompt;
    const neg = enhanced.negative_prompt || "";
    _imagineLastPrompt = ep;
    _imagineLastNeg = neg;

    // Show enhanced prompt
    const epEl = document.getElementById("imagineEnhancedPrompt");
    const negEl = document.getElementById("imagineNegPrompt");
    const container = document.getElementById("imagineEnhanced");
    if (epEl) epEl.value = ep;
    if (negEl) negEl.value = neg;
    if (container) container.style.display = "flex";

    // Now generate
    _imagineSetBusy(true, "🎨 Gerando imagem...");
    _imagineShowLoading("Gerando imagem...");

    const data = await _imagineCallGenerate(ep, neg, prompt);
    if (data.error) { _imagineShowError(data.error); _imagineSetBusy(false); return; }
    if (data.image) {
      _imagineShowResult(data.image, ep);
      imagineLoadHistory();
    }
  } catch (e) {
    if (e.name === "AbortError") return;
    _imagineShowError("sd-server offline ou erro de conexao.");
  }
  _imagineSetBusy(false);
}

/** Generate without LLM enhancement — just add style keywords */
async function imagineGenerateDirect() {
  if (_imagineBusy) return;
  const prompt = document.getElementById("imaginePrompt")?.value?.trim();
  if (!prompt) return;

  // Append style keywords if a preset is selected
  const styleMap = {
    "photorealistic": "photorealistic, 8k uhd, highly detailed, natural lighting, masterpiece",
    "anime": "anime style, vibrant colors, cel shading, masterpiece, best quality",
    "pixel art": "pixel art, 16-bit, retro game style, clean pixels",
    "oil painting": "oil painting on canvas, classical art, textured brushstrokes, masterpiece",
    "watercolor": "watercolor painting, soft edges, pastel colors, delicate, artistic",
    "concept art": "concept art, digital painting, artstation trending, highly detailed",
    "photography": "professional photography, DSLR, bokeh, f/1.8, sharp focus, 8k",
    "sci-fi": "sci-fi, futuristic, neon lighting, cyberpunk, detailed, 8k",
  };

  let fullPrompt = prompt;
  if (_imagineStyle && styleMap[_imagineStyle]) {
    fullPrompt = `${prompt}, ${styleMap[_imagineStyle]}`;
  }

  _imagineLastPrompt = fullPrompt;
  _imagineLastNeg = "";
  _imagineSetBusy(true, "🎨 Gerando imagem...");
  _imagineShowLoading("Gerando imagem...");

  try {
    const data = await _imagineCallGenerate(fullPrompt, "", prompt);
    if (data.error) { _imagineShowError(data.error); _imagineSetBusy(false); return; }
    if (data.image) {
      _imagineShowResult(data.image, fullPrompt);
      imagineLoadHistory();
    }
  } catch (e) {
    if (e.name === "AbortError") return;
    _imagineShowError("sd-server offline ou erro de conexao.");
  }
  _imagineSetBusy(false);
}

/** Only enhance prompt (preview), don't generate yet */
async function imagineEnhanceOnly() {
  if (_imagineBusy) return;
  const prompt = document.getElementById("imaginePrompt")?.value?.trim();
  if (!prompt) return;

  _imagineSetBusy(true, "🧠 Melhorando prompt...");

  try {
    const enhanced = await _imagineCallEnhance(prompt, _imagineStyle);
    if (enhanced.error) {
      const st = document.getElementById("imagineStatus");
      if (st) { st.textContent = enhanced.message || enhanced.error; st.style.color = "var(--danger)"; }
      _imagineSetBusy(false);
      return;
    }

    const ep = enhanced.enhanced_prompt || prompt;
    const neg = enhanced.negative_prompt || "";
    _imagineLastPrompt = ep;
    _imagineLastNeg = neg;

    const epEl = document.getElementById("imagineEnhancedPrompt");
    const negEl = document.getElementById("imagineNegPrompt");
    const container = document.getElementById("imagineEnhanced");
    if (epEl) epEl.value = ep;
    if (negEl) negEl.value = neg;
    if (container) container.style.display = "flex";

    const st = document.getElementById("imagineStatus");
    if (st) { st.textContent = "Prompt melhorado!"; st.style.color = "var(--green)"; }
  } catch (e) {
    const st = document.getElementById("imagineStatus");
    if (st) { st.textContent = "Erro ao melhorar prompt"; st.style.color = "var(--danger)"; }
  }
  _imagineSetBusy(false);
}

function imagineToggleNeg() {
  const el = document.getElementById("imagineNegPrompt");
  if (el) el.style.display = el.style.display === "none" ? "block" : "none";
}

function imagineSaveImage() {
  if (_imagineLastUrl) window.open(_imagineLastUrl, "_blank");
}

function imagineDownloadImage() {
  if (!_imagineLastUrl) return;
  const a = document.createElement("a");
  a.href = _imagineLastUrl;
  a.download = _imagineLastUrl.split("/").pop() || "image.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  const st = document.getElementById("imagineStatus");
  if (st) { st.textContent = "Imagem salva!"; st.style.color = "var(--green)"; }
}

function imagineCopyPrompt() {
  const ep = document.getElementById("imagineEnhancedPrompt")?.value || _imagineLastPrompt;
  if (ep) {
    navigator.clipboard.writeText(ep).then(() => {
      const st = document.getElementById("imagineStatus");
      if (st) { st.textContent = "Prompt copiado!"; st.style.color = "var(--green)"; }
    });
  }
}

function imagineVariation() {
  // Re-generate with same prompt but random seed
  document.getElementById("imagineSeed").value = "-1";
  const ep = document.getElementById("imagineEnhancedPrompt")?.value || _imagineLastPrompt;
  const neg = document.getElementById("imagineNegPrompt")?.value || _imagineLastNeg;
  if (!ep) return;

  _imagineSetBusy(true, "🎨 Gerando variação...");
  _imagineShowLoading("Gerando variação...");

  _imagineCallGenerate(ep, neg, document.getElementById("imaginePrompt")?.value || "").then(data => {
    if (data.error) { _imagineShowError(data.error); }
    else if (data.image) { _imagineShowResult(data.image, ep); imagineLoadHistory(); }
    _imagineSetBusy(false);
  }).catch(() => {
    _imagineShowError("sd-server offline");
    _imagineSetBusy(false);
  });
}

function imagineRandom() {
  document.getElementById("imagineSeed").value = "-1";
  imagineEnhanceAndGenerate();
}

let _imagineGalleryData = []; // cached gallery data
let _imagineGalleryOpen = false;
let _imagineLightboxIndex = -1;

function imagineLoadHistory() {
  fetch("/api/imagine/history").then(r => r.json()).then(d => {
    _imagineGalleryData = d.images || [];
    _imagineRenderHistoryStrip();
    if (_imagineGalleryOpen) _imagineRenderGalleryGrid();
  }).catch(() => {});
}

function _imagineRenderHistoryStrip() {
  const el = document.getElementById("imagineHistoryStrip");
  if (!el) return;
  if (_imagineGalleryData.length === 0) { el.innerHTML = '<span style="font-size:10px;color:var(--text-faint);align-self:center;">Nenhuma imagem gerada</span>'; return; }
  el.innerHTML = _imagineGalleryData.slice(0, 30).map((img, i) => {
    const title = _imagineGetTitle(img);
    const safeTitle = _escHtml(title);
    return `<img src="${img.url}" alt="${safeTitle}" title="${safeTitle}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer;flex-shrink:0;transition:border-color 0.15s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'" onclick="imagineLightboxOpen(${i})">`;
  }).join("");
}

function _imagineRenderGalleryGrid() {
  const grid = document.getElementById("imagineGalleryGrid");
  const count = document.getElementById("imagineGalleryCount");
  if (!grid) return;
  if (count) count.textContent = `${_imagineGalleryData.length} imagens`;
  if (_imagineGalleryData.length === 0) {
    grid.innerHTML = '<div style="font-size:11px;color:var(--text-faint);padding:12px;text-align:center;">Nenhuma imagem gerada ainda</div>';
    return;
  }
  grid.innerHTML = _imagineGalleryData.map((img, i) => {
    const title = _imagineGetTitle(img);
    const safeTitle = _escHtml(title);
    const sizeInfo = img.size_kb ? `${img.size_kb} KB` : "";
    return `<div class="imagine-gallery-card" onclick="imagineLightboxOpen(${i})" title="${safeTitle}">
      <img src="${img.url}" alt="${safeTitle}" loading="lazy">
      <div class="imagine-card-overlay">${safeTitle}</div>
      <button class="imagine-card-delete" onclick="event.stopPropagation();imagineDeleteImage('${img.filename}')">x</button>
    </div>`;
  }).join("");
}

function _imagineGetTitle(img) {
  return img.meta?.original_prompt || img.meta?.prompt?.substring(0, 60) || img.filename;
}

function _escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function imagineToggleGallery() {
  _imagineGalleryOpen = !_imagineGalleryOpen;
  const gallery = document.getElementById("imagineGallery");
  const strip = document.getElementById("imagineHistoryStrip");
  if (gallery) gallery.style.display = _imagineGalleryOpen ? "flex" : "none";
  if (strip) strip.style.display = _imagineGalleryOpen ? "none" : "flex";
  if (_imagineGalleryOpen) _imagineRenderGalleryGrid();
}

function imagineDeleteImage(filename) {
  if (!confirm("Excluir esta imagem?")) return;
  fetch(`/api/imagine/history/${encodeURIComponent(filename)}`, { method: "DELETE" })
    .then(r => r.json()).then(d => {
      if (d.status === "deleted") {
        imagineLoadHistory();
        const st = document.getElementById("imagineStatus");
        if (st) { st.textContent = "Imagem excluida."; st.style.color = "var(--text-muted)"; }
      }
    }).catch(() => {});
}

// ── Lightbox ──

function imagineLightboxOpen(index) {
  if (index < 0 || index >= _imagineGalleryData.length) return;
  _imagineLightboxIndex = index;
  const img = _imagineGalleryData[index];
  const lb = document.getElementById("imagineLightbox");
  const lbImg = document.getElementById("imagineLightboxImg");
  const lbMeta = document.getElementById("imagineLightboxMeta");
  if (!lb || !lbImg) return;

  lbImg.src = img.url;
  lb.classList.add("active");

  // Build metadata display
  const meta = img.meta || {};
  const parts = [];
  if (meta.original_prompt) parts.push(`<b>Prompt:</b> ${_escHtml(meta.original_prompt)}`);
  if (meta.style) parts.push(`<b>Estilo:</b> ${_escHtml(meta.style)}`);
  if (meta.steps) parts.push(`<b>Steps:</b> ${meta.steps}`);
  if (meta.width && meta.height) parts.push(`<b>Tamanho:</b> ${meta.width}x${meta.height}`);
  if (meta.seed !== undefined && meta.seed !== null) parts.push(`<b>Seed:</b> ${meta.seed}`);
  if (meta.cfg_scale) parts.push(`<b>CFG:</b> ${meta.cfg_scale}`);
  if (img.size_kb) parts.push(`<b>Arquivo:</b> ${img.size_kb} KB`);
  if (lbMeta) lbMeta.innerHTML = parts.join(" &middot; ") || img.filename;

  // Update nav visibility
  document.querySelector(".imagine-lightbox-prev").style.display = index > 0 ? "" : "none";
  document.querySelector(".imagine-lightbox-next").style.display = index < _imagineGalleryData.length - 1 ? "" : "none";
}

function imagineLightboxClose(event) {
  if (event && event.target !== event.currentTarget) return;
  const lb = document.getElementById("imagineLightbox");
  if (lb) lb.classList.remove("active");
  _imagineLightboxIndex = -1;
}

function imagineLightboxNav(dir) {
  const next = _imagineLightboxIndex + dir;
  if (next >= 0 && next < _imagineGalleryData.length) {
    imagineLightboxOpen(next);
  }
}

function imagineLightboxDownload() {
  if (_imagineLightboxIndex < 0) return;
  const img = _imagineGalleryData[_imagineLightboxIndex];
  const a = document.createElement("a");
  a.href = img.url;
  a.download = img.filename || "image.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function imagineLightboxCopyPrompt() {
  if (_imagineLightboxIndex < 0) return;
  const img = _imagineGalleryData[_imagineLightboxIndex];
  const prompt = img.meta?.enhanced_prompt || img.meta?.prompt || img.meta?.original_prompt || "";
  if (prompt) {
    navigator.clipboard.writeText(prompt).then(() => {
      const st = document.getElementById("imagineStatus");
      if (st) { st.textContent = "Prompt copiado!"; st.style.color = "var(--green)"; }
    });
  }
}

function imagineLightboxUsePrompt() {
  if (_imagineLightboxIndex < 0) return;
  const img = _imagineGalleryData[_imagineLightboxIndex];
  const prompt = img.meta?.original_prompt || img.meta?.prompt || "";
  const promptEl = document.getElementById("imaginePrompt");
  if (promptEl && prompt) {
    promptEl.value = prompt;
    imagineLightboxClose();
    const st = document.getElementById("imagineStatus");
    if (st) { st.textContent = "Prompt carregado!"; st.style.color = "var(--accent)"; }
  }
}

function imagineLightboxDelete() {
  if (_imagineLightboxIndex < 0) return;
  const img = _imagineGalleryData[_imagineLightboxIndex];
  if (!confirm("Excluir esta imagem?")) return;
  fetch(`/api/imagine/history/${encodeURIComponent(img.filename)}`, { method: "DELETE" })
    .then(r => r.json()).then(d => {
      if (d.status === "deleted") {
        imagineLightboxClose();
        imagineLoadHistory();
      }
    }).catch(() => {});
}

function imagineShowHistoryItem(url, title) {
  _imagineLastUrl = url;
  const result = document.getElementById("imagineResult");
  if (result) result.innerHTML = `<img src="${url}" alt="${_escHtml(title)}" style="max-width:100%;max-height:100%;object-fit:contain;cursor:pointer;" onclick="window.open('${url}','_blank')">`;
  const actions = document.getElementById("imagineActions");
  if (actions) actions.style.display = "flex";
}

window.imagineInit = imagineInit;
window.imagineEnhanceAndGenerate = imagineEnhanceAndGenerate;
window.imagineGenerateDirect = imagineGenerateDirect;
window.imagineEnhanceOnly = imagineEnhanceOnly;
window.imagineSetStyle = imagineSetStyle;
window.imagineToggleNeg = imagineToggleNeg;
window.imagineSaveImage = imagineSaveImage;
window.imagineDownloadImage = imagineDownloadImage;
window.imagineCopyPrompt = imagineCopyPrompt;
window.imagineVariation = imagineVariation;
window.imagineRandom = imagineRandom;
window.imagineShowHistoryItem = imagineShowHistoryItem;
window.imagineToggleGallery = imagineToggleGallery;
window.imagineDeleteImage = imagineDeleteImage;
window.imagineLightboxOpen = imagineLightboxOpen;
window.imagineLightboxClose = imagineLightboxClose;
window.imagineLightboxNav = imagineLightboxNav;
window.imagineLightboxDownload = imagineLightboxDownload;
window.imagineLightboxCopyPrompt = imagineLightboxCopyPrompt;
window.imagineLightboxUsePrompt = imagineLightboxUsePrompt;
window.imagineLightboxDelete = imagineLightboxDelete;

// ── Imagine keyboard shortcuts ──
document.addEventListener("keydown", (e) => {
  // Lightbox navigation
  const lb = document.getElementById("imagineLightbox");
  if (lb && lb.classList.contains("active")) {
    if (e.key === "Escape") { imagineLightboxClose(); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { imagineLightboxNav(-1); e.preventDefault(); }
    else if (e.key === "ArrowRight") { imagineLightboxNav(1); e.preventDefault(); }
    return;
  }
  // Enter to generate (only when imagine prompt is focused)
  const promptEl = document.getElementById("imaginePrompt");
  if (e.key === "Enter" && !e.shiftKey && document.activeElement === promptEl) {
    e.preventDefault();
    imagineEnhanceAndGenerate();
  }
});

// ─── Expose mutable state to window for main.js close callbacks ─────────────
// These use defineProperty so main.js always reads the current value.
Object.defineProperty(window, '_notepadDirty', { get() { return _notepadDirty; }, configurable: true });
Object.defineProperty(window, '_notepadActiveId', { get() { return _notepadActiveId; }, configurable: true });
Object.defineProperty(window, '_wordDirty', { get() { return _wordDirty; }, configurable: true });
Object.defineProperty(window, '_wordActiveId', { get() { return _wordActiveId; }, configurable: true });
// ═══ Survival Reference Database ═════════════════════════════════════════════
const SURV_REF = [
  { cat: '💧 Agua', items: [
    { title: 'Fervura', text: 'Ferver em ebulicao por 1 minuto (3 min acima de 1500m). Metodo mais confiavel. Deixar esfriar naturalmente.' },
    { title: 'Cloro — agua sanitaria 2.5%', text: '2 gotas por litro. Mexer e esperar 30 min. Deve ter leve odor de cloro. Se nao, repetir e esperar +15 min.' },
    { title: 'Cloro — agua sanitaria 6%', text: '1L: 2 gotas. 4L: 8 gotas. 8L: 16 gotas (1/4 colher cha). Esperar 30 min.' },
    { title: 'Iodo (tintura 2%)', text: 'Agua clara: 5 gotas/litro. Agua turva: 10 gotas/litro. Esperar 30 min.' },
    { title: 'Pre-filtrar', text: 'SEMPRE filtrar agua turva por pano limpo, filtro de cafe ou papel ANTES do tratamento quimico.' },
    { title: 'SODIS (solar)', text: 'Garrafa PET transparente ao sol direto por 6h (2 dias se nublado). UV mata patogenos.' },
    { title: 'Filtro improvisado', text: 'Camadas de baixo p/ cima: cascalho grosso → cascalho fino → areia → carvao ativado → pano. Sempre ferver depois.' },
    { title: 'Sinais de agua', text: 'Vegetacao verde, insetos em enxame, trilhas de animais convergindo, vales e depressoes.' },
    { title: 'Condensacao', text: 'Saco plastico sobre galho com folhas verdes. Em poucas horas coleta agua por evapotranspiracao.' },
    { title: 'Armazenamento', text: '4 litros por pessoa por dia (beber + higiene minima). Recipientes de grau alimentar em local fresco e escuro.' },
  ]},
  { cat: '🏥 Primeiros Socorros', items: [
    { title: 'Hemorragia grave', text: 'Pressao direta com pano limpo. NAO remover — adicionar mais por cima. Elevar acima do coracao. Torniquete 5-8cm acima da ferida SOMENTE se pressao falhar. Anotar horario. NAO remover torniquete depois de colocado.' },
    { title: 'RCP Adulto', text: '30 compressoes (5-6cm profundidade, 100-120/min) + 2 ventilacoes. Maos no centro do peito (esterno), bracos retos. Permitir retorno total do torax entre compressoes. NAO parar.' },
    { title: 'RCP Crianca (1-8 anos)', text: 'Mesma proporcao 30:2. Profundidade: ~5cm. Usar 1 ou 2 maos conforme tamanho da crianca.' },
    { title: 'RCP Bebe (<1 ano)', text: '30:2 com 2 dedos para compressoes. Profundidade: ~4cm. Cobrir boca E nariz do bebe com sua boca para ventilacoes.' },
    { title: 'Fratura', text: 'Imobilizar articulacao ACIMA e ABAIXO da fratura. Tala: material rigido (galhos, tabuas) com enchimento de pano. Checar circulacao abaixo (pulso, cor, sensacao). Fratura exposta: cobrir com pano esteril, NAO empurrar osso.' },
    { title: 'Queimadura', text: '1o grau (vermelha): agua corrente fria 10-20 min. 2o grau (bolhas): idem, NAO estourar bolhas, curativo solto. 3o grau (carbonizada/branca): NAO aplicar agua/creme. Cobrir com pano esteril seco. Evacuar. NUNCA usar gelo, manteiga ou pasta de dente.' },
    { title: 'Engasgo (Heimlich)', text: 'Atras da pessoa, punho fechado acima do umbigo, outra mao por cima. Puxar para dentro e para cima com forca. Se sozinho: empurrar contra borda de cadeira/mesa.' },
    { title: 'Hipotermia', text: 'Remover roupas molhadas. Aquecer gradualmente: cobertores, contato corpo-a-corpo. Liquidos MORNOS (NAO quentes). NAO esfregar extremidades. Sinais de choque: pele palida, pulso rapido, confusao — manter aquecido, pernas elevadas.' },
    { title: 'Soro caseiro', text: '1 litro de agua limpa + 6 colheres (cha) de acucar + 1 colher (cha) de sal. Beber aos poucos ao longo do dia.' },
  ]},
  { cat: '🔥 Fogo', items: [
    { title: 'Ferro cerium (fire steel)', text: 'Raspar com faca produz faiscas a 3000°C. Funciona molhado. Melhor ferramenta de sobrevivencia.' },
    { title: 'Arco e broca', text: 'Madeira seca e leve (cedro, salgueiro). Broca gira em cavidade na base. Brasa cai na tinder. Soprar gentilmente. Dificil — requer pratica.' },
    { title: 'Lente solar', text: 'Lupa, fundo de garrafa com agua, oculos, lente de gelo. Concentrar ponto de luz em tinder escuro. Funciona ao meio-dia.' },
    { title: 'Bateria + palha de aco', text: 'Tocar polos da bateria (9V ideal) em la de aco fina. Inflama instantaneamente.' },
    { title: 'Tinder (melhor → pior)', text: 'Lint de secadora, casca de betula, algodao + vaselina, raspas finas de madeira, fibra de coco, fungo seco, capim seco triturado.' },
    { title: 'Tepee (rapido)', text: 'Tinder no centro, cone de gravetos finos ao redor, lenha inclinada. Bom para calor rapido.' },
    { title: 'Log Cabin (longo)', text: 'Pilha quadrada ao redor do nucleo de tinder. Queima longa, bom para cozinhar.' },
    { title: 'Estrela (eficiente)', text: '4-5 toras irradiando do centro. Empurrar para dentro conforme queimam. Economiza lenha.' },
    { title: 'Buraco Dakota (discreto)', text: 'Cavar buraco de 30cm para fogo + tunel para ar. Pouca fumaca, protegido do vento. Ideal se discrição importa.' },
  ]},
  { cat: '🏕️ Abrigo', items: [
    { title: 'Regra dos 3', text: '3 min sem ar, 3 horas sem abrigo (clima extremo), 3 dias sem agua, 3 semanas sem comida.' },
    { title: 'Lean-to (30-60 min)', text: 'Viga de 2.5-3m apoiada em arvore a 45°. Galhos na lateral. Cobrir com folhas/musgos. Entrada oposta ao vento. Parede refletora de fogo: empilhar toras verdes do lado oposto.' },
    { title: 'Debris hut (1-2h)', text: '1 pessoa. Viga central 1.5x altura do corpo. Galhos em A dos lados. Cobrir com 30cm+ de folhas secas. Menor = mais quente.' },
    { title: 'A-frame (30-60 min)', text: '2 postes de suporte em A + viga central + lona ou galhos/folhas. Bom contra chuva.' },
    { title: 'Caverna de neve (2-3h)', text: 'Banco de neve compactado (min 1.2m). Cavar camara, furo de ar no topo. Interior fica ~0°C mesmo com -30°C fora.' },
    { title: 'Local ideal', text: 'Terreno elevado (evitar inundacao). Protecao contra vento. Perto de agua mas nao na margem. Longe de arvores mortas.' },
    { title: 'Isolamento do solo', text: 'NUNCA dormir direto no chao. Usar galhos, folhas, mochilas — minimo 10cm. Solo rouba calor 25x mais rapido que ar.' },
  ]},
  { cat: '🧭 Navegacao', items: [
    { title: 'Estrela Polar (Norte)', text: 'Encontre a Ursa Maior (concha). Prolongue 5x a distancia entre as 2 estrelas da borda (Dubhe e Merak). Polaris fica a ~1° do norte verdadeiro.' },
    { title: 'Cruzeiro do Sul', text: 'Prolongue o eixo maior do Cruzeiro 4.5x. Desse ponto, desca perpendicular ao horizonte = Sul.' },
    { title: 'Sombra e pau', text: 'Pau vertical no chao. Marcar ponta da sombra. Esperar 15-30 min. Marcar novamente. Linha entre marcas = Leste-Oeste (primeira marca = Oeste).' },
    { title: 'Metodo do relogio', text: 'Ponteiro das horas p/ sol. Bissetriz entre ponteiro e 12h aponta ~Sul (hem. norte) ou ~Norte (hem. sul).' },
    { title: 'Sol', text: 'Nasce ~Leste, se poe ~Oeste (exato nos equinocios). Ao meio-dia solar, sombras apontam Norte (hem. sul) ou Sul (hem. norte).' },
    { title: 'Lua crescente', text: 'Linha imaginaria entre as pontas da lua ate o horizonte aponta ~Sul (hem. norte) ou ~Norte (hem. sul).' },
    { title: 'Musgo (baixa confianca)', text: 'Musgo cresce no lado MAIS UMIDO. Usar APENAS como confirmacao junto com outros metodos.' },
  ]},
  { cat: '🪢 Nos Essenciais', items: [
    { title: 'Lais de guia (bowline)', text: 'Laco fixo que NAO aperta sob carga. Ideal para resgate e ancoragem. Facil de desfazer apos carga. "Coelho sai da toca, da volta na arvore, volta pra toca."' },
    { title: 'No de escota (sheet bend)', text: 'Unir duas cordas de espessuras diferentes. Mais confiavel que no direito para cordas desiguais.' },
    { title: 'Volta do fiel (clove hitch)', text: 'Fixacao rapida em poste/galho. Duas voltas sobrepostas. Usar com meia-volta extra para seguranca.' },
    { title: 'Taut-line hitch', text: 'Tensao ajustavel em estais de barraca. Desliza para ajustar mas trava sob carga.' },
    { title: 'Oito (figure-8)', text: 'No de seguranca para escalada. Nao aperta, facil de inspecionar. Usado como base para laco de oito.' },
    { title: 'No de prusik', text: 'Corda fina em corda grossa. Trava sob peso, desliza quando solto. Essencial para subir cordas.' },
    { title: 'No de caminhoneiro', text: 'Vantagem mecanica 3:1 para apertar cargas. Tensiona cordas com forca tripla.' },
  ]},
  { cat: '🌿 Plantas (Brasil)', items: [
    { title: '✅ Palmito (Jucara/Acai)', text: 'Nucleo do caule de palmeiras. Comer cru ou cozido. Rico em fibras e nutrientes.' },
    { title: '✅ Ora-pro-nobis', text: 'Folhas comestiveis cruas ou cozidas. 25% proteina (peso seco). Muito comum em cercos/muros.' },
    { title: '✅ Taioba', text: 'Folhas COZIDAS (nunca cruas — oxalato). Parece inhame. Abundante em areas umidas.' },
    { title: '✅ Banana (silvestre)', text: 'Fruto e coracao (flor). Folhas para cozinhar/embalar. Toda parte usavel.' },
    { title: '✅ Dente-de-leao', text: 'Folhas, flores e raizes comestiveis. Rico em vitaminas A, C, K. Cha da raiz e diuretico.' },
    { title: '✅ Taboa (cattail)', text: 'Perto de agua, espiga marrom. Brotos, raizes, polen — tudo comestivel. Disponivel o ano todo.' },
    { title: '⚠️ Mandioca BRAVA', text: 'TOXICA crua (cianeto). Exige processamento: ralar, prensar, torrar. Confundida com mansa — na duvida, processar.' },
    { title: '❌ Comigo-ninguem-pode', text: 'TOXICA. Causa queimacao severa na boca/garganta. Cristais de oxalato. NAO tocar nos olhos.' },
    { title: '❌ Mamona', text: 'Sementes contem ricina (letal). Folhas grandes palmadas. Evitar completamente.' },
    { title: '❌ Cicuta (hemlock)', text: 'Confundida com cenoura/salsinha. Caule liso com manchas roxas, cheiro ruim. Planta mais toxica das Americas.' },
    { title: 'Teste universal', text: 'Na duvida: NAO coma. Teste: contato na pele 8h → labio 15min → lingua 15min → mastigar/cuspir 15min → comer pouco e esperar 8h. Qualquer reacao = descartar.' },
  ]},
  { cat: '📡 Sinais de Socorro', items: [
    { title: 'Regra do 3', text: '3 de qualquer coisa (fogueiras, apitos, tiros, flashes) e universalmente reconhecido como socorro.' },
    { title: 'SOS (Morse)', text: '··· −−− ··· (3 curtos, 3 longos, 3 curtos). Universal. Usar com luz, som, espelho ou apito.' },
    { title: 'Apito', text: '3 apitos = socorro universal. Repetir a cada minuto. Som viaja mais longe que a voz.' },
    { title: 'Espelho de sinalizacao', text: 'Qualquer superficie reflexiva. Mirar entre os dedos em V apontando para aeronave. Visivel a 15+ km. Melhor sinal diurno.' },
    { title: 'Fogueira de sinal', text: '3 fogueiras em triangulo (socorro). Dia: adicionar folhas verdes para fumaca branca. Noite: madeira seca para chama alta.' },
    { title: 'MAYDAY', text: '"MAYDAY MAYDAY MAYDAY, aqui [nome], minha posicao e [coords/descricao], [situacao], [numero de pessoas]"' },
    { title: 'Marcas no chao', text: 'V = preciso ajuda. X = preciso medico. I = preciso suprimentos. → = sigo nesta direcao. Tamanho minimo: 3 metros. Alto contraste com o chao.' },
    { title: 'Roupa colorida', text: 'Espalhar roupas brilhantes (laranja e a melhor) em area aberta para visibilidade aerea.' },
    { title: 'Celular', text: 'Mesmo sem sinal, tentar 190/192/193 (Brasil) ou 112 (universal). SMS usa menos sinal que voz. Desligar quando nao usar para poupar bateria.' },
  ]},
  { cat: '☢️ Ameacas Nucleares/Quimicas', items: [
    { title: 'Abrigo (nuclear)', text: 'Entrar em edificio solido IMEDIATAMENTE. Paredes grossas de concreto/tijolo. Ir para o centro, longe de janelas. Ficar no minimo 24h.' },
    { title: 'Descontaminacao', text: 'Remover roupas externas (elimina ~90% contaminacao). Lavar corpo com sabao e agua morna. NAO esfregar. NAO usar condicionador (prende particulas).' },
    { title: 'Iodo (protecao tireoide)', text: 'Iodeto de potassio (KI) protege tireoide de iodo radioativo. Adulto: 130mg. Crianca 3-18: 65mg. SO tomar se autoridades recomendarem.' },
    { title: 'Ataque quimico', text: 'Subir (agentes quimicos sao mais pesados que ar). Cobrir boca/nariz com pano umido. Sair da area contra o vento.' },
    { title: 'Agua e comida', text: 'Apenas alimentos em embalagem FECHADA sao seguros. Agua encanada geralmente OK (sistema fechado). Nao consumir nada exposto ao ar livre.' },
  ]},
];

function survRefInit() {
  const container = document.getElementById('survRefContent');
  if (!container) return;
  let html = '';
  SURV_REF.forEach(section => {
    html += `<div class="surv-section">
      <h3 class="surv-cat-title">${section.cat}</h3>
      <div class="surv-cards">`;
    section.items.forEach(item => {
      html += `<div class="surv-card">
        <div class="surv-card-title">${item.title}</div>
        <div class="surv-card-text">${item.text}</div>
      </div>`;
    });
    html += '</div></div>';
  });
  container.innerHTML = html;
}
window.survRefInit = survRefInit;

function survRefFilter(query) {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('#survRefContent .surv-section').forEach(sec => {
    const cards = sec.querySelectorAll('.surv-card');
    let anyVisible = false;
    cards.forEach(card => {
      const match = !q || card.textContent.toLowerCase().includes(q);
      card.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });
    sec.style.display = (!q || anyVisible) ? '' : 'none';
  });
}
window.survRefFilter = survRefFilter;

// ═══ SOS Emergency Fullscreen Mode ═══════════════════════════════════════════
let _cprMetronomeInterval = null;
let _cprAudioCtx = null;

function openSosEmergency() {
  const overlay = document.getElementById('sosEmergencyOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}
window.openSosEmergency = openSosEmergency;

function closeSosEmergency() {
  const overlay = document.getElementById('sosEmergencyOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }
  // Stop metronome if running
  stopCprMetronome();
}
window.closeSosEmergency = closeSosEmergency;

// ESC key closes the overlay
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('sosEmergencyOverlay');
    if (overlay && !overlay.classList.contains('hidden')) {
      closeSosEmergency();
    }
  }
});

// CPR Metronome: 110 bpm audible beat using Web Audio API (offline-safe)
function toggleCprMetronome(btn) {
  if (_cprMetronomeInterval) {
    stopCprMetronome();
    if (btn) btn.classList.remove('active');
    return;
  }
  if (btn) btn.classList.add('active');
  // 110 bpm = 545ms interval
  const bpm = 110;
  const interval = 60000 / bpm;
  // Create audio context for click sounds
  try {
    _cprAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e) { /* no audio support, visual only */ }

  function playBeat() {
    if (!_cprAudioCtx) return;
    try {
      const osc = _cprAudioCtx.createOscillator();
      const gain = _cprAudioCtx.createGain();
      osc.connect(gain);
      gain.connect(_cprAudioCtx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.5, _cprAudioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, _cprAudioCtx.currentTime + 0.1);
      osc.start(_cprAudioCtx.currentTime);
      osc.stop(_cprAudioCtx.currentTime + 0.1);
    } catch(e) {}
  }
  playBeat(); // immediate first beat
  _cprMetronomeInterval = setInterval(playBeat, interval);
}
window.toggleCprMetronome = toggleCprMetronome;

function stopCprMetronome() {
  if (_cprMetronomeInterval) {
    clearInterval(_cprMetronomeInterval);
    _cprMetronomeInterval = null;
  }
  if (_cprAudioCtx) {
    try { _cprAudioCtx.close(); } catch(e) {}
    _cprAudioCtx = null;
  }
  // Reset any active button state
  document.querySelectorAll('.sos-metronome-btn.active').forEach(b => b.classList.remove('active'));
}

// ═══ Radio Frequency Filter & Region Switching ═══════════════════════════
let _radioActiveRegion = 'all';

function radioFilter(query) {
  const container = document.getElementById('radioScrollArea');
  if (!container) return;
  const q = query.toLowerCase().trim();
  const sections = container.querySelectorAll('.radio-section');
  sections.forEach(h3 => {
    const region = h3.dataset.region || 'all';
    const regionMatch = _radioActiveRegion === 'all' || region === 'all' || region === _radioActiveRegion;

    // Find the next sibling (table, ul, or div)
    let sibling = h3.nextElementSibling;
    if (!sibling || sibling.classList.contains('radio-section')) {
      h3.style.display = regionMatch ? '' : 'none';
      return;
    }
    let sectionVisible = false;
    if (sibling.tagName === 'TABLE') {
      const rows = sibling.querySelectorAll('tr');
      rows.forEach((row, i) => {
        if (i === 0) return;
        const text = row.textContent.toLowerCase();
        const match = (!q || text.includes(q)) && regionMatch;
        row.style.display = match ? '' : 'none';
        if (match) sectionVisible = true;
      });
      if (!q && regionMatch) sectionVisible = true;
    } else if (sibling.tagName === 'UL') {
      const items = sibling.querySelectorAll('li');
      items.forEach(li => {
        const match = (!q || li.textContent.toLowerCase().includes(q)) && regionMatch;
        li.style.display = match ? '' : 'none';
        if (match) sectionVisible = true;
      });
      if (!q && regionMatch) sectionVisible = true;
    } else if (sibling.tagName === 'DIV') {
      // Protocol cards / procedure boxes
      const sibRegion = sibling.dataset.region || 'all';
      const sibRegionMatch = _radioActiveRegion === 'all' || sibRegion === 'all' || sibRegion === _radioActiveRegion;
      if (q) {
        sectionVisible = sibRegionMatch && sibling.textContent.toLowerCase().includes(q);
      } else {
        sectionVisible = sibRegionMatch;
      }
    }
    if (!q && regionMatch) sectionVisible = true;
    h3.style.display = sectionVisible ? '' : 'none';
    if (sibling) sibling.style.display = sectionVisible ? '' : 'none';
  });
}
window.radioFilter = radioFilter;

function radioSwitchRegion(region, btn) {
  _radioActiveRegion = region;
  document.querySelectorAll('#radioRegionTabs .radio-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  radioFilter(document.getElementById('radioSearch')?.value || '');
}
window.radioSwitchRegion = radioSwitchRegion;
window.radioInit = function() { /* view is static HTML, no async init needed */ };

Object.defineProperty(window, '_excelDirty', { get() { return _excelDirty; }, configurable: true });
Object.defineProperty(window, '_excelActiveId', { get() { return _excelActiveId; }, configurable: true });
Object.defineProperty(window, '_checklistDirty', { get() { return _checklistDirty; }, configurable: true });
Object.defineProperty(window, '_checklistActiveId', { get() { return _checklistActiveId; }, configurable: true });
Object.defineProperty(window, '_clockInterval', { get() { return _clockInterval; }, set(v) { _clockInterval = v; }, configurable: true });
Object.defineProperty(window, '_sysmonInterval', { get() { return _sysmonInterval; }, set(v) { _sysmonInterval = v; }, configurable: true });
Object.defineProperty(window, '_timerInterval', { get() { return _timerInterval; }, set(v) { _timerInterval = v; }, configurable: true });

// ─── Model Manager ──────────────────────────────────────────────────────────

let _modelMgrPollId = null;

function modelMgrInit() {
  modelMgrRefresh();
}

async function modelMgrRefresh() {
  const list = document.getElementById('modelMgrList');
  const dirEl = document.getElementById('modelMgrDir');
  if (!list) return;

  list.innerHTML = '<div class="panel-empty" style="padding:20px;text-align:center;font-family:var(--font-mono);font-size:11px">Carregando modelos...</div>';

  try {
    const r = await fetch('/api/models/local');
    const data = await r.json();
    const models = data.models || [];

    if (dirEl) dirEl.textContent = `Pasta: ${data.models_dir}`;

    if (!models.length) {
      list.innerHTML = '<div class="panel-empty">Nenhum modelo encontrado. Use os botoes para baixar.</div>';
      return;
    }

    list.innerHTML = models.map(m => {
      const isDownloaded = m.downloaded;
      const isDownloading = m.downloading;
      const isPartial = m.partial;
      const sizeStr = m.size_gb < 1 ? `${Math.round(m.size_gb * 1024)} MB` : `${m.size_gb} GB`;
      const typeColor = m.type === 'cpu' ? 'var(--green)' : m.type === 'gpu' ? 'var(--accent)' : 'var(--text-muted)';
      const typeLabel = m.type === 'cpu' ? 'CPU' : m.type === 'gpu' ? 'GPU' : m.type.toUpperCase();
      const tags = (m.tags || []).map(t => {
        if (t === 'vision') return '<span style="background:rgba(168,85,247,0.12);color:#a855f7;padding:1px 6px;border-radius:3px;font-size:9px">VISION</span>';
        if (t === 'principal') return '<span style="background:var(--accent-dim);color:var(--accent);padding:1px 6px;border-radius:3px;font-size:9px">PRINCIPAL</span>';
        return '';
      }).filter(Boolean).join(' ');

      let statusHtml = '';
      let actionHtml = '';

      if (isDownloaded) {
        statusHtml = '<span style="color:var(--green);font-family:var(--font-hud);font-size:10px;letter-spacing:0.05em">✅ INSTALADO</span>';
        actionHtml = `<button class="btn-action" style="font-size:10px;padding:3px 8px;background:var(--danger-dim);border-color:rgba(255,26,71,0.2);color:var(--danger)" onclick="modelMgrDelete('${escapeHtml(m.id)}')">Remover</button>`;
      } else if (isDownloading) {
        statusHtml = `<span style="color:var(--amber);font-family:var(--font-hud);font-size:10px" id="modelStatus_${m.id}">⏳ BAIXANDO...</span>`;
        actionHtml = `<div class="model-progress-bar" id="modelProgress_${m.id}"><div class="model-progress-fill" style="width:0%"></div></div>`;
        if (!_modelMgrPollId) _modelMgrPollId = setInterval(() => modelMgrPollProgress(), 1500);
      } else if (isPartial) {
        statusHtml = '<span style="color:var(--amber);font-size:10px">⚠ INCOMPLETO</span>';
        actionHtml = `<button class="btn-action" style="font-size:10px;padding:3px 8px" onclick="modelMgrDownload('${escapeHtml(m.id)}')">Retomar</button>`;
      } else {
        statusHtml = `<span style="color:var(--text-muted);font-size:10px">Nao instalado</span>`;
        actionHtml = `<button class="btn-action" style="font-size:10px;padding:3px 8px" onclick="modelMgrDownload('${escapeHtml(m.id)}')">⬇ Baixar (${sizeStr})</button>`;
      }

      return `<div class="model-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:18px">${m.type === 'cpu' ? '💻' : m.tags?.includes('vision') ? '👁️' : '🎮'}</span>
            <div>
              <div style="font-weight:600;color:var(--text-bright);font-size:13px">${escapeHtml(m.name)}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
                <span style="color:${typeColor};font-family:var(--font-hud);font-size:9px;letter-spacing:0.08em;border:1px solid ${typeColor};padding:0 5px;border-radius:3px">${typeLabel}</span>
                <span style="color:var(--text-muted);font-size:10px">${sizeStr}</span>
                ${m.uncensored ? '<span style="background:rgba(255,140,0,0.1);color:var(--amber);padding:1px 6px;border-radius:3px;font-size:9px">UNCENSORED</span>' : ''}
                ${tags}
              </div>
            </div>
          </div>
          ${statusHtml}
        </div>
        <div style="font-size:11px;color:var(--text-muted);line-height:1.4">${escapeHtml(m.desc)}</div>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">${actionHtml}</div>
      </div>`;
    }).join('');

  } catch (e) {
    list.innerHTML = `<div class="panel-empty" style="color:var(--danger)">Erro ao carregar modelos: ${escapeHtml(e.message)}</div>`;
  }
}

async function modelMgrDownload(modelId) {
  try {
    const r = await fetch('/api/models/local/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId }),
    });
    const data = await r.json();
    if (data.status === 'started' || data.status === 'already_downloading') {
      osToast('⬇ Download iniciado: ' + modelId);
      if (!_modelMgrPollId) _modelMgrPollId = setInterval(() => modelMgrPollProgress(), 1500);
      setTimeout(modelMgrRefresh, 500);
    } else if (data.status === 'already_downloaded') {
      osToast('✅ Modelo ja instalado');
    }
  } catch (e) {
    osToast('❌ Erro: ' + e.message, 3000, 'error');
  }
}

async function modelMgrPollProgress() {
  // Find all downloading models
  const statusEls = document.querySelectorAll('[id^="modelStatus_"]');
  if (!statusEls.length) {
    clearInterval(_modelMgrPollId);
    _modelMgrPollId = null;
    return;
  }

  for (const el of statusEls) {
    const modelId = el.id.replace('modelStatus_', '');
    try {
      const r = await fetch(`/api/models/local/progress/${modelId}`);
      const data = await r.json();
      if (data.status === 'downloading') {
        el.textContent = `⏳ ${data.percent || 0}% ${data.speed || ''}`;
        const bar = document.getElementById(`modelProgress_${modelId}`);
        if (bar) {
          const fill = bar.querySelector('.model-progress-fill');
          if (fill) fill.style.width = `${data.percent || 0}%`;
        }
      } else if (data.status === 'complete') {
        el.textContent = '✅ INSTALADO';
        el.style.color = 'var(--green)';
        clearInterval(_modelMgrPollId);
        _modelMgrPollId = null;
        osToast('✅ Modelo baixado com sucesso!');
        setTimeout(modelMgrRefresh, 1000);
      }
    } catch {}
  }
}

async function modelMgrDelete(modelId) {
  if (!confirm('Remover este modelo? Voce pode baixar novamente depois.')) return;
  try {
    await fetch(`/api/models/local/${modelId}`, { method: 'DELETE' });
    osToast('🗑️ Modelo removido');
    modelMgrRefresh();
  } catch (e) {
    osToast('❌ Erro: ' + e.message, 3000, 'error');
  }
}

window.modelMgrInit = modelMgrInit;
window.modelMgrRefresh = modelMgrRefresh;
window.modelMgrDownload = modelMgrDownload;
window.modelMgrDelete = modelMgrDelete;

// ── Tray system exports ──
window.trayInit = trayInit;
window.trayRefresh = trayRefresh;
window.toggleTrayPopup = toggleTrayPopup;
window.closeTrayPopup = closeTrayPopup;


// ═══ Preparar Pendrive App ═══════════════════════════════════════════════════

let _pendriveSelectedDrive = null;
let _pendriveEstimate = null;
let _pendriveProgressTimer = null;

async function pendriveInit() {
  pendriveRefreshDrives();
}

async function pendriveRefreshDrives() {
  const list = document.getElementById('pendriveDriveList');
  if (!list) return;
  list.innerHTML = '<div class="pendrive-loading"><span class="pendrive-spinner"></span> Detectando drives...</div>';
  try {
    const r = await fetch('/api/pendrive/drives');
    const data = await r.json();
    if (!data.drives || data.drives.length === 0) {
      list.innerHTML = '<div class="pendrive-empty">Nenhum drive detectado. Use o campo abaixo para digitar um caminho.</div>';
      return;
    }
    let html = '';
    for (const d of data.drives) {
      const pct = d.total > 0 ? Math.round((1 - d.free / d.total) * 100) : 0;
      const isRemovable = d.type === 'removable';
      const safePath = d.path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      html += '<div class="pendrive-drive ' + (isRemovable ? 'pendrive-drive-removable' : '') + '" onclick="pendriveSelectDrive(\'' + safePath + '\', ' + d.free + ')">'
        + '<div class="pendrive-drive-icon">' + (isRemovable ? '\u{1F4BE}' : '\u{1F4BD}') + '</div>'
        + '<div class="pendrive-drive-info">'
        + '<div class="pendrive-drive-name">' + (d.letter ? d.letter + ':' : '') + ' ' + escapeHtml(d.label || 'Sem nome') + '</div>'
        + '<div class="pendrive-drive-meta">' + (d.type === 'removable' ? 'Removivel' : 'Fixo') + ' &middot; ' + d.free_fmt + ' livre de ' + d.total_fmt + '</div>'
        + '<div class="pendrive-drive-bar"><div class="pendrive-drive-bar-fill" style="width:' + pct + '%"></div></div>'
        + '</div></div>';
    }
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = '<div class="pendrive-empty">Erro ao detectar drives: ' + escapeHtml(e.message) + '</div>';
  }
}

function pendriveSelectDrive(path, freeSpace) {
  _pendriveSelectedDrive = { path, free: freeSpace };
  pendriveShowStep2();
}

function pendriveSelectCustomPath() {
  const input = document.getElementById('pendriveCustomPath');
  if (!input || !input.value.trim()) return;
  _pendriveSelectedDrive = { path: input.value.trim(), free: 0 };
  pendriveShowStep2();
}

async function pendriveShowStep2() {
  document.getElementById('pendriveStep1').style.display = 'none';
  document.getElementById('pendriveStep2').style.display = '';
  try {
    const r = await fetch('/api/pendrive/estimate?include_models=true&include_data=true&include_tts=true&include_zim=true&include_sd=true&include_books=true');
    _pendriveEstimate = await r.json();
    renderPendriveOptions();
  } catch (e) {
    document.getElementById('pendriveOptions').innerHTML = '<div class="pendrive-empty">Erro: ' + escapeHtml(e.message) + '</div>';
  }
}

function renderPendriveOptions() {
  const container = document.getElementById('pendriveOptions');
  if (!_pendriveEstimate || !container) return;
  let html = '';
  for (const item of _pendriveEstimate.items) {
    const checked = item.required || ['core', 'tools', 'data', 'models', 'books'].includes(item.id);
    html += '<label class="pendrive-option ' + (item.required ? 'pendrive-option-required' : '') + '">'
      + '<input type="checkbox" data-item-id="' + item.id + '" data-item-size="' + item.size + '" '
      + (checked ? 'checked ' : '') + (item.required ? 'disabled ' : '') + ' onchange="pendriveUpdateSize()">'
      + '<div class="pendrive-option-info">'
      + '<span class="pendrive-option-name">' + escapeHtml(item.name) + '</span>'
      + '<span class="pendrive-option-size">' + item.size_fmt + '</span>'
      + '</div>'
      + (item.required ? '<span class="pendrive-badge">Obrigatorio</span>' : '')
      + '</label>';
  }
  container.innerHTML = html;
  pendriveUpdateSize();
}

function pendriveUpdateSize() {
  const checks = document.querySelectorAll('#pendriveOptions input[type=checkbox]');
  let total = 0;
  checks.forEach(function(cb) {
    if (cb.checked) total += parseInt(cb.dataset.itemSize || '0');
  });
  document.getElementById('pendriveTotalSize').textContent = _formatSizeJS(total);
  const freeEl = document.getElementById('pendriveFreeSpace');
  const fillEl = document.getElementById('pendriveCapacityFill');
  const startBtn = document.getElementById('pendriveStartBtn');
  if (_pendriveSelectedDrive && _pendriveSelectedDrive.free > 0) {
    freeEl.textContent = _formatSizeJS(_pendriveSelectedDrive.free);
    const pct = Math.min(100, Math.round(total / _pendriveSelectedDrive.free * 100));
    fillEl.style.width = pct + '%';
    fillEl.className = 'pendrive-capacity-fill' + (pct > 90 ? ' pendrive-capacity-danger' : pct > 70 ? ' pendrive-capacity-warn' : '');
    if (total > _pendriveSelectedDrive.free) {
      startBtn.disabled = true;
      startBtn.title = 'Espaco insuficiente';
    } else {
      startBtn.disabled = false;
      startBtn.title = '';
    }
  } else {
    freeEl.textContent = 'Desconhecido';
    fillEl.style.width = '0%';
    startBtn.disabled = false;
  }
}

function _formatSizeJS(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function pendriveGoBack() {
  document.getElementById('pendriveStep2').style.display = 'none';
  document.getElementById('pendriveStep1').style.display = '';
}

async function pendriveStartCopy() {
  if (!_pendriveSelectedDrive) return;
  const checks = document.querySelectorAll('#pendriveOptions input[type=checkbox]');
  const options = { dest_path: _pendriveSelectedDrive.path };
  checks.forEach(function(cb) {
    const id = cb.dataset.itemId;
    if (id === 'models') options.include_models = cb.checked;
    else if (id === 'data') options.include_data = cb.checked;
    else if (id === 'tts') options.include_tts = cb.checked;
    else if (id === 'zim') options.include_zim = cb.checked;
    else if (id === 'sd') options.include_sd = cb.checked;
    else if (id === 'books') options.include_books = cb.checked;
  });

  document.getElementById('pendriveStep2').style.display = 'none';
  document.getElementById('pendriveStep3').style.display = '';
  document.getElementById('pendriveLog').innerHTML = '';
  document.getElementById('pendriveProgressFill').style.width = '0%';
  document.getElementById('pendriveProgressPct').textContent = '0%';
  document.getElementById('pendriveProgressStep').textContent = 'Iniciando...';

  try {
    const r = await fetch('/api/pendrive/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error || 'Erro desconhecido');
    }
    _pendriveProgressTimer = setInterval(pendrivePollProgress, 500);
  } catch (e) {
    document.getElementById('pendriveProgressStep').textContent = 'Erro: ' + e.message;
    osToast('Erro: ' + e.message, 4000, 'error');
  }
}

async function pendrivePollProgress() {
  try {
    const r = await fetch('/api/pendrive/progress');
    const data = await r.json();
    document.getElementById('pendriveProgressFill').style.width = data.percent + '%';
    document.getElementById('pendriveProgressPct').textContent = data.percent + '%';
    document.getElementById('pendriveProgressStep').textContent = data.step || '';

    const logEl = document.getElementById('pendriveLog');
    if (data.log && data.log.length > 0) {
      logEl.innerHTML = data.log.map(function(l) {
        if (l.includes('[OK]')) return '<div class="pendrive-log-ok">' + escapeHtml(l) + '</div>';
        if (l.includes('[ERRO]') || l.includes('[X]')) return '<div class="pendrive-log-err">' + escapeHtml(l) + '</div>';
        if (l.includes('===')) return '<div class="pendrive-log-done">' + escapeHtml(l) + '</div>';
        return '<div>' + escapeHtml(l) + '</div>';
      }).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }

    if (data.done) {
      clearInterval(_pendriveProgressTimer);
      _pendriveProgressTimer = null;
      if (data.error) {
        osToast('Erro na preparacao: ' + data.error, 5000, 'error');
      } else {
        document.getElementById('pendriveStep3').style.display = 'none';
        document.getElementById('pendriveStep4').style.display = '';
        document.getElementById('pendriveDoneText').textContent =
          'BunkerAI copiado para ' + (data.dest || 'pendrive') + ' (' + (data.final_size || '') + ')';
        osToast('Pendrive preparado com sucesso!', 4000);
      }
    }
  } catch (e) { /* ignore polling errors */ }
}

async function pendriveCancelCopy() {
  try {
    await fetch('/api/pendrive/cancel', { method: 'POST' });
    osToast('Cancelando...', 2000);
  } catch (e) { /* ignore */ }
}

function pendriveReset() {
  _pendriveSelectedDrive = null;
  _pendriveEstimate = null;
  if (_pendriveProgressTimer) {
    clearInterval(_pendriveProgressTimer);
    _pendriveProgressTimer = null;
  }
  document.getElementById('pendriveStep1').style.display = '';
  document.getElementById('pendriveStep2').style.display = 'none';
  document.getElementById('pendriveStep3').style.display = 'none';
  document.getElementById('pendriveStep4').style.display = 'none';
  pendriveRefreshDrives();
}

// Exports
window.pendriveInit = pendriveInit;
window.pendriveRefreshDrives = pendriveRefreshDrives;
window.pendriveSelectDrive = pendriveSelectDrive;
window.pendriveSelectCustomPath = pendriveSelectCustomPath;
window.pendriveUpdateSize = pendriveUpdateSize;
window.pendriveGoBack = pendriveGoBack;
window.pendriveStartCopy = pendriveStartCopy;
window.pendriveCancelCopy = pendriveCancelCopy;
window.pendriveReset = pendriveReset;

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ WEATHER STATION — Barometer, Clouds, Wind, Natural Signs ═══════════════
// ═══════════════════════════════════════════════════════════════════════════════

const WEATHER_STORAGE_KEY = 'bunker_weather_readings';

// Cloud types reference data
const CLOUD_TYPES = [
  { name: 'Cirrus', alt: 'Alta (6-12 km)', icon: '🌤️', shape: 'Fios finos e brancos', weather: 'Tempo bom, mas pode indicar frente quente se aproximando em 24-48h', danger: 0 },
  { name: 'Cirrostratus', alt: 'Alta (6-12 km)', icon: '🌥️', shape: 'Camada fina translucida, halo solar/lunar', weather: 'Chuva ou neve em 12-24h (frente quente chegando)', danger: 1 },
  { name: 'Cirrocumulus', alt: 'Alta (6-12 km)', icon: '☁️', shape: 'Pequenas ondulacoes brancas (ceu de brigadeiro)', weather: 'Tempo instavel proximo, mudanca em 6-12h', danger: 1 },
  { name: 'Altostratus', alt: 'Media (2-6 km)', icon: '🌥️', shape: 'Camada cinza uniforme, sol visivel fraco', weather: 'Chuva continua em 6-12h', danger: 2 },
  { name: 'Altocumulus', alt: 'Media (2-6 km)', icon: '⛅', shape: 'Blocos brancos/cinzas, padroes regulares', weather: 'Se de manha: tempestade a tarde. Instabilidade', danger: 2 },
  { name: 'Stratocumulus', alt: 'Baixa (0-2 km)', icon: '☁️', shape: 'Rolos ou blocos cinzas com frestas de azul', weather: 'Chuva leve ou garoa possivel, geralmente sem tempestade', danger: 1 },
  { name: 'Stratus', alt: 'Baixa (0-2 km)', icon: '🌫️', shape: 'Camada cinza uniforme, ceu encoberto total', weather: 'Garoa ou chuvisco. Visibilidade reduzida. Neblina', danger: 1 },
  { name: 'Nimbostratus', alt: 'Baixa-Media (0-4 km)', icon: '🌧️', shape: 'Camada escura e espessa, sem forma definida', weather: 'Chuva continua e moderada por horas. Planejar abrigo', danger: 2 },
  { name: 'Cumulus', alt: 'Baixa (1-2 km)', icon: '⛅', shape: 'Algodao branco com base plana', weather: 'Tempo bom se pequenas. Se crescerem verticalmente: tempestade', danger: 0 },
  { name: 'Cumulonimbus', alt: 'Todas (1-15 km)', icon: '⛈️', shape: 'Torre gigante com topo em bigorna, base escura', weather: 'PERIGO: tempestade severa, raios, granizo, tornado possivel. Procure abrigo IMEDIATO', danger: 3 },
];

// Beaufort wind scale
const BEAUFORT_SCALE = [
  { force: 0, name: 'Calmaria',    kmh: '0-1',    effects: 'Fumaca sobe verticalmente. Agua como espelho', sea: 'Mar liso' },
  { force: 1, name: 'Bafagem',     kmh: '1-5',    effects: 'Fumaca desvia levemente. Folhas imoveis', sea: 'Ondulacoes pequenas' },
  { force: 2, name: 'Brisa leve',  kmh: '6-11',   effects: 'Sente-se na pele. Folhas sussurram', sea: 'Ondas pequenas curtas' },
  { force: 3, name: 'Brisa fraca', kmh: '12-19',  effects: 'Folhas e galhos finos em movimento. Bandeiras leves tremulam', sea: 'Ondas grandes com cristas' },
  { force: 4, name: 'Brisa moderada', kmh: '20-28', effects: 'Poeira e papeis levantam. Galhos medios movem', sea: 'Ondas medias, espuma' },
  { force: 5, name: 'Brisa forte', kmh: '29-38',  effects: 'Arbustos balancam. Ondas com cristas em lagos', sea: 'Ondas longas, espuma' },
  { force: 6, name: 'Vento fresco', kmh: '39-49', effects: 'Galhos grandes movem. Dificil usar guarda-chuva. Fios assobiam', sea: 'Ondas altas, espuma branca' },
  { force: 7, name: 'Vento forte', kmh: '50-61',  effects: 'Arvores inteiras balancam. Dificil andar contra o vento', sea: 'Mar revolto, espuma' },
  { force: 8, name: 'Ventania',    kmh: '62-74',  effects: 'Galhos quebram. Impossivel andar contra o vento', sea: 'Ondas altas com cristas' },
  { force: 9, name: 'Ventania forte', kmh: '75-88', effects: 'Telhas voam. Danos estruturais leves. PERIGO ao ar livre', sea: 'Ondas muito altas' },
  { force: 10, name: 'Tempestade', kmh: '89-102', effects: 'Arvores arrancadas. Danos estruturais significativos. ABRIGAR-SE', sea: 'Mar branco, visibilidade reduzida' },
  { force: 11, name: 'Tempestade violenta', kmh: '103-117', effects: 'Destruicao generalizada. PERIGO EXTREMO', sea: 'Ondas excepcionais' },
  { force: 12, name: 'Furacao', kmh: '118+', effects: 'Devastacao total. Buscar abrigo subterraneo IMEDIATAMENTE', sea: 'Mar completamente branco' },
];

// Natural weather signs
const WEATHER_SIGNS = [
  { cat: 'Bom Tempo se Aproxima', icon: '☀️', signs: [
    { sign: 'Ceu vermelho ao anoitecer (poente)', meaning: '"Ceu vermelho a noite, pastor em deleite" — bom tempo por 12-24h' },
    { sign: 'Orvalho pesado na grama pela manha', meaning: 'Noite clara e calma = bom tempo continua' },
    { sign: 'Neblina matinal nos vales', meaning: 'Dissipa com o sol = dia claro' },
    { sign: 'Formigas construindo montes altos', meaning: 'Tempo seco prolongado esperado' },
    { sign: 'Aranhas tecendo teias longas', meaning: 'Ar seco, bom tempo por varios dias' },
    { sign: 'Pressao subindo constantemente', meaning: 'Ar frio e seco chegando, tempo estavel' },
  ]},
  { cat: 'Chuva se Aproxima', icon: '🌧️', signs: [
    { sign: 'Ceu vermelho ao amanhecer (nascente)', meaning: '"Ceu vermelho de manha, pastor se acautela" — chuva em 12-24h' },
    { sign: 'Halo ao redor do sol ou lua', meaning: 'Cristais de gelo = frente quente, chuva em 12-24h' },
    { sign: 'Nuvens baixas escurecendo rapidamente', meaning: 'Chuva em 1-3 horas' },
    { sign: 'Passaros voando baixo', meaning: 'Pressao caindo, insetos voam baixo, passaros seguem' },
    { sign: 'Sapos coaxando mais alto e frequente', meaning: 'Umidade alta, chuva proxima' },
    { sign: 'Flores se fechando (dente-de-leao, trebol)', meaning: 'Umidade subindo, chuva em horas' },
    { sign: 'Cheiro forte de terra/plantas', meaning: 'Pressao caindo libera gases do solo' },
    { sign: 'Fumaca descendo ao inves de subir', meaning: 'Pressao baixa = chuva iminente' },
  ]},
  { cat: 'Tempestade Severa', icon: '⛈️', signs: [
    { sign: 'Ceu amarelo-esverdeado', meaning: 'PERIGO: granizo ou tornado possivel. Abrigo AGORA' },
    { sign: 'Nuvem em formato de bigorna (cumulonimbus)', meaning: 'Tempestade severa em 30-60 min' },
    { sign: 'Queda subita de temperatura', meaning: 'Frente fria agressiva, ventos fortes iminentes' },
    { sign: 'Calma estranha apos ventos fortes', meaning: 'PERIGO: possivel olho de tempestade. Abrigo!' },
    { sign: 'Pressao caindo rapido (>3 hPa em 3h)', meaning: 'ALERTA: tempestade severa se formando' },
    { sign: 'Vento mudando de direcao subitamente', meaning: 'Frente de tempestade passando' },
  ]},
  { cat: 'Neve/Frio Extremo', icon: '❄️', signs: [
    { sign: 'Halo largo ao redor da lua em noite fria', meaning: 'Neve em 12-24h' },
    { sign: 'Ceu uniformemente cinza-claro no inverno', meaning: 'Neve provavel nas proximas horas' },
    { sign: 'Estalos em galhos/arvores', meaning: 'Temperatura caindo abaixo de -15C. Risco de hipotermia' },
    { sign: 'Vento norte constante (hemisferio sul: vento sul)', meaning: 'Ar artico/polar chegando. Preparar isolamento' },
  ]},
];

// --- Weather Station Functions ---

function weatherInit() {
  weatherBuildClouds();
  weatherBuildWind();
  weatherBuildSigns();
  weatherCalcWindChill();
  weatherCalcHeatIndex();
  weatherBuildChillTable();
}

function weatherSwitchTab(tab) {
  // Aba Barometro removida (sem sensor). Redirecionar para Nuvens.
  if (tab === 'barometer') tab = 'clouds';
  document.querySelectorAll('.weather-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.weather-panel').forEach(p => p.classList.add('hidden'));
  const tabBtn = document.getElementById('wtab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  const panel = document.getElementById('wpanel' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (tabBtn) tabBtn.classList.add('active');
  if (panel) panel.classList.remove('hidden');
}

function weatherGetReadings() {
  try { return JSON.parse(localStorage.getItem(WEATHER_STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function weatherSaveReadings(readings) {
  localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(readings.slice(-100))); // keep last 100
}

function weatherAddReading() {
  const input = document.getElementById('weatherPressureInput');
  const val = parseFloat(input?.value);
  if (!val || val < 870 || val > 1084) {
    input?.classList.add('weather-input-error');
    setTimeout(() => input?.classList.remove('weather-input-error'), 1000);
    return;
  }
  const readings = weatherGetReadings();
  readings.push({ t: Date.now(), p: Math.round(val * 10) / 10 });
  weatherSaveReadings(readings);
  if (input) input.value = '';
  weatherLoadHistory();
}

function weatherClearHistory() {
  localStorage.removeItem(WEATHER_STORAGE_KEY);
  weatherLoadHistory();
}

function weatherLoadHistory() {
  const readings = weatherGetReadings();
  const container = document.getElementById('weatherHistory');
  const gaugeVal = document.getElementById('weatherGaugeValue');
  const gaugeLabel = document.getElementById('weatherGaugeLabel');
  const predIcon = document.getElementById('weatherPredIcon');
  const predText = document.getElementById('weatherPredText');
  const predTrend = document.getElementById('weatherPredTrend');

  if (!container) return;

  if (readings.length === 0) {
    container.innerHTML = '<div class="weather-empty">Nenhuma leitura registrada ainda</div>';
    if (gaugeVal) gaugeVal.textContent = '--- hPa';
    if (gaugeLabel) gaugeLabel.textContent = 'Sem leituras';
    if (predIcon) predIcon.textContent = '\u2753';
    if (predText) predText.textContent = 'Registre leituras de pressao para previsao';
    if (predTrend) predTrend.textContent = '';
    weatherUpdateNeedle(1013);
    weatherDrawChart();
    return;
  }

  // Show last 20 readings, newest first
  const recent = readings.slice(-20).reverse();
  let html = '';
  recent.forEach(r => {
    const d = new Date(r.t);
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    html += `<div class="weather-reading">
      <span class="weather-reading-time">${date} ${time}</span>
      <span class="weather-reading-val">${r.p} hPa</span>
    </div>`;
  });
  container.innerHTML = html;

  // Update gauge
  const latest = readings[readings.length - 1];
  if (gaugeVal) gaugeVal.textContent = latest.p + ' hPa';
  weatherUpdateNeedle(latest.p);

  // Predict weather based on pressure and trend
  const prediction = weatherPredict(readings);
  if (gaugeLabel) gaugeLabel.textContent = prediction.label;
  if (predIcon) predIcon.textContent = prediction.icon;
  if (predText) predText.textContent = prediction.text;
  if (predTrend) {
    predTrend.textContent = prediction.trend;
    predTrend.className = 'weather-pred-trend ' + prediction.trendClass;
  }

  weatherDrawChart();
}

function weatherUpdateNeedle(pressure) {
  const needle = document.getElementById('weatherNeedle');
  if (!needle) return;
  // Map 960-1060 hPa to -90 to +90 degrees
  const clamped = Math.max(960, Math.min(1060, pressure));
  const angle = ((clamped - 960) / (1060 - 960)) * 180 - 90;
  needle.setAttribute('transform', `rotate(${angle} 100 100)`);
}

function weatherPredict(readings) {
  const latest = readings[readings.length - 1].p;
  let trend = 0;
  let trendText = '';
  let trendClass = '';

  if (readings.length >= 2) {
    // Compare last 2 readings
    const prev = readings[readings.length - 2].p;
    trend = latest - prev;
  }
  if (readings.length >= 3) {
    // Compare with 3h ago or earliest
    const threeHoursAgo = Date.now() - 3 * 3600 * 1000;
    const older = readings.filter(r => r.t <= threeHoursAgo);
    if (older.length > 0) {
      trend = latest - older[older.length - 1].p;
    }
  }

  if (trend > 2) { trendText = '\u2B06 Subindo rapido (+' + trend.toFixed(1) + ' hPa)'; trendClass = 'trend-up'; }
  else if (trend > 0.5) { trendText = '\u2197 Subindo (+' + trend.toFixed(1) + ' hPa)'; trendClass = 'trend-up'; }
  else if (trend < -2) { trendText = '\u2B07 Caindo rapido (' + trend.toFixed(1) + ' hPa)'; trendClass = 'trend-down'; }
  else if (trend < -0.5) { trendText = '\u2198 Caindo (' + trend.toFixed(1) + ' hPa)'; trendClass = 'trend-down'; }
  else { trendText = '\u2194 Estavel'; trendClass = 'trend-stable'; }

  // Prediction logic
  let icon, text, label;

  if (latest >= 1023 && trend >= 0) {
    icon = '\u2600\uFE0F'; label = 'Tempo bom e estavel';
    text = 'Alta pressao estavel. Ceu limpo provavel por 24-48h. Bom para atividades ao ar livre.';
  } else if (latest >= 1013 && trend > 1) {
    icon = '\u{1F324}\uFE0F'; label = 'Melhorando';
    text = 'Pressao subindo. Tempo melhorando nas proximas horas. Nuvens se dissipando.';
  } else if (latest >= 1013 && trend >= -1) {
    icon = '\u26C5'; label = 'Parcialmente nublado';
    text = 'Pressao normal e estavel. Possibilidade de nuvens mas sem chuva significativa.';
  } else if (latest >= 1000 && trend < -2) {
    icon = '\u{1F327}\uFE0F'; label = 'Chuva provavel';
    text = 'ATENCAO: Pressao caindo rapidamente. Chuva provavel em 6-12h. Prepare abrigo e colete agua.';
  } else if (latest >= 1000 && trend < 0) {
    icon = '\u{1F326}\uFE0F'; label = 'Possivel chuva';
    text = 'Pressao em queda lenta. Possibilidade de chuva em 12-24h. Monitore a tendencia.';
  } else if (latest < 1000 && trend < -3) {
    icon = '\u26C8\uFE0F'; label = 'TEMPESTADE PROXIMA';
    text = 'ALERTA: Pressao muito baixa e caindo rapido. Tempestade provavel. Procure abrigo solido AGORA.';
  } else if (latest < 1000) {
    icon = '\u{1F327}\uFE0F'; label = 'Tempo instavel';
    text = 'Pressao baixa. Tempo instavel com chuva e ventos. Nao se afaste do abrigo.';
  } else {
    icon = '\u{1F324}\uFE0F'; label = 'Normal';
    text = 'Pressao dentro da faixa normal. Continue monitorando para detectar tendencias.';
  }

  return { icon, text, label, trend: trendText, trendClass };
}

function weatherDrawChart() {
  const canvas = document.getElementById('weatherChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const readings = weatherGetReadings();
  if (readings.length < 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '12px var(--font-mono)';
    ctx.textAlign = 'center';
    ctx.fillText('Minimo 2 leituras para grafico', W / 2, H / 2);
    return;
  }

  const last30 = readings.slice(-30);
  const minP = Math.min(...last30.map(r => r.p)) - 2;
  const maxP = Math.max(...last30.map(r => r.p)) + 2;
  const range = maxP - minP || 1;

  // Background grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = 10 + (i / 4) * (H - 20);
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 10, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText((maxP - (i / 4) * range).toFixed(0), 36, y + 3);
  }

  // Pressure line
  ctx.strokeStyle = '#42f5a0';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#42f5a0';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  last30.forEach((r, i) => {
    const x = 44 + (i / (last30.length - 1)) * (W - 58);
    const y = 10 + ((maxP - r.p) / range) * (H - 20);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Dots
  last30.forEach((r, i) => {
    const x = 44 + (i / (last30.length - 1)) * (W - 58);
    const y = 10 + ((maxP - r.p) / range) * (H - 20);
    ctx.fillStyle = '#42f5a0';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // 1013 hPa reference line
  if (1013 >= minP && 1013 <= maxP) {
    const y1013 = 10 + ((maxP - 1013) / range) * (H - 20);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(44, y1013); ctx.lineTo(W - 10, y1013); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.6)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('1013 hPa (normal)', 46, y1013 - 4);
  }
}

function weatherBuildClouds() {
  const grid = document.getElementById('weatherCloudGrid');
  if (!grid) return;
  const dangerColors = ['#42f5a0', '#fbbf24', '#f97316', '#f43f5e'];
  const dangerLabels = ['Sem risco', 'Atencao', 'Cuidado', 'PERIGO'];
  grid.innerHTML = CLOUD_TYPES.map(c => `
    <div class="weather-cloud-card">
      <div class="weather-cloud-header">
        <span class="weather-cloud-icon">${c.icon}</span>
        <div>
          <div class="weather-cloud-name">${c.name}</div>
          <div class="weather-cloud-alt">${c.alt}</div>
        </div>
        <span class="weather-cloud-danger" style="color:${dangerColors[c.danger]}">${dangerLabels[c.danger]}</span>
      </div>
      <div class="weather-cloud-shape"><strong>Aparencia:</strong> ${c.shape}</div>
      <div class="weather-cloud-weather"><strong>Previsao:</strong> ${c.weather}</div>
    </div>
  `).join('');
}

function weatherBuildWind() {
  const table = document.getElementById('weatherWindTable');
  if (!table) return;
  table.innerHTML = BEAUFORT_SCALE.map(b => {
    const color = b.force <= 3 ? '#42f5a0' : b.force <= 6 ? '#fbbf24' : b.force <= 8 ? '#f97316' : '#f43f5e';
    return `<div class="weather-wind-row" style="border-left: 3px solid ${color}">
      <div class="weather-wind-force">${b.force}</div>
      <div class="weather-wind-info">
        <div class="weather-wind-name">${b.name} <span class="weather-wind-speed">${b.kmh} km/h</span></div>
        <div class="weather-wind-effects">${b.effects}</div>
      </div>
    </div>`;
  }).join('');
}

function weatherBuildSigns() {
  const grid = document.getElementById('weatherSignsGrid');
  if (!grid) return;
  grid.innerHTML = WEATHER_SIGNS.map(cat => `
    <div class="weather-signs-section">
      <h3 class="weather-signs-cat">${cat.icon} ${cat.cat}</h3>
      ${cat.signs.map(s => `
        <div class="weather-sign-card">
          <div class="weather-sign-obs">${s.sign}</div>
          <div class="weather-sign-meaning">${s.meaning}</div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function weatherCalcWindChill() {
  const temp = parseFloat(document.getElementById('weatherTemp')?.value) || 0;
  const wind = parseFloat(document.getElementById('weatherWind')?.value) || 0;
  const resultEl = document.getElementById('weatherWindChillVal');
  const dangerEl = document.getElementById('weatherDangerZone');

  if (!resultEl) return;

  let wc;
  if (temp > 10 || wind < 4.8) {
    wc = temp; // Wind chill not applicable above 10C or very low winds
  } else {
    // Environment Canada / US NWS formula
    wc = 13.12 + 0.6215 * temp - 11.37 * Math.pow(wind, 0.16) + 0.3965 * temp * Math.pow(wind, 0.16);
  }

  resultEl.textContent = wc.toFixed(1) + ' \u00B0C';

  // Color by danger level
  let color, danger;
  if (wc > 0) { color = '#42f5a0'; danger = ''; }
  else if (wc > -10) { color = '#38bdf8'; danger = 'Desconforto. Use camadas extras.'; }
  else if (wc > -25) { color = '#fbbf24'; danger = 'ATENCAO: Risco de congelamento em pele exposta em 30 min.'; }
  else if (wc > -45) { color = '#f97316'; danger = 'PERIGO: Congelamento em 10-15 min. Hipotermia rapida. Minimize exposicao.'; }
  else { color = '#f43f5e'; danger = 'PERIGO EXTREMO: Congelamento em menos de 5 min. NAO sair ao ar livre.'; }

  resultEl.style.color = color;
  if (dangerEl) { dangerEl.textContent = danger; dangerEl.style.color = color; }
}

function weatherCalcHeatIndex() {
  const temp = parseFloat(document.getElementById('weatherHeatTemp')?.value) || 35;
  const rh = parseFloat(document.getElementById('weatherHumidity')?.value) || 60;
  const resultEl = document.getElementById('weatherHeatVal');
  const dangerEl = document.getElementById('weatherHeatDanger');

  if (!resultEl) return;

  // Rothfusz regression (converted from Fahrenheit)
  const tf = temp * 9 / 5 + 32;
  let hi;
  if (tf < 80) {
    hi = tf;
  } else {
    hi = -42.379 + 2.04901523 * tf + 10.14333127 * rh
      - 0.22475541 * tf * rh - 0.00683783 * tf * tf
      - 0.05481717 * rh * rh + 0.00122874 * tf * tf * rh
      + 0.00085282 * tf * rh * rh - 0.00000199 * tf * tf * rh * rh;
  }
  const hiC = (hi - 32) * 5 / 9;

  resultEl.textContent = hiC.toFixed(1) + ' \u00B0C';

  let color, danger;
  if (hiC < 27) { color = '#42f5a0'; danger = ''; }
  else if (hiC < 32) { color = '#fbbf24'; danger = 'Cautela: Fadiga possivel com exposicao prolongada.'; }
  else if (hiC < 40) { color = '#f97316'; danger = 'PERIGO: Caimbras e exaustao termica provaveis. Hidrate-se.'; }
  else if (hiC < 54) { color = '#f43f5e'; danger = 'PERIGO EXTREMO: Insolacao provavel. Evite exposicao solar.'; }
  else { color = '#ff0040'; danger = 'RISCO DE VIDA: Insolacao iminente. Busque resfriamento IMEDIATO.'; }

  resultEl.style.color = color;
  if (dangerEl) { dangerEl.textContent = danger; dangerEl.style.color = color; }
}

function weatherBuildChillTable() {
  const table = document.getElementById('weatherChillTable');
  if (!table) return;
  const temps = [10, 5, 0, -5, -10, -15, -20, -30];
  const winds = [10, 20, 30, 40, 50, 60];
  let html = '<table class="weather-ref-table"><thead><tr><th>T \\ V</th>';
  winds.forEach(w => html += `<th>${w}</th>`);
  html += '</tr></thead><tbody>';
  temps.forEach(t => {
    html += `<tr><td>${t}°C</td>`;
    winds.forEach(w => {
      let wc;
      if (t > 10 || w < 4.8) wc = t;
      else wc = 13.12 + 0.6215 * t - 11.37 * Math.pow(w, 0.16) + 0.3965 * t * Math.pow(w, 0.16);
      const v = Math.round(wc);
      let cls = '';
      if (v <= -45) cls = 'wc-extreme';
      else if (v <= -25) cls = 'wc-danger';
      else if (v <= -10) cls = 'wc-warning';
      else if (v <= 0) cls = 'wc-caution';
      html += `<td class="${cls}">${v}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  table.innerHTML = html;
}

// Exports
window.weatherInit = weatherInit;
window.weatherSwitchTab = weatherSwitchTab;
window.weatherAddReading = weatherAddReading;
window.weatherClearHistory = weatherClearHistory;
window.weatherCalcWindChill = weatherCalcWindChill;
window.weatherCalcHeatIndex = weatherCalcHeatIndex;

// ═══════════════════════════════════════════════════════════════════════════════
// ██████  First Aid Guide — Primeiros Socorros Offline  ██████
// ═══════════════════════════════════════════════════════════════════════════════

const FIRSTAID_PROCEDURES = [
  // ── CARDIAC ──
  {
    id: 'cpr-adult', cat: 'cardiac', triage: 'red',
    title: 'RCP — Adulto', icon: '\u{1F49F}',
    summary: 'Reanimacao cardiopulmonar para adultos sem pulso',
    steps: [
      { text: 'SEGURANCA: Verifique se o local e seguro para voce e para a vitima.', warn: true },
      { text: 'Toque nos ombros e pergunte alto: "Voce esta bem?"' },
      { text: 'Sem resposta? Peca para alguem ligar 192/193. Se sozinho, ligue no viva-voz.' },
      { text: 'Verifique a respiracao por NO MAXIMO 10 segundos. Olhe o peito, ouca, sinta.' },
      { text: 'Sem respiracao normal? Inicie compressoes AGORA.', warn: true },
      { text: 'POSICAO: Coloque a vitima de costas em superficie dura e plana.' },
      { text: 'MAOS: Entrelace os dedos, base da mao no centro do peito (entre os mamilos).' },
      { text: 'COMPRIMA: Bracos esticados, ombros sobre as maos, comprima 5-6 cm de profundidade.' },
      { text: 'RITMO: 100-120 compressoes por minuto (use o metronomo abaixo).', action: 'cpr_metro' },
      { text: '30 COMPRESSOES + 2 VENTILACOES: Incline a cabeca, levante o queixo, sopre ate o peito subir.' },
      { text: 'Se nao quiser/puder ventilar: faca APENAS compressoes sem parar.' },
      { text: 'CONTINUE ate: chegar socorro, a vitima reagir, ou voce nao aguentar mais.' },
      { text: 'REVEZAMENTO: Troque quem comprime a cada 2 minutos para manter qualidade.' },
      { text: 'DEA: Se disponivel, ligue e siga as instrucoes de voz. Nao pare RCP ate o DEA analisar.', warn: true },
    ]
  },
  {
    id: 'cpr-child', cat: 'cardiac', triage: 'red',
    title: 'RCP — Crianca (1-8 anos)', icon: '\u{1F476}',
    summary: 'Reanimacao cardiopulmonar para criancas',
    steps: [
      { text: 'SEGURANCA primeiro. Verifique o local.', warn: true },
      { text: 'Estimule a crianca: toque, chame pelo nome em voz alta.' },
      { text: 'Sem resposta? Grite por ajuda. Se sozinho, faca 2 min de RCP antes de ligar 192.' },
      { text: 'Verifique respiracao (max 10 seg). Se nao respira ou so "gasping", inicie RCP.' },
      { text: 'Use UMA mao para compressoes no centro do peito.' },
      { text: 'Comprima cerca de 5 cm de profundidade.' },
      { text: 'RITMO: 100-120/min. 30 compressoes + 2 ventilacoes.' },
      { text: 'Ventilacao: Incline a cabeca GENTILMENTE (menos que adulto). Sopre ate o peito subir.' },
      { text: 'Continue ate chegar socorro ou a crianca reagir.' },
    ]
  },
  {
    id: 'choking-adult', cat: 'cardiac', triage: 'red',
    title: 'Engasgo — Adulto', icon: '\u{1F6AB}',
    summary: 'Desobstrucao de vias aereas (Heimlich)',
    steps: [
      { text: 'Pergunte: "Voce esta engasgado? Posso ajudar?"' },
      { text: 'Se a pessoa TOSSE COM FORCA: incentive a continuar tossindo. NAO bata nas costas.', warn: true },
      { text: 'Se NAO CONSEGUE tossir, falar ou respirar:' },
      { text: 'POSICIONE-SE atras da vitima, com um pe entre os dela.' },
      { text: 'PUNHO: Coloque o punho (lado do polegar) acima do umbigo, abaixo do esterno.' },
      { text: 'ABRACE o punho com a outra mao.' },
      { text: 'COMPRIMA para dentro e para CIMA com forca (manobra de Heimlich).' },
      { text: 'Repita ate o objeto sair ou a vitima perder a consciencia.' },
      { text: 'Se desmaiou: coloque no chao e inicie RCP. A cada vez que abrir a via aerea, olhe na boca.', warn: true },
    ]
  },
  // ── BLEEDING ──
  {
    id: 'severe-bleed', cat: 'bleeding', triage: 'red',
    title: 'Hemorragia Grave', icon: '\u{1FA78}',
    summary: 'Controle de sangramento grave com risco de vida',
    steps: [
      { text: 'SEGURANCA: Use luvas ou saco plastico. Evite contato direto com sangue.', warn: true },
      { text: 'PRESSAO DIRETA: Coloque um pano limpo sobre o ferimento e pressione COM FORCA.' },
      { text: 'NAO REMOVA o pano mesmo se encharcar — coloque mais pano POR CIMA.' },
      { text: 'ELEVE o membro ferido acima do nivel do coracao se possivel.' },
      { text: 'TORNIQUETE (se sangramento nao para em membro): Amarre um pano largo 5-8cm acima do ferimento.', warn: true },
      { text: 'Aperte o torniquete usando um bastao (caneta, galho) girando ate parar de sangrar.' },
      { text: 'ANOTE A HORA que colocou o torniquete. NAO afrouxe.', warn: true },
      { text: 'Mantenha a vitima deitada, pernas elevadas (exceto se trauma na cabeca/peito).' },
      { text: 'Cubra a vitima para manter aquecida — choque hemorragico causa hipotermia.' },
      { text: 'NAO de liquidos pela boca se suspeitar de cirurgia necessaria.' },
    ]
  },
  {
    id: 'nosebleed', cat: 'bleeding', triage: 'green',
    title: 'Sangramento Nasal', icon: '\u{1F443}',
    summary: 'Epistaxe — como parar sangramento do nariz',
    steps: [
      { text: 'Sente a pessoa com a cabeca LEVEMENTE inclinada para FRENTE (nao para tras!).' },
      { text: 'Aperte FIRME as duas narinas com polegar e indicador.' },
      { text: 'Mantenha por 10-15 minutos SEM soltar para verificar.' },
      { text: 'Respire pela boca. Cuspa qualquer sangue que escorrer para a garganta.' },
      { text: 'Aplique gelo/pano frio na ponte do nariz.' },
      { text: 'Apos parar: nao assoar o nariz por varias horas.' },
      { text: 'PROCURE SOCORRO se: nao parar em 20 min, foi causado por trauma, ou e recorrente.', warn: true },
    ]
  },
  // ── FRACTURE ──
  {
    id: 'fracture-gen', cat: 'fracture', triage: 'yellow',
    title: 'Fratura — Geral', icon: '\u{1F9B4}',
    summary: 'Imobilizacao de fraturas em membros',
    steps: [
      { text: 'NAO tente realinhar o osso! Imobilize na posicao que esta.', warn: true },
      { text: 'SINAIS: Dor intensa, inchaço, deformidade, incapacidade de mover, crepitacao.' },
      { text: 'IMPROVISE tala com: tabua, revista enrolada, galho reto, papelao, travesseiro.' },
      { text: 'A tala deve ir de UMA articulacao acima ate UMA abaixo da fratura.' },
      { text: 'Amarre a tala com tiras de pano, cintos, cordas — firme mas sem cortar circulacao.' },
      { text: 'VERIFIQUE circulacao: Dedos devem ter cor normal, estar mornos, sentir quando tocados.' },
      { text: 'Aplique gelo envolto em pano (15 min com, 15 min sem) para reduzir inchaço.' },
      { text: 'FRATURA EXPOSTA (osso visivel): Cubra com pano limpo umido. NAO empurre o osso.', warn: true },
      { text: 'Mantenha o membro elevado se possivel.' },
    ]
  },
  {
    id: 'spinal', cat: 'fracture', triage: 'red',
    title: 'Lesao de Coluna', icon: '\u26A0\uFE0F',
    summary: 'Suspeita de lesao na coluna vertebral',
    steps: [
      { text: 'NAO MOVA A VITIMA! A menos que haja perigo imediato (fogo, desabamento).', warn: true },
      { text: 'SUSPEITE se: queda de altura, acidente de carro, mergulho, trauma na cabeca.' },
      { text: 'Peca a vitima para NÃO se mover. Mantenha calma.' },
      { text: 'ESTABILIZE a cabeca: Segure firme com as duas maos, uma de cada lado, alinhada com o corpo.' },
      { text: 'NAO incline, gire ou flexione o pescoco.' },
      { text: 'Se precisar virar (vomito): role o corpo INTEIRO como um bloco (tecnica de rolamento).' },
      { text: 'IMPROVISE colar cervical: toalha enrolada ao redor do pescoco (nao aperte a frente).' },
      { text: 'Mantenha aquecido e aguarde socorro profissional.' },
    ]
  },
  // ── BURN ──
  {
    id: 'burn-thermal', cat: 'burn', triage: 'yellow',
    title: 'Queimadura Termica', icon: '\u{1F525}',
    summary: 'Queimaduras por fogo, agua quente ou objetos',
    steps: [
      { text: 'AFASTE a fonte de calor. Remova roupas que nao estejam grudadas na pele.' },
      { text: 'RESFRIE com agua corrente FRIA (nao gelada!) por 10-20 minutos.', warn: true },
      { text: 'NAO use gelo, manteiga, pasta de dente ou qualquer "receita caseira".', warn: true },
      { text: '1o GRAU (vermelhidao): Apenas resfrie e hidrate. Cura sozinha.' },
      { text: '2o GRAU (bolhas): NAO estoure bolhas! Cubra com gaze esteril solta.' },
      { text: '3o GRAU (pele branca/preta, sem dor): Emergencia! Cubra com pano limpo, va ao hospital.', warn: true },
      { text: 'Queimadura maior que a palma da mao da vitima = PROCURE SOCORRO.' },
      { text: 'Queimaduras em rosto, maos, pes, genitais ou articulacoes = SEMPRE hospital.' },
      { text: 'Mantenha hidratado — queimaduras causam perda de liquidos.' },
    ]
  },
  {
    id: 'burn-chemical', cat: 'burn', triage: 'red',
    title: 'Queimadura Quimica', icon: '\u2623\uFE0F',
    summary: 'Contato com acidos, bases ou produtos quimicos',
    steps: [
      { text: 'PROTEJA-SE! Use luvas. Nao toque no produto diretamente.', warn: true },
      { text: 'REMOVA roupas contaminadas imediatamente (corte se preciso).' },
      { text: 'LAVE com agua corrente ABUNDANTE por no minimo 20 minutos.' },
      { text: 'Se atingiu os olhos: lave com agua por 20 min, palpebras abertas, do canto interno para fora.', warn: true },
      { text: 'IDENTIFIQUE o produto se possivel (leve a embalagem ao hospital).' },
      { text: 'NAO tente neutralizar (acido com base ou vice-versa). Apenas lave.' },
      { text: 'Cubra a area com pano limpo e umido.' },
      { text: 'Procure atendimento medico URGENTE.' },
    ]
  },
  // ── RESPIRATORY ──
  {
    id: 'asthma-attack', cat: 'respiratory', triage: 'yellow',
    title: 'Crise de Asma', icon: '\u{1FAC1}',
    summary: 'Dificuldade respiratoria por asma',
    steps: [
      { text: 'Mantenha a calma. Ajude a pessoa a sentar-se ereta (nao deitada!).' },
      { text: 'Se tem bombinha: ajude a usar. Agite, expire, acione ao inspirar. 4-8 puffs.' },
      { text: 'Espere 4 minutos. Se nao melhorar, repita mais 4-8 puffs.' },
      { text: 'Afrouxe roupas apertadas no peito e pescoco.' },
      { text: 'Respiracao com labios semicerrados: inspire pelo nariz, expire devagar pela boca.' },
      { text: 'EMERGENCIA se: labios/unhas azulados, nao consegue falar, bombinha nao funciona.', warn: true },
      { text: 'Sem melhora em 15 min = 192/193 imediatamente.' },
    ]
  },
  {
    id: 'drowning', cat: 'respiratory', triage: 'red',
    title: 'Afogamento', icon: '\u{1F30A}',
    summary: 'Resgate e primeiros socorros pos-afogamento',
    steps: [
      { text: 'NAO entre na agua a menos que saiba nadar e tenha treinamento!', warn: true },
      { text: 'LANCE algo que flutue: boia, garrafa PET, cooler, prancha.' },
      { text: 'ESTENDA galho, corda, toalha ou cinto para a pessoa agarrar.' },
      { text: 'Ao retirar da agua: CUIDADO com a coluna cervical se houve mergulho.' },
      { text: 'Deite de costas. Verifique se respira (max 10 seg).' },
      { text: 'Se NAO respira: inicie RCP com 5 ventilacoes de resgate primeiro.', warn: true },
      { text: 'Depois siga 30 compressoes + 2 ventilacoes normalmente.' },
      { text: 'NAO tente "tirar agua dos pulmoes" virando de cabeca para baixo.' },
      { text: 'Mesmo que a pessoa parecam bem, leve ao hospital — edema pulmonar tardio pode matar.', warn: true },
    ]
  },
  // ── POISONING ──
  {
    id: 'poisoning-oral', cat: 'poisoning', triage: 'red',
    title: 'Envenenamento Oral', icon: '\u2620\uFE0F',
    summary: 'Ingestao de substancia toxica ou veneno',
    steps: [
      { text: 'Identifique O QUE foi ingerido, QUANDO e QUANTO (se possivel).', warn: true },
      { text: 'NAO provoque vomito! Especialmente se: produto corrosivo, derivado de petroleo, ou vitima inconsciente.', warn: true },
      { text: 'Ligue 0800-722-6001 (CIATOX) ou 192 (SAMU).' },
      { text: 'Se a pessoa esta consciente e o produto NAO e corrosivo: de pequenos goles de agua.' },
      { text: 'Se inconsciente: coloque em posicao lateral de seguranca (PLS).' },
      { text: 'Se parar de respirar: inicie RCP.' },
      { text: 'LEVE a embalagem do produto ao hospital.' },
      { text: 'Lave a boca se teve contato com produto corrosivo (sem engolir).' },
    ]
  },
  {
    id: 'snakebite', cat: 'poisoning', triage: 'red',
    title: 'Picada de Cobra', icon: '\u{1F40D}',
    summary: 'Mordida de serpente peconhenta',
    steps: [
      { text: 'AFASTE-SE da cobra. Nao tente capturar ou matar.' },
      { text: 'Mantenha a vitima CALMA e IMÓVEL. Movimento espalha o veneno.' },
      { text: 'REMOVA aneis, pulseiras e relogios do membro afetado (vai inchar).' },
      { text: 'IMOBILIZE o membro como se fosse uma fratura, mantendo ABAIXO do nivel do coracao.' },
      { text: 'NAO: corte, chupe, faca torniquete, aplique gelo ou qualquer substância.', warn: true },
      { text: 'LAVE o local com agua e sabao.' },
      { text: 'Se possivel, FOTOGRAFE a cobra (a distancia segura) para identificacao.' },
      { text: 'Leve ao hospital COM URGENCIA. O soro antipeconhento e o unico tratamento.', warn: true },
      { text: 'ANOTE a hora da picada e sintomas que aparecerem.' },
    ]
  },
  // ── ENVIRONMENTAL ──
  {
    id: 'heatstroke', cat: 'environmental', triage: 'red',
    title: 'Insolacao / Hipertermia', icon: '\u{1F321}\uFE0F',
    summary: 'Temperatura corporal perigosamente alta',
    steps: [
      { text: 'SINAIS: Pele vermelha e SECA (sem suor), confusao, temperatura >40°C, desmaio.', warn: true },
      { text: 'MOVA para local fresco e sombreado imediatamente.' },
      { text: 'REMOVA roupas excesso.' },
      { text: 'RESFRIE AGRESSIVAMENTE: agua fria no corpo, panos umidos em axilas/virilha/pescoco.' },
      { text: 'VENTILE com o que tiver: leque, papelao, abanar com pano.' },
      { text: 'Se consciente: de agua FRIA em pequenos goles.' },
      { text: 'Se inconsciente: posicao lateral de seguranca. NAO de liquidos.' },
      { text: 'EMERGENCIA MEDICA. Ligue 192/193.' },
    ]
  },
  {
    id: 'hypothermia', cat: 'environmental', triage: 'red',
    title: 'Hipotermia', icon: '\u{1F976}',
    summary: 'Temperatura corporal perigosamente baixa',
    steps: [
      { text: 'SINAIS: Tremores intensos, confusao, fala enrolada, pele fria, sonolência.', warn: true },
      { text: 'MOVA para local aquecido e protegido do vento/chuva.' },
      { text: 'REMOVA roupas molhadas. Seque o corpo.' },
      { text: 'AQUECA GRADUALMENTE: cobertores, sacos de dormir, cobertores termicos.' },
      { text: 'Aplique fontes de calor nas axilas, virilha e pescoco (garrafas de agua quente envoltas em pano).' },
      { text: 'Se consciente: de liquidos MORNOS e doces (cha, chocolate). NAO de alcool.', warn: true },
      { text: 'NAO esfregue os membros. NAO coloque em agua quente (choque termico).', warn: true },
      { text: 'Se sem pulso: RCP. Lembre: "ninguem esta morto ate estar quente e morto".' },
      { text: 'Procure socorro medico. Hipotermia severa requer reaquecimento hospitalar.' },
    ]
  },
  {
    id: 'dehydration', cat: 'environmental', triage: 'yellow',
    title: 'Desidratacao', icon: '\u{1F4A7}',
    summary: 'Perda excessiva de liquidos corporais',
    steps: [
      { text: 'SINAIS: Sede intensa, boca seca, urina escura, tontura, fraqueza, pele sem elasticidade.' },
      { text: 'LEVE: De soro caseiro — 1 litro de agua + 1 colher de cha de sal + 8 colheres de cha de acucar.' },
      { text: 'Ofereca em pequenos goles frequentes (nao tudo de uma vez).' },
      { text: 'Agua de coco e excelente reidratante natural.' },
      { text: 'Mantenha em local fresco e sombreado.' },
      { text: 'GRAVE: Pele sem elasticidade, olhos fundos, confusao, nao urina = HOSPITAL.', warn: true },
      { text: 'Em criancas: fralda seca por 3h+ e choro sem lagrima = emergencia.', warn: true },
    ]
  },
  // ── OTHER ──
  {
    id: 'seizure', cat: 'other', triage: 'yellow',
    title: 'Convulsao', icon: '\u26A1',
    summary: 'Crise convulsiva — o que fazer e NAO fazer',
    steps: [
      { text: 'NAO segure a pessoa. NAO coloque nada na boca.', warn: true },
      { text: 'Afaste objetos perigosos (moveis, quinas, vidros).' },
      { text: 'Proteja a cabeca com algo macio (roupa, travesseiro).' },
      { text: 'CRONOMETRE a duracao da convulsao.' },
      { text: 'Quando parar: coloque em posicao lateral de seguranca (PLS).' },
      { text: 'Fique ao lado, fale calmamente quando a pessoa despertar (estara confusa).' },
      { text: 'LIGUE 192 se: primeira convulsao, dura mais de 5 min, nao acorda, uma apos a outra, gravida.', warn: true },
    ]
  },
  {
    id: 'recovery-position', cat: 'other', triage: 'green',
    title: 'Posicao Lateral de Seguranca', icon: '\u{1F6CF}\uFE0F',
    summary: 'PLS — para vitimas inconscientes que respiram',
    steps: [
      { text: 'USE quando a pessoa esta inconsciente MAS respira normalmente.' },
      { text: 'Ajoelhe ao lado da vitima.' },
      { text: 'Estenda o braco mais proximo de voce em angulo reto com o corpo (palma para cima).' },
      { text: 'Pegue a mao do outro braco e coloque no rosto da vitima (costas da mao na bochecha).' },
      { text: 'Com a outra mao, puxe o joelho mais distante para cima (pe no chao).' },
      { text: 'Puxe pelo joelho, rolando a vitima para o seu lado.' },
      { text: 'Ajuste a perna de cima em angulo reto para estabilizar.' },
      { text: 'Incline a cabeca para tras para manter a via aerea aberta.' },
      { text: 'Verifique a respiracao regularmente.' },
    ]
  },
  {
    id: 'allergic-reaction', cat: 'other', triage: 'red',
    title: 'Reacao Alergica Grave (Anafilaxia)', icon: '\u{1F4A5}',
    summary: 'Choque anafilatico — risco iminente de vida',
    steps: [
      { text: 'SINAIS: Inchaço de rosto/labios/lingua, dificuldade respirar, urticaria, pressao baixa, desmaio.', warn: true },
      { text: 'EPINEFRINA (EpiPen): Se disponivel, aplique NA COXA (lateral, meio). Pode ser sobre a roupa.' },
      { text: 'Segure o autoinjector por 10 segundos. Massageie o local.' },
      { text: 'LIGUE 192/193 imediatamente mesmo apos usar epinefrina.' },
      { text: 'Mantenha deitado com pernas elevadas (exceto se dificuldade respiratoria — mantenha sentado).' },
      { text: 'Se piora apos 5-15 min: segunda dose de epinefrina se disponivel.' },
      { text: 'Anti-histaminico (difenidramina) ajuda nos sintomas leves mas NAO substitui epinefrina em anafilaxia.', warn: true },
      { text: 'Se parar de respirar: inicie RCP.' },
    ]
  },
  {
    id: 'wound-care', cat: 'other', triage: 'green',
    title: 'Cuidado de Ferimentos', icon: '\u{1FA79}',
    summary: 'Limpeza e curativo de cortes e feridas comuns',
    steps: [
      { text: 'Lave bem as maos ou use luvas antes de tocar na ferida.' },
      { text: 'LAVE o ferimento com agua limpa abundante (agua corrente, soro fisiologico).' },
      { text: 'Remova sujeira visivel com pinça esterilizada (se superficial).' },
      { text: 'PARE o sangramento com pressao direta por 10-15 minutos.' },
      { text: 'Aplique antisseptico (iodo-povidona, clorexidina) ao redor (nao dentro) da ferida.' },
      { text: 'Cubra com gaze esteril ou pano limpo.' },
      { text: 'Troque o curativo diariamente ou se ficar umido/sujo.' },
      { text: 'PROCURE SOCORRO se: corte profundo (>2cm), nao para de sangrar, sujeira que nao sai, mordida animal.', warn: true },
      { text: 'SINAIS DE INFECCAO: vermelhidao crescente, calor, pus, febre, listras vermelhas saindo do ferimento.' },
    ]
  },
];

let _firstaidActiveCat = 'all';
let _firstaidActiveTriage = null;
let _firstaidCprInterval = null;
let _firstaidCprCount = 0;
let _firstaidCprRunning = false;

function firstaidInit() {
  firstaidRenderCards();
}

function firstaidRenderCards() {
  const container = document.getElementById('firstaidCards');
  if (!container) return;

  const search = (document.getElementById('firstaidSearch')?.value || '').toLowerCase();
  let procs = FIRSTAID_PROCEDURES;

  // Filter by category
  if (_firstaidActiveCat !== 'all') {
    procs = procs.filter(p => p.cat === _firstaidActiveCat);
  }

  // Filter by triage
  if (_firstaidActiveTriage) {
    procs = procs.filter(p => p.triage === _firstaidActiveTriage);
  }

  // Filter by search
  if (search.length >= 2) {
    procs = procs.filter(p =>
      p.title.toLowerCase().includes(search) ||
      p.summary.toLowerCase().includes(search) ||
      p.steps.some(s => s.text.toLowerCase().includes(search))
    );
  }

  if (procs.length === 0) {
    container.innerHTML = '<div class="firstaid-empty">Nenhum procedimento encontrado.</div>';
    return;
  }

  const triageLabels = { red: 'CRITICO', yellow: 'URGENTE', green: 'MENOR' };

  container.innerHTML = procs.map(p => `
    <div class="firstaid-card triage-border-${p.triage}" onclick="firstaidOpen('${p.id}')">
      <div class="firstaid-card-icon">${p.icon}</div>
      <div class="firstaid-card-body">
        <div class="firstaid-card-title">${escapeHtml(p.title)}</div>
        <div class="firstaid-card-summary">${escapeHtml(p.summary)}</div>
      </div>
      <div class="firstaid-card-triage triage-badge-${p.triage}">${triageLabels[p.triage]}</div>
    </div>
  `).join('');
}

function firstaidShowCat(cat) {
  _firstaidActiveCat = cat;
  _firstaidActiveTriage = null;

  // Update tab active state
  document.querySelectorAll('.firstaid-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.cat === cat);
  });
  // Reset triage buttons
  document.querySelectorAll('.firstaid-triage-btn').forEach(b => b.classList.remove('active'));

  firstaidRenderCards();
}

function firstaidShowTriage(level) {
  if (_firstaidActiveTriage === level) {
    _firstaidActiveTriage = null;
    document.querySelectorAll('.firstaid-triage-btn').forEach(b => b.classList.remove('active'));
  } else {
    _firstaidActiveTriage = level;
    document.querySelectorAll('.firstaid-triage-btn').forEach(b => {
      b.classList.toggle('active', b.classList.contains('triage-' + level));
    });
  }
  // Reset cat tabs
  _firstaidActiveCat = 'all';
  document.querySelectorAll('.firstaid-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.cat === 'all');
  });
  firstaidRenderCards();
}

function firstaidFilter(val) {
  firstaidRenderCards();
}

function firstaidOpen(id) {
  const proc = FIRSTAID_PROCEDURES.find(p => p.id === id);
  if (!proc) return;

  const detail = document.getElementById('firstaidDetail');
  const cards = document.getElementById('firstaidCards');
  const tabs = document.getElementById('firstaidTabs');
  const triage = document.getElementById('firstaidTriage');
  const search = document.querySelector('.firstaid-search-bar');

  cards.classList.add('hidden');
  tabs.classList.add('hidden');
  triage.classList.add('hidden');
  if (search) search.classList.add('hidden');
  detail.classList.remove('hidden');

  const triageLabels = { red: 'CRITICO', yellow: 'URGENTE', green: 'MENOR' };

  let html = `
    <div class="firstaid-detail-header">
      <span class="firstaid-detail-icon">${proc.icon}</span>
      <div>
        <h3 class="firstaid-detail-title">${escapeHtml(proc.title)}</h3>
        <span class="firstaid-detail-badge triage-badge-${proc.triage}">${triageLabels[proc.triage]}</span>
      </div>
    </div>
    <p class="firstaid-detail-summary">${escapeHtml(proc.summary)}</p>
    <div class="firstaid-steps">
  `;

  proc.steps.forEach((step, i) => {
    const warnClass = step.warn ? ' firstaid-step-warn' : '';
    const actionHtml = step.action === 'cpr_metro'
      ? ' <button class="firstaid-step-action" onclick="firstaidCprShow()">Abrir Metronomo</button>'
      : '';

    html += `
      <div class="firstaid-step${warnClass}">
        <div class="firstaid-step-num">${i + 1}</div>
        <div class="firstaid-step-text">${escapeHtml(step.text)}${actionHtml}</div>
      </div>
    `;
  });

  html += '</div>';

  // If cardiac category, add CPR quick-access
  if (proc.cat === 'cardiac') {
    html += `
      <div class="firstaid-cpr-quick">
        <button class="btn-sm btn-accent" onclick="firstaidCprShow()">
          \u{1F49F} Abrir Metronomo RCP (100-120 BPM)
        </button>
      </div>
    `;
  }

  document.getElementById('firstaidDetailContent').innerHTML = html;
}

function firstaidBack() {
  const detail = document.getElementById('firstaidDetail');
  const cards = document.getElementById('firstaidCards');
  const tabs = document.getElementById('firstaidTabs');
  const triage = document.getElementById('firstaidTriage');
  const search = document.querySelector('.firstaid-search-bar');

  detail.classList.add('hidden');
  cards.classList.remove('hidden');
  tabs.classList.remove('hidden');
  triage.classList.remove('hidden');
  if (search) search.classList.remove('hidden');

  firstaidCprClose();
}

// ─── CPR Metronome ────────────────────────────────────────────────────────────
function firstaidCprShow() {
  document.getElementById('firstaidCprMetro')?.classList.remove('hidden');
}

function firstaidCprClose() {
  firstaidCprStop();
  document.getElementById('firstaidCprMetro')?.classList.add('hidden');
  _firstaidCprCount = 0;
  const countEl = document.getElementById('firstaidCprCount');
  if (countEl) countEl.textContent = '0';
}

function firstaidCprToggle() {
  if (_firstaidCprRunning) {
    firstaidCprStop();
  } else {
    firstaidCprStart();
  }
}

function firstaidCprStart() {
  _firstaidCprRunning = true;
  const btn = document.getElementById('firstaidCprToggle');
  if (btn) btn.textContent = 'Parar';
  const indicator = document.getElementById('firstaidCprIndicator');

  // 110 BPM = ~545ms per beat (middle of 100-120 range)
  const bpm = 110;
  const interval = Math.round(60000 / bpm);

  _firstaidCprInterval = setInterval(() => {
    _firstaidCprCount++;
    const countEl = document.getElementById('firstaidCprCount');
    if (countEl) countEl.textContent = _firstaidCprCount;

    // Visual pulse
    if (indicator) {
      indicator.classList.add('pulse');
      setTimeout(() => indicator.classList.remove('pulse'), 200);
    }

    // Audio beep using Web Audio API
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      // Every 30 compressions, make a different sound for ventilation reminder
      if (_firstaidCprCount % 30 === 0) {
        osc.frequency.value = 880;  // Higher pitch
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.frequency.value = 440;
        gain.gain.value = 0.15;
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch (e) { /* no audio support */ }

  }, interval);
}

function firstaidCprStop() {
  _firstaidCprRunning = false;
  if (_firstaidCprInterval) {
    clearInterval(_firstaidCprInterval);
    _firstaidCprInterval = null;
  }
  const btn = document.getElementById('firstaidCprToggle');
  if (btn) btn.textContent = 'Iniciar';
}

function firstaidCprReset() {
  firstaidCprStop();
  _firstaidCprCount = 0;
  const countEl = document.getElementById('firstaidCprCount');
  if (countEl) countEl.textContent = '0';
}

// Exports
window.firstaidInit = firstaidInit;
window.firstaidShowCat = firstaidShowCat;
window.firstaidShowTriage = firstaidShowTriage;
window.firstaidFilter = firstaidFilter;
window.firstaidOpen = firstaidOpen;
window.firstaidBack = firstaidBack;
window.firstaidCprShow = firstaidCprShow;
window.firstaidCprClose = firstaidCprClose;
window.firstaidCprToggle = firstaidCprToggle;
window.firstaidCprReset = firstaidCprReset;

// ═══════════════════════════════════════════════════════════════════════════════
// ██████  Crypto App — Criptografia Offline  ██████
// ═══════════════════════════════════════════════════════════════════════════════

let _cryptoHashAlgo = 'SHA-256';

function cryptoInit() {
  // Attach password strength listener
  const keyInput = document.getElementById('cryptoAesKey');
  if (keyInput) keyInput.addEventListener('input', () => cryptoUpdateStrength(keyInput.value));
  cryptoSetStatus('Pronto — todos os metodos funcionam 100% offline');
}

// ── Tab switching ──
function cryptoSwitchTab(method) {
  document.querySelectorAll('#cryptoTabs .crypto-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.method === method);
  });
  document.querySelectorAll('.crypto-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById('cryptoPanel-' + method);
  if (panel) panel.classList.remove('hidden');
}

// ── Status bar ──
function cryptoSetStatus(msg) {
  const el = document.getElementById('cryptoStatus');
  if (el) el.textContent = msg;
}

// ── Utility: copy to clipboard ──
function cryptoCopy(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const text = el.value !== undefined ? el.value : el.textContent;
  if (!text) { cryptoSetStatus('Nada para copiar'); return; }
  navigator.clipboard.writeText(text).then(
    () => cryptoSetStatus('Copiado para area de transferencia'),
    () => {
      // Fallback for insecure context
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); cryptoSetStatus('Copiado!'); }
      catch { cryptoSetStatus('Erro ao copiar'); }
      document.body.removeChild(ta);
    }
  );
}

// ── Swap output -> input ──
function cryptoSwap(inputId, outputId) {
  const inp = document.getElementById(inputId);
  const out = document.getElementById(outputId);
  if (inp && out) {
    inp.value = out.value || out.textContent || '';
    out.value = '';
    cryptoSetStatus('Resultado movido para entrada');
  }
}

// ── Toggle password visibility ──
function cryptoTogglePassword(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
}

// ── Password strength indicator ──
function cryptoUpdateStrength(pwd) {
  const fill = document.getElementById('cryptoStrengthFill');
  const label = document.getElementById('cryptoStrengthLabel');
  if (!fill || !label) return;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (pwd.length >= 16) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  const pct = Math.min(100, (score / 6) * 100);
  const colors = ['#ff1a47', '#ff1a47', '#ff8c00', '#ff8c00', '#ffc800', '#39ff14', '#39ff14'];
  const labels = ['', 'Muito fraca', 'Fraca', 'Razoavel', 'Boa', 'Forte', 'Excelente'];
  fill.style.width = pct + '%';
  fill.style.background = colors[score] || '#ff1a47';
  label.textContent = pwd ? labels[score] || '' : '';
  label.style.color = colors[score] || '';
}

// ── Generate strong password ──
function cryptoGenPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:,.<>?';
  const arr = new Uint32Array(24);
  crypto.getRandomValues(arr);
  const pwd = Array.from(arr).map(v => chars[v % chars.length]).join('');
  const el = document.getElementById('cryptoAesKey');
  if (el) { el.value = pwd; el.type = 'text'; cryptoUpdateStrength(pwd); }
  cryptoSetStatus('Senha de 24 caracteres gerada aleatoriamente');
}

// ═══════════════════════════════════════════════════
// AES-256-GCM  (Web Crypto API)
// ═══════════════════════════════════════════════════

async function _cryptoDeriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function _bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function _hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes;
}

async function cryptoAesEncrypt() {
  const key = document.getElementById('cryptoAesKey')?.value;
  const msg = document.getElementById('cryptoAesInput')?.value;
  const out = document.getElementById('cryptoAesOutput');
  if (!key) { cryptoSetStatus('Erro: insira uma senha'); return; }
  if (!msg) { cryptoSetStatus('Erro: insira uma mensagem'); return; }
  try {
    cryptoSetStatus('Cifrando com AES-256-GCM...');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aesKey = await _cryptoDeriveKey(key, salt);
    const enc = new TextEncoder();
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(msg));
    // Format: salt(32hex) + iv(24hex) + ciphertext(hex)
    const result = _bufToHex(salt) + _bufToHex(iv) + _bufToHex(cipherBuf);
    if (out) out.value = result;
    cryptoSetStatus('Cifrado com sucesso — ' + result.length + ' caracteres hex');
  } catch (e) {
    cryptoSetStatus('Erro na cifragem: ' + e.message);
  }
}

async function cryptoAesDecrypt() {
  const key = document.getElementById('cryptoAesKey')?.value;
  const msg = document.getElementById('cryptoAesInput')?.value?.trim();
  const out = document.getElementById('cryptoAesOutput');
  if (!key) { cryptoSetStatus('Erro: insira a senha'); return; }
  if (!msg) { cryptoSetStatus('Erro: insira o texto cifrado'); return; }
  try {
    cryptoSetStatus('Decifrando...');
    if (msg.length < 72 || !/^[0-9a-fA-F]+$/.test(msg)) {
      cryptoSetStatus('Erro: texto cifrado invalido (deve ser hex)');
      return;
    }
    const salt = _hexToBuf(msg.slice(0, 32));
    const iv = _hexToBuf(msg.slice(32, 56));
    const cipherBytes = _hexToBuf(msg.slice(56));
    const aesKey = await _cryptoDeriveKey(key, salt);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipherBytes);
    const dec = new TextDecoder();
    if (out) out.value = dec.decode(plainBuf);
    cryptoSetStatus('Decifrado com sucesso');
  } catch (e) {
    cryptoSetStatus('Erro na decifragem — senha incorreta ou dados corrompidos');
  }
}

// ═══════════════════════════════════════════════════
// Caesar Cipher
// ═══════════════════════════════════════════════════

function _caesarShift(text, shift) {
  return text.split('').map(ch => {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    return ch;
  }).join('');
}

function cryptoCaesarRun(direction) {
  const shift = parseInt(document.getElementById('cryptoCaesarShift')?.value) || 13;
  const msg = document.getElementById('cryptoCaesarInput')?.value;
  const out = document.getElementById('cryptoCaesarOutput');
  if (!msg) { cryptoSetStatus('Erro: insira uma mensagem'); return; }
  const result = _caesarShift(msg, shift * direction);
  if (out) { out.textContent = result; }
  cryptoSetStatus('Caesar ' + (direction > 0 ? 'cifrado' : 'decifrado') + ' com deslocamento ' + shift);
}

function cryptoCaesarBrute() {
  const msg = document.getElementById('cryptoCaesarInput')?.value;
  const out = document.getElementById('cryptoCaesarOutput');
  if (!msg) { cryptoSetStatus('Erro: insira o texto cifrado'); return; }
  let lines = [];
  for (let s = 1; s <= 25; s++) {
    lines.push('ROT-' + String(s).padStart(2, '0') + ': ' + _caesarShift(msg, -s));
  }
  if (out) out.textContent = lines.join('\n');
  cryptoSetStatus('Forca bruta: 25 variantes geradas');
}

// ═══════════════════════════════════════════════════
// Vigenere Cipher
// ═══════════════════════════════════════════════════

function cryptoVigenereRun(mode) {
  const key = document.getElementById('cryptoVigKey')?.value?.toUpperCase().replace(/[^A-Z]/g, '');
  const msg = document.getElementById('cryptoVigInput')?.value;
  const out = document.getElementById('cryptoVigOutput');
  if (!key) { cryptoSetStatus('Erro: insira uma palavra-chave (somente letras)'); return; }
  if (!msg) { cryptoSetStatus('Erro: insira uma mensagem'); return; }

  let result = '';
  let ki = 0;
  for (const ch of msg) {
    const code = ch.charCodeAt(0);
    const shift = key.charCodeAt(ki % key.length) - 65;
    if (code >= 65 && code <= 90) {
      result += String.fromCharCode(((code - 65 + (mode === 'encrypt' ? shift : 26 - shift)) % 26) + 65);
      ki++;
    } else if (code >= 97 && code <= 122) {
      result += String.fromCharCode(((code - 97 + (mode === 'encrypt' ? shift : 26 - shift)) % 26) + 97);
      ki++;
    } else {
      result += ch;
    }
  }
  if (out) out.value = result;
  cryptoSetStatus('Vigenere ' + (mode === 'encrypt' ? 'cifrado' : 'decifrado') + ' com chave "' + key + '"');
}

// ═══════════════════════════════════════════════════
// One-Time Pad (XOR)
// ═══════════════════════════════════════════════════

function cryptoOtpGenKey() {
  const msg = document.getElementById('cryptoOtpInput')?.value || '';
  const len = Math.max(msg.length, 16);
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  const key = Array.from(arr).map(b => b.toString(16).padStart(2, '')).join('').slice(0, len * 2);
  // Generate readable random chars
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const readable = Array.from(crypto.getRandomValues(new Uint8Array(len))).map(b => chars[b % chars.length]).join('');
  const keyEl = document.getElementById('cryptoOtpKey');
  if (keyEl) keyEl.value = readable;
  cryptoSetStatus('Chave OTP gerada: ' + len + ' caracteres');
}

function cryptoOtpAutoKey() {
  // No auto-gen, just update status
}

function cryptoOtpRun(mode) {
  const msg = document.getElementById('cryptoOtpInput')?.value;
  const key = document.getElementById('cryptoOtpKey')?.value;
  const out = document.getElementById('cryptoOtpOutput');
  if (!msg) { cryptoSetStatus('Erro: insira a mensagem'); return; }
  if (!key) { cryptoSetStatus('Erro: insira ou gere uma chave'); return; }

  if (mode === 'encrypt') {
    // XOR each char with key char, output hex
    let hex = '';
    for (let i = 0; i < msg.length; i++) {
      const mc = msg.charCodeAt(i);
      const kc = key.charCodeAt(i % key.length);
      hex += (mc ^ kc).toString(16).padStart(2, '0');
    }
    if (out) out.value = hex;
    if (key.length < msg.length) {
      cryptoSetStatus('AVISO: chave menor que mensagem — seguranca reduzida! Cifrado em hex.');
    } else {
      cryptoSetStatus('OTP cifrado — ' + hex.length / 2 + ' bytes. Guarde a chave com seguranca!');
    }
  } else {
    // Decrypt: input is hex
    const cleanMsg = msg.replace(/\s/g, '');
    if (!/^[0-9a-fA-F]+$/.test(cleanMsg)) {
      cryptoSetStatus('Erro: para decifrar, a entrada deve ser hex');
      return;
    }
    let text = '';
    for (let i = 0; i < cleanMsg.length; i += 2) {
      const byte = parseInt(cleanMsg.substr(i, 2), 16);
      const kc = key.charCodeAt((i / 2) % key.length);
      text += String.fromCharCode(byte ^ kc);
    }
    if (out) out.value = text;
    cryptoSetStatus('OTP decifrado — ' + text.length + ' caracteres');
  }
}

// ═══════════════════════════════════════════════════
// SHA Hash (Web Crypto API)
// ═══════════════════════════════════════════════════

function cryptoHashAlgo(btn, algo) {
  _cryptoHashAlgo = algo;
  document.querySelectorAll('.crypto-hash-algos .crypto-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.algo === algo);
  });
}

async function cryptoHashRun() {
  const msg = document.getElementById('cryptoHashInput')?.value;
  const out = document.getElementById('cryptoHashOutput');
  if (!msg) { cryptoSetStatus('Erro: insira um texto'); return; }
  try {
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest(_cryptoHashAlgo, enc.encode(msg));
    const hex = _bufToHex(hashBuf);
    if (out) out.value = hex;
    cryptoSetStatus(_cryptoHashAlgo + ': ' + hex.length + ' caracteres hex (' + (hex.length * 4) + ' bits)');
    cryptoHashVerify();
  } catch (e) {
    cryptoSetStatus('Erro ao calcular hash: ' + e.message);
  }
}

function cryptoHashVerify() {
  const hash = document.getElementById('cryptoHashOutput')?.value?.trim().toLowerCase();
  const compare = document.getElementById('cryptoHashCompare')?.value?.trim().toLowerCase();
  const match = document.getElementById('cryptoHashMatch');
  if (!match) return;
  if (!hash || !compare) { match.textContent = ''; match.className = 'crypto-hash-match'; return; }
  if (hash === compare) {
    match.textContent = 'IDENTICO';
    match.className = 'crypto-hash-match match';
  } else {
    match.textContent = 'DIFERENTE';
    match.className = 'crypto-hash-match no-match';
  }
}

// ═══════════════════════════════════════════════════
// Base64
// ═══════════════════════════════════════════════════

function cryptoB64Run(mode) {
  const msg = document.getElementById('cryptoB64Input')?.value;
  const out = document.getElementById('cryptoB64Output');
  if (!msg) { cryptoSetStatus('Erro: insira um texto'); return; }
  try {
    if (mode === 'encode') {
      // Handle Unicode properly
      const encoded = btoa(unescape(encodeURIComponent(msg)));
      if (out) out.value = encoded;
      cryptoSetStatus('Base64 codificado — ' + encoded.length + ' caracteres');
    } else {
      const decoded = decodeURIComponent(escape(atob(msg.trim())));
      if (out) out.value = decoded;
      cryptoSetStatus('Base64 decodificado — ' + decoded.length + ' caracteres');
    }
  } catch (e) {
    cryptoSetStatus('Erro: ' + (mode === 'decode' ? 'texto Base64 invalido' : e.message));
  }
}

// ── Exports ──
window.cryptoInit = cryptoInit;
window.cryptoSwitchTab = cryptoSwitchTab;
window.cryptoAesEncrypt = cryptoAesEncrypt;
window.cryptoAesDecrypt = cryptoAesDecrypt;
window.cryptoCaesarRun = cryptoCaesarRun;
window.cryptoCaesarBrute = cryptoCaesarBrute;
window.cryptoVigenereRun = cryptoVigenereRun;
window.cryptoOtpGenKey = cryptoOtpGenKey;
window.cryptoOtpAutoKey = cryptoOtpAutoKey;
window.cryptoOtpRun = cryptoOtpRun;
window.cryptoHashAlgo = cryptoHashAlgo;
window.cryptoHashRun = cryptoHashRun;
window.cryptoHashVerify = cryptoHashVerify;
window.cryptoB64Run = cryptoB64Run;
window.cryptoCopy = cryptoCopy;
window.cryptoSwap = cryptoSwap;
window.cryptoTogglePassword = cryptoTogglePassword;
window.cryptoGenPassword = cryptoGenPassword;
window.cryptoSetStatus = cryptoSetStatus;


// ═══════════════════════════════════════════════════════════════════════════════
// ═══ RATIONS CALCULATOR ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

let _rationsStock = [];
const RATIONS_STORAGE_KEY = 'bunker_rations_data';

// ── Calorie tables (OMS/FEMA averages per activity level) ──
const RATIONS_KCAL = {
  // average of male/female per profile
  adult:   { sedentary: 1650, light: 2000, moderate: 2400, heavy: 2900 },
  kid:     { sedentary: 1200, light: 1500, moderate: 1800, heavy: 2000 },
  baby:    { sedentary: 800,  light: 900,  moderate: 1000, heavy: 1100 },
  elderly: { sedentary: 1500, light: 1700, moderate: 2000, heavy: 2400 },
};

// ── Water needs per person per day (liters) by climate ──
const RATIONS_WATER = {
  cold:      { sedentary: 1.5, light: 2.0, moderate: 2.5, heavy: 3.0 },
  temperate: { sedentary: 2.0, light: 2.5, moderate: 3.0, heavy: 3.5 },
  hot:       { sedentary: 3.0, light: 3.5, moderate: 4.5, heavy: 5.5 },
  extreme:   { sedentary: 4.0, light: 5.0, moderate: 6.0, heavy: 7.0 },
};

// ── Rationing multipliers ──
const RATIONS_MODE = {
  normal: 1.0,
  rationed: 0.75,
  emergency: 0.50,
  starvation: 0.33,
};

// ── Quick-add presets (name, qty, unit, kcal_per_unit, type) ──
const RATIONS_PRESETS = {
  water5:   { name: 'Galao de Agua 5L',    qty: 5,    unit: 'L',      kcal: 0,    type: 'water' },
  water20:  { name: 'Galao de Agua 20L',   qty: 20,   unit: 'L',      kcal: 0,    type: 'water' },
  rice5:    { name: 'Arroz 5kg',            qty: 5,    unit: 'kg',     kcal: 3600, type: 'food'  },
  beans2:   { name: 'Feijao 2kg',           qty: 2,    unit: 'kg',     kcal: 3400, type: 'food'  },
  canned:   { name: 'Lata de Conserva',     qty: 1,    unit: 'lata',   kcal: 250,  type: 'food'  },
  crackers: { name: 'Pacote Biscoitos',     qty: 1,    unit: 'pacote', kcal: 600,  type: 'food'  },
  mre:      { name: 'MRE / Ration Pack',   qty: 1,    unit: 'un',     kcal: 1200, type: 'food'  },
};

function rationsInit() {
  // Load persisted data
  try {
    const saved = localStorage.getItem(RATIONS_STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      _rationsStock = data.stock || [];
      // Restore form values
      if (data.form) {
        const fields = ['rationsAdults','rationsKids','rationsBabies','rationsElderly',
                        'rationsActivity','rationsClimate','rationsMode','rationsDays'];
        fields.forEach(f => {
          const el = document.getElementById(f);
          if (el && data.form[f] !== undefined) el.value = data.form[f];
        });
      }
    }
  } catch(e) { console.warn('Rations load failed:', e); }

  rationsRenderStock();
  rationsCalc();
  rationsSetStatus('Calculadora de racoes iniciada');
}

function rationsSave() {
  try {
    const form = {};
    ['rationsAdults','rationsKids','rationsBabies','rationsElderly',
     'rationsActivity','rationsClimate','rationsMode','rationsDays'].forEach(f => {
      const el = document.getElementById(f);
      if (el) form[f] = el.value;
    });
    localStorage.setItem(RATIONS_STORAGE_KEY, JSON.stringify({ stock: _rationsStock, form }));
    const el = document.getElementById('rationsLastSaved');
    if (el) el.textContent = 'Salvo ' + new Date().toLocaleTimeString();
  } catch(e) {}
}

function rationsTab(tabId) {
  document.querySelectorAll('.rations-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.rations-panel').forEach(p => p.classList.add('hidden'));
  const tabEl = document.getElementById('rationsTab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
  const panelEl = document.getElementById('rationsPanel-' + tabId);
  if (tabEl) tabEl.classList.add('active');
  if (panelEl) panelEl.classList.remove('hidden');

  if (tabId === 'result') rationsRenderResult();
}

function rationsCalc() {
  const adults  = parseInt(document.getElementById('rationsAdults')?.value) || 0;
  const kids    = parseInt(document.getElementById('rationsKids')?.value) || 0;
  const babies  = parseInt(document.getElementById('rationsBabies')?.value) || 0;
  const elderly = parseInt(document.getElementById('rationsElderly')?.value) || 0;
  const activity = document.getElementById('rationsActivity')?.value || 'light';
  const climate  = document.getElementById('rationsClimate')?.value || 'temperate';
  const mode     = document.getElementById('rationsMode')?.value || 'normal';
  const days     = parseInt(document.getElementById('rationsDays')?.value) || 7;

  const totalPeople = adults + kids + babies + elderly;
  const modeMultiplier = RATIONS_MODE[mode] || 1;

  // Calculate daily kcal need
  const dailyKcal = Math.round((
    adults  * RATIONS_KCAL.adult[activity] +
    kids    * RATIONS_KCAL.kid[activity] +
    babies  * RATIONS_KCAL.baby[activity] +
    elderly * RATIONS_KCAL.elderly[activity]
  ) * modeMultiplier);

  // Calculate daily water need (liters)
  const waterPerPerson = RATIONS_WATER[climate]?.[activity] || 2.5;
  // Kids/babies need less water
  const dailyWater = parseFloat((
    (adults + elderly) * waterPerPerson +
    kids * waterPerPerson * 0.7 +
    babies * waterPerPerson * 0.4
  ).toFixed(1)) * modeMultiplier;

  // Update live summary
  const elPeople = document.getElementById('rationsTotalPeople');
  const elKcal   = document.getElementById('rationsTotalKcal');
  const elWater  = document.getElementById('rationsTotalWater');
  const elDays   = document.getElementById('rationsTargetDays');
  if (elPeople) elPeople.textContent = totalPeople;
  if (elKcal)   elKcal.textContent = dailyKcal.toLocaleString();
  if (elWater)  elWater.textContent = dailyWater.toFixed(1);
  if (elDays)   elDays.textContent = days;

  // Update stock totals
  rationsRenderStockTotals();
  rationsSave();
}

function rationsGetNeeds() {
  const adults  = parseInt(document.getElementById('rationsAdults')?.value) || 0;
  const kids    = parseInt(document.getElementById('rationsKids')?.value) || 0;
  const babies  = parseInt(document.getElementById('rationsBabies')?.value) || 0;
  const elderly = parseInt(document.getElementById('rationsElderly')?.value) || 0;
  const activity = document.getElementById('rationsActivity')?.value || 'light';
  const climate  = document.getElementById('rationsClimate')?.value || 'temperate';
  const mode     = document.getElementById('rationsMode')?.value || 'normal';
  const days     = parseInt(document.getElementById('rationsDays')?.value) || 7;

  const totalPeople = adults + kids + babies + elderly;
  const modeMultiplier = RATIONS_MODE[mode] || 1;

  const dailyKcal = Math.round((
    adults  * RATIONS_KCAL.adult[activity] +
    kids    * RATIONS_KCAL.kid[activity] +
    babies  * RATIONS_KCAL.baby[activity] +
    elderly * RATIONS_KCAL.elderly[activity]
  ) * modeMultiplier);

  const waterPerPerson = RATIONS_WATER[climate]?.[activity] || 2.5;
  const dailyWater = parseFloat((
    (adults + elderly) * waterPerPerson +
    kids * waterPerPerson * 0.7 +
    babies * waterPerPerson * 0.4
  ).toFixed(1)) * modeMultiplier;

  // Total stock
  let totalStockKcal = 0;
  let totalStockWater = 0;
  for (const item of _rationsStock) {
    if (item.type === 'water') {
      totalStockWater += item.qty;
    } else {
      totalStockKcal += item.qty * item.kcal;
    }
  }

  return {
    totalPeople, adults, kids, babies, elderly,
    activity, climate, mode, days, modeMultiplier,
    dailyKcal, dailyWater,
    totalStockKcal, totalStockWater,
    foodDays: dailyKcal > 0 ? totalStockKcal / dailyKcal : 0,
    waterDays: dailyWater > 0 ? totalStockWater / dailyWater : 0,
    neededKcal: dailyKcal * days,
    neededWater: dailyWater * days,
  };
}

function rationsQuickAdd(presetId) {
  const preset = RATIONS_PRESETS[presetId];
  if (!preset) return;
  _rationsStock.push({ ...preset, id: Date.now() + Math.random() });
  rationsRenderStock();
  rationsCalc();
  rationsSetStatus('Adicionado: ' + preset.name);
}

function rationsAddItem() {
  const name = document.getElementById('rationsNewName')?.value?.trim();
  if (!name) { rationsSetStatus('Digite o nome do item'); return; }
  const qty  = parseFloat(document.getElementById('rationsNewQty')?.value) || 1;
  const unit = document.getElementById('rationsNewUnit')?.value || 'un';
  const kcal = parseInt(document.getElementById('rationsNewKcal')?.value) || 0;
  const type = document.getElementById('rationsNewType')?.value || 'food';

  _rationsStock.push({ id: Date.now() + Math.random(), name, qty, unit, kcal, type });
  document.getElementById('rationsNewName').value = '';
  rationsRenderStock();
  rationsCalc();
  rationsSetStatus('Adicionado: ' + name);
}

function rationsDeleteItem(id) {
  _rationsStock = _rationsStock.filter(i => i.id !== id);
  rationsRenderStock();
  rationsCalc();
  rationsSetStatus('Item removido');
}

function rationsRenderStock() {
  const list = document.getElementById('rationsStockList');
  if (!list) return;

  if (_rationsStock.length === 0) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">Nenhum suprimento adicionado. Use os botoes acima ou adicione manualmente.</div>';
    return;
  }

  list.innerHTML = _rationsStock.map(item => `
    <div class="rations-stock-row">
      <span class="stock-name">${escapeHtml(item.name)}</span>
      <span class="stock-qty">${item.qty}</span>
      <span class="stock-unit">${escapeHtml(item.unit)}</span>
      <span class="stock-kcal">${item.type === 'water' ? '--' : (item.qty * item.kcal).toLocaleString()}</span>
      <span class="stock-type"><span class="stock-type-badge ${item.type}">${item.type === 'water' ? 'Agua' : 'Comida'}</span></span>
      <button class="rations-stock-del" onclick="rationsDeleteItem(${item.id})" title="Remover">&times;</button>
    </div>
  `).join('');
}

function rationsRenderStockTotals() {
  const el = document.getElementById('rationsStockTotals');
  if (!el) return;

  let totalKcal = 0, totalWater = 0, totalItems = _rationsStock.length;
  for (const item of _rationsStock) {
    if (item.type === 'water') totalWater += item.qty;
    else totalKcal += item.qty * item.kcal;
  }

  el.innerHTML = `
    <div class="rations-total-card">
      <span class="rations-total-label">Total Itens</span>
      <span class="rations-total-value" style="color:var(--text-bright)">${totalItems}</span>
    </div>
    <div class="rations-total-card">
      <span class="rations-total-label">Total kcal</span>
      <span class="rations-total-value" style="color:var(--amber)">${totalKcal.toLocaleString()}</span>
    </div>
    <div class="rations-total-card">
      <span class="rations-total-label">Total Agua (L)</span>
      <span class="rations-total-value" style="color:var(--accent)">${totalWater.toFixed(1)}</span>
    </div>
  `;
}

function rationsRenderResult() {
  const el = document.getElementById('rationsResultContent');
  if (!el) return;

  const n = rationsGetNeeds();

  if (n.totalPeople === 0) {
    el.innerHTML = '<div class="rations-empty">Configure o numero de pessoas na aba "Grupo & Perfil".</div>';
    return;
  }

  if (_rationsStock.length === 0) {
    el.innerHTML = '<div class="rations-empty">Adicione suprimentos na aba "Estoque" para ver os resultados.</div>';
    return;
  }

  const foodPct  = n.neededKcal > 0 ? Math.min(100, (n.totalStockKcal / n.neededKcal) * 100) : 0;
  const waterPct = n.neededWater > 0 ? Math.min(100, (n.totalStockWater / n.neededWater) * 100) : 0;

  const foodStatus  = n.foodDays >= n.days ? 'ok' : n.foodDays >= n.days * 0.5 ? 'warning' : 'critical';
  const waterStatus = n.waterDays >= n.days ? 'ok' : n.waterDays >= n.days * 0.5 ? 'warning' : 'critical';

  const foodBarColor  = foodStatus === 'ok' ? 'green' : foodStatus === 'warning' ? 'amber' : 'red';
  const waterBarColor = waterStatus === 'ok' ? 'green' : waterStatus === 'warning' ? 'amber' : 'red';

  const modeLabels = { normal: 'Normal (100%)', rationed: 'Racionado (75%)', emergency: 'Emergencia (50%)', starvation: 'Sobrevivencia (33%)' };

  let html = `
    <div style="margin-bottom:10px;font-size:11px;color:var(--text-muted)">
      ${n.totalPeople} pessoas &middot; ${modeLabels[n.mode]} &middot; Meta: ${n.days} dias
    </div>

    <div class="rations-result-grid">
      <div class="rations-result-card ${foodStatus}">
        <span class="rations-result-icon">🍚</span>
        <span class="rations-result-val">${n.foodDays.toFixed(1)}</span>
        <span class="rations-result-label">Dias de Comida</span>
        <span class="rations-result-sublabel">${n.totalStockKcal.toLocaleString()} kcal no estoque</span>
      </div>
      <div class="rations-result-card ${waterStatus}">
        <span class="rations-result-icon">💧</span>
        <span class="rations-result-val">${n.waterDays.toFixed(1)}</span>
        <span class="rations-result-label">Dias de Agua</span>
        <span class="rations-result-sublabel">${n.totalStockWater.toFixed(1)} L no estoque</span>
      </div>
      <div class="rations-result-card ${foodStatus}">
        <span class="rations-result-icon">🔥</span>
        <span class="rations-result-val">${n.dailyKcal.toLocaleString()}</span>
        <span class="rations-result-label">kcal/dia (grupo)</span>
        <span class="rations-result-sublabel">Precisa: ${n.neededKcal.toLocaleString()} kcal total</span>
      </div>
      <div class="rations-result-card ${waterStatus}">
        <span class="rations-result-icon">🚰</span>
        <span class="rations-result-val">${n.dailyWater.toFixed(1)}</span>
        <span class="rations-result-label">Litros/dia (grupo)</span>
        <span class="rations-result-sublabel">Precisa: ${n.neededWater.toFixed(1)} L total</span>
      </div>
    </div>

    <div class="rations-progress">
      <div class="rations-progress-label">
        <span>Comida: ${n.totalStockKcal.toLocaleString()} / ${n.neededKcal.toLocaleString()} kcal</span>
        <span>${foodPct.toFixed(0)}%</span>
      </div>
      <div class="rations-progress-bar">
        <div class="rations-progress-fill ${foodBarColor}" style="width:${foodPct}%">
          ${foodPct > 15 ? `<span class="rations-progress-text">${foodPct.toFixed(0)}%</span>` : ''}
        </div>
      </div>
    </div>

    <div class="rations-progress">
      <div class="rations-progress-label">
        <span>Agua: ${n.totalStockWater.toFixed(1)} / ${n.neededWater.toFixed(1)} L</span>
        <span>${waterPct.toFixed(0)}%</span>
      </div>
      <div class="rations-progress-bar">
        <div class="rations-progress-fill ${waterBarColor}" style="width:${waterPct}%">
          ${waterPct > 15 ? `<span class="rations-progress-text">${waterPct.toFixed(0)}%</span>` : ''}
        </div>
      </div>
    </div>
  `;

  // Warnings & tips
  const warnings = [];

  if (n.waterDays < 3) {
    warnings.push({ level: 'critical', icon: '⚠️', msg: `CRITICO: Agua dura apenas ${n.waterDays.toFixed(1)} dias. Desidratacao e fatal em 3 dias!` });
  } else if (n.waterDays < n.days) {
    warnings.push({ level: 'warning', icon: '⚡', msg: `Agua insuficiente para ${n.days} dias. Faltam ${(n.neededWater - n.totalStockWater).toFixed(1)} L.` });
  }

  if (n.foodDays < 7) {
    warnings.push({ level: 'critical', icon: '⚠️', msg: `Comida dura apenas ${n.foodDays.toFixed(1)} dias. Corpo entra em catabolismo apos 1 semana.` });
  } else if (n.foodDays < n.days) {
    warnings.push({ level: 'warning', icon: '⚡', msg: `Comida insuficiente para ${n.days} dias. Faltam ${(n.neededKcal - n.totalStockKcal).toLocaleString()} kcal.` });
  }

  if (n.mode === 'starvation') {
    warnings.push({ level: 'warning', icon: '💀', msg: 'Modo sobrevivencia (33%): risco de fraqueza extrema, confusao mental e hipotermia.' });
  }

  if (n.babies > 0 && n.mode !== 'normal') {
    warnings.push({ level: 'critical', icon: '👶', msg: 'BEBES nao devem ser racionados! Mantenha alimentacao normal para criancas pequenas.' });
  }

  if (n.foodDays >= n.days && n.waterDays >= n.days) {
    warnings.push({ level: 'tip', icon: '✅', msg: `Suprimentos suficientes para ${n.days} dias. Considere estocar para ${Math.ceil(n.days * 1.5)} dias como margem de seguranca.` });
  }

  // Suggestion: next ration mode
  if (n.foodDays < n.days && n.mode === 'normal') {
    const rationedDays = (n.totalStockKcal / (n.dailyKcal / RATIONS_MODE.normal * RATIONS_MODE.rationed)).toFixed(1);
    warnings.push({ level: 'tip', icon: '💡', msg: `Dica: no modo racionado (75%), comida duraria ~${rationedDays} dias.` });
  }

  if (warnings.length > 0) {
    html += '<div class="rations-warnings">';
    for (const w of warnings) {
      html += `<div class="rations-warning-item ${w.level}">${w.icon} ${w.msg}</div>`;
    }
    html += '</div>';
  }

  el.innerHTML = html;
}

function rationsSetStatus(msg) {
  const el = document.getElementById('rationsStatus');
  if (el) el.textContent = msg;
}

// ── Exports ──
window.rationsInit = rationsInit;
window.rationsTab = rationsTab;
window.rationsCalc = rationsCalc;
window.rationsQuickAdd = rationsQuickAdd;
window.rationsAddItem = rationsAddItem;
window.rationsDeleteItem = rationsDeleteItem;


// ═══════════════════════════════════════════════════════════════════════════════
// ═══ PLANTS GUIDE — Edible, Medicinal & Toxic Plant Identification ══════════
// ═══════════════════════════════════════════════════════════════════════════════

const PLANTS_DB = [
  // ── EDIBLE ──
  {
    id: 'dandel', name: 'Dente-de-leão', latin: 'Taraxacum officinale', type: 'dual',
    icon: '🌼', biome: ['temperado', 'subtropical', 'urbano'],
    edibleParts: ['Folhas', 'Flores', 'Raízes'],
    description: 'Planta extremamente comum em todo o mundo, encontrada em gramados, terrenos baldios e beiras de estrada. Todas as partes são comestíveis.',
    identification: [
      'Folhas dentadas em roseta basal (10-25 cm)',
      'Flor amarela solitária em haste oca',
      'Ao cortar, exsuda látex branco leitoso',
      'Fruto: "paraquedas" brancos (aquênios)',
      'Raiz pivotante profunda, marrom por fora, branca por dentro'
    ],
    preparation: 'Folhas jovens em salada (menos amargas). Flores podem ser fritas em massa. Raízes secas e torradas fazem substituto de café. Ferver folhas maduras 5min reduz amargor.',
    medicinal: 'Diurético natural (chá da raiz). Rico em potássio, vitaminas A, C e K. Auxilia digestão e função hepática.',
    warnings: 'Evitar colher perto de estradas (metais pesados) ou áreas com agrotóxicos. Pode causar reação alérgica em pessoas sensíveis a Asteraceae.',
    nutrition: { kcal: 45, protein: 2.7, vitC: 35, fiber: 3.5 },
    season: 'Primavera a outono (folhas). Flores na primavera.',
    confusion: 'Pode ser confundida com chicória (Cichorium) — ambas comestíveis. Cuidado com Hypochaeris radicata (também comestível, mas menos nutritiva).'
  },
  {
    id: 'nettle', name: 'Urtiga', latin: 'Urtica dioica', type: 'dual',
    icon: '🌿', biome: ['temperado', 'subtropical', 'floresta'],
    edibleParts: ['Folhas jovens', 'Brotos'],
    description: 'Planta com pelos urticantes que causam ardência ao toque. Após cozimento, perde completamente o efeito urticante e se torna altamente nutritiva.',
    identification: [
      'Folhas opostas, serrilhadas, cobertas de pelos finos',
      'Caule quadrangular com pelos urticantes',
      'Altura: 30-150 cm',
      'Flores pequenas esverdeadas em cachos pendentes',
      'Cresce em solos ricos e úmidos'
    ],
    preparation: 'SEMPRE cozinhar ou secar antes de consumir — elimina os tricomas urticantes. Ferver 3-5 min para sopa ou chá. Pode ser usada como espinafre. Secar para chá.',
    medicinal: 'Anti-inflamatório. Chá usado para alergias, artrite e anemia. Rica em ferro e cálcio. Historicamente usada para estimular circulação.',
    warnings: 'NUNCA comer crua — os pelos urticantes causam dor intensa. Usar luvas para colher. Após cozimento é 100% segura.',
    nutrition: { kcal: 42, protein: 2.4, vitC: 33, fiber: 6.9 },
    season: 'Primavera (brotos jovens são os melhores). Evitar após floração.',
    confusion: 'Urtiga-branca (Lamium album) não tem pelos urticantes e também é comestível.'
  },
  {
    id: 'plantago', name: 'Tanchagem', latin: 'Plantago major', type: 'dual',
    icon: '🍃', biome: ['temperado', 'tropical', 'urbano', 'subtropical'],
    edibleParts: ['Folhas jovens', 'Sementes'],
    description: 'Uma das plantas medicinais mais úteis em sobrevivência. Encontrada em quase todos os lugares do mundo, especialmente em áreas pisoteadas.',
    identification: [
      'Roseta basal de folhas ovais largas (5-15 cm)',
      'Nervuras paralelas proeminentes (3-7)',
      'Espiga floral longa e fina (10-30 cm)',
      'Folhas resistentes, difíceis de rasgar',
      'Cresce em solos compactados, trilhas, calçadas'
    ],
    preparation: 'Folhas jovens em salada ou cozidas como espinafre. Sementes moídas como farinha. Folhas maduras são fibrosas — picar fino e cozinhar.',
    medicinal: 'ANTÍDOTO DE CAMPO: esmagar folha fresca e aplicar sobre picadas de inseto, urticária, pequenos cortes — reduz inflamação e dor rapidamente. Chá para tosse e bronquite. Antibacteriano natural.',
    warnings: 'Sem toxicidade conhecida. Evitar áreas contaminadas.',
    nutrition: { kcal: 33, protein: 2.5, vitC: 8, fiber: 3.3 },
    season: 'Ano todo em climas amenos. Melhor na primavera.',
    confusion: 'Plantago lanceolata (tanchagem-menor) tem folhas estreitas e lanceoladas — também comestível e medicinal.'
  },
  {
    id: 'cattail', name: 'Taboa', latin: 'Typha latifolia', type: 'edible',
    icon: '🌾', biome: ['pantanal', 'beira de rio', 'tropical', 'temperado'],
    edibleParts: ['Rizomas', 'Brotos', 'Pólen', 'Inflorescência jovem'],
    description: 'Chamada de "supermercado do pântano" — quase todas as partes são comestíveis em diferentes épocas do ano. Essencial para sobrevivência perto de água.',
    identification: [
      'Planta alta (1.5-3 m) em áreas alagadas',
      'Folhas longas, estreitas e rígidas como espada',
      'Inflorescência cilíndrica marrom tipo "salsicha"',
      'Cresce em grupos densos em margem de rios e lagos',
      'Rizoma grosso e branco por dentro'
    ],
    preparation: 'Rizomas: descascar e cozinhar como batata, ou secar e moer em farinha. Brotos jovens (primavera): comer crus ou cozidos como aspargos. Pólen amarelo: coletar e usar como farinha nutritiva. Inflorescência verde: grelhar como milho.',
    medicinal: 'Gel do caule aplicado em queimaduras leves. Penugem da inflorescência madura serve como curativo absorvente e material de isolamento.',
    warnings: 'Certificar que a água não está contaminada. Não confundir com Iris (lirio-do-brejo) que é TÓXICA — Iris tem folha achatada em leque, Taboa tem folha em "D".',
    nutrition: { kcal: 266, protein: 4.5, vitC: 0, fiber: 7.2 },
    season: 'Rizomas: outono/inverno. Brotos: primavera. Pólen: início verão.',
    confusion: 'PERIGO: Iris pseudacorus (lírio-do-brejo amarelo) cresce no mesmo habitat e é TÓXICA. Verificar: Taboa tem folhas com seção em "D", Iris tem folhas achatadas em leque.'
  },
  {
    id: 'clover', name: 'Trevo', latin: 'Trifolium spp.', type: 'edible',
    icon: '☘️', biome: ['temperado', 'subtropical', 'urbano', 'campo'],
    edibleParts: ['Folhas', 'Flores', 'Sementes'],
    description: 'Planta extremamente comum em gramados e pastagens em todo o mundo. Fácil de identificar pela folha trifoliada característica.',
    identification: [
      'Folhas com 3 folíolos (trifoliadas) — raramente 4',
      'Marca clara em "V" em cada folíolo',
      'Flores globulares brancas ou rosas',
      'Planta rasteira, 10-30 cm',
      'Gramados, parques, pastagens'
    ],
    preparation: 'Flores e folhas jovens em salada. Flores secas para chá. Ferver folhas 10 min melhora digestibilidade. Sementes podem ser moídas em farinha. Brotar sementes para salada.',
    medicinal: 'Chá das flores vermelhas: expectorante, auxilia menopausa (fitoestrogênios). Flores brancas em infusão para resfriados.',
    warnings: 'Comer em moderação — pode causar inchaço se consumido em grande quantidade cru. Pessoas com distúrbios de coagulação devem evitar.',
    nutrition: { kcal: 38, protein: 3.5, vitC: 15, fiber: 2.8 },
    season: 'Primavera e verão.',
    confusion: 'Oxalis (trevo-azedo) tem folhas similares mas sabor ácido — também comestível em pequenas quantidades. Verificar: Trifolium tem marca em "V" no folíolo.'
  },
  {
    id: 'amaranth', name: 'Amaranto / Caruru', latin: 'Amaranthus spp.', type: 'edible',
    icon: '🌱', biome: ['tropical', 'subtropical', 'urbano', 'temperado'],
    edibleParts: ['Folhas', 'Sementes', 'Caule jovem'],
    description: 'Planta considerada "erva daninha" mas extremamente nutritiva. Cultivada há milênios pelos Astecas. Comum em terrenos baldios e hortas.',
    identification: [
      'Folhas ovais alternadas, inteiras ou levemente onduladas',
      'Caule ereto avermelhado ou verde, 30-200 cm',
      'Inflorescência densa em espiga terminal',
      'Sementes muito pequenas, escuras e brilhantes',
      'Raiz pivotante avermelhada'
    ],
    preparation: 'Folhas cozidas como espinafre (5-10 min). Sementes: secar, debulhar e tostar — usar como cereal ou moer em farinha. Brotos jovens crus em salada.',
    medicinal: 'Rico em ferro — combate anemia. Anti-inflamatório. Folhas em cataplasma para picadas de inseto.',
    warnings: 'Como espinafre, contém oxalatos — não consumir em grandes quantidades cru. Cozinhar reduz oxalatos. Pessoas com pedras nos rins devem moderar.',
    nutrition: { kcal: 23, protein: 2.5, vitC: 43, fiber: 2.1 },
    season: 'Verão e outono.',
    confusion: 'Várias espécies de Amaranthus — todas comestíveis. Não confundir com Phytolacca (fitolaca/erva-de-rato) que tem bagas e é TÓXICA.'
  },
  {
    id: 'purslane', name: 'Beldroega', latin: 'Portulaca oleracea', type: 'edible',
    icon: '🥬', biome: ['tropical', 'subtropical', 'urbano', 'temperado'],
    edibleParts: ['Folhas', 'Caules', 'Sementes'],
    description: 'Uma das plantas mais nutritivas do planeta — é a fonte vegetal mais rica em ômega-3 (ácido alfa-linolênico). Cresce em rachaduras de calçada.',
    identification: [
      'Folhas suculentas, ovais, carnudas, verde-brilhantes',
      'Caule avermelhado, prostrado, suculento',
      'Flores pequenas amarelas (5 pétalas)',
      'Planta rasteira formando tapete, 5-30 cm',
      'Textura mucilaginosa ao cortar'
    ],
    preparation: 'Comer crua em salada (sabor levemente ácido/azedo). Cozinhar em refogados e sopas. Sementes tostadas como cereal. Pode ser conservada em vinagre.',
    medicinal: 'Fonte de ômega-3 (raro em plantas). Antioxidante. Folhas amassadas em pequenas queimaduras e picadas. Auxilia diabetes (reduz glicemia).',
    warnings: 'Contém oxalatos moderados — comer com moderação se tiver pedras nos rins. NÃO confundir com Euphorbia (erva-de-cobra) que exsuda LÁTEX BRANCO TÓXICO.',
    nutrition: { kcal: 20, protein: 2.0, vitC: 21, fiber: 1.5 },
    season: 'Verão (calor pleno).',
    confusion: 'PERIGO: Euphorbia maculata (erva-de-cobra) parece similar mas exsuda LÁTEX BRANCO ao cortar. Beldroega exsuda líquido TRANSPARENTE mucilaginoso. Sempre testar antes!'
  },
  {
    id: 'chicory', name: 'Chicória-silvestre', latin: 'Cichorium intybus', type: 'dual',
    icon: '🌸', biome: ['temperado', 'subtropical', 'campo', 'urbano'],
    edibleParts: ['Folhas', 'Raízes', 'Flores'],
    description: 'Planta perene com flores azuis marcantes. Raiz torrada serve como substituto de café — usada historicamente em tempos de escassez.',
    identification: [
      'Flores azul-celeste brilhantes (raramente brancas/rosas)',
      'Flores abrem pela manhã e fecham ao meio-dia',
      'Folhas basais dentadas similares ao dente-de-leão',
      'Caule rígido, ramificado, com látex amargo',
      'Altura: 30-120 cm, em beiras de estrada'
    ],
    preparation: 'Folhas jovens em salada (amargas — branquear 2 min reduz). Raiz seca e torrada como café: cortar, secar ao sol, tostar até escurecer, moer. Flores como decoração comestível.',
    medicinal: 'Raiz: prebiótico (inulina) — fortalece flora intestinal. Digestivo e tônico hepático. Levemente laxante. Chá da raiz para inchaço.',
    warnings: 'Amarga — o sabor é uma defesa mas não é tóxica. Consumo excessivo de raiz pode causar gases (inulina). Alérgicos a Asteraceae devem evitar.',
    nutrition: { kcal: 23, protein: 1.7, vitC: 24, fiber: 4.0 },
    season: 'Folhas: primavera. Flores: verão. Raízes: outono.',
    confusion: 'Similiar ao dente-de-leão na fase de roseta — ambos comestíveis. Quando florida, inconfundível pelo azul.'
  },
  // ── MEDICINAL ──
  {
    id: 'chamomile', name: 'Camomila', latin: 'Matricaria chamomilla', type: 'medicinal',
    icon: '🌼', biome: ['temperado', 'subtropical', 'campo'],
    edibleParts: ['Flores'],
    description: 'Uma das plantas medicinais mais conhecidas e seguras. Chá calmante essencial em situação de estresse pós-catástrofe.',
    identification: [
      'Flores tipo margarida: pétalas brancas, centro amarelo convexo',
      'Centro da flor é OCO quando cortado ao meio',
      'Folhas muito finamente divididas (como cabelo)',
      'Aroma doce de maçã ao esmagar flores',
      'Planta delicada, 20-50 cm'
    ],
    preparation: 'Chá: secar flores e infundir 5-10 min em água quente. Também pode usar flores frescas (usar o dobro). Nunca ferver — apenas infundir.',
    medicinal: 'Calmante e ansiolítico natural. Auxilia sono. Anti-inflamatório para estômago. Compressa de chá forte para irritações de pele, olhos inflamados e gengivite.',
    warnings: 'Evitar durante gravidez em doses altas. Alérgicos a Asteraceae podem reagir. Não confundir com margarida-do-campo (sem aroma de maçã).',
    nutrition: { kcal: 1, protein: 0, vitC: 0, fiber: 0 },
    season: 'Primavera e verão.',
    confusion: 'Anthemis cotula (camomila-fétida): cheiro desagradável, pode causar dermatite. Teste: camomila VERDADEIRA tem centro OCO e cheiro de MAÇÃ.'
  },
  {
    id: 'aloe', name: 'Babosa / Aloe', latin: 'Aloe vera', type: 'medicinal',
    icon: '🌵', biome: ['tropical', 'subtropical', 'semiárido', 'urbano'],
    edibleParts: ['Gel interno'],
    description: 'Planta suculenta medicinal de uso milenar. O gel transparente interno é um dos melhores curativos naturais para queimaduras.',
    identification: [
      'Folhas grossas, carnudas, em roseta (30-60 cm)',
      'Bordas com dentes/espinhos curtos',
      'Corte revela gel transparente abundante',
      'Abaixo do gel, camada amarela amarga (aloína)',
      'Flor tubular amarela/laranja em haste longa'
    ],
    preparation: 'USO TÓPICO: cortar folha, remover casca, aplicar gel diretamente em queimaduras, cortes, irritações. USO INTERNO: apenas gel transparente (remover completamente a camada amarela). Gel em sucos ou smoothies.',
    medicinal: 'QUEIMADURAS: aplicar gel fresco — alivia dor e acelera cicatrização. Hidrata pele. Gel interno: auxilia digestão. Antibacteriano e antifúngico natural.',
    warnings: 'A camada amarela (aloína/látex) é LAXANTE FORTE — remover completamente para uso interno. Não usar gel interno na gravidez. Uso tópico é seguro para todos.',
    nutrition: { kcal: 4, protein: 0.1, vitC: 3, fiber: 0.3 },
    season: 'Perene — disponível o ano todo.',
    confusion: 'Agave parece similar mas folhas são mais duras e fibrosas. Aloe tem gel abundante; Agave não.'
  },
  {
    id: 'yarrow', name: 'Mil-folhas', latin: 'Achillea millefolium', type: 'medicinal',
    icon: '🌿', biome: ['temperado', 'campo', 'subtropical'],
    edibleParts: ['Folhas', 'Flores'],
    description: 'Nomeada em homenagem a Aquiles, que supostamente a usou para tratar feridas de soldados. Uma das melhores plantas HEMOSTÁTICAS de campo.',
    identification: [
      'Folhas muito finamente divididas — parecem plumas (mil-folhas)',
      'Flores pequenas brancas (ou rosas) em corimbos achatados',
      'Aroma forte e aromático ao esmagar',
      'Caule ereto, peludo, 30-100 cm',
      'Folhas alternadas, distribuídas ao longo do caule'
    ],
    preparation: 'Chá das flores e folhas secas. Folhas jovens (poucas) em salada — sabor amargo/pungente. Uso principal é medicinal.',
    medicinal: 'HEMOSTÁTICO: folhas amassadas aplicadas diretamente PARAM SANGRAMENTO de cortes. Anti-inflamatório. Chá para febre (diaforético), resfriados e cólicas menstruais. Antisséptico de campo.',
    warnings: 'Evitar na gravidez (pode estimular útero). Pode causar sensibilidade à luz solar. Usar com moderação — doses altas podem causar dor de cabeça.',
    nutrition: { kcal: 15, protein: 0.8, vitC: 58, fiber: 2.0 },
    season: 'Verão para flores. Folhas da primavera ao outono.',
    confusion: 'PERIGO: Pode ser confundida com cicuta (Conium maculatum) quando jovem — cicuta tem caule LISO com MANCHAS ROXAS e cheiro DESAGRADÁVEL. Mil-folhas tem caule PELUDO e cheiro AROMÁTICO.'
  },
  {
    id: 'lavender', name: 'Lavanda / Alfazema', latin: 'Lavandula spp.', type: 'medicinal',
    icon: '💜', biome: ['temperado', 'subtropical', 'semiárido'],
    edibleParts: ['Flores', 'Folhas'],
    description: 'Planta aromática reconhecida mundialmente pelo efeito calmante. Essencial para controle de ansiedade em cenários de crise.',
    identification: [
      'Flores roxas/lilás em espigas terminais',
      'Folhas estreitas, acinzentadas, aromáticas',
      'Arbusto lenhoso na base, 30-80 cm',
      'Aroma forte e inconfundível',
      'Toda a planta é aromática ao toque'
    ],
    preparation: 'Chá: 1-2 colheres de flores secas em água quente, 5 min. Flores frescas em saladas ou sobremesas. Sachê de flores secas como repelente de insetos.',
    medicinal: 'ANSIOLÍTICO: cheiro reduz ansiedade e melhora sono. Antisséptico leve — chá para lavar feridas. Anti-inflamatório. Repelente natural de insetos.',
    warnings: 'Consumir com moderação. Óleo essencial concentrado pode ser tóxico — usar apenas planta seca/fresca. Evitar doses medicinais na gravidez.',
    nutrition: { kcal: 2, protein: 0.1, vitC: 0, fiber: 0.2 },
    season: 'Verão (flores). Folhas disponíveis mais tempo.',
    confusion: 'Lavanda é bastante distinta pelo aroma. Não confundir com Salvia leucantha (rabo-de-gato) que tem flores similares mas não é aromática.'
  },
  // ── TOXIC / DANGEROUS ──
  {
    id: 'hemlock', name: 'Cicuta', latin: 'Conium maculatum', type: 'toxic',
    icon: '💀', biome: ['temperado', 'subtropical', 'urbano', 'beira de rio'],
    edibleParts: [],
    description: 'UMA DAS PLANTAS MAIS MORTAIS DO MUNDO. Foi usada para executar Sócrates. Todas as partes são extremamente tóxicas. Comum em beiras de estrada e terrenos úmidos.',
    identification: [
      'Caule LISO com MANCHAS ROXAS/VERMELHAS distintas',
      'Folhas finamente divididas (parecem salsa gigante)',
      'Flores brancas pequenas em umbelas (guarda-chuva)',
      'Cheiro DESAGRADÁVEL, descrito como "urina de rato"',
      'Altura: 1-3 metros. Raiz branca tipo cenoura'
    ],
    preparation: 'NÃO HÁ PREPARO SEGURO — TODA A PLANTA É MORTAL',
    medicinal: 'NENHUM USO SEGURO. Veneno paralisante neuromuscular.',
    warnings: 'MORTAL: paralisia progressiva começando nas pernas, subindo até os músculos respiratórios. Morte por asfixia. NÃO EXISTE ANTÍDOTO DE CAMPO. Não tocar e lavar mãos se houver contato. Manter crianças e animais afastados.',
    nutrition: { kcal: 0, protein: 0, vitC: 0, fiber: 0 },
    season: 'Primavera a verão (mais perigosa quando florida/com frutos).',
    confusion: 'Confundida com cenoura selvagem (Daucus carota), salsa, mil-folhas jovem. DIFERENCIAL: caule LISO + MANCHAS ROXAS + cheiro FÉTIDO = CICUTA. Cenoura selvagem tem caule PELUDO.'
  },
  {
    id: 'ricin', name: 'Mamona', latin: 'Ricinus communis', type: 'toxic',
    icon: '☠️', biome: ['tropical', 'subtropical', 'urbano'],
    edibleParts: [],
    description: 'Planta ornamental extremamente comum em áreas urbanas tropicais. As sementes contêm ricina, uma das toxinas mais potentes conhecidas.',
    identification: [
      'Folhas grandes palmadas (5-11 lobos), 15-45 cm',
      'Caule grosso avermelhado ou verde',
      'Frutos espinhosos em cachos, contendo sementes',
      'Sementes com padrão marmoreado (marrom/preto)',
      'Planta arbustiva ou arbórea, 2-5 m'
    ],
    preparation: 'NÃO HÁ PREPARO SEGURO PARA AS SEMENTES',
    medicinal: 'Óleo de rícino (processado industrialmente) é laxante — mas NUNCA tentar extrair artesanalmente.',
    warnings: 'MORTAL: mastigar 2-4 sementes pode matar um adulto. Ricina causa destruição celular, hemorragia interna, falência de órgãos. Sintomas aparecem 12-72h após ingestão. SEM ANTÍDOTO. As folhas são menos tóxicas mas também perigosas.',
    nutrition: { kcal: 0, protein: 0, vitC: 0, fiber: 0 },
    season: 'Perene em climas tropicais.',
    confusion: 'Folhas podem lembrar mandioca (Manihot) — mamona tem folhas com lobos pontiagudos e frutos espinhosos. Mandioca tem folhas com lobos mais estreitos e raiz tuberosa.'
  },
  {
    id: 'nightshade', name: 'Erva-moura', latin: 'Solanum nigrum', type: 'toxic',
    icon: '🫐', biome: ['tropical', 'subtropical', 'urbano', 'temperado'],
    edibleParts: [],
    description: 'Parente do tomate, com bagas pretas que parecem mirtilo. As bagas VERDES são tóxicas. As maduras PRETAS são comestíveis em algumas tradições, mas o risco de erro é alto demais.',
    identification: [
      'Bagas pequenas (6-8 mm) pretas quando maduras, verdes quando jovens',
      'Folhas ovais, inteiras ou levemente lobadas',
      'Flores pequenas brancas com centro amarelo (tipo tomate)',
      'Planta herbácea, 20-60 cm',
      'Frutos em cachos pendentes'
    ],
    preparation: 'NÃO RECOMENDADO — risco de confusão com espécies mais tóxicas é muito alto.',
    medicinal: 'Uso tradicional em algumas culturas para inflamação — NÃO RECOMENDADO sem experiência botânica.',
    warnings: 'PERIGO: Bagas verdes contêm solanina (glicoalcaloide tóxico). Sintomas: vômito, diarreia, dor abdominal, confusão mental. Crianças são especialmente vulneráveis. Há espécies similares MAIS tóxicas (Atropa belladonna).',
    nutrition: { kcal: 0, protein: 0, vitC: 0, fiber: 0 },
    season: 'Verão e outono (frutificação).',
    confusion: 'PERIGO EXTREMO: Atropa belladonna (beladona) tem bagas pretas similares mas MAIORES e é MORTAL. Mirtilo silvestre tem folhas completamente diferentes. Na dúvida, NUNCA comer bagas pretas silvestres.'
  },
  {
    id: 'oleander', name: 'Espirradeira / Oleandro', latin: 'Nerium oleander', type: 'toxic',
    icon: '🌺', biome: ['subtropical', 'tropical', 'urbano', 'temperado'],
    edibleParts: [],
    description: 'Arbusto ornamental extremamente popular em jardins e avenidas. TODA a planta é altamente tóxica — inclusive a fumaça da queima e a água onde flores caíram.',
    identification: [
      'Folhas lanceoladas, coriáceas, verde-escuras, 10-20 cm',
      'Flores grandes vistosas: rosa, branca, vermelha ou amarela',
      'Arbusto sempre-verde, 2-6 m',
      'Látex leitoso ao cortar',
      'Muito comum em canteiros de avenidas e jardins'
    ],
    preparation: 'NÃO HÁ PREPARO SEGURO',
    medicinal: 'Glicosídeos cardíacos usados em farmacologia — NUNCA usar artesanalmente.',
    warnings: 'MORTAL: contém oleandrina (glicosídeo cardíaco). Afeta o coração causando arritmias fatais. TODAS as partes tóxicas. NÃO usar galhos como espeto para churrasco. NÃO queimar (fumaça tóxica). NÃO beber água com flores. Uma única folha pode matar uma criança.',
    nutrition: { kcal: 0, protein: 0, vitC: 0, fiber: 0 },
    season: 'Perene — perigosa o ano todo.',
    confusion: 'Folhas podem lembrar louro (Laurus nobilis) — louro tem aroma forte ao esmagar, oleandro não. Flores inconfundíveis.'
  },
  {
    id: 'castor-bean-tree', name: 'Comigo-ninguém-pode', latin: 'Dieffenbachia spp.', type: 'toxic',
    icon: '🪴', biome: ['tropical', 'subtropical', 'urbano'],
    edibleParts: [],
    description: 'Planta ornamental de interior extremamente comum. O nome popular já diz tudo — contém cristais de oxalato de cálcio que causam dor intensa.',
    identification: [
      'Folhas grandes ovais com manchas brancas/amarelas',
      'Caule carnudo e ereto',
      'Planta de interior muito comum, 50-150 cm',
      'Seiva transparente que causa irritação',
      'Folhas alternadas, grandes (20-40 cm)'
    ],
    preparation: 'NÃO HÁ PREPARO SEGURO',
    medicinal: 'NENHUM USO SEGURO.',
    warnings: 'PERIGO: cristais de oxalato causam queimação e inchaço imediato na boca, língua e garganta. Pode causar asfixia por edema. Se ingerido: lavar boca com água/leite e buscar socorro. Seiva nos olhos causa dor intensa e possível dano temporário à visão.',
    nutrition: { kcal: 0, protein: 0, vitC: 0, fiber: 0 },
    season: 'Perene.',
    confusion: 'Taioba (Xanthosoma sagittifolium) é comestível após cozimento mas folhas são parecidas quando jovens — taioba NÃO tem manchas brancas.'
  },
  // ── MORE EDIBLE ──
  {
    id: 'bamboo', name: 'Bambu', latin: 'Bambusa / Phyllostachys spp.', type: 'edible',
    icon: '🎋', biome: ['tropical', 'subtropical', 'temperado'],
    edibleParts: ['Brotos jovens'],
    description: 'Os brotos de bambu são consumidos em toda a Ásia. Material estrutural e alimentício vital em situação de sobrevivência.',
    identification: [
      'Colmos (caules) ocos segmentados em nós',
      'Brotos emergem do solo cobertos por bainhas',
      'Folhas lineares pequenas nos ramos superiores',
      'Cresce em touceiras densas',
      'Brotos parecem cones pontiagudos saindo do chão'
    ],
    preparation: 'OBRIGATÓRIO COZINHAR: brotos crus contêm glicosídeos cianogênicos. Descascar, fatiar fino, FERVER 20-30 min (trocar água uma vez). Após cozimento, sabor suave e textura crocante. Pode ser conservado em salmoura.',
    medicinal: 'Rico em fibras e potássio. Folhas de bambu em chá tradicional para febre.',
    warnings: 'NUNCA comer brotos CRUS — contêm compostos cianogênicos que liberam ácido cianídrico. Cozimento prolongado elimina completamente o risco. Escolher brotos jovens e tenros.',
    nutrition: { kcal: 27, protein: 2.6, vitC: 4, fiber: 2.2 },
    season: 'Primavera (principal). Algumas espécies brotam no outono.',
    confusion: 'Sem confusões perigosas — bambu é bastante distinto. Diferentes espécies variam em tamanho mas todas têm brotos comestíveis após cozimento.'
  },
  {
    id: 'pine', name: 'Pinheiro', latin: 'Pinus spp.', type: 'dual',
    icon: '🌲', biome: ['temperado', 'subtropical', 'montanha'],
    edibleParts: ['Agulhas', 'Casca interna', 'Pinhas', 'Pólen'],
    description: 'Fonte de vitamina C de emergência disponível O ANO TODO, mesmo no inverno. Chá de agulhas de pinheiro tem 5x mais vitamina C que suco de laranja.',
    identification: [
      'Árvore conífera com agulhas (folhas em forma de agulha)',
      'Agulhas em feixes de 2, 3 ou 5 conforme espécie',
      'Cones (pinhas) lenhosos',
      'Casca grossa e sulcada em árvores maduras',
      'Resina pegajosa aromática'
    ],
    preparation: 'CHÁ DE AGULHAS: agulhas frescas picadas em água quente 10-15 min (não ferver forte). CASCA INTERNA (cambium): raspar a camada branca sob a casca — comer crua, frita ou seca como farinha. PINHÕES: excelente alimento calórico.',
    medicinal: 'Vitamina C previne escorbuto. Chá expectorante para resfriados. Resina como antisséptico de campo (aplicar em cortes). Chá de agulhas para dor de garganta.',
    warnings: 'EVITAR: Teixo (Taxus) parece similar mas é MORTAL — Teixo tem agulhas ACHATADAS e bagas vermelhas. Pinheiro tem agulhas CILÍNDRICAS e pinhas. Gestantes devem evitar chá de agulhas em doses altas.',
    nutrition: { kcal: 673, protein: 14, vitC: 250, fiber: 3.7 },
    season: 'ANO TODO — essencial para inverno quando nada mais cresce.',
    confusion: 'PERIGO MORTAL: Teixo (Taxus baccata) é FATAL. Diferencial: Teixo = agulhas PLANAS + bagas vermelhas. Pinheiro = agulhas CILÍNDRICAS em feixes + pinhas.'
  },
  {
    id: 'rosehip', name: 'Rosa-silvestre / Roseira', latin: 'Rosa canina', type: 'dual',
    icon: '🌹', biome: ['temperado', 'subtropical', 'campo'],
    edibleParts: ['Frutos (quadris)', 'Pétalas', 'Folhas jovens'],
    description: 'Os frutos da roseira (rosa mosqueta) contêm 20x mais vitamina C que a laranja. Essencial para prevenir escorbuto em situações prolongadas.',
    identification: [
      'Arbusto espinhoso com flores de 5 pétalas',
      'Frutos vermelhos/alaranjados ovais (quadris/cynorrhodon)',
      'Espinhos curvos no caule',
      'Folhas compostas dentadas com 5-7 folíolos',
      'Frutos maduros no outono/inverno'
    ],
    preparation: 'FRUTOS: cortar ao meio, remover TODAS as sementes e pelos irritantes, comer cru ou fazer geleia/chá. CHÁS: frutos secos triturados em água quente 15 min. PÉTALAS: salada, chá ou cristalizadas. IMPORTANTE: remover pelos/sementes — causam irritação interna.',
    medicinal: 'CAMPEÃ de vitamina C natural. Anti-inflamatório. Chá para resfriados e imunidade. Óleo de rosa mosqueta cicatrizante para pele.',
    warnings: 'Os pelos dentro do fruto (ao redor das sementes) causam irritação e coceira — remover completamente. Fora isso, muito segura.',
    nutrition: { kcal: 162, protein: 1.6, vitC: 426, fiber: 24 },
    season: 'Frutos: outono e inverno (após primeiras geadas ficam mais doces). Flores: primavera/verão.',
    confusion: 'Várias espécies de Rosa são comestíveis. Não confundir com piracanta (Pyracantha) — frutos em cachos, sem espinhos curvos.'
  },
  {
    id: 'elderberry', name: 'Sabugueiro', latin: 'Sambucus nigra', type: 'dual',
    icon: '🫐', biome: ['temperado', 'subtropical'],
    edibleParts: ['Flores', 'Frutos maduros (cozidos)'],
    description: 'Flores e frutos maduros são comestíveis e medicinais. Usado há séculos contra gripes e resfriados. MAS: frutos CRUS e partes verdes são TÓXICOS.',
    identification: [
      'Arbusto/árvore pequena, 3-10 m',
      'Folhas compostas com 5-7 folíolos dentados',
      'Flores brancas pequenas em corimbos grandes achatados',
      'Frutos pequenos pretos em cachos pendentes',
      'Casca com medula esponjosa branca ao cortar'
    ],
    preparation: 'FLORES: fritas em massa (bolinhos de sabugueiro) ou secas para chá. FRUTOS: OBRIGATÓRIO COZINHAR — ferver 15-20 min para geleia, xarope ou vinho. NUNCA comer frutos crus em quantidade.',
    medicinal: 'ANTIGRIPAL potente: xarope dos frutos cozidos é um dos remédios naturais mais eficazes para gripe e resfriado. Chá das flores é diaforético (induz suor) — bom para febre. Anti-inflamatório e antiviral.',
    warnings: 'FRUTOS CRUS são tóxicos (cianeto) — SEMPRE cozinhar. Folhas, casca e frutos verdes são TÓXICOS. NÃO confundir com Sabugueiro-vermelho (Sambucus racemosa) que é MAIS TÓXICO.',
    nutrition: { kcal: 73, protein: 0.7, vitC: 36, fiber: 7.0 },
    season: 'Flores: final da primavera. Frutos: final do verão/outono.',
    confusion: 'PERIGO: Partes verdes e frutos crus são TÓXICOS. Cuidado com Sambucus racemosa (frutos vermelhos — mais tóxica). Confusão possível com Sureau-hièble (Sambucus ebulus) que é completamente TÓXICO.'
  },
  {
    id: 'watercress', name: 'Agrião-d\'água', latin: 'Nasturtium officinale', type: 'edible',
    icon: '💧', biome: ['temperado', 'subtropical', 'beira de rio'],
    edibleParts: ['Folhas', 'Caules'],
    description: 'Planta aquática comestível rica em nutrientes, encontrada em riachos e nascentes de água limpa. Sabor picante/pimenta.',
    identification: [
      'Cresce na água corrente limpa (riachos, fontes)',
      'Folhas compostas arredondadas, verde-escuras',
      'Caule oco flutuante ou semi-submerso',
      'Sabor picante/apimentado ao mastigar',
      'Flores brancas pequenas com 4 pétalas'
    ],
    preparation: 'Comer cru em saladas (melhor sabor). Pode ser cozido em sopas. Lavar muito bem se colhido na natureza. Suco fresco é altamente nutritivo.',
    medicinal: 'Rico em vitaminas A, C, K e minerais. Expectorante para tosse. Estimula digestão e apetite. Tradicionalmente usado contra escorbuto.',
    warnings: 'RISCO: se coletado na natureza, pode conter Fasciola hepatica (parasita do fígado) — LAVAR MUITO BEM e preferencialmente cozinhar se a água não for comprovadamente limpa. Verificar que não há gado a montante.',
    nutrition: { kcal: 11, protein: 2.3, vitC: 43, fiber: 0.5 },
    season: 'Ano todo (menos abundante no inverno).',
    confusion: 'Berula erecta (aipo-dos-rios) é similar e comestível. PERIGO: pode crescer perto de Cicuta virosa (cicuta-aquática) que é MORTAL. Verificar: agrião tem sabor PICANTE, cicuta-aquática tem cheiro DESAGRADÁVEL.'
  },
];

let _plantsFilter = 'all';

function plantsInit() {
  _plantsFilter = 'all';
  const search = document.getElementById('plantsSearch');
  if (search) search.value = '';
  // Reset filter buttons
  document.querySelectorAll('.plants-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === 'all');
  });
  plantsRenderGrid();
  plantsHideDetail();
}

function plantsSetFilter(filter) {
  _plantsFilter = filter;
  document.querySelectorAll('.plants-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  plantsRenderGrid();
  plantsHideDetail();
}

function plantsFilter() {
  plantsRenderGrid();
}

function plantsRenderGrid() {
  const container = document.getElementById('plantsContent');
  if (!container) return;

  const query = (document.getElementById('plantsSearch')?.value || '').toLowerCase().trim();
  const filter = _plantsFilter;

  let plants = PLANTS_DB;

  // Type filter
  if (filter !== 'all') {
    plants = plants.filter(p => p.type === filter);
  }

  // Search filter
  if (query) {
    plants = plants.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.latin.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.biome.some(b => b.toLowerCase().includes(query)) ||
      p.edibleParts.some(ep => ep.toLowerCase().includes(query))
    );
  }

  // Update count
  const countEl = document.getElementById('plantsCount');
  if (countEl) countEl.textContent = `${plants.length} de ${PLANTS_DB.length} plantas`;

  if (plants.length === 0) {
    container.innerHTML = `
      <div class="plants-empty">
        <div class="plants-empty-icon">&#128270;</div>
        <div>Nenhuma planta encontrada</div>
        <div class="plants-empty-hint">Tente outro filtro ou termo de busca</div>
      </div>`;
    return;
  }

  const typeLabels = {
    edible: { label: 'Comestível', cls: 'plants-badge-edible' },
    medicinal: { label: 'Medicinal', cls: 'plants-badge-medicinal' },
    toxic: { label: 'TÓXICA', cls: 'plants-badge-toxic' },
    dual: { label: 'Comestível & Medicinal', cls: 'plants-badge-dual' },
  };

  container.innerHTML = plants.map(p => {
    const badge = typeLabels[p.type] || typeLabels.edible;
    const biomeStr = p.biome.slice(0, 3).join(', ');
    return `
      <div class="plants-card plants-card-${p.type}" onclick="plantsShowDetail('${p.id}')">
        <div class="plants-card-header">
          <span class="plants-card-icon">${p.icon}</span>
          <div class="plants-card-titles">
            <div class="plants-card-name">${p.name}</div>
            <div class="plants-card-latin">${p.latin}</div>
          </div>
          <span class="plants-badge ${badge.cls}">${badge.label}</span>
        </div>
        <div class="plants-card-desc">${p.description.slice(0, 120)}${p.description.length > 120 ? '...' : ''}</div>
        <div class="plants-card-footer">
          <span class="plants-card-biome">&#127758; ${biomeStr}</span>
          ${p.edibleParts.length ? `<span class="plants-card-parts">&#127860; ${p.edibleParts.slice(0, 2).join(', ')}${p.edibleParts.length > 2 ? '...' : ''}</span>` : '<span class="plants-card-parts plants-card-parts-none">&#9760;&#65039; Não consumir</span>'}
        </div>
      </div>`;
  }).join('');
}

function plantsShowDetail(id) {
  const p = PLANTS_DB.find(pl => pl.id === id);
  if (!p) return;

  const detail = document.getElementById('plantsDetail');
  const inner = document.getElementById('plantsDetailInner');
  if (!detail || !inner) return;

  const typeLabels = {
    edible: { label: 'Comestível', cls: 'plants-badge-edible', color: '#39ff14' },
    medicinal: { label: 'Medicinal', cls: 'plants-badge-medicinal', color: '#bf5fff' },
    toxic: { label: 'TÓXICA — NÃO CONSUMIR', cls: 'plants-badge-toxic', color: '#ff1a47' },
    dual: { label: 'Comestível & Medicinal', cls: 'plants-badge-dual', color: '#00d4ff' },
  };
  const badge = typeLabels[p.type] || typeLabels.edible;

  const nutritionHtml = p.type !== 'toxic' && p.nutrition.kcal > 0 ? `
    <div class="plants-detail-section">
      <h4>&#128202; Nutrição (por 100g)</h4>
      <div class="plants-nutrition-grid">
        <div class="plants-nutri-item">
          <div class="plants-nutri-val">${p.nutrition.kcal}</div>
          <div class="plants-nutri-label">kcal</div>
        </div>
        <div class="plants-nutri-item">
          <div class="plants-nutri-val">${p.nutrition.protein}g</div>
          <div class="plants-nutri-label">Proteína</div>
        </div>
        <div class="plants-nutri-item">
          <div class="plants-nutri-val">${p.nutrition.vitC}mg</div>
          <div class="plants-nutri-label">Vit. C</div>
        </div>
        <div class="plants-nutri-item">
          <div class="plants-nutri-val">${p.nutrition.fiber}g</div>
          <div class="plants-nutri-label">Fibra</div>
        </div>
      </div>
    </div>` : '';

  inner.innerHTML = `
    <button class="plants-detail-back" onclick="plantsHideDetail()">&#8592; Voltar</button>

    <div class="plants-detail-hero plants-detail-hero-${p.type}">
      <span class="plants-detail-icon">${p.icon}</span>
      <div>
        <h2>${p.name}</h2>
        <div class="plants-detail-latin">${p.latin}</div>
        <span class="plants-badge ${badge.cls}">${badge.label}</span>
      </div>
    </div>

    <div class="plants-detail-meta">
      <div class="plants-detail-meta-item">
        <span class="plants-meta-label">&#127758; Biomas</span>
        <span>${p.biome.map(b => `<span class="plants-tag">${b}</span>`).join(' ')}</span>
      </div>
      <div class="plants-detail-meta-item">
        <span class="plants-meta-label">&#128197; Época</span>
        <span>${p.season}</span>
      </div>
      ${p.edibleParts.length ? `<div class="plants-detail-meta-item">
        <span class="plants-meta-label">&#127860; Partes comestíveis</span>
        <span>${p.edibleParts.map(ep => `<span class="plants-tag plants-tag-edible">${ep}</span>`).join(' ')}</span>
      </div>` : ''}
    </div>

    <div class="plants-detail-section">
      <h4>&#128269; Descrição</h4>
      <p>${p.description}</p>
    </div>

    <div class="plants-detail-section">
      <h4>&#127793; Como identificar</h4>
      <ul class="plants-id-list">
        ${p.identification.map(i => `<li>${i}</li>`).join('')}
      </ul>
    </div>

    ${p.type !== 'toxic' ? `<div class="plants-detail-section">
      <h4>&#127859; Preparo</h4>
      <p>${p.preparation}</p>
    </div>` : `<div class="plants-detail-section plants-detail-danger">
      <h4>&#9760;&#65039; PLANTA TÓXICA</h4>
      <p>${p.preparation}</p>
    </div>`}

    <div class="plants-detail-section">
      <h4>&#128138; Uso medicinal</h4>
      <p>${p.medicinal}</p>
    </div>

    ${nutritionHtml}

    <div class="plants-detail-section plants-detail-warnings">
      <h4>&#9888;&#65039; Avisos e precauções</h4>
      <p>${p.warnings}</p>
    </div>

    <div class="plants-detail-section">
      <h4>&#128064; Confusões comuns</h4>
      <p>${p.confusion}</p>
    </div>

    <!-- Universal Edibility Test reminder -->
    ${p.type !== 'toxic' ? `<div class="plants-detail-section plants-detail-test">
      <h4>&#129514; Teste Universal de Comestibilidade</h4>
      <p>Se não tiver 100% certeza da identificação, siga o protocolo militar:</p>
      <ol class="plants-test-steps">
        <li><strong>Separar</strong> — divida a planta em partes (folha, caule, raiz)</li>
        <li><strong>Cheirar</strong> — se cheiro forte/desagradável, rejeitar</li>
        <li><strong>Contato na pele</strong> — esfregar no pulso, esperar 15 min. Irritou? Rejeitar</li>
        <li><strong>Lábios</strong> — tocar nos lábios, esperar 5 min</li>
        <li><strong>Língua</strong> — colocar na ponta da língua, esperar 15 min</li>
        <li><strong>Mastigar</strong> — mastigar e cuspir, esperar 15 min</li>
        <li><strong>Engolir</strong> — comer uma quantidade muito pequena, esperar 8 horas</li>
        <li><strong>Aumentar</strong> — se não houve reação, comer porção maior</li>
      </ol>
      <p class="plants-test-note">⏱ Processo completo leva ~24h por parte da planta. Faça apenas se não houver alternativa.</p>
    </div>` : ''}
  `;

  detail.classList.remove('hidden');
  detail.scrollTop = 0;
}

function plantsHideDetail() {
  const detail = document.getElementById('plantsDetail');
  if (detail) detail.classList.add('hidden');
}

// ── Exports ──
window.plantsInit = plantsInit;
window.plantsSetFilter = plantsSetFilter;
window.plantsFilter = plantsFilter;
window.plantsShowDetail = plantsShowDetail;
window.plantsHideDetail = plantsHideDetail;

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING WIZARD
// ═══════════════════════════════════════════════════════════════════════════
let _onboardingStep = 0;
const ONBOARDING_TOTAL_STEPS = 5;

function onboardingShouldShow() {
  return !localStorage.getItem('bunkerOS_onboarded');
}

function onboardingShow() {
  const el = document.getElementById('onboardingWizard');
  if (!el) return;
  el.classList.remove('hidden');
  _onboardingStep = 0;
  onboardingUpdateUI();
}

function onboardingHide() {
  const el = document.getElementById('onboardingWizard');
  if (!el) return;
  el.classList.add('fade-out');
  setTimeout(() => {
    el.classList.add('hidden');
    el.remove();
  }, 500);
}

function onboardingSkip() {
  localStorage.setItem('bunkerOS_onboarded', '1');
  onboardingHide();
}

function onboardingFinish() {
  localStorage.setItem('bunkerOS_onboarded', '1');
  onboardingHide();
}

function onboardingNext() {
  if (_onboardingStep < ONBOARDING_TOTAL_STEPS - 1) {
    _onboardingStep++;
    onboardingUpdateUI();
    if (_onboardingStep === 2) onboardingRunChecks();
    if (_onboardingStep === 3) onboardingInitWifi();
  }
}

function onboardingPrev() {
  if (_onboardingStep > 0) {
    _onboardingStep--;
    onboardingUpdateUI();
  }
}

function onboardingUpdateUI() {
  // Update dots
  const dots = document.querySelectorAll('.onboarding-dot');
  dots.forEach((dot, idx) => {
    dot.classList.remove('active', 'done');
    if (idx === _onboardingStep) dot.classList.add('active');
    else if (idx < _onboardingStep) dot.classList.add('done');
  });

  // Update steps
  const steps = document.querySelectorAll('.onboarding-step');
  steps.forEach((step, idx) => {
    step.classList.remove('active');
    if (idx === _onboardingStep) {
      step.classList.add('active');
    }
  });
}

function onboardingSelectLang(el) {
  document.querySelectorAll('.onboarding-lang-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  const lang = el.getAttribute('data-lang');
  localStorage.setItem('bunkerOS_lang', lang);
}

function onboardingSetCheck(id, status, text) {
  const row = document.getElementById(id);
  if (!row) return;
  const icon = row.querySelector('.onboarding-check-icon');
  const statusEl = row.querySelector('.onboarding-check-status');
  icon.classList.remove('spinning');
  if (status === 'ok') {
    icon.textContent = '\u2705';
    icon.className = 'onboarding-check-icon ok';
    statusEl.className = 'onboarding-check-status ok';
  } else if (status === 'warn') {
    icon.textContent = '\u26A0\uFE0F';
    icon.className = 'onboarding-check-icon warn';
    statusEl.className = 'onboarding-check-status warn';
  } else {
    icon.textContent = '\u274C';
    icon.className = 'onboarding-check-icon fail';
    statusEl.className = 'onboarding-check-status fail';
  }
  statusEl.textContent = text;
}

async function onboardingRunChecks() {
  // Check AI backend
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    if (d.status === 'online') {
      onboardingSetCheck('obCheckAI', 'ok', 'Online');
      // Check models
      if (d.models && d.models.length > 0) {
        onboardingSetCheck('obCheckModels', 'ok', d.models.length + ' modelo(s)');
      } else {
        onboardingSetCheck('obCheckModels', 'warn', 'Nenhum modelo');
      }
    } else {
      onboardingSetCheck('obCheckAI', 'warn', 'Instavel');
      onboardingSetCheck('obCheckModels', 'warn', 'Indisponivel');
    }
  } catch {
    onboardingSetCheck('obCheckAI', 'fail', 'Offline');
    onboardingSetCheck('obCheckModels', 'fail', 'Indisponivel');
  }

  // Check Wikipedia (Kiwix)
  try {
    const r = await fetch('/api/wiki/search?q=test&limit=1', { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      onboardingSetCheck('obCheckWiki', 'ok', 'Disponivel');
    } else {
      onboardingSetCheck('obCheckWiki', 'warn', 'Parcial');
    }
  } catch {
    onboardingSetCheck('obCheckWiki', 'fail', 'Nao encontrada');
  }

  // Check Maps (PMTiles)
  try {
    const r = await fetch('/api/maps/list', { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const d = await r.json();
      const count = Array.isArray(d) ? d.length : (d.maps ? d.maps.length : 0);
      if (count > 0) {
        onboardingSetCheck('obCheckMaps', 'ok', count + ' mapa(s)');
      } else {
        onboardingSetCheck('obCheckMaps', 'warn', 'Nenhum mapa');
      }
    } else {
      onboardingSetCheck('obCheckMaps', 'warn', 'Indisponivel');
    }
  } catch {
    onboardingSetCheck('obCheckMaps', 'fail', 'Nao encontrado');
  }

  // Check Guides
  try {
    const r = await fetch('/api/guides', { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const d = await r.json();
      const guides = Array.isArray(d) ? d : (d.guides || []);
      if (guides.length > 0) {
        onboardingSetCheck('obCheckGuides', 'ok', guides.length + ' guia(s)');
      } else {
        onboardingSetCheck('obCheckGuides', 'warn', 'Nenhum guia');
      }
    } else {
      onboardingSetCheck('obCheckGuides', 'warn', 'Erro');
    }
  } catch {
    onboardingSetCheck('obCheckGuides', 'fail', 'Indisponivel');
  }
}

// ─── Onboarding Step 3: Wi-Fi Download Suggestions ────────────────────────────

// Priority downloads shown no onboarding (do menor pro maior)
const OB_WIFI_ITEMS = [
  { id: 'wikipedia_medicine', label: 'Wikipedia Medicina',  desc: 'Diagnosticos, farmacos, procedimentos', size: '~700 MB', icon: '🏥', checked: true,  type: 'zim' },
  { id: 'wikibooks',          label: 'Wikibooks',           desc: 'Engenharia, agricultura, construcao',  size: '~600 MB', icon: '📚', checked: true,  type: 'zim' },
  { id: 'wikipedia_mini',     label: 'Wikipedia Mini',      desc: '110 mil artigos em ingles',           size: '~1.1 GB', icon: '🌐', checked: false, type: 'zim' },
  { id: 'wikivoyage',         label: 'Wikivoyage',          desc: 'Guias geograficos e culturais',       size: '~800 MB', icon: '🗺️', checked: false, type: 'zim' },
  { id: 'map_brazil',         label: 'Mapa do Brasil',      desc: 'Navegacao offline completa',          size: '~200 MB', icon: '🗾', checked: true,  type: 'map' },
];

async function onboardingInitWifi() {
  const list  = document.getElementById('obDownloadList');
  const desc  = document.getElementById('obWifiDesc');
  if (!list) return;

  list.innerHTML = '<div class="ob-download-loading">&#8987; Verificando conexao e conteudo...</div>';

  // Checar se tem internet
  let online = false;
  try {
    const r = await fetch('https://kiwix.org/favicon.ico', { mode: 'no-cors', signal: AbortSignal.timeout(4000) });
    online = true;
  } catch { online = false; }

  // Checar quais ZIMs já instalados
  let installedZims = [];
  try {
    const r = await fetch('/api/zim/catalog', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    installedZims = (d.catalog || []).filter(z => z.installed).map(z => z.id);
  } catch {}

  // Checar quais mapas já instalados
  let installedMaps = [];
  try {
    const r = await fetch('/api/maps/list', { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    installedMaps = (Array.isArray(d) ? d : (d.maps || [])).map(m => m.id || m.name || '');
  } catch {}

  // Filtrar itens que já estão instalados
  const missing = OB_WIFI_ITEMS.filter(item => {
    if (item.type === 'zim') return !installedZims.includes(item.id);
    if (item.type === 'map') return installedMaps.length === 0;
    return true;
  });

  if (!online) {
    if (desc) desc.textContent = 'Voce esta offline agora. Quando tiver Wi-Fi, acesse o app Biblioteca para baixar conteudo.';
    list.innerHTML = `<div class="ob-download-offline">
      <div style="font-size:2.5rem;margin-bottom:8px">📵</div>
      <div style="opacity:.7">Sem conexao detectada.</div>
      <div style="font-size:.85rem;margin-top:6px;opacity:.5">Abra o app <strong>Biblioteca</strong> quando estiver online.</div>
    </div>`;
    const btn = document.getElementById('obBtnDownload');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; }
    return;
  }

  if (missing.length === 0) {
    if (desc) desc.textContent = 'Voce ja tem todo o conteudo essencial instalado!';
    list.innerHTML = `<div class="ob-download-offline" style="color:var(--accent)">
      <div style="font-size:2.5rem;margin-bottom:8px">✅</div>
      <div>Conteudo offline completo!</div>
    </div>`;
    const btn = document.getElementById('obBtnDownload');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; }
    return;
  }

  // Renderizar checkboxes
  list.innerHTML = missing.map(item => `
    <label class="ob-dl-item ${item.checked ? 'checked' : ''}" id="obItem_${item.id}" onclick="obToggleItem(this)">
      <input type="checkbox" class="ob-dl-check" id="obChk_${item.id}" ${item.checked ? 'checked' : ''}>
      <span class="ob-dl-icon">${item.icon}</span>
      <span class="ob-dl-info">
        <span class="ob-dl-name">${item.label}</span>
        <span class="ob-dl-desc">${item.desc}</span>
      </span>
      <span class="ob-dl-size">${item.size}</span>
    </label>
  `).join('');
}

function obToggleItem(label) {
  const chk = label.querySelector('input[type=checkbox]');
  if (!chk) return;
  chk.checked = !chk.checked;
  label.classList.toggle('checked', chk.checked);
}

async function onboardingStartDownloads() {
  const btn     = document.getElementById('obBtnDownload');
  const nav     = document.getElementById('obWifiNav');
  const prog    = document.getElementById('obDownloadProgress');
  const bar     = document.getElementById('obDlBar');
  const status  = document.getElementById('obDlStatus');

  // Coletar selecionados
  const selected = OB_WIFI_ITEMS.filter(item => {
    const chk = document.getElementById('obChk_' + item.id);
    return chk && chk.checked;
  });

  if (selected.length === 0) { onboardingNext(); return; }

  // Mostrar progresso
  if (btn) btn.disabled = true;
  if (nav) nav.querySelector('.onboarding-btn-secondary').disabled = true;
  if (prog) prog.classList.remove('hidden');

  let done = 0;
  for (const item of selected) {
    if (status) status.textContent = `Baixando ${item.label}...`;
    if (bar) bar.style.width = Math.round((done / selected.length) * 100) + '%';

    try {
      if (item.type === 'zim') {
        const r = await fetch('/api/zim/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id })
        });
        // Aguardar SSE de progresso
        if (r.ok) {
          const reader = r.body.getReader();
          const dec = new TextDecoder();
          while (true) {
            const { done: d, value } = await reader.read();
            if (d) break;
            const text = dec.decode(value);
            const lines = text.split('\n').filter(l => l.startsWith('data:'));
            for (const line of lines) {
              try {
                const ev = JSON.parse(line.replace(/^data:\s*/, ''));
                if (ev.progress !== undefined && bar) {
                  const overall = ((done + ev.progress / 100) / selected.length) * 100;
                  bar.style.width = Math.round(overall) + '%';
                }
                if (ev.status === 'done' || ev.done) break;
              } catch {}
            }
          }
        }
      } else if (item.type === 'map') {
        const r = await fetch('/api/maps/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ region: 'brazil' })
        });
        if (r.ok) {
          const reader = r.body.getReader();
          const dec = new TextDecoder();
          while (true) {
            const { done: d, value } = await reader.read();
            if (d) break;
            const text = dec.decode(value);
            const lines = text.split('\n').filter(l => l.startsWith('data:'));
            for (const line of lines) {
              try {
                const ev = JSON.parse(line.replace(/^data:\s*/, ''));
                if (ev.progress !== undefined && bar) {
                  const overall = ((done + ev.progress / 100) / selected.length) * 100;
                  bar.style.width = Math.round(overall) + '%';
                }
                if (ev.status === 'done' || ev.done) break;
              } catch {}
            }
          }
        }
      }
    } catch (e) {
      console.warn('Download falhou:', item.id, e);
    }

    // Marcar item como concluído
    const itemEl = document.getElementById('obItem_' + item.id);
    if (itemEl) {
      itemEl.style.opacity = '0.5';
      itemEl.innerHTML = itemEl.innerHTML.replace(item.icon, '✅');
    }
    done++;
    if (bar) bar.style.width = Math.round((done / selected.length) * 100) + '%';
  }

  if (status) status.textContent = `${done} item(s) baixado(s). Avancando...`;
  await new Promise(r => setTimeout(r, 1200));
  onboardingNext();
}

// Expose to window for onclick handlers
window.onboardingShouldShow = onboardingShouldShow;
window.onboardingShow = onboardingShow;
window.onboardingSkip = onboardingSkip;
window.onboardingFinish = onboardingFinish;
window.onboardingNext = onboardingNext;
window.onboardingPrev = onboardingPrev;
window.onboardingSelectLang = onboardingSelectLang;
window.obToggleItem = obToggleItem;
window.onboardingStartDownloads = onboardingStartDownloads;

// ═══════════════════════════════════════════════════════════════════════════════
// Navigation App — GPS-free orientation: stars, shadow compass, distance,
//                  map reading, watch method, cardinal points by sun
// ═══════════════════════════════════════════════════════════════════════════════

let _navHemisphere = 'north';
let _navSection = 'stars';

function navigationInit() {
  _navSection = 'stars';
  _navHemisphere = 'north';
  _navRender();
}

function navSetSection(sec) {
  _navSection = sec;
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.section === sec));
  _navRender();
}

function navSetHemisphere(h) {
  _navHemisphere = h;
  document.querySelectorAll('.nav-hemi-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.trim().toLowerCase().startsWith(h === 'north' ? 'n' : 's'));
  });
  _navRender();
}

function _navRender() {
  const c = document.getElementById('navContent');
  if (!c) return;
  const sections = {
    stars:    _navStars,
    shadow:   _navShadow,
    distance: _navDistance,
    maps:     _navMaps,
    watch:    _navWatch,
    cardinal: _navCardinal,
  };
  c.innerHTML = (sections[_navSection] || _navStars)();
  const st = document.getElementById('navStatus');
  if (st) {
    const labels = { stars: 'Orientacao por estrelas', shadow: 'Bussola por sombra', distance: 'Estimativa de distancia', maps: 'Leitura de mapas', watch: 'Navegacao por relogio', cardinal: 'Pontos cardeais pelo sol' };
    st.textContent = labels[_navSection] || '';
  }
}

/* ── Stars ─────────────────────────────────────────────────────────────────── */
function _navStars() {
  const isNorth = _navHemisphere === 'north';
  return `
  <div class="nav-section">
    <div class="nav-card nav-card-primary">
      <h3>${isNorth ? '&#11088; Polaris — Estrela do Norte' : '&#11088; Cruzeiro do Sul'}</h3>
      <div class="nav-diagram">
        ${isNorth ? _navDiagramPolaris() : _navDiagramCrux()}
      </div>
      <div class="nav-steps">
        ${isNorth ? `
        <div class="nav-step"><span class="nav-step-num">1</span><span>Encontre a constelacao <strong>Ursa Maior</strong> (a "panela" ou "carro") — 7 estrelas brilhantes em formato de panela</span></div>
        <div class="nav-step"><span class="nav-step-num">2</span><span>Identifique as 2 estrelas da <strong>borda externa</strong> da panela (Dubhe e Merak)</span></div>
        <div class="nav-step"><span class="nav-step-num">3</span><span>Trace uma linha imaginaria entre elas e <strong>prolongue 5x</strong> a distancia</span></div>
        <div class="nav-step"><span class="nav-step-num">4</span><span>Voce chegara a <strong>Polaris</strong>, a estrela brilhante no fim da cauda da Ursa Menor</span></div>
        <div class="nav-step"><span class="nav-step-num">5</span><span>Polaris indica <strong>NORTE</strong> com precisao. Olhando para ela: atras=Sul, esquerda=Oeste, direita=Leste</span></div>
        ` : `
        <div class="nav-step"><span class="nav-step-num">1</span><span>Encontre o <strong>Cruzeiro do Sul</strong> — 4 estrelas brilhantes em formato de cruz</span></div>
        <div class="nav-step"><span class="nav-step-num">2</span><span>Identifique o eixo <strong>mais longo</strong> da cruz (de cima para baixo)</span></div>
        <div class="nav-step"><span class="nav-step-num">3</span><span>Prolongue esse eixo <strong>4,5 vezes</strong> para baixo a partir da estrela inferior</span></div>
        <div class="nav-step"><span class="nav-step-num">4</span><span>O ponto imaginario onde voce chega e o <strong>Polo Celeste Sul</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">5</span><span>Trace uma linha vertical ate o horizonte — aquela direcao e <strong>SUL</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">6</span><span>Olhando para o Sul: atras=Norte, esquerda=Leste, direita=Oeste</span></div>
        `}
      </div>
    </div>

    <div class="nav-card">
      <h3>&#128161; Dicas para observacao noturna</h3>
      <ul class="nav-list">
        <li>Espere <strong>20-30 min</strong> no escuro para adaptacao da visao noturna</li>
        <li>Evite olhar para luzes (celular, lanterna) — use filtro <strong>vermelho</strong> se precisar</li>
        <li>Ceu limpo e sem lua e ideal para identificar estrelas</li>
        <li>A Via Lactea cruza o ceu de Norte a Sul (referencia geral)</li>
        <li>Estrelas giram ~15 graus/hora. ${isNorth ? 'Polaris permanece fixa' : 'O Cruzeiro do Sul gira ao redor do polo'}</li>
      </ul>
    </div>

    <div class="nav-card">
      <h3>&#127763; Navegacao pela Lua</h3>
      <ul class="nav-list">
        <li>Se a Lua nasce <strong>antes do por-do-sol</strong>, o lado iluminado aponta para <strong>Oeste</strong></li>
        <li>Se a Lua nasce <strong>depois da meia-noite</strong>, o lado iluminado aponta para <strong>Leste</strong></li>
        <li>Lua cheia nasce no <strong>Leste</strong> ao por-do-sol e se poe no <strong>Oeste</strong> ao nascer do sol</li>
        <li>Trace uma linha pela "ponta" do crescente ate o horizonte — indica aproximadamente <strong>${isNorth ? 'Sul' : 'Norte'}</strong></li>
      </ul>
    </div>
  </div>`;
}

function _navDiagramPolaris() {
  return `<svg viewBox="0 0 400 280" class="nav-svg">
    <defs><filter id="glow"><feGaussianBlur stdDeviation="2" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <!-- Ursa Major -->
    <text x="80" y="260" fill="#8af" font-size="11" text-anchor="middle">Ursa Maior</text>
    <line x1="50" y1="200" x2="90" y2="230" stroke="#445" stroke-width="1"/>
    <line x1="90" y1="230" x2="130" y2="220" stroke="#445" stroke-width="1"/>
    <line x1="130" y1="220" x2="140" y2="190" stroke="#445" stroke-width="1"/>
    <line x1="140" y1="190" x2="110" y2="170" stroke="#445" stroke-width="1"/>
    <line x1="110" y1="170" x2="70" y2="175" stroke="#445" stroke-width="1"/>
    <line x1="70" y1="175" x2="50" y2="200" stroke="#445" stroke-width="1"/>
    <circle cx="50" cy="200" r="3" fill="#ff0" filter="url(#glow)"/>
    <circle cx="90" cy="230" r="3" fill="#ff0" filter="url(#glow)"/>
    <circle cx="130" cy="220" r="3" fill="#ff0" filter="url(#glow)"/>
    <circle cx="140" cy="190" r="3" fill="#ff0" filter="url(#glow)"/>
    <circle cx="110" cy="170" r="3" fill="#ff0" filter="url(#glow)"/>
    <circle cx="70" cy="175" r="3" fill="#ff0" filter="url(#glow)"/>
    <circle cx="40" cy="185" r="3" fill="#ff0" filter="url(#glow)"/>
    <line x1="50" y1="200" x2="40" y2="185" stroke="#445" stroke-width="1"/>
    <!-- Dubhe & Merak labels -->
    <text x="55" y="215" fill="#aaa" font-size="9">Merak</text>
    <text x="140" y="205" fill="#aaa" font-size="9">Dubhe</text>
    <!-- Guide line -->
    <line x1="140" y1="190" x2="310" y2="50" stroke="#0ff" stroke-width="1" stroke-dasharray="6,4" opacity="0.6"/>
    <line x1="50" y1="200" x2="310" y2="50" stroke="#0ff" stroke-width="1" stroke-dasharray="6,4" opacity="0.3"/>
    <text x="200" y="110" fill="#0ff" font-size="10" text-anchor="middle" opacity="0.7">5x distancia</text>
    <!-- Polaris -->
    <circle cx="310" cy="50" r="6" fill="#ff0" filter="url(#glow)"/>
    <text x="330" y="54" fill="#ff0" font-size="12" font-weight="bold">Polaris</text>
    <text x="310" y="30" fill="#0f0" font-size="11" text-anchor="middle" font-weight="bold">&#8593; NORTE</text>
  </svg>`;
}

function _navDiagramCrux() {
  return `<svg viewBox="0 0 400 280" class="nav-svg">
    <defs><filter id="glow2"><feGaussianBlur stdDeviation="2" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <text x="150" y="30" fill="#8af" font-size="11" text-anchor="middle">Cruzeiro do Sul</text>
    <!-- Cross -->
    <line x1="150" y1="50" x2="150" y2="160" stroke="#445" stroke-width="1"/>
    <line x1="110" y1="100" x2="190" y2="100" stroke="#445" stroke-width="1"/>
    <circle cx="150" cy="50" r="4" fill="#ff0" filter="url(#glow2)"/>
    <circle cx="150" cy="160" r="4" fill="#ff0" filter="url(#glow2)"/>
    <circle cx="110" cy="100" r="3" fill="#ff0" filter="url(#glow2)"/>
    <circle cx="190" cy="100" r="3" fill="#ff0" filter="url(#glow2)"/>
    <!-- Extension line -->
    <line x1="150" y1="160" x2="150" y2="255" stroke="#0ff" stroke-width="1" stroke-dasharray="6,4" opacity="0.6"/>
    <text x="175" y="210" fill="#0ff" font-size="10" opacity="0.7">4.5x eixo</text>
    <!-- South Pole -->
    <circle cx="150" cy="255" r="5" fill="#0ff" opacity="0.5"/>
    <text x="150" y="275" fill="#0f0" font-size="11" text-anchor="middle" font-weight="bold">&#8595; SUL</text>
    <!-- Pointer stars -->
    <circle cx="300" cy="120" r="3" fill="#ff0" filter="url(#glow2)"/>
    <circle cx="340" cy="145" r="3" fill="#ff0" filter="url(#glow2)"/>
    <text x="320" y="110" fill="#aaa" font-size="9" text-anchor="middle">Ponteiros (Alpha &amp; Beta Centauri)</text>
    <line x1="300" y1="120" x2="340" y2="145" stroke="#445" stroke-width="1"/>
  </svg>`;
}

/* ── Shadow Compass ────────────────────────────────────────────────────────── */
function _navShadow() {
  return `
  <div class="nav-section">
    <div class="nav-card nav-card-primary">
      <h3>&#9728;&#65039; Metodo da Vara e Sombra</h3>
      <p class="nav-subtitle">Funciona em qualquer hemisferio, precisa apenas de sol e uma vara</p>
      <div class="nav-diagram">
        ${_navDiagramShadow()}
      </div>
      <div class="nav-steps">
        <div class="nav-step"><span class="nav-step-num">1</span><span>Finca uma <strong>vara reta</strong> (60-100cm) verticalmente no chao plano</span></div>
        <div class="nav-step"><span class="nav-step-num">2</span><span>Marque a <strong>ponta da sombra</strong> com uma pedra — esta e a marca <strong>OESTE</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">3</span><span>Espere <strong>15-30 minutos</strong> (quanto mais tempo, mais preciso)</span></div>
        <div class="nav-step"><span class="nav-step-num">4</span><span>Marque a <strong>nova posicao</strong> da ponta da sombra — esta e a marca <strong>LESTE</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">5</span><span>Trace uma <strong>linha reta</strong> entre as duas marcas — esta e a <strong>linha Leste-Oeste</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">6</span><span>Uma linha <strong>perpendicular</strong> a essa indica <strong>Norte-Sul</strong></span></div>
      </div>
    </div>

    <div class="nav-card">
      <h3>&#9201; Metodo Rapido (menos preciso)</h3>
      <div class="nav-steps">
        <div class="nav-step"><span class="nav-step-num">1</span><span>Aponte o ponteiro das horas do relogio para o <strong>sol</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">2</span><span>${_navHemisphere === 'north' ?
          'O ponto medio entre o ponteiro das horas e o 12 indica <strong>SUL</strong>' :
          'O ponto medio entre o 12 e o ponteiro das horas indica <strong>NORTE</strong>'}</span></div>
      </div>
    </div>

    <div class="nav-card">
      <h3>&#128161; Dicas importantes</h3>
      <ul class="nav-list">
        <li>Funciona melhor entre <strong>9h e 15h</strong> (sombras mais definidas)</li>
        <li>Quanto mais <strong>plano</strong> o terreno, mais preciso</li>
        <li>Nao funciona em dias totalmente <strong>nublados</strong></li>
        <li>Perto do <strong>meio-dia</strong> solar, a sombra e mais curta e aponta Norte (hemisferio sul) ou Sul (hemisferio norte)</li>
        <li>No <strong>equador</strong>, o metodo da vara e o mais confiavel</li>
      </ul>
    </div>
  </div>`;
}

function _navDiagramShadow() {
  return `<svg viewBox="0 0 400 220" class="nav-svg">
    <!-- Ground -->
    <line x1="40" y1="180" x2="360" y2="180" stroke="#444" stroke-width="1"/>
    <!-- Stick -->
    <line x1="200" y1="180" x2="200" y2="80" stroke="#a86" stroke-width="3"/>
    <circle cx="200" cy="78" r="3" fill="#a86"/>
    <text x="210" y="75" fill="#aaa" font-size="10">Vara</text>
    <!-- Shadow 1 (West) -->
    <line x1="200" y1="180" x2="120" y2="180" stroke="#666" stroke-width="2" stroke-dasharray="4,3"/>
    <circle cx="120" cy="180" r="5" fill="#f80"/>
    <text x="120" y="200" fill="#f80" font-size="10" text-anchor="middle">&#8592; Oeste (1a marca)</text>
    <!-- Shadow 2 (East) -->
    <line x1="200" y1="180" x2="280" y2="180" stroke="#666" stroke-width="2" stroke-dasharray="4,3"/>
    <circle cx="280" cy="180" r="5" fill="#0f0"/>
    <text x="280" y="200" fill="#0f0" font-size="10" text-anchor="middle">Leste (2a marca) &#8594;</text>
    <!-- E-W line -->
    <line x1="120" y1="170" x2="280" y2="170" stroke="#0ff" stroke-width="1" opacity="0.5"/>
    <!-- N-S line -->
    <line x1="200" y1="130" x2="200" y2="210" stroke="#0f0" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
    <text x="200" y="125" fill="#0f0" font-size="11" text-anchor="middle" font-weight="bold">${_navHemisphere === 'south' ? '&#8593; Norte' : '&#8593; Sul'}</text>
    <!-- Sun -->
    <circle cx="320" cy="40" r="18" fill="#ff0" opacity="0.3"/>
    <circle cx="320" cy="40" r="10" fill="#ff0" opacity="0.6"/>
    <text x="345" y="45" fill="#ff0" font-size="10">Sol</text>
  </svg>`;
}

/* ── Distance Estimation ───────────────────────────────────────────────────── */
function _navDistance() {
  return `
  <div class="nav-section">
    <div class="nav-card nav-card-primary">
      <h3>&#128099; Estimativa de Distancia a Pe</h3>
      <div class="nav-table-wrap">
        <table class="nav-table">
          <thead><tr><th>Terreno</th><th>Velocidade</th><th>Passos/km</th><th>Tempo/km</th></tr></thead>
          <tbody>
            <tr><td>&#128739;&#65039; Estrada plana</td><td>5 km/h</td><td>~1.250</td><td>12 min</td></tr>
            <tr><td>&#127795; Trilha florestal</td><td>3-4 km/h</td><td>~1.400</td><td>15-20 min</td></tr>
            <tr><td>&#9968;&#65039; Montanha (subida)</td><td>2-3 km/h</td><td>~1.600</td><td>20-30 min</td></tr>
            <tr><td>&#127966; Terreno acidentado</td><td>1.5-2 km/h</td><td>~1.800</td><td>30-40 min</td></tr>
            <tr><td>&#127958;&#65039; Areia/neve</td><td>1-2 km/h</td><td>~2.000</td><td>30-60 min</td></tr>
            <tr><td>&#127806; Vegetacao densa</td><td>0.5-1 km/h</td><td>~2.200</td><td>60+ min</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="nav-card">
      <h3>&#128077; Metodo do Polegar</h3>
      <p class="nav-desc">Estima distancia de objetos visiveis sem instrumentos</p>
      <div class="nav-steps">
        <div class="nav-step"><span class="nav-step-num">1</span><span>Estenda o braco e levante o <strong>polegar</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">2</span><span>Feche um olho e alinhe o polegar com o objeto</span></div>
        <div class="nav-step"><span class="nav-step-num">3</span><span>Troque de olho (sem mover a mao) — o polegar "pula"</span></div>
        <div class="nav-step"><span class="nav-step-num">4</span><span>Estime quanto o polegar "pulou" em relacao ao tamanho do objeto</span></div>
        <div class="nav-step"><span class="nav-step-num">5</span><span><strong>Distancia &#8776; 10x</strong> a largura aparente do "pulo"</span></div>
      </div>
    </div>

    <div class="nav-card">
      <h3>&#128290; Calculadora de Passos</h3>
      <div class="nav-calc-row">
        <label>Passos dados:</label>
        <input type="number" id="navStepCount" value="1000" min="0" class="nav-input" oninput="navCalcDist()">
      </div>
      <div class="nav-calc-row">
        <label>Terreno:</label>
        <select id="navTerrain" class="nav-select" onchange="navCalcDist()">
          <option value="1250">Estrada plana</option>
          <option value="1400">Trilha florestal</option>
          <option value="1600">Montanha</option>
          <option value="1800">Terreno acidentado</option>
          <option value="2000">Areia / neve</option>
          <option value="2200">Vegetacao densa</option>
        </select>
      </div>
      <div class="nav-calc-result" id="navDistResult">
        Distancia estimada: <strong>0.80 km</strong> (800 m)
      </div>
    </div>

    <div class="nav-card">
      <h3>&#128065; Referencia Visual de Distancia</h3>
      <ul class="nav-list">
        <li><strong>100m</strong> — Detalhes faciais visiveis, expressoes claras</li>
        <li><strong>200m</strong> — Cores de roupa distinguiveis, rosto borrado</li>
        <li><strong>500m</strong> — Corpo humano visivel, sem detalhes</li>
        <li><strong>1km</strong> — Troncos de arvores visiveis, pessoa e um ponto</li>
        <li><strong>2km</strong> — Janelas de edificios, formas gerais</li>
        <li><strong>5km</strong> — Edificios e torres, montanhas</li>
        <li><strong>10km+</strong> — Apenas contornos gerais de relevo</li>
      </ul>
    </div>
  </div>`;
}

/* ── Map Reading ───────────────────────────────────────────────────────────── */
function _navMaps() {
  return `
  <div class="nav-section">
    <div class="nav-card nav-card-primary">
      <h3>&#128506;&#65039; Leitura de Mapas Topograficos</h3>
      <div class="nav-diagram">
        ${_navDiagramContour()}
      </div>
    </div>

    <div class="nav-card">
      <h3>&#127760; Curvas de Nivel</h3>
      <ul class="nav-list">
        <li><strong>Curvas juntas</strong> = terreno <strong>ingreme</strong> (encosta acentuada)</li>
        <li><strong>Curvas separadas</strong> = terreno <strong>suave</strong> (planicie ou encosta leve)</li>
        <li><strong>Circulos concentricos</strong> = <strong>morro ou pico</strong></li>
        <li>Curvas em <strong>V apontando morro acima</strong> = <strong>vale/rio</strong></li>
        <li>Curvas em <strong>V apontando morro abaixo</strong> = <strong>crista</strong></li>
        <li>Cada curva mestra (mais grossa) geralmente tem <strong>altitude marcada</strong></li>
        <li>O intervalo entre curvas depende da <strong>escala</strong> do mapa</li>
      </ul>
    </div>

    <div class="nav-card">
      <h3>&#128207; Escala do Mapa</h3>
      <div class="nav-table-wrap">
        <table class="nav-table">
          <thead><tr><th>Escala</th><th>1cm no mapa =</th><th>Uso tipico</th></tr></thead>
          <tbody>
            <tr><td>1:25.000</td><td>250 m</td><td>Caminhada, detalhes locais</td></tr>
            <tr><td>1:50.000</td><td>500 m</td><td>Trilha, planejamento de rota</td></tr>
            <tr><td>1:100.000</td><td>1 km</td><td>Viagem regional</td></tr>
            <tr><td>1:250.000</td><td>2.5 km</td><td>Viagem entre cidades</td></tr>
            <tr><td>1:1.000.000</td><td>10 km</td><td>Visao geral de pais/regiao</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="nav-card">
      <h3>&#127912; Cores e Simbolos Comuns</h3>
      <div class="nav-colors-grid">
        <div class="nav-color-item"><span class="nav-color-swatch" style="background:#3b82f6"></span><strong>Azul</strong> — Agua (rios, lagos, mar)</div>
        <div class="nav-color-item"><span class="nav-color-swatch" style="background:#22c55e"></span><strong>Verde</strong> — Vegetacao, floresta</div>
        <div class="nav-color-item"><span class="nav-color-swatch" style="background:#a16207"></span><strong>Marrom</strong> — Curvas de nivel, relevo</div>
        <div class="nav-color-item"><span class="nav-color-swatch" style="background:#ef4444"></span><strong>Vermelho</strong> — Estradas principais</div>
        <div class="nav-color-item"><span class="nav-color-swatch" style="background:#111"></span><strong>Preto</strong> — Construcoes, limites, texto</div>
        <div class="nav-color-item"><span class="nav-color-swatch" style="background:#eab308"></span><strong>Amarelo</strong> — Areas urbanizadas</div>
        <div class="nav-color-item"><span class="nav-color-swatch" style="background:#fff;border:1px solid #555"></span><strong>Branco</strong> — Area aberta, campo</div>
        <div class="nav-color-item"><span class="nav-color-swatch" style="background:#a855f7"></span><strong>Roxo</strong> — Atualizacoes recentes</div>
      </div>
    </div>

    <div class="nav-card">
      <h3>&#128204; Orientando o Mapa</h3>
      <div class="nav-steps">
        <div class="nav-step"><span class="nav-step-num">1</span><span>Identifique o <strong>Norte</strong> (seta do mapa ou topo)</span></div>
        <div class="nav-step"><span class="nav-step-num">2</span><span>Use bussola, sol ou estrelas para encontrar o Norte real</span></div>
        <div class="nav-step"><span class="nav-step-num">3</span><span>Gire o mapa ate o <strong>Norte do mapa</strong> apontar para o Norte real</span></div>
        <div class="nav-step"><span class="nav-step-num">4</span><span>Identifique <strong>2 pontos de referencia</strong> visiveis (morro, rio, estrada)</span></div>
        <div class="nav-step"><span class="nav-step-num">5</span><span>Confirme sua posicao pela <strong>intersecao</strong> das linhas de visada</span></div>
      </div>
    </div>
  </div>`;
}

function _navDiagramContour() {
  return `<svg viewBox="0 0 400 200" class="nav-svg">
    <!-- Contour lines for a hill -->
    <ellipse cx="150" cy="110" rx="120" ry="80" fill="none" stroke="#864" stroke-width="1" opacity="0.4"/>
    <ellipse cx="150" cy="110" rx="95" ry="65" fill="none" stroke="#864" stroke-width="1" opacity="0.5"/>
    <ellipse cx="150" cy="110" rx="70" ry="48" fill="none" stroke="#864" stroke-width="1.5" opacity="0.7"/>
    <text x="220" y="68" fill="#864" font-size="8">300m</text>
    <ellipse cx="150" cy="110" rx="45" ry="32" fill="none" stroke="#864" stroke-width="1" opacity="0.6"/>
    <ellipse cx="150" cy="110" rx="22" ry="16" fill="none" stroke="#864" stroke-width="1" opacity="0.8"/>
    <text x="145" y="114" fill="#ff0" font-size="9" text-anchor="middle">&#9650; 500m</text>
    <!-- Valley -->
    <path d="M300,40 Q320,100 300,180" fill="none" stroke="#38f" stroke-width="1.5"/>
    <text x="310" y="115" fill="#38f" font-size="9">Rio</text>
    <!-- Labels -->
    <text x="150" y="195" fill="#aaa" font-size="10" text-anchor="middle">Curvas juntas = ingreme | Separadas = suave</text>
    <text x="55" y="50" fill="#aaa" font-size="9">Encosta suave</text>
    <line x1="55" y1="53" x2="55" y2="75" stroke="#aaa" stroke-width="0.5" stroke-dasharray="2,2"/>
    <text x="240" y="140" fill="#aaa" font-size="9">Encosta ingreme</text>
    <line x1="240" y1="130" x2="222" y2="120" stroke="#aaa" stroke-width="0.5" stroke-dasharray="2,2"/>
  </svg>`;
}

/* ── Watch Method ──────────────────────────────────────────────────────────── */
function _navWatch() {
  const isNorth = _navHemisphere === 'north';
  return `
  <div class="nav-section">
    <div class="nav-card nav-card-primary">
      <h3>&#9200; Navegacao por Relogio Analogico</h3>
      <p class="nav-subtitle">${isNorth ?
        'Hemisferio Norte — encontrando SUL' :
        'Hemisferio Sul — encontrando NORTE'}</p>
      <div class="nav-diagram">
        ${_navDiagramWatch()}
      </div>
      <div class="nav-steps">
        ${isNorth ? `
        <div class="nav-step"><span class="nav-step-num">1</span><span>Segure o relogio <strong>horizontalmente</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">2</span><span>Aponte o <strong>ponteiro das horas</strong> diretamente para o <strong>sol</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">3</span><span>Encontre o ponto medio entre o ponteiro das horas e o <strong>12</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">4</span><span>Esse ponto medio aponta para o <strong>SUL</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">5</span><span>O lado oposto e o <strong>NORTE</strong></span></div>
        ` : `
        <div class="nav-step"><span class="nav-step-num">1</span><span>Segure o relogio <strong>horizontalmente</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">2</span><span>Aponte o <strong>12</strong> do relogio diretamente para o <strong>sol</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">3</span><span>Encontre o ponto medio entre o <strong>12</strong> e o <strong>ponteiro das horas</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">4</span><span>Esse ponto medio aponta para o <strong>NORTE</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">5</span><span>O lado oposto e o <strong>SUL</strong></span></div>
        `}
      </div>
    </div>

    <div class="nav-card">
      <h3>&#128338; Se voce so tem relogio digital</h3>
      <div class="nav-steps">
        <div class="nav-step"><span class="nav-step-num">1</span><span>Desenhe um circulo no chao ou papel</span></div>
        <div class="nav-step"><span class="nav-step-num">2</span><span>Marque a hora atual como num relogio analogico</span></div>
        <div class="nav-step"><span class="nav-step-num">3</span><span>Siga o mesmo metodo descrito acima</span></div>
      </div>
    </div>

    <div class="nav-card">
      <h3>&#9888;&#65039; Limitacoes</h3>
      <ul class="nav-list">
        <li>Funciona melhor em <strong>latitudes acima de 20 graus</strong></li>
        <li>Perto do equador, o metodo perde precisao</li>
        <li>Se estiver em <strong>horario de verao</strong>, use a hora -1 para compensar</li>
        <li>Precisao de <strong>&#177;15 graus</strong> em condicoes normais</li>
        <li>Mais preciso no <strong>inverno</strong> que no verao</li>
      </ul>
    </div>
  </div>`;
}

function _navDiagramWatch() {
  const isNorth = _navHemisphere === 'north';
  // Draw a clock face; hour hand at ~2 o'clock (pointing at sun), midpoint indicated
  return `<svg viewBox="0 0 300 260" class="nav-svg">
    <!-- Clock face -->
    <circle cx="150" cy="130" r="90" fill="none" stroke="#555" stroke-width="2"/>
    <circle cx="150" cy="130" r="3" fill="#fff"/>
    <!-- 12 -->
    <text x="150" y="55" fill="#fff" font-size="12" text-anchor="middle" font-weight="bold">12</text>
    <!-- 3 -->
    <text x="235" y="135" fill="#aaa" font-size="11" text-anchor="middle">3</text>
    <!-- 6 -->
    <text x="150" y="215" fill="#aaa" font-size="11" text-anchor="middle">6</text>
    <!-- 9 -->
    <text x="65" y="135" fill="#aaa" font-size="11" text-anchor="middle">9</text>
    ${isNorth ? `
    <!-- Hour hand pointing at ~2 (sun) -->
    <line x1="150" y1="130" x2="205" y2="75" stroke="#f80" stroke-width="3"/>
    <text x="220" y="65" fill="#ff0" font-size="10">&#9728; Sol</text>
    <!-- Midpoint line (between hour hand and 12) -->
    <line x1="150" y1="130" x2="185" y2="60" stroke="#0f0" stroke-width="1.5" stroke-dasharray="4,3"/>
    <text x="192" y="38" fill="#0f0" font-size="11" font-weight="bold">&#8594; SUL</text>
    <!-- North opposite -->
    <text x="108" y="222" fill="#0ff" font-size="10" font-weight="bold">&#8592; NORTE</text>
    ` : `
    <!-- 12 pointing at sun -->
    <line x1="150" y1="130" x2="150" y2="55" stroke="#f80" stroke-width="2" stroke-dasharray="4,3"/>
    <text x="150" y="38" fill="#ff0" font-size="10" text-anchor="middle">&#9728; Sol (aponte 12 aqui)</text>
    <!-- Hour hand at ~2 -->
    <line x1="150" y1="130" x2="205" y2="75" stroke="#fff" stroke-width="3"/>
    <text x="222" y="70" fill="#aaa" font-size="9">Horas</text>
    <!-- Midpoint -->
    <line x1="150" y1="130" x2="185" y2="60" stroke="#0f0" stroke-width="1.5" stroke-dasharray="4,3"/>
    <text x="192" y="38" fill="#0f0" font-size="11" font-weight="bold">&#8594; NORTE</text>
    <text x="108" y="222" fill="#0ff" font-size="10" font-weight="bold">&#8592; SUL</text>
    `}
  </svg>`;
}

/* ── Cardinal Points by Sun ────────────────────────────────────────────────── */
function _navCardinal() {
  const isNorth = _navHemisphere === 'north';
  return `
  <div class="nav-section">
    <div class="nav-card nav-card-primary">
      <h3>&#127749; Pontos Cardeais pelo Sol</h3>
      <div class="nav-diagram">
        ${_navDiagramSunPath()}
      </div>
    </div>

    <div class="nav-card">
      <h3>&#9728;&#65039; Regras Basicas</h3>
      <div class="nav-info-grid">
        <div class="nav-info-box nav-info-east">
          <div class="nav-info-icon">&#127749;</div>
          <div><strong>Nascer do Sol</strong></div>
          <div>Aproximadamente <strong>LESTE</strong></div>
          <div class="nav-info-sub">~05h-07h (varia por estacao)</div>
        </div>
        <div class="nav-info-box nav-info-west">
          <div class="nav-info-icon">&#127751;</div>
          <div><strong>Por do Sol</strong></div>
          <div>Aproximadamente <strong>OESTE</strong></div>
          <div class="nav-info-sub">~17h-19h (varia por estacao)</div>
        </div>
        <div class="nav-info-box nav-info-noon">
          <div class="nav-info-icon">&#9728;&#65039;</div>
          <div><strong>Meio-dia Solar</strong></div>
          <div>Sol no ponto mais alto</div>
          <div class="nav-info-sub">${isNorth ?
            'Aponta para <strong>SUL</strong> (hemis. norte)' :
            'Aponta para <strong>NORTE</strong> (hemis. sul)'}</div>
        </div>
      </div>
    </div>

    <div class="nav-card">
      <h3>&#128197; Variacao por Estacao</h3>
      <ul class="nav-list">
        <li><strong>Equinocios</strong> (mar/set) — Sol nasce exatamente no Leste e poe exatamente no Oeste</li>
        <li><strong>Solsticio de verao</strong> — Sol nasce e poe mais ao ${isNorth ? 'Norte (Nordeste/Noroeste)' : 'Sul (Sudeste/Sudoeste)'}</li>
        <li><strong>Solsticio de inverno</strong> — Sol nasce e poe mais ao ${isNorth ? 'Sul (Sudeste/Sudoeste)' : 'Norte (Nordeste/Noroeste)'}</li>
        <li>A variacao pode ser de ate <strong>30 graus</strong> dependendo da latitude</li>
      </ul>
    </div>

    <div class="nav-card">
      <h3>&#128205; Encontrando o Norte com precisao</h3>
      <div class="nav-steps">
        <div class="nav-step"><span class="nav-step-num">1</span><span>De manha, fique de frente para o <strong>nascer do sol</strong> (Leste)</span></div>
        <div class="nav-step"><span class="nav-step-num">2</span><span>Estenda os bracos: <strong>esquerda = Norte</strong>, <strong>direita = Sul</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">3</span><span>Atras de voce = <strong>Oeste</strong></span></div>
        <div class="nav-step"><span class="nav-step-num">4</span><span>Ao meio-dia, a sombra mais curta aponta ${isNorth ? '<strong>Norte</strong> (hemisferio norte)' : '<strong>Sul</strong> (hemisferio sul)'}</span></div>
      </div>
    </div>

    <div class="nav-card">
      <h3>&#127795; Indicadores Naturais</h3>
      <ul class="nav-list">
        <li><strong>Musgo</strong> tende a crescer no lado com <strong>menos sol</strong> (${isNorth ? 'Norte' : 'Sul'} — mas nao e 100% confiavel)</li>
        <li><strong>Antenas parabolicas</strong> geralmente apontam para o equador (referencia em areas urbanas)</li>
        <li><strong>Igrejas</strong> tradicionais tem o altar voltado para o Leste</li>
        <li><strong>Cupinzeiros</strong> no Brasil — eixo maior geralmente Norte-Sul</li>
        <li><strong>Neve</strong> derrete primeiro no lado que recebe mais sol (${isNorth ? 'Sul' : 'Norte'})</li>
        <li><strong>Flores</strong> como girassois tendem a seguir o sol (Leste para Oeste)</li>
      </ul>
    </div>
  </div>`;
}

function _navDiagramSunPath() {
  const isNorth = _navHemisphere === 'north';
  return `<svg viewBox="0 0 400 180" class="nav-svg">
    <!-- Horizon -->
    <line x1="30" y1="140" x2="370" y2="140" stroke="#444" stroke-width="1.5"/>
    <text x="200" y="170" fill="#555" font-size="10" text-anchor="middle">Horizonte</text>
    <!-- Sun path arc -->
    <path d="M60,140 Q200,${isNorth ? '10' : '20'} 340,140" fill="none" stroke="#ff0" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.6"/>
    <!-- Sunrise -->
    <circle cx="60" cy="140" r="12" fill="#f80" opacity="0.6"/>
    <text x="60" y="125" fill="#f80" font-size="10" text-anchor="middle" font-weight="bold">Nascer</text>
    <text x="60" y="160" fill="#0f0" font-size="11" text-anchor="middle" font-weight="bold">LESTE</text>
    <!-- Noon -->
    <circle cx="200" cy="${isNorth ? '25' : '30'}" r="14" fill="#ff0" opacity="0.5"/>
    <circle cx="200" cy="${isNorth ? '25' : '30'}" r="8" fill="#ff0" opacity="0.8"/>
    <text x="200" y="${isNorth ? '12' : '17'}" fill="#fff" font-size="9" text-anchor="middle">Meio-dia</text>
    <!-- Noon shadow direction -->
    <line x1="200" y1="140" x2="${isNorth ? '200' : '200'}" y2="${isNorth ? '105' : '100'}" stroke="#0f0" stroke-width="1" stroke-dasharray="3,2"/>
    <text x="${isNorth ? '218' : '218'}" y="${isNorth ? '110' : '105'}" fill="#0f0" font-size="9">${isNorth ? '&#8593; Sombra=Norte' : '&#8593; Sombra=Sul'}</text>
    <!-- Sunset -->
    <circle cx="340" cy="140" r="12" fill="#f44" opacity="0.6"/>
    <text x="340" y="125" fill="#f44" font-size="10" text-anchor="middle" font-weight="bold">Por-do-sol</text>
    <text x="340" y="160" fill="#0f0" font-size="11" text-anchor="middle" font-weight="bold">OESTE</text>
    <!-- Direction indicator -->
    <text x="200" y="155" fill="#0ff" font-size="10" text-anchor="middle">${isNorth ? '&#8595; SUL (sol ao meio-dia)' : '&#8593; NORTE (sol ao meio-dia)'}</text>
  </svg>`;
}

/* ── Step Calculator ──────────────────────────────────────────────────────── */
function navCalcDist() {
  const steps = parseInt(document.getElementById('navStepCount')?.value) || 0;
  const stepsPerKm = parseInt(document.getElementById('navTerrain')?.value) || 1250;
  const km = steps / stepsPerKm;
  const m = Math.round(km * 1000);
  const el = document.getElementById('navDistResult');
  if (el) el.innerHTML = `Distancia estimada: <strong>${km.toFixed(2)} km</strong> (${m} m)`;
}

// Expose to window
window.navigationInit = navigationInit;
window.navSetSection = navSetSection;
window.navSetHemisphere = navSetHemisphere;
window.navCalcDist = navCalcDist;

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ═══ Pharmacy / Kit Medico App ═══                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

const PHARM_DISCLAIMER = '\u26a0\ufe0f AVISO: Consulte SEMPRE um medico ou profissional de saude antes de usar qualquer medicamento. Estas informacoes sao para situacoes de emergencia quando nao ha acesso medico disponivel.';

const PHARM_CAT_LABELS = {
  pain: 'Dor/Febre', infection: 'Infeccao', digestive: 'Digestivo',
  allergy: 'Alergia', cardiac: 'Cardiaco', skin: 'Pele/Feridas',
  respiratory: 'Respiratorio', other: 'Outros'
};

const PHARM_CAT_ICONS = {
  pain: '\ud83e\ude79', infection: '\ud83e\udda0', digestive: '\ud83e\ude7a',
  allergy: '\ud83e\udd27', cardiac: '\u2764\ufe0f', skin: '\ud83e\ude79',
  respiratory: '\ud83e\udec1', other: '\ud83d\udc8a'
};

const PHARM_DB = [
  // ── Dor/Febre ──
  {
    id: 'paracetamol', generic: 'Paracetamol (Acetaminofeno)', brand: 'Tylenol, Dorflex, Novalgina*',
    category: 'pain', icon: '\ud83d\udc8a',
    use: 'Dor leve a moderada, febre, dor de cabeca, dor muscular',
    doseAdult: '500-1000 mg a cada 6-8h (max 4g/dia)',
    doseChild: '10-15 mg/kg a cada 6h (max 5 doses/dia)',
    contraindications: 'Doenca hepatica grave, alcoolismo cronico, alergia ao composto',
    sideEffects: 'Raro em doses corretas. Excesso causa dano hepatico GRAVE',
    expiry: '2-3 anos',
    natural: ['salgueiro', 'gengibre'],
    notes: 'Mais seguro que ibuprofeno para estomago. NAO misturar com alcool.'
  },
  {
    id: 'ibuprofeno', generic: 'Ibuprofeno', brand: 'Advil, Alivium, Motrin',
    category: 'pain', icon: '\ud83d\udc8a',
    use: 'Dor, febre, inflamacao, colica menstrual, dor muscular',
    doseAdult: '200-400 mg a cada 6-8h (max 1200 mg/dia sem receita)',
    doseChild: '5-10 mg/kg a cada 6-8h (criancas >6 meses)',
    contraindications: 'Ulcera gastrica, insuficiencia renal, gravidez (3o trimestre), alergia a AINEs, dengue',
    sideEffects: 'Dor de estomago, nausea, risco de sangramento GI',
    expiry: '2-3 anos',
    natural: ['curcuma', 'gengibre', 'arnica'],
    notes: 'Anti-inflamatorio. Tomar com alimento. NUNCA usar se suspeita de dengue.'
  },
  {
    id: 'dipirona', generic: 'Dipirona (Metamizol)', brand: 'Novalgina, Anador',
    category: 'pain', icon: '\ud83d\udc8a',
    use: 'Dor intensa, febre alta, colicas',
    doseAdult: '500-1000 mg a cada 6h (max 4g/dia)',
    doseChild: '10-15 mg/kg a cada 6h',
    contraindications: 'Alergia a pirazolonicos, porfiria, deficiencia de G6PD, gravidez (1o/3o trimestre)',
    sideEffects: 'Risco raro de agranulocitose. Queda de pressao se IV rapido',
    expiry: '2-3 anos',
    natural: ['salgueiro', 'camomila'],
    notes: 'Muito usada no Brasil. Proibida em varios paises (EUA, UK). Potente antipiretico.'
  },
  {
    id: 'aspirina', generic: 'Acido Acetilsalicilico (AAS)', brand: 'Aspirina, Buferin',
    category: 'pain', icon: '\ud83d\udc8a',
    use: 'Dor, febre, anti-inflamatorio, prevencao cardiovascular',
    doseAdult: '500-1000 mg a cada 6-8h (dor) ou 100 mg/dia (cardiaco)',
    doseChild: 'NAO usar em criancas < 12 anos (risco de Sindrome de Reye)',
    contraindications: 'Criancas com febre/virus, ulcera, hemofilia, dengue, alergia a AINEs',
    sideEffects: 'Sangramento GI, zumbido em doses altas',
    expiry: '3-5 anos',
    natural: ['salgueiro'],
    notes: 'Em caso de INFARTO: mastigar 1 aspirina 300mg IMEDIATAMENTE pode salvar vidas.'
  },
  // ── Infeccao ──
  {
    id: 'amoxicilina', generic: 'Amoxicilina', brand: 'Amoxil, Novocilin',
    category: 'infection', icon: '\ud83e\udda0',
    use: 'Infeccoes bacterianas: ouvido, garganta, sinusite, urinaria, pele, dentes',
    doseAdult: '500 mg a cada 8h por 7-10 dias',
    doseChild: '25-50 mg/kg/dia dividido em 3 doses',
    contraindications: 'Alergia a penicilina/cefalosporinas, mononucleose',
    sideEffects: 'Diarreia, nausea, erupcao cutanea, candidiase',
    expiry: '2-3 anos (comprimido), menos em suspensao',
    natural: ['alho', 'mel', 'propolis'],
    notes: 'Antibiotico de AMPLO ESPECTRO. Completar TODO o tratamento mesmo se melhorar.'
  },
  {
    id: 'azitromicina', generic: 'Azitromicina', brand: 'Zitromax, Azi',
    category: 'infection', icon: '\ud83e\udda0',
    use: 'Infeccoes respiratorias, ouvido, pele, DSTs (clamídia)',
    doseAdult: '500 mg/dia por 3 dias OU 500mg D1 + 250mg D2-D5',
    doseChild: '10 mg/kg/dia por 3 dias',
    contraindications: 'Alergia a macrolideos, problemas hepaticos graves',
    sideEffects: 'Nausea, diarreia, dor abdominal',
    expiry: '2-3 anos',
    natural: ['alho', 'equinacea'],
    notes: 'Alternativa para alergicos a penicilina. Tratamento curto (3-5 dias).'
  },
  {
    id: 'metronidazol', generic: 'Metronidazol', brand: 'Flagyl',
    category: 'infection', icon: '\ud83e\udda0',
    use: 'Infeccoes anaerobias, giardiase, amebíase, vaginose bacteriana',
    doseAdult: '250-500 mg a cada 8h por 7-10 dias',
    doseChild: '15-30 mg/kg/dia dividido em 3 doses',
    contraindications: 'Primeiro trimestre de gravidez, alcoolismo',
    sideEffects: 'Nausea, gosto metalico, urina escura',
    expiry: '2-3 anos',
    natural: ['alho'],
    notes: 'PROIBIDO consumir alcool durante e ate 48h apos (efeito antabuse grave).'
  },
  {
    id: 'cefalexina', generic: 'Cefalexina', brand: 'Keflex',
    category: 'infection', icon: '\ud83e\udda0',
    use: 'Infeccoes de pele, urinarias, ossos, garganta',
    doseAdult: '500 mg a cada 6h por 7-10 dias',
    doseChild: '25-50 mg/kg/dia dividido em 4 doses',
    contraindications: 'Alergia grave a penicilina (risco cruzado ~10%)',
    sideEffects: 'Diarreia, nausea, erupcao cutanea',
    expiry: '2-3 anos',
    natural: ['mel-manuka', 'propolis'],
    notes: 'Boa opcao para infeccoes de pele e feridas infectadas.'
  },
  // ── Digestivo ──
  {
    id: 'omeprazol', generic: 'Omeprazol', brand: 'Losec, Peprazol',
    category: 'digestive', icon: '\ud83e\ude7a',
    use: 'Azia, refluxo, ulcera gastrica, gastrite, protecao gastrica com AINEs',
    doseAdult: '20 mg 1x/dia em jejum (30 min antes cafe)',
    doseChild: '0.5-1 mg/kg/dia (>1 ano)',
    contraindications: 'Uso com clopidogrel (reduz efeito), alergia ao composto',
    sideEffects: 'Dor de cabeca, diarreia. Uso prolongado: deficiencia B12/magnesio',
    expiry: '2-3 anos',
    natural: ['camomila', 'gengibre', 'espinheira-santa'],
    notes: 'Tomar em JEJUM para funcionar. Nao mastigar a capsula.'
  },
  {
    id: 'loperamida', generic: 'Loperamida', brand: 'Imosec',
    category: 'digestive', icon: '\ud83e\ude7a',
    use: 'Diarreia aguda (nao infecciosa)',
    doseAdult: '4 mg dose inicial, depois 2 mg apos cada evacuacao liquida (max 16 mg/dia)',
    doseChild: 'NAO recomendado < 6 anos. 6-12 anos: consultar dose/peso',
    contraindications: 'Diarreia com sangue/febre alta (pode ser infeccao), colite, obstrucao intestinal',
    sideEffects: 'Constipacao, dor abdominal, boca seca',
    expiry: '3-5 anos',
    natural: ['camomila', 'hortela'],
    notes: 'NAO usar se febre alta + diarreia com sangue (pode ser infeccao bacteriana que precisa sair).'
  },
  {
    id: 'sro', generic: 'Sais de Reidratacao Oral (SRO)', brand: 'Pedialyte, SRO (envelopes)',
    category: 'digestive', icon: '\ud83e\ude7a',
    use: 'Desidratacao por diarreia, vomito, calor excessivo',
    doseAdult: 'Beber 200-400 ml apos cada evacuacao liquida',
    doseChild: '50-100 ml apos cada evacuacao (bebe: colher de cha frequente)',
    contraindications: 'Vomitos incoercíveis (pode precisar IV)',
    sideEffects: 'Nenhum significativo',
    expiry: '3-5 anos (envelope fechado)',
    natural: [],
    notes: 'RECEITA CASEIRA: 1L agua fervida + 3 col sopa acucar + 1 col cha sal + suco 1/2 limao. SALVA VIDAS.'
  },
  {
    id: 'buscopan', generic: 'Escopolamina (Hioscina)', brand: 'Buscopan',
    category: 'digestive', icon: '\ud83e\ude7a',
    use: 'Colicas abdominais, colica menstrual, colica renal, espasmos GI',
    doseAdult: '10-20 mg a cada 6-8h (max 60 mg/dia)',
    doseChild: '>6 anos: 10 mg a cada 8h',
    contraindications: 'Glaucoma de angulo fechado, obstrucao intestinal, miastenia gravis',
    sideEffects: 'Boca seca, visao turva, taquicardia',
    expiry: '2-3 anos',
    natural: ['hortela', 'camomila', 'erva-cidreira'],
    notes: 'Antiespasmódico. Otimo para colicas. Pode causar sonolencia.'
  },
  // ── Alergia ──
  {
    id: 'loratadina', generic: 'Loratadina', brand: 'Claritin, Loralerg',
    category: 'allergy', icon: '\ud83e\udd27',
    use: 'Rinite alergica, urticaria, coceira, alergia sazonal',
    doseAdult: '10 mg 1x/dia',
    doseChild: '2-6 anos: 5 mg/dia. >6 anos: 10 mg/dia',
    contraindications: 'Hipersensibilidade ao composto',
    sideEffects: 'Raro: dor de cabeca, boca seca. Pouca sonolencia',
    expiry: '2-3 anos',
    natural: ['hortela', 'mel-local'],
    notes: 'Anti-histaminico de 2a geracao — NAO causa sonolencia significativa.'
  },
  {
    id: 'dexclorfeniramina', generic: 'Dexclorfeniramina', brand: 'Polaramine',
    category: 'allergy', icon: '\ud83e\udd27',
    use: 'Reacoes alergicas, urticaria, picadas de inseto, rinite',
    doseAdult: '2 mg a cada 6-8h (max 12 mg/dia)',
    doseChild: '2-6 anos: 0.5 mg a cada 6-8h. 6-12 anos: 1 mg a cada 6-8h',
    contraindications: 'Asma aguda, glaucoma, retencao urinaria',
    sideEffects: 'SONOLENCIA (nao dirigir), boca seca, constipacao',
    expiry: '2-3 anos',
    natural: ['camomila-compressas'],
    notes: 'CAUSA SONOLENCIA. Util a noite. Para emergencia alergica grave: adrenalina.'
  },
  {
    id: 'prednisolona', generic: 'Prednisolona/Prednisona', brand: 'Predsim, Meticorten',
    category: 'allergy', icon: '\ud83e\udd27',
    use: 'Alergias graves, asma aguda, inflamacoes intensas, choque anafilatico (adjunto)',
    doseAdult: '20-60 mg/dia por 3-7 dias (reduzir gradualmente se >5 dias)',
    doseChild: '1-2 mg/kg/dia por 3-5 dias',
    contraindications: 'Infeccao fungica sistemica, tuberculose ativa nao tratada',
    sideEffects: 'Aumento apetite, insonia, aumento glicose. Uso prolongado: osteoporose, imunossupressao',
    expiry: '2-3 anos',
    natural: ['curcuma'],
    notes: 'Corticoide potente. Uso curto (3-7 dias) e seguro. NAO parar abruptamente se >2 semanas.'
  },
  // ── Cardiaco ──
  {
    id: 'captopril', generic: 'Captopril', brand: 'Capoten',
    category: 'cardiac', icon: '\u2764\ufe0f',
    use: 'Hipertensao arterial, crise hipertensiva, insuficiencia cardiaca',
    doseAdult: '25-50 mg a cada 8-12h. Crise: 25 mg sublingual',
    doseChild: 'Uso pediatrico sob supervisao medica',
    contraindications: 'Gravidez, estenose bilateral de arteria renal, hipercalemia',
    sideEffects: 'Tosse seca (frequente), tontura, hipotensao',
    expiry: '2-3 anos',
    natural: ['hibisco', 'alho'],
    notes: 'CRISE HIPERTENSIVA: 25mg sublingual. Se PA >180/120 + sintomas = EMERGENCIA.'
  },
  {
    id: 'atenolol', generic: 'Atenolol', brand: 'Atenol',
    category: 'cardiac', icon: '\u2764\ufe0f',
    use: 'Hipertensao, angina, arritmias, pos-infarto',
    doseAdult: '25-100 mg 1x/dia',
    doseChild: 'Uso pediatrico sob supervisao medica',
    contraindications: 'Asma/DPOC grave, bradicardia severa, choque cardiogenico, bloqueio AV',
    sideEffects: 'Bradicardia, cansaco, extremidades frias, tontura',
    expiry: '2-3 anos',
    natural: ['hibisco'],
    notes: 'Beta-bloqueador. NAO parar abruptamente (risco de rebote). Controlar pulso.'
  },
  {
    id: 'aas-cardiaco', generic: 'AAS 100mg (uso cardiaco)', brand: 'Aspirina Prevent, Somalgin',
    category: 'cardiac', icon: '\u2764\ufe0f',
    use: 'Prevencao de infarto e AVC, pos-stent, angina',
    doseAdult: '100 mg 1x/dia (apos refeicao)',
    doseChild: 'NAO indicado',
    contraindications: 'Ulcera ativa, hemofilia, alergia a AAS',
    sideEffects: 'Sangramento GI, dispepsia',
    expiry: '3-5 anos',
    natural: ['salgueiro'],
    notes: 'SUSPEITA DE INFARTO: mastigar 1 AAS 300mg imediatamente. Pode salvar vidas.'
  },
  // ── Pele/Feridas ──
  {
    id: 'neomicina-pomada', generic: 'Neomicina + Bacitracina (pomada)', brand: 'Nebacetin',
    category: 'skin', icon: '\ud83e\ude79',
    use: 'Feridas infectadas, cortes, queimaduras leves, escoriacoes',
    doseAdult: 'Aplicar fina camada 2-3x/dia na area limpa',
    doseChild: 'Mesmo que adulto',
    contraindications: 'Alergia a aminoglicosideos, feridas extensas (absorcao sistemica)',
    sideEffects: 'Raro: irritacao local, alergia de contato',
    expiry: '2-3 anos',
    natural: ['mel-manuka', 'babosa', 'calêndula'],
    notes: 'SEMPRE limpar a ferida com agua e sabao antes de aplicar. Trocar curativo 1-2x/dia.'
  },
  {
    id: 'sulfadiazina-prata', generic: 'Sulfadiazina de Prata 1%', brand: 'Dermazine',
    category: 'skin', icon: '\ud83e\ude79',
    use: 'Queimaduras (2o e 3o grau), prevencao de infeccao em queimaduras',
    doseAdult: 'Aplicar camada de ~3mm sobre queimadura limpa, 1-2x/dia',
    doseChild: 'NAO usar em recem-nascidos < 2 meses',
    contraindications: 'Alergia a sulfas, gravidez (final), prematuros',
    sideEffects: 'Descoloracao da pele (temporaria), leucopenia rara',
    expiry: '2-3 anos',
    natural: ['babosa', 'mel'],
    notes: 'PADRAO OURO para queimaduras. Manter curativo umido. NUNCA usar manteiga/pasta de dente em queimaduras.'
  },
  {
    id: 'miconazol', generic: 'Miconazol creme', brand: 'Vodol, Daktarin',
    category: 'skin', icon: '\ud83e\ude79',
    use: 'Micose de pele (pe de atleta, virilha), candidíase cutanea',
    doseAdult: 'Aplicar 2x/dia por 2-4 semanas',
    doseChild: 'Mesmo que adulto',
    contraindications: 'Hipersensibilidade a imidazolicos',
    sideEffects: 'Irritacao local leve, queimacao temporaria',
    expiry: '2-3 anos',
    natural: ['melaleuca'],
    notes: 'Continuar 1 semana APOS desaparecimento dos sintomas para evitar recidiva.'
  },
  {
    id: 'permanganato', generic: 'Permanganato de Potassio', brand: 'Permanganato',
    category: 'skin', icon: '\ud83e\ude79',
    use: 'Lavagem de feridas, desinfeccao, dermatites exsudativas',
    doseAdult: '1 comprimido em 4L de agua (solucao rosa claro) para banho/compressas',
    doseChild: 'Mesmo diluicao que adulto',
    contraindications: 'NAO usar puro/concentrado (queimadura quimica)',
    sideEffects: 'Mancha a pele e roupas. Concentrado causa queimadura',
    expiry: '5+ anos (comprimido)',
    natural: [],
    notes: 'SEMPRE diluir — solucao deve ficar ROSA CLARO, nunca roxa. Barato e eficaz para desinfeccao.'
  },
  // ── Respiratorio ──
  {
    id: 'salbutamol', generic: 'Salbutamol (inalatorio)', brand: 'Aerolin, Aerojet',
    category: 'respiratory', icon: '\ud83e\udec1',
    use: 'Asma aguda, broncoespasmo, falta de ar com chiado',
    doseAdult: '2-4 jatos (100mcg cada), repetir a cada 20 min se necessario (max 3 vezes)',
    doseChild: '2 jatos com espaçador, repetir a cada 20 min se necessario',
    contraindications: 'Taquicardia severa, arritmia cardiaca nao controlada',
    sideEffects: 'Tremor, taquicardia, palpitacoes, nervosismo',
    expiry: '2 anos',
    natural: ['eucalipto-inalacao', 'gengibre'],
    notes: 'EMERGENCIA DE ASMA: 4-8 jatos + esperar ambulancia. Usar SEMPRE com espacador.'
  },
  {
    id: 'ambroxol', generic: 'Ambroxol', brand: 'Mucosolvan',
    category: 'respiratory', icon: '\ud83e\udec1',
    use: 'Tosse com catarro, bronquite, secrecoes pulmonares',
    doseAdult: '30 mg a cada 8h',
    doseChild: '2-5 anos: 7.5 mg a cada 8h. 6-12 anos: 15 mg a cada 8h',
    contraindications: 'Primeiro trimestre gravidez',
    sideEffects: 'Nausea, dor abdominal rara',
    expiry: '2-3 anos',
    natural: ['eucalipto', 'mel', 'gengibre'],
    notes: 'Fluidifica o muco. Beber bastante agua durante o uso. Util em infeccoes respiratorias.'
  },
  {
    id: 'dextrometorfano', generic: 'Dextrometorfano', brand: 'Silencium, Benalet',
    category: 'respiratory', icon: '\ud83e\udec1',
    use: 'Tosse seca irritativa (sem catarro)',
    doseAdult: '10-20 mg a cada 4-6h (max 120 mg/dia)',
    doseChild: '6-12 anos: 5-10 mg a cada 4-6h',
    contraindications: 'Tosse produtiva (com catarro — precisa expectorar), uso de IMAO',
    sideEffects: 'Sonolencia, tontura, nausea',
    expiry: '2-3 anos',
    natural: ['mel', 'gengibre', 'limao'],
    notes: 'Apenas para tosse SECA. Se tem catarro, use expectorante (ambroxol), nao antitussigeno.'
  },
  // ── Outros ──
  {
    id: 'simeticona', generic: 'Simeticona', brand: 'Luftal',
    category: 'other', icon: '\ud83d\udc8a',
    use: 'Gases, distensao abdominal, colica de bebe (gases)',
    doseAdult: '40-125 mg apos refeicoes e ao deitar',
    doseChild: 'Lactentes: 2-3 gotas antes das mamadas',
    contraindications: 'Praticamente nenhuma',
    sideEffects: 'Nenhum significativo',
    expiry: '2-3 anos',
    natural: ['erva-doce', 'hortela'],
    notes: 'Muito seguro. Nao e absorvido pelo corpo — age mecanicamente quebrando bolhas de gas.'
  },
  {
    id: 'dimenidrinato', generic: 'Dimenidrinato', brand: 'Dramin',
    category: 'other', icon: '\ud83d\udc8a',
    use: 'Enjoo de movimento (cinetose), nausea, vomito, tontura',
    doseAdult: '50-100 mg a cada 6h (tomar 30 min antes da viagem)',
    doseChild: '2-6 anos: 12.5-25 mg a cada 6-8h. 6-12 anos: 25-50 mg a cada 6-8h',
    contraindications: 'Glaucoma, obstrucao urinaria, porfiria',
    sideEffects: 'SONOLENCIA intensa, boca seca, visao turva',
    expiry: '2-3 anos',
    natural: ['gengibre'],
    notes: 'CAUSA MUITA SONOLENCIA — nao dirigir/operar maquinas. Tomar ANTES de viajar.'
  },
  {
    id: 'vitamina-c', generic: 'Acido Ascorbico (Vitamina C)', brand: 'Cebion, Cewin',
    category: 'other', icon: '\ud83d\udc8a',
    use: 'Prevencao/tratamento de escorbuto, suporte imunologico, convalescenca',
    doseAdult: '500-1000 mg/dia',
    doseChild: '100-250 mg/dia',
    contraindications: 'Calculo renal (doses muito altas)',
    sideEffects: 'Doses altas: diarreia, calculo renal',
    expiry: '2-3 anos',
    natural: ['rosa-mosqueta', 'acerola', 'limao', 'goiaba'],
    notes: 'Em situacao de sobrevivencia prolongada, previne ESCORBUTO (sangramento gengival, fraqueza).'
  },
  {
    id: 'lidocaina-gel', generic: 'Lidocaina gel/spray', brand: 'Xylocaina, Xylestesin',
    category: 'other', icon: '\ud83d\udc8a',
    use: 'Anestesia local para dor em mucosas, feridas, procedimentos menores',
    doseAdult: 'Aplicar fina camada na area dolorida a cada 4-6h',
    doseChild: 'Usar com cautela e dose menor',
    contraindications: 'Alergia a anestesicos locais, area extensa (toxicidade sistemica)',
    sideEffects: 'Dormencia local (esperado), raro: reacao alergica',
    expiry: '2-3 anos',
    natural: ['cravo-da-india'],
    notes: 'Para dor de dente: aplicar gel direto na gengiva. CRAVO-DA-INDIA e anestesico natural.'
  },
  {
    id: 'ivermectina', generic: 'Ivermectina', brand: 'Revectina',
    category: 'other', icon: '\ud83d\udc8a',
    use: 'Parasitoses: sarna (escabiose), piolho, lombriga, bicho-geografico',
    doseAdult: '200 mcg/kg dose unica (repetir em 7-14 dias para sarna)',
    doseChild: '>15 kg: mesma dose por peso. NAO usar < 15 kg',
    contraindications: 'Criancas < 15 kg, gravidez, amamentacao, meningite (Loa loa)',
    sideEffects: 'Tontura, nausea, coceira (reacao da morte do parasita)',
    expiry: '3-5 anos',
    natural: ['neem'],
    notes: 'Dose UNICA por peso corporal. Para sarna: tratar TODOS os contatos. Lavar roupas/cama.'
  },
];

/* ── Substitutos Naturais (cross-ref com Guia de Plantas) ── */
const PHARM_NATURAL = {
  'salgueiro': { name: 'Salgueiro (casca)', icon: '\ud83c\udf33', plantRef: null,
    use: 'Contem salicina (precursor da aspirina). Analgesico e antipiretico natural',
    prep: 'Cha da casca: 1-2 col cha de casca seca em 250ml agua fervente por 15 min',
    warn: 'Mesmas contraindicacoes da aspirina. Nao usar em criancas.' },
  'gengibre': { name: 'Gengibre', icon: '\ud83e\uddc0', plantRef: null,
    use: 'Anti-inflamatorio, antinauseante, analgesico, digestivo',
    prep: 'Cha: 2-3 rodelas finas em agua fervente por 10 min. Mastigar pedaco fresco para nausea',
    warn: 'Pode interagir com anticoagulantes. Evitar em excesso na gravidez.' },
  'curcuma': { name: 'Curcuma (Acafrao-da-terra)', icon: '\ud83d\udfe1', plantRef: null,
    use: 'Anti-inflamatorio potente (curcumina), antioxidante',
    prep: 'Pasta dourada: curcuma + pimenta preta + oleo de coco. Cha: 1 col cha em agua quente',
    warn: 'Pode interagir com anticoagulantes. Mancha tudo de amarelo.' },
  'arnica': { name: 'Arnica (uso externo)', icon: '\ud83c\udf3b', plantRef: null,
    use: 'Contusoes, hematomas, dor muscular, inchaço',
    prep: 'Compressa: cha concentrado aplicado com pano. Gel/pomada de arnica na area',
    warn: 'APENAS USO EXTERNO. Ingestao e TOXICA. Nao aplicar em feridas abertas.' },
  'camomila': { name: 'Camomila', icon: '\ud83c\udf3c', plantRef: null,
    use: 'Calmante, digestivo, anti-inflamatorio leve, colicas',
    prep: 'Cha: 1-2 col cha de flores em 200ml agua quente por 5-10 min',
    warn: 'Pode causar reacao em alergicos a plantas da familia Asteraceae.' },
  'alho': { name: 'Alho', icon: '\ud83e\uddc4', plantRef: null,
    use: 'Antibiotico natural, antiviral, antifungico, reduz pressao arterial',
    prep: 'Comer 1-2 dentes CRUS amassados (ativar alicina). Esperar 10 min apos amassar antes de comer',
    warn: 'Pode interagir com anticoagulantes. Nao usar antes de cirurgias.' },
  'mel': { name: 'Mel puro', icon: '\ud83c\udf6f', plantRef: null,
    use: 'Antibacteriano, cicatrizante, antitussigeno, energetico',
    prep: 'Tosse: 1 col sopa puro ou com limao. Feridas: aplicar mel puro diretamente',
    warn: 'NUNCA dar mel para bebes < 1 ano (risco de botulismo).' },
  'propolis': { name: 'Propolis', icon: '\ud83d\udc1d', plantRef: null,
    use: 'Antibiotico natural, antiviral, anti-inflamatorio, cicatrizante',
    prep: 'Tintura: 15-30 gotas em agua 2-3x/dia. Spray para garganta inflamada',
    warn: 'Alergicos a produtos de abelha devem evitar.' },
  'hortela': { name: 'Hortela', icon: '\ud83c\udf3f', plantRef: null,
    use: 'Digestivo, antigases, descongestionante nasal, analgesico leve',
    prep: 'Cha: folhas frescas em agua quente. Inalacao: folhas em agua fervente',
    warn: 'Pode piorar refluxo gastroesofagico em algumas pessoas.' },
  'eucalipto': { name: 'Eucalipto (inalacao)', icon: '\ud83c\udf43', plantRef: null,
    use: 'Descongestionante nasal, expectorante, antisseptico respiratorio',
    prep: 'Inalacao: folhas em agua fervente, respirar vapor. Nao ingerir oleo essencial',
    warn: 'NAO ingerir oleo de eucalipto (toxico). Apenas inalacao ou uso externo.' },
  'babosa': { name: 'Babosa (Aloe vera)', icon: '\ud83c\udf35', plantRef: null,
    use: 'Queimaduras, cicatrizacao, hidratacao da pele',
    prep: 'Gel fresco da folha aplicado diretamente na pele. Trocar a cada poucas horas',
    warn: 'NAO ingerir o gel amarelo (aloina) — e laxante forte e toxico.' },
  'mel-manuka': { name: 'Mel de Manuka', icon: '\ud83c\udf6f', plantRef: null,
    use: 'Cicatrizacao avancada de feridas, antibacteriano potente',
    prep: 'Aplicar fina camada diretamente na ferida limpa, cobrir com curativo',
    warn: 'Se nao disponivel, mel puro comum tambem funciona (menos potente).' },
  'melaleuca': { name: 'Melaleuca (Tea Tree)', icon: '\ud83c\udf3f', plantRef: null,
    use: 'Antifungico, antibacteriano, acne, micoses',
    prep: 'Oleo essencial diluido em oleo carreador (5-10 gotas em 30ml). Aplicar na area',
    warn: 'NUNCA ingerir. Pode irritar pele sensivel — sempre diluir.' },
  'hibisco': { name: 'Hibisco', icon: '\ud83c\udf3a', plantRef: null,
    use: 'Reduz pressao arterial leve, antioxidante, diuretico suave',
    prep: 'Cha: 1-2 col sopa de flores secas em 250ml agua quente por 10 min',
    warn: 'Pode potencializar medicamentos para pressao — monitorar.' },
  'equinacea': { name: 'Equinacea', icon: '\ud83c\udf3e', plantRef: null,
    use: 'Estimulante imunologico, prevencao e tratamento de resfriados',
    prep: 'Tintura: 20-30 gotas 3x/dia. Cha: raiz seca em agua fervente 15 min',
    warn: 'Nao usar por mais de 8 semanas seguidas. Evitar em doencas autoimunes.' },
  'erva-doce': { name: 'Erva-doce (Funcho)', icon: '\ud83c\udf3f', plantRef: null,
    use: 'Gases, colica de bebe, digestao, galactagogo (estimula leite materno)',
    prep: 'Cha: 1 col cha de sementes em 200ml agua quente por 10 min',
    warn: 'Contem compostos estrogenicos — usar com moderacao.' },
  'erva-cidreira': { name: 'Erva-cidreira (Melissa)', icon: '\ud83c\udf3f', plantRef: null,
    use: 'Calmante, ansiedade, insonia, colicas, herpes labial (topico)',
    prep: 'Cha: folhas frescas ou secas em agua quente por 5-10 min',
    warn: 'Pode interagir com sedativos e medicamentos para tireoide.' },
  'espinheira-santa': { name: 'Espinheira-santa', icon: '\ud83c\udf3f', plantRef: null,
    use: 'Gastrite, ulcera gastrica, azia, dispepsia',
    prep: 'Cha: 1 col sopa de folhas em 250ml agua fervente por 10 min. Tomar antes refeicoes',
    warn: 'Nao usar na gravidez/amamentacao.' },
  'cravo-da-india': { name: 'Cravo-da-india', icon: '\ud83e\udde1', plantRef: null,
    use: 'Anestesico dental natural (eugenol), antisseptico, digestivo',
    prep: 'Dor de dente: morder cravo no local da dor ou aplicar oleo de cravo com algodao',
    warn: 'Oleo puro pode irritar mucosas. Diluir para uso prolongado.' },
  'neem': { name: 'Neem (Nim)', icon: '\ud83c\udf33', plantRef: null,
    use: 'Antiparasitario, repelente natural, antifungico',
    prep: 'Oleo: diluido na pele como repelente. Folhas: cha para parasitas (com cautela)',
    warn: 'NAO ingerir oleo de neem. Toxico em grandes doses. Nao usar na gravidez.' },
  'mel-local': { name: 'Mel Local (dessensibilizacao)', icon: '\ud83c\udf6f', plantRef: null,
    use: 'Alergias sazonais (teoria da dessensibilizacao com polen local)',
    prep: '1 colher de mel LOCAL cru diariamente por meses antes da temporada de alergia',
    warn: 'Evidencia cientifica limitada. Nunca dar mel a bebes < 1 ano.' },
  'calêndula': { name: 'Calendula', icon: '\ud83c\udf3b', plantRef: null,
    use: 'Cicatrizante, anti-inflamatorio topico, queimaduras leves, assaduras',
    prep: 'Compressa de cha concentrado ou pomada de calendula na area afetada',
    warn: 'Alergia possivel em sensiveis a Asteraceae. Apenas uso externo.' },
  'camomila-compressas': { name: 'Camomila (compressas)', icon: '\ud83c\udf3c', plantRef: null,
    use: 'Alivio de coceira, irritacao de pele, olhos irritados',
    prep: 'Cha forte resfriado aplicado com gaze/pano limpo na area por 10-15 min',
    warn: 'Verificar alergia antes. Nao usar em feridas abertas.' },
};

/* ── Sintomas Comuns ── */
const PHARM_SYMPTOMS = [
  { id: 'fever', name: 'Febre', icon: '\ud83c\udf21\ufe0f',
    desc: 'Temperatura acima de 37.5C',
    meds: ['paracetamol', 'ibuprofeno', 'dipirona'],
    tips: 'Hidratar muito. Compressas mornas (nao geladas). Roupas leves. Se > 39.5C por mais de 48h: buscar ajuda medica.',
    emergency: 'Febre > 39.5C que nao cede, convulsao febril, rigidez de nuca, manchas roxas na pele' },
  { id: 'headache', name: 'Dor de Cabeca', icon: '\ud83e\udde0',
    desc: 'Cefaleia tensional, enxaqueca, sinusite',
    meds: ['paracetamol', 'ibuprofeno', 'dipirona'],
    tips: 'Descansar em ambiente escuro e silencioso. Hidratar. Compressa fria na testa. Verificar se nao e desidratacao.',
    emergency: 'Pior dor de cabeca da vida (subita), febre alta + rigidez nuca, confusao mental, vomitos em jato' },
  { id: 'diarrhea', name: 'Diarreia', icon: '\ud83d\udca9',
    desc: 'Fezes liquidas frequentes',
    meds: ['sro', 'loperamida'],
    tips: 'Reidratar e o mais importante! SRO ou receita caseira. Dieta BRAT (banana, arroz, maca, torrada). Evitar laticinios.',
    emergency: 'Diarreia com sangue, febre alta, sinais de desidratacao grave (olhos fundos, sem urina, confusao)' },
  { id: 'cough', name: 'Tosse', icon: '\ud83e\udd27',
    desc: 'Tosse seca ou produtiva (com catarro)',
    meds: ['ambroxol', 'dextrometorfano'],
    tips: 'Seca: mel com limao, dextrometorfano. Com catarro: ambroxol, inalacao de vapor. Beber muita agua.',
    emergency: 'Sangue na tosse, falta de ar progressiva, tosse > 3 semanas, perda de peso' },
  { id: 'stomach', name: 'Dor de Estomago', icon: '\ud83e\ude7a',
    desc: 'Azia, gastrite, dor epigastrica',
    meds: ['omeprazol', 'buscopan', 'simeticona'],
    tips: 'Comer porcoes menores. Evitar cafe, alcool, frituras. Nao deitar apos comer. Cha de camomila.',
    emergency: 'Dor intensa que irradia para costas, vomito com sangue (escuro), barriga dura como tabua' },
  { id: 'allergy', name: 'Reacao Alergica', icon: '\ud83e\udd27',
    desc: 'Coceira, urticaria, inchaço, rinite',
    meds: ['loratadina', 'dexclorfeniramina', 'prednisolona'],
    tips: 'Afastar o alergeno. Anti-histaminico oral. Compressas frias na coceira. Se leve, loratadina. Se moderada, dexclorfeniramina.',
    emergency: 'Inchaço de labios/lingua/garganta, falta de ar, queda de pressao, ANAFILAXIA = EMERGENCIA TOTAL' },
  { id: 'wound', name: 'Ferida / Corte', icon: '\ud83e\ude79',
    desc: 'Cortes, escoriacoes, queimaduras',
    meds: ['neomicina-pomada', 'sulfadiazina-prata', 'permanganato'],
    tips: 'Limpar com agua corrente e sabao. Aplicar pressao se sangrar. Antibiotico topico. Manter limpo e coberto.',
    emergency: 'Sangramento que nao para, corte profundo com tecido visivel, mordida de animal, sinais de infeccao (vermelhidao crescente, pus, febre)' },
  { id: 'breathing', name: 'Falta de Ar', icon: '\ud83e\udec1',
    desc: 'Dispneia, chiado, crise de asma',
    meds: ['salbutamol'],
    tips: 'Sentar inclinado para frente. Respirar devagar pelo nariz. Se asma: usar bombinha. Afastar-se de fumaca/alergenos.',
    emergency: 'Labios/unhas azulados, nao consegue falar frases completas, falta de ar em repouso, chiado intenso' },
  { id: 'nausea', name: 'Nausea / Vomito', icon: '\ud83e\udd22',
    desc: 'Enjoo, cinetose, indigestao',
    meds: ['dimenidrinato', 'gengibre'],
    tips: 'Gengibre fresco ou cha. Comer crackers/biscoito agua e sal. Pequenos goles de agua gelada. Evitar cheiros fortes.',
    emergency: 'Vomito com sangue, vomitos persistentes > 24h, dor abdominal intensa, suspeita de envenenamento' },
  { id: 'toothache', name: 'Dor de Dente', icon: '\ud83e\uddb7',
    desc: 'Carie, infeccao, abscesso dental',
    meds: ['ibuprofeno', 'paracetamol', 'lidocaina-gel'],
    tips: 'Ibuprofeno (anti-inflamatorio). Cravo-da-india no local. Agua morna com sal para bochechar. NAO colocar aspirina no dente (queima).',
    emergency: 'Inchaço no rosto/pescoco, febre alta, dificuldade para engolir/respirar (abscesso pode ser grave)' },
  { id: 'itch', name: 'Coceira / Picada', icon: '\ud83e\udd9f',
    desc: 'Picadas de inseto, dermatite, urticaria',
    meds: ['loratadina', 'dexclorfeniramina'],
    tips: 'Compressa fria. Nao cocar. Anti-histaminico oral. Pasta de bicarbonato de sodio na picada.',
    emergency: 'Picada com inchaço que cresce rapidamente, falta de ar, multiplas picadas de abelha (>10), picada de aranha marrom/armadeira' },
  { id: 'hypertension', name: 'Pressao Alta', icon: '\ud83d\udcc8',
    desc: 'Crise hipertensiva, dor de cabeca intensa',
    meds: ['captopril', 'atenolol'],
    tips: 'Captopril 25mg sublingual na crise. Deitar/sentar calmamente. Respirar fundo. Medir pressao a cada 15 min.',
    emergency: 'PA > 180/120 com dor de cabeca forte, visao borrada, dor no peito, falta de ar, confusao = EMERGENCIA' },
];

/* ── Sinais de Emergencia ── */
const PHARM_EMERGENCIES = [
  { title: '\u2764\ufe0f Infarto (Ataque Cardiaco)', icon: '\ud83d\udea8',
    signs: ['Dor/pressao no peito (pode irradiar para braco esquerdo, mandibula, costas)', 'Falta de ar subita', 'Suor frio, nausea', 'Palidez, ansiedade intensa'],
    action: 'MASTIGAR 1 aspirina 300mg IMEDIATAMENTE. Deitar com cabeca elevada. Chamar emergencia. Se parar de respirar: RCP.' },
  { title: '\ud83e\udde0 AVC (Derrame)', icon: '\ud83d\udea8',
    signs: ['Fraqueza subita em um lado do corpo', 'Fala arrastada ou confusa', 'Rosto caido (pedir para sorrir — um lado nao sobe)', 'Perda de visao subita', 'Dor de cabeca subita e intensa'],
    action: 'SAMU: teste FAST — Face (rosto caido?), Arms (bracos — um cai?), Speech (fala arrastada?), Time (tempo = cada minuto conta). NAO dar medicamentos. Deitar com cabeca elevada.' },
  { title: '\ud83e\udd27 Anafilaxia (Choque Alergico)', icon: '\ud83d\udea8',
    signs: ['Inchaço de labios, lingua, garganta', 'Dificuldade para respirar/engolir', 'Urticaria generalizada', 'Queda de pressao, tontura, desmaio', 'Pode ocorrer minutos apos exposicao ao alergeno'],
    action: 'ADRENALINA (epinefrina) IM na coxa lateral (EpiPen se disponivel). Posicao: deitado com pernas elevadas (se nao vomitando). Anti-histaminico + corticoide como COMPLEMENTO. Chamar emergencia.' },
  { title: '\ud83c\udf21\ufe0f Febre Muito Alta (> 39.5C)', icon: '\ud83d\udea8',
    signs: ['Temperatura > 39.5C persistente', 'Confusao mental ou delírio', 'Convulsao febril (especialmente em criancas)', 'Rigidez de nuca (suspeita de meningite)', 'Manchas roxas na pele'],
    action: 'Antipiretico imediato (dipirona ou paracetamol). Compressas mornas (NAO geladas). Hidratar. Roupas leves. Se convulsao: deitar de lado, proteger cabeca, NAO colocar nada na boca.' },
  { title: '\ud83e\ude78 Sangramento Grave', icon: '\ud83d\udea8',
    signs: ['Sangue vermelho vivo em jato (arterial)', 'Sangramento que nao para com pressao direta', 'Pele palida e fria, confusao, taquicardia', 'Sangue no vomito, fezes ou urina em grande quantidade'],
    action: 'Pressao DIRETA no ferimento com pano limpo. Elevar membro. Se nao parar: torniquete 5-8 cm ACIMA do ferimento (marcar hora). NAO remover objeto cravado — estabilizar no local.' },
  { title: '\ud83e\udec1 Dificuldade Respiratoria Grave', icon: '\ud83d\udea8',
    signs: ['Labios/unhas azulados (cianose)', 'Nao consegue falar frases completas', 'Uso de musculos acessorios para respirar', 'Chiado intenso ou silencio respiratorio (PIOR)', 'Posicao de tripe (inclinado para frente)'],
    action: 'Se asma: 4-8 jatos de salbutamol com espacador. Sentar inclinado para frente. Se tem corticoide: tomar. Se engasgamento: manobra de Heimlich. Se parou de respirar: RCP.' },
];

/* ── Kit Basico ── */
const PHARM_KIT = [
  { title: '\ud83d\udc8a Medicamentos Essenciais', items: [
    { name: 'Paracetamol 500mg/750mg', qty: '20 comprimidos', note: 'Dor e febre' },
    { name: 'Ibuprofeno 400mg', qty: '20 comprimidos', note: 'Inflamacao e dor' },
    { name: 'Dipirona 500mg', qty: '10 comprimidos', note: 'Febre alta' },
    { name: 'Amoxicilina 500mg', qty: '21 capsulas (1 tratamento)', note: 'Infeccao bacteriana' },
    { name: 'Azitromicina 500mg', qty: '3 comprimidos', note: 'Alternativa antibiotica' },
    { name: 'Loratadina 10mg', qty: '10 comprimidos', note: 'Alergia' },
    { name: 'Omeprazol 20mg', qty: '14 capsulas', note: 'Estomago' },
    { name: 'Loperamida 2mg', qty: '10 comprimidos', note: 'Diarreia' },
    { name: 'Buscopan 10mg', qty: '10 comprimidos', note: 'Colicas' },
    { name: 'SRO (envelopes)', qty: '10 envelopes', note: 'Reidratacao (ESSENCIAL)' },
  ]},
  { title: '\ud83e\ude79 Curativos & Material', items: [
    { name: 'Band-aids variados', qty: '20 unidades', note: 'Cortes pequenos' },
    { name: 'Gaze esteril (7.5x7.5cm)', qty: '20 unidades', note: 'Feridas' },
    { name: 'Atadura de crepe (10cm)', qty: '4 rolos', note: 'Imobilizacao e curativos' },
    { name: 'Esparadrapo/Micropore', qty: '2 rolos', note: 'Fixacao' },
    { name: 'Luvas descartaveis', qty: '10 pares', note: 'Protecao' },
    { name: 'Soro fisiologico 250ml', qty: '2 frascos', note: 'Limpeza de feridas' },
    { name: 'Termometro digital', qty: '1 unidade', note: 'Medir febre' },
    { name: 'Tesoura pequena', qty: '1 unidade', note: 'Cortar curativos' },
    { name: 'Pinca', qty: '1 unidade', note: 'Remover farpas/espinhos' },
  ]},
  { title: '\ud83e\uddea Topicos & Pomadas', items: [
    { name: 'Nebacetin (Neomicina+Bacitracina)', qty: '1 tubo', note: 'Feridas infectadas' },
    { name: 'Sulfadiazina de Prata 1%', qty: '1 tubo', note: 'Queimaduras' },
    { name: 'Miconazol creme', qty: '1 tubo', note: 'Micose' },
    { name: 'Permanganato de Potassio', qty: '10 comprimidos', note: 'Desinfeccao' },
    { name: 'Lidocaina gel', qty: '1 tubo', note: 'Anestesia local' },
    { name: 'Protetor solar FPS 30+', qty: '1 frasco', note: 'Queimadura solar' },
    { name: 'Repelente de insetos', qty: '1 frasco', note: 'Prevencao' },
  ]},
  { title: '\ud83c\udf3f Naturais p/ Backup', items: [
    { name: 'Mel puro', qty: '1 pote pequeno', note: 'Tosse, feridas, energia' },
    { name: 'Gengibre em po / fresco', qty: '50g', note: 'Nausea, inflamacao' },
    { name: 'Camomila seca', qty: '1 pacote', note: 'Calmante, digestivo' },
    { name: 'Cravo-da-india', qty: '1 vidro pequeno', note: 'Dor de dente' },
    { name: 'Propolis tintura', qty: '1 frasco', note: 'Garganta, imunidade' },
    { name: 'Curcuma em po', qty: '50g', note: 'Anti-inflamatorio' },
  ]},
  { title: '\ud83d\udcdd Documentos & Extras', items: [
    { name: 'Lista de alergias da familia', qty: '1 folha plastificada', note: 'CRITICO' },
    { name: 'Tipo sanguineo de cada membro', qty: '1 folha', note: 'CRITICO' },
    { name: 'Telefones de emergencia', qty: '1 folha', note: 'SAMU 192, Bombeiros 193' },
    { name: 'Manual de primeiros socorros', qty: '1 livreto', note: 'Guia rapido impresso' },
    { name: 'Manta termica de emergencia', qty: '2 unidades', note: 'Hipotermia' },
    { name: 'Mascara de RCP', qty: '1 unidade', note: 'Protecao em reanimacao' },
  ]},
];

/* ── State ── */
let _pharmSection = 'meds';
let _pharmCat = 'all';

/* ── Init ── */
function pharmacyInit() {
  _pharmSection = 'meds';
  _pharmCat = 'all';
  const search = document.getElementById('pharmSearch');
  if (search) search.value = '';
  // Reset tabs
  document.querySelectorAll('.pharm-tab').forEach(t => t.classList.toggle('active', t.dataset.section === 'meds'));
  document.querySelectorAll('.pharm-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === 'all'));
  const cats = document.getElementById('pharmCats');
  if (cats) cats.style.display = '';
  pharmRender();
  pharmHideDetail();
}

function pharmSetSection(section) {
  _pharmSection = section;
  _pharmCat = 'all';
  const search = document.getElementById('pharmSearch');
  if (search) search.value = '';
  document.querySelectorAll('.pharm-tab').forEach(t => t.classList.toggle('active', t.dataset.section === section));
  document.querySelectorAll('.pharm-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === 'all'));
  // Show/hide category filter
  const cats = document.getElementById('pharmCats');
  if (cats) cats.style.display = (section === 'meds') ? '' : 'none';
  pharmRender();
  pharmHideDetail();
}

function pharmSetCat(cat) {
  _pharmCat = cat;
  document.querySelectorAll('.pharm-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  pharmRender();
}

function pharmFilter() {
  pharmRender();
}

function pharmRender() {
  const container = document.getElementById('pharmContent');
  if (!container) return;
  const query = (document.getElementById('pharmSearch')?.value || '').toLowerCase().trim();

  switch (_pharmSection) {
    case 'meds':     pharmRenderMeds(container, query); break;
    case 'symptoms': pharmRenderSymptoms(container, query); break;
    case 'natural':  pharmRenderNatural(container, query); break;
    case 'emergency': pharmRenderEmergency(container); break;
    case 'kit':      pharmRenderKit(container); break;
  }
}

/* ── Render: Medications Grid ── */
function pharmRenderMeds(container, query) {
  let meds = PHARM_DB;
  if (_pharmCat !== 'all') meds = meds.filter(m => m.category === _pharmCat);
  if (query) {
    meds = meds.filter(m =>
      m.generic.toLowerCase().includes(query) ||
      m.brand.toLowerCase().includes(query) ||
      m.use.toLowerCase().includes(query) ||
      m.id.toLowerCase().includes(query)
    );
  }

  if (meds.length === 0) {
    container.innerHTML = '<div class="panel-empty">Nenhum medicamento encontrado.</div>';
    _pharmUpdateCount(0);
    return;
  }

  let html = '<div class="pharm-grid">';
  for (const m of meds) {
    html += `<div class="pharm-card" onclick="pharmShowDetail('${m.id}')">
      <div class="pharm-card-icon">${PHARM_CAT_ICONS[m.category] || '\ud83d\udc8a'}</div>
      <div class="pharm-card-name">${escapeHtml(m.brand.split(',')[0])}</div>
      <div class="pharm-card-generic">${escapeHtml(m.generic)}</div>
      <div class="pharm-card-use">${escapeHtml(m.use)}</div>
      <div class="pharm-card-cat">${PHARM_CAT_LABELS[m.category] || m.category}</div>
    </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
  _pharmUpdateCount(meds.length);
}

/* ── Render: Symptoms ── */
function pharmRenderSymptoms(container, query) {
  let symptoms = PHARM_SYMPTOMS;
  if (query) {
    symptoms = symptoms.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.desc.toLowerCase().includes(query) ||
      s.tips.toLowerCase().includes(query)
    );
  }

  if (symptoms.length === 0) {
    container.innerHTML = '<div class="panel-empty">Nenhum sintoma encontrado.</div>';
    return;
  }

  let html = '<div class="pharm-symptom-grid">';
  for (const s of symptoms) {
    html += `<div class="pharm-symptom-card" onclick="pharmShowSymptom('${s.id}')">
      <div class="pharm-symptom-icon">${s.icon}</div>
      <div class="pharm-symptom-name">${escapeHtml(s.name)}</div>
      <div class="pharm-symptom-desc">${escapeHtml(s.desc)}</div>
    </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

/* ── Render: Natural Remedies ── */
function pharmRenderNatural(container, query) {
  let entries = Object.entries(PHARM_NATURAL);
  if (query) {
    entries = entries.filter(([k, v]) =>
      v.name.toLowerCase().includes(query) ||
      v.use.toLowerCase().includes(query) ||
      k.toLowerCase().includes(query)
    );
  }

  if (entries.length === 0) {
    container.innerHTML = '<div class="panel-empty">Nenhum remedio natural encontrado.</div>';
    return;
  }

  let html = `<div class="pharm-alert-box pharm-alert-info" style="margin-bottom:12px">
    \ud83c\udf3f Substitutos naturais para quando nao ha medicamentos disponiveis. <strong>Nao substituem tratamento medico adequado.</strong>
  </div>`;
  html += '<div class="pharm-grid">';
  for (const [key, n] of entries) {
    // Find which meds reference this natural
    const relatedMeds = PHARM_DB.filter(m => m.natural && m.natural.includes(key));
    html += `<div class="pharm-card" onclick="pharmShowNatural('${key}')">
      <div class="pharm-card-icon">${n.icon}</div>
      <div class="pharm-card-name">${escapeHtml(n.name)}</div>
      <div class="pharm-card-use">${escapeHtml(n.use)}</div>
      ${relatedMeds.length ? `<div style="margin-top:4px;font-size:9px;color:var(--text-dim)">Substitui: ${relatedMeds.map(m => m.brand.split(',')[0]).join(', ')}</div>` : ''}
    </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

/* ── Render: Emergency Signs ── */
function pharmRenderEmergency(container) {
  let html = `<div class="pharm-alert-box pharm-alert-danger" style="margin-bottom:14px">
    \ud83d\udea8 <strong>SINAIS DE ALERTA VERMELHO</strong> — Se identificar qualquer um destes sinais, trate como EMERGENCIA. Cada minuto conta.
  </div>`;
  html += '<div class="pharm-emergency-grid">';
  for (const e of PHARM_EMERGENCIES) {
    html += `<div class="pharm-emerg-card">
      <h3>${e.title}</h3>
      <h4 style="font-size:11px;color:var(--text-muted);margin:0 0 6px">\ud83d\udd34 Sinais:</h4>
      <ul>${e.signs.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
      <div class="pharm-alert-box pharm-alert-warn" style="margin-top:8px">
        <strong>\u26a1 Acao imediata:</strong> ${escapeHtml(e.action)}
      </div>
    </div>`;
  }
  html += '</div>';
  html += `<div class="pharm-alert-box pharm-alert-danger" style="margin-top:14px">
    \u260e\ufe0f <strong>Numeros de Emergencia Brasil:</strong> SAMU 192 | Bombeiros 193 | Policia 190 | CVV (suicidio) 188
  </div>`;
  container.innerHTML = html;
}

/* ── Render: Kit Basico ── */
function pharmRenderKit(container) {
  let html = `<div class="pharm-alert-box pharm-alert-info" style="margin-bottom:14px">
    \ud83c\udfaf <strong>Kit Medico de Sobrevivencia</strong> — O essencial para ter preparado. Verificar validades a cada 6 meses.
  </div>`;
  html += '<div class="pharm-kit-grid">';
  for (const section of PHARM_KIT) {
    html += `<div class="pharm-kit-card">
      <h3>${section.title}</h3>
      <ul>`;
    for (const item of section.items) {
      html += `<li><strong>${escapeHtml(item.name)}</strong> — ${escapeHtml(item.qty)} <span style="color:var(--text-dim)">(${escapeHtml(item.note)})</span></li>`;
    }
    html += '</ul></div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

/* ── Detail: Medication ── */
function pharmShowDetail(medId) {
  const med = PHARM_DB.find(m => m.id === medId);
  if (!med) return;

  const detail = document.getElementById('pharmDetail');
  const inner = document.getElementById('pharmDetailInner');
  if (!detail || !inner) return;

  let html = `<button class="pharm-detail-back" onclick="pharmHideDetail()">\u2190 Voltar</button>`;
  html += `<div class="pharm-detail-title">${PHARM_CAT_ICONS[med.category] || '\ud83d\udc8a'} ${escapeHtml(med.brand)}</div>`;
  html += `<div class="pharm-detail-subtitle">${escapeHtml(med.generic)}</div>`;

  html += `<div class="pharm-alert-box pharm-alert-danger" style="margin-bottom:14px">${PHARM_DISCLAIMER}</div>`;

  html += `<div class="pharm-detail-section"><h4>Para que serve</h4><p>${escapeHtml(med.use)}</p></div>`;

  html += `<div class="pharm-detail-section"><h4>Dosagem</h4>
    <table class="pharm-dose-table">
      <tr><th>Publico</th><th>Dose</th></tr>
      <tr><td>\ud83e\uddd1 Adulto</td><td>${escapeHtml(med.doseAdult)}</td></tr>
      <tr><td>\ud83d\udc76 Crianca</td><td>${escapeHtml(med.doseChild)}</td></tr>
    </table>
  </div>`;

  html += `<div class="pharm-detail-section"><h4>\u26d4 Contraindicacoes</h4>
    <div class="pharm-alert-box pharm-alert-danger">${escapeHtml(med.contraindications)}</div>
  </div>`;

  html += `<div class="pharm-detail-section"><h4>Efeitos colaterais</h4><p>${escapeHtml(med.sideEffects)}</p></div>`;

  html += `<div class="pharm-detail-section"><h4>\u23f3 Validade tipica</h4><p>${escapeHtml(med.expiry)}</p></div>`;

  if (med.notes) {
    html += `<div class="pharm-detail-section"><h4>\ud83d\udcdd Observacoes</h4>
      <div class="pharm-alert-box pharm-alert-warn">${escapeHtml(med.notes)}</div>
    </div>`;
  }

  if (med.natural && med.natural.length > 0) {
    html += `<div class="pharm-detail-section"><h4>\ud83c\udf3f Substitutos Naturais</h4><div>`;
    for (const nKey of med.natural) {
      const n = PHARM_NATURAL[nKey];
      if (n) {
        html += `<span class="pharm-natural-link" onclick="pharmShowNatural('${nKey}')">${n.icon} ${escapeHtml(n.name)}</span>`;
      }
    }
    html += '</div></div>';
  }

  inner.innerHTML = html;
  detail.classList.remove('hidden');
}

/* ── Detail: Symptom ── */
function pharmShowSymptom(symptomId) {
  const s = PHARM_SYMPTOMS.find(x => x.id === symptomId);
  if (!s) return;

  const detail = document.getElementById('pharmDetail');
  const inner = document.getElementById('pharmDetailInner');
  if (!detail || !inner) return;

  let html = `<button class="pharm-detail-back" onclick="pharmHideDetail()">\u2190 Voltar</button>`;
  html += `<div class="pharm-detail-title">${s.icon} ${escapeHtml(s.name)}</div>`;
  html += `<div class="pharm-detail-subtitle">${escapeHtml(s.desc)}</div>`;

  html += `<div class="pharm-alert-box pharm-alert-danger" style="margin-bottom:14px">${PHARM_DISCLAIMER}</div>`;

  html += `<div class="pharm-detail-section"><h4>\ud83d\udc8a Medicamentos recomendados</h4><div>`;
  for (const medId of s.meds) {
    const med = PHARM_DB.find(m => m.id === medId);
    if (med) {
      html += `<span class="pharm-natural-link" style="background:var(--accent-dim);border-color:rgba(0,212,255,0.2);color:var(--accent)" onclick="pharmShowDetail('${med.id}')">\ud83d\udc8a ${escapeHtml(med.brand.split(',')[0])} (${escapeHtml(med.generic)})</span>`;
    }
  }
  html += '</div></div>';

  html += `<div class="pharm-detail-section"><h4>\ud83d\udca1 Dicas de tratamento</h4><p>${escapeHtml(s.tips)}</p></div>`;

  html += `<div class="pharm-detail-section"><h4>\ud83d\udea8 Quando e EMERGENCIA</h4>
    <div class="pharm-alert-box pharm-alert-danger">${escapeHtml(s.emergency)}</div>
  </div>`;

  // Related natural remedies
  const naturalRefs = new Set();
  for (const medId of s.meds) {
    const med = PHARM_DB.find(m => m.id === medId);
    if (med?.natural) med.natural.forEach(n => naturalRefs.add(n));
  }
  if (naturalRefs.size > 0) {
    html += `<div class="pharm-detail-section"><h4>\ud83c\udf3f Alternativas naturais</h4><div>`;
    for (const nKey of naturalRefs) {
      const n = PHARM_NATURAL[nKey];
      if (n) html += `<span class="pharm-natural-link" onclick="pharmShowNatural('${nKey}')">${n.icon} ${escapeHtml(n.name)}</span>`;
    }
    html += '</div></div>';
  }

  inner.innerHTML = html;
  detail.classList.remove('hidden');
}

/* ── Detail: Natural Remedy ── */
function pharmShowNatural(key) {
  const n = PHARM_NATURAL[key];
  if (!n) return;

  const detail = document.getElementById('pharmDetail');
  const inner = document.getElementById('pharmDetailInner');
  if (!detail || !inner) return;

  const relatedMeds = PHARM_DB.filter(m => m.natural && m.natural.includes(key));

  let html = `<button class="pharm-detail-back" onclick="pharmHideDetail()">\u2190 Voltar</button>`;
  html += `<div class="pharm-detail-title">${n.icon} ${escapeHtml(n.name)}</div>`;
  html += `<div class="pharm-detail-subtitle">Remedio Natural</div>`;

  html += `<div class="pharm-alert-box pharm-alert-warn" style="margin-bottom:14px">\u26a0\ufe0f Remedios naturais NAO substituem tratamento medico. Consulte um profissional de saude.</div>`;

  html += `<div class="pharm-detail-section"><h4>Uso</h4><p>${escapeHtml(n.use)}</p></div>`;
  html += `<div class="pharm-detail-section"><h4>Preparo</h4><p>${escapeHtml(n.prep)}</p></div>`;
  html += `<div class="pharm-detail-section"><h4>\u26a0\ufe0f Cuidados</h4>
    <div class="pharm-alert-box pharm-alert-danger">${escapeHtml(n.warn)}</div>
  </div>`;

  if (relatedMeds.length > 0) {
    html += `<div class="pharm-detail-section"><h4>\ud83d\udc8a Substitui (em emergencia)</h4><div>`;
    for (const med of relatedMeds) {
      html += `<span class="pharm-natural-link" style="background:var(--accent-dim);border-color:rgba(0,212,255,0.2);color:var(--accent)" onclick="pharmShowDetail('${med.id}')">\ud83d\udc8a ${escapeHtml(med.brand.split(',')[0])}</span>`;
    }
    html += '</div></div>';
  }

  // Cross-reference with plants app if available
  html += `<div class="pharm-detail-section"><h4>\ud83c\udf3f Guia de Plantas</h4>
    <p style="font-size:11px;color:var(--text-muted)">Veja o app <strong>Guia de Plantas</strong> para informacoes detalhadas sobre identificacao, coleta e preparo de plantas medicinais.
    <button class="pharm-natural-link" style="margin-top:6px" onclick="openApp('plants')">\ud83c\udf3f Abrir Guia de Plantas</button></p>
  </div>`;

  inner.innerHTML = html;
  detail.classList.remove('hidden');
}

function pharmHideDetail() {
  const detail = document.getElementById('pharmDetail');
  if (detail) detail.classList.add('hidden');
}

function _pharmUpdateCount(count) {
  const el = document.getElementById('pharmCount');
  if (el) el.textContent = count + ' medicamento(s)';
  const status = document.getElementById('pharmStatus');
  if (status) status.textContent = _pharmSection === 'meds' ?
    (_pharmCat !== 'all' ? PHARM_CAT_LABELS[_pharmCat] : 'Todos os medicamentos') :
    _pharmSection === 'symptoms' ? 'Busca por sintomas' :
    _pharmSection === 'natural' ? 'Substitutos naturais' :
    _pharmSection === 'emergency' ? 'Sinais de emergencia' : 'Kit basico';
}

// Expose to window
window.pharmacyInit = pharmacyInit;
window.pharmSetSection = pharmSetSection;
window.pharmSetCat = pharmSetCat;
window.pharmFilter = pharmFilter;
window.pharmShowDetail = pharmShowDetail;
window.pharmShowSymptom = pharmShowSymptom;
window.pharmShowNatural = pharmShowNatural;
window.pharmHideDetail = pharmHideDetail;

// ═══════════════════════════════════════════════════════════════════════════════
// Shelter & Construction App — Emergency shelter building for any biome
// Types, materials, insulation, protection, tools, location, quick tips
// ═══════════════════════════════════════════════════════════════════════════════

let _shelterSection = 'types';

const SHELTER_TYPES = [
  {
    id: 'leanto', name: 'Lean-To', icon: '\u{1F332}', difficulty: 'Facil',
    time: '30-60 min', people: '1-2', biomes: ['forest','desert','urban'],
    desc: 'Abrigo inclinado simples — ideal para primeira noite',
    materials: ['1 tronco longo (2-3m)', '8-12 galhos grossos', 'Folhas, musgo ou casca', 'Cordas (opcional)'],
    steps: [
      'Encontre 2 arvores proximas (~2m de distancia) ou apoie um tronco entre uma arvore e o chao',
      'Posicione o tronco principal (ridgepole) a ~1m de altura na extremidade mais alta',
      'Apoie galhos menores em angulo de 45-60 graus contra o tronco — lado a lado, bem juntos',
      'Cubra com camadas de folhas, musgo ou casca de dentro para fora (como telhas)',
      'Coloque mais galhos por cima para prender a cobertura contra o vento',
      'Faca uma cama de folhas secas de pelo menos 15cm de espessura no chao',
      'Posicione a abertura OPOSTA ao vento predominante',
      'Opcional: faca uma parede lateral se o vento mudar'
    ],
    tips: 'Incline a ~60 graus para melhor escoamento de chuva. A abertura deve ser menor que voce — conserva calor.'
  },
  {
    id: 'aframe', name: 'A-Frame', icon: '\u26FA', difficulty: 'Facil',
    time: '45-90 min', people: '1-2', biomes: ['forest','snow'],
    desc: 'Formato de "A" — otimo contra chuva e vento bilateral',
    materials: ['1 tronco longo (2.5-3m)', '12-20 galhos medios', 'Folhas, musgo ou barro', 'Cordas (opcionais)'],
    steps: [
      'Finca 2 forquilhas (galhos em Y) no chao, ~2.5m de distancia',
      'Apoie o ridgepole (tronco principal) nas forquilhas a ~1m de altura',
      'De ambos os lados, apoie galhos inclinados contra o ridgepole, como um "A"',
      'Comece pelo chao e suba, sobrepondo galhos como costelas',
      'Cubra com folhas grossas, musgo ou casca — comece pela base e suba',
      'Adicione uma segunda camada de folhas mais finas por cima',
      'Coloque galhos transversais para prender a cobertura',
      'Feche uma das extremidades com galhos e folhas; deixe a outra como entrada'
    ],
    tips: 'Espaco interno justo conserva calor. Deixe a entrada pequena e use um "tapete" de folhas como porta.'
  },
  {
    id: 'debrishut', name: 'Debris Hut', icon: '\u{1F33F}', difficulty: 'Medio',
    time: '1-3 horas', people: '1', biomes: ['forest'],
    desc: 'Cabana isolada com detritos — a mais quente sem fogo',
    materials: ['1 tronco principal (2.5m)', '20-30 galhos', 'Grande volume de folhas secas', 'Musgo, grama ou samambaia'],
    steps: [
      'Apoie um tronco entre o chao e uma arvore/pedra a ~1m de altura',
      'O interior deve caber voce deitado com pouco espaco extra (conserva calor)',
      'Apoie galhos laterais como costelas de ambos os lados, a cada 15cm',
      'Cubra com uma camada GROSSA de folhas (minimo 60-90cm de espessura)',
      'Prenda as folhas com galhos leves por cima para nao voarem',
      'Encha o interior COMPLETAMENTE com folhas secas soltas — voce dormira dentro delas',
      'Faca uma "porta" com um monte de folhas para bloquear a entrada',
      'A espessura das folhas e a diferenca entre vida e morte no frio'
    ],
    tips: 'Regra: se voce ve luz passando pelas paredes, precisa de mais folhas. Precisa de MUITO mais folhas do que voce imagina.'
  },
  {
    id: 'snowcave', name: 'Caverna de Neve', icon: '\u2744\uFE0F', difficulty: 'Dificil',
    time: '2-4 horas', people: '1-3', biomes: ['snow'],
    desc: 'Abrigo escavado na neve — temperatura estavel acima de 0 C',
    materials: ['Pa ou ferramenta de escavar', 'Neve compactada (minimo 1.5m profundidade)', 'Galho fino para ventilacao'],
    steps: [
      'Encontre uma encosta com neve profunda e compactada (minimo 1.5m)',
      'Cave uma entrada BAIXA (50-60cm) — ar quente sobe e fica dentro',
      'Escave para cima e para os lados, criando uma plataforma de dormir ACIMA da entrada',
      'A camera interna deve ter ~1.5m de altura no centro',
      'Alise as paredes internas em arco (evita gotejamento)',
      'Faca 1-2 furos de ventilacao no teto com um galho (essencial!)',
      'Crie um canal de drenagem no chao proximo a entrada',
      'Bloqueie parcialmente a entrada com um bloco de neve (nao feche totalmente!)'
    ],
    tips: 'PERIGO: sem ventilacao = asfixia. Sempre mantenha furos abertos. A plataforma elevada e crucial pois o ar frio desce.'
  },
  {
    id: 'tarp', name: 'Tarp Shelter', icon: '\u{1F9E5}', difficulty: 'Facil',
    time: '10-30 min', people: '1-4', biomes: ['forest','desert','urban'],
    desc: 'Abrigo versatil com lona — multiplas configuracoes',
    materials: ['Lona ou poncho (minimo 2x3m)', 'Corda ou paracord (3-5m)', '4-6 estacas ou pedras pesadas', 'Opcional: 1-2 bastoes'],
    steps: [
      'CONFIGURACAO A-FRAME: Amarre corda entre 2 arvores a ~1m de altura',
      'Jogue a lona por cima e estique as laterais com estacas no chao',
      'LEAN-TO: Amarre um lado da lona na corda mais alto, estique o outro ate o chao',
      'BARRACA: Use um bastao central e estaque as 4 pontas no chao',
      'DIAMOND: Pendure um canto na arvore, estaque o oposto no chao, laterais abertas',
      'Em chuva forte, cave um canal ao redor para drenar agua',
      'Use pedras ou troncos nas bordas se nao tiver estacas',
      'Angulo minimo de 45 graus para escoar chuva adequadamente'
    ],
    tips: 'A lona e o item mais versatil para abrigo. Leve uma de 3x3m — pesa pouco e resolve 90% das situacoes.'
  },
  {
    id: 'hammock', name: 'Hamaca com Lona', icon: '\u{1F3D5}\uFE0F', difficulty: 'Facil',
    time: '15-30 min', people: '1', biomes: ['forest'],
    desc: 'Dormir elevado — protecao contra umidade, insetos e animais rasteiros',
    materials: ['Rede/hamaca resistente', 'Lona ou rainfly (2x3m)', 'Corda (5m)', 'Carabinas ou nos (2)', 'Mosquiteiro (ideal)'],
    steps: [
      'Encontre 2 arvores saudaveis (vivas!) separadas por 3-5m',
      'Amarre a hamaca a ~1.5m do chao (com peso ficara mais baixa)',
      'Teste sentando antes de deitar — as amarracoes devem aguentar',
      'Amarre a corda da lona ACIMA da hamaca entre as arvores (~2m altura)',
      'Estenda a lona sobre a corda em A-frame; estaque ou amarre as pontas laterais',
      'A lona deve se estender ~30cm alem das extremidades da hamaca',
      'Pendure o mosquiteiro sob a lona, envolvendo toda a hamaca',
      'Coloque um isolante ou cobertor na hamaca (perda de calor por baixo!)'
    ],
    tips: 'O frio vem de BAIXO — a hamaca comprime o isolamento sob voce. Use um underquilt ou manta por baixo.'
  },
  {
    id: 'wickiup', name: 'Wickiup / Tipi', icon: '\u{1F3DA}\uFE0F', difficulty: 'Medio',
    time: '2-4 horas', people: '2-4', biomes: ['forest','desert'],
    desc: 'Estrutura conica autonoma — grande e permite fogueira interna',
    materials: ['12-20 varas longas (3-4m)', 'Cordas ou cipro', 'Cobertura: peles, lona, folhas ou casca', 'Galhos finos para reforco'],
    steps: [
      'Selecione 3 varas fortes como tripe principal; amarre as pontas superiores juntas',
      'Levante o tripe e posicione como um cone, base com ~3m de diametro',
      'Apoie as demais varas ao redor, espacadas igualmente',
      'Entrelace galhos finos horizontalmente entre as varas para rigidez',
      'Cubra de BAIXO para CIMA com o material disponivel (folhas, cascas, lona)',
      'Sobreponha cada camada como telhas — agua escorre para fora',
      'Deixe uma abertura no topo para ventilacao (e fumaca se usar fogo)',
      'Crie uma entrada baixa (~80cm) e use uma pele/lona como porta'
    ],
    tips: 'Com abertura no topo, permite fogueira pequena no centro. Cave um buraco raso para a fogueira e forre com pedras.'
  },
  {
    id: 'urban', name: 'Abrigo Urbano', icon: '\u{1F3D7}\uFE0F', difficulty: 'Variavel',
    time: '15-60 min', people: '1-6', biomes: ['urban'],
    desc: 'Improvisacao em ruinas, predios e areas urbanas',
    materials: ['Plastico, papelao, lonas', 'Cobertores, roupas extras', 'Fita adesiva resistente', 'Jornal para isolamento'],
    steps: [
      'PRIORIZE: predios abandonados com teto intacto, garagens, tuneis, viadutos',
      'EVITE: predios com danos estruturais, vidro solto, pisos instáveis',
      'Em ruinas: use moveis como paredes, colchoes como isolamento',
      'Papelao em camadas no chao = excelente isolamento termico',
      'Jornal amassado entre camadas de roupa = isolamento de emergencia',
      'Sacos de lixo grandes = barreira contra vento e umidade',
      'Em veiculos: boa protecao temporaria, use cobertores nas janelas',
      'Sempre tenha 2 saidas de emergencia em qualquer abrigo urbano'
    ],
    tips: 'Em ambiente urbano, papelao e ouro. 3 camadas no chao isolam melhor que um colchao fino. Sacos de lixo cortados = poncho.'
  }
];

const SHELTER_BIOME_MATERIALS = {
  forest: {
    name: 'Floresta', icon: '\u{1F332}', color: 'forest',
    structural: ['Troncos caidos (2-4m)', 'Galhos secos grossos', 'Varas finas e flexiveis', 'Bambu (se disponivel)'],
    cover: ['Folhas grandes (palmeiras, bananeira)', 'Casca de arvore (betula, cedro)', 'Musgo e samambaia', 'Capim longo'],
    insulation: ['Folhas secas (MUITO volume)', 'Musgo seco', 'Agulhas de pinheiro', 'Samambaia seca'],
    binding: ['Cipo e trepadeiras', 'Raizes finas expostas', 'Casca interna de arvores', 'Fibras de palmeira torcidas'],
    water: 'Abundante — rios, orvalho, coleta de chuva em folhas grandes'
  },
  desert: {
    name: 'Deserto', icon: '\u{1F3DC}\uFE0F', color: 'desert',
    structural: ['Pedras empilhadas', 'Troncos de cacto morto', 'Galhos de arbusto seco', 'Ossos grandes (se disponivel)'],
    cover: ['Lona ou tecido (crucial!)', 'Folhas de palmeira do deserto', 'Pedras planas', 'Areia (para enterrar/cobrir)'],
    insulation: ['Areia seca (camada grossa)', 'Fibras de cacto', 'Gravetos secos', 'Roupas extras empilhadas'],
    binding: ['Fibras de yucca/agave', 'Raizes secas', 'Tiras de tecido', 'Cipo seco do deserto'],
    water: 'ESCASSA — priorize sombra para reduzir perda hidrica. Coleta de orvalho ao amanhecer.'
  },
  snow: {
    name: 'Neve / Artico', icon: '\u2744\uFE0F', color: 'snow',
    structural: ['Blocos de neve compactada', 'Neve profunda (para cavar)', 'Galhos de conifera', 'Gelo compactado'],
    cover: ['Neve (isolamento natural)', 'Galhos de pinheiro densos', 'Lona/plastico', 'Peles de animais'],
    insulation: ['Galhos de conifera (cama grossa!)', 'Neve seca solta', 'Peles/cobertores', 'Musgo artico seco'],
    binding: ['Raizes de conifera', 'Corda/paracord', 'Tiras de casca', 'Gelo como "cola" (agua + gelo)'],
    water: 'Neve derretida (nunca coma neve direto — gasta energia corporal). Derreta perto do corpo.'
  },
  urban: {
    name: 'Urbano', icon: '\u{1F3D9}\uFE0F', color: 'urban',
    structural: ['Moveis (mesas, estantes)', 'Portas e tabuas', 'Pallets de madeira', 'Tubulacoes e canos'],
    cover: ['Lonas plasticas', 'Sacos de lixo grandes', 'Papelao grosso', 'Chapas metalicas'],
    insulation: ['Papelao (multiplas camadas)', 'Jornal amassado', 'Espuma de embalagem', 'Roupas e tecidos'],
    binding: ['Fita adesiva / silver tape', 'Arame fino', 'Ziper de plastico (zip ties)', 'Corda de varal'],
    water: 'Torneiras, caixas dagua, coleta de chuva. Sempre filtre/ferva agua de fontes duvidosas.'
  }
};

const SHELTER_INSULATION_DATA = {
  principles: [
    { title: 'Ar parado = isolamento', desc: 'O ar preso entre camadas e o melhor isolante. Folhas soltas, tecidos fofos, neve seca — todos funcionam porque prendem bolsoes de ar.' },
    { title: 'Camadas vencem espessura', desc: '3 camadas finas com ar entre elas isolam MAIS que uma camada grossa. Aplique a roupas e ao abrigo.' },
    { title: 'Seco = quente', desc: 'Material umido conduz calor 25x mais rapido que ar. Mantenha isolamento SECO a todo custo.' },
    { title: 'Perda por baixo e critica', desc: 'O chao rouba mais calor que o ar. Priorize isolamento no piso: minimo 15cm de material fofo.' },
    { title: 'Tamanho justo', desc: 'Abrigo grande = mais ar para aquecer = mais frio. O ideal cabe voce e mais ninguem.' },
    { title: 'Reflexao de calor', desc: 'Superficies refletoras (manta termica, folha de aluminio) refletem ate 90% do calor radiante de volta ao corpo.' }
  ],
  natural_materials: [
    { name: 'Folhas secas', rValue: 'Alto', thickness: '60-90cm', notes: 'O material mais disponivel. Precisa de MUITO volume — encha ate nao caber mais.' },
    { name: 'Agulhas de pinheiro', rValue: 'Alto', thickness: '30-45cm', notes: 'Excelente isolante, repele insetos. Cheiro agradavel.' },
    { name: 'Musgo seco', rValue: 'Muito alto', thickness: '15-20cm', notes: 'Um dos melhores isolantes naturais. Absorve umidade — mantenha seco.' },
    { name: 'Capim/grama seca', rValue: 'Medio-alto', thickness: '30-45cm', notes: 'Facil de coletar. Amarre em feixes para melhor estrutura.' },
    { name: 'Neve seca', rValue: 'Medio', thickness: '30cm+', notes: 'Paradoxo: neve isola por conter ar. Iglus ficam a 0C mesmo a -40C fora.' },
    { name: 'Samambaia', rValue: 'Medio-alto', thickness: '20-30cm', notes: 'Repelente natural de insetos. Otima para cama e paredes.' },
    { name: 'Papelao', rValue: 'Alto', thickness: '5-10cm (camadas)', notes: 'Em ambiente urbano, 3+ camadas no chao = isolamento excelente.' },
    { name: 'Jornal amassado', rValue: 'Alto', thickness: '10-15cm', notes: 'Amassado prende mais ar. Enfie dentro da roupa como isolamento extra.' }
  ],
  layers_system: [
    { layer: '1. Barreira de umidade', desc: 'Plastico, folhas grandes, casca — impede a umidade do solo de subir', icon: '\u{1F4A7}' },
    { layer: '2. Isolamento base', desc: 'Camada grossa de folhas, musgo, ramos de conifera — minimo 15cm', icon: '\u{1F33F}' },
    { layer: '3. Zona de dormir', desc: 'Voce fica aqui — envolto por isolamento por todos os lados', icon: '\u{1F6CF}\uFE0F' },
    { layer: '4. Cobertura superior', desc: 'Folhas soltas, cobertor, roupas extras — prendendo ar quente', icon: '\u{1F9E5}' },
    { layer: '5. Barreira contra vento', desc: 'Paredes do abrigo, lona, blocos de neve — corta o vento gelado', icon: '\u{1F32C}\uFE0F' }
  ]
};

const SHELTER_PROTECTION = {
  rain: {
    title: '\u{1F327}\uFE0F Chuva', items: [
      'Angulo minimo de 45 graus em superficies de escoamento',
      'Sobreponha materiais como telhas — de baixo para cima',
      'Cave canal de drenagem ao redor do abrigo (~10cm profundidade)',
      'Nunca construa em area que acumula agua (depressoes)',
      'Camada externa impermeavel: plastico, casca, folhas cerosas',
      'Teste com agua antes de precisar — despeje agua e veja se goteja'
    ]
  },
  wind: {
    title: '\u{1F32C}\uFE0F Vento', items: [
      'Posicione a COSTAS do abrigo contra o vento dominante',
      'Use barreiras naturais: pedras, troncos caidos, morros',
      'Reduza a abertura do abrigo — entrada menor = menos vento dentro',
      'Reforce com peso: pedras nas bordas, galhos cruzados',
      'Forma aerodinamica: teto inclinado contra o vento',
      'Construa uma parede de vento (windbreak) com galhos empilhados a ~1m do abrigo'
    ]
  },
  sun: {
    title: '\u2600\uFE0F Sol / Calor', items: [
      'Priorize SOMBRA sobre tudo — o primeiro abrigo no deserto e sombra',
      'Eleve o abrigo do chao (~30cm) para circulacao de ar',
      'Dupla camada de lona com espaco entre elas reduz calor em ate 20 graus',
      'Escave 30-50cm no chao — temperatura cai significativamente',
      'Oriente a abertura para captar brisa; bloqueie o sol direto',
      'Em emergencia: sente-se na sombra de uma pedra grande. Minimalismo salva.'
    ]
  },
  animals: {
    title: '\u{1F43B} Animais', items: [
      'Guarde alimentos LONGE do abrigo (30m+), pendurados em arvore',
      'Fogo/fumaca afasta a maioria dos animais',
      'Evite trilhas de animais, tocas e fontes de agua ao anoitecer',
      'Em area de ursos: cozinhe longe do abrigo, guarde comida em container',
      'Cobras: feche todas as aberturas baixas; sacuda calcados/roupas antes de vestir',
      'Eleve-se do chao quando possivel (hamaca, plataforma)'
    ]
  },
  insects: {
    title: '\u{1F99F} Insetos', items: [
      'Mosquiteiro e o item #1 de protecao (malha 1mm ou menor)',
      'Fumaca de fogueira: lenha verde = mais fumaca = repele insetos',
      'Folhas de eucalipto, citronela ou nim queimadas como repelente',
      'Feche TODAS as aberturas ao anoitecer — insetos sao mais ativos',
      'Evite agua parada proxima (cria mosquitos)',
      'Samambaia no chao repele pulgas e carrapatos',
      'Aplique barro/lama na pele como barreira de emergencia'
    ]
  }
};

const SHELTER_TOOLS = {
  essential: [
    { name: 'Faca fixa (full tang)', weight: '200-400g', uses: 'Cortar, bater, cavar, processar madeira, preparar cordame' },
    { name: 'Paracord (15m)', weight: '100g', uses: 'Amarracoes, varal, torniquete, pescar, reparos' },
    { name: 'Lona 3x3m', weight: '300-500g', uses: 'Abrigo instantaneo, coleta de agua, maca, saco' },
    { name: 'Machadinha/hatchet', weight: '400-600g', uses: 'Cortar madeira, preparar lenha, martelar estacas' },
    { name: 'Serra de bolso', weight: '50-100g', uses: 'Cortar galhos sem esforco; silenciosa' }
  ],
  improvised: [
    { name: 'Sem faca', solution: 'Lascas de pedra afiada (silex, obsidiana, quartzo). Quebre controladamente para obter bordas cortantes.' },
    { name: 'Sem corda', solution: 'Torcao de casca interna de arvores, cipos, raizes ou tiras de tecido. Torca 2 fios juntos para cordame forte.' },
    { name: 'Sem lona', solution: 'Casca de betula em grandes pedacos, folhas de palmeira sobrepostas, ou sacos plasticos abertos/costurados.' },
    { name: 'Sem machado', solution: 'Quebre galhos no angulo de forquilhas de arvores. Pedra pesada como martelo. Bata galhos contra troncos.' },
    { name: 'Sem pa', solution: 'Cave com pedra chata, pedaco de madeira, casca rigida de arvore, ou um osso plano.' },
    { name: 'Sem estacas', solution: 'Galhos bifurcados (Y) fincados no chao, pedras pesadas nas bordas, amarre em raizes expostas.' }
  ]
};

const SHELTER_LOCATION = {
  good: [
    { rule: 'Terreno elevado e plano', reason: 'Agua escorre para baixo — evita inundacao. Plano = sono melhor.' },
    { rule: 'Protecao natural contra vento', reason: 'Rochas, morros, vegetacao densa — reduz trabalho de construcao.' },
    { rule: 'Proximo a agua (mas nao muito)', reason: '100-200m de agua: perto para coletar, longe de enchentes e insetos.' },
    { rule: 'Materiais disponiveis por perto', reason: 'Menos energia gasta transportando. Galhos, folhas, pedras acessiveis.' },
    { rule: 'Exposicao solar matinal (leste)', reason: 'Sol da manha aquece rapido apos noite fria. Seca o orvalho.' },
    { rule: 'Solo seco e drenado', reason: 'Verifique: se o solo esta umido agora, estara pior com chuva.' }
  ],
  avoid: [
    { rule: '\u{1F4A8} Topo de morros / cumes', reason: 'Vento maximo, zero protecao, raios. Muito exposto.' },
    { rule: '\u{1F30A} Leito seco de rio/vala', reason: 'Enchente relampago MATA. Agua pode subir metros em minutos.' },
    { rule: '\u{1F332} Debaixo de arvores mortas', reason: 'Galhos caem sem aviso ("widow makers"). Risco mortal.' },
    { rule: '\u{1FA78} Encostas instaveis', reason: 'Deslizamento de terra. Evite encostas com solo solto ou apos chuvas.' },
    { rule: '\u{1F99F} Perto de agua parada', reason: 'Mosquitos, insetos e animais. Umidade constante = frio.' },
    { rule: '\u26A1 Areas abertas isoladas', reason: 'Risco de raios. Sem protecao contra vento.' },
    { rule: '\u{1F40D} Pedras soltas / pedregulhos', reason: 'Escorpioes, cobras e aranhas vivem embaixo. Solo instavel.' },
    { rule: '\u{1F525} Perto de fogueira alheia', reason: 'Fogo pode se espalhar. Fumaca e toxica para dormir.' }
  ]
};

const SHELTER_TIPS = [
  { icon: '\u23F1\uFE0F', title: 'Regra das 3 Horas', text: 'Voce pode morrer de hipotermia em 3 horas. ABRIGO e prioridade #1 em sobrevivencia, antes de agua e comida.' },
  { icon: '\u{1F4CF}', title: 'Teste do Braco', text: 'Se a camada de isolamento no teto for mais fina que seu braco esticado — adicione mais material.' },
  { icon: '\u{1F525}', title: 'Refletor de Calor', text: 'Construa uma parede de troncos empilhados atras da fogueira. O calor reflete para o abrigo como um espelho.' },
  { icon: '\u{1F327}\uFE0F', title: 'Teste de Chuva', text: 'Antes de confiar no abrigo, jogue agua no teto. Se gotejar, adicione mais camadas ou ajuste angulos.' },
  { icon: '\u{1F9ED}', title: 'Posicionamento Solar', text: 'Abertura para LESTE = sol da manha para aquecer. Nunca faca a abertura para a direcao do vento predominante.' },
  { icon: '\u{1F4AA}', title: 'Prioridade de Energia', text: 'Construa o abrigo MAIS SIMPLES possivel primeiro. Melhore depois. Gastar toda energia em um abrigo perfeito e perigoso.' },
  { icon: '\u{1F332}', title: 'Cama Primeiro', text: 'Se so tem tempo para uma coisa, faca a CAMA. 15cm de folhas entre voce e o chao salva mais vidas que paredes.' },
  { icon: '\u{1F9CA}', title: 'Paradoxo da Neve', text: 'Neve isola. Um iglu a -40C fora mantem 0C dentro. Nao tema usar neve — tame-a como isolamento.' },
  { icon: '\u{1F9F1}', title: 'Pilha de Pedras', text: 'Pedras absorvem calor durante o dia. Coloque pedras aquecidas (por fogo) dentro do abrigo antes de dormir.' },
  { icon: '\u{1F4A7}', title: 'Condensacao Interna', text: 'Umidade interna e inevitavel (respiracao). Ventile levemente para evitar que tudo fique molhado por dentro.' },
  { icon: '\u{1F33F}', title: 'Eucalipto Repelente', text: 'Folhas de eucalipto frescas espalhadas no chao do abrigo repelem insetos e aracnideos naturalmente.' },
  { icon: '\u{1F512}', title: 'Sinalize sua Posicao', text: 'Marque seu abrigo com algo visivel de cima (X no chao, tecido colorido) para facilitar resgate.' }
];

function shelterInit() {
  _shelterSection = 'types';
  _shelterRender();
}

function shelterSetSection(sec) {
  _shelterSection = sec;
  document.querySelectorAll('.shelter-tab').forEach(b => b.classList.toggle('active', b.dataset.section === sec));
  shelterHideDetail();
  _shelterRender();
}

function _shelterRender() {
  const c = document.getElementById('shelterContent');
  if (!c) return;
  const sections = {
    types:      _shelterTypes,
    materials:  _shelterMaterials,
    insulation: _shelterInsulation,
    protection: _shelterProtection,
    tools:      _shelterTools,
    location:   _shelterLocation,
    tips:       _shelterTips,
  };
  c.innerHTML = (sections[_shelterSection] || _shelterTypes)();
  const st = document.getElementById('shelterStatus');
  if (st) {
    const labels = {
      types: 'Tipos de abrigo', materials: 'Materiais por bioma', insulation: 'Isolamento termico',
      protection: 'Protecao contra elementos', tools: 'Ferramentas minimas', location: 'Escolha de local', tips: 'Dicas rapidas'
    };
    st.textContent = labels[_shelterSection] || '';
  }
  const cnt = document.getElementById('shelterCount');
  if (cnt) {
    if (_shelterSection === 'types') cnt.textContent = SHELTER_TYPES.length + ' tipos';
    else if (_shelterSection === 'tips') cnt.textContent = SHELTER_TIPS.length + ' dicas';
    else cnt.textContent = '';
  }
}

/* ── Types ──────────────────────────────────────────────────────────────────── */
function _shelterTypes() {
  let html = '<div class="shelter-section"><div class="shelter-grid">';
  for (const s of SHELTER_TYPES) {
    const badges = s.biomes.map(b => {
      const labels = { forest: 'Floresta', desert: 'Deserto', snow: 'Neve', urban: 'Urbano' };
      return `<span class="shelter-badge shelter-badge-${b}">${labels[b]}</span>`;
    }).join('');
    html += `
    <div class="shelter-card shelter-card-clickable" onclick="shelterShowType('${s.id}')">
      <h3>${s.icon} ${s.name}</h3>
      <p class="shelter-desc">${s.desc}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">
        <span>\u23F1 ${s.time}</span>
        <span>\u{1F465} ${s.people}</span>
        <span>\u{1F4AA} ${s.difficulty}</span>
      </div>
      <div>${badges}</div>
    </div>`;
  }
  html += '</div></div>';
  return html;
}

function shelterShowType(id) {
  const s = SHELTER_TYPES.find(t => t.id === id);
  if (!s) return;
  const inner = document.getElementById('shelterDetailInner');
  const detail = document.getElementById('shelterDetail');
  if (!inner || !detail) return;

  const badges = s.biomes.map(b => {
    const labels = { forest: 'Floresta', desert: 'Deserto', snow: 'Neve', urban: 'Urbano' };
    return `<span class="shelter-badge shelter-badge-${b}">${labels[b]}</span>`;
  }).join(' ');

  let html = `
  <button class="shelter-detail-back" onclick="shelterHideDetail()">\u2190 Voltar</button>
  <div class="shelter-card shelter-card-primary">
    <h3>${s.icon} ${s.name}</h3>
    <p class="shelter-desc">${s.desc}</p>
    <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:0.8rem;color:var(--text-muted);margin-bottom:10px">
      <span>\u23F1\uFE0F Tempo: <strong>${s.time}</strong></span>
      <span>\u{1F465} Pessoas: <strong>${s.people}</strong></span>
      <span>\u{1F4AA} Dificuldade: <strong>${s.difficulty}</strong></span>
    </div>
    <div style="margin-bottom:12px">${badges}</div>
  </div>

  <div class="shelter-card">
    <h3>\u{1F9F1} Materiais Necessarios</h3>
    <ul class="shelter-list">
      ${s.materials.map(m => `<li>${m}</li>`).join('')}
    </ul>
  </div>

  <div class="shelter-card shelter-card-primary">
    <h3>\u{1F527} Passo a Passo</h3>
    <div class="shelter-steps">
      ${s.steps.map((step, i) => `<div class="shelter-step"><span class="shelter-step-num">${i + 1}</span><span>${step}</span></div>`).join('')}
    </div>
  </div>

  <div class="shelter-warning">
    <span class="shelter-warning-icon">\u{1F4A1}</span>
    <span>${s.tips}</span>
  </div>`;

  inner.innerHTML = html;
  detail.classList.remove('hidden');
}

function shelterHideDetail() {
  const detail = document.getElementById('shelterDetail');
  if (detail) detail.classList.add('hidden');
}

/* ── Materials ─────────────────────────────────────────────────────────────── */
function _shelterMaterials() {
  let html = '<div class="shelter-section">';
  for (const [key, biome] of Object.entries(SHELTER_BIOME_MATERIALS)) {
    html += `
    <div class="shelter-card">
      <h3><span class="shelter-badge shelter-badge-${biome.color}">${biome.icon} ${biome.name}</span></h3>
      <table class="shelter-table">
        <tr><th>Categoria</th><th>Materiais</th></tr>
        <tr><td>\u{1F9F1} Estrutural</td><td>${biome.structural.join(', ')}</td></tr>
        <tr><td>\u{1F3DA}\uFE0F Cobertura</td><td>${biome.cover.join(', ')}</td></tr>
        <tr><td>\u{1F321}\uFE0F Isolamento</td><td>${biome.insulation.join(', ')}</td></tr>
        <tr><td>\u{1F9F6} Amarracao</td><td>${biome.binding.join(', ')}</td></tr>
      </table>
      <div class="shelter-warning" style="margin-top:10px">
        <span class="shelter-warning-icon">\u{1F4A7}</span>
        <span><strong>Agua:</strong> ${biome.water}</span>
      </div>
    </div>`;
  }
  html += '</div>';
  return html;
}

/* ── Insulation ────────────────────────────────────────────────────────────── */
function _shelterInsulation() {
  const data = SHELTER_INSULATION_DATA;
  let html = '<div class="shelter-section">';

  // Principles
  html += '<div class="shelter-card shelter-card-primary"><h3>\u{1F9EA} Principios de Isolamento</h3><div class="shelter-steps">';
  for (const p of data.principles) {
    html += `<div class="shelter-step"><span class="shelter-step-num">\u2022</span><span><strong>${p.title}:</strong> ${p.desc}</span></div>`;
  }
  html += '</div></div>';

  // Layer system
  html += '<div class="shelter-card"><h3>\u{1F4DA} Sistema de Camadas (de baixo para cima)</h3><div class="shelter-steps">';
  for (const l of data.layers_system) {
    html += `<div class="shelter-step"><span style="font-size:1rem;flex-shrink:0">${l.icon}</span><span><strong>${l.layer}:</strong> ${l.desc}</span></div>`;
  }
  html += '</div></div>';

  // Natural materials table
  html += `<div class="shelter-card"><h3>\u{1F33F} Materiais Naturais de Isolamento</h3>
    <table class="shelter-table">
      <tr><th>Material</th><th>Eficiencia</th><th>Espessura Min.</th><th>Notas</th></tr>
      ${data.natural_materials.map(m => `<tr><td><strong>${m.name}</strong></td><td>${m.rValue}</td><td>${m.thickness}</td><td>${m.notes}</td></tr>`).join('')}
    </table>
  </div>`;

  html += '</div>';
  return html;
}

/* ── Protection ────────────────────────────────────────────────────────────── */
function _shelterProtection() {
  let html = '<div class="shelter-section">';
  for (const [key, prot] of Object.entries(SHELTER_PROTECTION)) {
    html += `<div class="shelter-card"><h3>${prot.title}</h3><ul class="shelter-list">
      ${prot.items.map(item => `<li>${item}</li>`).join('')}
    </ul></div>`;
  }
  html += '</div>';
  return html;
}

/* ── Tools ─────────────────────────────────────────────────────────────────── */
function _shelterTools() {
  let html = '<div class="shelter-section">';

  // Essential tools
  html += `<div class="shelter-card shelter-card-primary"><h3>\u{1F9F0} Kit Essencial de Abrigo</h3>
    <table class="shelter-table">
      <tr><th>Ferramenta</th><th>Peso</th><th>Usos</th></tr>
      ${SHELTER_TOOLS.essential.map(t => `<tr><td><strong>${t.name}</strong></td><td>${t.weight}</td><td>${t.uses}</td></tr>`).join('')}
    </table>
  </div>`;

  // Improvised
  html += '<div class="shelter-card"><h3>\u{1F4A1} Improvisacao sem Ferramentas</h3><div class="shelter-steps">';
  for (const imp of SHELTER_TOOLS.improvised) {
    html += `<div class="shelter-step"><span class="shelter-step-num">!</span><span><strong>${imp.name}:</strong> ${imp.solution}</span></div>`;
  }
  html += '</div></div>';

  html += '</div>';
  return html;
}

/* ── Location ──────────────────────────────────────────────────────────────── */
function _shelterLocation() {
  let html = '<div class="shelter-section">';

  // Good locations
  html += '<div class="shelter-card shelter-card-primary"><h3>\u2705 Locais Ideais</h3><div class="shelter-steps">';
  for (const g of SHELTER_LOCATION.good) {
    html += `<div class="shelter-step"><span class="shelter-step-num">\u2713</span><span><strong>${g.rule}:</strong> ${g.reason}</span></div>`;
  }
  html += '</div></div>';

  // Avoid
  html += '<div class="shelter-card"><h3>\u274C Locais para EVITAR</h3><div class="shelter-steps">';
  for (const a of SHELTER_LOCATION.avoid) {
    html += `<div class="shelter-step"><span class="shelter-step-num" style="background:rgba(244,67,54,0.15);color:#f44336">\u2717</span><span><strong>${a.rule}:</strong> ${a.reason}</span></div>`;
  }
  html += '</div></div>';

  html += '</div>';
  return html;
}

/* ── Tips ──────────────────────────────────────────────────────────────────── */
function _shelterTips() {
  let html = '<div class="shelter-section"><div class="shelter-tip-grid">';
  for (const tip of SHELTER_TIPS) {
    html += `
    <div class="shelter-tip-card">
      <div class="shelter-tip-icon">${tip.icon}</div>
      <div class="shelter-tip-text">
        <h4>${tip.title}</h4>
        <p>${tip.text}</p>
      </div>
    </div>`;
  }
  html += '</div></div>';
  return html;
}

// Expose to window
window.shelterInit = shelterInit;
window.shelterSetSection = shelterSetSection;
window.shelterShowType = shelterShowType;
window.shelterHideDetail = shelterHideDetail;


// ═══════════════════════════════════════════════════════════════════════════════
// ENERGY & ELECTRICITY APP
// ═══════════════════════════════════════════════════════════════════════════════

let _energySection = 'circuits';
let _energyFireDetail = null;

function energyInit() {
  _energySection = 'circuits';
  energyRender();
}

function energySetSection(section) {
  _energySection = section;
  document.querySelectorAll('.energy-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.section === section);
  });
  energyRender();
  const c = document.getElementById('energyContent');
  if (c) c.scrollTop = 0;
  const labels = {
    circuits: 'Circuitos basicos', batteries: 'Baterias & armazenamento',
    solar: 'Energia solar', generator: 'Gerador improvisado',
    conservation: 'Conservacao de energia', fire: 'Fogo & calor',
    calculator: 'Calculadora solar'
  };
  const s = document.getElementById('energyStatus');
  if (s) s.textContent = '\u26A1 ' + (labels[section] || 'Pronto');
}

function energyRender() {
  const el = document.getElementById('energyContent');
  if (!el) return;
  const renderers = {
    circuits: energyRenderCircuits,
    batteries: energyRenderBatteries,
    solar: energyRenderSolar,
    generator: energyRenderGenerator,
    conservation: energyRenderConservation,
    fire: energyRenderFire,
    calculator: energyRenderCalculator,
  };
  const fn = renderers[_energySection];
  el.innerHTML = fn ? fn() : '';
}

// ─── 1. CIRCUITS ─────────────────────────────────────────────────────────────

function energyRenderCircuits() {
  return `
    <div class="energy-section">
      <div class="energy-section-title">\u26A1 Leis Fundamentais</div>

      <div class="energy-formula">
        <div class="energy-formula-symbol">V=IR</div>
        <div class="energy-formula-desc">
          <strong>Lei de Ohm</strong><br>
          Tensao (V) = Corrente (I) x Resistencia (R)<br>
          <em>V em Volts, I em Amperes, R em Ohms</em>
        </div>
      </div>

      <div class="energy-formula">
        <div class="energy-formula-symbol">P=VI</div>
        <div class="energy-formula-desc">
          <strong>Potencia</strong><br>
          Potencia (W) = Tensao (V) x Corrente (A)<br>
          Tambem: <code>P = I\u00B2R</code> e <code>P = V\u00B2/R</code>
        </div>
      </div>
    </div>

    <div class="energy-section">
      <div class="energy-section-title">\u{1F50C} Calculadora Ohm / Potencia</div>
      <div class="energy-card">
        <div class="energy-card-title">Calcular valores</div>
        <div class="energy-calc-group">
          <div class="energy-calc-field">
            <label>Tensao (V)</label>
            <input type="number" id="energyOhmV" placeholder="ex: 12" step="any">
          </div>
          <div class="energy-calc-field">
            <label>Corrente (A)</label>
            <input type="number" id="energyOhmI" placeholder="ex: 2" step="any">
          </div>
          <div class="energy-calc-field">
            <label>Resistencia (\u03A9)</label>
            <input type="number" id="energyOhmR" placeholder="ex: 6" step="any">
          </div>
          <div class="energy-calc-field">
            <label>Potencia (W)</label>
            <input type="number" id="energyOhmP" placeholder="auto" step="any">
          </div>
        </div>
        <button class="energy-calc-btn" onclick="energyCalcOhm()">Calcular</button>
        <div class="energy-calc-result" id="energyOhmResult">Preencha 2 valores e clique calcular.</div>
      </div>
    </div>

    <div class="energy-section">
      <div class="energy-section-title">\u{1F504} Circuito em Serie</div>
      <div class="energy-card">
        <div class="energy-diagram">  +---[R1]---[R2]---[R3]---+
  |                         |
 [+] Bateria             [-]
  |_________________________|</div>
        <div class="energy-card-body">
          <ul>
            <li><strong>Corrente</strong>: igual em todos os componentes</li>
            <li><strong>Tensao</strong>: divide-se entre componentes (V = V1+V2+V3)</li>
            <li><strong>Resistencia total</strong>: <code>Rt = R1+R2+R3</code></li>
            <li>Se um componente queimar, o circuito todo para</li>
            <li><strong>Baterias em serie</strong>: voltagem soma, capacidade nao muda</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="energy-section">
      <div class="energy-section-title">\u{1F504} Circuito em Paralelo</div>
      <div class="energy-card">
        <div class="energy-diagram">       +---[R1]---+
       |           |
  +----+---[R2]---+----+
  |    |           |    |
  |    +---[R3]---+    |
  |                     |
 [+] Bateria         [-]
  |_____________________|</div>
        <div class="energy-card-body">
          <ul>
            <li><strong>Tensao</strong>: igual em todos os componentes</li>
            <li><strong>Corrente</strong>: divide-se entre ramos (I = I1+I2+I3)</li>
            <li><strong>Resistencia total</strong>: <code>1/Rt = 1/R1 + 1/R2 + 1/R3</code></li>
            <li>Se um componente queimar, os outros continuam</li>
            <li><strong>Baterias em paralelo</strong>: capacidade soma, voltagem nao muda</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="energy-info">
      <strong>\u{1F4A1} Dica:</strong> Na duvida, use paralelo para baterias (mais capacidade, mesma voltagem).
      Use serie quando precisar de voltagem maior (ex: 4x pilha AA = 6V).
    </div>
  `;
}

function energyCalcOhm() {
  const vEl = document.getElementById('energyOhmV');
  const iEl = document.getElementById('energyOhmI');
  const rEl = document.getElementById('energyOhmR');
  const pEl = document.getElementById('energyOhmP');
  const res = document.getElementById('energyOhmResult');

  let v = vEl.value ? parseFloat(vEl.value) : null;
  let i = iEl.value ? parseFloat(iEl.value) : null;
  let r = rEl.value ? parseFloat(rEl.value) : null;
  let p = pEl.value ? parseFloat(pEl.value) : null;

  const known = [v,i,r,p].filter(x => x !== null && !isNaN(x));
  if (known.length < 2) {
    res.innerHTML = '\u26A0\uFE0F Preencha pelo menos <strong>2 valores</strong> para calcular os demais.';
    return;
  }

  if (v !== null && i !== null) {
    r = r ?? v / i;
    p = p ?? v * i;
  } else if (v !== null && r !== null) {
    i = i ?? v / r;
    p = p ?? (v * v) / r;
  } else if (i !== null && r !== null) {
    v = v ?? i * r;
    p = p ?? i * i * r;
  } else if (p !== null && v !== null) {
    i = i ?? p / v;
    r = r ?? (v * v) / p;
  } else if (p !== null && i !== null) {
    v = v ?? p / i;
    r = r ?? p / (i * i);
  } else if (p !== null && r !== null) {
    v = v ?? Math.sqrt(p * r);
    i = i ?? Math.sqrt(p / r);
  }

  if (v !== null) vEl.value = +v.toFixed(4);
  if (i !== null) iEl.value = +i.toFixed(4);
  if (r !== null) rEl.value = +r.toFixed(4);
  if (p !== null) pEl.value = +p.toFixed(4);

  res.innerHTML = `
    <strong>\u26A1 Tensao:</strong> ${v?.toFixed(2) ?? '?'} V &nbsp;|&nbsp;
    <strong>\u{1F50C} Corrente:</strong> ${i?.toFixed(3) ?? '?'} A &nbsp;|&nbsp;
    <strong>\u03A9 Resistencia:</strong> ${r?.toFixed(2) ?? '?'} \u03A9 &nbsp;|&nbsp;
    <strong>\u{1F525} Potencia:</strong> ${p?.toFixed(2) ?? '?'} W
  `;
}

// ─── 2. BATTERIES ────────────────────────────────────────────────────────────

function energyRenderBatteries() {
  return `
    <div class="energy-section">
      <div class="energy-section-title">\u{1F50B} Tipos de Bateria</div>
      <table class="energy-table">
        <tr>
          <th>Tipo</th><th>Tensao</th><th>Capacidade</th><th>Recarga</th><th>Uso tipico</th>
        </tr>
        <tr><td><strong>AA (alcalina)</strong></td><td>1.5V</td><td>~2500 mAh</td><td>Nao</td><td>Lanternas, radios</td></tr>
        <tr><td><strong>AAA (alcalina)</strong></td><td>1.5V</td><td>~1000 mAh</td><td>Nao</td><td>Controles, sensores</td></tr>
        <tr><td><strong>AA NiMH</strong></td><td>1.2V</td><td>~2000 mAh</td><td>Sim (500+)</td><td>Uso diario recargavel</td></tr>
        <tr><td><strong>18650 Li-ion</strong></td><td>3.7V</td><td>~2600-3500 mAh</td><td>Sim (300+)</td><td>Lanternas, power banks</td></tr>
        <tr><td><strong>CR123A</strong></td><td>3V</td><td>~1500 mAh</td><td>Nao</td><td>Equipamento tatico</td></tr>
        <tr><td><strong>9V (alcalina)</strong></td><td>9V</td><td>~550 mAh</td><td>Nao</td><td>Detectores, radios</td></tr>
        <tr><td><strong>Carro (chumbo)</strong></td><td>12V</td><td>~45-70 Ah</td><td>Sim</td><td>Veiculos, inversores</td></tr>
        <tr><td><strong>LiFePO4 12V</strong></td><td>12.8V</td><td>~20-100 Ah</td><td>Sim (2000+)</td><td>Solar off-grid</td></tr>
        <tr><td><strong>Power bank USB</strong></td><td>5V</td><td>~10-20k mAh</td><td>Sim</td><td>Celulares, GPS</td></tr>
      </table>
    </div>

    <div class="energy-section">
      <div class="energy-section-title">\u{1F517} Conexoes em Serie vs Paralelo</div>

      <div class="energy-card">
        <div class="energy-card-title">\u2795 Serie (mais voltagem)</div>
        <div class="energy-diagram">  [+1.5V-]---[+1.5V-]---[+1.5V-]---[+1.5V-]
      Total: 6V (voltagem soma, capacidade igual)</div>
        <div class="energy-card-body">
          <p><strong>Regra:</strong> conecte + de uma no - da proxima.</p>
          <p>4x pilha AA = 6V. Util para alimentar dispositivos de voltagem maior.</p>
          <div class="energy-warn">\u26A0\uFE0F NUNCA misture baterias de tipos/idades diferentes em serie!</div>
        </div>
      </div>

      <div class="energy-card">
        <div class="energy-card-title">\u2795 Paralelo (mais capacidade)</div>
        <div class="energy-diagram">  [+1.5V-]---+---saida (+)
  [+1.5V-]---+
  [+1.5V-]---+
     Total: 1.5V, 7500mAh (capacidade soma)</div>
        <div class="energy-card-body">
          <p><strong>Regra:</strong> conecte todos os + juntos e todos os - juntos.</p>
          <p>Mesma voltagem, mas dura 3x mais. Util para estender autonomia.</p>
          <div class="energy-warn">\u26A0\uFE0F Use baterias IDENTICAS (mesma marca, tipo, carga) em paralelo!</div>
        </div>
      </div>
    </div>

    <div class="energy-section">
      <div class="energy-section-title">\u{1F4CA} Calculadora de Autonomia</div>
      <div class="energy-card">
        <div class="energy-calc-group">
          <div class="energy-calc-field">
            <label>Capacidade bateria (mAh)</label>
            <input type="number" id="energyBatCap" placeholder="ex: 10000" step="any">
          </div>
          <div class="energy-calc-field">
            <label>Consumo dispositivo (mA)</label>
            <input type="number" id="energyBatDrain" placeholder="ex: 500" step="any">
          </div>
        </div>
        <button class="energy-calc-btn" onclick="energyCalcBattery()">Calcular Autonomia</button>
        <div class="energy-calc-result" id="energyBatResult">Preencha capacidade e consumo.</div>
      </div>
    </div>

    <div class="energy-info">
      <strong>\u{1F4A1} Dica:</strong> Guarde baterias em local seco e fresco. Pilhas alcalinas duram
      5-10 anos seladas. Baterias 18650 sao as mais versateis para kits de emergencia.
    </div>
  `;
}

function energyCalcBattery() {
  const cap = parseFloat(document.getElementById('energyBatCap')?.value);
  const drain = parseFloat(document.getElementById('energyBatDrain')?.value);
  const res = document.getElementById('energyBatResult');
  if (!cap || !drain || drain <= 0) {
    res.innerHTML = '\u26A0\uFE0F Preencha valores validos.';
    return;
  }
  const hours = (cap / drain) * 0.85;
  const days = hours / 24;
  res.innerHTML = `
    <strong>\u23F1\uFE0F Autonomia estimada:</strong> ${hours.toFixed(1)} horas (~${days.toFixed(1)} dias)<br>
    <em>Calculado com 85% de eficiencia real.</em>
  `;
}

// ─── 3. SOLAR ────────────────────────────────────────────────────────────────

function energyRenderSolar() {
  return `
    <div class="energy-section">
      <div class="energy-section-title">\u2600\uFE0F Energia Solar Basica</div>
      <div class="energy-card">
        <div class="energy-card-title">Como funciona</div>
        <div class="energy-card-body">
          <p>Painel solar converte luz em eletricidade DC. Um <strong>controlador de carga</strong> protege a bateria.
          Um <strong>inversor</strong> converte DC em AC (para tomadas comuns).</p>
          <div class="energy-diagram">  [PAINEL SOLAR] --DC--> [CONTROLADOR] --DC--> [BATERIA]
                                    |
                              [INVERSOR] --AC--> [TOMADA 110/220V]
                                    |
                              [USB/DC] --------> [CELULAR/LED/RADIO]</div>
        </div>
      </div>
    </div>

    <div class="energy-section">
      <div class="energy-section-title">\u{1F4CA} Calculo de Sistema Solar</div>
      <div class="energy-card">
        <div class="energy-card-body">
          <p><strong>Formula basica:</strong></p>
          <div class="energy-formula">
            <div class="energy-formula-symbol" style="font-size:16px;">Painel = Wh / HSP / 0.7</div>
            <div class="energy-formula-desc">
              Wh = consumo diario em watt-hora<br>
              HSP = horas de sol pico (3-6h no Brasil)<br>
              0.7 = fator de perdas (cabos, controlador, etc)
            </div>
          </div>
        </div>
      </div>

      <div class="energy-card">
        <div class="energy-card-title">Consumo tipico de dispositivos</div>
        <table class="energy-table">
          <tr><th>Dispositivo</th><th>Watts</th><th>Uso diario</th><th>Wh/dia</th></tr>
          <tr><td>Celular (carga)</td><td>10W</td><td>2h</td><td>20 Wh</td></tr>
          <tr><td>Lampada LED</td><td>5W</td><td>5h</td><td>25 Wh</td></tr>
          <tr><td>Radio</td><td>3W</td><td>4h</td><td>12 Wh</td></tr>
          <tr><td>Laptop</td><td>45W</td><td>3h</td><td>135 Wh</td></tr>
          <tr><td>Ventilador</td><td>30W</td><td>8h</td><td>240 Wh</td></tr>
          <tr><td>Mini geladeira</td><td>60W</td><td>12h</td><td>720 Wh</td></tr>
          <tr><td>Router Wi-Fi</td><td>10W</td><td>24h</td><td>240 Wh</td></tr>
        </table>
      </div>
    </div>

    <div class="energy-section">
      <div class="energy-section-title">\u{1F6E0}\uFE0F Sistema Solar Simples</div>
      <div class="energy-card">
        <div class="energy-card-title">Kit minimo para sobrevivencia</div>
        <div class="energy-card-body">
          <ul>
            <li><strong>Painel 100W</strong> - carrega celular + LED + radio</li>
            <li><strong>Controlador PWM 10A</strong> - protege a bateria</li>
            <li><strong>Bateria 12V 45Ah</strong> - armazena ~540Wh</li>
            <li><strong>Inversor 300W</strong> - para usar tomada 110V</li>
            <li><strong>Cabos 4mm\u00B2</strong> + conectores MC4</li>
          </ul>
        </div>
      </div>

      <div class="energy-card">
        <div class="energy-card-title">\u{1F4CB} Dicas de instalacao</div>
        <div class="energy-card-body">
          <ul>
            <li>Incline o painel para o <strong>Norte</strong> (hemisferio sul) com angulo = latitude local</li>
            <li>Evite sombra parcial - uma celula sombreada reduz o painel todo</li>
            <li>Use cabos curtos e grossos para minimizar perda</li>
            <li>Mantenha a bateria ventilada e longe do calor direto</li>
            <li>Limpe o painel com pano umido semanalmente</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="energy-warn">
      \u26A0\uFE0F <strong>SEGURANCA:</strong> Baterias de chumbo emitem gas hidrogenio durante carga.
      Nunca instale em ambientes fechados sem ventilacao. Risco de explosao!
    </div>
  `;
}

// ─── 4. GENERATOR ────────────────────────────────────────────────────────────

function energyRenderGenerator() {
  return `
    <div class="energy-section">
      <div class="energy-section-title">\u2699\uFE0F Principios de Geracao</div>
      <div class="energy-card">
        <div class="energy-card-title">\u{1F9F2} Como um gerador funciona</div>
        <div class="energy-card-body">
          <p>Um gerador converte <strong>energia mecanica</strong> em <strong>energia eletrica</strong>
          atraves de <strong>inducao eletromagnetica</strong>.</p>
          <p>Quando um ima gira dentro de uma bobina de fio de cobre, cria-se corrente eletrica.
          Esse e o principio do <strong>dinamo</strong>.</p>
          <div class="energy-diagram">     Ima (gira)
        N|S
     ___/ \\___
    /    \u{1F50C}    \\     Bobina de cobre
    \\___/|\\___/     (enrolamento de fio)
         |
    Eixo (manivela/pedal/agua/vento)</div>
        </div>
      </div>
    </div>

    <div class="energy-section">
      <div class="energy-section-title">\u{1F6E0}\uFE0F Metodos Improvisados</div>

      <div class="energy-card">
        <div class="energy-card-title">\u{1F697} Alternador de Carro</div>
        <div class="energy-card-body">
          <p>O alternador de carro e um gerador pronto, projetado para 12-14V e 50-100A.</p>
          <ul>
            <li>Remova o alternador do veiculo (3-4 parafusos + correia)</li>
            <li>Conecte a qualquer fonte de rotacao (motor, roda d'agua, etc)</li>
            <li>Precisa de rotacao alta: <strong>2000-3000 RPM</strong></li>
            <li>Use polia/correia para multiplicar rotacao</li>
            <li>Conecte direto a bateria 12V para carregar</li>
            <li>Saida: <strong>500-1500W</strong> dependendo da rotacao</li>
          </ul>
          <div class="energy-info">\u{1F4A1} O alternador precisa de bateria conectada para "excitacao" do campo magnetico inicial.</div>
        </div>
      </div>

      <div class="energy-card">
        <div class="energy-card-title">\u{1F6B2} Bicicleta Geradora</div>
        <div class="energy-card-body">
          <p>Uma bicicleta pode gerar <strong>50-150W</strong> com pedalada constante.</p>
          <ul>
            <li>Levante a roda traseira (use suporte ou vire a bike)</li>
            <li>Acople motor DC ou alternador pequeno na roda</li>
            <li>Use rolo de contato no pneu ou correia</li>
            <li>Conecte a controlador de carga + bateria</li>
            <li>1 hora pedalando = carregar celular 2-3x</li>
            <li>Pessoa media sustenta ~75W por 1 hora</li>
          </ul>
          <div class="energy-diagram">  [Pedal] --> [Roda] --> [Motor DC/Dinamo]
                               |
                    [Controlador] --> [Bateria 12V]
                               |
                          [USB/LED]</div>
        </div>
      </div>

      <div class="energy-card">
        <div class="energy-card-title">\u{1F4A8} Gerador Eolico (vento)</div>
        <div class="energy-card-body">
          <ul>
            <li>Motor DC de impressora/furadeira funciona como gerador</li>
            <li>Fixe helices (tubos PVC cortados ou madeira) ao eixo</li>
            <li>Instale no ponto mais alto e exposto ao vento</li>
            <li>Saida: <strong>10-50W</strong> com vento moderado</li>
            <li>Ideal para carga lenta e continua de baterias</li>
          </ul>
        </div>
      </div>

      <div class="energy-card">
        <div class="energy-card-title">\u{1F4A7} Gerador Hidraulico (agua)</div>
        <div class="energy-card-body">
          <ul>
            <li>Se houver riacho com queda, use roda d'agua</li>
            <li>Motor de maquina de lavar funciona como gerador</li>
            <li>Fluxo constante = energia 24h</li>
            <li>Saida: <strong>50-500W</strong> dependendo da queda e vazao</li>
            <li>Melhor que solar para noite e dias nublados</li>
          </ul>
          <div class="energy-info">\u{1F4A1} Potencia: <code>P(W) = 9.8 x Vazao(L/s) x Altura(m) x 0.5</code></div>
        </div>
      </div>

      <div class="energy-card">
        <div class="energy-card-title">\u270B Gerador de Manivela</div>
        <div class="energy-card-body">
          <ul>
            <li>Motor DC pequeno + manivela = gerador manual</li>
            <li>Saida: <strong>5-20W</strong> com cranking constante</li>
            <li>Suficiente para carregar celular ou radio</li>
            <li>Engrenagens aumentam RPM e saida</li>
            <li>Radios e lanternas com manivela ja usam esse principio</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="energy-warn">
      \u26A0\uFE0F <strong>SEGURANCA:</strong> Geradores improvisados geram tensoes irregulares.
      Sempre use controlador de carga entre gerador e bateria.
    </div>
  `;
}

// ─── 5. CONSERVATION ─────────────────────────────────────────────────────────

function energyRenderConservation() {
  return `
    <div class="energy-section">
      <div class="energy-section-title">\u{1F4F1} Celular</div>
      <div class="energy-card">
        <div class="energy-card-title">Economizar bateria do celular</div>
        <div class="energy-card-body">
          <ul>
            <li><strong>Modo aviao</strong>: ative quando nao precisa de sinal (~50% economia)</li>
            <li><strong>Brilho minimo</strong>: tela consome ~40% da bateria</li>
            <li><strong>Modo escuro</strong>: em telas OLED, economia de 15-30%</li>
            <li><strong>Feche tudo</strong>: GPS, Bluetooth, WiFi, NFC</li>
            <li><strong>Desative vibracoes</strong>: motor de vibracao consome bastante</li>
            <li><strong>Camera/flash</strong>: evite usar desnecessariamente</li>
            <li><strong>Modo ultra economia</strong>: limita a ligacao e SMS (dura dias)</li>
            <li><strong>Temperatura</strong>: perde capacidade com frio (&lt;0\u00B0C) e degrada com calor (&gt;35\u00B0C)</li>
          </ul>
          <div class="energy-info">\u{1F4A1} Celular em modo aviao com tela desligada: <strong>3-5 dias</strong> standby.</div>
        </div>
      </div>
    </div>

    <div class="energy-section">
      <div class="energy-section-title">\u{1F4BB} Laptop</div>
      <div class="energy-card">
        <div class="energy-card-title">Estender bateria do laptop</div>
        <div class="energy-card-body">
          <ul>
            <li><strong>Brilho minimo</strong>: reduza ao nivel minimo legivel</li>
            <li><strong>Desative WiFi e Bluetooth</strong> quando nao usar</li>
            <li><strong>Feche programas pesados</strong>: navegador consome muito</li>
            <li><strong>Modo economia</strong>: ative plano de energia conservador</li>
            <li><strong>Desconecte USB</strong>: dispositivos drenam bateria</li>
            <li><strong>Hiberne vs Suspender</strong>: hibernar nao consome energia</li>
            <li><strong>Use SSD</strong>: consome menos que HD mecanico</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="energy-section">
      <div class="energy-section-title">\u{1F4CB} Prioridade de Dispositivos</div>
      <div class="energy-card">
        <div class="energy-card-body">
          <table class="energy-table">
            <tr><th>Prioridade</th><th>Dispositivo</th><th>Razao</th></tr>
            <tr><td><strong>1 - CRITICO</strong></td><td>Radio comunicacao</td><td>Contato com resgate</td></tr>
            <tr><td><strong>2 - ALTO</strong></td><td>Celular</td><td>GPS, chamadas emergencia</td></tr>
            <tr><td><strong>3 - MEDIO</strong></td><td>Lanterna LED</td><td>Seguranca noturna</td></tr>
            <tr><td><strong>4 - MEDIO</strong></td><td>Purificador UV agua</td><td>Saude</td></tr>
            <tr><td><strong>5 - BAIXO</strong></td><td>Laptop</td><td>Informacao, mapas offline</td></tr>
            <tr><td><strong>6 - BAIXO</strong></td><td>Ventilador/aquecedor</td><td>Conforto</td></tr>
          </table>
          <div class="energy-info">\u{1F4A1} Em crise, concentre toda energia nos itens 1-3.</div>
        </div>
      </div>
    </div>

    <div class="energy-section">
      <div class="energy-section-title">\u{1F50B} Cuidados com Baterias</div>
      <div class="energy-card">
        <div class="energy-card-body">
          <ul>
            <li>Nao descarregue litio abaixo de <strong>20%</strong> regularmente</li>
            <li>Guarde baterias com <strong>50-70%</strong> de carga para longa duracao</li>
            <li>Nao carregue sob sol direto ou temperaturas extremas</li>
            <li>Baterias de chumbo: mantenha <strong>100% carregadas</strong></li>
            <li>Pilhas alcalinas duram mais em 20-25\u00B0C</li>
            <li>Remova pilhas de dispositivos que nao vai usar por meses</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

// ─── 6. FIRE ─────────────────────────────────────────────────────────────────

const FIRE_METHODS = [
  {
    id: 'matches', icon: '\u{1FA94}', title: 'Fosforo / Isqueiro',
    desc: 'Metodo mais facil e confiavel.',
    steps: [
      'Prepare material combustivel: papel, folhas secas, algodao, casca de arvore',
      'Faca um "ninho" de material fino (isca/tinder)',
      'Acenda o fosforo e coloque na isca',
      'Sopre suavemente na base para alimentar com oxigenio',
      'Adicione galhos finos, depois medios, depois grossos',
    ],
    tip: 'Guarde fosforos em saco plastico ziplock para manter secos.'
  },
  {
    id: 'ferro', icon: '\u{1F525}', title: 'Pederneira (Ferro-cerio)',
    desc: 'Funciona molhado, dura milhares de strikes.',
    steps: [
      'Prepare ninho de material seco e fino (algodao, raspas de madeira)',
      'Segure a pederneira perto do ninho',
      'Raspe a lamina contra o ferro-cerio em angulo de 45 graus',
      'Direcione as faiscas para o centro do ninho',
      'Quando comecar a fumegar, sopre suavemente',
      'Adicione gravetos progressivamente maiores',
    ],
    tip: 'Pederneira + algodao com vaselina = combinacao mais confiavel.'
  },
  {
    id: 'friction', icon: '\u{1FAB5}', title: 'Friccao (Arco e broca)',
    desc: 'Metodo primitivo. Dificil mas funciona sem ferramentas.',
    steps: [
      'Encontre madeira seca e macia (salgueiro, cedro, choupo)',
      'Faca uma "tabua" (fireboard) com entalhe em V e depressao',
      'Faca um "fuso" (spindle) de 30-50cm, reto e seco',
      'Monte um arco com corda/cordao e galho curvo',
      'Coloque casca seca sob o entalhe para coletar po quente',
      'Gire o fuso rapidamente com o arco, pressionando para baixo',
      'Quando acumular po escuro fumegante, transfira para o ninho',
      'Sopre ate pegar fogo',
    ],
    tip: 'Requer MUITA pratica. Treine antes de precisar.'
  },
  {
    id: 'lens', icon: '\u{1F50D}', title: 'Lente / Concentracao Solar',
    desc: 'Funciona em dia ensolarado. Use lupa, garrafa ou oculos.',
    steps: [
      'Necessario: dia com sol direto e lente convergente',
      'Pode usar: lupa, lente de oculos (+), fundo de garrafa com agua, gelo polido',
      'Foque a luz em um ponto minimo no material combustivel',
      'Segure firme por 30-60 segundos ate fumegar',
      'Nao mova a lente - mantenha o ponto concentrado',
      'Quando comecar a fumegar, sopre suavemente',
    ],
    tip: 'Fundo de garrafa PET com agua limpa funciona como lente.'
  },
  {
    id: 'battery', icon: '\u{1F50B}', title: 'Bateria + Palha de Aco',
    desc: 'Metodo rapido com bateria 9V ou pilhas.',
    steps: [
      'Pegue palha de aco (Bombril/esponja de aco) e estique',
      'Toque os dois polos da bateria 9V na palha de aco',
      'A palha vai brilhar e pegar fogo imediatamente',
      'Coloque a palha acesa no ninho de material combustivel',
      'Alternativa: 2 pilhas AA em serie + papel aluminio fino',
    ],
    tip: 'Funciona ate com bateria quase descarregada.'
  },
  {
    id: 'chemical', icon: '\u2697\uFE0F', title: 'Reacao Quimica',
    desc: 'Permanganato de potassio + glicerina, etc.',
    steps: [
      'Metodo 1: Permanganato de potassio + glicerina - misture e espere 30-60s',
      'Metodo 2: Permanganato de potassio + acucar - raspe com pedra',
      'Metodo 3: Bateria de carro - curto-circuito rapido em la de aco',
      'Prepare o ninho ANTES de iniciar a reacao',
      'Cuidado com queimaduras e vapores toxicos',
    ],
    tip: 'Permanganato de potassio: purifica agua, antisseptico, e inicia fogo.'
  },
  {
    id: 'piston', icon: '\u{1F4A8}', title: 'Pistao de Fogo',
    desc: 'Comprime ar rapidamente para aquecer material.',
    steps: [
      'Use tubo de metal ou bambu selado com pistao',
      'Coloque material combustivel fino na ponta do tubo',
      'Empurre o pistao com forca rapida e firme',
      'A compressao do ar aquece acima de 200\u00B0C',
      'Retire o material aceso e coloque no ninho',
    ],
    tip: 'Metodo antigo do sudeste asiatico. Requer tubo bem vedado.'
  },
];

function energyRenderFire() {
  let html = `
    <div class="energy-section">
      <div class="energy-section-title">\u{1F525} Metodos de Fazer Fogo (${FIRE_METHODS.length} metodos)</div>
      <div class="energy-fire-grid">
  `;
  for (const m of FIRE_METHODS) {
    html += `
      <div class="energy-fire-card" onclick="energyToggleFire('${m.id}')">
        <div class="energy-fire-card-icon">${m.icon}</div>
        <div class="energy-fire-card-title">${m.title}</div>
        <div class="energy-fire-card-desc">${m.desc}</div>
      </div>
    `;
  }
  html += '</div>';
  html += '<div class="energy-fire-detail" id="energyFireDetail"></div>';

  html += `
    </div>

    <div class="energy-section">
      <div class="energy-section-title">\u{1F3D5}\uFE0F Tipos de Fogueira</div>

      <div class="energy-card">
        <div class="energy-card-title">Teepee (Tenda)</div>
        <div class="energy-diagram">      /\\
     /  \\
    / \\/ \\
   / /\\ \\ \\
  /________\\
     isca</div>
        <div class="energy-card-body">
          <p>Gravetos apoiados em cone. Boa para iniciar e cozinhar. Queima rapido.</p>
        </div>
      </div>

      <div class="energy-card">
        <div class="energy-card-title">Log Cabin (Cabana)</div>
        <div class="energy-diagram">  ====  camada 4
  ||  ||
  ====  camada 3
  ||  ||
  ====  camada 2
  ||  ||
  ====  camada 1
  [isca no centro]</div>
        <div class="energy-card-body">
          <p>Toras empilhadas em quadrado. Queima lenta, brasas duradouras.</p>
        </div>
      </div>

      <div class="energy-card">
        <div class="energy-card-title">Estrela (Star Fire)</div>
        <div class="energy-diagram">      \\   |   /
       \\  |  /
        \\ | /
    -----[*]-----
        / | \\
       /  |  \\
      /   |   \\</div>
        <div class="energy-card-body">
          <p>Toras grossas em formato de estrela, empurradas para o centro conforme queimam.
          Economica - dura a noite toda com pouca manutencao.</p>
        </div>
      </div>

      <div class="energy-card">
        <div class="energy-card-title">Fogo de Trincheira</div>
        <div class="energy-diagram">  solo   |\\      /|   solo
  ------| \\____/ |------
        | fogo   |
  ------|________|------</div>
        <div class="energy-card-body">
          <p>Cavar vala no chao (~30cm). Protege do vento, menos visivel,
          bom para cozinhar com grelha por cima.</p>
        </div>
      </div>
    </div>

    <div class="energy-section">
      <div class="energy-section-title">\u{1F4A1} Dicas de Manutencao</div>
      <div class="energy-card">
        <div class="energy-card-body">
          <ul>
            <li>Sempre prepare <strong>3 tipos</strong>: isca (fino), gravetos (medio), lenha (grosso)</li>
            <li>Mantenha lenha seca <strong>protegida da chuva</strong></li>
            <li>Nao coloque lenha demais - abafa (precisa de oxigenio)</li>
            <li>Sopre na <strong>BASE</strong> do fogo, nao no topo</li>
            <li>Brasas sao mais uteis que chamas para cozinhar</li>
            <li>Para apagar: espalhe brasas, jogue agua, mexa, jogue mais agua, verifique</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="energy-warn">
      \u26A0\uFE0F <strong>SEGURANCA:</strong> Nunca deixe fogo sem supervisao. Limpe 3m ao redor.
      Tenha agua/terra para apagar. Cuidado com incendios florestais.
    </div>
  `;
  return html;
}

function energyToggleFire(id) {
  const detail = document.getElementById('energyFireDetail');
  if (!detail) return;
  if (_energyFireDetail === id) {
    _energyFireDetail = null;
    detail.classList.remove('show');
    detail.innerHTML = '';
    return;
  }
  _energyFireDetail = id;
  const m = FIRE_METHODS.find(f => f.id === id);
  if (!m) return;
  detail.innerHTML = `
    <div class="energy-card-title">${m.icon} ${m.title}</div>
    <ol>${m.steps.map(s => '<li>' + s + '</li>').join('')}</ol>
    <div class="energy-info">\u{1F4A1} <strong>Dica:</strong> ${m.tip}</div>
  `;
  detail.classList.add('show');
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── 7. SOLAR CALCULATOR ────────────────────────────────────────────────────

function energyRenderCalculator() {
  return `
    <div class="energy-section">
      <div class="energy-section-title">\u{1F4CA} Calculadora de Sistema Solar</div>
      <div class="energy-card">
        <div class="energy-card-title">Passo 1: Consumo diario</div>
        <div class="energy-card-body"><p>Adicione os dispositivos que precisa alimentar:</p></div>
        <div id="energySolarDevices">
          <div class="energy-calc-group" data-device="0">
            <div class="energy-calc-field">
              <label>Dispositivo</label>
              <select onchange="energySolarPreset(this)">
                <option value="">-- Selecione --</option>
                <option value="10,2">Celular (carga)</option>
                <option value="5,5">Lampada LED</option>
                <option value="3,4">Radio</option>
                <option value="45,3">Laptop</option>
                <option value="30,8">Ventilador</option>
                <option value="60,12">Mini geladeira</option>
                <option value="10,24">Router WiFi</option>
                <option value="0,0">Personalizado</option>
              </select>
            </div>
            <div class="energy-calc-field">
              <label>Watts (W)</label>
              <input type="number" class="solar-watts" placeholder="ex: 10" step="any">
            </div>
            <div class="energy-calc-field">
              <label>Horas/dia</label>
              <input type="number" class="solar-hours" placeholder="ex: 2" step="any">
            </div>
            <div class="energy-calc-field">
              <label>Wh/dia</label>
              <input type="text" class="solar-wh" readonly placeholder="auto" style="opacity:0.7">
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="energy-calc-btn" onclick="energySolarAddDevice()" style="font-size:11px;">\u2795 Dispositivo</button>
          <button class="energy-calc-btn" onclick="energySolarRemoveDevice()" style="font-size:11px;opacity:0.7;">\u2796 Remover</button>
        </div>
      </div>

      <div class="energy-card">
        <div class="energy-card-title">Passo 2: Localizacao</div>
        <div class="energy-calc-group">
          <div class="energy-calc-field">
            <label>Horas de sol pico (HSP)</label>
            <select id="energySolarHSP">
              <option value="3">Norte do Brasil (~3h)</option>
              <option value="4">Nordeste (~4h)</option>
              <option value="4.5" selected>Sudeste/Centro-Oeste (~4.5h)</option>
              <option value="4">Sul do Brasil (~4h)</option>
              <option value="3.5">Europa do Sul (~3.5h)</option>
              <option value="2.5">Europa do Norte (~2.5h)</option>
              <option value="5">Deserto/tropical (~5h)</option>
              <option value="3">Nublado frequente (~3h)</option>
            </select>
          </div>
          <div class="energy-calc-field">
            <label>Dias de autonomia</label>
            <input type="number" id="energySolarDays" value="2" min="1" max="7" step="1">
          </div>
        </div>
      </div>

      <button class="energy-calc-btn" onclick="energySolarCalc()" style="width:100%;padding:12px;font-size:14px;">
        \u26A1 CALCULAR SISTEMA SOLAR
      </button>

      <div class="energy-calc-result" id="energySolarResult" style="min-height:80px;">
        Preencha os dispositivos e clique calcular.
      </div>
    </div>

    <div class="energy-info">
      <strong>\u{1F4A1} HSP (Horas de Sol Pico):</strong> Horas equivalentes a sol pleno (1000W/m\u00B2).
      No Brasil varia de 3 a 6h dependendo da regiao e epoca.
    </div>
  `;
}

let _energySolarDeviceCount = 1;

function energySolarPreset(sel) {
  const row = sel.closest('.energy-calc-group');
  const val = sel.value;
  if (!val || val === '0,0') return;
  const [w, h] = val.split(',').map(Number);
  row.querySelector('.solar-watts').value = w;
  row.querySelector('.solar-hours').value = h;
  row.querySelector('.solar-wh').value = (w * h).toFixed(0);
}

function energySolarAddDevice() {
  const container = document.getElementById('energySolarDevices');
  if (!container) return;
  _energySolarDeviceCount++;
  const div = document.createElement('div');
  div.className = 'energy-calc-group';
  div.dataset.device = _energySolarDeviceCount;
  div.innerHTML = `
    <div class="energy-calc-field">
      <label>Dispositivo</label>
      <select onchange="energySolarPreset(this)">
        <option value="">-- Selecione --</option>
        <option value="10,2">Celular (carga)</option>
        <option value="5,5">Lampada LED</option>
        <option value="3,4">Radio</option>
        <option value="45,3">Laptop</option>
        <option value="30,8">Ventilador</option>
        <option value="60,12">Mini geladeira</option>
        <option value="10,24">Router WiFi</option>
        <option value="0,0">Personalizado</option>
      </select>
    </div>
    <div class="energy-calc-field">
      <label>Watts (W)</label>
      <input type="number" class="solar-watts" placeholder="ex: 10" step="any">
    </div>
    <div class="energy-calc-field">
      <label>Horas/dia</label>
      <input type="number" class="solar-hours" placeholder="ex: 2" step="any">
    </div>
    <div class="energy-calc-field">
      <label>Wh/dia</label>
      <input type="text" class="solar-wh" readonly placeholder="auto" style="opacity:0.7">
    </div>
  `;
  container.appendChild(div);
}

function energySolarRemoveDevice() {
  const container = document.getElementById('energySolarDevices');
  if (!container || container.children.length <= 1) return;
  container.removeChild(container.lastElementChild);
}

function energySolarCalc() {
  const container = document.getElementById('energySolarDevices');
  const res = document.getElementById('energySolarResult');
  if (!container || !res) return;

  let totalWh = 0;
  let peakW = 0;
  const rows = container.querySelectorAll('.energy-calc-group');
  rows.forEach(row => {
    const w = parseFloat(row.querySelector('.solar-watts')?.value) || 0;
    const h = parseFloat(row.querySelector('.solar-hours')?.value) || 0;
    const wh = w * h;
    const whEl = row.querySelector('.solar-wh');
    if (whEl) whEl.value = wh > 0 ? wh.toFixed(0) : '';
    totalWh += wh;
    peakW += w;
  });

  if (totalWh <= 0) {
    res.innerHTML = '\u26A0\uFE0F Adicione pelo menos um dispositivo com watts e horas.';
    return;
  }

  const hsp = parseFloat(document.getElementById('energySolarHSP')?.value) || 4.5;
  const days = parseInt(document.getElementById('energySolarDays')?.value) || 2;

  const panelW = Math.ceil(totalWh / hsp / 0.7);
  const batteryWh = totalWh * days / 0.5;
  const batteryAh12 = Math.ceil(batteryWh / 12);
  const controllerA = Math.ceil(panelW / 12 * 1.25);
  const inverterSize = Math.ceil(peakW * 1.3 / 100) * 100;

  let panelRec = '';
  if (panelW <= 30) panelRec = '1x painel 30W portatil';
  else if (panelW <= 60) panelRec = '1x painel 60W';
  else if (panelW <= 100) panelRec = '1x painel 100W';
  else if (panelW <= 200) panelRec = '1x painel 200W ou 2x 100W';
  else if (panelW <= 400) panelRec = '2x paineis 200W';
  else panelRec = Math.ceil(panelW / 200) + 'x paineis 200W';

  let batRec = '';
  if (batteryAh12 <= 20) batRec = '1x bateria 12V 20Ah (LiFePO4 ideal)';
  else if (batteryAh12 <= 50) batRec = '1x bateria 12V 50Ah';
  else if (batteryAh12 <= 100) batRec = '1x bateria 12V 100Ah';
  else batRec = Math.ceil(batteryAh12 / 100) + 'x baterias 12V 100Ah em paralelo';

  res.innerHTML = `
    <div style="margin-bottom:10px;">
      <strong style="font-size:14px;">\u26A1 Resultado do Sistema Solar</strong>
    </div>
    <table class="energy-table" style="margin:0;">
      <tr><td><strong>Consumo diario total</strong></td><td><strong>${totalWh.toFixed(0)} Wh/dia</strong></td></tr>
      <tr><td>Painel solar minimo</td><td><strong>${panelW}W</strong> \u2192 ${panelRec}</td></tr>
      <tr><td>Bateria (${days} dias autonomia)</td><td><strong>${batteryAh12} Ah (12V)</strong> \u2192 ${batRec}</td></tr>
      <tr><td>Controlador de carga</td><td><strong>${controllerA}A</strong> (PWM ou MPPT)</td></tr>
      <tr><td>Inversor (se usar AC)</td><td><strong>${inverterSize}W</strong> onda senoidal</td></tr>
    </table>
    <div class="energy-info" style="margin-top:10px;">
      \u{1F4A1} Sobredimensione 20-30% para dias nublados. MPPT e ~20% mais eficiente que PWM.
    </div>
  `;
}

// ─── ENERGY: INIT / EXPOSE ──────────────────────────────────────────────────

window.energyInit = energyInit;
window.energySetSection = energySetSection;
window.energyCalcOhm = energyCalcOhm;
window.energyCalcBattery = energyCalcBattery;
window.energyToggleFire = energyToggleFire;
window.energySolarPreset = energySolarPreset;
window.energySolarAddDevice = energySolarAddDevice;
window.energySolarRemoveDevice = energySolarRemoveDevice;
window.energySolarCalc = energySolarCalc;
