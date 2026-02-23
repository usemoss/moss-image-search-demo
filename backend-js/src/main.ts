import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MossClient } from "@inferedge/moss";

// Load .env from project root (two levels up from src/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PROJECT_ID = process.env.MOSS_PROJECT_ID ?? "";
const PROJECT_KEY = process.env.MOSS_PROJECT_KEY ?? "";
const BASE_INDEX_NAME = process.env.MOSS_INDEX_NAME ?? "coco-data";
const CORS_ORIGINS = (
  process.env.MOSS_CORS_ORIGINS ?? "http://localhost:5173,http://localhost:4173"
).split(",");
const PORT = Number(process.env.PORT) || 8001;
const TOP_K_DEFAULT = 5;

const client = new MossClient(PROJECT_ID, PROJECT_KEY);

const ALLOWED_IMAGE_HOSTS = new Set(["images.cocodataset.org"]);

// Lazy index loading with promise-based lock (mirrors Python asyncio.Lock pattern)
const loadedIndexes = new Set<string>();
const inflightLoads = new Map<string, Promise<void>>();

function getIndexName(tier: string): string {
  return `${BASE_INDEX_NAME}-${tier}`;
}

async function ensureIndexLoaded(indexName: string): Promise<void> {
  if (loadedIndexes.has(indexName)) return;

  // If a load is already in-flight, wait on the same promise
  const existing = inflightLoads.get(indexName);
  if (existing) return existing;

  const loadPromise = client
    .loadIndex(indexName)
    .then(() => {
      loadedIndexes.add(indexName);
    })
    .finally(() => {
      inflightLoads.delete(indexName);
    });

  inflightLoads.set(indexName, loadPromise);
  return loadPromise;
}

const app = express();

app.use(
  cors({
    origin: CORS_ORIGINS,
    methods: ["GET"],
  })
);

// ── Health ──────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── Search ─────────────────────────────────────────────
app.get("/search", async (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  const tier = typeof req.query.tier === "string" ? req.query.tier : "1k";
  const topK = Math.min(Math.max(Number(req.query.top_k) || TOP_K_DEFAULT, 1), 50);

  if (!query) {
    res.status(422).json({ detail: "query is required" });
    return;
  }

  const indexName = getIndexName(tier);

  try {
    await ensureIndexLoaded(indexName);
  } catch (err) {
    res.status(503).json({ detail: `Failed to load index: ${err}` });
    return;
  }

  try {
    const result = await client.query(indexName, query.toLowerCase(), { topK });
    const docs = (result.docs ?? []).map((doc) => ({
      id: doc.id,
      text: doc.text,
      score: doc.score,
      metadata: doc.metadata ?? {},
    }));
    res.json({ docs, timeTakenInMs: result.timeTakenInMs });
  } catch (err) {
    res.status(500).json({ detail: `Query failed: ${err}` });
  }
});

// ── Image Proxy ────────────────────────────────────────
app.get("/image-proxy", async (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
  if (!url) {
    res.status(422).json({ detail: "url is required" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(422).json({ detail: "Invalid URL" });
    return;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    res.status(422).json({ detail: "Only HTTP(S) URLs are allowed" });
    return;
  }

  if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) {
    res.status(403).json({ detail: "Host not allowed" });
    return;
  }

  // Reconstruct URL from parsed components to prevent parser-confusion attacks
  // (e.g. https://allowed-host@evil.com/ passing the hostname check)
  parsed.username = "";
  parsed.password = "";
  const safeUrl = parsed.toString();

  try {
    const upstream = await fetch(safeUrl, { redirect: "error" });
    if (!upstream.ok) {
      res.status(502).json({ detail: `Upstream returned ${upstream.status}` });
      return;
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch (err) {
    res.status(502).json({ detail: `Failed to fetch image: ${err}` });
  }
});

app.listen(PORT, () => {
  console.log(`backend-js listening on http://localhost:${PORT}`);
});
