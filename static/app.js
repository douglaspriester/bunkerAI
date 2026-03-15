/* ═══ Bunker AI v3 — Guides, Favorites, Config Drawer, History ═══ */
/* "The Answer to the Ultimate Question of Life, the Universe, and Everything is 42" */

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  models: [],
  visionModels: [],
  chats: {},          // { id: { title, messages: [] } }
  activeChatId: null,
  isStreaming: false,
  webcamActive: false,
  webcamStream: null,
  recognition: null,
  isListening: false,
  attachedImage: null,
  generatedHtml: "",
  currentAudio: null,
  favorites: [],      // [{ id, text, from, chatId, ts }]
  activeGuide: null,
  sttEngine: "browser",  // "whisper" (offline) or "browser" (Chrome Web Speech API)
  ttsOffline: false,       // true if any offline TTS is available
  ttsEngine: "edge-tts",  // "piper" | "pyttsx3" | "edge-tts"
  piperModels: {},         // { model_id: { desc, size_mb, downloaded } }
  sysVoices: [],           // [{ id, name }] from pyttsx3
  _setupChecked: false,    // prevent showing setup modal more than once
  _bgDownloads: {},        // { model_id: { pct, done, error } }
  promptQueue: [],        // [string] — queued prompts
  abortController: null,  // AbortController for active stream
  characters: {},         // { id: { name, emoji, color, desc, systemPrompt, voice } }
  activeCharacterId: null,
  activeProtocol: null,
  currentProtocol: null,
};

// ─── Guide/Protocol/Game Data (loaded from API) ─────────────────────────────
const guidesCache = {};  // { id: { title, content(md) } }
let guidesIndex = [];    // [{ id, title, icon, emoji }]
let protocolsIndex = []; // [{ id, title, urgency, emoji }]
let gamesIndex = [];     // [{ id, title, emoji }]
let searchIndex = null;  // MiniSearch instance

// Sci-fi loading phrases
const LOADING_PHRASES = [
  "Calculando a resposta para a vida, o universo e tudo mais...",
  "Consultando o Deep Thought...",
  "Checando o Guia do Mochileiro...",
  "TARS ajustando nivel de humor para 75%...",
  "Mother processando sua requisicao...",
  "Nao entre em panico...",
  "Computando probabilidade de improbabilidade...",
  "Verificando onde esta sua toalha...",
  "HAL 9000 confirma: posso fazer isso, Dave...",
  "Skynet offline. Voce esta seguro. Por enquanto.",
];

// ─── Markdown renderer ──────────────────────────────────────────────────────
function markdownToHtml(md) {
  // 1. Extract fenced code blocks before any other processing
  const codeBlocks = [];
  let s = md.replace(/```([\w]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const escaped = code.trimEnd()
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const cls = lang ? ` class="lang-${lang}"` : "";
    codeBlocks.push(
      `<pre class="md-pre"><code${cls}>${escaped}</code>` +
      `<button class="copy-code-btn" onclick="copyCode(this)" title="Copiar codigo">⎘</button></pre>`
    );
    return `\x00BLOCK${idx}\x00`;
  });

  // 2. Extract inline code
  const inlines = [];
  s = s.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlines.length;
    const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    inlines.push(`<code class="md-code">${escaped}</code>`);
    return `\x00INLINE${idx}\x00`;
  });

  // 3. Escape remaining HTML
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 4. Block-level elements (headers, hr, blockquotes)
  s = s.replace(/^#{6} (.+)$/gm, "<h6>$1</h6>");
  s = s.replace(/^#{5} (.+)$/gm, "<h5>$1</h5>");
  s = s.replace(/^#{4} (.+)$/gm, "<h4>$1</h4>");
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  s = s.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  s = s.replace(/^(?:---|\*\*\*|___)\s*$/gm, "<hr>");
  s = s.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>"); // > escaped to &gt;

  // 5. Lists — line-by-line state machine
  const lines = s.split("\n");
  const out = [];
  const stack = []; // "ul" | "ol"
  for (const line of lines) {
    const ul = line.match(/^\s*[-*+] (.+)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ul || ol) {
      const type = ul ? "ul" : "ol";
      const content = ul ? ul[1] : ol[1];
      if (!stack.length || stack[stack.length - 1] !== type) {
        if (stack.length && stack[stack.length - 1] !== type) out.push(`</${stack.pop()}>`);
        out.push(`<${type}>`); stack.push(type);
      }
      out.push(`<li>${content}</li>`);
    } else {
      while (stack.length) out.push(`</${stack.pop()}>`);
      out.push(line);
    }
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  s = out.join("\n");

  // 6. Inline formatting
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
  s = s.replace(/\*([^\s*](?:[^*\n]*[^\s*])?)\*/g, "<em>$1</em>");
  s = s.replace(/\*([^\s*])\*/g, "<em>$1</em>");
  s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // 7. Paragraphs — split on double newlines, wrap non-block content
  const BLOCK_RE = /^<(?:h[1-6]|ul|ol|pre|blockquote|hr|div)[^>]*>/;
  const paragraphs = s.split(/\n{2,}/);
  s = paragraphs.map(p => {
    p = p.trim();
    if (!p) return "";
    if (BLOCK_RE.test(p) || p.includes("\x00BLOCK")) return p;
    return `<p>${p.replace(/\n/g, "<br>")}</p>`;
  }).filter(Boolean).join("");

  // 8. Restore placeholders
  s = s.replace(/\x00INLINE(\d+)\x00/g, (_, i) => inlines[+i]);
  s = s.replace(/\x00BLOCK(\d+)\x00/g, (_, i) => codeBlocks[+i]);
  return s;
}

function copyCode(btn) {
  const code = btn.previousElementSibling.textContent;
  navigator.clipboard.writeText(code).then(() => {
    const orig = btn.textContent;
    btn.textContent = "✓ Copiado";
    setTimeout(() => { btn.textContent = orig; }, 1800);
  }).catch(() => {});
}


// ═══════════════════════════════════════════════════════════════════════════
// BUNKER OS — DESKTOP WINDOW MANAGER
// ═══════════════════════════════════════════════════════════════════════════

const OS_APPS = [
  { id: 'chat',       name: 'AI Chat',        icon: '\u{1F916}', width: 850, height: 620, viewId: 'chatView' },
  { id: 'guides',     name: 'Guias',          icon: '\u{1F4CB}', width: 700, height: 500, viewId: 'guideView' },
  { id: 'protocols',  name: 'Protocolos',     icon: '\u{1F6A8}', width: 600, height: 500, viewId: 'protocolView' },
  { id: 'supplies',   name: 'Suprimentos',    icon: '\u{1F4E6}', width: 780, height: 520, viewId: 'suppliesView' },
  { id: 'journal',    name: 'Di\u00E1rio',    icon: '\u{1F4D3}', width: 800, height: 560, viewId: 'journalView' },
  { id: 'books',      name: 'Biblioteca',     icon: '\u{1F4DA}', width: 700, height: 500, viewId: 'booksView' },
  { id: 'bookReader', name: 'Leitor',         icon: '\u{1F4D6}', width: 750, height: 550, viewId: 'bookReaderView', hidden: true },
  { id: 'games',      name: 'Jogos',          icon: '\u{1F3AE}', width: 620, height: 520, viewId: 'gamesView' },
  { id: 'gamePlay',   name: 'Jogo',           icon: '\u{1F3AE}', width: 700, height: 550, viewId: 'gamePlayView', hidden: true },
  { id: 'map',        name: 'Mapas',          icon: '\u{1F5FA}\uFE0F', width: 850, height: 620, viewId: 'mapView' },
  { id: 'wiki',       name: 'Wikipedia',      icon: '\u{1F310}', width: 820, height: 620, viewId: 'wikiView' },
  { id: 'builder',    name: 'App Builder',    icon: '\u{1F528}', width: 780, height: 520, viewId: 'appsView' },
  { id: 'characters', name: 'Personagens',    icon: '\u{1F3AD}', width: 620, height: 500, viewId: 'charactersView' },
  { id: 'tts',        name: 'Texto p/ Voz',   icon: '\u{1F50A}', width: 540, height: 480, viewId: 'ttsView' },
  { id: 'notepad',    name: 'Bloco de Notas', icon: '\u{1F4DD}', width: 700, height: 480, viewId: 'notepadView' },
  { id: 'word',       name: 'Documento',     icon: '\u{1F4C4}', width: 750, height: 520, viewId: 'wordView' },
  { id: 'excel',      name: 'Planilha',      icon: '\u{1F4CA}', width: 850, height: 550, viewId: 'excelView' },
  { id: 'sysmon',     name: 'Monitor',       icon: '\u{1F4BB}', width: 400, height: 380, viewId: 'sysmonView' },
  { id: 'calc',       name: 'Calculadora',   icon: '\u{1F5A9}', width: 320, height: 440, viewId: 'calcView' },
  { id: 'timer',      name: 'Timer',         icon: '\u23F1\uFE0F', width: 360, height: 400, viewId: 'timerView' },
  { id: 'converter',  name: 'Conversor',     icon: '\u{1F522}', width: 380, height: 460, viewId: 'converterView' },
  { id: 'checklist',  name: 'Checklists',   icon: '\u2705', width: 500, height: 480, viewId: 'checklistView' },
  { id: 'compass',    name: 'Bussola',      icon: '\u{1F9ED}', width: 380, height: 440, viewId: 'compassView' },
  { id: 'morse',      name: 'Codigo Morse', icon: '\u{1F4E1}', width: 520, height: 500, viewId: 'morseView' },
  { id: 'radio',      name: 'Frequencias',  icon: '\u{1F4FB}', width: 480, height: 500, viewId: 'radioView' },
  { id: 'phonetic',   name: 'Fonetico NATO', icon: '\u{1F399}\uFE0F', width: 420, height: 480, viewId: 'phoneticView' },
  { id: 'sun',        name: 'Sol / Lua',     icon: '\u2600\uFE0F', width: 400, height: 460, viewId: 'sunView' },
  { id: 'settings',   name: 'Configura\u00E7\u00F5es', icon: '\u2699\uFE0F', width: 560, height: 520, viewId: null },
];

let _windows = {};      // { winId: { appId, element, minimized, maximized, zIndex, x, y, w, h, prevRect } }
let _topZ = 100;
let _activeWindowId = null;
let _cascadeOffset = 0;
let _taskbarClockInterval = null;

// ─── Window Manager: Open App ────────────────────────────────────────────
function openApp(appId) {
  // Settings → open config drawer
  if (appId === 'settings') {
    toggleConfig();
    closeStartMenu();
    return;
  }

  const app = OS_APPS.find(a => a.id === appId);
  if (!app) return;

  // If already open, focus it
  const existing = Object.values(_windows).find(w => w.appId === appId);
  if (existing) {
    if (existing.minimized) unminimizeWindow(existing.winId);
    focusWindow(existing.winId);
    closeStartMenu();
    return;
  }

  const winId = 'win_' + appId + '_' + Date.now().toString(36);

  // Calculate cascaded position
  const maxW = window.innerWidth;
  const maxH = window.innerHeight - 48; // taskbar height
  const w = Math.min(app.width, maxW - 40);
  const h = Math.min(app.height, maxH - 40);
  const baseX = Math.max(20, (maxW - w) / 2 - 80);
  const baseY = Math.max(10, (maxH - h) / 2 - 80);
  const x = baseX + (_cascadeOffset % 8) * 30;
  const y = baseY + (_cascadeOffset % 8) * 30;
  _cascadeOffset++;

  // Create window element
  const winEl = document.createElement('div');
  winEl.className = 'os-window';
  winEl.id = winId;
  winEl.style.left = x + 'px';
  winEl.style.top = y + 'px';
  winEl.style.width = w + 'px';
  winEl.style.height = h + 'px';
  winEl.style.zIndex = ++_topZ;

  winEl.innerHTML = `
    <div class="os-window-titlebar" onmousedown="startDrag('${winId}', event)" ondblclick="maximizeWindow('${winId}')">
      <span class="os-window-icon">${app.icon}</span>
      <span class="os-window-title">${app.name}</span>
      <div class="os-window-controls">
        <button class="os-win-btn os-win-min" onclick="minimizeWindow('${winId}')" title="Minimizar">&minus;</button>
        <button class="os-win-btn os-win-max" onclick="maximizeWindow('${winId}')" title="Maximizar">&#9744;</button>
        <button class="os-win-btn os-win-close" onclick="closeWindow('${winId}')" title="Fechar">&times;</button>
      </div>
    </div>
    <div class="os-window-body" id="${winId}_body"></div>
    <div class="os-window-resize" onmousedown="startResize('${winId}', event)"></div>
  `;

  // Focus window on any click inside it
  winEl.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.os-win-btn')) focusWindow(winId);
  });

  document.getElementById('windowsContainer').appendChild(winEl);

  // Move the view content into the window body
  const body = document.getElementById(winId + '_body');
  if (app.viewId) {
    const viewEl = document.getElementById(app.viewId);
    if (viewEl) {
      viewEl.classList.remove('hidden');
      body.appendChild(viewEl);
    }
  }

  // Register window state
  _windows[winId] = {
    winId, appId, element: winEl, minimized: false, maximized: false,
    zIndex: _topZ, x, y, w, h, prevRect: null
  };
  _activeWindowId = winId;

  // Trigger any app-specific init
  _triggerAppOpen(appId);

  // Update taskbar
  renderTaskbar();
  focusWindow(winId);
  closeStartMenu();

  // Animate in
  winEl.classList.add('os-window-opening');
  setTimeout(() => winEl.classList.remove('os-window-opening'), 300);
}

function _triggerAppOpen(appId) {
  // Run the original panel openers' side-effects (data loading etc.)
  switch (appId) {
    case 'supplies': loadSupplies(); break;
    case 'books': loadBooks(); break;
    case 'games': renderGamesGrid(); break;
    case 'wiki': _wikiInit(); break;
    case 'journal': _journalInit(); break;
    case 'tts': _ttsInit(); break;
    case 'builder': _builderInit(); break;
    case 'characters': renderCharactersList(); break;
    case 'map': _mapInit(); break;
    case 'chat': restoreChat(); break;
    case 'notepad': notepadInit(); break;
    case 'word': wordInit(); break;
    case 'excel': excelInit(); break;
    case 'sysmon': sysmonInit(); break;
    case 'calc': calcInit(); break;
    case 'timer': timerInit(); break;
    case 'converter': converterInit(); break;
    case 'checklist': checklistInit(); break;
    case 'compass': compassInit(); break;
    case 'morse': morseInit(); break;
    case 'phonetic': phoneticInit(); break;
    case 'sun': sunCalcInit(); break;
  }
}

function _wikiInit() {
  // Same logic as openWikiPanel but without showView
  const frame = document.getElementById('wikiFrame');
  const statusEl = document.getElementById('wikiStatus');
  const offlineMsg = document.getElementById('wikiOfflineMsg');
  const dot = statusEl?.querySelector('.sys-dot');
  const statusTxt = statusEl?.querySelector('span:last-child');
  if (statusTxt) statusTxt.textContent = 'Verificando...';
  fetch('/api/kiwix/status').then(r => r.json()).then(d => {
    if (d.running) {
      if (frame) frame.src = 'http://localhost:8889';
      if (offlineMsg) offlineMsg.classList.add('hidden');
      if (dot) { dot.classList.remove('sys-warn'); dot.classList.add('sys-ok'); }
      if (statusTxt) statusTxt.textContent = 'Online';
    } else {
      if (frame) frame.src = 'about:blank';
      if (offlineMsg) offlineMsg.classList.remove('hidden');
      if (dot) { dot.classList.remove('sys-ok'); dot.classList.add('sys-warn'); }
      if (statusTxt) statusTxt.textContent = 'Indispon\u00EDvel';
    }
  }).catch(() => {
    if (offlineMsg) offlineMsg.classList.remove('hidden');
    if (dot) { dot.classList.remove('sys-ok'); dot.classList.add('sys-warn'); }
    if (statusTxt) statusTxt.textContent = 'Erro';
  });
}

function _journalInit() {
  _journalCurrentDate = new Date().toISOString().slice(0, 10);
  const now = new Date();
  _calYear = now.getFullYear();
  _calMonth = now.getMonth();
  loadJournal();
  _startClock();
}

function _ttsInit() {
  const voice = document.getElementById('ttsVoice')?.value;
  if (voice) { const el = document.getElementById('ttsPanelVoice'); if (el) el.value = voice; }
  const sel = document.getElementById('ttsPanelEngine');
  if (sel && sel.value === 'auto' && state.ttsEngine !== 'edge-tts') {
    sel.value = state.ttsEngine;
  }
  onTTSEngineChange();
  loadPiperModels();
}

function _builderInit() {
  const grid = document.getElementById('appsGrid');
  if (grid) grid.innerHTML = '<div class="panel-empty">Carregando...</div>';
  fetch('/api/build/list').then(r => r.json()).then(data => {
    renderAppsGrid(data.apps || []);
    renderSidebarApps(data.apps || []);
  }).catch(() => {
    if (grid) grid.innerHTML = '<div class="panel-empty">Erro ao carregar apps.</div>';
  });
}

function _mapInit() {
  if (!mapState.initialized) {
    initMap();
  } else {
    setTimeout(() => mapState.leafletMap?.invalidateSize(), 100);
  }
}

// ─── Window Manager: Close ────────────────────────────────────────────────
function closeWindow(winId) {
  const win = _windows[winId];
  if (!win) return;

  const app = OS_APPS.find(a => a.id === win.appId);

  // Move view content back into #mainArea before removing window
  if (app?.viewId) {
    const viewEl = document.getElementById(app.viewId);
    if (viewEl) {
      viewEl.classList.add('hidden');
      document.getElementById('mainArea').appendChild(viewEl);
    }
  }

  // Auto-save dirty editors before closing
  if (win.appId === 'notepad' && _notepadDirty && _notepadActiveId) { notepadSave(); osToast('📝 Nota salva automaticamente'); }
  if (win.appId === 'word' && _wordDirty && _wordActiveId) { wordSave(); osToast('📄 Documento salvo automaticamente'); }
  if (win.appId === 'excel' && _excelDirty && _excelActiveId) { excelSave(); osToast('📊 Planilha salva automaticamente'); }
  if (win.appId === 'checklist' && _checklistDirty && _checklistActiveId) { checklistSave(); osToast('✅ Checklist salva automaticamente'); }

  // Clean up app-specific stuff
  if (win.appId === 'journal' && _clockInterval) {
    clearInterval(_clockInterval);
    _clockInterval = null;
  }
  if (win.appId === 'wiki') {
    const frame = document.getElementById('wikiFrame');
    if (frame) frame.src = 'about:blank';
  }
  if (win.appId === 'sysmon' && _sysmonInterval) {
    clearInterval(_sysmonInterval);
    _sysmonInterval = null;
  }
  if (win.appId === 'timer' && _timerInterval) {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }
  if (win.appId === 'gamePlay') {
    const frame = document.getElementById('gameFrame');
    if (frame) frame.src = 'about:blank';
  }

  win.element.remove();
  delete _windows[winId];

  if (_activeWindowId === winId) {
    // Focus the topmost remaining window
    const remaining = Object.values(_windows).filter(w => !w.minimized);
    if (remaining.length) {
      remaining.sort((a, b) => b.zIndex - a.zIndex);
      focusWindow(remaining[0].winId);
    } else {
      _activeWindowId = null;
    }
  }

  renderTaskbar();
}

// ─── Window Manager: Minimize ─────────────────────────────────────────────
function minimizeWindow(winId) {
  const win = _windows[winId];
  if (!win) return;
  win.minimized = true;
  win.element.classList.add('os-window-minimized');

  if (_activeWindowId === winId) {
    const remaining = Object.values(_windows).filter(w => !w.minimized && w.winId !== winId);
    if (remaining.length) {
      remaining.sort((a, b) => b.zIndex - a.zIndex);
      focusWindow(remaining[0].winId);
    } else {
      _activeWindowId = null;
      updateAllWindowFocus();
    }
  }

  renderTaskbar();
}

function unminimizeWindow(winId) {
  const win = _windows[winId];
  if (!win) return;
  win.minimized = false;
  win.element.classList.remove('os-window-minimized');
  focusWindow(winId);
  renderTaskbar();
}

// ─── Window Manager: Maximize ─────────────────────────────────────────────
function maximizeWindow(winId) {
  const win = _windows[winId];
  if (!win) return;

  if (win.maximized) {
    // Restore
    win.maximized = false;
    win.element.classList.remove('os-window-maximized');
    if (win.prevRect) {
      win.element.style.left = win.prevRect.x + 'px';
      win.element.style.top = win.prevRect.y + 'px';
      win.element.style.width = win.prevRect.w + 'px';
      win.element.style.height = win.prevRect.h + 'px';
      win.x = win.prevRect.x; win.y = win.prevRect.y;
      win.w = win.prevRect.w; win.h = win.prevRect.h;
    }
  } else {
    // Save current rect
    win.prevRect = { x: win.x, y: win.y, w: win.w, h: win.h };
    win.maximized = true;
    win.element.classList.add('os-window-maximized');
    win.element.style.left = '0px';
    win.element.style.top = '0px';
    win.element.style.width = '100%';
    win.element.style.height = 'calc(100vh - 48px)';
  }

  // Invalidate map if map window
  if (win.appId === 'map' && mapState.leafletMap) {
    setTimeout(() => mapState.leafletMap.invalidateSize(), 100);
  }
  focusWindow(winId);
}

// ─── Window Manager: Focus ────────────────────────────────────────────────
function focusWindow(winId) {
  const win = _windows[winId];
  if (!win) return;
  _activeWindowId = winId;
  win.zIndex = ++_topZ;
  win.element.style.zIndex = _topZ;
  updateAllWindowFocus();
  renderTaskbar();
}

function updateAllWindowFocus() {
  Object.values(_windows).forEach(w => {
    w.element.classList.toggle('os-window-focused', w.winId === _activeWindowId);
  });
}

// ─── Window Manager: Drag ─────────────────────────────────────────────────
function startDrag(winId, e) {
  if (e.target.closest('.os-win-btn')) return;
  const win = _windows[winId];
  if (!win || win.maximized) return;

  focusWindow(winId);
  e.preventDefault();

  const startX = e.clientX;
  const startY = e.clientY;
  const origX = win.x;
  const origY = win.y;

  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    win.x = origX + dx;
    win.y = Math.max(0, origY + dy);
    win.element.style.left = win.x + 'px';
    win.element.style.top = win.y + 'px';
    // Snap preview indicators
    win.element.classList.toggle('snap-left', ev.clientX <= 6);
    win.element.classList.toggle('snap-right', ev.clientX >= window.innerWidth - 6);
  }
  function onUp(ev) {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    win.element.classList.remove('snap-left', 'snap-right');
    const tbH = 48;
    // Snap to left half
    if (ev.clientX <= 6) {
      win.prevRect = { x: origX, y: origY, w: origW, h: origH };
      win.x = 0; win.y = 0;
      win.w = Math.floor(window.innerWidth / 2);
      win.h = window.innerHeight - tbH;
      Object.assign(win.element.style, { left:'0', top:'0', width:win.w+'px', height:win.h+'px' });
    }
    // Snap to maximize (drag to top)
    else if (ev.clientY <= 2 && !win.maximized) {
      win.prevRect = { x: origX, y: origY, w: origW, h: origH };
      maximizeWindow(winId);
    }
    // Snap to right half
    else if (ev.clientX >= window.innerWidth - 6) {
      win.prevRect = { x: origX, y: origY, w: origW, h: origH };
      win.w = Math.floor(window.innerWidth / 2);
      win.x = window.innerWidth - win.w;
      win.y = 0;
      win.h = window.innerHeight - tbH;
      Object.assign(win.element.style, { left:win.x+'px', top:'0', width:win.w+'px', height:win.h+'px' });
    }
    if (win.appId === 'map' && mapState.leafletMap) setTimeout(() => mapState.leafletMap.invalidateSize(), 50);
  }
  const origW = win.w, origH = win.h;
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ─── Window Manager: Resize ──────────────────────────────────────────────
function startResize(winId, e) {
  const win = _windows[winId];
  if (!win || win.maximized) return;

  focusWindow(winId);
  e.preventDefault();
  e.stopPropagation();

  const startX = e.clientX;
  const startY = e.clientY;
  const origW = win.w;
  const origH = win.h;

  function onMove(ev) {
    const dw = ev.clientX - startX;
    const dh = ev.clientY - startY;
    win.w = Math.max(320, origW + dw);
    win.h = Math.max(200, origH + dh);
    win.element.style.width = win.w + 'px';
    win.element.style.height = win.h + 'px';
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    // Invalidate map if resized
    if (win.appId === 'map' && mapState.leafletMap) {
      setTimeout(() => mapState.leafletMap.invalidateSize(), 50);
    }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ─── Taskbar Rendering ────────────────────────────────────────────────────
function renderTaskbar() {
  const container = document.getElementById('taskbarApps');
  if (!container) return;
  if (typeof debounceSaveSession === 'function') debounceSaveSession();

  container.innerHTML = '';
  const openWindows = Object.values(_windows);
  for (const win of openWindows) {
    const app = OS_APPS.find(a => a.id === win.appId);
    // For custom windows (saved apps), create a virtual app entry
    const appInfo = app || { icon: '🖥️', name: win.element?.querySelector('.os-window-title')?.textContent || 'App' };
    const btn = document.createElement('button');
    btn.className = 'taskbar-app-btn' +
      (win.winId === _activeWindowId && !win.minimized ? ' taskbar-app-active' : '') +
      (win.minimized ? ' taskbar-app-minimized' : '');
    btn.innerHTML = `<span class="taskbar-app-icon">${appInfo.icon}</span><span class="taskbar-app-name">${appInfo.name}</span>`;
    btn.onclick = () => {
      if (win.minimized) {
        unminimizeWindow(win.winId);
      } else if (win.winId === _activeWindowId) {
        minimizeWindow(win.winId);
      } else {
        focusWindow(win.winId);
      }
    };
    container.appendChild(btn);
  }
}

// ─── Desktop Icons ────────────────────────────────────────────────────────
function renderDesktopIcons() {
  const container = document.getElementById('desktopIcons');
  if (!container) return;
  container.innerHTML = '';
  for (const app of OS_APPS) {
    if (app.hidden) continue;
    const icon = document.createElement('div');
    icon.className = 'desktop-icon';
    icon.dataset.appId = app.id;
    icon.innerHTML = `
      <div class="desktop-icon-img">${app.icon}</div>
      <div class="desktop-icon-label">${app.name}</div>
    `;
    icon.ondblclick = () => {
      icon.classList.add('opening');
      setTimeout(() => icon.classList.remove('opening'), 600);
      openApp(app.id);
    };
    icon.onclick = (e) => {
      document.querySelectorAll('.desktop-icon.selected').forEach(el => el.classList.remove('selected'));
      icon.classList.add('selected');
    };
    container.appendChild(icon);
  }
}

// ─── Start Menu ──────────────────────────────────────────────────────────
function toggleStartMenu() {
  const menu = document.getElementById('startMenu');
  if (!menu) return;
  menu.classList.toggle('hidden');
  if (!menu.classList.contains('hidden')) {
    renderStartMenu();
  }
}

function closeStartMenu() {
  const menu = document.getElementById('startMenu');
  if (menu) menu.classList.add('hidden');
}

function renderStartMenu() {
  const container = document.getElementById('startMenuApps');
  if (!container) return;
  container.innerHTML = '';
  // Search box
  const searchBox = document.createElement('div');
  searchBox.className = 'start-menu-search';
  searchBox.innerHTML = '<input type="text" placeholder="Buscar app..." id="startMenuSearch" oninput="filterStartMenu(this.value)" onkeydown="if(event.key===\'Enter\'){openFirstVisibleApp();event.preventDefault()}">';
  container.appendChild(searchBox);
  for (const app of OS_APPS) {
    if (app.hidden) continue;
    const item = document.createElement('div');
    item.className = 'start-menu-item';
    item.dataset.name = app.name.toLowerCase();
    item.innerHTML = `<span class="start-menu-item-icon">${app.icon}</span><span>${app.name}</span>`;
    item.onclick = () => openApp(app.id);
    container.appendChild(item);
  }
  // Separator + Power options
  const sep = document.createElement('div');
  sep.className = 'start-menu-sep';
  container.appendChild(sep);
  const restart = document.createElement('div');
  restart.className = 'start-menu-item start-menu-power';
  restart.innerHTML = '<span class="start-menu-item-icon">🔄</span><span>Reiniciar</span>';
  restart.onclick = () => location.reload();
  container.appendChild(restart);
  const shutdown = document.createElement('div');
  shutdown.className = 'start-menu-item start-menu-power';
  shutdown.innerHTML = '<span class="start-menu-item-icon">⏻</span><span>Desligar</span>';
  shutdown.onclick = () => { closeStartMenu(); runShutdownSequence(); };
  container.appendChild(shutdown);
  // Auto-focus search box
  setTimeout(() => { const sb = document.getElementById('startMenuSearch'); if (sb) sb.focus(); }, 50);
}

function filterStartMenu(query) {
  const items = document.querySelectorAll('#startMenuApps .start-menu-item');
  const q = query.toLowerCase().trim();
  items.forEach(item => {
    const name = item.dataset.name || '';
    item.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
}

function openFirstVisibleApp() {
  const items = document.querySelectorAll('#startMenuApps .start-menu-item');
  for (const item of items) {
    if (item.style.display !== 'none' && item.dataset.name) {
      item.click();
      return;
    }
  }
}

// ─── Shutdown Animation ──────────────────────────────────────────────────
function runShutdownSequence() {
  closeAllWindows();
  const overlay = document.createElement('div');
  overlay.className = 'shutdown-overlay';
  overlay.innerHTML = `
    <div class="shutdown-msg">Desligando...</div>
    <div class="shutdown-sub">Salvando dados e finalizando processos.</div>
  `;
  document.body.appendChild(overlay);
  // Fade to black
  requestAnimationFrame(() => overlay.classList.add('active'));
  setTimeout(() => {
    overlay.innerHTML = '<div class="shutdown-msg">Bunker OS desligado.</div><div class="shutdown-sub" style="margin-top:12px;font-size:13px;opacity:.5">Clique para reiniciar</div>';
    overlay.onclick = () => location.reload();
  }, 2500);
}

// ─── Taskbar Clock ────────────────────────────────────────────────────────
function updateTaskbarClock() {
  const el = document.getElementById('taskbarClock');
  if (!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  el.textContent = hh + ':' + mm + ':' + ss;
  // Update title with date
  const day = String(now.getDate()).padStart(2, '0');
  const mon = String(now.getMonth() + 1).padStart(2, '0');
  el.title = `${day}/${mon}/${now.getFullYear()} ${hh}:${mm}:${ss}`;
}

function startTaskbarClock() {
  updateTaskbarClock();
  _taskbarClockInterval = setInterval(updateTaskbarClock, 1000);
}

// ─── Click outside start menu to close ────────────────────────────────────
document.addEventListener('mousedown', (e) => {
  const menu = document.getElementById('startMenu');
  if (menu && !menu.classList.contains('hidden')) {
    if (!e.target.closest('.start-menu') && !e.target.closest('.taskbar-start')) {
      closeStartMenu();
    }
  }
});

// ─── Click on desktop to deselect icons ───────────────────────────────────
document.addEventListener('click', (e) => {
  if (e.target.closest('.desktop-icons') && !e.target.closest('.desktop-icon')) {
    document.querySelectorAll('.desktop-icon.selected').forEach(el => el.classList.remove('selected'));
  }
});

// ─── Desktop Context Menu ────────────────────────────────────────────────
document.addEventListener('contextmenu', (e) => {
  // Only on desktop background or icons
  if (!e.target.closest('.os-desktop') || e.target.closest('.os-window') || e.target.closest('.taskbar') || e.target.closest('.start-menu')) return;
  e.preventDefault();
  closeContextMenu();
  const icon = e.target.closest('.desktop-icon');
  const menu = document.createElement('div');
  menu.className = 'os-context-menu';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';

  if (icon) {
    const appId = icon.dataset.appId;
    const app = OS_APPS.find(a => a.id === appId);
    if (app) {
      menu.innerHTML = `
        <div class="ctx-header">${app.icon} ${app.name}</div>
        <div class="ctx-item" onclick="openApp('${appId}'); closeContextMenu()">Abrir</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" onclick="closeContextMenu()">Cancelar</div>`;
    }
  } else {
    menu.innerHTML = `
      <div class="ctx-item" onclick="openApp('chat'); closeContextMenu()">🤖 Abrir Chat</div>
      <div class="ctx-item" onclick="openApp('notepad'); closeContextMenu()">📝 Novo Bloco de Notas</div>
      <div class="ctx-item" onclick="openApp('settings'); closeContextMenu()">⚙️ Configurações</div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" onclick="tileWindows(); closeContextMenu()">📐 Organizar janelas</div>
      <div class="ctx-item" onclick="closeAllWindows(); closeContextMenu()">Fechar todas as janelas</div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" onclick="cycleWallpaper(); closeContextMenu()">🎨 Trocar wallpaper</div>
      <div class="ctx-item" onclick="location.reload()">🔄 Reiniciar Bunker OS</div>`;
  }
  document.body.appendChild(menu);
  // Adjust position if overflows
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 5) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 5) + 'px';
});

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('.os-context-menu')) closeContextMenu();
});

function closeContextMenu() {
  document.querySelectorAll('.os-context-menu').forEach(m => m.remove());
}

function closeAllWindows() {
  Object.keys(_windows).forEach(winId => closeWindow(winId));
}

function tileWindows() {
  const wins = Object.values(_windows).filter(w => !w.minimized);
  if (!wins.length) return;
  const maxW = window.innerWidth;
  const maxH = window.innerHeight - 48;
  const count = wins.length;
  // Calculate grid layout
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const tileW = Math.floor(maxW / cols);
  const tileH = Math.floor(maxH / rows);
  wins.forEach((win, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    win.x = col * tileW;
    win.y = row * tileH;
    win.w = tileW;
    win.h = tileH;
    win.maximized = false;
    win.element.classList.remove('os-window-maximized');
    win.element.style.left = win.x + 'px';
    win.element.style.top = win.y + 'px';
    win.element.style.width = win.w + 'px';
    win.element.style.height = win.h + 'px';
    // Invalidate map
    if (win.appId === 'map' && mapState.leafletMap) {
      setTimeout(() => mapState.leafletMap.invalidateSize(), 100);
    }
  });
}

// ─── Session Save / Restore ───────────────────────────────────────────────
function saveSession() {
  const openApps = Object.values(_windows)
    .filter(w => w.appId && !w.appId.startsWith('_'))
    .map(w => w.appId);
  storage.set('bunker_session', JSON.stringify(openApps));
}

function restoreSession() {
  try {
    const saved = storage.get('bunker_session');
    if (saved) {
      const apps = JSON.parse(saved);
      if (Array.isArray(apps) && apps.length > 0) {
        apps.forEach((appId, i) => setTimeout(() => openApp(appId), i * 100));
        return;
      }
    }
  } catch {}
  // Default: open chat
  openApp('chat');
}

// Save session on debounce (called from renderTaskbar which runs on every open/close)
let _sessionSaveTimeout = null;
function debounceSaveSession() {
  clearTimeout(_sessionSaveTimeout);
  _sessionSaveTimeout = setTimeout(saveSession, 1000);
}

// ─── Wallpaper ───────────────────────────────────────────────────────────
const WALLPAPERS = [
  'default',       // dark gradient (original)
  'starfield',     // animated stars
  'grid',          // tech grid
  'aurora',        // aurora borealis gradient
  'matrix',        // matrix-style
];
let _wallpaperIdx = parseInt(storage.get('bunker_wallpaper') || '0') || 0;

function cycleWallpaper() {
  _wallpaperIdx = (_wallpaperIdx + 1) % WALLPAPERS.length;
  storage.set('bunker_wallpaper', String(_wallpaperIdx));
  applyWallpaper();
}

function applyWallpaper() {
  const desktop = document.getElementById('desktop');
  if (!desktop) return;
  WALLPAPERS.forEach(w => desktop.classList.remove('wp-' + w));
  desktop.classList.add('wp-' + WALLPAPERS[_wallpaperIdx]);
  const names = { default: 'Escuro', starfield: 'Estrelas', grid: 'Grade', aurora: 'Aurora', matrix: 'Matrix' };
  osToast('🎨 Wallpaper: ' + (names[WALLPAPERS[_wallpaperIdx]] || WALLPAPERS[_wallpaperIdx]));
}

// ─── OS Toast Notifications ──────────────────────────────────────────────
function osToast(msg, duration = 2500) {
  let container = document.getElementById('osToasts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'osToasts';
    container.className = 'os-toasts';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'os-toast';
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── OS Keyboard Shortcuts ───────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Ctrl+W — close active window
  if (e.ctrlKey && e.key === 'w' && _activeWindowId) {
    e.preventDefault();
    closeWindow(_activeWindowId);
  }
  // Ctrl+M — minimize active window
  if (e.ctrlKey && e.key === 'm' && _activeWindowId) {
    e.preventDefault();
    minimizeWindow(_activeWindowId);
  }
  // Ctrl+Shift+N — open notepad
  if (e.ctrlKey && e.shiftKey && e.key === 'N') {
    e.preventDefault();
    openApp('notepad');
  }
  // F2 — open start menu search
  if (e.key === 'F2' && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    const menu = document.getElementById('startMenu');
    if (menu && menu.classList.contains('hidden')) toggleStartMenu();
    setTimeout(() => { const sb = document.getElementById('startMenuSearch'); if (sb) sb.focus(); }, 100);
  }
  // Alt+Tab — cycle windows
  if (e.altKey && e.key === 'Tab') {
    e.preventDefault();
    const wins = Object.values(_windows).filter(w => !w.minimized);
    if (wins.length > 1) {
      wins.sort((a, b) => b.zIndex - a.zIndex);
      // Focus the second window (next in stack)
      focusWindow(wins[wins.length - 1].winId);
    } else if (wins.length === 0) {
      // Unminimize the most recently minimized window
      const minimized = Object.values(_windows).filter(w => w.minimized);
      if (minimized.length) unminimizeWindow(minimized[minimized.length - 1].winId);
    }
  }
  // Escape — close start menu if open
  if (e.key === 'Escape') {
    const menu = document.getElementById('startMenu');
    if (menu && !menu.classList.contains('hidden')) {
      closeStartMenu();
      e.preventDefault();
    }
    closeContextMenu();
  }
});

// ─── Close parent window from a "back" button ────────────────────────────
function closeParentWindow(viewId) {
  const appId = _viewToApp ? _viewToApp[viewId] : null;
  if (appId) {
    const win = Object.values(_windows).find(w => w.appId === appId);
    if (win) { closeWindow(win.winId); return; }
  }
  // fallback
  openApp('chat');
}

// ═══════════════════════════════════════════════════════════════════════════
// END BUNKER OS WINDOW MANAGER
// ═══════════════════════════════════════════════════════════════════════════


// ─── Init ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadPersistedData();
  loadCharacters();
  checkHealth();
  autoResize();
  setupDragDrop();
  renderChatList();
  renderFavorites();
  renderSidebarCharacters();
  // Load sidebar apps list in background
  fetch("/api/build/list").then(r => r.json()).then(d => renderSidebarApps(d.apps || [])).catch(() => {});
  // Phase 3: Load guides, protocols, games from API
  loadGuidesIndex();
  loadProtocolsIndex();
  loadGamesIndex();
  initSearch();

  // ── Bunker OS Boot Sequence ──
  runBootSequence();
});

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

// ─── Persistence (with fallback) ────────────────────────────────────────────
const _ls = () => { try { return window['local' + 'Storage']; } catch { return null; } };
const storage = {
  get(key) { const s = _ls(); return s ? s.getItem(key) : null; },
  set(key, val) { const s = _ls(); if (s) s.setItem(key, val); },
  del(key) { const s = _ls(); if (s) s.removeItem(key); }
};

function loadPersistedData() {
  try {
    const saved = storage.get("bunker_chats");
    if (saved) state.chats = JSON.parse(saved);
    const favs = storage.get("bunker_favs");
    if (favs) state.favorites = JSON.parse(favs);
  } catch {}

  if (Object.keys(state.chats).length === 0) {
    const id = genId();
    state.chats[id] = { title: "Novo chat", messages: [] };
    state.activeChatId = id;
  } else {
    const lastActive = storage.get("bunker_active_chat");
    state.activeChatId = lastActive && state.chats[lastActive] ? lastActive : Object.keys(state.chats)[0];
  }
  saveChats();
}

function saveChats() {
  try {
    storage.set("bunker_chats", JSON.stringify(state.chats));
    storage.set("bunker_active_chat", state.activeChatId);
  } catch (e) {
    if (e.name === "QuotaExceededError") {
      // Drop oldest non-active chat and retry
      const ids = Object.keys(state.chats);
      const toRemove = ids.find(id => id !== state.activeChatId);
      if (toRemove) {
        delete state.chats[toRemove];
        renderChatList();
        saveChats(); // retry
      }
    }
  }
}

function saveFavorites() {
  storage.set("bunker_favs", JSON.stringify(state.favorites));
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ─── Chat List ──────────────────────────────────────────────────────────────
function renderChatList() {
  const list = document.getElementById("chatList");
  list.innerHTML = "";
  const ids = Object.keys(state.chats).reverse();
  for (const id of ids) {
    const chat = state.chats[id];
    const li = document.createElement("li");
    li.className = `nav-item${id === state.activeChatId ? " active" : ""}`;
    li.dataset.chat = id;
    li.onclick = (e) => { if (!e.target.closest(".nav-delete")) switchChat(id); };
    li.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      <span>${escapeHtml(chat.title)}</span>
      <button class="nav-delete" onclick="deleteChat('${id}')" title="Excluir">&times;</button>`;
    list.appendChild(li);
  }
}

function switchChat(id) {
  if (!state.chats[id] || state.isStreaming) return;
  state.activeChatId = id;
  saveChats();
  renderChatList();
  restoreChat();
  showChatView();
}

function restoreChat() {
  const chat = state.chats[state.activeChatId];
  if (!chat) return;
  const container = document.getElementById("chatMessages");
  container.innerHTML = "";
  if (chat.messages.length === 0) {
    container.innerHTML = getWelcomeHtml();
    return;
  }
  for (const msg of chat.messages) {
    addMsgDom(msg.role, msg.content, null, msg.badge);
  }
  scrollChat();
}

function newChat() {
  const id = genId();
  state.chats[id] = { title: "Novo chat", messages: [] };
  state.activeChatId = id;
  saveChats();
  renderChatList();
  restoreChat();
  showChatView();
  document.getElementById("sidebar").classList.remove("open");
}

function deleteChat(id) {
  if (Object.keys(state.chats).length <= 1) return;
  delete state.chats[id];
  if (state.activeChatId === id) {
    state.activeChatId = Object.keys(state.chats)[0];
  }
  saveChats();
  renderChatList();
  restoreChat();
}

function clearAllData() {
  if (!confirm("Tem certeza? Isso vai apagar todo o historico e favoritos.")) return;
  storage.del("bunker_chats");
  storage.del("bunker_favs");
  storage.del("bunker_active_chat");
  state.chats = {};
  state.favorites = [];
  const id = genId();
  state.chats[id] = { title: "Novo chat", messages: [] };
  state.activeChatId = id;
  saveChats();
  saveFavorites();
  renderChatList();
  renderFavorites();
  restoreChat();
  toggleConfig();
}

// ─── Favorites ──────────────────────────────────────────────────────────────
function renderFavorites() {
  const list = document.getElementById("favList");
  const count = document.getElementById("favCount");
  count.textContent = state.favorites.length;
  list.innerHTML = "";
  if (state.favorites.length === 0) {
    list.innerHTML = '<li class="nav-empty">Nenhum favorito ainda</li>';
    return;
  }
  for (const fav of state.favorites) {
    const li = document.createElement("li");
    li.className = "nav-item";
    li.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      <span>${escapeHtml(fav.text.slice(0, 40))}${fav.text.length > 40 ? "..." : ""}</span>
      <button class="nav-delete" onclick="removeFavorite('${fav.id}')" title="Remover">&times;</button>`;
    li.onclick = (e) => {
      if (e.target.closest(".nav-delete")) return;
      if (fav.chatId && state.chats[fav.chatId]) switchChat(fav.chatId);
    };
    list.appendChild(li);
  }
}

function addFavorite(text, chatId) {
  const id = genId();
  state.favorites.unshift({ id, text: text.slice(0, 200), from: "assistant", chatId, ts: Date.now() });
  if (state.favorites.length > 50) state.favorites = state.favorites.slice(0, 50);
  saveFavorites();
  renderFavorites();
}

function removeFavorite(id) {
  state.favorites = state.favorites.filter(f => f.id !== id);
  saveFavorites();
  renderFavorites();
}

function isFavorited(text) {
  return state.favorites.some(f => f.text === text.slice(0, 200));
}

// ─── Guides (dynamic, loaded from API) ──────────────────────────────────────
async function loadGuidesIndex() {
  try {
    const r = await fetch('/api/guides');
    const d = await r.json();
    guidesIndex = Array.isArray(d) ? d : (d.guides || []);
    renderSidebarGuides();
    indexContent();
  } catch(e) { console.warn('Guides load failed:', e); }
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

  for (const g of guidesIndex) {
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
    const titleFromIndex = guidesIndex.find(g => g.id === guideId);
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
  if (win) closeWindow(win.winId);
  else showChatView();
}

function toggleFavGuide() {
  if (!state.activeGuide) return;
  const titleFromIndex = guidesIndex.find(g => g.id === state.activeGuide)?.title;
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
  const titleFromIndex = guidesIndex.find(g => g.id === state.activeGuide)?.title;
  const text = titleFromIndex || state.activeGuide;
  if (isFavorited(text)) {
    btn.classList.add("faved");
  } else {
    btn.classList.remove("faved");
  }
}

// ─── View Switching (now routes through window manager) ──────────────────
const ALL_VIEWS = ["chatView", "guideView", "mapView", "appsView", "charactersView", "ttsView", "protocolView", "suppliesView", "booksView", "bookReaderView", "gamesView", "gamePlayView", "wikiView", "journalView", "notepadView", "wordView", "excelView", "sysmonView"];

// Maps viewId -> appId for reverse lookup
const _viewToApp = {};
OS_APPS.forEach(a => { if (a.viewId) _viewToApp[a.viewId] = a.id; });

function showView(id) {
  // Route through window manager if possible
  const appId = _viewToApp[id];
  if (appId) {
    openApp(appId);
    return;
  }
  // Fallback: direct toggle (should rarely be needed)
  ALL_VIEWS.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.toggle("hidden", v !== id);
  });
  if (id !== 'journalView' && _clockInterval) {
    clearInterval(_clockInterval);
    _clockInterval = null;
  }
}

function showChatView() { openApp('chat'); }
function showGuideView() { openApp('guides'); }

// ─── Config Drawer ──────────────────────────────────────────────────────────
function toggleConfig() {
  document.getElementById("configOverlay").classList.toggle("hidden");
  document.getElementById("configDrawer").classList.toggle("hidden");
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
      if (txt) txt.textContent = "Ollama offline";
      const tbDot = document.getElementById('taskbarStatusDot');
      if (tbDot) { tbDot.classList.remove('sys-ok'); tbDot.classList.add('sys-warn'); }
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
    if (d.tts === "piper") {
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
  // Temporarily clear dismissed flag for forced open, restore after build
  const wasDismissed = localStorage.getItem("bunker_setup_dismissed");
  localStorage.removeItem("bunker_setup_dismissed");
  maybeShowSetupModal(d);
  if (wasDismissed && wasDismissed !== "0") {
    // Keep dismissed flag removed so modal stays open; user can re-check it
  }
}

function updateSysStatusBar(d) {
  const rows = [
    { id: "sysOllama", ok: !!d.status && d.status === "online", label: d.status === "online" ? "Ollama online" : "Ollama offline" },
    { id: "sysSTT",    ok: d.stt === "whisper", label: d.stt === "whisper" ? "Whisper (offline)" : "Browser Speech API" },
    { id: "sysTTS",    ok: d.tts === "piper" || d.tts === "pyttsx3", label: d.tts === "piper" ? "Piper (offline)" : d.tts === "pyttsx3" ? "pyttsx3 (offline)" : "Edge TTS (online)" },
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

function maybeShowSetupModal(d) {
  if (localStorage.getItem("bunker_setup_dismissed") === "1") return;

  const piperModels = d.piper_models || {};
  const hasAnyPiper = Object.values(piperModels).some(m => m.downloaded);
  const whisperReady = !!d.stt_ready;

  if (hasAnyPiper && whisperReady) return; // everything OK

  // Build content
  let html = "";

  // TTS section — Piper models
  if (!hasAnyPiper) {
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
  } else {
    html += `<div class="setup-section">
      <div class="setup-ok">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        TTS offline ativo (Piper)
      </div>
    </div>`;
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
    const r = await fetch("/api/maps");
    const d = await r.json();
    if (d.maps && d.maps.length > 0) {
      const m = d.maps[0];
      el.textContent = `\u2713 ${m.file} (${m.size_mb} MB) — 100% offline`;
      el.className = "map-config-status online";
    } else {
      el.textContent = "Nenhum .pmtiles encontrado";
      el.className = "map-config-status offline";
    }
  } catch {
    el.textContent = "Erro ao verificar";
    el.className = "map-config-status offline";
  }
}

function populateModels() {
  const fill = (id, list, preferred) => {
    const el = document.getElementById(id);
    if (!el || !list.length) return;
    const sorted = [...list].sort((a, b) => {
      const aP = preferred.some(p => a.includes(p)) ? -1 : 0;
      const bP = preferred.some(p => b.includes(p)) ? -1 : 0;
      return aP - bP;
    });
    el.innerHTML = sorted.map(m => `<option value="${m}">${m}</option>`).join("");
  };
  fill("chatModel", state.models, ["gemma3"]);
  fill("visionModel", state.visionModels.length ? state.visionModels : state.models, ["gemma3", "llava"]);
  fill("builderModel", state.models, ["qwen2.5-coder", "coder"]);
  fill("brainModel", state.models, ["dolphin3", "dolphin"]);
}

// ─── Navigation ─────────────────────────────────────────────────────────────
function toggleSidebar() { openApp('settings'); }

// ─── Input Helpers ──────────────────────────────────────────────────────────
function autoResize() {
  const ta = document.getElementById("chatInput");
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
    updateModeTag();
  });
}

function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
}

function setInput(text) {
  const ta = document.getElementById("chatInput");
  ta.value = text;
  ta.focus();
  updateModeTag();
  showChatView();
}

function updateModeTag() {
  const tag = document.getElementById("modeTag");
  const hint = document.getElementById("modeHint");
  const text = document.getElementById("chatInput").value;

  if (text.startsWith("/build")) {
    tag.textContent = "BUILD";
    tag.style.background = "rgba(200, 80, 255, 0.12)";
    tag.style.color = "#c850ff";
    hint.innerHTML = 'Gerando app com <code>qwen2.5-coder:14b</code>';
  } else if (text.startsWith("/brain")) {
    tag.textContent = "CEREBRO";
    tag.style.background = "rgba(255, 60, 60, 0.12)";
    tag.style.color = "#ff4444";
    hint.innerHTML = 'Modo sem filtros &mdash; <code>dolphin3</code> sem amarras';
  } else if (state.webcamActive) {
    tag.textContent = "VIDEO";
    tag.style.background = "rgba(99, 145, 255, 0.12)";
    tag.style.color = "#6391ff";
    hint.textContent = "Webcam ativa — sua mensagem analisa o frame atual";
  } else if (state.attachedImage) {
    tag.textContent = "VISAO";
    tag.style.background = "rgba(99, 145, 255, 0.12)";
    tag.style.color = "#6391ff";
    hint.textContent = "Imagem anexada — sua mensagem analisa a imagem";
  } else {
    tag.textContent = "TEXTO";
    tag.style.background = "var(--accent-dim)";
    tag.style.color = "var(--accent)";
    hint.innerHTML = 'Enter envia · Shift+Enter nova linha · <code>/build</code> gera apps · <code>/brain</code> modo cerebro';
  }
}

// ─── Send (unified router) ──────────────────────────────────────────────────
// ─── Prompt Queue ────────────────────────────────────────────────────────────
function renderQueue() {
  const el = document.getElementById("promptQueue");
  if (!el) return;
  if (state.promptQueue.length === 0) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  el.innerHTML = `<div class="queue-label">Fila (${state.promptQueue.length})</div>` +
    state.promptQueue.map((q, i) =>
      `<div class="queue-item"><span class="queue-text">${escapeHtml(q.length > 50 ? q.slice(0,50)+"…" : q)}</span>` +
      `<button class="queue-remove" onclick="removeFromQueue(${i})">✕</button></div>`
    ).join("");
}

function removeFromQueue(i) {
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

async function send() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  // If already streaming, queue the prompt
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
  document.getElementById("btnSend").disabled = false; // STOP mode handles the button

  const chat = state.chats[state.activeChatId];

  // Auto-title from first message
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
  // Process next queued prompt
  processQueue();
}

// ─── Chat (text) ────────────────────────────────────────────────────────────
async function handleChat(text) {
  const chat = state.chats[state.activeChatId];
  addMsgDom("user", text);
  chat.messages.push({ role: "user", content: text });
  saveChats();

  const model = document.getElementById("chatModel").value;
  const system = document.getElementById("systemPrompt").value;
  const apiMessages = chat.messages.map(m => ({ role: m.role, content: m.content }));
  const { el, contentEl } = addStreamMsgDom();

  const full = await streamFromAPI("/api/chat", {
    model, messages: apiMessages, system
  }, contentEl);

  chat.messages.push({ role: "assistant", content: full });
  saveChats();
  addMsgActions(el, full);
}

// ─── Brain (unhinged / sem filtros) ─────────────────────────────────────────
async function handleBrain(text) {
  const chat = state.chats[state.activeChatId];
  addMsgDom("user", text, null, "brain");
  chat.messages.push({ role: "user", content: text, badge: "brain" });
  saveChats();

  const model = document.getElementById("brainModel").value || "dolphin3";
  const brainSystem = document.getElementById("brainPrompt").value;
  const apiMessages = chat.messages.map(m => ({ role: m.role, content: m.content }));
  const { el, contentEl } = addStreamMsgDom("brain");

  const full = await streamFromAPI("/api/chat", {
    model, messages: apiMessages, system: brainSystem
  }, contentEl);

  chat.messages.push({ role: "assistant", content: full, badge: "brain" });
  saveChats();
  addMsgActions(el, full);
}

// ─── Vision (webcam / upload) ───────────────────────────────────────────────
async function handleVision(text, source) {
  const chat = state.chats[state.activeChatId];
  let b64;
  if (source === "webcam") {
    b64 = captureWebcamFrame();
    addMsgDom("user", text, null, "vision", b64);
  } else {
    b64 = state.attachedImage.b64;
    addMsgDom("user", text, null, "vision", b64);
    clearAttachment();
  }

  const model = document.getElementById("visionModel").value;
  const apiMessages = chat.messages.map(m => ({ role: m.role, content: m.content }));
  const { el, contentEl } = addStreamMsgDom("vision");

  const full = await streamFromAPI("/api/vision", {
    model, image: b64, prompt: text, messages: apiMessages
  }, contentEl);

  chat.messages.push({ role: "user", content: text, badge: "vision" });
  chat.messages.push({ role: "assistant", content: full, badge: "vision" });
  saveChats();
  addMsgActions(el, full);
}

// ─── Builder ────────────────────────────────────────────────────────────────
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
  strip.classList.remove("hidden");
  frame.srcdoc = fullHtml;

  chat.messages.push({ role: "user", content: `/build ${prompt}`, badge: "builder" });
  chat.messages.push({ role: "assistant", content: "[App gerado]", badge: "builder" });
  saveChats();
}

// ─── Stream Helper ──────────────────────────────────────────────────────────
function setStopMode(on) {
  const btn = document.getElementById("btnSend");
  const icon = document.getElementById("btnSendIcon");
  if (on) {
    btn.title = "Parar geração";
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

async function streamFromAPI(url, body, contentEl) {
  let full = "";
  const controller = new AbortController();
  state.abortController = controller;
  setStopMode(true);

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
            if (data.token) {
              full += data.token;
              contentEl.textContent = full;
              scrollChat();
            }
          } catch {}
        }
      }
    }
  } catch (e) {
    if (e.name !== "AbortError") {
      contentEl.textContent = `Erro: ${e.message}. Verifique se Ollama esta rodando (ollama serve).`;
    }
  }

  state.abortController = null;
  setStopMode(false);

  const dots = contentEl.parentElement?.querySelector(".typing-indicator");
  if (dots) dots.remove();

  if (full) contentEl.innerHTML = markdownToHtml(full) + (controller.signal.aborted ? ' <em class="stream-stopped">[interrompido]</em>' : "");

  return full;
}

// ─── Message UI ─────────────────────────────────────────────────────────────
function addMsgDom(role, text, imgThumb, badge, imgB64) {
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

function addStreamMsgDom(badge) {
  removeWelcome();
  const container = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = "msg assistant";

  let badgeHtml = "";
  if (badge === "voice") badgeHtml = '<span class="msg-badge badge-voice">VOZ</span>';
  if (badge === "vision") badgeHtml = '<span class="msg-badge badge-vision">VISAO</span>';
  if (badge === "builder") badgeHtml = '<span class="msg-badge badge-builder">BUILD</span>';
  if (badge === "brain") badgeHtml = '<span class="msg-badge badge-brain">CEREBRO</span>';

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

function addMsgActions(msgEl, text) {
  const body = msgEl.querySelector(".msg-body");
  const actions = document.createElement("div");
  actions.className = "msg-actions";

  // Copy button
  const copyBtn = document.createElement("button");
  copyBtn.className = "msg-copy-btn";
  copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar`;
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "✓ Copiado";
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar`;
      }, 1800);
    }).catch(() => {});
  };

  // TTS button
  const ttsBtn = document.createElement("button");
  ttsBtn.className = "msg-tts-btn";
  ttsBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg> Ouvir`;
  ttsBtn.onclick = () => speakText(text);

  // Fav button
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

function scrollChat() {
  const c = document.getElementById("chatMessages");
  c.scrollTop = c.scrollHeight;
}

function getWelcomeHtml() {
  return `<div class="welcome-msg" id="welcomeMsg">
    <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="var(--accent)"/>
      <path d="M8 22V12l8-5 8 5v10l-8 5-8-5z" stroke="var(--bg)" stroke-width="2" fill="none"/>
      <circle cx="16" cy="16" r="3" fill="var(--bg)"/>
    </svg>
    <h2>Bunker AI</h2>
    <div class="dont-panic">DON'T PANIC</div>
    <p>Seu guia local para o fim do mundo. Chat por texto, voz ou video. Gere apps com <code>/build</code>. Tudo offline, tudo seu.</p>
    <div class="welcome-hints">
      <button class="hint" onclick="setInput('Como purificar agua sem equipamento?')">Purificar agua</button>
      <button class="hint" onclick="setInput('Qual a resposta para a vida, o universo e tudo mais?')">A Grande Pergunta</button>
      <button class="hint" onclick="setInput('/build Um dashboard de sobrevivencia com checklist, mapa e inventario')">Criar app</button>
      <button class="hint" onclick="activateWebcam()">Ligar webcam</button>
    </div>
  </div>`;
}

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
          sendVoice(d.text);
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
      sendVoice(finalTranscript);
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

function openSavedApp(name) {
  // Open saved app in an OS window with iframe
  const winId = 'win_app_' + Date.now().toString(36);
  const maxW = window.innerWidth;
  const maxH = window.innerHeight - 48;
  const w = Math.min(800, maxW - 40);
  const h = Math.min(600, maxH - 40);
  const x = Math.max(20, (maxW - w) / 2) + (_cascadeOffset % 5) * 25;
  const y = Math.max(10, (maxH - h) / 2) + (_cascadeOffset % 5) * 25;
  _cascadeOffset++;

  const winEl = document.createElement('div');
  winEl.className = 'os-window';
  winEl.id = winId;
  winEl.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${++_topZ}`;
  winEl.innerHTML = `
    <div class="os-window-titlebar" onmousedown="startDrag('${winId}', event)" ondblclick="maximizeWindow('${winId}')">
      <span class="os-window-icon">🖥️</span>
      <span class="os-window-title">${escapeHtml(name)}</span>
      <div class="os-window-controls">
        <button class="os-win-btn os-win-min" onclick="minimizeWindow('${winId}')">&minus;</button>
        <button class="os-win-btn os-win-max" onclick="maximizeWindow('${winId}')">&#9744;</button>
        <button class="os-win-btn os-win-close" onclick="closeWindow('${winId}')">&times;</button>
      </div>
    </div>
    <div class="os-window-body" style="padding:0">
      <iframe src="/api/build/preview/${encodeURIComponent(name)}" style="width:100%;height:100%;border:none;background:#fff;border-radius:0 0 var(--radius-lg) var(--radius-lg)"></iframe>
    </div>
    <div class="os-window-resize" onmousedown="startResize('${winId}', event)"></div>
  `;
  winEl.addEventListener('mousedown', (e) => { if (!e.target.closest('.os-win-btn')) focusWindow(winId); });
  document.getElementById('windowsContainer').appendChild(winEl);
  _windows[winId] = { winId, appId: '_saved_app', element: winEl, minimized: false, maximized: false, zIndex: _topZ, x, y, w, h, prevRect: null };
  renderTaskbar();
  focusWindow(winId);
  winEl.classList.add('os-window-opening');
  setTimeout(() => winEl.classList.remove('os-window-opening'), 300);
}

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

function openMap() {
  openApp('map');
}

function closeMap() {
  // In window mode, close the map window
  const win = Object.values(_windows).find(w => w.appId === 'map');
  if (win) closeWindow(win.winId);
}

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
      // Load PMTiles JS library dynamically if not loaded
      if (typeof pmtiles === "undefined" && typeof protomapsL === "undefined") {
        await loadScript("https://unpkg.com/pmtiles@4.4.0/dist/pmtiles.js");
        await loadScript("https://unpkg.com/protomaps-leaflet@5.1.0/dist/protomaps-leaflet.js");
      }

      const pmFile = mapsData.maps[0];
      mapState.offlinePmtiles = pmFile.file;

      // Use protomaps-leaflet for vector tile rendering
      if (typeof protomapsL !== "undefined") {
        const layer = protomapsL.leafletLayer({
          url: "/maps/" + pmFile.file,
          flavor: "dark",
        });
        layer.addTo(map);
        usingOffline = true;
        mapState.pmtilesLoaded = true;
      } else if (typeof pmtiles !== "undefined") {
        // Fallback: raster layer
        const p = new pmtiles.PMTiles("/maps/" + pmFile.file);
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

  if (!usingOffline) {
    // Online fallback: CartoDB Dark Matter
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
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
function addMapMarker(lat, lng, label) {
  const id = genId();
  const icon = L.divIcon({
    className: "custom-marker",
    html: `<div style="width:12px;height:12px;background:#42f5a0;border:2px solid #08090b;border-radius:50%;box-shadow:0 0 8px rgba(66,245,160,0.5);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

  const marker = L.marker([lat, lng], { icon })
    .addTo(mapState.leafletMap)
    .bindPopup(`<strong>${escapeHtml(label)}</strong><br><span style="font-size:11px;color:#6b6c78;font-family:monospace;">${lat.toFixed(5)}, ${lng.toFixed(5)}</span><br><button onclick="removeMapMarker('${id}')" style="margin-top:6px;padding:2px 8px;background:rgba(245,66,102,0.15);border:1px solid rgba(245,66,102,0.3);border-radius:4px;color:#f54266;font-size:10px;cursor:pointer;">Remover</button>`);

  mapState.markers.push({ id, lat, lng, label, leafletMarker: marker });
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
    li.innerHTML = `<span class="marker-dot"></span>${escapeHtml(m.label)}`;
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
    protocolsIndex = Array.isArray(d) ? d : (d.protocols || []);
    renderSidebarProtocols();
    indexContent();
  } catch(e) { console.warn('Protocols load failed:', e); }
}

function renderSidebarProtocols() {
  const list = document.getElementById('protocolList');
  if (!list) return;
  list.innerHTML = '';

  const urgencyEmoji = { critical: '\u{1F534}', high: '\u{1F7E0}', medium: '\u{1F7E1}' };

  for (const p of protocolsIndex) {
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
  if (win) closeWindow(win.winId);
  else showChatView();
}

// ─── Games (loaded from API) ────────────────────────────────────────────────
async function loadGamesIndex() {
  try {
    const r = await fetch('/api/games');
    const d = await r.json();
    gamesIndex = Array.isArray(d) ? d : (d.games || []);
  } catch(e) { console.warn('Games load failed:', e); }
}

function openGamesPanel() {
  openApp('games');
}

function renderGamesGrid() {
  const grid = document.getElementById('gamesGrid');
  if (!grid) return;
  if (gamesIndex.length === 0) {
    grid.innerHTML = '<div class="panel-empty">Nenhum jogo dispon\u00EDvel.</div>';
    return;
  }
  const emojis = { snake: '🐍', tetris: '🧱', '2048': '🔢', minesweeper: '💣', sudoku: '🔲', solitaire: '🃏', chess: '♟️', checkers: '⚫' };
  grid.innerHTML = gamesIndex.map(g => `
    <div class="game-card" onclick="openGame('${escapeHtml(g.id || g.name)}')">
      <div class="game-card-icon">${emojis[g.id || g.name] || '🎮'}</div>
      <div class="game-card-name">${escapeHtml(g.title || g.name)}</div>
      ${g.desc ? `<div class="game-card-desc">${escapeHtml(g.desc)}</div>` : ''}
    </div>`).join('');
}

function openGame(name) {
  openApp('gamePlay');
  const frame = document.getElementById('gameFrame');
  const titleEl = document.getElementById('gameTitle');
  const game = gamesIndex.find(g => (g.id || g.name) === name);
  if (titleEl) titleEl.textContent = game?.title || name;
  if (frame) frame.src = `/api/games/${encodeURIComponent(name)}`;
  // Update window title
  const win = Object.values(_windows).find(w => w.appId === 'gamePlay');
  if (win) {
    const titleSpan = win.element.querySelector('.os-window-title');
    if (titleSpan) titleSpan.textContent = game?.title || name;
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

// ─── MiniSearch (global search) ─────────────────────────────────────────────
function initSearch() {
  // MiniSearch is loaded via <script> tag in index.html
  // indexContent() is called after guides/protocols load
}

function indexContent() {
  if (typeof MiniSearch === 'undefined') return;
  searchIndex = new MiniSearch({
    fields: ['title', 'id'],
    storeFields: ['title', 'type', 'id'],
    searchOptions: { prefix: true, fuzzy: 0.2 }
  });

  const docs = [];
  for (const g of guidesIndex) {
    docs.push({ id: 'guide-' + g.id, title: g.title, type: 'guide', _id: g.id });
  }
  for (const p of protocolsIndex) {
    docs.push({ id: 'proto-' + p.id, title: p.title, type: 'protocol', _id: p.id });
  }
  for (const g of gamesIndex) {
    docs.push({ id: 'game-' + (g.id||g.name), title: g.title||g.name, type: 'game', _id: g.id||g.name });
  }

  searchIndex.addAll(docs);
}

function globalSearch(query) {
  if (!searchIndex || !query.trim()) return [];
  return searchIndex.search(query).slice(0, 10);
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
function escapeHtml(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

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

    el.innerHTML = `
      <div class="sysmon-grid">
        <div class="sysmon-card">
          <div class="sysmon-label">🖥️ Servidor</div>
          <div class="sysmon-val">${d.ip || 'localhost'}:${d.port}</div>
          <div class="sysmon-sub">Uptime: ${uptimeH}h ${uptimeM}m</div>
        </div>
        <div class="sysmon-card">
          <div class="sysmon-label">⚡ CPU</div>
          <div class="sysmon-bar"><div class="sysmon-bar-fill ${d.cpu_pct > 80 ? 'danger' : d.cpu_pct > 50 ? 'warn' : 'ok'}" style="width:${d.cpu_pct}%"></div></div>
          <div class="sysmon-sub">${d.cpu_pct}%</div>
        </div>
        <div class="sysmon-card">
          <div class="sysmon-label">🧠 RAM</div>
          <div class="sysmon-bar"><div class="sysmon-bar-fill ${d.ram_pct > 85 ? 'danger' : d.ram_pct > 60 ? 'warn' : 'ok'}" style="width:${d.ram_pct}%"></div></div>
          <div class="sysmon-sub">${d.ram_used_mb} / ${d.ram_total_mb} MB (${d.ram_pct}%)</div>
        </div>
        <div class="sysmon-card">
          <div class="sysmon-label">💾 Disco</div>
          <div class="sysmon-bar"><div class="sysmon-bar-fill ${d.disk_pct > 90 ? 'danger' : d.disk_pct > 70 ? 'warn' : 'ok'}" style="width:${d.disk_pct}%"></div></div>
          <div class="sysmon-sub">${d.disk_free_gb} GB livre de ${d.disk_total_gb} GB (${d.disk_pct}%)</div>
        </div>
        <div class="sysmon-card sysmon-wide">
          <div class="sysmon-label">📊 Conteúdo</div>
          <div class="sysmon-content-grid">
            <span>📋 ${d.content?.guides || '?'} guias</span>
            <span>🚨 ${d.content?.protocols || '?'} protocolos</span>
            <span>📚 ${d.content?.books || '?'} livros</span>
            <span>🎮 ${d.content?.games || '?'} jogos</span>
            <span>📦 ${d.content?.supplies || '?'} itens</span>
            <span>📓 ${d.content?.journal_entries || '?'} entradas</span>
          </div>
        </div>
      </div>
      <div class="sysmon-footer">Atualização automática a cada 5s — ${d.server_time?.slice(11, 19) || ''}</div>`;
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

function morsePlayAudio() {
  const morse = document.getElementById('morseOutput')?.textContent || '';
  if (!morse || morse === '...') return;
  if (!_morseAudioCtx) _morseAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const ctx = _morseAudioCtx;
  const DOT = 0.08, DASH = 0.24, GAP = 0.08, LETTER_GAP = 0.24, WORD_GAP = 0.56;
  let time = ctx.currentTime + 0.1;

  for (const ch of morse) {
    if (ch === '·') {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 700; gain.gain.value = 0.3;
      osc.start(time); osc.stop(time + DOT);
      time += DOT + GAP;
    } else if (ch === '−') {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 700; gain.gain.value = 0.3;
      osc.start(time); osc.stop(time + DASH);
      time += DASH + GAP;
    } else if (ch === '/') {
      time += WORD_GAP;
    } else if (ch === ' ') {
      time += LETTER_GAP;
    }
  }
}

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
