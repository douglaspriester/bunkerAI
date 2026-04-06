/* ═══ Bunker OS — Office Apps (Notepad, Word, Excel) ═══ */

// ─── Global aliases from window (set by main.js) ─────────────────────────────
const { state, storage, escapeHtml, markdownToHtml, guidesCache, LOADING_PHRASES,
        OS_APPS, _windows, openApp, closeWindow, focusWindow, osToast, openSavedApp,
        saveChats, saveFavorites, renderChatList, restoreChat, renderFavorites,
        addFavorite, removeFavorite, isFavorited, genId,
        renderDesktopIcons, startTaskbarClock, applyWallpaper, restoreSession,
        addMsgDom, addStreamMsgDom, addMsgActions, streamFromAPI, scrollChat,
        showView, showChatView, showGuideView,
        setGuidesIndex, setProtocolsIndex, setGamesIndex, setSearchIndex } = window;



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
  // Replace cell references with their numeric values
  let replaced = expr.replace(/[A-J]\d{1,2}/g, (ref) => {
    const v = excelCellValue(ref);
    return isFinite(v) ? String(v) : '0';
  });
  // Safe arithmetic-only parser — no eval/Function, no string injection.
  // Supported: numbers (int/float), +  -  *  /  (  )
  // Comparison operators and logical operators are intentionally excluded.
  try {
    return _excelParse(replaced.replace(/\s+/g, ''));
  } catch {
    return 0;
  }
}

// Recursive-descent arithmetic parser (no eval, no Function constructor).
// Grammar: expr = term (('+' | '-') term)*
//          term = factor (('*' | '/') factor)*
//          factor = '-' factor | '(' expr ')' | number
function _excelParse(s) {
  let pos = 0;

  function peek()  { return pos < s.length ? s[pos] : ''; }
  function consume(c) { if (s[pos] !== c) throw new Error(); pos++; }

  function parseNumber() {
    let start = pos;
    if (peek() === '-') pos++;            // leading minus handled by factor()
    while (pos < s.length && /[\d.]/.test(s[pos])) pos++;
    if (pos === start || (pos === start + 1 && s[start] === '-')) throw new Error();
    const n = parseFloat(s.slice(start, pos));
    if (!isFinite(n)) throw new Error();
    return n;
  }

  function parseFactor() {
    if (peek() === '-') { pos++; return -parseFactor(); }
    if (peek() === '(') {
      consume('(');
      const v = parseExpr();
      consume(')');
      return v;
    }
    return parseNumber();
  }

  function parseTerm() {
    let v = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = s[pos++];
      const r = parseFactor();
      if (op === '*') v *= r;
      else { if (r === 0) return 0; v /= r; }
    }
    return v;
  }

  function parseExpr() {
    let v = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = s[pos++];
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }

  const result = parseExpr();
  if (pos !== s.length) throw new Error('Unexpected: ' + s.slice(pos));
  return isFinite(result) ? result : 0;
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

// ─── Expose mutable state to window for close callbacks ──────────────────────
// These use defineProperty so window always reads the current value.
Object.defineProperty(window, '_notepadDirty', { get() { return _notepadDirty; }, configurable: true });
Object.defineProperty(window, '_notepadActiveId', { get() { return _notepadActiveId; }, configurable: true });
Object.defineProperty(window, '_wordDirty', { get() { return _wordDirty; }, configurable: true });
Object.defineProperty(window, '_wordActiveId', { get() { return _wordActiveId; }, configurable: true });
Object.defineProperty(window, '_excelDirty', { get() { return _excelDirty; }, configurable: true });
Object.defineProperty(window, '_excelActiveId', { get() { return _excelActiveId; }, configurable: true });
