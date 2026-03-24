/* ═══ Bunker OS — Main Entry Point (ES Module) ═══ */
/* "The Answer to the Ultimate Question of Life, the Universe, and Everything is 42" */

// ─── Core module imports ────────────────────────────────────────────────────
import {
  state, storage, genId, escapeHtml,
  guidesCache, guidesIndex, protocolsIndex, gamesIndex, searchIndex,
  setGuidesIndex, setProtocolsIndex, setGamesIndex, setSearchIndex,
  LOADING_PHRASES,
  loadPersistedData, saveChats, saveFavorites,
} from './state.js';

import { markdownToHtml, copyCode } from './markdown.js';

import {
  OS_APPS, _windows, openApp, closeWindow,
  minimizeWindow, unminimizeWindow, maximizeWindow,
  focusWindow, startDrag, startResize,
  renderTaskbar, renderDesktopIcons,
  toggleStartMenu, closeStartMenu, filterStartMenu, openFirstVisibleApp,
  runShutdownSequence, startTaskbarClock,
  closeContextMenu, closeAllWindows, tileWindows,
  restoreSession, applyWallpaper, cycleWallpaper,
  osToast, closeParentWindow, openSavedApp,
  openSpotlight, closeSpotlight,
  openShortcuts, closeShortcuts,
  registerAppOpen, registerAppClose,
  initWindowManagerEvents,
} from './windowManager.js';

import {
  renderChatList, switchChat, restoreChat,
  newChat, deleteChat, clearAllData,
  renderFavorites, addFavorite, removeFavorite, isFavorited,
  autoResize, handleKey, setInput, updateModeTag,
  renderQueue, removeFromQueue, send,
  streamFromAPI, addMsgDom, addStreamMsgDom, addMsgActions,
  scrollChat, getWelcomeHtml,
  showView, showChatView, showGuideView,
  AI_MODES, getActiveMode, setAIMode, renderModeSelector, initModeSelector,
} from './chat.js';

import {
  initCompanion, companionSend, resizeCompanion, destroyCompanion,
} from './companion.js';

// ─── Expose everything to window for onclick handlers ───────────────────────
// This is the bridge between ES modules and inline HTML onclick attributes.
// As we incrementally refactor HTML to use addEventListener, these can be removed.
const globals = {
  // State
  state, storage, genId, escapeHtml,
  guidesCache, get guidesIndex() { return guidesIndex; },
  get protocolsIndex() { return protocolsIndex; },
  get gamesIndex() { return gamesIndex; },
  get searchIndex() { return searchIndex; },
  setGuidesIndex, setProtocolsIndex, setGamesIndex, setSearchIndex,
  LOADING_PHRASES,
  loadPersistedData, saveChats, saveFavorites,

  // Markdown
  markdownToHtml, copyCode,

  // Window Manager
  OS_APPS, _windows, openApp, closeWindow,
  minimizeWindow, unminimizeWindow, maximizeWindow,
  focusWindow, startDrag, startResize,
  renderTaskbar, renderDesktopIcons,
  toggleStartMenu, closeStartMenu, filterStartMenu, openFirstVisibleApp,
  runShutdownSequence, startTaskbarClock,
  closeContextMenu, closeAllWindows, tileWindows,
  restoreSession, applyWallpaper, cycleWallpaper,
  osToast, closeParentWindow, openSavedApp,
  openSpotlight, closeSpotlight,
  openShortcuts, closeShortcuts,

  // Chat
  renderChatList, switchChat, restoreChat,
  newChat, deleteChat, clearAllData,
  renderFavorites, addFavorite, removeFavorite, isFavorited,
  autoResize, handleKey, setInput, updateModeTag,
  renderQueue, removeFromQueue, send,
  streamFromAPI, addMsgDom, addStreamMsgDom, addMsgActions,
  scrollChat, getWelcomeHtml,
  showView, showChatView, showGuideView,

  // 3D Companion
  initCompanion, companionSend, resizeCompanion, destroyCompanion,

  // AI Modes
  AI_MODES, getActiveMode, setAIMode, renderModeSelector, initModeSelector,
};

Object.entries(globals).forEach(([key, val]) => {
  if (typeof val === 'function' || typeof val !== 'object') {
    window[key] = val;
  }
});

// Proxy getters for live module variables
Object.defineProperty(window, 'guidesIndex', { get: () => guidesIndex, configurable: true });
Object.defineProperty(window, 'protocolsIndex', { get: () => protocolsIndex, configurable: true });
Object.defineProperty(window, 'gamesIndex', { get: () => gamesIndex, configurable: true });
Object.defineProperty(window, 'searchIndex', { get: () => searchIndex, configurable: true });

// Also expose state and storage as globals (widely used)
window.state = state;
window.storage = storage;
window.OS_APPS = OS_APPS;
window.AI_MODES = AI_MODES;
window._windows = _windows;
window.LOADING_PHRASES = LOADING_PHRASES;
window.guidesCache = guidesCache;

// ─── Init: load apps.js then boot ───────────────────────────────────────────
// apps.js contains all app-specific code that hasn't been extracted into ES modules yet.
// It's loaded dynamically AFTER globals are set up on window.

function loadAppsScript() {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = './js/apps.js?v=' + Date.now();
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load apps.js'));
    document.head.appendChild(s);
  });
}

async function boot() {
  // 1. Load persisted data
  loadPersistedData();

  // 2. Load apps.js (needs window globals to be set first)
  await loadAppsScript();

  // 3. Wire app open/close callbacks from apps.js into window manager
  wireAppCallbacks();

  // 4. Init window manager events
  initWindowManagerEvents();

  // 5. Init remaining systems
  window.loadCharacters?.();
  window.checkHealth?.();
  window.trayInit?.();
  autoResize();
  window.setupDragDrop?.();
  renderChatList();
  renderFavorites();
  initModeSelector();
  window.renderSidebarCharacters?.();

  // Load sidebar apps list
  fetch("/api/build/list").then(r => r.json()).then(d => window.renderSidebarApps?.(d.apps || [])).catch(() => {});

  // Load content indexes
  window.loadGuidesIndex?.();
  window.loadProtocolsIndex?.();
  window.loadGamesIndex?.();
  window.initSearch?.();

  // Boot sequence
  window.runBootSequence?.();
}

function wireAppCallbacks() {
  // Register app-open triggers
  const openMap = {
    supplies:   () => window.loadSupplies?.(),
    books:      () => window.loadBooks?.(),
    guides:     () => window.loadGuidesIndex?.(),
    protocols:  () => window.loadProtocolsIndex?.(),
    games:      () => window.renderGamesGrid?.(),
    wiki:       () => window._wikiInit?.(),
    journal:    () => window._journalInit?.(),
    tts:        () => window._ttsInit?.(),
    builder:    () => window._builderInit?.(),
    characters: () => window.renderCharactersList?.(),
    map:        () => window._mapInit?.(),
    chat:       () => restoreChat(),
    notepad:    () => window.notepadInit?.(),
    word:       () => window.wordInit?.(),
    excel:      () => window.excelInit?.(),
    sysmon:     () => window.sysmonInit?.(),
    calc:       () => window.calcInit?.(),
    timer:      () => window.timerInit?.(),
    converter:  () => window.converterInit?.(),
    checklist:  () => window.checklistInit?.(),
    morse:      () => window.morseInit?.(),
    phonetic:   () => window.phoneticInit?.(),
    sun:        () => window.sunCalcInit?.(),
    waterCalc:  () => window.waterCalcCompute?.(),
    media:      () => window.mediaInit?.(),
    tasks:      () => window.tasksInit?.(),
    fileManager: () => window.fileManagerInit?.(),
    paint:      () => window.paintInit?.(),
    imagine:    () => window.imagineInit?.(),
    survRef:    () => window.survRefInit?.(),
    modelMgr:   () => window.modelMgrInit?.(),
    companion:  () => initCompanion(),
    weather:    () => window.weatherInit?.(),
    pendrive:   () => window.pendriveInit?.(),
    firstaid:   () => window.firstaidInit?.(),
    crypto:     () => window.cryptoInit?.(),
  };
  Object.entries(openMap).forEach(([appId, fn]) => registerAppOpen(appId, fn));

  // Register close-cleanup callbacks
  registerAppClose('notepad', () => {
    if (window._notepadDirty && window._notepadActiveId) { window.notepadSave?.(); osToast('\u{1F4DD} Nota salva automaticamente'); }
  });
  registerAppClose('word', () => {
    if (window._wordDirty && window._wordActiveId) { window.wordSave?.(); osToast('\u{1F4C4} Documento salvo automaticamente'); }
  });
  registerAppClose('excel', () => {
    if (window._excelDirty && window._excelActiveId) { window.excelSave?.(); osToast('\u{1F4CA} Planilha salva automaticamente'); }
  });
  registerAppClose('checklist', () => {
    if (window._checklistDirty && window._checklistActiveId) { window.checklistSave?.(); osToast('\u2705 Checklist salva automaticamente'); }
  });
  registerAppClose('journal', () => {
    if (window._clockInterval) { clearInterval(window._clockInterval); window._clockInterval = null; }
  });
  registerAppClose('wiki', () => {
    const frame = document.getElementById('wikiFrame');
    if (frame) frame.src = 'about:blank';
  });
  registerAppClose('sysmon', () => {
    if (window._sysmonInterval) { clearInterval(window._sysmonInterval); window._sysmonInterval = null; }
  });
  registerAppClose('timer', () => {
    if (window._timerInterval) { clearInterval(window._timerInterval); window._timerInterval = null; }
  });
  registerAppClose('gamePlay', () => {
    const frame = document.getElementById('gameFrame');
    if (frame) frame.src = 'about:blank';
  });
  registerAppClose('companion', () => {
    destroyCompanion();
  });
  registerAppClose('firstaid', () => {
    window.firstaidCprClose?.();
  });
}

// Global helper for companion chat input
window.companionSendMsg = function(text) {
  const input = document.getElementById('companionInput');
  const msg = text || (input && input.value.trim()) || '';
  if (msg) {
    companionSend(msg);
    if (input) input.value = '';
  }
};

// ─── Init ───────────────────────────────────────────────────────────────────
// ES modules are deferred, so DOM is already parsed when this runs.
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
