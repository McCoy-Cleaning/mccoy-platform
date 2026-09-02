/**
 * Server-only loader for the Improve edge overlay.
 *
 * Order:
 *   1. Live seo-ops (lab 127.0.0.1:1480) so a new Approve applies without redeploy
 *   2. public/aether-edge-patches.json (one-time static install)
 *   3. sibling .data/aether-staged-fixes.json (approved rows only)
 *
 * No .env required. Failures fall through. Short in-process cache.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MCCOY_AETHER_SITE_ID,
  edgeDocumentFromDump,
  labEdgePatchesUrl,
  type EdgePatchesDocument,
  type StagedFixDump,
} from "./aether-edge-overlay";

const CACHE_MS = 15_000;
const LIVE_TIMEOUT_MS = 250;

let cache: { expiresAt: number; doc: EdgePatchesDocument | null } | null = null;

function readJsonFile(path: string): unknown | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function candidatesFor(filename: string): string[] {
  const out: string[] = [];
  const cwd = process.cwd();
  out.push(join(cwd, "public", filename));
  out.push(join(cwd, "apps", "storefront", "public", filename));
  out.push(join(cwd, ".data", filename));
  out.push(join(cwd, "..", "..", ".data", filename));
  out.push(join(cwd, "..", ".data", filename));
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    out.push(join(here, "..", "..", "..", "public", filename));
    out.push(join(here, "..", "..", "..", "..", "..", ".data", filename));
  } catch {
    /* ignore */
  }
  return out;
}

function readFirstJson(filename: string): unknown | null {
  for (const path of candidatesFor(filename)) {
    const raw = readJsonFile(path);
    if (raw) return raw;
  }
  return null;
}

async function tryLiveFeed(): Promise<EdgePatchesDocument | null> {
  const siteId = MCCOY_AETHER_SITE_ID;
  const fromStatic = readFirstJson("aether-edge-patches.json") as EdgePatchesDocument | StagedFixDump | null;
  const fromDump = readFirstJson("aether-staged-fixes.json") as StagedFixDump | null;
  const knownId =
    (fromStatic && "siteId" in fromStatic && typeof fromStatic.siteId === "string" && fromStatic.siteId) ||
    (fromDump && typeof fromDump.siteId === "string" && fromDump.siteId) ||
    siteId;
  const url = labEdgePatchesUrl(knownId);
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), LIVE_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    return edgeDocumentFromDump(json as EdgePatchesDocument);
  } catch {
    return null;
  }
}

function tryStatic(): EdgePatchesDocument | null {
  const pub = readFirstJson("aether-edge-patches.json");
  if (pub) return edgeDocumentFromDump(pub as EdgePatchesDocument | StagedFixDump);
  const dump = readFirstJson("aether-staged-fixes.json");
  if (dump) return edgeDocumentFromDump(dump as StagedFixDump);
  return null;
}

export async function loadEdgePatchesDocument(): Promise<EdgePatchesDocument | null> {
  if (cache && Date.now() < cache.expiresAt) return cache.doc;
  const live = await tryLiveFeed();
  const doc = live ?? tryStatic();
  cache = { expiresAt: Date.now() + CACHE_MS, doc };
  return doc;
}

export function getCachedEdgePatches(): EdgePatchesDocument | null {
  return cache?.doc ?? null;
}

export function resetEdgePatchesCache(): void {
  cache = null;
}
