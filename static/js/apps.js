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
    content.innerHTML = `<div class="guide-error">Erro ao carregar guia: ${e.message}</div>`;
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

// ─── Journal ────────────────────────────────────────────────────────────────
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
  content.innerHTML = '<div class="guide-loading">Carregando diário...</div>';
  try {
    const r = await fetch('/api/journal');
    const d = await r.json();
    _journalEntries = Array.isArray(d) ? d : (d.entries || []);
    renderJournal(_journalEntries);
  } catch(e) {
    content.innerHTML = `<div class="guide-error">Erro: ${e.message}</div>`;
  }
}

function renderJournal(entries) {
  const content = document.getElementById('journalContent');
  if (!content) return;
  _journalEntries = entries;

  let html = '';

  // ── Clock bar ──
  html += '<div class="journal-clock-bar">';
  html += '<div id="journalClock" class="journal-clock">00:00:00</div>';
  html += '</div>';

  // ── Two-column layout: calendar left, editor+timeline right ──
  html += '<div class="journal-layout">';

  // Left column: calendar + status
  html += '<div class="journal-left">';
  html += '<div id="journalCalendar" class="journal-cal"></div>';
  html += '<div id="journalStatus" class="journal-status-card"><div class="guide-loading">Carregando status...</div></div>';
  html += '</div>';

  // Right column: editor + timeline
  html += '<div class="journal-right">';
  html += '<div id="journalEditor" class="journal-editor"></div>';
  if (entries.length > 0) {
    html += '<div class="journal-timeline">';
    html += '<div class="journal-timeline-title">Entradas anteriores</div>';
    for (const e of entries.slice(0, 30)) {
      const preview = (e.content || '').slice(0, 100) + ((e.content||'').length > 100 ? '…' : '');
      const isActive = e.date === _journalCurrentDate;
      html += `<div class="journal-entry${isActive ? ' active' : ''}" onclick="loadJournalDate('${e.date}')">
        <div class="journal-entry-date">${e.date}</div>
        <div class="journal-entry-mood">${e.mood || ''}</div>
        <div class="journal-entry-preview">${escapeHtml(preview)}</div>
      </div>`;
    }
    html += '</div>';
  }
  html += '</div>'; // .journal-right

  html += '</div>'; // .journal-layout

  content.innerHTML = html;
  renderJournalEditor();
  renderJournalCalendar();
  loadJournalStatus();
}

function _journalNavDates() {
  const today = new Date().toISOString().slice(0, 10);
  const existingDates = _journalEntries.map(e => e.date);
  // Always include today even if no entry yet
  return [...new Set([...existingDates, today])].sort();
}

// ── Live clock ──
function _startClock() {
  clearInterval(_clockInterval);
  _updateClock();
  _clockInterval = setInterval(_updateClock, 1000);
}

function _updateClock() {
  const el = document.getElementById('journalClock');
  if (!el) { clearInterval(_clockInterval); return; }
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  el.textContent = `${hh}:${mm}:${ss}`;
}

// ── Mini calendar ──
function renderJournalCalendar() {
  const cal = document.getElementById('journalCalendar');
  if (!cal) return;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const year  = _calYear  ?? now.getFullYear();
  const month = _calMonth ?? now.getMonth();   // 0-indexed

  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                      'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const dayLetters = ['D','S','T','Q','Q','S','S'];

  // Days that have journal entries this month
  const entryDates = new Set(_journalEntries.map(e => e.date));

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = '<div class="journal-cal-header">';
  html += `<button class="journal-cal-nav" onclick="shiftCalMonth(-1)">◀</button>`;
  html += `<span class="journal-cal-title">${monthNames[month]} ${year}</span>`;
  html += `<button class="journal-cal-nav" onclick="shiftCalMonth(1)">▶</button>`;
  html += '</div>';

  html += '<div class="journal-cal-weekdays">';
  for (const d of dayLetters) html += `<div class="journal-cal-wd">${d}</div>`;
  html += '</div>';

  html += '<div class="journal-cal-grid">';
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) html += '<div class="journal-cal-day empty"></div>';
  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const isoDate = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const classes = ['journal-cal-day'];
    if (isoDate === today) classes.push('today');
    if (isoDate === _journalCurrentDate) classes.push('selected');
    if (entryDates.has(isoDate)) classes.push('has-entry');
    html += `<div class="${classes.join(' ')}" onclick="loadJournalDate('${isoDate}')">${d}</div>`;
  }
  html += '</div>';

  cal.innerHTML = html;
}

function shiftCalMonth(dir) {
  const now = new Date();
  _calMonth = (_calMonth ?? now.getMonth()) + dir;
  _calYear  = _calYear ?? now.getFullYear();
  if (_calMonth > 11) { _calMonth = 0;  _calYear++; }
  if (_calMonth < 0)  { _calMonth = 11; _calYear--; }
  renderJournalCalendar();
}

// ── Server status card ──
async function loadJournalStatus() {
  const el = document.getElementById('journalStatus');
  if (!el) return;
  try {
    const r = await fetch('/api/status');
    const d = await r.json();
    renderJournalStatus(d);
  } catch(e) {
    el.innerHTML = '<div class="guide-error">Status indisponível</div>';
  }
}

function _uptimeStr(sec) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec/60)}m ${sec%60}s`;
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return `${h}h ${m}m`;
}

function _statusBar(pct, cls) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const col = p > 85 ? 'danger' : p > 60 ? 'warn' : 'ok';
  return `<div class="status-bar"><div class="status-bar-fill ${col}" style="width:${p}%"></div></div>`;
}

function renderJournalStatus(d) {
  const el = document.getElementById('journalStatus');
  if (!el) return;

  const hasPsutil = d.cpu_pct != null;
  let html = '<div class="status-card-title">📡 Status do Servidor</div>';
  html += '<div class="status-grid">';

  // IP + Port
  html += `<div class="status-item"><span class="status-label">IP</span><span class="status-val">${d.ip}:${d.port}</span></div>`;
  // Uptime
  html += `<div class="status-item"><span class="status-label">Uptime</span><span class="status-val">${_uptimeStr(d.uptime_sec)}</span></div>`;
  // OS
  html += `<div class="status-item"><span class="status-label">SO</span><span class="status-val">${d.os}</span></div>`;
  // Python
  html += `<div class="status-item"><span class="status-label">Python</span><span class="status-val">${d.python}</span></div>`;

  if (hasPsutil) {
    // CPU
    html += `<div class="status-item full"><span class="status-label">CPU</span><span class="status-val">${d.cpu_pct}%</span>${_statusBar(d.cpu_pct)}</div>`;
    // RAM
    const ramUsed = d.ram_used_mb >= 1024 ? `${(d.ram_used_mb/1024).toFixed(1)} GB` : `${d.ram_used_mb} MB`;
    const ramTotal = d.ram_total_mb >= 1024 ? `${(d.ram_total_mb/1024).toFixed(1)} GB` : `${d.ram_total_mb} MB`;
    html += `<div class="status-item full"><span class="status-label">RAM</span><span class="status-val">${ramUsed} / ${ramTotal} (${d.ram_pct}%)</span>${_statusBar(d.ram_pct)}</div>`;
    // Disk
    html += `<div class="status-item full"><span class="status-label">Disco livre</span><span class="status-val">${d.disk_free_gb} GB / ${d.disk_total_gb} GB (${d.disk_pct}%)</span>${_statusBar(d.disk_pct)}</div>`;
  } else {
    html += `<div class="status-item full"><span class="status-label">Métricas</span><span class="status-val status-dim">Instale psutil para detalhes</span></div>`;
  }

  // Content summary
  if (d.content) {
    const c = d.content;
    html += `<div class="status-item full status-content">`;
    html += `<span class="status-label">Conteúdo offline</span>`;
    html += `<div class="status-content-grid">`;
    html += `<span>📋 ${c.guides} guias</span><span>🚨 ${c.protocols} protocolos</span>`;
    html += `<span>📚 ${c.books} livros</span><span>🎮 ${c.games} jogos</span>`;
    html += `<span>🗺️ ${c.maps} mapas</span><span>🌐 ${c.zim_files} ZIM</span>`;
    html += `</div></div>`;
  }

  html += '</div>'; // .status-grid
  html += `<button class="status-refresh-btn" onclick="loadJournalStatus()">⟳ Atualizar</button>`;

  el.innerHTML = html;
}

function renderJournalEditor() {
  const editorEl = document.getElementById('journalEditor');
  if (!editorEl) return;

  const today = new Date().toISOString().slice(0, 10);
  const isToday = _journalCurrentDate === today;
  const entry = _journalEntries.find(e => e.date === _journalCurrentDate);
  _journalMood = entry?.mood || null;

  const allDates = _journalNavDates();
  const idx = allDates.indexOf(_journalCurrentDate);
  const hasPrev = idx > 0;
  const hasNext = idx < allDates.length - 1;

  const moods = [['😊','Bem'],['😐','Normal'],['😟','Preocupado'],['😰','Ansioso'],['😤','Irritado']];

  let html = '';

  // Date nav row
  html += '<div class="journal-date-nav">';
  html += `<button class="journal-nav-btn" onclick="navigateJournal(-1)"${hasPrev ? '' : ' disabled'}>◀</button>`;
  html += `<div class="journal-date">${_journalCurrentDate}${isToday ? ' <span class="journal-today-badge">hoje</span>' : ''}</div>`;
  html += `<button class="journal-nav-btn" onclick="navigateJournal(1)"${hasNext ? '' : ' disabled'}>▶</button>`;
  html += '</div>';

  // Mood selector
  html += '<div class="journal-mood-bar">';
  for (const [emoji, label] of moods) {
    const active = _journalMood === emoji ? ' active' : '';
    html += `<span class="journal-mood${active}" onclick="setJournalMood('${emoji}')" title="${label}">${emoji}</span>`;
  }
  html += '</div>';

  // Textarea
  html += `<textarea id="journalText" class="journal-textarea" placeholder="Como foi seu dia no bunker...">${escapeHtml(entry?.content || '')}</textarea>`;

  // Audio recording + voice-to-text
  html += '<div class="journal-audio-row">';
  html += '<button class="btn-sm journal-audio-btn" id="journalRecordBtn" onclick="toggleJournalAudio()" title="Gravar audio">🎤 Gravar</button>';
  html += '<button class="btn-sm" id="journalDictateBtn" onclick="toggleJournalDictate()" title="Falar para texto — transcreve sua voz direto no diario">🗣️ Ditar</button>';
  html += '<span class="journal-audio-status" id="journalAudioStatus"></span>';
  html += '</div>';
  // Audio entries
  const audioEntries = (entry?.audio || []);
  if (audioEntries.length > 0) {
    html += '<div class="journal-audio-list">';
    for (let i = 0; i < audioEntries.length; i++) {
      const hasTranscript = audioEntries[i].transcript;
      html += `<div class="journal-audio-item">
        <audio controls src="${audioEntries[i].url}" style="height:32px;flex:1"></audio>
        <span style="font-size:10px;color:var(--text-muted)">${audioEntries[i].time || ''}</span>
        <button class="btn-sm" onclick="transcribeJournalAudio(${i})" title="Transcrever audio para texto" id="journalTranscribeBtn${i}">${hasTranscript ? '✓' : '📝'}</button>
        <button class="btn-sm" onclick="removeJournalAudio(${i})" title="Remover">✕</button>
      </div>`;
      if (hasTranscript) {
        html += `<div class="journal-audio-transcript">${escapeHtml(audioEntries[i].transcript)}</div>`;
      }
    }
    html += '</div>';
  }

  // Save row
  html += '<div class="journal-save-row">';
  html += '<span class="journal-saved" id="journalSaved">✓ Salvo</span>';
  html += '<button class="btn-sm btn-accent" onclick="saveJournal()">Salvar entrada</button>';
  html += '</div>';

  editorEl.innerHTML = html;
}

function navigateJournal(dir) {
  const allDates = _journalNavDates();
  const idx = allDates.indexOf(_journalCurrentDate);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= allDates.length) return;
  _journalCurrentDate = allDates[newIdx];
  const d = new Date(_journalCurrentDate + 'T00:00:00');
  _calYear  = d.getFullYear();
  _calMonth = d.getMonth();
  renderJournalEditor();
  renderJournalCalendar();
  // Sync active highlight in timeline
  document.querySelectorAll('.journal-entry').forEach(el => {
    const ed = el.querySelector('.journal-entry-date')?.textContent?.trim();
    el.classList.toggle('active', ed === _journalCurrentDate);
  });
}

function loadJournalDate(date) {
  _journalCurrentDate = date;
  // Sync calendar month to show the selected date
  const d = new Date(date + 'T00:00:00');
  _calYear  = d.getFullYear();
  _calMonth = d.getMonth();
  renderJournalEditor();
  renderJournalCalendar();
  // Sync active highlight in timeline
  document.querySelectorAll('.journal-entry').forEach(el => {
    const ed = el.querySelector('.journal-entry-date')?.textContent?.trim();
    el.classList.toggle('active', ed === date);
  });
  document.getElementById('journalEditor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setJournalMood(emoji) {
  _journalMood = emoji;
  document.querySelectorAll('.journal-mood').forEach(b =>
    b.classList.toggle('active', b.textContent === emoji)
  );
}

async function saveJournal() {
  const text = document.getElementById('journalText')?.value || '';
  try {
    await fetch('/api/journal', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ date: _journalCurrentDate, content: text, mood: _journalMood })
    });
    // Update local cache so re-renders are accurate without a full reload
    const idx = _journalEntries.findIndex(e => e.date === _journalCurrentDate);
    if (idx >= 0) {
      _journalEntries[idx] = { ..._journalEntries[idx], content: text, mood: _journalMood };
    } else {
      _journalEntries.push({ date: _journalCurrentDate, content: text, mood: _journalMood });
      _journalEntries.sort((a, b) => b.date.localeCompare(a.date));
    }
    // Refresh timeline item preview
    document.querySelectorAll('.journal-entry').forEach(el => {
      const d = el.querySelector('.journal-entry-date')?.textContent?.trim();
      if (d === _journalCurrentDate) {
        const prev = el.querySelector('.journal-entry-preview');
        if (prev) prev.textContent = text.slice(0, 100) + (text.length > 100 ? '…' : '');
        const moodEl = el.querySelector('.journal-entry-mood');
        if (moodEl) moodEl.textContent = _journalMood || '';
      }
    });
    const indicator = document.getElementById('journalSaved');
    if (indicator) {
      indicator.classList.add('show');
      setTimeout(() => indicator.classList.remove('show'), 2000);
    }
  } catch(e) { alert('Erro: ' + e.message); }
}

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

function calcInit() {
  calcRender();
}

function calcRender() {
  const display = document.getElementById('calcDisplay');
  if (display) display.textContent = _calcDisplay;
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
  _calcPrev = parseFloat(_calcDisplay);
  _calcOp = op;
  _calcReset = true;
}

function calcEquals() {
  if (_calcPrev === null || !_calcOp) return;
  const curr = parseFloat(_calcDisplay);
  let result;
  switch (_calcOp) {
    case '+': result = _calcPrev + curr; break;
    case '-': result = _calcPrev - curr; break;
    case '*': result = _calcPrev * curr; break;
    case '/': result = curr === 0 ? 'Erro' : _calcPrev / curr; break;
    default: return;
  }
  _calcDisplay = typeof result === 'number' ? String(parseFloat(result.toFixed(10))) : result;
  _calcPrev = null;
  _calcOp = null;
  _calcReset = true;
  calcRender();
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
  // Only if calculator window is active
  const win = _activeWindowId ? _windows[_activeWindowId] : null;
  if (!win || win.appId !== 'calc') return;
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
// UNIT CONVERTER APP
// ═══════════════════════════════════════════════════════════════════════════

const CONV_CATEGORIES = {
  'Temperatura': {
    units: ['°C', '°F', 'K'],
    convert: (val, from, to) => {
      // Convert to Celsius first
      let c;
      if (from === '°C') c = val;
      else if (from === '°F') c = (val - 32) * 5/9;
      else c = val - 273.15; // K
      // Convert from Celsius
      if (to === '°C') return c;
      if (to === '°F') return c * 9/5 + 32;
      return c + 273.15; // K
    }
  },
  'Distancia': {
    units: ['m', 'km', 'cm', 'mm', 'mi', 'yd', 'ft', 'in'],
    // All relative to meters
    factors: { m:1, km:1000, cm:0.01, mm:0.001, mi:1609.344, yd:0.9144, ft:0.3048, in:0.0254 }
  },
  'Peso': {
    units: ['kg', 'g', 'mg', 'lb', 'oz', 'ton'],
    factors: { kg:1, g:0.001, mg:0.000001, lb:0.453592, oz:0.0283495, ton:1000 }
  },
  'Volume': {
    units: ['L', 'mL', 'gal', 'qt', 'cup', 'm³'],
    factors: { L:1, mL:0.001, gal:3.78541, qt:0.946353, cup:0.236588, 'm³':1000 }
  },
  'Velocidade': {
    units: ['km/h', 'm/s', 'mph', 'knots'],
    factors: { 'km/h':1, 'm/s':3.6, 'mph':1.60934, 'knots':1.852 }
  }
};

let _convCategory = 'Temperatura';

function converterInit() {
  const catSel = document.getElementById('convCategory');
  if (catSel && catSel.options.length === 0) {
    Object.keys(CONV_CATEGORIES).forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat; opt.textContent = cat;
      catSel.appendChild(opt);
    });
  }
  converterUpdateUnits();
}

function converterUpdateUnits() {
  const cat = document.getElementById('convCategory')?.value || _convCategory;
  _convCategory = cat;
  const cfg = CONV_CATEGORIES[cat];
  if (!cfg) return;
  const fromSel = document.getElementById('convFrom');
  const toSel = document.getElementById('convTo');
  if (!fromSel || !toSel) return;
  fromSel.innerHTML = '';
  toSel.innerHTML = '';
  cfg.units.forEach((u, i) => {
    fromSel.innerHTML += `<option value="${u}">${u}</option>`;
    toSel.innerHTML += `<option value="${u}" ${i===1?'selected':''}>${u}</option>`;
  });
  converterCalc();
}

function converterCalc() {
  const cat = _convCategory;
  const cfg = CONV_CATEGORIES[cat];
  if (!cfg) return;
  const val = parseFloat(document.getElementById('convInput')?.value || '0');
  const from = document.getElementById('convFrom')?.value;
  const to = document.getElementById('convTo')?.value;
  let result;
  if (cfg.convert) {
    result = cfg.convert(val, from, to);
  } else {
    // Factor-based conversion
    const baseVal = val * cfg.factors[from];
    result = baseVal / cfg.factors[to];
  }
  const resultEl = document.getElementById('convResult');
  if (resultEl) resultEl.textContent = isNaN(result) ? '—' : parseFloat(result.toFixed(8));
}

function converterSwap() {
  const fromSel = document.getElementById('convFrom');
  const toSel = document.getElementById('convTo');
  if (!fromSel || !toSel) return;
  const tmp = fromSel.value;
  fromSel.value = toSel.value;
  toSel.value = tmp;
  converterCalc();
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
  { code: 'MAYDAY', morse: '−− ·− −·−− −·· ·− −·−−', desc: 'Socorro por voz/radio' },
  { code: 'OK', morse: '−−− −·−', desc: 'Confirmacao / tudo bem' },
  { code: 'WATER', morse: '·−− ·− − · ·−·', desc: 'Preciso de agua' },
  { code: 'HELP', morse: '···· · ·−·· ·−−·', desc: 'Preciso de ajuda' },
];

let _morseAudioCtx = null;

function morseInit() {
  morseTranslate();
  // Render reference table
  const refEl = document.getElementById('morseRef');
  if (refEl) {
    let html = '<div class="morse-signals"><h4>Sinais Importantes</h4>';
    MORSE_SIGNALS.forEach(s => {
      html += `<div class="morse-signal"><strong>${s.code}</strong> <span class="morse-code-display">${s.morse}</span> <span class="morse-desc">${s.desc}</span></div>`;
    });
    html += '</div><h4 style="margin-top:12px">Referencia Completa</h4><div class="morse-ref-grid">';
    Object.entries(MORSE_MAP).forEach(([ch, code]) => {
      if (ch === ' ') return;
      html += `<div class="morse-ref-item"><span class="morse-ref-char">${ch}</span><span class="morse-ref-code">${code}</span></div>`;
    });
    html += '</div>';
    refEl.innerHTML = html;
  }
}

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
  // Split by ' / ' for spaces between words, ' ' for spaces between letters
  const words = input.split(' / ').map(word =>
    word.trim().split(/\s+/).map(code => MORSE_REV[code] || '?').join('')
  );
  output.textContent = words.join(' ') || '...';
}

let _morseOscillators = [];
let _morsePlaying = false;

function morsePlayAudio() {
  if (_morsePlaying) { morseStopAudio(); return; }
  const morse = document.getElementById('morseOutput')?.textContent || '';
  if (!morse || morse === '...') return;
  if (!_morseAudioCtx) _morseAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const ctx = _morseAudioCtx;
  const DOT = 0.08, DASH = 0.24, GAP = 0.08, LETTER_GAP = 0.24, WORD_GAP = 0.56;
  let time = ctx.currentTime + 0.1;
  _morseOscillators = [];
  _morsePlaying = true;

  // Update button state
  const btn = document.getElementById('morsePlayBtn');
  if (btn) { btn.textContent = '⏹ Parar'; btn.classList.add('playing'); }

  for (const ch of morse) {
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

  // Auto-reset when done
  const duration = (time - ctx.currentTime) * 1000;
  setTimeout(() => { if (_morsePlaying) morseStopAudio(); }, duration + 100);
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
  // SOS pattern: ··· −−− ···
  const DOT = 200, DASH = 600, GAP = 200, LETTER_GAP = 600, WORD_GAP = 1400;
  const pattern = [
    DOT, GAP, DOT, GAP, DOT, LETTER_GAP,  // S
    DASH, GAP, DASH, GAP, DASH, LETTER_GAP, // O
    DOT, GAP, DOT, GAP, DOT, WORD_GAP       // S
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
  let isOn = true; // odd indexes are gaps
  function tick() {
    if (!_morseFlashing || idx >= pattern.length) {
      if (_morseFlashing) { idx = 0; tick(); return; } // Loop
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

function phoneticInit() {
  phoneticTranslate();
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
// WATER PURIFICATION CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════

function waterCalcCompute() {
  const liters = parseFloat(document.getElementById('waterLiters')?.value || '1');
  const clarity = document.getElementById('waterClarity')?.value || 'clear';
  const method = document.getElementById('waterMethod')?.value || 'bleach';
  const el = document.getElementById('waterResult');
  if (!el) return;

  // Multiplier for turbid water (double dose)
  const turbidMult = clarity === 'turbid' ? 2 : 1;
  let html = '';

  switch (method) {
    case 'bleach': {
      // Household bleach (5-6% sodium hypochlorite)
      // Standard: 2 drops per liter for clear, 4 drops for turbid
      const drops = Math.ceil(2 * liters * turbidMult);
      const ml = (drops * 0.05).toFixed(2); // ~0.05mL per drop
      html = `
        <div class="water-result-card">
          <h4>🧴 Agua Sanitaria (5-6% cloro)</h4>
          <div class="water-dose">${drops} gotas</div>
          <div class="water-sub">(≈ ${ml} mL)</div>
          <div class="water-info">
            <p>⏱️ Espere <strong>30 minutos</strong> antes de beber</p>
            <p>👃 Deve ter leve cheiro de cloro</p>
            <p>⚠️ Se nao sentir cheiro, repita a dose e espere +15 min</p>
          </div>
        </div>`;
      break;
    }
    case 'iodine': {
      // Tincture of iodine 2%: 5 drops per liter clear, 10 for turbid
      const drops = Math.ceil(5 * liters * turbidMult);
      html = `
        <div class="water-result-card">
          <h4>💊 Tintura de Iodo (2%)</h4>
          <div class="water-dose">${drops} gotas</div>
          <div class="water-info">
            <p>⏱️ Espere <strong>30 minutos</strong> (1h se agua fria)</p>
            <p>⚠️ Nao usar em gravidas ou alergicos a iodo</p>
            <p>💡 Vitamina C (tang) remove gosto apos purificar</p>
          </div>
        </div>`;
      break;
    }
    case 'boil': {
      html = `
        <div class="water-result-card">
          <h4>🔥 Fervura</h4>
          <div class="water-dose">Fervura rolante por 1 minuto</div>
          <div class="water-sub">(3 min se altitude > 2000m)</div>
          <div class="water-info">
            <p>✅ Metodo mais seguro e confiavel</p>
            <p>🫗 Deixe esfriar naturalmente</p>
            <p>💡 Agite para reoxigenar e melhorar sabor</p>
            <p>🪵 Combustivel: ~1kg de lenha para ${liters}L</p>
          </div>
        </div>`;
      break;
    }
    case 'sodis': {
      const bottles = Math.ceil(liters / 1.5);
      html = `
        <div class="water-result-card">
          <h4>☀️ SODIS (Desinfeccao Solar)</h4>
          <div class="water-dose">${bottles} garrafa${bottles > 1 ? 's' : ''} PET transparente${bottles > 1 ? 's' : ''}</div>
          <div class="water-info">
            <p>⏱️ <strong>6 horas</strong> em sol direto (ou 2 dias com nuvens)</p>
            <p>📦 Use garrafas PET de ate 2L, transparentes</p>
            <p>🔄 Agite antes para oxigenar</p>
            <p>⚠️ Nao funciona com agua muito turva — filtre antes</p>
            <p>🌡️ Coloque sobre superficie escura (metal) para aquecer</p>
          </div>
        </div>`;
      break;
    }
  }

  // Add general tips
  html += `
    <div class="water-tips">
      <h4>💡 Dicas Gerais</h4>
      <ul>
        <li>Sempre filtre antes de purificar (tecido, areia, carvao)</li>
        <li>Agua turva: deixe decantar antes de tratar</li>
        <li>Necessidade diaria: 2-3 litros por pessoa</li>
        <li>Sintomas de agua contaminada: diarreia, vomito, febre</li>
      </ul>
    </div>`;
  el.innerHTML = html;
}


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

// ═══ Radio Frequency Filter ═══════════════════════════════════════════════
function radioFilter(query) {
  const container = document.getElementById('radioView');
  if (!container) return;
  const q = query.toLowerCase().trim();
  const sections = container.querySelectorAll('.radio-section');
  sections.forEach(h3 => {
    // Find the next sibling (table or ul)
    let sibling = h3.nextElementSibling;
    if (!sibling) return;
    let sectionVisible = false;
    if (sibling.tagName === 'TABLE') {
      const rows = sibling.querySelectorAll('tr');
      rows.forEach((row, i) => {
        if (i === 0) return; // skip header
        const text = row.textContent.toLowerCase();
        const match = !q || text.includes(q);
        row.style.display = match ? '' : 'none';
        if (match) sectionVisible = true;
      });
    } else if (sibling.tagName === 'UL') {
      const items = sibling.querySelectorAll('li');
      items.forEach(li => {
        const match = !q || li.textContent.toLowerCase().includes(q);
        li.style.display = match ? '' : 'none';
        if (match) sectionVisible = true;
      });
    }
    if (!q) sectionVisible = true;
    h3.style.display = sectionVisible ? '' : 'none';
    if (sibling) sibling.style.display = sectionVisible ? '' : 'none';
  });
}
window.radioFilter = radioFilter;

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
  weatherLoadHistory();
  weatherCalcWindChill();
  weatherCalcHeatIndex();
  weatherBuildChillTable();
}

function weatherSwitchTab(tab) {
  document.querySelectorAll('.weather-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.weather-panel').forEach(p => p.classList.add('hidden'));
  const tabBtn = document.getElementById('wtab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  const panel = document.getElementById('wpanel' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (tabBtn) tabBtn.classList.add('active');
  if (panel) panel.classList.remove('hidden');
  if (tab === 'barometer') weatherDrawChart();
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
const ONBOARDING_TOTAL_STEPS = 4;

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
    // Run resource checks when entering step 2
    if (_onboardingStep === 2) {
      onboardingRunChecks();
    }
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

// Expose to window for onclick handlers
window.onboardingShouldShow = onboardingShouldShow;
window.onboardingShow = onboardingShow;
window.onboardingSkip = onboardingSkip;
window.onboardingFinish = onboardingFinish;
window.onboardingNext = onboardingNext;
window.onboardingPrev = onboardingPrev;
window.onboardingSelectLang = onboardingSelectLang;
