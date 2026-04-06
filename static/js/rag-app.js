// static/js/rag-app.js
// RAG Local — Document indexing and semantic search app

export function createRagApp() {
    return `
<div class="rag-app" style="height:100%;display:flex;flex-direction:column;padding:12px;gap:12px;font-family:monospace;background:#0a0a0a;color:#e0e0e0;">

    <!-- Header -->
    <div style="display:flex;align-items:center;gap:8px;border-bottom:1px solid #333;padding-bottom:8px;">
        <span style="font-size:18px;">📚</span>
        <span style="font-size:14px;font-weight:bold;color:#00ff88;">RAG Local</span>
        <span style="font-size:11px;color:#666;margin-left:auto;">Busca em documentos offline</span>
    </div>

    <!-- Upload section -->
    <div style="border:2px dashed #333;border-radius:6px;padding:16px;text-align:center;cursor:pointer;transition:border-color 0.2s;"
         id="rag-dropzone"
         ondragover="event.preventDefault();this.style.borderColor='#00ff88'"
         ondragleave="this.style.borderColor='#333'"
         ondrop="window.ragHandleDrop(event)">
        <div style="font-size:24px;margin-bottom:4px;">📄</div>
        <div style="font-size:12px;color:#aaa;">Arraste PDFs, TXTs ou MDs aqui</div>
        <div style="font-size:11px;color:#555;margin-top:4px;">ou</div>
        <button onclick="document.getElementById('rag-file-input').click()"
                style="margin-top:8px;padding:6px 16px;background:#1a1a2e;border:1px solid #00ff88;color:#00ff88;border-radius:4px;cursor:pointer;font-size:12px;">
            Selecionar arquivo
        </button>
        <input type="file" id="rag-file-input" accept=".pdf,.txt,.md" style="display:none"
               onchange="window.ragHandleFileInput(this)">
        <div id="rag-upload-status" style="margin-top:8px;font-size:11px;color:#00ff88;display:none;"></div>
    </div>

    <!-- Search section -->
    <div style="display:flex;gap:8px;">
        <input id="rag-search-input" type="text" placeholder="Pesquisar nos documentos indexados..."
               style="flex:1;padding:8px 12px;background:#111;border:1px solid #333;border-radius:4px;color:#e0e0e0;font-size:12px;font-family:monospace;"
               onkeydown="if(event.key==='Enter') window.ragSearch()"
               oninput="window.ragDebouncedSearch()">
        <button onclick="window.ragSearch()"
                style="padding:8px 16px;background:#1a1a2e;border:1px solid #00ff88;color:#00ff88;border-radius:4px;cursor:pointer;font-size:12px;">
            Buscar
        </button>
    </div>

    <!-- Tabs: Results / Documents -->
    <div style="display:flex;gap:0;border-bottom:1px solid #333;">
        <button id="rag-tab-results" onclick="window.ragShowTab('results')"
                style="padding:6px 16px;background:#0a0a0a;border:none;border-bottom:2px solid #00ff88;color:#00ff88;cursor:pointer;font-size:12px;font-family:monospace;">
            Resultados
        </button>
        <button id="rag-tab-docs" onclick="window.ragShowTab('docs')"
                style="padding:6px 16px;background:#0a0a0a;border:none;border-bottom:2px solid transparent;color:#666;cursor:pointer;font-size:12px;font-family:monospace;">
            Documentos
        </button>
    </div>

    <!-- Results panel -->
    <div id="rag-results-panel" style="flex:1;overflow-y:auto;">
        <div id="rag-results" style="display:flex;flex-direction:column;gap:8px;">
            <div style="color:#444;font-size:12px;text-align:center;padding:20px;">
                Indexe documentos e faça uma busca...
            </div>
        </div>
    </div>

    <!-- Docs panel -->
    <div id="rag-docs-panel" style="flex:1;overflow-y:auto;display:none;">
        <div id="rag-docs-list" style="display:flex;flex-direction:column;gap:6px;">
            <div style="color:#444;font-size:12px;text-align:center;padding:20px;">
                Carregando documentos...
            </div>
        </div>
    </div>

</div>`;
}

// HTML-escape helper to prevent XSS when inserting user-controlled text into innerHTML
function _ragEsc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function initRagApp() {
    // Load docs on init
    window.ragLoadDocs();

    // Upload via drop
    window.ragHandleDrop = async (event) => {
        event.preventDefault();
        document.getElementById('rag-dropzone').style.borderColor = '#333';
        const file = event.dataTransfer.files[0];
        if (file) await window.ragUploadFile(file);
    };

    window.ragHandleFileInput = async (input) => {
        const file = input.files[0];
        if (file) await window.ragUploadFile(file);
        input.value = '';
    };

    window.ragUploadFile = async (file) => {
        const status = document.getElementById('rag-upload-status');
        status.style.display = 'block';
        status.style.color = '#00ff88';
        status.textContent = `Indexando ${file.name}...`;

        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/rag/index', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.status === 'indexed') {
                status.textContent = `✓ ${file.name} — ${data.chunks} chunks indexados`;
                setTimeout(() => { status.style.display = 'none'; }, 3000);
                window.ragLoadDocs();
            } else if (data.status === 'already_indexed') {
                status.style.color = '#ffaa00';
                status.textContent = `⚠ ${file.name} já estava indexado`;
                setTimeout(() => { status.style.display = 'none'; }, 3000);
            } else {
                status.style.color = '#ff4444';
                status.textContent = `✗ Erro: ${data.message || 'falha ao indexar'}`;
            }
        } catch (e) {
            status.style.color = '#ff4444';
            status.textContent = `✗ Erro de conexão: ${e.message}`;
        }
    };

    // Debounced search — fires 300ms after user stops typing (min 3 chars)
    let _ragSearchTimer = null;
    window.ragDebouncedSearch = () => {
        clearTimeout(_ragSearchTimer);
        const query = document.getElementById('rag-search-input').value.trim();
        if (query.length < 3) return;
        _ragSearchTimer = setTimeout(() => window.ragSearch(), 300);
    };

    window.ragSearch = async () => {
        const query = document.getElementById('rag-search-input').value.trim();
        if (!query) return;

        const resultsEl = document.getElementById('rag-results');
        resultsEl.innerHTML = '<div style="color:#555;font-size:12px;text-align:center;padding:12px;">Buscando...</div>';
        window.ragShowTab('results');

        try {
            const res = await fetch(`/api/rag/search?q=${encodeURIComponent(query)}&top_k=8`);
            const data = await res.json();

            if (!data.results || data.results.length === 0) {
                resultsEl.innerHTML = '<div style="color:#555;font-size:12px;text-align:center;padding:20px;">Nenhum resultado encontrado. Indexe mais documentos.</div>';
                return;
            }

            resultsEl.innerHTML = data.results.map(r => {
                const preview = _ragEsc(r.chunk_text.substring(0, 300)) + (r.chunk_text.length > 300 ? '...' : '');
                return `
                <div style="background:#111;border:1px solid #222;border-radius:6px;padding:12px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-size:11px;color:#00ff88;font-weight:bold;">${_ragEsc(r.filename)}</span>
                        <span style="font-size:10px;color:#555;">score: ${_ragEsc(String(r.score))} | chunk #${_ragEsc(String(r.chunk_index))}</span>
                    </div>
                    <div style="font-size:12px;color:#ccc;line-height:1.5;">${preview}</div>
                </div>`;
            }).join('');
        } catch (e) {
            resultsEl.innerHTML = `<div style="color:#ff4444;font-size:12px;">Erro: ${e.message}</div>`;
        }
    };

    window.ragLoadDocs = async () => {
        try {
            const res = await fetch('/api/rag/docs');
            const data = await res.json();
            const listEl = document.getElementById('rag-docs-list');

            if (!data.docs || data.docs.length === 0) {
                listEl.innerHTML = '<div style="color:#444;font-size:12px;text-align:center;padding:20px;">Nenhum documento indexado ainda.</div>';
                return;
            }

            // Build doc list using DOM manipulation to avoid XSS from filenames/IDs
            listEl.innerHTML = '';
            data.docs.forEach(doc => {
                const outer = document.createElement('div');
                outer.style.cssText = 'background:#111;border:1px solid #222;border-radius:6px;padding:10px;display:flex;align-items:center;gap:10px;';

                const icon = document.createElement('span');
                icon.style.fontSize = '18px';
                icon.textContent = doc.file_type === 'pdf' ? '\uD83D\uDCD5' : '\uD83D\uDCC4';

                const info = document.createElement('div');
                info.style.cssText = 'flex:1;min-width:0;';

                const nameDiv = document.createElement('div');
                nameDiv.style.cssText = 'font-size:12px;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
                nameDiv.textContent = doc.filename;

                const metaDiv = document.createElement('div');
                metaDiv.style.cssText = 'font-size:10px;color:#555;margin-top:2px;';
                const dateStr = (doc.created_at || '').split('T')[0] || (doc.created_at || '').split(' ')[0];
                metaDiv.textContent = `${doc.chunk_count} chunks · ${dateStr}`;

                info.appendChild(nameDiv);
                info.appendChild(metaDiv);

                const btn = document.createElement('button');
                btn.style.cssText = 'padding:4px 10px;background:transparent;border:1px solid #ff4444;color:#ff4444;border-radius:4px;cursor:pointer;font-size:11px;white-space:nowrap;';
                btn.textContent = 'Remover';
                btn.addEventListener('click', () => window.ragDeleteDoc(doc.id, doc.filename));

                outer.appendChild(icon);
                outer.appendChild(info);
                outer.appendChild(btn);
                listEl.appendChild(outer);
            });
        } catch (e) {
            console.error('RAG: erro ao carregar docs', e);
        }
    };

    window.ragDeleteDoc = async (docId, filename) => {
        if (!confirm(`Remover "${filename}" do índice?`)) return;
        try {
            await fetch(`/api/rag/docs/${docId}`, { method: 'DELETE' });
            window.ragLoadDocs();
        } catch (e) {
            alert(`Erro ao remover: ${e.message}`);
        }
    };

    window.ragShowTab = (tab) => {
        const resultsPanel = document.getElementById('rag-results-panel');
        const docsPanel = document.getElementById('rag-docs-panel');
        const tabResults = document.getElementById('rag-tab-results');
        const tabDocs = document.getElementById('rag-tab-docs');

        if (tab === 'results') {
            resultsPanel.style.display = 'block';
            docsPanel.style.display = 'none';
            tabResults.style.borderBottomColor = '#00ff88';
            tabResults.style.color = '#00ff88';
            tabDocs.style.borderBottomColor = 'transparent';
            tabDocs.style.color = '#666';
        } else {
            resultsPanel.style.display = 'none';
            docsPanel.style.display = 'block';
            tabDocs.style.borderBottomColor = '#00ff88';
            tabDocs.style.color = '#00ff88';
            tabResults.style.borderBottomColor = 'transparent';
            tabResults.style.color = '#666';
            window.ragLoadDocs();
        }
    };
}
