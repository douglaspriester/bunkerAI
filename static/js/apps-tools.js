/* ═══ Bunker OS — Tool Apps (Calculator, Timer, Converter, Checklist, Morse, Phonetic, Sun, Water, Tasks, Media, Terminal, FileManager) ═══ */

// ─── Global aliases from window (set by main.js) ─────────────────────────────
const { state, storage, escapeHtml, markdownToHtml, guidesCache, LOADING_PHRASES,
        OS_APPS, _windows, openApp, closeWindow, focusWindow, osToast, openSavedApp,
        saveChats, saveFavorites, renderChatList, restoreChat, renderFavorites,
        addFavorite, removeFavorite, isFavorited, genId,
        renderDesktopIcons, startTaskbarClock, applyWallpaper, restoreSession,
        addMsgDom, addStreamMsgDom, addMsgActions, streamFromAPI, scrollChat,
        showView, showChatView, showGuideView,
        setGuidesIndex, setProtocolsIndex, setGamesIndex, setSearchIndex } = window;




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
  const raw = parseFloat(document.getElementById('convInput')?.value || '0');
  const from = document.getElementById('convFrom')?.value;
  const to = document.getElementById('convTo')?.value;
  const resultEl = document.getElementById('convResult');
  if (!resultEl) return;

  // Validate input: reject NaN and Infinity
  if (!isFinite(raw) || isNaN(raw)) {
    resultEl.textContent = '—';
    return;
  }

  let result;
  try {
    if (cfg.convert) {
      result = cfg.convert(raw, from, to);
    } else {
      // Factor-based conversion — guard against missing/zero factors
      const fromFactor = cfg.factors[from];
      const toFactor = cfg.factors[to];
      if (!fromFactor || !toFactor) { resultEl.textContent = '—'; return; }
      result = (raw * fromFactor) / toFactor;
    }
  } catch {
    resultEl.textContent = '—';
    return;
  }

  resultEl.textContent = (!isFinite(result) || isNaN(result)) ? '—' : parseFloat(result.toFixed(8));
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
  const rawLiters = parseFloat(document.getElementById('waterLiters')?.value || '1');
  const el = document.getElementById('waterResult');
  if (!el) return;

  // Validate numeric input: reject NaN, negative, Infinity, or unreasonably large values
  if (!isFinite(rawLiters) || isNaN(rawLiters) || rawLiters <= 0 || rawLiters > 100000) {
    el.innerHTML = '<div class="water-result-card"><p>⚠️ Volume invalido. Informe um valor entre 0.1 e 100000 litros.</p></div>';
    return;
  }
  const liters = rawLiters;
  const clarity = document.getElementById('waterClarity')?.value || 'clear';
  const method = document.getElementById('waterMethod')?.value || 'bleach';

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
  // Keep history bounded to prevent unbounded memory growth
  if (_termHistory.length > 200) _termHistory.shift();
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


// ─── Expose mutable state to window for close callbacks ──────────────────────
Object.defineProperty(window, '_timerInterval', { get() { return _timerInterval; }, set(v) { _timerInterval = v; }, configurable: true });
Object.defineProperty(window, '_checklistDirty', { get() { return _checklistDirty; }, configurable: true });
Object.defineProperty(window, '_checklistActiveId', { get() { return _checklistActiveId; }, configurable: true });
