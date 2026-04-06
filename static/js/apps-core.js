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



// ─── Boot Sequence ───────────────────────────────────────────────────────────
function runBootSequence() {
  const bootLog = document.getElementById('bootLog');
  const bootFill = document.getElementById('bootBarFill');
  const bootScreen = document.getElementById('bootScreen');
  const desktop = document.getElementById('desktop');

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
      }, 400);
    }
  }, 180);
}

// ─── Guides (dynamic, loaded from API) ──────────────────────────────────────
async function loadGuidesIndex() {
  try {
    const r = await fetch('/api/guides');
    const d = await r.json();
    setGuidesIndex(Array.isArray(d) ? d : (d.guides || []));
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
      html += `<div class="guide-card" onclick="openGuide('${g.id}')">
        <span class="guide-card-icon">${g.icon || '📖'}</span>
        <span class="guide-card-title">${escapeHtml(g.title)}</span>
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

    content.innerHTML = `
      <div class="guide-body">
        <h1>${escapeHtml(title)}</h1>
        <div class="guide-md-content">${markdownToHtml(guide.content || '')}</div>
      </div>`;
    content.scrollTop = 0;
  } catch(e) {
    content.innerHTML = `<div class="guide-error">Erro ao carregar guia: ${escapeHtml(e.message)}</div>`;
  }

  updateGuideFavBtn();
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

// ─── Config Drawer ──────────────────────────────────────────────────────────
function toggleConfig() {
  document.getElementById("configOverlay").classList.toggle("hidden");
  document.getElementById("configDrawer").classList.toggle("hidden");
  // Update status when opening
  if (!document.getElementById("configDrawer").classList.contains("hidden")) {
    updateConfigStatus();
    checkKokoroStatus();
    initOfflineToggle();
  }
}

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
      if (text) text.textContent = "Pronto (offline)";
      if (btn) { btn.classList.add("downloaded"); btn.innerHTML = "\u2713 Kokoro instalado"; btn.disabled = true; }
    } else if (d.installed && !d.models_downloaded) {
      if (dot) { dot.className = "kokoro-status-dot missing"; }
      if (text) text.textContent = "Pacote instalado — modelo nao baixado";
      if (btn) { btn.disabled = false; btn.classList.remove("downloaded"); }
    } else {
      if (dot) { dot.className = "kokoro-status-dot missing"; }
      if (text) text.textContent = "Nao instalado (pip install kokoro-onnx)";
      if (btn) { btn.disabled = false; btn.classList.remove("downloaded"); }
    }
  } catch {
    if (dot) { dot.className = "kokoro-status-dot error"; }
    if (text) text.textContent = "Erro ao verificar";
  }
}

async function downloadKokoroModel() {
  const btn = document.getElementById("kokoroDownloadBtn");
  const prog = document.getElementById("kokoroProgress");
  const fill = document.getElementById("kokoroFill");
  const statusEl = document.getElementById("kokoroProgressStatus");

  if (btn) { btn.disabled = true; btn.textContent = "Baixando..."; }
  if (prog) prog.classList.remove("hidden");

  try {
    const r = await fetch("/api/tts/kokoro/download", { method: "POST" });
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
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
            if (statusEl) statusEl.textContent = "Kokoro TTS pronto!";
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
            if (actionEl) {
              const btn = document.createElement('button');
              btn.className = 'btn-sm btn-accent';
              btn.textContent = 'Tentar novamente';
              btn.onclick = () => startBgDownload(modelId);
              actionEl.innerHTML = '';
              actionEl.appendChild(btn);
            }
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    if (txtEl) txtEl.textContent = `Erro: ${escapeHtml(e.message)}`;
    _toastUpdateItem(modelId, 0, `Erro: ${escapeHtml(e.message)}`, false, true);
    if (actionEl) {
      const btn = document.createElement('button');
      btn.className = 'btn-sm btn-accent';
      btn.textContent = 'Tentar novamente';
      btn.onclick = () => startBgDownload(modelId);
      actionEl.innerHTML = '';
      actionEl.appendChild(btn);
    }
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
    el.innerHTML = sorted.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
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
    osToast("Webcam: " + e.message, "error");
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
    osToast("Acesso ao microfone negado. Verifique as permissões do navegador.", "error");
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
    osToast("Reconhecimento de voz não suportado. Use Chrome ou instale faster-whisper para STT offline.", "warn");
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
  })
    .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error || `HTTP ${r.status}`)))
    .then(d => { if (d.saved) osToast(`App "${name}" salvo!`, "success"); })
    .catch(err => { console.error("[saveApp] erro:", err); osToast("Erro ao salvar app. Verifique os logs.", "error"); });
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
    grid.innerHTML = '<div class="panel-empty">Nenhum app salvo ainda.<br>Use <code>/build</code> no chat para criar um.</div>';
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

function loadCharacters() {
  try {
    const raw = storage.get("bunker_characters");
    if (raw) state.characters = JSON.parse(raw);
    const aid = storage.get("bunker_active_char");
    if (aid && state.characters[aid]) state.activeCharacterId = aid;
  } catch {}
}

function saveCharacters() {
  storage.set("bunker_characters", JSON.stringify(state.characters));
}

function openCharactersPanel() {
  openApp('characters');
}

function renderCharactersList() {
  const list = document.getElementById("charactersList");
  const chars = Object.values(state.characters);
  renderSidebarCharacters();
  if (chars.length === 0) {
    list.innerHTML = '<div class="panel-empty">Nenhum personagem criado.<br>Crie assistentes com personalidades únicas!</div>';
    return;
  }
  list.innerHTML = chars.map(c => `
    <div class="char-card ${state.activeCharacterId === c.id ? "char-active" : ""}">
      <div class="char-emoji" style="background:${c.color || "#42f5a0"}22;border-color:${c.color || "#42f5a0"}44">${c.emoji || "🤖"}</div>
      <div class="char-info">
        <div class="char-name">${escapeHtml(c.name)}</div>
        <div class="char-desc">${escapeHtml(c.desc || "")}</div>
      </div>
      <div class="char-card-actions">
        <button class="btn-sm ${state.activeCharacterId === c.id ? "btn-accent" : ""}" onclick="activateCharacter('${c.id}')">
          ${state.activeCharacterId === c.id ? "✓ Ativo" : "Usar"}
        </button>
        <button class="btn-sm" onclick="showCharacterEditor('${c.id}')">Editar</button>
        <button class="btn-sm btn-danger-xs" onclick="deleteCharacter('${c.id}')">✕</button>
      </div>
    </div>`).join("");
}

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
    osToast("Personagem desativado — voltando ao Bunker AI padrão.", "info");
  } else {
    state.activeCharacterId = id;
    storage.set("bunker_active_char", id);
    const c = state.characters[id];
    if (c?.systemPrompt) document.getElementById("systemPrompt").value = c.systemPrompt;
    if (c?.voice) document.getElementById("ttsVoice").value = c.voice;
    osToast(`Personagem ativo: ${c?.emoji || "🤖"} ${c?.name || id}`, "success");
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
    osToast("Erro TTS: " + e.message, "error");
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
    container.innerHTML = `<div class="piper-error">Erro ao carregar: ${escapeHtml(e.message)}</div>`;
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
  const btn = document.getElementById("btnPullModel");
  prog.classList.remove("hidden");
  fill.style.width = "0%";
  fill.style.background = "";
  status.textContent = "Iniciando...";
  if (btn) { btn.disabled = true; btn.textContent = "Baixando..."; }

  // Check if Ollama is reachable before starting
  if (state._lastHealth?.status !== "online") {
    status.textContent = "Ollama offline — inicie o Ollama antes de baixar modelos.";
    fill.style.background = "var(--danger)";
    if (btn) { btn.disabled = false; btn.textContent = "Baixar"; }
    osToast("Ollama não está rodando. Inicie o Ollama e tente novamente.", "warn");
    return;
  }

  try {
    const r = await fetch("/api/models/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: name }),
    });
    if (!r.ok) {
      const errText = r.status === 404
        ? `Modelo "${name}" não encontrado. Verifique o nome em ollama.com/library`
        : `Erro HTTP ${r.status}`;
      throw new Error(errText);
    }
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
    fill.style.background = "var(--accent)";
    osToast(`Modelo "${name}" baixado com sucesso!`, "success");
    if (btn) { btn.disabled = false; btn.textContent = "Baixar"; }
    checkHealth();
  } catch (e) {
    status.textContent = "Erro: " + e.message;
    fill.style.background = "var(--danger)";
    osToast("Falha ao baixar modelo: " + e.message, "error");
    if (btn) { btn.disabled = false; btn.textContent = "Tentar novamente"; }
  }
}

