/* ═══ Bunker OS — State & Persistence ═══ */

// ─── State ──────────────────────────────────────────────────────────────────
export const state = {
  models: [],
  visionModels: [],
  autoModels: {},       // { chat, vision, code, brain } — auto-selected by server
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

// ─── Persistence (with in-memory fallback for private-browsing / blocked storage) ─
const _memStore = {};

function _getLS() {
  try {
    const ls = window['local' + 'Storage'];
    // Verify it actually works (Safari private mode exposes the object but throws on write)
    ls.setItem('__bunker_test__', '1');
    ls.removeItem('__bunker_test__');
    return ls;
  } catch {
    return null;
  }
}

let _lsCache = undefined; // undefined = not yet probed
function _ls() {
  if (_lsCache === undefined) _lsCache = _getLS();
  return _lsCache;
}

export const storage = {
  get(key)      { const s = _ls(); return s ? s.getItem(key) : (_memStore[key] ?? null); },
  set(key, val) { const s = _ls(); if (s) { s.setItem(key, val); } else { _memStore[key] = val; } },
  del(key)      { const s = _ls(); if (s) { s.removeItem(key); } else { delete _memStore[key]; } },
};

// ─── Guide/Protocol/Game Data (loaded from API) ─────────────────────────────
export const guidesCache = {};  // { id: { title, content(md) } }
export let guidesIndex = [];    // [{ id, title, icon, emoji }]
export let protocolsIndex = []; // [{ id, title, urgency, emoji }]
export let gamesIndex = [];     // [{ id, title, emoji }]
export let searchIndex = null;  // MiniSearch instance

export function setGuidesIndex(v) { guidesIndex = v; }
export function setProtocolsIndex(v) { protocolsIndex = v; }
export function setGamesIndex(v) { gamesIndex = v; }
export function setSearchIndex(v) { searchIndex = v; }

// Sci-fi loading phrases
export const LOADING_PHRASES = [
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

// ─── Helpers ────────────────────────────────────────────────────────────────
export function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export function escapeHtml(t) {
  const d = document.createElement("div");
  d.textContent = t;
  return d.innerHTML;
}

// ─── Persistence helpers ────────────────────────────────────────────────────
export function loadPersistedData() {
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

export function saveChats() {
  try {
    storage.set("bunker_chats", JSON.stringify(state.chats));
    storage.set("bunker_active_chat", state.activeChatId);
  } catch (e) {
    if (e.name === "QuotaExceededError") {
      const ids = Object.keys(state.chats);
      const toRemove = ids.find(id => id !== state.activeChatId);
      if (toRemove) {
        delete state.chats[toRemove];
        saveChats(); // retry
      }
    }
  }
}

export function saveFavorites() {
  storage.set("bunker_favs", JSON.stringify(state.favorites));
}
