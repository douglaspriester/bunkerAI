/* ═══ Bunker OS — Books, Wiki, Journal ═══ */

// ─── Global aliases from window (set by main.js) ─────────────────────────────
const { state, storage, escapeHtml, markdownToHtml, guidesCache, LOADING_PHRASES,
        OS_APPS, _windows, openApp, closeWindow, focusWindow, osToast, openSavedApp,
        saveChats, saveFavorites, renderChatList, restoreChat, renderFavorites,
        addFavorite, removeFavorite, isFavorited, genId,
        renderDesktopIcons, startTaskbarClock, applyWallpaper, restoreSession,
        addMsgDom, addStreamMsgDom, addMsgActions, streamFromAPI, scrollChat,
        showView, showChatView, showGuideView,
        setGuidesIndex, setProtocolsIndex, setGamesIndex, setSearchIndex } = window;



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
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    renderBooks(Array.isArray(d) ? d : (d.books || []));
  } catch(e) {
    grid.textContent = '';
    const err = document.createElement('div');
    err.className = 'guide-error';
    err.textContent = 'Erro: ' + e.message;
    grid.appendChild(err);
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
    // Destroy partially-initialized instances on failure
    if (_currentRendition) { try { _currentRendition.destroy(); } catch(_) {} _currentRendition = null; }
    if (_currentBook) { try { _currentBook.destroy(); } catch(_) {} _currentBook = null; }
    if (area) {
      area.textContent = '';
      const errDiv = document.createElement('div');
      errDiv.className = 'guide-error';
      errDiv.textContent = 'Erro ao abrir livro: ' + e.message;
      const openBtn = document.createElement('button');
      openBtn.className = 'btn-sm';
      openBtn.style.marginTop = '8px';
      openBtn.textContent = 'Abrir em nova aba';
      openBtn.onclick = () => window.open('/api/books/' + encodeURIComponent(id) + '/file', '_blank');
      errDiv.appendChild(document.createElement('br'));
      errDiv.appendChild(document.createElement('br'));
      errDiv.appendChild(openBtn);
      area.appendChild(errDiv);
    }
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
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    _journalEntries = Array.isArray(d) ? d : (d.entries || []);
    renderJournal(_journalEntries);
  } catch(e) {
    content.textContent = '';
    const err = document.createElement('div');
    err.className = 'guide-error';
    err.textContent = 'Erro: ' + e.message;
    content.appendChild(err);
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

  // Escape all server-supplied strings before building HTML
  const esc = escapeHtml;
  const hasPsutil = d.cpu_pct != null;
  // Numeric values: coerce to numbers and fallback to 0 to prevent injection
  const cpuPct   = parseFloat(d.cpu_pct)  || 0;
  const ramPct   = parseFloat(d.ram_pct)  || 0;
  const diskPct  = parseFloat(d.disk_pct) || 0;
  const ramUsedMb  = parseFloat(d.ram_used_mb)  || 0;
  const ramTotalMb = parseFloat(d.ram_total_mb) || 0;
  const diskFreeGb  = parseFloat(d.disk_free_gb)  || 0;
  const diskTotalGb = parseFloat(d.disk_total_gb) || 0;

  const ramUsed  = ramUsedMb  >= 1024 ? `${(ramUsedMb/1024).toFixed(1)} GB`  : `${ramUsedMb} MB`;
  const ramTotal = ramTotalMb >= 1024 ? `${(ramTotalMb/1024).toFixed(1)} GB` : `${ramTotalMb} MB`;

  let html = '<div class="status-card-title">📡 Status do Servidor</div>';
  html += '<div class="status-grid">';

  // IP + Port — escaped server strings
  html += `<div class="status-item"><span class="status-label">IP</span><span class="status-val">${esc(String(d.ip || ''))}:${esc(String(d.port || ''))}</span></div>`;
  // Uptime — computed from numeric value, safe
  html += `<div class="status-item"><span class="status-label">Uptime</span><span class="status-val">${_uptimeStr(parseInt(d.uptime_sec) || 0)}</span></div>`;
  // OS — escaped
  html += `<div class="status-item"><span class="status-label">SO</span><span class="status-val">${esc(String(d.os || ''))}</span></div>`;
  // Python — escaped
  html += `<div class="status-item"><span class="status-label">Python</span><span class="status-val">${esc(String(d.python || ''))}</span></div>`;

  if (hasPsutil) {
    // CPU — numeric only
    html += `<div class="status-item full"><span class="status-label">CPU</span><span class="status-val">${cpuPct}%</span>${_statusBar(cpuPct)}</div>`;
    // RAM — numeric only
    html += `<div class="status-item full"><span class="status-label">RAM</span><span class="status-val">${ramUsed} / ${ramTotal} (${ramPct}%)</span>${_statusBar(ramPct)}</div>`;
    // Disk — numeric only
    html += `<div class="status-item full"><span class="status-label">Disco livre</span><span class="status-val">${diskFreeGb} GB / ${diskTotalGb} GB (${diskPct}%)</span>${_statusBar(diskPct)}</div>`;
  } else {
    html += `<div class="status-item full"><span class="status-label">Métricas</span><span class="status-val status-dim">Instale psutil para detalhes</span></div>`;
  }

  // Content summary — numeric counts only
  if (d.content) {
    const c = d.content;
    html += `<div class="status-item full status-content">`;
    html += `<span class="status-label">Conteúdo offline</span>`;
    html += `<div class="status-content-grid">`;
    html += `<span>📋 ${parseInt(c.guides) || 0} guias</span><span>🚨 ${parseInt(c.protocols) || 0} protocolos</span>`;
    html += `<span>📚 ${parseInt(c.books) || 0} livros</span><span>🎮 ${parseInt(c.games) || 0} jogos</span>`;
    html += `<span>🗺️ ${parseInt(c.maps) || 0} mapas</span><span>🌐 ${parseInt(c.zim_files) || 0} ZIM</span>`;
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
let _journalDictateTimeout = null; // auto-stop after max duration

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


// ─── Expose _clockInterval to window for close callbacks ─────────────────────
Object.defineProperty(window, '_clockInterval', { get() { return _clockInterval; }, set(v) { _clockInterval = v; }, configurable: true });
