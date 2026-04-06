"""Offline map endpoints (PMTiles serving + download management)."""

import asyncio
import json
import shutil
import subprocess
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

import routes.config as cfg

router = APIRouter(tags=["maps"])

# Track in-progress downloads to prevent duplicate concurrent extractions
_active_map_downloads: set = set()


@router.get("/api/maps")
async def list_maps():
    """List .pmtiles files available in static/maps/."""
    cfg.MAPS_DIR.mkdir(parents=True, exist_ok=True)
    maps = []
    for f in sorted(cfg.MAPS_DIR.iterdir()):
        if f.suffix == ".pmtiles":
            size_mb = f.stat().st_size / (1024 * 1024)
            maps.append({"name": f.stem, "file": f.name, "size_mb": round(size_mb, 1)})
    return {"maps": maps, "dir": str(cfg.MAPS_DIR.resolve())}


@router.head("/maps/{filename}")
@router.get("/maps/{filename}")
async def serve_pmtiles(filename: str, request: Request):
    """Serve .pmtiles files with Range Request support (required by PMTiles spec)."""
    safe_name = Path(filename).name
    if not safe_name or safe_name != filename or not safe_name.endswith(".pmtiles"):
        return JSONResponse({"error": "Map not found"}, status_code=404)
    cfg.MAPS_DIR.mkdir(parents=True, exist_ok=True)
    filepath = (cfg.MAPS_DIR / safe_name).resolve()
    # Guard against symlink escapes: resolved path must stay inside MAPS_DIR
    try:
        filepath.relative_to(cfg.MAPS_DIR.resolve())
    except ValueError:
        return JSONResponse({"error": "Map not found"}, status_code=404)
    if not filepath.exists():
        return JSONResponse({"error": "Map not found"}, status_code=404)

    file_size = filepath.stat().st_size
    range_header = request.headers.get("range")

    if range_header:
        range_str = range_header.replace("bytes=", "")
        parts = range_str.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        with open(filepath, "rb") as f:
            f.seek(start)
            data = f.read(length)

        return Response(
            content=data,
            status_code=206,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Content-Length": str(length),
                "Content-Type": "application/octet-stream",
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "Content-Range, Content-Length",
            },
        )
    else:
        return Response(
            content=b"",
            status_code=200,
            headers={
                "Content-Length": str(file_size),
                "Content-Type": "application/octet-stream",
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
            },
        )


@router.get("/api/maps/available")
async def available_maps():
    """List map regions available for download."""
    installed = []
    if cfg.MAPS_DIR.exists():
        for f in sorted(cfg.MAPS_DIR.iterdir()):
            if f.suffix == ".pmtiles":
                installed.append(f.stem)
    result = []
    for rid, info in cfg.MAP_REGIONS.items():
        result.append({**info, "id": rid, "installed": rid in installed,
                       "filename": f"{rid}.pmtiles"})
    return {"regions": result, "installed": installed}


@router.post("/api/maps/download")
async def download_map(request: Request):
    """Download a map region from Protomaps. Streams progress via SSE."""
    body = await request.json()
    region_id = body.get("region", "world_basic")
    region = cfg.MAP_REGIONS.get(region_id)
    if not region:
        return JSONResponse({"error": "Regiao desconhecida"}, status_code=400)

    output_path = cfg.MAPS_DIR / f"{region_id}.pmtiles"
    if output_path.exists():
        return JSONResponse({"status": "already_installed", "size_mb": round(output_path.stat().st_size / 1048576, 1)})

    if region_id in _active_map_downloads:
        return JSONResponse({"status": "already_downloading", "region": region_id})

    cfg.MAPS_DIR.mkdir(parents=True, exist_ok=True)

    pmtiles_bin = shutil.which("pmtiles")
    if not pmtiles_bin:
        for p in [Path("tools/pmtiles.exe"), Path("tools/pmtiles"), Path("pmtiles.exe")]:
            if p.exists():
                pmtiles_bin = str(p)
                break

    async def stream_download():
        _active_map_downloads.add(region_id)
        try:
            if pmtiles_bin:
                cmd = [
                    pmtiles_bin, "extract",
                    cfg.PROTOMAPS_BUILD,
                    str(output_path),
                    f"--maxzoom={region['maxzoom']}",
                    f"--bbox={region['bbox']}",
                ]
                try:
                    proc = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.STDOUT,
                    )
                    yield f"data: {json.dumps({'status': 'extracting', 'region': region_id, 'est_mb': region['est_mb']})}\n\n"
                    async for line in proc.stdout:
                        text = line.decode().strip()
                        if text:
                            yield f"data: {json.dumps({'status': 'progress', 'message': text})}\n\n"
                    await proc.wait()
                    if proc.returncode == 0 and output_path.exists():
                        size_mb = round(output_path.stat().st_size / 1048576, 1)
                        yield f"data: {json.dumps({'status': 'done', 'size_mb': size_mb})}\n\n"
                    else:
                        yield f"data: {json.dumps({'status': 'error', 'message': 'Falha na extracao'})}\n\n"
                except (NotImplementedError, OSError):
                    yield f"data: {json.dumps({'status': 'extracting', 'region': region_id})}\n\n"
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
                    if result.returncode == 0 and output_path.exists():
                        size_mb = round(output_path.stat().st_size / 1048576, 1)
                        yield f"data: {json.dumps({'status': 'done', 'size_mb': size_mb})}\n\n"
                    else:
                        yield f"data: {json.dumps({'status': 'error', 'message': result.stderr[:200]})}\n\n"
            else:
                yield f"data: {json.dumps({'status': 'error', 'message': 'pmtiles CLI nao encontrado. Coloque pmtiles.exe em tools/'})}\n\n"
        finally:
            _active_map_downloads.discard(region_id)

    return StreamingResponse(stream_download(), media_type="text/event-stream")


@router.delete("/api/maps/{filename}")
async def delete_map(filename: str):
    """Delete a map file."""
    safe_name = Path(filename).name
    if not safe_name or not safe_name.endswith(".pmtiles"):
        return JSONResponse({"error": "Arquivo invalido"}, status_code=400)
    filepath = (cfg.MAPS_DIR / safe_name).resolve()
    # Ensure the resolved path stays inside MAPS_DIR (path traversal guard)
    try:
        filepath.relative_to(cfg.MAPS_DIR.resolve())
    except ValueError:
        return JSONResponse({"error": "Arquivo invalido"}, status_code=400)
    if filepath.exists():
        filepath.unlink()
        return {"status": "deleted", "file": safe_name}
    return JSONResponse({"error": "Mapa nao encontrado"}, status_code=404)
