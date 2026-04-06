"""Chat, vision, streaming, and app-builder endpoints."""

import json
import re
import shutil
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

import routes.config as cfg
from routes.rag import _rag_bm25_search

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
        try:
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
        except httpx.ConnectError:
            yield f"data: {json.dumps({'error': 'Modelo IA indisponivel. Verifique se o Ollama esta rodando.'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except httpx.TimeoutException:
            yield f"data: {json.dumps({'error': 'Tempo limite excedido. O modelo pode estar carregando — tente novamente.'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as _e:
            yield f"data: {json.dumps({'error': f'Erro inesperado: {type(_e).__name__}'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

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
            yield f"data: {json.dumps({'error': 'Modelo IA indisponivel. Verifique se o servidor llama.cpp esta rodando.'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except httpx.TimeoutException:
            yield f"data: {json.dumps({'error': 'Tempo limite excedido. O modelo pode estar carregando — tente novamente.'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as _e:
            yield f"data: {json.dumps({'error': f'Erro inesperado: {type(_e).__name__}'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ─── Chat endpoints ───────────────────────────────────────────────────────────

# These limits are defined in config.py (cfg.MAX_CHAT_HISTORY / cfg.MAX_CHAT_MSG_CHARS)
# and kept as local aliases for readability within this module.
_MAX_CHAT_MSG_CHARS = cfg.MAX_CHAT_MSG_CHARS
_MAX_CHAT_HISTORY  = cfg.MAX_CHAT_HISTORY

@router.post("/api/chat")
async def chat(request: Request):
    if cfg._check_rate_limit("chat", request.client.host if request.client else "local"):
        return JSONResponse({"error": "Limite de taxa excedido. Aguarde."}, status_code=429)
    body = await request.json()
    model = cfg.get_model("chat", body.get("model", ""))
    messages = body.get("messages", [])
    system = body.get("system", "")

    # Guard: messages must be a list
    if not isinstance(messages, list):
        return JSONResponse({"error": "messages deve ser uma lista."}, status_code=400)

    # Guard: reject oversized inputs to prevent memory / prompt-injection abuse
    if len(messages) > _MAX_CHAT_HISTORY:
        return JSONResponse({"error": f"Muitas mensagens no histórico (max {_MAX_CHAT_HISTORY})."}, status_code=400)
    for m in messages:
        content = m.get("content", "")
        if isinstance(content, str) and len(content) > _MAX_CHAT_MSG_CHARS:
            return JSONResponse({"error": f"Mensagem muito longa (max {_MAX_CHAT_MSG_CHARS} caracteres)."}, status_code=400)

    # RAG context injection
    last_user_msg = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            content = m.get("content", "")
            last_user_msg = content if isinstance(content, str) else ""
            break

    if last_user_msg:
        try:
            con = sqlite3.connect(str(cfg.DATA_DIR / "rag.db"))
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
        except Exception as _rag_err:
            print(f"[RAG] DB access error during chat context injection: {_rag_err}")

    msgs = list(messages)
    if system:
        msgs = [{"role": "system", "content": system}] + msgs

    return _chat_stream({"model": model, "messages": msgs, "stream": True})


_MAX_VISION_IMG_B64_CHARS = cfg.MAX_VISION_IMG_B64_CHARS

@router.post("/api/vision")
async def vision(request: Request):
    body = await request.json()
    img_b64 = body.get("image", "")
    prompt = body.get("prompt", "Descreva o que voce ve nesta imagem.")
    model = cfg.get_model("vision", body.get("model", ""))
    messages = body.get("messages", [])

    if "," in img_b64:
        img_b64 = img_b64.split(",", 1)[1]

    if len(img_b64) > _MAX_VISION_IMG_B64_CHARS:
        return JSONResponse({"error": "Imagem muito grande (max ~10 MB)."}, status_code=400)

    msgs = list(messages)
    msgs.append({"role": "user", "content": prompt, "images": [img_b64]})

    return _chat_stream({"model": model, "messages": msgs, "stream": True})


_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"}
_ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}

@router.post("/api/vision/upload")
async def vision_upload(
    image: UploadFile = File(...),
    prompt: str = Form("Descreva esta imagem em detalhes."),
    model: str = Form(""),
):
    import base64
    # Validate file type by MIME type and extension
    content_type = (image.content_type or "").lower().split(";")[0].strip()
    ext = Path(image.filename or "").suffix.lower() if image.filename else ""
    if content_type not in _ALLOWED_IMAGE_TYPES and ext not in _ALLOWED_IMAGE_EXTS:
        return JSONResponse({"error": "Tipo de arquivo nao suportado. Use JPEG, PNG, GIF ou WebP."}, status_code=400)
    img_bytes = await image.read()
    # Validate size limit: 10 MB
    if len(img_bytes) > 10 * 1024 * 1024:
        return JSONResponse({"error": "Imagem muito grande (max 10 MB)."}, status_code=400)
    # Validate magic bytes: check for known image file signatures
    if len(img_bytes) < 4:
        return JSONResponse({"error": "Arquivo de imagem invalido"}, status_code=400)
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


_HTML_DETECT_RE = re.compile(r'<\s*(!DOCTYPE\s+html|html[\s>])', re.IGNORECASE)
_MAX_APP_HTML_BYTES = cfg.MAX_APP_HTML_BYTES
_MAX_TITLE_WORDS = 5                    # words used to auto-generate a title slug


def _auto_title_from_prompt(prompt: str) -> str:
    """Generate a slug-safe title from the first few words of a prompt."""
    words = re.findall(r'[a-zA-Z0-9\u00C0-\u024F]+', prompt)[:_MAX_TITLE_WORDS]
    if words:
        return "-".join(w.lower() for w in words)
    return f"app-{uuid.uuid4().hex[:8]}"


@router.post("/api/build/save")
async def save_app(request: Request):
    body = await request.json()
    html = body.get("html", "")
    if not html or not isinstance(html, str):
        return JSONResponse({"error": "No HTML content provided"}, status_code=400)
    if len(html.encode("utf-8")) > _MAX_APP_HTML_BYTES:
        return JSONResponse({"error": "HTML too large (max 5 MB)"}, status_code=400)
    # Require at least a recognisable HTML document tag
    if not _HTML_DETECT_RE.search(html[:2048]):
        return JSONResponse({"error": "Response does not appear to be valid HTML"}, status_code=400)

    # Accept an explicit name, or auto-generate one from the prompt / a UUID
    raw_name = body.get("name", "")
    if not raw_name:
        prompt = body.get("prompt", "")
        raw_name = _auto_title_from_prompt(prompt) if prompt else f"app-{uuid.uuid4().hex[:8]}"

    safe_name = re.sub(r"[^a-zA-Z0-9_\-]", "_", raw_name)[:64] or f"app-{uuid.uuid4().hex[:8]}"

    # Preserve a human-readable title (raw_name before slugification, capped at 120 chars)
    title = body.get("title", raw_name)[:120]

    app_dir = cfg.GENERATED_DIR / safe_name
    app_dir.mkdir(parents=True, exist_ok=True)
    (app_dir / "index.html").write_text(html, encoding="utf-8")

    # Persist metadata alongside the HTML
    import json as _json
    meta = {
        "name": safe_name,
        "title": title,
        "prompt": body.get("prompt", "")[:500],
        "created_at": datetime.now().isoformat(),
    }
    (app_dir / "meta.json").write_text(_json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    return {"saved": True, "path": str(app_dir), "name": safe_name, "title": title}


_MAX_BUILD_LIST = cfg.MAX_BUILD_LIST

@router.get("/api/build/list")
async def list_apps():
    import json as _json
    apps = []
    if cfg.GENERATED_DIR.exists():
        for d in sorted(cfg.GENERATED_DIR.iterdir()):
            if not d.is_dir():
                continue
            html_file = d / "index.html"
            if not html_file.exists():
                continue

            # Load persisted metadata if available
            meta_file = d / "meta.json"
            meta: dict = {}
            if meta_file.exists():
                try:
                    meta = _json.loads(meta_file.read_text(encoding="utf-8"))
                except Exception:
                    pass

            stat = html_file.stat()
            # created_at: prefer meta.json value, fall back to filesystem mtime
            created_at = meta.get("created_at") or datetime.fromtimestamp(stat.st_mtime).isoformat()

            # Preview: first 200 non-whitespace chars of the HTML
            try:
                preview = " ".join(html_file.read_text(encoding="utf-8", errors="replace").split())[:200]
            except Exception:
                preview = ""

            apps.append({
                "name": d.name,
                "title": meta.get("title", d.name),
                "prompt": meta.get("prompt", ""),
                "path": str(d),
                "size": stat.st_size,
                "created_at": created_at,
                "preview": preview,
            })
            if len(apps) >= _MAX_BUILD_LIST:
                break
    return {"apps": apps, "total": len(apps), "limit": _MAX_BUILD_LIST}


@router.get("/api/build/{name}")
async def get_app(name: str):
    """Return the full HTML of a saved app."""
    safe_name = Path(name).name
    if not safe_name or safe_name != name:
        return JSONResponse({"error": "Invalid name"}, status_code=400)
    filepath = cfg.GENERATED_DIR / safe_name / "index.html"
    if not filepath.exists():
        return JSONResponse({"error": "App not found"}, status_code=404)
    import json as _json
    meta: dict = {}
    meta_file = cfg.GENERATED_DIR / safe_name / "meta.json"
    if meta_file.exists():
        try:
            meta = _json.loads(meta_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {
        "name": safe_name,
        "title": meta.get("title", safe_name),
        "prompt": meta.get("prompt", ""),
        "created_at": meta.get("created_at", ""),
        "html": filepath.read_text(encoding="utf-8"),
        "size": filepath.stat().st_size,
    }


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
