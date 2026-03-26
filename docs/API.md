# Bunker AI — API Reference

> All endpoints are served by `server.py` on port **8888**.
> LLM streaming endpoints use SSE (Server-Sent Events).
> Database-backed endpoints use SQLite (`data/db/bunker.db`).

## Authentication

None. The server is designed for local use only (localhost).

## Response Formats

- **JSON**: Most endpoints return `application/json`
- **SSE**: Chat/LLM endpoints return `text/event-stream` with format:
  ```
  data: {"token": "partial text"}\n\n
  data: {"done": true, "stats": {"model": "...", "tokens": N, "tok_s": N}}\n\n
  ```
- **Raw**: Guides return `text/markdown`, files return appropriate MIME types

---

## Chat & LLM

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `POST` | `/api/chat` | Stream chat with LLM. Auto-injects RAG context when `rag: true` (default) | 1438 |
| `POST` | `/api/vision` | Vision chat — send base64 image + prompt, get LLM analysis | 1484 |
| `POST` | `/api/vision/upload` | Upload image file for vision analysis | 1501 |
| `POST` | `/api/build` | App Builder — send description, get generated HTML/CSS/JS app | 1520 |

### POST /api/chat
```json
// Request
{
  "messages": [{"role": "user", "content": "como purificar agua?"}],
  "model": "gemma3:12b",  // optional, uses auto-selected if empty
  "system": "You are...",  // optional system prompt
  "rag": true              // optional, default true — inject RAG context
}
// Response: SSE stream
data: {"token": "Para purificar"}
data: {"token": " agua, voce pode..."}
data: {"done": true, "stats": {"model": "gemma3:12b", "tokens": 150, "tok_s": 25.3}}
```

### POST /api/build
```json
// Request
{ "prompt": "calculadora cientifica", "model": "qwen2.5-coder:14b" }
// Response: SSE stream of HTML code
```

---

## Speech (STT / TTS)

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `POST` | `/api/stt` | Speech-to-text — upload audio, get transcription | 1075 |
| `POST` | `/api/tts` | Text-to-speech — send text, get audio file | 1116 |
| `GET` | `/api/tts/piper-models` | List available Piper TTS voices | 1243 |
| `POST` | `/api/tts/download-piper-model` | Download a Piper voice model | 1254 |
| `GET` | `/api/tts/pyttsx3/voices` | List system TTS voices (pyttsx3) | 1323 |
| `GET` | `/api/tts/kokoro/status` | Check Kokoro TTS availability | 1353 |
| `POST` | `/api/tts/kokoro/download` | Download Kokoro TTS model | 1377 |
| `GET` | `/api/tts/kokoro/voices` | List Kokoro voice options | 1430 |

---

## RAG (Retrieval-Augmented Generation)

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `GET` | `/api/rag/status` | RAG index status (chunks, embeddings, docs) | 2436 |
| `GET` | `/api/rag/search?q=...&top_k=5` | Search RAG index (FTS5 + semantic) | 2450 |
| `POST` | `/api/rag/upload` | Upload document for indexing (.txt, .md, .csv) | 2459 |
| `GET` | `/api/rag/documents` | List uploaded documents | 2511 |
| `DELETE` | `/api/rag/documents/{filename}` | Remove document from index | 2520 |
| `POST` | `/api/rag/reindex` | Force reindex all guides/protocols | 2536 |

### GET /api/rag/status
```json
{
  "indexed": true,
  "total_chunks": 245,
  "with_embeddings": 245,
  "user_documents": 3
}
```

### GET /api/rag/search?q=purificacao+agua&top_k=3
```json
{
  "query": "purificacao agua",
  "results": [
    {
      "source": "guide",           // "guide", "protocol", or "upload"
      "source_id": "water",
      "title": "Purificacao e Obtencao de Agua",
      "content": "chunk text...",
      "score": 0.87,
      "method": "semantic"          // "fts" or "semantic"
    }
  ]
}
```

### POST /api/rag/upload
```
Content-Type: multipart/form-data
file: (binary .txt/.md/.csv)

Response:
{ "ok": true, "filename": "manual.txt", "chunks": 12, "size_kb": 45 }
```

---

## Guides & Protocols

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `GET` | `/api/guides` | List all guides (from _index.json) | 2552 |
| `GET` | `/api/guides/{id}` | Get guide markdown content | 2565 |
| `GET` | `/api/guides/progress/all` | Get progress for all guides | 2579 |
| `GET` | `/api/guides/{id}/progress` | Get progress for one guide | 2588 |
| `PUT` | `/api/guides/{id}/progress` | Update guide progress | 2599 |
| `GET` | `/api/protocols` | List all protocols | 2624 |
| `GET` | `/api/protocols/{id}` | Get protocol decision tree (JSON) | 2642 |

### PUT /api/guides/{id}/progress
```json
// Request
{ "status": "reading", "read_pct": 65, "notes": "revisar secao de filtros" }
// Status options: "unread", "reading", "completed"

// Response
{ "ok": true, "guide_id": "water", "status": "reading", "read_pct": 65 }
```

---

## Supplies (Inventory)

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `GET` | `/api/supplies` | List all supplies | 2654 |
| `GET` | `/api/supplies/summary` | Summary by category | 2666 |
| `POST` | `/api/supplies` | Add supply item | 2690 |
| `PUT` | `/api/supplies/{id}` | Update supply | 2706 |
| `DELETE` | `/api/supplies/{id}` | Delete supply | 2730 |

---

## Books

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `GET` | `/api/books` | List all books | 2741 |
| `GET` | `/api/books/{id}/file` | Serve EPUB file | 2756 |
| `PUT` | `/api/books/{id}/progress` | Update read percentage | 2770 |

---

## Games

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `GET` | `/api/games` | List all games (HTML5 + ROMs) | 2796 |
| `GET` | `/api/games/rom-player` | Get ROM emulator HTML | 2829 |
| `GET` | `/api/games/{name}` | Serve game HTML file | 2867 |

---

## Journal

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `GET` | `/api/journal` | Get journal entries | 2879 |
| `POST` | `/api/journal` | Create/update journal entry | 2888 |
| `GET` | `/api/journal/logs` | Get journal log entries | 2908 |
| `POST` | `/api/journal/logs` | Add journal log | 2917 |
| `DELETE` | `/api/journal/logs/{id}` | Delete journal log | 2935 |

---

## Wikipedia (Kiwix)

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `GET` | `/api/kiwix/status` | Kiwix status + ZIM file list | 2947 |
| `GET` | `/api/kiwix/{path}` | Proxy to Kiwix server (port 8889) | 2969 |

---

## Offline Library (ZIM Manager)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/zim/catalog` | List all ZIM archives (available + installed) |
| `POST` | `/api/zim/download` | Download a ZIM archive (SSE progress stream) |
| `GET` | `/api/zim/progress/{id}` | Get download progress for a ZIM |
| `DELETE` | `/api/zim/{id}` | Delete a ZIM archive and restart Kiwix |

### GET /api/zim/catalog
```json
{
  "catalog": [
    {
      "id": "wikipedia_mini",
      "name": "Wikipedia Mini",
      "desc": "Wikipedia resumida (~110K artigos em ingles)",
      "url": "https://download.kiwix.org/zim/...",
      "est_mb": 1100,
      "category": "encyclopedia",
      "installed": false
    }
  ],
  "installed": ["wikipedia_medicine"]
}
```

### POST /api/zim/download
```json
// Request
{ "id": "wikipedia_medicine" }
// Response: SSE stream
data: {"status": "starting", "id": "wikipedia_medicine", "name": "Wikipedia Medicina", "est_mb": 700}
data: {"status": "progress", "pct": 45, "dl_mb": 315.2, "total_mb": 700.0}
data: {"status": "done", "size_mb": 698.5, "name": "Wikipedia Medicina"}
data: {"status": "restarting_kiwix"}
```

---

## Maps

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `GET` | `/api/maps` | List installed PMTiles files | 1609 |
| `GET` | `/maps/{filename}` | Serve PMTiles with Range Requests (HTTP 206) | 1622 |
| `GET` | `/api/maps/available` | List downloadable map regions | 1716 |
| `POST` | `/api/maps/download` | Download map region (SSE progress) | 1731 |
| `DELETE` | `/api/maps/{filename}` | Delete map file | 1798 |

---

## Models Management

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `POST` | `/api/models/pull` | Pull Ollama model by name | 1813 |
| `GET` | `/api/models/recommended` | List recommended models with descriptions | 1828 |
| `GET` | `/api/models/local` | List local GGUF models | 1953 |
| `POST` | `/api/models/local/download` | Download GGUF model from HuggingFace | 1996 |
| `GET` | `/api/models/local/progress/{id}` | Download progress for GGUF | 2018 |
| `DELETE` | `/api/models/local/{id}` | Delete local GGUF model | 2085 |

---

## Notes & Tasks

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `GET` | `/api/notes` | List all notes | 3096 |
| `GET` | `/api/notes/{id}` | Get single note | 3112 |
| `POST` | `/api/notes` | Create note | 3122 |
| `PUT` | `/api/notes/{id}` | Update note | 3139 |
| `DELETE` | `/api/notes/{id}` | Delete note | 3158 |
| `GET` | `/api/tasks` | List tasks (filterable by status/category) | 3169 |
| `POST` | `/api/tasks` | Create task | 3189 |
| `PUT` | `/api/tasks/{id}` | Update task | 3208 |
| `DELETE` | `/api/tasks/{id}` | Delete task | 3230 |

---

## Terminal & Files

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `POST` | `/api/terminal` | Execute shell command (sandboxed) | 3280 |
| `GET` | `/api/files?path=...` | List directory contents | 3321 |
| `GET` | `/api/files/read?path=...` | Read file content | 3353 |

---

## Image Generation (Imagine)

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `GET` | `/api/imagine/status` | StableDiffusion backend status | 3563 |
| `GET` | `/api/imagine/binary/status` | Check if SD binary is installed | 3663 |
| `POST` | `/api/imagine/binary/download` | Download SD binary | 3683 |
| `GET` | `/api/imagine/binary/progress` | Binary download progress | 3698 |
| `GET` | `/api/imagine/models` | List SD models | 3764 |
| `POST` | `/api/imagine/models/download` | Download SD model | 3809 |
| `GET` | `/api/imagine/models/progress/{id}` | Model download progress | 3832 |
| `DELETE` | `/api/imagine/models/{id}` | Delete SD model | 3890 |
| `POST` | `/api/imagine/enhance` | Enhance prompt with LLM | 3903 |
| `POST` | `/api/imagine/generate` | Generate image | 3957 |
| `GET` | `/api/imagine/view/{filename}` | View generated image | 4037 |
| `GET` | `/api/imagine/history` | List generated images | 4047 |
| `DELETE` | `/api/imagine/history/{filename}` | Delete generated image | 4069 |

---

## USB Pendrive

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `GET` | `/api/pendrive/drives` | List available USB drives | 4115 |
| `GET` | `/api/pendrive/estimate` | Estimate build size | 4194 |
| `POST` | `/api/pendrive/prepare` | Start portable build to USB | 4406 |
| `GET` | `/api/pendrive/progress` | Build progress | 4437 |
| `POST` | `/api/pendrive/cancel` | Cancel active build | 4443 |

---

## System & Config

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `GET` | `/api/health` | Health check + LLM model listing | 967 |
| `GET` | `/api/status` | Full system status (CPU, RAM, GPU, models, etc.) | 3006 |
| `POST` | `/api/config/offline` | Save offline config preferences | 950 |
| `GET` | `/api/config/offline` | Get offline config | 960 |
| `GET` | `/api/setup/status` | Report what offline content is downloaded | 2988 |

---

## App Builder (Saved Apps)

| Method | Path | Description | Line |
|--------|------|-------------|------|
| `POST` | `/api/build/save` | Save generated app | 1560 |
| `GET` | `/api/build/list` | List saved apps | 1573 |
| `DELETE` | `/api/build/{name}` | Delete saved app | 1583 |
| `GET` | `/api/build/preview/{name}` | Serve saved app HTML | 1595 |
