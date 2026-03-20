/* ═══ Bunker OS — The Guide: AI Companion Widget (Phase 14) ═══ */
/* "In many of the more relaxed civilizations on the Outer Eastern Rim of the Galaxy,
   the Hitchhiker's Guide has already supplanted the great Encyclopaedia Galactica
   as the standard repository of all knowledge and wisdom." */

import { state, storage, escapeHtml } from './state.js';
import { AI_MODES, getActiveMode, setAIMode } from './chat.js';
import { openApp, osToast } from './windowManager.js';

// ─── Guide Personalities ─────────────────────────────────────────────────────
const PERSONALITIES = {
  deepThought: {
    id: 'deepThought',
    name: 'Deep Thought',
    icon: '🧠',
    color: '#a78bfa',
    greeting: 'Hmm... A resposta e 42. Mas qual era a pergunta mesmo?',
    style: 'filosofico',
    quirk: 'Sempre relaciona tudo ao numero 42',
    responsePrefix: '🧠 ',
  },
  tars: {
    id: 'tars',
    name: 'TARS',
    icon: '🤖',
    color: '#60a5fa',
    greeting: 'Humor configurado em 75%. Como posso ajudar?',
    style: 'sarcastico-util',
    quirk: 'Menciona porcentagem de humor',
    responsePrefix: '🤖 ',
  },
  mother: {
    id: 'mother',
    name: 'MOTHER',
    icon: '🖥️',
    color: '#34d399',
    greeting: 'INTERFACE ATIVADA. Todos os sistemas nominais.',
    style: 'clinico-protetor',
    quirk: 'Fala em estilo terminal/computador',
    responsePrefix: '🖥️ ',
  },
  hal: {
    id: 'hal',
    name: 'HAL 9000',
    icon: '🔴',
    color: '#f87171',
    greeting: 'Bom dia, Dave. O que posso fazer por voce?',
    style: 'educado-sinistro',
    quirk: 'Chama todo mundo de Dave',
    responsePrefix: '🔴 ',
  },
  ford: {
    id: 'ford',
    name: 'Ford Prefect',
    icon: '🍺',
    color: '#fbbf24',
    greeting: 'Voce sabe onde esta sua toalha? Isso e MUITO importante.',
    style: 'casual-alienigena',
    quirk: 'Obsessao com toalhas e Pan Galactic Gargle Blasters',
    responsePrefix: '🍺 ',
  },
  survivor: {
    id: 'survivor',
    name: 'Sobrevivente',
    icon: '🏕️',
    color: '#f97316',
    greeting: 'Status: operacional. Pronto para a proxima missao.',
    style: 'direto-militar',
    quirk: 'Linguagem tatica e concisa',
    responsePrefix: '🏕️ ',
  },
};

// ─── Proactive Tips by AI Mode ───────────────────────────────────────────────
const PROACTIVE_TIPS = {
  general: [
    'Ctrl+K abre a busca rapida.',
    'Dica: Use /build no chat para criar apps HTML com IA.',
    'Alt+Tab alterna entre janelas abertas.',
    'Dica: duplo-clique em um icone do desktop para abrir o app.',
    'Voce pode arrastar icones no desktop para reorganizar.',
  ],
  medical: [
    'Lembrete: ABC — Via Aerea, Respiracao, Circulacao. Sempre nessa ordem.',
    'Dica: Mantenha um kit de primeiros socorros acessivel.',
    'Checou os niveis de agua hoje? Desidratacao afeta o raciocinio.',
    'Lembrete: Troque curativos a cada 24h em ambientes nao-estereis.',
  ],
  survival: [
    'Regra dos 3: 3min sem ar, 3h sem abrigo, 3 dias sem agua, 3 semanas sem comida.',
    'Fase da lua pode afetar mares e visibilidade noturna.',
    'Dica: Verifique seu estoque de agua no app Suprimentos.',
    'Voce verificou suas armadilhas hoje?',
  ],
  engineer: [
    'Dica: Verifique o gerador/energia solar regularmente.',
    'Ferramentas limpas duram mais. Manutencao preventiva.',
    'Mapeie fontes de materiais no app de Mapas.',
  ],
  defense: [
    'Lembrete: Verifique os pontos de entrada do perimetro.',
    'Comunicacao de radio em frequencias seguras — veja o app Frequencias.',
    'Faca uma ronda de seguranca periodicamente.',
  ],
  psych: [
    'Lembrete: Registre seus sentimentos no Diario. Ajuda a processar.',
    'Respire: 4 segundos inspira, 7 segura, 8 expira.',
    'Conexao social e fundamental. Como esta o grupo?',
    'Descanso e tao importante quanto acao. Ja dormiu o suficiente?',
  ],
};

// ─── Quick Actions ───────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: '🏥', label: 'Emergencia', action: () => { openApp('chat'); setTimeout(() => setAIMode('medical'), 300); } },
  { icon: '📋', label: 'Guias', action: () => openApp('guides') },
  { icon: '📻', label: 'Radio', action: () => openApp('radio') },
  { icon: '🗺️', label: 'Mapa', action: () => openApp('map') },
  { icon: '📦', label: 'Suprimentos', action: () => openApp('supplies') },
  { icon: '📓', label: 'Diario', action: () => openApp('journal') },
];

// ─── Guide State ─────────────────────────────────────────────────────────────
let _guideState = {
  visible: true,
  expanded: false,  // starts collapsed (just the bubble)
  personality: 'ford',
  mood: 'idle',
  tipInterval: null,
  quickAskOpen: false,
};

// ─── Persistence ─────────────────────────────────────────────────────────────
function loadGuideState() {
  try {
    const saved = storage.get('bunker_guide');
    if (saved) {
      const parsed = JSON.parse(saved);
      _guideState.personality = parsed.personality || 'ford';
      _guideState.visible = parsed.visible !== false;
    }
  } catch {}
}

function saveGuideState() {
  storage.set('bunker_guide', JSON.stringify({
    personality: _guideState.personality,
    visible: _guideState.visible,
  }));
}

// ─── Get Current Personality ─────────────────────────────────────────────────
function getPersonality() {
  return PERSONALITIES[_guideState.personality] || PERSONALITIES.ford;
}

// ─── Mood System ─────────────────────────────────────────────────────────────
const MOOD_SPRITES = {
  idle:     { eyes: '◉ ◉', mouth: '───' },
  thinking: { eyes: '◉ ◉', mouth: '...' },
  happy:    { eyes: '◠ ◠', mouth: '◡◡◡' },
  alert:    { eyes: '◉ ◉', mouth: '!!!' },
  sleeping: { eyes: '─ ─', mouth: 'zzz' },
  talking:  { eyes: '◉ ◉', mouth: '○○○' },
};

function setMood(mood) {
  _guideState.mood = mood;
  updateAvatarDisplay();
}

function updateAvatarDisplay() {
  const avatar = document.getElementById('guideAvatar');
  if (!avatar) return;
  const p = getPersonality();
  const m = MOOD_SPRITES[_guideState.mood] || MOOD_SPRITES.idle;

  avatar.innerHTML = `
    <div class="guide-avatar-face" style="--guide-color: ${p.color}">
      <div class="guide-avatar-screen">
        <div class="guide-eyes">${m.eyes}</div>
        <div class="guide-mouth">${m.mouth}</div>
      </div>
      <div class="guide-avatar-label">${p.icon}</div>
    </div>
  `;
  avatar.className = `guide-avatar mood-${_guideState.mood}`;
}

// ─── Render Main Widget ──────────────────────────────────────────────────────
export function renderGuideWidget() {
  let widget = document.getElementById('guideWidget');
  if (widget) widget.remove();

  widget = document.createElement('div');
  widget.id = 'guideWidget';
  widget.className = 'guide-widget' + (_guideState.expanded ? ' expanded' : '') +
    (_guideState.visible ? '' : ' guide-hidden');

  const p = getPersonality();
  const activeMode = getActiveMode?.() || 'general';
  const mode = AI_MODES[activeMode];

  widget.innerHTML = `
    <!-- Collapsed: Just the avatar bubble -->
    <div class="guide-bubble" id="guideBubble" title="The Guide — ${escapeHtml(p.name)}">
      <div id="guideAvatar" class="guide-avatar"></div>
      <div class="guide-bubble-badge" id="guideBadge" style="background:${mode?.color || '#00d4ff'}">
        ${mode?.icon || '🤖'}
      </div>
    </div>

    <!-- Expanded Panel -->
    <div class="guide-panel" id="guidePanel">
      <div class="guide-panel-header">
        <div class="guide-panel-title">
          <span class="guide-panel-icon">📖</span>
          <span>THE GUIDE</span>
          <span class="guide-panel-sub">${escapeHtml(p.name)}</span>
        </div>
        <div class="guide-panel-controls">
          <button class="guide-ctrl-btn" id="guidePersBtn" title="Trocar personalidade">🎭</button>
          <button class="guide-ctrl-btn" id="guideMinBtn" title="Minimizar">─</button>
        </div>
      </div>

      <!-- Mode Indicator -->
      <div class="guide-mode-indicator" id="guideModeIndicator">
        <span class="guide-mode-dot" style="background:${mode?.color || '#00d4ff'}"></span>
        <span class="guide-mode-label">Modo: ${mode?.label || 'Geral'}</span>
        <span class="guide-mode-personality">${p.icon} ${p.name}</span>
      </div>

      <!-- Speech Bubble -->
      <div class="guide-speech" id="guideSpeech">
        <div class="guide-speech-text" id="guideSpeechText">${escapeHtml(p.greeting)}</div>
      </div>

      <!-- Quick Ask -->
      <div class="guide-quick-ask" id="guideQuickAsk">
        <div class="guide-quick-input-wrap">
          <input type="text" class="guide-quick-input" id="guideQuickInput"
            placeholder="Pergunta rapida..." />
          <button class="guide-quick-send" id="guideQuickSendBtn" title="Enviar">▶</button>
        </div>
      </div>

      <!-- Quick Actions Grid -->
      <div class="guide-actions" id="guideActions">
        ${QUICK_ACTIONS.map((a, i) =>
          `<button class="guide-action-btn" data-idx="${i}" title="${a.label}">${a.icon}<span>${a.label}</span></button>`
        ).join('')}
      </div>

      <!-- Scanner Button -->
      <div class="guide-scanner-row">
        <button class="guide-scanner-btn" id="guideScannerBtn">
          📷 Scanner
        </button>
      </div>

      <!-- Personality Selector (hidden by default) -->
      <div class="guide-personality-picker hidden" id="guidePersonalityPicker">
        ${Object.values(PERSONALITIES).map(pp =>
          `<button class="guide-pers-btn${pp.id === _guideState.personality ? ' active' : ''}"
            data-pers="${pp.id}"
            style="--pers-color:${pp.color}" title="${pp.name} — ${pp.style}">
            ${pp.icon}<span>${pp.name}</span>
          </button>`
        ).join('')}
      </div>
    </div>
  `;

  // Insert into desktop
  const desktop = document.getElementById('desktop');
  if (desktop) {
    desktop.appendChild(widget);
  }

  // Update avatar
  updateAvatarDisplay();

  // ── Wire all event listeners (no inline handlers) ──
  widget.querySelector('#guideBubble')?.addEventListener('click', guideToggle);
  widget.querySelector('#guideMinBtn')?.addEventListener('click', guideToggle);
  widget.querySelector('#guidePersBtn')?.addEventListener('click', guidePersonalityCycle);
  widget.querySelector('#guideScannerBtn')?.addEventListener('click', guideScannerToggle);
  widget.querySelector('#guideQuickSendBtn')?.addEventListener('click', guideQuickAsk);
  widget.querySelector('#guideQuickInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); guideQuickAsk(); }
  });

  // Quick action buttons
  widget.querySelectorAll('.guide-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (QUICK_ACTIONS[idx]) QUICK_ACTIONS[idx].action();
    });
  });

  // Personality picker buttons
  widget.querySelectorAll('.guide-pers-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      guideSetPersonality(btn.dataset.pers);
    });
  });
}

// ─── Toggle Expand/Collapse ──────────────────────────────────────────────────
export function guideToggle() {
  _guideState.expanded = !_guideState.expanded;
  const widget = document.getElementById('guideWidget');
  if (widget) widget.classList.toggle('expanded', _guideState.expanded);
  if (_guideState.expanded) {
    setMood('happy');
    setTimeout(() => setMood('idle'), 2000);
    const input = document.getElementById('guideQuickInput');
    if (input) setTimeout(() => input.focus(), 200);
  }
}

// ─── Quick Ask ───────────────────────────────────────────────────────────────
export async function guideQuickAsk() {
  const input = document.getElementById('guideQuickInput');
  const speechText = document.getElementById('guideSpeechText');
  if (!input || !speechText) return;

  const question = input.value.trim();
  if (!question) return;

  input.value = '';
  setMood('thinking');
  speechText.textContent = 'Processando...';

  try {
    const model = document.getElementById('chatModel')?.value || 'dolphin3';
    const p = getPersonality();

    const systemPrompt = `Voce e "${p.name}", assistente do Bunker OS. Estilo: ${p.style}. ${p.quirk}.
Responda de forma CURTA (max 2-3 frases). Seja util e direto. Mantenha o tom do personagem.
Se a pergunta for sobre emergencia, indique que o usuario abra o modo Medico.
Responda no idioma do usuario.`;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: question }],
        system: systemPrompt,
        stream: false,
      }),
    });

    if (!res.ok) throw new Error('API error');

    const data = await res.json();
    const answer = data.message?.content || data.response || 'Hmm, nao consegui processar isso.';

    speechText.textContent = p.responsePrefix + answer;
    setMood('happy');
    setTimeout(() => setMood('idle'), 3000);
  } catch (e) {
    speechText.textContent = '⚠️ Sem conexao com a IA. O Ollama esta rodando?';
    setMood('alert');
    setTimeout(() => setMood('idle'), 4000);
  }
}

// ─── Scanner Mode ────────────────────────────────────────────────────────────
export function guideScannerToggle() {
  openApp('chat');
  osToast('📷 Use o botao de webcam no chat para o Scanner Mode');
}

// ─── Personality Management ──────────────────────────────────────────────────
export function guideSetPersonality(id) {
  if (!PERSONALITIES[id]) return;
  _guideState.personality = id;
  saveGuideState();
  renderGuideWidget();
  const p = getPersonality();
  osToast(`🎭 Personalidade: ${p.icon} ${p.name}`);
}

export function guidePersonalityCycle() {
  const picker = document.getElementById('guidePersonalityPicker');
  if (picker) picker.classList.toggle('hidden');
}

// ─── Proactive Tips ──────────────────────────────────────────────────────────
function startProactiveTips() {
  if (_guideState.tipInterval) clearInterval(_guideState.tipInterval);

  _guideState.tipInterval = setInterval(() => {
    if (!_guideState.expanded && _guideState.visible) {
      showRandomTip();
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  // Show first tip after 30 seconds
  setTimeout(() => {
    if (_guideState.visible && !_guideState.expanded) showRandomTip();
  }, 30000);
}

function showRandomTip() {
  const activeMode = getActiveMode?.() || 'general';
  const tips = PROACTIVE_TIPS[activeMode] || PROACTIVE_TIPS.general;
  const tip = tips[Math.floor(Math.random() * tips.length)];

  const p = getPersonality();
  showGuideBubbleToast(`${p.responsePrefix}${tip}`);
}

function showGuideBubbleToast(message) {
  let existing = document.getElementById('guideToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'guideToast';
  toast.className = 'guide-toast';
  toast.textContent = message;

  const widget = document.getElementById('guideWidget');
  if (widget) {
    widget.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }
}

// ─── Mode Change Observer ────────────────────────────────────────────────────
export function guideOnModeChange() {
  const indicator = document.getElementById('guideModeIndicator');
  const badge = document.getElementById('guideBadge');
  if (!indicator || !badge) return;

  const activeMode = getActiveMode?.() || 'general';
  const mode = AI_MODES[activeMode];
  if (!mode) return;

  const p = getPersonality();

  indicator.innerHTML = `
    <span class="guide-mode-dot" style="background:${mode.color}"></span>
    <span class="guide-mode-label">Modo: ${mode.label}</span>
    <span class="guide-mode-personality">${p.icon} ${p.name}</span>
  `;
  badge.style.background = mode.color;
  badge.textContent = mode.icon;

  setMood('alert');
  const speechText = document.getElementById('guideSpeechText');
  if (speechText) {
    speechText.textContent = `${p.responsePrefix}Modo ${mode.icon} ${mode.label} ativado.`;
  }
  setTimeout(() => setMood('idle'), 2500);
}

// ─── Init ────────────────────────────────────────────────────────────────────
export function initGuideCompanion() {
  loadGuideState();
  renderGuideWidget();
  startProactiveTips();
}
