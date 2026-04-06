"""Chat, vision, streaming, and app-builder endpoints."""

import json
import re
import shutil
import sqlite3
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

import routes.config as cfg

router = APIRouter(tags=["chat"])


# ─── Streaming helpers ────────────────────────────────────────────────────────

def _chat_stream(payload: dict, timeout: float = 300.0) -> StreamingResponse:
    """Stream chat tokens as SSE — supports Ollama and llama.cpp backends."""
    if not payload.get("model"):
        status = cfg._auto_download_status
        if status.get("status") == "downloading":
            msg = f"Modelo sendo baixado ({status.get('model', '?')}: {status.get('percent', 0)}%). Aguarde..."
        elif cfg.BACKEND == "none" or not cfg.BACKEND:
            msg = "Nenhum modelo de IA disponivel. Baixe um modelo em Configuracoes > Modelos IA."
        else:
            msg = "Nenhum modelo selecionado. Escolha um modelo no painel lateral."

        async def _err():
            yield f"data: {json.dumps({'token': msg})}\n\n"

        return StreamingResponse(_err(), media_type="text/event-stream")

    if cfg.BACKEND == "llama.cpp" and cfg.LLAMA_CPP_URL:
        return _chat_stream_llamacpp(payload, timeout)
    return _chat_stream_ollama(payload, timeout)


def _chat_stream_ollama(payload: dict, timeout: float) -> StreamingResponse:
    """Stream from Ollama /api/chat."""

    async def generate():
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as c:
            async with c.stream("POST", f"{cfg.OLLAMA_BASE}/api/chat", json=payload) as resp:
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        token = chunk.get("message", {}).get("content", "")
                        if token:
                            yield f"data: {json.dumps({'token': token})}\n\n"
                        if chunk.get("done"):
                            stats = {}
                            stats["model"] = chunk.get("model", payload.get("model", ""))
                            eval_count = chunk.get("eval_count", 0)
                            eval_duration = chunk.get("eval_duration", 0)
                            prompt_eval_count = chunk.get("prompt_eval_count", 0)
                            total_duration = chunk.get("total_duration", 0)
                            if eval_duration > 0 and eval_count > 0:
                                stats["tokens"] = eval_count
                                stats["tok_s"] = round(eval_count / (eval_duration / 1e9), 1)
                            if prompt_eval_count:
                                stats["prompt_tokens"] = prompt_eval_count
                            if total_duration > 0:
                                stats["total_s"] = round(total_duration / 1e9, 1)
                            yield f"data: {json.dumps({'done': True, 'stats': stats})}\n\n"
                    except json.JSONDecodeError:
                        pass

    return StreamingResponse(generate(), media_type="text/event-stream")


def _chat_stream_llamacpp(payload: dict, timeout: float) -> StreamingResponse:
    """Stream from llama.cpp server (OpenAI-compatible /v1/chat/completions)."""
    messages = payload.get("messages", [])
    oai_messages = []
    for m in messages:
        msg = {"role": m.get("role", "user"), "content": m.get("content", "")}
        oai_messages.append(msg)

    oai_payload = {
        "messages": oai_messages,
        "stream": True,
        "temperature": payload.get("options", {}).get("temperature", 0.7),
        "max_tokens": payload.get("options", {}).get("num_predict", 2048),
    }

    async def generate():
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as c:
                async with c.stream(
                    "POST", f"{cfg.LLAMA_CPP_URL}/v1/chat/completions",
                    json=oai_payload,
                    headers={"Content-Type": "application/json"},
                ) as resp:
                    async for line in resp.aiter_lines():
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue
                        data = line[6:]
                        if data == "[DONE]":
                            yield f"data: {json.dumps({'done': True})}\n\n"
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            token = delta.get("content", "")
                            if token:
                                yield f"data: {json.dumps({'token': token})}\n\n"
                        except (json.JSONDecodeError, IndexError, KeyError):
                            pass
        except httpx.ConnectError:
            yield f"data: {json.dumps({'token': '[Erro: servidor LLM nao conectado]'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ─── RAG helper (inline to avoid circular import) ────────────────────────────

def _rag_bm25_search(query: str, top_k: int = 5) -> list:
    """BM25 search over all indexed RAG chunks."""
    try:
        from rank_bm25 import BM25Okapi
    except ImportError:
        return []

    con = sqlite3.connect("data/rag.db")
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


# ─── Chat endpoints ───────────────────────────────────────────────────────────

@router.post("/api/chat")
async def chat(request: Request):
    if cfg._check_rate_limit("chat", request.client.host if request.client else "local"):
        return JSONResponse({"error": "Limite de taxa excedido. Aguarde."}, status_code=429)
    body = await request.json()
    model = cfg.get_model("chat", body.get("model", ""))
    messages = body.get("messages", [])
    system = body.get("system", "")

    # RAG context injection
    last_user_msg = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            content = m.get("content", "")
            last_user_msg = content if isinstance(content, str) else ""
            break

    if last_user_msg:
        try:
            con = sqlite3.connect("data/rag.db")
            has_docs = con.execute("SELECT COUNT(*) FROM rag_docs").fetchone()[0]
            con.close()
            if has_docs > 0:
                rag_results = _rag_bm25_search(last_user_msg, top_k=3)
                if rag_results:
                    rag_context = "\n\n---\n\n".join(
                        f"[{r['filename']}]\n{r['chunk_text']}" for r in rag_results
                    )
                    rag_prefix = f"[Contexto de documentos relevantes:]\n{rag_context}\n---\n\n"
                    system = rag_prefix + system if system else rag_prefix.rstrip()
        except Exception:
            pass

    msgs = list(messages)
    if system:
        msgs = [{"role": "system", "content": system}] + msgs

    return _chat_stream({"model": model, "messages": msgs, "stream": True})


@router.post("/api/vision")
async def vision(request: Request):
    body = await request.json()
    img_b64 = body.get("image", "")
    prompt = body.get("prompt", "Descreva o que voce ve nesta imagem.")
    model = cfg.get_model("vision", body.get("model", ""))
    messages = body.get("messages", [])

    if "," in img_b64:
        img_b64 = img_b64.split(",", 1)[1]

    msgs = list(messages)
    msgs.append({"role": "user", "content": prompt, "images": [img_b64]})

    return _chat_stream({"model": model, "messages": msgs, "stream": True})


@router.post("/api/vision/upload")
async def vision_upload(
    image: UploadFile = File(...),
    prompt: str = Form("Descreva esta imagem em detalhes."),
    model: str = Form(""),
):
    import base64
    img_bytes = await image.read()
    img_b64 = base64.b64encode(img_bytes).decode()

    return _chat_stream({
        "model": cfg.get_model("vision", model),
        "messages": [{"role": "user", "content": prompt, "images": [img_b64]}],
        "stream": True,
    })


# ─── App Builder ──────────────────────────────────────────────────────────────

@router.post("/api/build")
async def build_app(request: Request):
    body = await request.json()
    prompt = body.get("prompt", "")
    model = cfg.get_model("code", body.get("model", ""))

    system_prompt = """Voce e um engenheiro frontend expert. Quando o usuario descrever um app ou site,
gere um arquivo HTML COMPLETO e funcional com CSS e JavaScript inline.

REGRAS OBRIGATORIAS:
- Retorne APENAS o codigo HTML completo, comecando com <!DOCTYPE html> e terminando com </html>
- NAO inclua explicacoes, markdown, ou blocos de codigo. Apenas HTML puro.
- Use CSS moderno (flexbox, grid, variaveis CSS)
- Use JavaScript vanilla (sem frameworks)
- Design responsivo e bonito por padrao
- Tema escuro moderno como padrao
- Use icones SVG inline quando necessario
- O app deve ser 100% funcional e interativo
- Use cores vibrantes e gradientes para um visual moderno
- Fontes: use Google Fonts via CDN (Inter, Space Grotesk, JetBrains Mono)
- NUNCA use placeholder — sempre gere conteudo real e funcional"""

    return _chat_stream({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Crie o seguinte app/site: {prompt}"},
        ],
        "stream": True,
    }, timeout=600.0)


@router.post("/api/build/save")
async def save_app(request: Request):
    body = await request.json()
    html = body.get("html", "")
    raw_name = body.get("name", f"app-{uuid.uuid4().hex[:8]}")
    safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", raw_name)[:64] or f"app-{uuid.uuid4().hex[:8]}"
    app_dir = cfg.GENERATED_DIR / safe_name
    app_dir.mkdir(parents=True, exist_ok=True)
    (app_dir / "index.html").write_text(html, encoding="utf-8")
    return {"saved": True, "path": str(app_dir), "name": safe_name}


@router.get("/api/build/list")
async def list_apps():
    apps = []
    if cfg.GENERATED_DIR.exists():
        for d in sorted(cfg.GENERATED_DIR.iterdir()):
            if d.is_dir() and (d / "index.html").exists():
                apps.append({"name": d.name, "path": str(d), "size": (d / "index.html").stat().st_size})
    return {"apps": apps}


@router.delete("/api/build/{name}")
async def delete_app(name: str):
    safe_name = Path(name).name
    if not safe_name or safe_name != name:
        return JSONResponse({"error": "Invalid name"}, status_code=400)
    app_dir = cfg.GENERATED_DIR / safe_name
    if app_dir.exists() and app_dir.is_dir():
        shutil.rmtree(app_dir)
        return {"deleted": True, "name": safe_name}
    return JSONResponse({"error": "App not found"}, status_code=404)


@router.get("/api/build/preview/{name}")
async def preview_app(name: str):
    safe_name = Path(name).name
    if not safe_name or safe_name != name:
        return JSONResponse({"error": "Invalid name"}, status_code=400)
    filepath = cfg.GENERATED_DIR / safe_name / "index.html"
    if filepath.exists() and filepath.is_file():
        return HTMLResponse(filepath.read_text(encoding="utf-8"))
    return JSONResponse({"error": "App not found"}, status_code=404)
