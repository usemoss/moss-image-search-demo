"""Simple Moss SDK sample for loading an index and running a query."""

import asyncio
import os
from typing import Optional

from dotenv import load_dotenv
from inferedge_moss import MossClient


def _require_env(name: str) -> str:
	"""Fetch a required environment variable or raise a helpful error."""
	value: Optional[str] = os.getenv(name)
	if not value:
		raise EnvironmentError(
			f"Missing required environment variable: {name}. "
			"Set it in your environment or .env file before running the sample."
		)
	return value


async def load_and_query_sample() -> None:
	"""Load an existing image index and execute a sample query."""

	load_dotenv()

	project_id = _require_env("MOSS_PROJECT_ID")
	project_key = _require_env("MOSS_PROJECT_KEY")
	index_name = _require_env("MOSS_INDEX_NAME")

	print("=" * 40)
	print("Moss SDK - Load Index & Query Sample")
	print("=" * 40)
	print(f"Using index: {index_name}")

	client = MossClient(project_id, project_key)

	try:
		print("\nLoading index...")
		await client.load_index(index_name)
		print("Index loaded successfully")
		print("=" * 40)

		query = "tigers in the wild"
		print("\nPerforming sample search...\n")
		results = await client.query(index_name, query, 6)

		print(f"Found {len(results.docs)} results in {results.time_taken_ms}ms\n")
		for idx, doc in enumerate(results.docs, 1):
			print(f"[{doc.id}] Result {idx}")
			print(f"Score: {doc.score:.3f}")
			print(f"Snippet: {doc.text}\n")

		print("Sample completed successfully!")

	except Exception as error:
		print(f"Error: {error}")
		print("Check your credentials and index configuration.")


__all__ = ["load_and_query_sample"]


if __name__ == "__main__":
	asyncio.run(load_and_query_sample())
