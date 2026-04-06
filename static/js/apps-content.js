/* ═══ Bunker OS — Content Apps (Protocols, Games, Supplies) ═══ */

// ─── Global aliases from window (set by main.js) ─────────────────────────────
const { state, storage, escapeHtml, markdownToHtml, guidesCache, LOADING_PHRASES,
        OS_APPS, _windows, openApp, closeWindow, focusWindow, osToast, openSavedApp,
        saveChats, saveFavorites, renderChatList, restoreChat, renderFavorites,
        addFavorite, removeFavorite, isFavorited, genId,
        renderDesktopIcons, startTaskbarClock, applyWallpaper, restoreSession,
        addMsgDom, addStreamMsgDom, addMsgActions, streamFromAPI, scrollChat,
        showView, showChatView, showGuideView,
        setGuidesIndex, setProtocolsIndex, setGamesIndex, setSearchIndex } = window;



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

