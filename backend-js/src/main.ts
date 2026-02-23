import { fileURLToPath } from "node:url";
import path from "node:path";
import { lookup as dnsLookup } from "node:dns/promises";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import ipaddr from "ipaddr.js";
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

// Returns true if any resolved address for the hostname is loopback, private,
// link-local, or unique-local (IPv6). Rejects outright if DNS fails.
async function isPrivateOrLoopback(hostname: string): Promise<boolean> {
  const BLOCKED_RANGES = new Set([
    "loopback",
    "private",
    "linkLocal",
    "uniqueLocal",
    "unspecified",
    "reserved",
  ]);
  let addresses: { address: string }[];
  try {
    addresses = await dnsLookup(hostname, { all: true });
  } catch {
    return true; // can't resolve → treat as unsafe
  }
  for (const { address } of addresses) {
    try {
      const ip = ipaddr.parse(address);
      if (BLOCKED_RANGES.has(ip.range())) return true;
    } catch {
      return true; // unparseable address → treat as unsafe
    }
  }
  return false;
}

// Normalizes a URL path using POSIX rules and rejects traversal attempts.
// Returns the normalized path, or null if it escapes the root.
function normalizeAndValidatePath(rawPath: string): string | null {
  const normalized = path.posix.normalize(rawPath);
  if (normalized.startsWith("..") || normalized === "..") return null;
  return normalized;
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

  // 1. Scheme must be http or https (blocks file://, gopher://, etc.)
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    res.status(422).json({ detail: "Only HTTP(S) URLs are allowed" });
    return;
  }

  // 2. Hostname must be in the server-controlled allowlist
  if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) {
    res.status(403).json({ detail: "Host not allowed" });
    return;
  }

  // 3. Resolve DNS and reject loopback / private / link-local addresses
  if (await isPrivateOrLoopback(parsed.hostname)) {
    res.status(403).json({ detail: "Host resolves to a disallowed address" });
    return;
  }

  // 4. Normalize path and reject traversal (handles encoded variants after URL constructor decodes)
  const safePath = normalizeAndValidatePath(parsed.pathname);
  if (safePath === null) {
    res.status(422).json({ detail: "Path traversal not allowed" });
    return;
  }

  // 5. Reconstruct URL from individually sanitized components to break CodeQL taint chain.
  //    trustedHost comes from ALLOWED_IMAGE_HOSTS (a constant); path and query components
  //    are validated and re-applied so no raw user-controlled URL is passed to fetch().
  const trustedHost = [...ALLOWED_IMAGE_HOSTS].find((h) => h === parsed.hostname)!;
  const safeUrl = new URL("/", `${parsed.protocol}//${trustedHost}`);

  // Apply normalized path. normalizeAndValidatePath already rejects traversal; letting URL
  // handle encoding avoids double-decoding user input.
  safeUrl.pathname = safePath;

  // Rebuild search params from parsed entries using a fresh URLSearchParams instance.
  const rebuiltParams = new URLSearchParams();
  for (const [key, value] of parsed.searchParams.entries()) {
    // Keys are small strings; values are copied as-is. Both are now detached from the
    // original tainted URL string and can be further validated/filtered here if needed.
    rebuiltParams.append(key, value);
  }
  safeUrl.search = rebuiltParams.toString();

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
