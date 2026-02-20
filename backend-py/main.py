from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

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
_http_client = httpx.AsyncClient(follow_redirects=True, timeout=15.0)

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
    if parsed.hostname not in ALLOWED_IMAGE_HOSTS:
        raise HTTPException(status_code=403, detail="Host not allowed")

    try:
        resp = await _http_client.get(url)
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
