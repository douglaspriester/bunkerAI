/* ═══ Bunker OS — Search & Utils ═══ */

// ─── Global aliases from window (set by main.js) ─────────────────────────────
const { state, storage, escapeHtml, markdownToHtml, guidesCache, LOADING_PHRASES,
        OS_APPS, _windows, openApp, closeWindow, focusWindow, osToast, openSavedApp,
        saveChats, saveFavorites, renderChatList, restoreChat, renderFavorites,
        addFavorite, removeFavorite, isFavorited, genId,
        renderDesktopIcons, startTaskbarClock, applyWallpaper, restoreSession,
        addMsgDom, addStreamMsgDom, addMsgActions, streamFromAPI, scrollChat,
        showView, showChatView, showGuideView,
        setGuidesIndex, setProtocolsIndex, setGamesIndex, setSearchIndex } = window;



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

