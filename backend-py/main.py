from __future__ import annotations

import asyncio
import ipaddress
import os
import posixpath
import socket
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, urlunparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from inferedge_moss import MossClient
from moss_core import QueryOptions

load_dotenv(Path(__file__).parent.parent / ".env")

PROJECT_ID = os.getenv("MOSS_PROJECT_ID", "")
PROJECT_KEY = os.getenv("MOSS_PROJECT_KEY", "")
BASE_INDEX_NAME = os.getenv("MOSS_INDEX_NAME", "coco-data")
CORS_ORIGINS = os.getenv(
    "MOSS_CORS_ORIGINS",
    "http://localhost:5173,http://localhost:4173",
).split(",")
TOP_K_DEFAULT = 5

client = MossClient(PROJECT_ID, PROJECT_KEY)
_http_client = httpx.AsyncClient(follow_redirects=False, timeout=15.0)

ALLOWED_IMAGE_HOSTS = {"images.cocodataset.org"}

_loaded_indexes: set[str] = set()
_index_locks: dict[str, asyncio.Lock] = {}


def _get_index_name(tier: str) -> str:
    return f"{BASE_INDEX_NAME}-{tier}"


async def _ensure_index_loaded(index_name: str) -> None:
    if index_name in _loaded_indexes:
        return
    if index_name not in _index_locks:
        _index_locks[index_name] = asyncio.Lock()
    async with _index_locks[index_name]:
        if index_name not in _loaded_indexes:
            await client.load_index(index_name)
            _loaded_indexes.add(index_name)


def _is_private_or_loopback(hostname: str) -> bool:
    """Return True if any resolved address for hostname is loopback, private,
    link-local, or otherwise disallowed. Also returns True if DNS fails."""
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return True  # can't resolve → treat as unsafe
    for info in infos:
        addr_str = info[4][0]
        try:
            ip = ipaddress.ip_address(addr_str)
            if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved:
                return True
        except ValueError:
            return True  # unparseable address → treat as unsafe
    return False


def _normalize_path(raw_path: str) -> str | None:
    """Normalize a URL path and reject traversal attempts.
    Returns the normalized path, or None if it escapes the root."""
    normalized = posixpath.normpath(raw_path)
    if normalized.startswith(".."):
        return None
    return normalized


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/search")
async def search(
    query: str = Query(..., min_length=1),
    tier: str = Query("1k"),
    top_k: int = Query(TOP_K_DEFAULT, ge=1, le=50),
) -> dict[str, Any]:
    index_name = _get_index_name(tier)

    try:
        await _ensure_index_loaded(index_name)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Failed to load index: {exc}") from exc

    try:
        result = await client.query(index_name, query.lower(), QueryOptions(top_k=top_k))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Query failed: {exc}") from exc

    docs = [
        {
            "id": doc.id,
            "text": doc.text,
            "score": doc.score,
            "metadata": doc.metadata if doc.metadata is not None else {},
        }
        for doc in (result.docs or [])
    ]

    return {
        "docs": docs,
        "timeTakenInMs": result.time_taken_ms,
    }


@app.get("/image-proxy")
async def image_proxy(url: str = Query(..., min_length=1)) -> Response:
    parsed = urlparse(url)

    # 1. Scheme must be http or https (blocks file://, gopher://, etc.)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=422, detail="Only HTTP(S) URLs are allowed")

    # 2. Hostname must be in the server-controlled allowlist
    if parsed.hostname not in ALLOWED_IMAGE_HOSTS:
        raise HTTPException(status_code=403, detail="Host not allowed")

    # 3. Resolve DNS and reject loopback / private / link-local addresses
    if _is_private_or_loopback(parsed.hostname):
        raise HTTPException(status_code=403, detail="Host resolves to a disallowed address")

    # 4. Normalize path and reject traversal (handles encoded variants after urlparse decodes)
    safe_path = _normalize_path(parsed.path)
    if safe_path is None:
        raise HTTPException(status_code=422, detail="Path traversal not allowed")

    # 5. Reconstruct URL entirely from server-controlled values — trusted_host comes from
    #    ALLOWED_IMAGE_HOSTS (a constant), breaking the taint chain
    trusted_host = next(h for h in ALLOWED_IMAGE_HOSTS if h == parsed.hostname)
    safe_url = urlunparse((parsed.scheme, trusted_host, safe_path, "", parsed.query, ""))

    try:
        resp = await _http_client.get(safe_url)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch image: {exc}") from exc

    content_type = resp.headers.get("content-type", "image/jpeg")
    return Response(
        content=resp.content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
