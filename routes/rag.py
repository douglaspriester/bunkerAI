"""RAG (Retrieval-Augmented Generation) endpoints."""

import hashlib
import sqlite3

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import JSONResponse

import routes.config as cfg

router = APIRouter(tags=["rag"])

RAG_DB = str(cfg.DATA_DIR / "rag.db")

_MAX_RAG_FILE_BYTES = 50 * 1024 * 1024   # 50 MB — reject larger files
_MAX_RAG_CHUNKS = 2000                    # per document — truncate with warning


# ─── Text helpers ─────────────────────────────────────────────────────────────

def _rag_extract_text(content: bytes, filename: str) -> str:
    """Extract plain text from PDF, TXT, or MD files."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else "txt"
    if ext == "pdf":
        try:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(content))
            return "\n\n".join(
                page.extract_text() or "" for page in reader.pages
            )
        except Exception as e:
            return f"[Erro ao extrair PDF: {e}]"
    else:
        try:
            return content.decode("utf-8", errors="replace")
        except Exception:
            return content.decode("latin-1", errors="replace")


def _rag_chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list:
    """Split text into overlapping chunks by words.

    Handles documents with no whitespace (e.g. accidental binary uploads) by
    falling back to fixed-width character chunks so we don't return a single
    enormous string as a single chunk.
    """
    words = text.split()
    if not words:
        return []

    # No-whitespace edge case: text.split() yields a single token that is the
    # entire file content.  Treat as character-level chunking to avoid a 1-chunk
    # document that could be millions of chars long.
    if len(words) == 1 and len(text) > chunk_size * 6:
        char_chunk = chunk_size * 6  # ~3000 chars per chunk
        char_overlap = overlap * 6
        chunks = []
        i = 0
        while i < len(text):
            chunk = text[i:i + char_chunk]
            chunks.append(chunk)
            i += char_chunk - char_overlap
        return [c for c in chunks if len(c.strip()) > 20]

    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return [c for c in chunks if len(c.strip()) > 20]


def _rag_bm25_search(query: str, top_k: int = 5) -> list:
    """BM25 search over all indexed chunks."""
    try:
        from rank_bm25 import BM25Okapi
    except ImportError:
        return []

    con = sqlite3.connect(RAG_DB)
    con.row_factory = sqlite3.Row
    rows = con.execute("SELECT id, doc_id, filename, chunk_index, chunk_text FROM rag_chunks").fetchall()
    con.close()

    if not rows:
        return []

    tokenized_corpus = [row["chunk_text"].lower().split() for row in rows]
    bm25 = BM25Okapi(tokenized_corpus)
    tokenized_query = query.lower().split()
    scores = bm25.get_scores(tokenized_query)

    top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]

    results = []
    for idx in top_indices:
        if scores[idx] > 0:
            row = rows[idx]
            results.append({
                "chunk_id": row["id"],
                "doc_id": row["doc_id"],
                "filename": row["filename"],
                "chunk_index": row["chunk_index"],
                "chunk_text": row["chunk_text"],
                "score": round(float(scores[idx]), 4),
            })
    return results


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/api/rag/index")
async def rag_index_document(file: UploadFile = File(...)):
    """Index a document (PDF, TXT, MD) for RAG search."""
    content = await file.read()
    filename = file.filename or "document.txt"

    if len(content) > _MAX_RAG_FILE_BYTES:
        return JSONResponse(
            {"status": "error", "message": f"Arquivo muito grande (max {_MAX_RAG_FILE_BYTES // (1024*1024)} MB)"},
            status_code=400,
        )

    doc_id = hashlib.md5(content).hexdigest()

    con = sqlite3.connect(RAG_DB)
    existing = con.execute("SELECT id FROM rag_docs WHERE id = ?", (doc_id,)).fetchone()
    if existing:
        con.close()
        return JSONResponse({"status": "already_indexed", "doc_id": doc_id, "filename": filename})

    text = _rag_extract_text(content, filename)
    if not text.strip():
        con.close()
        return JSONResponse({"status": "error", "message": "Nenhum texto extraido do arquivo"}, status_code=400)

    chunks = _rag_chunk_text(text)
    if not chunks:
        con.close()
        return JSONResponse({"status": "error", "message": "Nenhum chunk gerado"}, status_code=400)

    truncated = False
    if len(chunks) > _MAX_RAG_CHUNKS:
        print(f"[RAG] {filename}: {len(chunks)} chunks truncated to {_MAX_RAG_CHUNKS}")
        chunks = chunks[:_MAX_RAG_CHUNKS]
        truncated = True

    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else "txt"
    con.execute(
        "INSERT INTO rag_docs (id, filename, file_type, chunk_count) VALUES (?, ?, ?, ?)",
        (doc_id, filename, ext, len(chunks))
    )
    for i, chunk in enumerate(chunks):
        con.execute(
            "INSERT INTO rag_chunks (doc_id, filename, chunk_index, chunk_text) VALUES (?, ?, ?, ?)",
            (doc_id, filename, i, chunk)
        )
    con.commit()
    con.close()

    response: dict = {
        "status": "indexed",
        "doc_id": doc_id,
        "filename": filename,
        "chunks": len(chunks),
    }
    if truncated:
        response["warning"] = f"Documento truncado para {_MAX_RAG_CHUNKS} chunks"
    return JSONResponse(response)


@router.get("/api/rag/search")
async def rag_search(q: str, top_k: int = 5):
    """Search indexed documents using BM25."""
    if not q.strip():
        return JSONResponse({"results": []})

    results = _rag_bm25_search(q.strip(), top_k=min(top_k, 20))
    return JSONResponse({"query": q, "results": results})


@router.get("/api/rag/docs")
async def rag_list_docs():
    """List all indexed documents."""
    con = sqlite3.connect(RAG_DB)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        "SELECT id, filename, file_type, chunk_count, created_at FROM rag_docs ORDER BY created_at DESC"
    ).fetchall()
    con.close()
    return JSONResponse({"docs": [dict(r) for r in rows]})


@router.delete("/api/rag/docs/{doc_id}")
async def rag_delete_doc(doc_id: str):
    """Delete an indexed document and all its chunks."""
    con = sqlite3.connect(RAG_DB)
    con.execute("DELETE FROM rag_chunks WHERE doc_id = ?", (doc_id,))
    con.execute("DELETE FROM rag_docs WHERE id = ?", (doc_id,))
    con.commit()
    con.close()
    return JSONResponse({"status": "deleted", "doc_id": doc_id})


@router.post("/api/rag/context")
async def rag_get_context(request: Request):
    """Given a query, return the most relevant chunks as context string."""
    body = await request.json()
    query = body.get("query", "")
    top_k = body.get("top_k", 3)

    if not query.strip():
        return JSONResponse({"context": ""})

    results = _rag_bm25_search(query, top_k=top_k)
    if not results:
        return JSONResponse({"context": ""})

    context_parts = []
    for r in results:
        context_parts.append(f"[{r['filename']}]\n{r['chunk_text']}")

    context = "\n\n---\n\n".join(context_parts)
    return JSONResponse({"context": context, "sources": [r["filename"] for r in results]})
