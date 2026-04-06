/* ═══ Bunker OS — Map App ═══ */

// ─── Global aliases from window (set by main.js) ─────────────────────────────
const { state, storage, escapeHtml, markdownToHtml, guidesCache, LOADING_PHRASES,
        OS_APPS, _windows, openApp, closeWindow, focusWindow, osToast, openSavedApp,
        saveChats, saveFavorites, renderChatList, restoreChat, renderFavorites,
        addFavorite, removeFavorite, isFavorited, genId,
        renderDesktopIcons, startTaskbarClock, applyWallpaper, restoreSession,
        addMsgDom, addStreamMsgDom, addMsgActions, streamFromAPI, scrollChat,
        showView, showChatView, showGuideView,
        setGuidesIndex, setProtocolsIndex, setGamesIndex, setSearchIndex } = window;



// ─── Map ─────────────────────────────────────────────────────────────────────
const mapState = {
  leafletMap: null,
  initialized: false,
  markers: [],       // [{ id, lat, lng, label, leafletMarker }]
  markerMode: false,
  measureMode: false,
  measurePoints: [],
  measureLine: null,
  myLocationMarker: null,
  myLocationCircle: null,
  offlinePmtiles: null,  // PMTiles filename if loaded
  pmtilesLoaded: false,
};
window.mapState = mapState;

function openMap() {
  openApp('map');
}

// ─── Map Download Panel (inside Maps app) ─────────────────────────────────

function toggleMapDownloadPanel() {
  const panel = document.getElementById('mapDownloadPanel');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  if (isHidden) loadMapDownloadPanel();
}

async function loadMapDownloadPanel() {
  const body = document.getElementById('mapDownloadPanelBody');
  if (!body) return;
  body.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-muted)">Carregando...</div>';
  try {
    const [mapsRes, availRes] = await Promise.all([
      fetch('/api/maps').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch('/api/maps/available').then(r => r.ok ? r.json() : { regions: [] }).catch(() => ({ regions: [] })),
    ]);
    const maps = mapsRes.maps || [];
    const regions = availRes.regions || [];

    body.textContent = '';

    // Installed
    if (maps.length > 0) {
      const secTitle = document.createElement('div');
      secTitle.className = 'mdl-section-title';
      secTitle.textContent = 'Instalados';
      body.appendChild(secTitle);
      for (const m of maps) {
        const item = document.createElement('div');
        item.className = 'mdl-item installed';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = m.name || m.file;
        const sizeSpan = document.createElement('span');
        sizeSpan.className = 'mdl-size';
        sizeSpan.textContent = `${parseFloat(m.size_mb) || 0} MB`;
        item.appendChild(nameSpan);
        item.appendChild(sizeSpan);
        body.appendChild(item);
      }
    }

    // Available for download
    const notInstalled = regions.filter(r => !r.installed);
    if (notInstalled.length > 0) {
      const secTitle2 = document.createElement('div');
      secTitle2.className = 'mdl-section-title';
      secTitle2.style.marginTop = '8px';
      secTitle2.textContent = 'Disponiveis para download';
      body.appendChild(secTitle2);
      for (const r of notInstalled) {
        // Sanitize the region id: only allow alphanumeric, hyphens, underscores
        const safeId = String(r.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeId) continue;

        const item = document.createElement('div');
        item.className = 'mdl-item';
        item.id = 'mdlItem_' + safeId;

        const info = document.createElement('div');
        info.className = 'mdl-info';
        const nameDiv = document.createElement('div');
        nameDiv.className = 'mdl-name';
        nameDiv.textContent = r.name || safeId;
        const descDiv = document.createElement('div');
        descDiv.className = 'mdl-desc';
        descDiv.textContent = `${r.desc || ''} (~${parseFloat(r.est_mb) || 0} MB)`;
        info.appendChild(nameDiv);
        info.appendChild(descDiv);

        const dlBtn = document.createElement('button');
        dlBtn.className = 'btn-sm btn-accent';
        dlBtn.textContent = 'Baixar';
        dlBtn.onclick = () => startMapDownloadInPanel(safeId);

        const prog = document.createElement('div');
        prog.className = 'mdl-progress hidden';
        prog.id = 'mdlProg_' + safeId;
        prog.innerHTML = `<div class="setup-bar-track"><div class="setup-bar" id="mdlBar_${safeId}" style="width:0%"></div></div><span class="mdl-status" id="mdlStat_${safeId}">Preparando...</span>`;

        item.appendChild(info);
        item.appendChild(dlBtn);
        item.appendChild(prog);
        body.appendChild(item);
      }
    }

    if (!body.children.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align:center;padding:12px;color:var(--accent)';
      empty.textContent = 'Todos os mapas ja estao instalados!';
      body.appendChild(empty);
    }
  } catch (e) {
    body.textContent = '';
    const errDiv = document.createElement('div');
    errDiv.style.cssText = 'color:var(--error);padding:12px';
    errDiv.textContent = 'Erro: ' + e.message;
    body.appendChild(errDiv);
  }
}

async function startMapDownloadInPanel(regionId) {
  const btn = document.querySelector(`#mdlItem_${regionId} button`);
  const prog = document.getElementById('mdlProg_' + regionId);
  const stat = document.getElementById('mdlStat_' + regionId);
  const bar = document.getElementById('mdlBar_' + regionId);

  if (btn) btn.disabled = true;
  if (prog) prog.classList.remove('hidden');

  try {
    const r = await fetch('/api/maps/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region: regionId }),
    });

    if (r.headers.get('content-type')?.includes('json')) {
      const d = await r.json();
      if (d.status === 'already_installed') {
        if (stat) stat.textContent = `Ja instalado (${d.size_mb} MB)`;
        if (bar) bar.style.width = '100%';
        return;
      }
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const d = JSON.parse(line.slice(6));
          if (d.status === 'extracting') {
            if (stat) stat.textContent = `Extraindo (~${d.est_mb || '?'} MB)...`;
            if (bar) bar.style.width = '30%';
          } else if (d.status === 'progress') {
            if (stat) stat.textContent = d.message;
            if (bar) bar.style.width = '60%';
          } else if (d.status === 'done') {
            if (stat) stat.textContent = `Pronto! (${d.size_mb} MB)`;
            if (bar) { bar.style.width = '100%'; bar.style.background = 'var(--accent)'; }
            if (btn) btn.textContent = 'Instalado';
            // Reload panel after 2s
            setTimeout(() => loadMapDownloadPanel(), 2000);
          } else if (d.status === 'error') {
            if (stat) stat.textContent = `Erro: ${d.message}`;
            if (btn) { btn.disabled = false; btn.textContent = 'Tentar novamente'; }
          }
        } catch {}
      }
    }
  } catch (e) {
    if (stat) stat.textContent = `Erro: ${e.message}`;
    if (btn) { btn.disabled = false; btn.textContent = 'Tentar novamente'; }
  }
}

function closeMap() {
  // In window mode, close the map window
  const win = Object.values(_windows).find(w => w.appId === 'map');
  if (win) closeWindow(win.winId);
}

window._mapInit = initMap;

async function initMap() {
  // Default to center of Brazil
  const defaultLat = -15.79;
  const defaultLng = -47.88;
  const defaultZoom = 4;

  const map = L.map("leafletMap", {
    center: [defaultLat, defaultLng],
    zoom: defaultZoom,
    zoomControl: true,
  });

  // Try to load offline PMTiles first, fall back to online tiles
  let usingOffline = false;
  try {
    const mapsResp = await fetch("/api/maps");
    if (!mapsResp.ok) throw new Error(`HTTP ${mapsResp.status}`);
    const mapsData = await mapsResp.json();
    if (mapsData.maps && mapsData.maps.length > 0) {
      // Load PMTiles JS library dynamically if not loaded (local copies)
      if (typeof pmtiles === "undefined" && typeof protomapsL === "undefined") {
        await loadScript("./lib/pmtiles.js");
        await loadScript("./lib/protomaps-leaflet.js");
      }

      // Sort: world/basic first (background), then regional (more detail on top)
      const sorted = [...mapsData.maps].sort((a, b) => {
        const aIsWorld = a.name.includes('world') || a.name.includes('basic');
        const bIsWorld = b.name.includes('world') || b.name.includes('basic');
        if (aIsWorld && !bIsWorld) return -1;
        if (!aIsWorld && bIsWorld) return 1;
        return a.size_mb - b.size_mb; // smaller first
      });

      mapState.offlinePmtiles = sorted.map(m => m.file).join(', ');

      // Load ALL PMTiles as layers (world as base, regional on top)
      if (typeof protomapsL !== "undefined") {
        for (const pmFile of sorted) {
          try {
            const layer = protomapsL.leafletLayer({
              url: "/maps/" + pmFile.file,
              flavor: "dark",
            });
            layer.addTo(map);
          } catch (layerErr) {
            console.warn("[Maps] Failed to load layer " + pmFile.file + ":", layerErr.message);
          }
        }
        usingOffline = true;
        mapState.pmtilesLoaded = true;
      } else if (typeof pmtiles !== "undefined") {
        // Fallback: raster layer (only first map)
        const p = new pmtiles.PMTiles("/maps/" + sorted[0].file);
        pmtiles.leafletRasterLayer(p, {
          attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://protomaps.com">Protomaps</a>',
        }).addTo(map);
        usingOffline = true;
        mapState.pmtilesLoaded = true;
      }
    }
  } catch (e) {
    console.log("PMTiles check:", e.message);
  }

  if (!usingOffline && !isOfflineMode()) {
    // Online fallback: CartoDB Dark Matter (only if not in offline mode)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
  } else if (!usingOffline) {
    // Offline mode without PMTiles — show empty map with message
    const notice = document.getElementById("mapOfflineNotice");
    if (notice) {
      notice.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f5c542" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> <span>Modo offline — coloque um .pmtiles em static/maps/ para ver o mapa</span>';
    }
  }

  // Update notice bar
  const notice = document.getElementById("mapOfflineNotice");
  if (notice) {
    if (usingOffline) {
      notice.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> <span></span>`;
      // Set the label text safely via textContent
      notice.querySelector('span').textContent =
        `Mapa offline carregado: ${mapState.offlinePmtiles} — 100% local, sem internet`;
      notice.style.borderColor = "rgba(66, 245, 160, 0.3)";
    } else {
      notice.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> <span>Tiles online (CARTO). Para 100% offline: coloque um .pmtiles em static/maps/</span>`;
    }
  }

  // Click handler
  map.on("click", (e) => {
    const { lat, lng } = e.latlng;
    document.getElementById("mapCoords").textContent =
      `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    if (mapState.markerMode) {
      const label = prompt("Nome do marcador:", `Ponto ${mapState.markers.length + 1}`);
      if (label !== null) addMapMarker(lat, lng, label);
    }

    if (mapState.measureMode) {
      mapState.measurePoints.push([lat, lng]);
      L.circleMarker([lat, lng], {
        radius: 4, color: "#f5c542", fillColor: "#f5c542", fillOpacity: 1, weight: 1,
      }).addTo(map);

      if (mapState.measurePoints.length >= 2) {
        if (mapState.measureLine) map.removeLayer(mapState.measureLine);
        mapState.measureLine = L.polyline(mapState.measurePoints, {
          color: "#f5c542", weight: 2, dashArray: "6,6",
        }).addTo(map);

        const totalDist = calcTotalDistance(mapState.measurePoints);
        const measureEl = document.getElementById("mapMeasure");
        measureEl.classList.remove("hidden");
        measureEl.textContent = formatDistance(totalDist);
      }
    }
  });

  map.on("mousemove", (e) => {
    if (!mapState.markerMode && !mapState.measureMode) {
      document.getElementById("mapCoords").textContent =
        `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    }
  });

  mapState.leafletMap = map;
  mapState.initialized = true;

  // Load saved markers
  loadSavedMarkers();

  // Try to geolocate
  locateMe();
}

// Marker functions
// Marker categories for survival
const MARKER_CATEGORIES = {
  general:  { icon: '📍', color: '#42f5a0', label: 'Geral' },
  water:    { icon: '💧', color: '#60a5fa', label: 'Agua' },
  shelter:  { icon: '🏠', color: '#a78bfa', label: 'Abrigo' },
  danger:   { icon: '⚠️', color: '#f54266', label: 'Perigo' },
  food:     { icon: '🍎', color: '#34d399', label: 'Comida' },
  medical:  { icon: '🏥', color: '#f472b6', label: 'Medico' },
  supply:   { icon: '📦', color: '#fbbf24', label: 'Suprimento' },
  route:    { icon: '🚶', color: '#38bdf8', label: 'Rota' },
};

let _activeMarkerCategory = 'general';

function setMarkerCategory(cat) {
  _activeMarkerCategory = cat;
  document.querySelectorAll('.map-cat-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.cat === cat)
  );
}

function addMapMarker(lat, lng, label, category) {
  const id = genId();
  const cat = MARKER_CATEGORIES[category || _activeMarkerCategory] || MARKER_CATEGORIES.general;
  const catId = category || _activeMarkerCategory;

  const icon = L.divIcon({
    className: "custom-marker",
    html: `<div style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:14px;filter:drop-shadow(0 0 4px ${cat.color})">${cat.icon}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  const marker = L.marker([lat, lng], { icon })
    .addTo(mapState.leafletMap)
    .bindPopup(`<strong>${cat.icon} ${escapeHtml(label)}</strong><br><span style="font-size:10px;color:#888;text-transform:uppercase">${cat.label}</span><br><span style="font-size:11px;color:#6b6c78;font-family:monospace;">${lat.toFixed(5)}, ${lng.toFixed(5)}</span><br><button onclick="removeMapMarker('${id}')" style="margin-top:6px;padding:2px 8px;background:rgba(245,66,102,0.15);border:1px solid rgba(245,66,102,0.3);border-radius:4px;color:#f54266;font-size:10px;cursor:pointer;">Remover</button>`);

  mapState.markers.push({ id, lat, lng, label, category: catId, leafletMarker: marker });
  saveMapMarkers();
  renderMarkersList();
}

function removeMapMarker(id) {
  const idx = mapState.markers.findIndex(m => m.id === id);
  if (idx === -1) return;
  mapState.leafletMap.removeLayer(mapState.markers[idx].leafletMarker);
  mapState.markers.splice(idx, 1);
  saveMapMarkers();
  renderMarkersList();
}

function clearAllMarkers() {
  if (mapState.markers.length === 0 && mapState.measurePoints.length === 0) return;
  if (!confirm("Limpar todos os marcadores e medicoes?")) return;

  for (const m of mapState.markers) {
    mapState.leafletMap.removeLayer(m.leafletMarker);
  }
  mapState.markers = [];

  // Clear measure
  if (mapState.measureLine) {
    mapState.leafletMap.removeLayer(mapState.measureLine);
    mapState.measureLine = null;
  }
  mapState.measurePoints = [];
  document.getElementById("mapMeasure").classList.add("hidden");

  // Clear circle markers from measure
  mapState.leafletMap.eachLayer(l => {
    if (l instanceof L.CircleMarker && l !== mapState.myLocationCircle) {
      mapState.leafletMap.removeLayer(l);
    }
  });

  saveMapMarkers();
  renderMarkersList();
}

function saveMapMarkers() {
  const data = mapState.markers.map(m => ({ id: m.id, lat: m.lat, lng: m.lng, label: m.label, category: m.category || 'general' }));
  storage.set("bunker_map_markers", JSON.stringify(data));
}

function loadSavedMarkers() {
  try {
    const data = storage.get("bunker_map_markers");
    if (!data) return;
    const markers = JSON.parse(data);
    for (const m of markers) {
      const lat = parseFloat(m.lat);
      const lng = parseFloat(m.lng);
      if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
      addMapMarker(lat, lng, m.label || '', m.category || 'general');
    }
  } catch {}
}

function renderMarkersList() {
  const panel = document.getElementById("mapMarkersPanel");
  const list = document.getElementById("mapMarkersList");

  if (mapState.markers.length === 0) {
    panel.classList.add("hidden");
    return;
  }

  panel.classList.remove("hidden");
  list.innerHTML = "";
  for (const m of mapState.markers) {
    const li = document.createElement("li");
    const cat = MARKER_CATEGORIES[m.category] || MARKER_CATEGORIES.general;
    li.innerHTML = `<span style="margin-right:4px">${cat.icon}</span>${escapeHtml(m.label)}`;
    li.onclick = () => {
      mapState.leafletMap.flyTo([m.lat, m.lng], 15, { duration: 1 });
      m.leafletMarker.openPopup();
    };
    list.appendChild(li);
  }
}

// Mode toggles
function toggleMarkerMode() {
  mapState.markerMode = !mapState.markerMode;
  if (mapState.markerMode) mapState.measureMode = false;
  document.getElementById("btnMarker").classList.toggle("active", mapState.markerMode);
  document.getElementById("btnMeasure").classList.remove("active");
  document.getElementById("leafletMap").style.cursor = mapState.markerMode ? "crosshair" : "";
  // Show/hide marker category bar
  const catBar = document.getElementById("mapCatBar");
  if (catBar) catBar.classList.toggle("hidden", !mapState.markerMode);
}

function toggleMeasureMode() {
  mapState.measureMode = !mapState.measureMode;
  if (mapState.measureMode) {
    mapState.markerMode = false;
    // Reset measure
    mapState.measurePoints = [];
    if (mapState.measureLine) {
      mapState.leafletMap.removeLayer(mapState.measureLine);
      mapState.measureLine = null;
    }
    document.getElementById("mapMeasure").classList.add("hidden");
    // Clear old measure circle markers
    mapState.leafletMap.eachLayer(l => {
      if (l instanceof L.CircleMarker && l !== mapState.myLocationCircle && l !== mapState.myLocationMarker) {
        mapState.leafletMap.removeLayer(l);
      }
    });
  }
  document.getElementById("btnMeasure").classList.toggle("active", mapState.measureMode);
  document.getElementById("btnMarker").classList.remove("active");
  document.getElementById("leafletMap").style.cursor = mapState.measureMode ? "crosshair" : "";
}

// GPS
function locateMe() {
  if (!navigator.geolocation) {
    alert("Geolocalizacao nao suportada neste navegador.");
    return;
  }

  document.getElementById("btnGps").classList.add("active");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;

      if (mapState.myLocationMarker) mapState.leafletMap.removeLayer(mapState.myLocationMarker);
      if (mapState.myLocationCircle) mapState.leafletMap.removeLayer(mapState.myLocationCircle);

      mapState.myLocationCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: "#42f5a0",
        fillColor: "#42f5a0",
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(mapState.leafletMap);

      mapState.myLocationMarker = L.circleMarker([lat, lng], {
        radius: 7,
        color: "#08090b",
        fillColor: "#42f5a0",
        fillOpacity: 1,
        weight: 3,
      }).addTo(mapState.leafletMap).bindPopup(`<strong>Voce esta aqui</strong><br><span style="font-size:11px;font-family:monospace;color:#6b6c78;">${lat.toFixed(5)}, ${lng.toFixed(5)}<br>Precisao: ${Math.round(accuracy)}m</span>`);

      mapState.leafletMap.flyTo([lat, lng], 15, { duration: 1.5 });
      document.getElementById("btnGps").classList.remove("active");
    },
    (err) => {
      document.getElementById("btnGps").classList.remove("active");
      console.warn("GPS error:", err.message);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// Distance calculation (Haversine)
function calcTotalDistance(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversine(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return total;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

