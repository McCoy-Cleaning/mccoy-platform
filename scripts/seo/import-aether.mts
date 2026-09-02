#!/usr/bin/env node
/**
 * Pull Aether staged fixes into McCoy CMS drafts.
 * Prefers .data/aether-staged-fixes.json; optional HTTP fallback to local seo-ops.
 * Writes drafts only. User publishes in McCoy admin. Never production-publishes.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDataDir } from "@mccoy/security";
import { builtinCmsSeedPages, getCmsStore, hasSupabaseServiceConfig } from "@mccoy/database/server";
import { importAetherStagedFixes } from "../../packages/database/src/cms/import-aether-drafts";

const LAB_SITE_ID = "d06f2e13-d001-45b8-90a7-dc2724330a5e";
const DEFAULT_SEO_OPS = "http://127.0.0.1:1480";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return undefined;
  return next;
}

function hasFlag(flag: string): boolean { return process.argv.includes(flag); }

function defaultDumpPath(): string {
  return path.join(getDataDir(), "aether-staged-fixes.json");
}

function envTrim(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

async function loadHttpDump(siteId: string): Promise<unknown> {
  const origin = (envTrim("AETHER_SEO_OPS_URL") ?? DEFAULT_SEO_OPS).replace(/\/+$/, "");
  const key = envTrim("SEO_OPS_API_KEY") ?? envTrim("SEO_OPS_API_KEYS")?.split(",")[0]?.trim();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers["X-Api-Key"] = key;
  const url = origin + "/v1/sites/" + siteId + "/staged-fixes";
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("seo-ops HTTP " + res.status + " from " + url);
  return res.json();
}

async function main() {
  const fileArg = argValue("--file");
  const wantHttp = hasFlag("--http");
  const dryRun = hasFlag("--dry-run");
  const includePending = !hasFlag("--approved-only");
  const siteId = argValue("--site") ?? envTrim("AETHER_SITE_ID") ?? LAB_SITE_ID;
  const filePath = fileArg ? path.resolve(fileArg) : defaultDumpPath();
  let dump: unknown = null;
  let source = "";
  if (!wantHttp && existsSync(filePath)) {
    dump = JSON.parse(readFileSync(filePath, "utf8"));
    source = filePath;
  } else {
    dump = await loadHttpDump(siteId);
    source = "http";
  }
  const store = getCmsStore();
  await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
  const storeKind = hasSupabaseServiceConfig() ? "supabase-or-file (existing CMS store)" : "file .data/cms-published.json";
  const result = await importAetherStagedFixes({ store, dump, dryRun, includePending });
  console.log("seo:import-aether source=" + source + " store=" + storeKind + " dryRun=" + dryRun + " drafted=" + result.drafted + " skipped=" + result.skipped + " published=" + result.published);
  for (const row of result.rows) {
    console.log([row.pageId ?? "-", row.locale ?? "-", row.field ?? "-", JSON.stringify(row.current ?? ""), JSON.stringify(row.proposed), row.drafted ? "drafted=yes" : "drafted=no", row.skippedReason ?? "", row.frozenLiveTitle ? "FROZEN_LIVE_TITLE" : ""].join(" | "));
  }
  if (result.rows.some((r) => r.frozenLiveTitle)) {
    console.log("Caveat: title drafts do not change live www.mccoy.nl head until you publish in McCoy admin and the freeze path runs (SEO-7 != SEO-8).");
  }
  console.log("Nothing was production-published. Open McCoy admin and publish when ready.");
}

main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
