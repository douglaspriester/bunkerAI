/* ═══ Bunker OS — Model Manager ═══ */

// ─── Global aliases from window (set by main.js) ─────────────────────────────
const { state, storage, escapeHtml, markdownToHtml, guidesCache, LOADING_PHRASES,
        OS_APPS, _windows, openApp, closeWindow, focusWindow, osToast, openSavedApp,
        saveChats, saveFavorites, renderChatList, restoreChat, renderFavorites,
        addFavorite, removeFavorite, isFavorited, genId,
        renderDesktopIcons, startTaskbarClock, applyWallpaper, restoreSession,
        addMsgDom, addStreamMsgDom, addMsgActions, streamFromAPI, scrollChat,
        showView, showChatView, showGuideView,
        setGuidesIndex, setProtocolsIndex, setGamesIndex, setSearchIndex } = window;



// ─── Model Manager ──────────────────────────────────────────────────────────

let _modelMgrPollId = null;

function modelMgrInit() {
  modelMgrRefresh();
}

async function modelMgrRefresh() {
  const list = document.getElementById('modelMgrList');
  const dirEl = document.getElementById('modelMgrDir');
  if (!list) return;

  list.innerHTML = '<div class="panel-empty" style="padding:20px;text-align:center;font-family:var(--font-mono);font-size:11px">Carregando modelos...</div>';

  try {
    const r = await fetch('/api/models');
    const data = await r.json();
    const ollamaModels = data.ollama_models || [];
    const ggufModels = data.gguf_models || [];

    if (dirEl) dirEl.textContent = `Backend: ${data.backend || 'desconhecido'} · ${data.total || 0} modelo(s)`;

    if (!ollamaModels.length && !ggufModels.length) {
      list.innerHTML = '<div class="panel-empty">Nenhum modelo encontrado. Use os botoes para baixar.</div>';
      return;
    }

    const sections = [];

    // ── Ollama models section ──
    if (ollamaModels.length) {
      sections.push(`<div style="font-family:var(--font-hud);font-size:10px;letter-spacing:0.1em;color:var(--text-muted);padding:4px 0 8px">MODELOS OLLAMA</div>`);
      sections.push(ollamaModels.map(m => {
        const sizeStr = m.size_gb < 1 ? `${Math.round(m.size_gb * 1024)} MB` : `${m.size_gb} GB`;
        return `<div class="model-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px;display:flex;flex-direction:column;gap:6px;margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:18px">🤖</span>
              <div>
                <div style="font-weight:600;color:var(--text-bright);font-size:13px">${escapeHtml(m.name)}</div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
                  <span style="color:var(--accent);font-family:var(--font-hud);font-size:9px;letter-spacing:0.08em;border:1px solid var(--accent);padding:0 5px;border-radius:3px">OLLAMA</span>
                  <span style="color:var(--text-muted);font-size:10px">${sizeStr}</span>
                </div>
              </div>
            </div>
            <span style="color:var(--green);font-family:var(--font-hud);font-size:10px;letter-spacing:0.05em">✅ ATIVO</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">
            <button class="btn-action" style="font-size:10px;padding:3px 8px;background:var(--danger-dim);border-color:rgba(255,26,71,0.2);color:var(--danger)" onclick="modelMgrDeleteOllama('${escapeHtml(m.name)}')">Remover</button>
          </div>
        </div>`;
      }).join(''));
    }

    // ── GGUF models section ──
    if (ggufModels.length) {
      sections.push(`<div style="font-family:var(--font-hud);font-size:10px;letter-spacing:0.1em;color:var(--text-muted);padding:12px 0 8px">MODELOS GGUF (LOCAL)</div>`);
      sections.push(ggufModels.map(m => {
        const isDownloaded = m.downloaded;
        const isDownloading = (m.id in (window._modelMgrDownloading || {}));
        const isPartial = m.partial;
        const sizeStr = m.size_gb < 1 ? `${Math.round(m.size_gb * 1024)} MB` : `${m.size_gb} GB`;
        const tags = (m.tags || []).map(t => {
          if (t === 'vision') return '<span style="background:rgba(168,85,247,0.12);color:#a855f7;padding:1px 6px;border-radius:3px;font-size:9px">VISION</span>';
          if (t === 'principal') return '<span style="background:var(--accent-dim);color:var(--accent);padding:1px 6px;border-radius:3px;font-size:9px">PRINCIPAL</span>';
          if (t === 'custom') return '<span style="background:rgba(100,100,100,0.15);color:var(--text-muted);padding:1px 6px;border-radius:3px;font-size:9px">CUSTOM</span>';
          return '';
        }).filter(Boolean).join(' ');

        let statusHtml = '';
        let actionHtml = '';

        if (isDownloaded) {
          statusHtml = '<span style="color:var(--green);font-family:var(--font-hud);font-size:10px;letter-spacing:0.05em">✅ INSTALADO</span>';
          actionHtml = `<button class="btn-action" style="font-size:10px;padding:3px 8px;background:var(--danger-dim);border-color:rgba(255,26,71,0.2);color:var(--danger)" onclick="modelMgrDelete('${escapeHtml(m.id)}')">Remover</button>`;
        } else if (isDownloading) {
          statusHtml = `<span style="color:var(--amber);font-family:var(--font-hud);font-size:10px" id="modelStatus_${m.id}">⏳ BAIXANDO...</span>`;
          actionHtml = `<div class="model-progress-bar" id="modelProgress_${m.id}"><div class="model-progress-fill" style="width:0%"></div></div>`;
          if (!_modelMgrPollId) _modelMgrPollId = setInterval(() => modelMgrPollProgress(), 1500);
        } else if (isPartial) {
          statusHtml = '<span style="color:var(--amber);font-size:10px">⚠ INCOMPLETO</span>';
          actionHtml = `<button class="btn-action" style="font-size:10px;padding:3px 8px" onclick="modelMgrDownload('${escapeHtml(m.id)}')">Retomar</button>`;
        } else {
          statusHtml = `<span style="color:var(--text-muted);font-size:10px">Nao instalado</span>`;
          actionHtml = `<button class="btn-action" style="font-size:10px;padding:3px 8px" onclick="modelMgrDownload('${escapeHtml(m.id)}')">⬇ Baixar (${sizeStr})</button>`;
        }

        return `<div class="model-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px;display:flex;flex-direction:column;gap:6px;margin-bottom:8px">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:18px">${m.tags?.includes('vision') ? '👁️' : '💾'}</span>
              <div>
                <div style="font-weight:600;color:var(--text-bright);font-size:13px">${escapeHtml(m.name)}</div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
                  <span style="color:var(--text-muted);font-family:var(--font-hud);font-size:9px;letter-spacing:0.08em;border:1px solid var(--border);padding:0 5px;border-radius:3px">GGUF</span>
                  <span style="color:var(--text-muted);font-size:10px">${sizeStr}</span>
                  ${m.uncensored ? '<span style="background:rgba(255,140,0,0.1);color:var(--amber);padding:1px 6px;border-radius:3px;font-size:9px">UNCENSORED</span>' : ''}
                  ${tags}
                </div>
              </div>
            </div>
            ${statusHtml}
          </div>
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">${actionHtml}</div>
        </div>`;
      }).join(''));
    }

    list.innerHTML = sections.join('');

  } catch (e) {
    list.innerHTML = `<div class="panel-empty" style="color:var(--danger)">Erro ao carregar modelos: ${escapeHtml(e.message)}</div>`;
  }
}

async function modelMgrDownload(modelId) {
  try {
    const r = await fetch('/api/models/local/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId }),
    });
    const data = await r.json();
    if (data.status === 'started' || data.status === 'already_downloading') {
      osToast('⬇ Download iniciado: ' + modelId);
      window._modelMgrDownloading = window._modelMgrDownloading || {};
      window._modelMgrDownloading[modelId] = true;
      if (!_modelMgrPollId) _modelMgrPollId = setInterval(() => modelMgrPollProgress(), 1500);
      setTimeout(modelMgrRefresh, 500);
    } else if (data.status === 'already_downloaded') {
      osToast('✅ Modelo ja instalado');
    } else if (data.error) {
      osToast('❌ Erro: ' + data.error, 3000, 'error');
    }
  } catch (e) {
    osToast('❌ Erro: ' + e.message, 3000, 'error');
  }
}

async function modelMgrPollProgress() {
  // Find all downloading models
  const statusEls = document.querySelectorAll('[id^="modelStatus_"]');
  if (!statusEls.length) {
    clearInterval(_modelMgrPollId);
    _modelMgrPollId = null;
    return;
  }

  for (const el of statusEls) {
    const modelId = el.id.replace('modelStatus_', '');
    try {
      const r = await fetch(`/api/models/local/progress/${modelId}`);
      const data = await r.json();
      if (data.status === 'downloading') {
        el.textContent = `⏳ ${data.percent || 0}% ${data.speed || ''}`;
        const bar = document.getElementById(`modelProgress_${modelId}`);
        if (bar) {
          const fill = bar.querySelector('.model-progress-fill');
          if (fill) fill.style.width = `${data.percent || 0}%`;
        }
      } else if (data.status === 'complete') {
        el.textContent = '✅ INSTALADO';
        el.style.color = 'var(--green)';
        clearInterval(_modelMgrPollId);
        _modelMgrPollId = null;
        if (window._modelMgrDownloading) delete window._modelMgrDownloading[modelId];
        osToast('✅ Modelo baixado com sucesso!');
        setTimeout(modelMgrRefresh, 1000);
      }
    } catch {}
  }
}

// Delete a GGUF model (local file)
async function modelMgrDelete(modelId) {
  if (!confirm('Remover este modelo? Voce pode baixar novamente depois.')) return;
  try {
    const r = await fetch(`/api/models/local/${modelId}`, { method: 'DELETE' });
    const data = await r.json();
    if (data.status === 'deleted') {
      osToast('🗑️ Modelo removido');
    } else {
      osToast('⚠ Modelo nao encontrado no disco');
    }
    modelMgrRefresh();
  } catch (e) {
    osToast('❌ Erro: ' + e.message, 3000, 'error');
  }
}

// Delete an Ollama model
async function modelMgrDeleteOllama(modelName) {
  if (!confirm(`Remover modelo Ollama "${modelName}"? Esta acao nao pode ser desfeita.`)) return;
  try {
    const r = await fetch(`/api/models/${encodeURIComponent(modelName)}`, { method: 'DELETE' });
    const data = await r.json();
    if (data.deleted) {
      osToast('🗑️ Modelo Ollama removido: ' + modelName);
      modelMgrRefresh();
    } else {
      osToast('❌ Erro: ' + (data.error || 'Falha ao remover'), 3000, 'error');
    }
  } catch (e) {
    osToast('❌ Erro: ' + e.message, 3000, 'error');
  }
}

window.modelMgrInit = modelMgrInit;
window.modelMgrRefresh = modelMgrRefresh;
window.modelMgrDownload = modelMgrDownload;
window.modelMgrDelete = modelMgrDelete;
window.modelMgrDeleteOllama = modelMgrDeleteOllama;
