/* ═══ Bunker OS — Creative Apps (Paint, Imagine) ═══ */

// ─── Global aliases from window (set by main.js) ─────────────────────────────
const { state, storage, escapeHtml, markdownToHtml, guidesCache, LOADING_PHRASES,
        OS_APPS, _windows, openApp, closeWindow, focusWindow, osToast, openSavedApp,
        saveChats, saveFavorites, renderChatList, restoreChat, renderFavorites,
        addFavorite, removeFavorite, isFavorited, genId,
        renderDesktopIcons, startTaskbarClock, applyWallpaper, restoreSession,
        addMsgDom, addStreamMsgDom, addMsgActions, streamFromAPI, scrollChat,
        showView, showChatView, showGuideView,
        setGuidesIndex, setProtocolsIndex, setGamesIndex, setSearchIndex } = window;



// ─── Paint / Draw ────────────────────────────────────────────────────────────
const paintState = {
  tool: 'brush',
  color: '#00ffaa',
  size: 3,
  drawing: false,
  lastX: 0,
  lastY: 0,
  history: [],
  startX: 0,
  startY: 0,
  snapshot: null,
};
window.paintState = paintState;

function paintInit() {
  const canvas = document.getElementById('paintCanvas');
  if (!canvas) return;
  const parent = canvas.parentElement;

  function resizeCanvas() {
    const toolbarH = document.getElementById('paintToolbar')?.offsetHeight || 40;
    const w = parent.clientWidth;
    const h = parent.clientHeight - toolbarH;
    if (canvas.width !== w || canvas.height !== h) {
      // Save current content
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);
    }
  }
  resizeCanvas();

  const ctx = canvas.getContext('2d');
  paintState.history = [];
  paintSaveState();

  canvas.addEventListener('mousedown', (e) => {
    paintState.drawing = true;
    const rect = canvas.getBoundingClientRect();
    paintState.lastX = e.clientX - rect.left;
    paintState.lastY = e.clientY - rect.top;
    paintState.startX = paintState.lastX;
    paintState.startY = paintState.lastY;
    paintState.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (paintState.tool === 'fill') {
      paintFloodFill(ctx, Math.round(paintState.lastX), Math.round(paintState.lastY), paintState.color);
      paintState.drawing = false;
      paintSaveState();
    } else if (paintState.tool === 'brush' || paintState.tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(paintState.lastX, paintState.lastY);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!paintState.drawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (paintState.tool === 'brush' || paintState.tool === 'eraser') {
      ctx.lineWidth = paintState.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = paintState.tool === 'eraser' ? '#1a1a2e' : paintState.color;
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      // Preview shapes
      ctx.putImageData(paintState.snapshot, 0, 0);
      ctx.strokeStyle = paintState.color;
      ctx.lineWidth = paintState.size;
      ctx.lineCap = 'round';

      if (paintState.tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(paintState.startX, paintState.startY);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (paintState.tool === 'rect') {
        ctx.strokeRect(paintState.startX, paintState.startY, x - paintState.startX, y - paintState.startY);
      } else if (paintState.tool === 'circle') {
        const rx = Math.abs(x - paintState.startX) / 2;
        const ry = Math.abs(y - paintState.startY) / 2;
        const cx = paintState.startX + (x - paintState.startX) / 2;
        const cy = paintState.startY + (y - paintState.startY) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    paintState.lastX = x;
    paintState.lastY = y;
  });

  canvas.addEventListener('mouseup', () => {
    if (paintState.drawing) {
      paintState.drawing = false;
      paintSaveState();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (paintState.drawing) {
      paintState.drawing = false;
      paintSaveState();
    }
  });

  // Observe resize
  new ResizeObserver(resizeCanvas).observe(parent);
}
window.paintInit = paintInit;

function paintSetTool(tool) {
  paintState.tool = tool;
  document.querySelectorAll('.paint-tool[data-tool]').forEach(el => {
    el.classList.toggle('active', el.dataset.tool === tool);
  });
}
window.paintSetTool = paintSetTool;

function paintSaveState() {
  const canvas = document.getElementById('paintCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  paintState.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (paintState.history.length > 30) paintState.history.shift();
}

function paintUndo() {
  const canvas = document.getElementById('paintCanvas');
  if (!canvas || paintState.history.length < 2) return;
  paintState.history.pop(); // Remove current
  const prev = paintState.history[paintState.history.length - 1];
  canvas.getContext('2d').putImageData(prev, 0, 0);
}
window.paintUndo = paintUndo;

function paintClear() {
  const canvas = document.getElementById('paintCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  paintSaveState();
}
window.paintClear = paintClear;

function paintSave() {
  const canvas = document.getElementById('paintCanvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = 'bunker-paint-' + Date.now() + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  osToast('\u{1F4BE} Imagem salva!', 2500, 'success');
}
window.paintSave = paintSave;

function paintFloodFill(ctx, startX, startY, fillColor) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Parse fill color
  const temp = document.createElement('canvas').getContext('2d');
  temp.fillStyle = fillColor;
  temp.fillRect(0, 0, 1, 1);
  const fc = temp.getImageData(0, 0, 1, 1).data;

  const targetIdx = (startY * w + startX) * 4;
  const tr = data[targetIdx], tg = data[targetIdx + 1], tb = data[targetIdx + 2];

  if (tr === fc[0] && tg === fc[1] && tb === fc[2]) return;

  const stack = [[startX, startY]];
  const visited = new Uint8Array(w * h);

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    const idx = y * w + x;
    if (visited[idx]) continue;

    const pi = idx * 4;
    if (Math.abs(data[pi] - tr) > 30 || Math.abs(data[pi + 1] - tg) > 30 || Math.abs(data[pi + 2] - tb) > 30) continue;

    visited[idx] = 1;
    data[pi] = fc[0]; data[pi + 1] = fc[1]; data[pi + 2] = fc[2]; data[pi + 3] = 255;

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(imageData, 0, 0);
}


// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE GENERATOR (stable-diffusion.cpp via sd-server)
// ═══════════════════════════════════════════════════════════════════════════════

let _imagineHistory = [];

function imagineInit() {
  // Check if sd-server is available
  fetch("/api/imagine/status").then(r => r.json()).then(d => {
    const st = document.getElementById("imagineStatus");
    if (st) {
      st.textContent = d.available ? "sd-server conectado" : "sd-server offline";
      st.style.color = d.available ? "var(--green)" : "var(--text-muted)";
    }
  }).catch(() => {});
  // Load history
  imagineLoadHistory();
}

async function imagineGenerate() {
  const prompt = document.getElementById("imaginePrompt")?.value?.trim();
  if (!prompt) return;

  const steps = parseInt(document.getElementById("imagineSteps")?.value || "20");
  const size = parseInt(document.getElementById("imagineSize")?.value || "512");
  const status = document.getElementById("imagineStatus");
  const result = document.getElementById("imagineResult");

  if (status) { status.textContent = "Gerando..."; status.style.color = "var(--accent)"; }
  if (result) result.innerHTML = `<div style="text-align:center;color:var(--accent);">
    <div style="font-size:32px;animation:media-pulse 1.5s infinite;">🎨</div>
    <div style="font-size:12px;margin-top:8px;">Gerando imagem... (${steps} steps)</div>
  </div>`;

  try {
    const resp = await fetch("/api/imagine/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, steps, width: size, height: size }),
    });
    const data = await resp.json();
    if (data.error) {
      if (result) result.innerHTML = `<div style="text-align:center;color:var(--danger);font-size:13px;padding:20px;">
        <div style="font-size:24px;margin-bottom:8px;">⚠</div>${data.error}
      </div>`;
      if (status) { status.textContent = "Erro"; status.style.color = "var(--danger)"; }
      return;
    }
    if (data.image) {
      if (result) result.innerHTML = `<img src="${data.image}" alt="${prompt}" style="max-width:100%;max-height:100%;object-fit:contain;cursor:pointer;" onclick="window.open('${data.image}','_blank')">`;
      if (status) { status.textContent = "Pronto!"; status.style.color = "var(--green)"; }
      imagineLoadHistory();
    }
  } catch (e) {
    if (result) result.innerHTML = `<div style="text-align:center;color:var(--danger);font-size:13px;padding:20px;">
      <div style="font-size:24px;margin-bottom:8px;">⚠</div>
      sd-server não está rodando.<br>
      <code style="font-size:11px;">sd-server -m modelo.gguf --listen-port 7860</code>
    </div>`;
    if (status) { status.textContent = "Offline"; status.style.color = "var(--danger)"; }
  }
}

function imagineLoadHistory() {
  fetch("/api/imagine/history").then(r => r.json()).then(d => {
    const el = document.getElementById("imagineHistory");
    if (!el) return;
    if (!d.images || d.images.length === 0) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = d.images.slice(0, 20).map(img =>
      `<img src="${img.url}" alt="${img.filename}" style="width:52px;height:52px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer;flex-shrink:0;" onclick="document.getElementById('imagineResult').innerHTML='<img src=\\'${img.url}\\' style=\\'max-width:100%;max-height:100%;object-fit:contain;\\'>'">`
    ).join("");
  }).catch(() => {});
}

window.imagineInit = imagineInit;
window.imagineGenerate = imagineGenerate;

