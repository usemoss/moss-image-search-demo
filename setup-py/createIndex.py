"""Utility script to create or refresh the Moss Image index.

Reads image documents from ``image-data-1k.json`` in this directory and uploads them to the Moss service
using credentials defined in ``.env``.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from inferedge_moss import DocumentInfo, MossClient

# Load environment variables from the project .env file
load_dotenv(".env")

IMAGE_PATH = Path(__file__).resolve().parent / "../image-data-1k.json"
DEFAULT_MODEL_ID = "moss-minilm"


def _load_image_documents() -> List[DocumentInfo]:
    if not IMAGE_PATH.exists():
        raise FileNotFoundError(
            f"Image data file not found at {IMAGE_PATH}. Ensure the moss-sdk samples are present."
        )

    with IMAGE_PATH.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, list):
        raise ValueError("Image data must be a list of document entries.")

    documents: List[DocumentInfo] = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        doc_id = entry.get("id")
        text = entry.get("text")
        if not doc_id or not text:
            continue
        metadata = entry.get("metadata")
        if metadata is not None and not isinstance(metadata, dict):
            metadata = None

        documents.append(
            DocumentInfo(
                id=str(doc_id),
                text=str(text),
                metadata=metadata or {},
            )
        )

    if not documents:
        raise ValueError("No valid image documents were loaded from the JSON file.")

    return documents


async def create_image_index() -> None:
    project_id = os.getenv("MOSS_PROJECT_ID")
    project_key = os.getenv("MOSS_PROJECT_KEY")
    index_name = os.getenv("MOSS_INDEX_NAME")
    model_id = os.getenv("MOSS_MODEL_ID", DEFAULT_MODEL_ID)

    missing = [
        name
        for name, value in {
            "MOSS_PROJECT_ID": project_id,
            "MOSS_PROJECT_KEY": project_key,
            "MOSS_INDEX_NAME": index_name,
        }.items()
        if not value
    ]
    if missing:
        raise EnvironmentError(
            "Missing required Moss environment variables: " + ", ".join(missing)
        )

    documents = _load_image_documents()

    client = MossClient(project_id, project_key)

    print(f"Creating Moss index '{index_name}' with {len(documents)} image entries using {model_id}...")
    created = await client.create_index(index_name, documents, model_id)
    print("Index creation response:", created)
    print("Image index ready for use!")


if __name__ == "__main__":
    asyncio.run(create_image_index())