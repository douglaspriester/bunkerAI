/* ═══ Bunker OS — Desktop Window Manager ═══ */

import { state, storage, escapeHtml } from './state.js';

// ─── App Registry ───────────────────────────────────────────────────────────
export const OS_APPS = [
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
  { id: 'morse',      name: 'Codigo Morse', icon: '\u{1F4E1}', width: 520, height: 500, viewId: 'morseView' },
  { id: 'radio',      name: 'Frequencias',  icon: '\u{1F4FB}', width: 480, height: 500, viewId: 'radioView' },
  { id: 'phonetic',   name: 'Fonetico NATO', icon: '\u{1F399}\uFE0F', width: 420, height: 480, viewId: 'phoneticView' },
  { id: 'sun',        name: 'Sol / Lua',     icon: '\u2600\uFE0F', width: 400, height: 460, viewId: 'sunView' },
  { id: 'waterCalc',  name: 'Agua Segura',   icon: '\u{1F4A7}', width: 420, height: 500, viewId: 'waterCalcView' },
  { id: 'media',      name: 'Media Player', icon: '\u{1F3B5}', width: 640, height: 480, viewId: 'mediaView' },
  { id: 'tasks',      name: 'Tarefas',       icon: '\u{1F4CC}', width: 600, height: 520, viewId: 'tasksView' },
  { id: 'fileManager', name: 'Arquivos',    icon: '\u{1F4C1}', width: 720, height: 500, viewId: 'fileManagerView' },
  { id: 'paint',      name: 'Paint',        icon: '\u{1F3A8}', width: 780, height: 560, viewId: 'paintView' },
  { id: 'imagine',    name: 'Gerador IA',   icon: '\u{1F5BC}\uFE0F', width: 640, height: 520, viewId: 'imagineView' },
  { id: 'survRef',    name: 'Refer\u00EAncia', icon: '\u{1F4D6}', width: 650, height: 520, viewId: 'survRefView' },
  { id: 'modelMgr',  name: 'Modelos IA', icon: '\u{1F9E0}', width: 600, height: 520, viewId: 'modelMgrView' },
  { id: 'companion', name: 'Companheiro', icon: '\u{1F9D1}\u200D\u{1F680}', width: 480, height: 620, viewId: 'companionView' },
  { id: 'rag',       name: 'RAG Local',  icon: '\u{1F4DA}', width: 680, height: 560, viewId: 'ragView' },
  { id: 'settings',   name: 'Configura\u00E7\u00F5es', icon: '\u2699\uFE0F', width: 560, height: 520, viewId: null },
];

// ─── Window state ───────────────────────────────────────────────────────────
export let _windows = {};
export let _topZ = 100;
export let _activeWindowId = null;
export let _cascadeOffset = 0;
let _taskbarClockInterval = null;

// App-open callbacks registry — populated by main.js
const _appOpenCallbacks = {};
export function registerAppOpen(appId, fn) { _appOpenCallbacks[appId] = fn; }

// Close-cleanup callbacks — populated by main.js
const _appCloseCallbacks = {};
export function registerAppClose(appId, fn) { _appCloseCallbacks[appId] = fn; }

// ─── Open App ───────────────────────────────────────────────────────────────
export function openApp(appId) {
  if (appId === 'settings') {
    window.toggleConfig?.();
    closeStartMenu();
    return;
  }

  const app = OS_APPS.find(a => a.id === appId);
  if (!app) return;

  const existing = Object.values(_windows).find(w => w.appId === appId);
  if (existing) {
    if (existing.minimized) unminimizeWindow(existing.winId);
    focusWindow(existing.winId);
    closeStartMenu();
    return;
  }

  const winId = 'win_' + appId + '_' + Date.now().toString(36);
  const maxW = window.innerWidth;
  const maxH = window.innerHeight - 48;
  const w = Math.min(app.width, maxW - 40);
  const h = Math.min(app.height, maxH - 40);
  const baseX = Math.max(20, (maxW - w) / 2 - 80);
  const baseY = Math.max(10, (maxH - h) / 2 - 80);
  const x = baseX + (_cascadeOffset % 8) * 30;
  const y = baseY + (_cascadeOffset % 8) * 30;
  _cascadeOffset++;

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

  winEl.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.os-win-btn')) focusWindow(winId);
  });

  document.getElementById('windowsContainer').appendChild(winEl);

  const body = document.getElementById(winId + '_body');
  if (app.viewId) {
    const viewEl = document.getElementById(app.viewId);
    if (viewEl) {
      viewEl.classList.remove('hidden');
      body.appendChild(viewEl);
    }
  }

  _windows[winId] = {
    winId, appId, element: winEl, minimized: false, maximized: false,
    zIndex: _topZ, x, y, w, h, prevRect: null
  };
  _activeWindowId = winId;

  // Trigger app-specific init
  if (_appOpenCallbacks[appId]) _appOpenCallbacks[appId]();

  renderTaskbar();
  focusWindow(winId);
  closeStartMenu();

  winEl.classList.add('os-window-opening');
  setTimeout(() => winEl.classList.remove('os-window-opening'), 300);
}

// ─── Close Window ───────────────────────────────────────────────────────────
export function closeWindow(winId) {
  const win = _windows[winId];
  if (!win) return;

  const app = OS_APPS.find(a => a.id === win.appId);

  // Move view content back
  if (app?.viewId) {
    const viewEl = document.getElementById(app.viewId);
    if (viewEl) {
      viewEl.classList.add('hidden');
      document.getElementById('mainArea').appendChild(viewEl);
    }
  }

  // App-specific cleanup
  if (_appCloseCallbacks[win.appId]) _appCloseCallbacks[win.appId](win);

  win.element.remove();
  delete _windows[winId];

  if (_activeWindowId === winId) {
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

// ─── Minimize ───────────────────────────────────────────────────────────────
export function minimizeWindow(winId) {
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

export function unminimizeWindow(winId) {
  const win = _windows[winId];
  if (!win) return;
  win.minimized = false;
  win.element.classList.remove('os-window-minimized');
  focusWindow(winId);
  renderTaskbar();
}

// ─── Maximize ───────────────────────────────────────────────────────────────
export function maximizeWindow(winId) {
  const win = _windows[winId];
  if (!win) return;

  if (win.maximized) {
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
    win.prevRect = { x: win.x, y: win.y, w: win.w, h: win.h };
    win.maximized = true;
    win.element.classList.add('os-window-maximized');
    win.element.style.left = '0px';
    win.element.style.top = '0px';
    win.element.style.width = '100%';
    win.element.style.height = 'calc(100vh - 48px)';
  }

  if (win.appId === 'map' && window.mapState?.leafletMap) {
    setTimeout(() => window.mapState.leafletMap.invalidateSize(), 100);
  }
  focusWindow(winId);
}

// ─── Focus ──────────────────────────────────────────────────────────────────
export function focusWindow(winId) {
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

// ─── Drag ───────────────────────────────────────────────────────────────────
export function startDrag(winId, e) {
  if (e.target.closest('.os-win-btn')) return;
  const win = _windows[winId];
  if (!win || win.maximized) return;

  focusWindow(winId);
  e.preventDefault();

  const startX = e.clientX;
  const startY = e.clientY;
  const origX = win.x;
  const origY = win.y;
  const origW = win.w, origH = win.h;

  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    win.x = origX + dx;
    win.y = Math.max(0, origY + dy);
    win.element.style.left = win.x + 'px';
    win.element.style.top = win.y + 'px';
    win.element.classList.toggle('snap-left', ev.clientX <= 6);
    win.element.classList.toggle('snap-right', ev.clientX >= window.innerWidth - 6);
  }
  function onUp(ev) {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    win.element.classList.remove('snap-left', 'snap-right');
    const tbH = 48;
    if (ev.clientX <= 6) {
      win.prevRect = { x: origX, y: origY, w: origW, h: origH };
      win.x = 0; win.y = 0;
      win.w = Math.floor(window.innerWidth / 2);
      win.h = window.innerHeight - tbH;
      Object.assign(win.element.style, { left:'0', top:'0', width:win.w+'px', height:win.h+'px' });
    } else if (ev.clientY <= 2 && !win.maximized) {
      win.prevRect = { x: origX, y: origY, w: origW, h: origH };
      maximizeWindow(winId);
    } else if (ev.clientX >= window.innerWidth - 6) {
      win.prevRect = { x: origX, y: origY, w: origW, h: origH };
      win.w = Math.floor(window.innerWidth / 2);
      win.x = window.innerWidth - win.w;
      win.y = 0;
      win.h = window.innerHeight - tbH;
      Object.assign(win.element.style, { left:win.x+'px', top:'0', width:win.w+'px', height:win.h+'px' });
    }
    if (win.appId === 'map' && window.mapState?.leafletMap) setTimeout(() => window.mapState.leafletMap.invalidateSize(), 50);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ─── Resize ─────────────────────────────────────────────────────────────────
export function startResize(winId, e) {
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
    win.w = Math.max(320, origW + ev.clientX - startX);
    win.h = Math.max(200, origH + ev.clientY - startY);
    win.element.style.width = win.w + 'px';
    win.element.style.height = win.h + 'px';
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (win.appId === 'map' && window.mapState?.leafletMap) {
      setTimeout(() => window.mapState.leafletMap.invalidateSize(), 50);
    }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ─── Taskbar ────────────────────────────────────────────────────────────────
export function renderTaskbar() {
  const container = document.getElementById('taskbarApps');
  if (!container) return;
  debounceSaveSession();

  container.innerHTML = '';
  const openWindows = Object.values(_windows);
  for (const win of openWindows) {
    const app = OS_APPS.find(a => a.id === win.appId);
    const appInfo = app || { icon: '\u{1F5A5}\uFE0F', name: win.element?.querySelector('.os-window-title')?.textContent || 'App' };
    const btn = document.createElement('button');
    btn.className = 'taskbar-app-btn' +
      (win.winId === _activeWindowId && !win.minimized ? ' taskbar-app-active' : '') +
      (win.minimized ? ' taskbar-app-minimized' : '');
    btn.innerHTML = `<span class="taskbar-app-icon">${appInfo.icon}</span><span class="taskbar-app-name">${appInfo.name}</span>`;
    btn.onclick = () => {
      if (win.minimized) unminimizeWindow(win.winId);
      else if (win.winId === _activeWindowId) minimizeWindow(win.winId);
      else focusWindow(win.winId);
    };
    container.appendChild(btn);
  }
}

// ─── Desktop Icons (with drag-and-drop reorder) ─────────────────────────────
let _draggedIcon = null;

function getIconOrder() {
  try {
    const saved = localStorage.getItem('bunker_icon_order');
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function saveIconOrder() {
  const container = document.getElementById('desktopIcons');
  if (!container) return;
  const order = [...container.children].map(el => el.dataset.appId).filter(Boolean);
  try { localStorage.setItem('bunker_icon_order', JSON.stringify(order)); } catch {}
}

export function renderDesktopIcons() {
  const container = document.getElementById('desktopIcons');
  if (!container) return;
  container.innerHTML = '';

  // Get apps in saved order, with new apps appended at end
  const savedOrder = getIconOrder();
  let visibleApps = OS_APPS.filter(a => !a.hidden);
  if (savedOrder) {
    const ordered = [];
    const remaining = [...visibleApps];
    for (const id of savedOrder) {
      const idx = remaining.findIndex(a => a.id === id);
      if (idx !== -1) { ordered.push(remaining.splice(idx, 1)[0]); }
    }
    visibleApps = [...ordered, ...remaining];
  }

  for (const app of visibleApps) {
    const icon = document.createElement('div');
    icon.className = 'desktop-icon';
    icon.dataset.appId = app.id;
    icon.draggable = true;
    icon.innerHTML = `
      <div class="desktop-icon-img">${app.icon}</div>
      <div class="desktop-icon-label">${app.name}</div>
    `;
    icon.ondblclick = () => {
      icon.classList.add('opening');
      setTimeout(() => icon.classList.remove('opening'), 600);
      openApp(app.id);
    };
    icon.onclick = () => {
      document.querySelectorAll('.desktop-icon.selected').forEach(el => el.classList.remove('selected'));
      icon.classList.add('selected');
    };

    // Drag-and-drop reordering
    icon.addEventListener('dragstart', (e) => {
      _draggedIcon = icon;
      icon.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', app.id);
    });
    icon.addEventListener('dragend', () => {
      icon.classList.remove('dragging');
      _draggedIcon = null;
      container.querySelectorAll('.desktop-icon.drag-over').forEach(el => el.classList.remove('drag-over'));
      saveIconOrder();
    });
    icon.addEventListener('dragover', (e) => {
      if (!_draggedIcon || _draggedIcon === icon) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      icon.classList.add('drag-over');
    });
    icon.addEventListener('dragleave', () => {
      icon.classList.remove('drag-over');
    });
    icon.addEventListener('drop', (e) => {
      e.preventDefault();
      icon.classList.remove('drag-over');
      if (!_draggedIcon || _draggedIcon === icon) return;
      const allIcons = [...container.children];
      const fromIdx = allIcons.indexOf(_draggedIcon);
      const toIdx = allIcons.indexOf(icon);
      if (fromIdx < toIdx) {
        container.insertBefore(_draggedIcon, icon.nextSibling);
      } else {
        container.insertBefore(_draggedIcon, icon);
      }
    });

    container.appendChild(icon);
  }
}

// ─── Start Menu ─────────────────────────────────────────────────────────────
export function toggleStartMenu() {
  const menu = document.getElementById('startMenu');
  if (!menu) return;
  menu.classList.toggle('hidden');
  if (!menu.classList.contains('hidden')) renderStartMenu();
}

export function closeStartMenu() {
  const menu = document.getElementById('startMenu');
  if (menu) menu.classList.add('hidden');
}

function renderStartMenu() {
  const container = document.getElementById('startMenuApps');
  if (!container) return;
  container.innerHTML = '';
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
  const sep = document.createElement('div');
  sep.className = 'start-menu-sep';
  container.appendChild(sep);
  const restart = document.createElement('div');
  restart.className = 'start-menu-item start-menu-power';
  restart.innerHTML = '<span class="start-menu-item-icon">\u{1F504}</span><span>Reiniciar</span>';
  restart.onclick = () => location.reload();
  container.appendChild(restart);
  const shutdown = document.createElement('div');
  shutdown.className = 'start-menu-item start-menu-power';
  shutdown.innerHTML = '<span class="start-menu-item-icon">\u23FB</span><span>Desligar</span>';
  shutdown.onclick = () => { closeStartMenu(); runShutdownSequence(); };
  container.appendChild(shutdown);
  setTimeout(() => { const sb = document.getElementById('startMenuSearch'); if (sb) sb.focus(); }, 50);
}

export function filterStartMenu(query) {
  const items = document.querySelectorAll('#startMenuApps .start-menu-item');
  const q = query.toLowerCase().trim();
  items.forEach(item => {
    const name = item.dataset.name || '';
    item.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
}

export function openFirstVisibleApp() {
  const items = document.querySelectorAll('#startMenuApps .start-menu-item');
  for (const item of items) {
    if (item.style.display !== 'none' && item.dataset.name) { item.click(); return; }
  }
}

// ─── Shutdown ───────────────────────────────────────────────────────────────
export function runShutdownSequence() {
  closeAllWindows();
  const overlay = document.createElement('div');
  overlay.className = 'shutdown-overlay';
  overlay.innerHTML = `<div class="shutdown-msg">Desligando...</div><div class="shutdown-sub">Salvando dados e finalizando processos.</div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));
  setTimeout(() => {
    overlay.innerHTML = '<div class="shutdown-msg">Bunker OS desligado.</div><div class="shutdown-sub" style="margin-top:12px;font-size:13px;opacity:.5">Clique para reiniciar</div>';
    overlay.onclick = () => location.reload();
  }, 2500);
}

// ─── Clock ──────────────────────────────────────────────────────────────────
function updateTaskbarClock() {
  const el = document.getElementById('taskbarClock');
  if (!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  el.textContent = hh + ':' + mm + ':' + ss;
  const day = String(now.getDate()).padStart(2, '0');
  const mon = String(now.getMonth() + 1).padStart(2, '0');
  el.title = `${day}/${mon}/${now.getFullYear()} ${hh}:${mm}:${ss}`;
}

export function startTaskbarClock() {
  updateTaskbarClock();
  _taskbarClockInterval = setInterval(updateTaskbarClock, 1000);
}

// ─── Context Menu ───────────────────────────────────────────────────────────
export function closeContextMenu() {
  document.querySelectorAll('.os-context-menu').forEach(m => m.remove());
}

export function closeAllWindows() {
  Object.keys(_windows).forEach(winId => closeWindow(winId));
}

export function tileWindows() {
  const wins = Object.values(_windows).filter(w => !w.minimized);
  if (!wins.length) return;
  const maxW = window.innerWidth;
  const maxH = window.innerHeight - 48;
  const count = wins.length;
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
    Object.assign(win.element.style, { left: win.x+'px', top: win.y+'px', width: win.w+'px', height: win.h+'px' });
    if (win.appId === 'map' && window.mapState?.leafletMap) {
      setTimeout(() => window.mapState.leafletMap.invalidateSize(), 100);
    }
  });
}

// ─── Session Save / Restore ─────────────────────────────────────────────────
function saveSession() {
  const openApps = Object.values(_windows)
    .filter(w => w.appId && !w.appId.startsWith('_'))
    .map(w => w.appId);
  storage.set('bunker_session', JSON.stringify(openApps));
}

export function restoreSession() {
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
  // Default: show desktop only (no apps auto-opened on first boot)
}

let _sessionSaveTimeout = null;
function debounceSaveSession() {
  clearTimeout(_sessionSaveTimeout);
  _sessionSaveTimeout = setTimeout(saveSession, 1000);
}

// ─── Wallpaper ──────────────────────────────────────────────────────────────
const WALLPAPERS = ['default', 'starfield', 'grid', 'aurora', 'matrix'];
let _wallpaperIdx = parseInt(storage.get('bunker_wallpaper') || '0') || 0;

export function cycleWallpaper() {
  _wallpaperIdx = (_wallpaperIdx + 1) % WALLPAPERS.length;
  storage.set('bunker_wallpaper', String(_wallpaperIdx));
  applyWallpaper();
}

export function applyWallpaper() {
  const desktop = document.getElementById('desktop');
  if (!desktop) return;
  WALLPAPERS.forEach(w => desktop.classList.remove('wp-' + w));
  desktop.classList.add('wp-' + WALLPAPERS[_wallpaperIdx]);
  const names = { default: 'Escuro', starfield: 'Estrelas', grid: 'Grade', aurora: 'Aurora', matrix: 'Matrix' };
  osToast('\u{1F3A8} Wallpaper: ' + (names[WALLPAPERS[_wallpaperIdx]] || WALLPAPERS[_wallpaperIdx]));
}

// ─── Toast Notifications ────────────────────────────────────────────────────
export function osToast(msg, duration = 2500, variant = '') {
  let container = document.getElementById('osToasts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'osToasts';
    container.className = 'os-toasts';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'os-toast' + (variant ? ' toast-' + variant : '');
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Spotlight / Command Palette ─────────────────────────────────────────────
let _spotlightActive = -1;

export function openSpotlight() {
  const overlay = document.getElementById('spotlightOverlay');
  const input = document.getElementById('spotlightInput');
  if (!overlay || !input) return;
  overlay.classList.remove('hidden');
  input.value = '';
  _spotlightActive = -1;
  renderSpotlightResults('');
  setTimeout(() => input.focus(), 50);
}

export function closeSpotlight() {
  const overlay = document.getElementById('spotlightOverlay');
  if (overlay) overlay.classList.add('hidden');
}

function renderSpotlightResults(query) {
  const container = document.getElementById('spotlightResults');
  if (!container) return;

  const q = query.trim().toLowerCase();
  let html = '';

  // Search apps
  const apps = OS_APPS.filter(a => !a.hidden &&
    (a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q))
  );

  if (!q) {
    // Show all apps grouped
    html += '<div class="spotlight-section">Apps</div>';
    for (const app of OS_APPS.filter(a => !a.hidden)) {
      const running = Object.values(_windows).some(w => w.appId === app.id);
      html += `<div class="spotlight-item" data-action="app:${app.id}">
        <span class="spotlight-item-icon">${app.icon}</span>
        <div class="spotlight-item-text">
          <div class="spotlight-item-title">${app.name}</div>
        </div>
        ${running ? '<span class="spotlight-item-badge">aberto</span>' : ''}
      </div>`;
    }
  } else {
    // Show matching apps
    if (apps.length) {
      html += '<div class="spotlight-section">Apps</div>';
      for (const app of apps) {
        const running = Object.values(_windows).some(w => w.appId === app.id);
        html += `<div class="spotlight-item" data-action="app:${app.id}">
          <span class="spotlight-item-icon">${app.icon}</span>
          <div class="spotlight-item-text">
            <div class="spotlight-item-title">${app.name}</div>
          </div>
          ${running ? '<span class="spotlight-item-badge">aberto</span>' : ''}
        </div>`;
      }
    }

    // Search content (guides, protocols, games) via MiniSearch
    const si = window.searchIndex;
    if (si) {
      const results = si.search(q).slice(0, 8);
      if (results.length) {
        const typeLabel = { guide: 'Guia', protocol: 'Protocolo', game: 'Jogo' };
        const typeIcon = { guide: '\u{1F4CB}', protocol: '\u{1F6A8}', game: '\u{1F3AE}' };
        html += '<div class="spotlight-section">Conteudo</div>';
        for (const r of results) {
          html += `<div class="spotlight-item" data-action="content:${r.type}:${escapeHtml(r._id || r.id)}">
            <span class="spotlight-item-icon">${typeIcon[r.type] || '\u{1F4C4}'}</span>
            <div class="spotlight-item-text">
              <div class="spotlight-item-title">${escapeHtml(r.title)}</div>
              <div class="spotlight-item-sub">${typeLabel[r.type] || r.type}</div>
            </div>
          </div>`;
        }
      }
    }

    // Quick actions
    const actions = [
      { label: 'Organizar janelas', icon: '\u{1F4D0}', action: 'cmd:tile' },
      { label: 'Fechar todas as janelas', icon: '\u274C', action: 'cmd:closeAll' },
      { label: 'Trocar wallpaper', icon: '\u{1F3A8}', action: 'cmd:wallpaper' },
      { label: 'Reiniciar Bunker OS', icon: '\u{1F504}', action: 'cmd:restart' },
    ].filter(a => a.label.toLowerCase().includes(q));
    if (actions.length) {
      html += '<div class="spotlight-section">Acoes</div>';
      for (const a of actions) {
        html += `<div class="spotlight-item" data-action="${a.action}">
          <span class="spotlight-item-icon">${a.icon}</span>
          <div class="spotlight-item-text">
            <div class="spotlight-item-title">${a.label}</div>
          </div>
          <span class="spotlight-item-badge">acao</span>
        </div>`;
      }
    }

    if (!html) {
      html = '<div class="spotlight-empty">Nenhum resultado para "' + escapeHtml(q) + '"</div>';
    }
  }

  container.innerHTML = html;
  _spotlightActive = -1;

  // Attach click handlers
  container.querySelectorAll('.spotlight-item').forEach((el, i) => {
    el.addEventListener('click', () => executeSpotlightItem(el));
    el.addEventListener('mouseenter', () => {
      container.querySelectorAll('.spotlight-item.active').forEach(e => e.classList.remove('active'));
      el.classList.add('active');
      _spotlightActive = i;
    });
  });
}

function navigateSpotlight(dir) {
  const items = document.querySelectorAll('#spotlightResults .spotlight-item');
  if (!items.length) return;
  items.forEach(el => el.classList.remove('active'));
  _spotlightActive += dir;
  if (_spotlightActive < 0) _spotlightActive = items.length - 1;
  if (_spotlightActive >= items.length) _spotlightActive = 0;
  items[_spotlightActive].classList.add('active');
  items[_spotlightActive].scrollIntoView({ block: 'nearest' });
}

function executeSpotlightItem(el) {
  const action = el?.dataset?.action;
  if (!action) return;
  closeSpotlight();

  if (action.startsWith('app:')) {
    openApp(action.slice(4));
  } else if (action.startsWith('content:')) {
    const [, type, id] = action.split(':');
    window.openSearchResult?.(type, id);
  } else if (action === 'cmd:tile') {
    tileWindows();
  } else if (action === 'cmd:closeAll') {
    closeAllWindows();
  } else if (action === 'cmd:wallpaper') {
    cycleWallpaper();
  } else if (action === 'cmd:restart') {
    location.reload();
  }
}

// ─── Keyboard Shortcuts Help ─────────────────────────────────────────────────
export function openShortcuts() {
  const overlay = document.getElementById('shortcutsOverlay');
  if (overlay) overlay.classList.remove('hidden');
}

export function closeShortcuts() {
  const overlay = document.getElementById('shortcutsOverlay');
  if (overlay) overlay.classList.add('hidden');
}

// ─── Close parent window from a "back" button ──────────────────────────────
export function closeParentWindow(viewId) {
  const app = OS_APPS.find(a => a.viewId === viewId);
  if (app) {
    const win = Object.values(_windows).find(w => w.appId === app.id);
    if (win) { closeWindow(win.winId); return; }
  }
  openApp('chat');
}

// ─── Open saved app in OS window ────────────────────────────────────────────
export function openSavedApp(name) {
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
      <span class="os-window-icon">\u{1F5A5}\uFE0F</span>
      <span class="os-window-title">${escapeHtml(name)}</span>
      <div class="os-window-controls">
        <button class="os-win-btn os-win-min" onclick="minimizeWindow('${winId}')">&minus;</button>
        <button class="os-win-btn os-win-max" onclick="maximizeWindow('${winId}')">&#9744;</button>
        <button class="os-win-btn os-win-close" onclick="closeWindow('${winId}')">&times;</button>
      </div>
    </div>
    <div class="os-window-body" style="padding:0">
      <iframe src="/api/build/preview/${encodeURIComponent(name)}" sandbox="allow-scripts" style="width:100%;height:100%;border:none;background:#fff;border-radius:0 0 var(--radius-lg) var(--radius-lg)"></iframe>
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

// ─── Event listeners ────────────────────────────────────────────────────────
export function initWindowManagerEvents() {
  // Click outside start menu
  document.addEventListener('mousedown', (e) => {
    const menu = document.getElementById('startMenu');
    if (menu && !menu.classList.contains('hidden')) {
      if (!e.target.closest('.start-menu') && !e.target.closest('.taskbar-start')) closeStartMenu();
    }
  });

  // Click on desktop to deselect icons
  document.addEventListener('click', (e) => {
    if (e.target.closest('.desktop-icons') && !e.target.closest('.desktop-icon')) {
      document.querySelectorAll('.desktop-icon.selected').forEach(el => el.classList.remove('selected'));
    }
  });

  // Desktop context menu
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('.os-desktop') || e.target.closest('.os-window') || e.target.closest('.taskbar') || e.target.closest('.start-menu')) return;
    e.preventDefault();
    closeContextMenu();
    const iconEl = e.target.closest('.desktop-icon');
    const menu = document.createElement('div');
    menu.className = 'os-context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    if (iconEl) {
      const appId = iconEl.dataset.appId;
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
        <div class="ctx-item" onclick="openApp('chat'); closeContextMenu()">\u{1F916} Abrir Chat</div>
        <div class="ctx-item" onclick="openApp('notepad'); closeContextMenu()">\u{1F4DD} Novo Bloco de Notas</div>
        <div class="ctx-item" onclick="openApp('settings'); closeContextMenu()">\u2699\uFE0F Configura\u00E7\u00F5es</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" onclick="tileWindows(); closeContextMenu()">\u{1F4D0} Organizar janelas</div>
        <div class="ctx-item" onclick="closeAllWindows(); closeContextMenu()">Fechar todas as janelas</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" onclick="cycleWallpaper(); closeContextMenu()">\u{1F3A8} Trocar wallpaper</div>
        <div class="ctx-item" onclick="location.reload()">\u{1F504} Reiniciar Bunker OS</div>`;
    }
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 5) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 5) + 'px';
  });

  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.os-context-menu')) closeContextMenu();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const spotlightOpen = !document.getElementById('spotlightOverlay')?.classList.contains('hidden');
    const shortcutsOpen = !document.getElementById('shortcutsOverlay')?.classList.contains('hidden');

    // Spotlight-specific keys
    if (spotlightOpen) {
      if (e.key === 'Escape') { e.preventDefault(); closeSpotlight(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); navigateSpotlight(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); navigateSpotlight(-1); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const active = document.querySelector('#spotlightResults .spotlight-item.active');
        if (active) executeSpotlightItem(active);
        else {
          const first = document.querySelector('#spotlightResults .spotlight-item');
          if (first) executeSpotlightItem(first);
        }
        return;
      }
      return; // Don't process other shortcuts while spotlight is open
    }

    // Shortcuts overlay
    if (shortcutsOpen) {
      if (e.key === 'Escape') { e.preventDefault(); closeShortcuts(); return; }
      return;
    }

    // Ctrl+K — open spotlight
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); openSpotlight(); return; }

    // F1 — shortcuts help
    if (e.key === 'F1' && !e.ctrlKey && !e.altKey) { e.preventDefault(); openShortcuts(); return; }

    // Window management
    if (e.ctrlKey && e.key === 'w' && _activeWindowId) { e.preventDefault(); closeWindow(_activeWindowId); }
    if (e.ctrlKey && e.key === 'm' && _activeWindowId) { e.preventDefault(); minimizeWindow(_activeWindowId); }

    // Quick app launchers
    if (e.ctrlKey && e.shiftKey && e.key === 'N') { e.preventDefault(); openApp('notepad'); }
    if (e.ctrlKey && e.shiftKey && e.key === 'C') { e.preventDefault(); openApp('chat'); }
    if (e.ctrlKey && e.shiftKey && e.key === 'A') { e.preventDefault(); openApp('calc'); }

    if (e.key === 'F2' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const menu = document.getElementById('startMenu');
      if (menu && menu.classList.contains('hidden')) toggleStartMenu();
      setTimeout(() => { const sb = document.getElementById('startMenuSearch'); if (sb) sb.focus(); }, 100);
    }
    if (e.altKey && e.key === 'Tab') {
      e.preventDefault();
      const wins = Object.values(_windows).filter(w => !w.minimized);
      if (wins.length > 1) {
        wins.sort((a, b) => b.zIndex - a.zIndex);
        focusWindow(wins[wins.length - 1].winId);
      } else if (wins.length === 0) {
        const minimized = Object.values(_windows).filter(w => w.minimized);
        if (minimized.length) unminimizeWindow(minimized[minimized.length - 1].winId);
      }
    }
    if (e.key === 'Escape') {
      const menu = document.getElementById('startMenu');
      if (menu && !menu.classList.contains('hidden')) { closeStartMenu(); e.preventDefault(); }
      closeContextMenu();
    }
  });

  // Spotlight input handler
  const spotlightInput = document.getElementById('spotlightInput');
  if (spotlightInput) {
    spotlightInput.addEventListener('input', () => renderSpotlightResults(spotlightInput.value));
  }

  // Game close via postMessage
  window.addEventListener('message', (e) => {
    if (e.data === 'close-game') window.closeGame?.();
  });
}
