/* ═══ Bunker OS — System Monitor ═══ */

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
// SYSTEM MONITOR — Live server stats
// ═══════════════════════════════════════════════════════════════════════════
let _sysmonInterval = null;

function sysmonInit() {
  sysmonRefresh();
  if (_sysmonInterval) clearInterval(_sysmonInterval);
  _sysmonInterval = setInterval(sysmonRefresh, 5000);
}

async function sysmonRefresh() {
  const el = document.getElementById('sysmonContent');
  if (!el) return;
  // If sysmon window is not open, stop
  const win = Object.values(_windows).find(w => w.appId === 'sysmon');
  if (!win) { clearInterval(_sysmonInterval); _sysmonInterval = null; return; }

  try {
    const r = await fetch('/api/status');
    const d = await r.json();
    const uptimeH = Math.floor(d.uptime_sec / 3600);
    const uptimeM = Math.floor((d.uptime_sec % 3600) / 60);

    const netIcon = d.internet ? '🟢 Online' : '🔴 Offline';
    const gpuText = d.gpu || 'Nenhuma detectada';
    const cpuText = d.cpu_count ? `${d.cpu_pct}% (${d.cpu_count} cores)` : `${d.cpu_pct}%`;

    el.innerHTML = `
      <div class="sysmon-grid">
        <div class="sysmon-card">
          <div class="sysmon-label">🖥 Sistema</div>
          <div class="sysmon-val">${d.hostname || 'bunker'}</div>
          <div class="sysmon-sub">${d.os} · ${d.arch || ''} · Python ${d.python}</div>
          <div class="sysmon-sub">IP: ${d.ip}:${d.port} · Uptime: ${uptimeH}h${uptimeM}m</div>
        </div>
        <div class="sysmon-card">
          <div class="sysmon-label">⚡ CPU</div>
          <div class="sysmon-bar"><div class="sysmon-bar-fill ${d.cpu_pct > 80 ? 'danger' : d.cpu_pct > 50 ? 'warn' : 'ok'}" style="width:${d.cpu_pct || 0}%"></div></div>
          <div class="sysmon-sub">${cpuText}</div>
        </div>
        <div class="sysmon-card">
          <div class="sysmon-label">🧠 RAM</div>
          <div class="sysmon-bar"><div class="sysmon-bar-fill ${d.ram_pct > 85 ? 'danger' : d.ram_pct > 60 ? 'warn' : 'ok'}" style="width:${d.ram_pct || 0}%"></div></div>
          <div class="sysmon-sub">${d.ram_used_mb || '?'} / ${d.ram_total_mb || '?'} MB (${d.ram_pct || '?'}%)</div>
        </div>
        <div class="sysmon-card">
          <div class="sysmon-label">💾 Disco</div>
          <div class="sysmon-bar"><div class="sysmon-bar-fill ${d.disk_pct > 90 ? 'danger' : d.disk_pct > 70 ? 'warn' : 'ok'}" style="width:${d.disk_pct || 0}%"></div></div>
          <div class="sysmon-sub">${d.disk_free_gb || '?'} GB livre de ${d.disk_total_gb || '?'} GB</div>
        </div>
        <div class="sysmon-card">
          <div class="sysmon-label">🎮 GPU</div>
          <div class="sysmon-sub">${gpuText}</div>
        </div>
        <div class="sysmon-card">
          <div class="sysmon-label">🌐 Rede</div>
          <div class="sysmon-sub">${netIcon}${d.offline_mode ? ' · Modo offline ativo' : ''}</div>
        </div>
        <div class="sysmon-card sysmon-wide">
          <div class="sysmon-label">📊 Conteudo</div>
          <div class="sysmon-content-grid">
            <span>📋 ${d.content?.guides || 0} guias</span>
            <span>🚨 ${d.content?.protocols || 0} protocolos</span>
            <span>📚 ${d.content?.books || 0} livros</span>
            <span>🎮 ${d.content?.games || 0} jogos</span>
            <span>🗺 ${d.content?.maps || 0} mapas</span>
            <span>🌐 ${d.content?.zim_files || 0} wikis</span>
          </div>
        </div>
      </div>
      <div class="sysmon-footer">${d.server_time?.slice(11, 19) || ''} · auto-refresh 5s</div>`;
  } catch (e) {
    el.innerHTML = `<div class="guide-error">Erro ao carregar status: ${e.message}</div>`;
  }
}



// ─── Expose _sysmonInterval to window for close callbacks ────────────────────
Object.defineProperty(window, '_sysmonInterval', { get() { return _sysmonInterval; }, set(v) { _sysmonInterval = v; }, configurable: true });
