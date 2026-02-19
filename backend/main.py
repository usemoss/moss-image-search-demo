from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
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
