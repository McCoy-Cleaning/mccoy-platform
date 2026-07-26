/**
 * One-shot: purge custom CMS page(s) for /referenties (and related rows).
 * Published revisions are immutable — must archive before DELETE.
 *
 * Usage (from repo root): node scripts/purge-cms-referenties.mjs
 * Requires SUPABASE_URL + SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(filePath) {
  const env = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv(resolve(process.cwd(), ".env"));
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / secret key in .env");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const REVISION_ID = "619104bc-02fa-4269-a387-4d51c59a85c2";

async function ensureDeleteFn() {
  // Best-effort: call RPC; if missing, fall back to client-side steps.
  return true;
}

async function findTargets() {
  const { data: byRev, error: revErr } = await sb
    .from("cms_page_revisions")
    .select("id, page_id, site_id, status")
    .eq("id", REVISION_ID)
    .maybeSingle();
  if (revErr) throw revErr;

  const pageIds = new Set();
  const siteIds = new Set();
  if (byRev?.page_id) {
    pageIds.add(byRev.page_id);
    if (byRev.site_id) siteIds.add(byRev.site_id);
  }

  const { data: locales, error: locErr } = await sb
    .from("cms_page_locale_states")
    .select("page_id, site_id, path, public_path")
    .or("path.ilike.%referenties%,public_path.ilike.%referenties%");
  if (locErr) throw locErr;
  for (const row of locales ?? []) {
    pageIds.add(row.page_id);
    siteIds.add(row.site_id);
  }

  const { data: pages, error: pageErr } = await sb
    .from("cms_pages")
    .select("id, site_id, kind, stable_key")
    .or("stable_key.ilike.%refer%,stable_key.eq.page_lj7wkwsu");
  if (pageErr) throw pageErr;
  for (const row of pages ?? []) {
    pageIds.add(row.id);
    siteIds.add(row.site_id);
  }

  return { pageIds: [...pageIds], siteIds: [...siteIds], byRev };
}

async function purgePage(pageId, siteId) {
  const { data: page, error: getErr } = await sb
    .from("cms_pages")
    .select("id, site_id, kind, stable_key, active_published_revision_id")
    .eq("id", pageId)
    .maybeSingle();
  if (getErr) throw getErr;
  if (!page) {
    console.log("page already gone", pageId);
    return;
  }
  if (page.kind !== "custom") {
    console.error("refusing to delete non-custom page", page.kind, page.stable_key);
    return;
  }

  const site = siteId || page.site_id;
  console.log("purging custom page", { stable_key: page.stable_key, id: page.id });

  // Try RPC first (if migration applied).
  const { data: rpcData, error: rpcErr } = await sb.rpc("cms_delete_custom_page", {
    p_site_id: site,
    p_page_ref: page.id,
  });
  if (!rpcErr) {
    console.log("rpc cms_delete_custom_page ok", rpcData);
    return;
  }
  console.log("rpc unavailable, using client archive path:", rpcErr.message);

  const { data: locales } = await sb
    .from("cms_page_locale_states")
    .select("path, public_path")
    .eq("page_id", page.id)
    .eq("site_id", site);
  const paths = [
    ...new Set(
      (locales ?? [])
        .flatMap((l) => [l.path, l.public_path])
        .filter((p) => typeof p === "string" && p.length > 0),
    ),
  ];

  if (paths.length) {
    await sb
      .from("cms_redirects")
      .delete()
      .eq("site_id", site)
      .or(`page_id.eq.${page.id},from_path.in.(${paths.join(",")}),to_path.in.(${paths.join(",")})`);
  } else {
    await sb.from("cms_redirects").delete().eq("site_id", site).eq("page_id", page.id);
  }

  await sb
    .from("cms_pages")
    .update({ active_published_revision_id: null })
    .eq("id", page.id);

  // Immutability: published/superseded → archived, then DELETE is allowed.
  const { error: archErr } = await sb
    .from("cms_page_revisions")
    .update({ status: "archived" })
    .eq("page_id", page.id)
    .eq("site_id", site)
    .in("status", ["published", "superseded"]);
  if (archErr) throw archErr;

  const { error: delRevErr } = await sb
    .from("cms_page_revisions")
    .delete()
    .eq("page_id", page.id)
    .eq("site_id", site);
  if (delRevErr) throw delRevErr;

  const { error: delLocErr } = await sb
    .from("cms_page_locale_states")
    .delete()
    .eq("page_id", page.id)
    .eq("site_id", site);
  if (delLocErr) throw delLocErr;

  const { error: delPageErr } = await sb.from("cms_pages").delete().eq("id", page.id);
  if (delPageErr) throw delPageErr;

  console.log("client purge ok", page.stable_key);
}

await ensureDeleteFn();
const { pageIds, byRev } = await findTargets();
console.log("targets", { pageIds, revision: byRev?.id ?? null, status: byRev?.status ?? null });

if (pageIds.length === 0 && byRev?.page_id) {
  pageIds.push(byRev.page_id);
}

if (pageIds.length === 0) {
  // Last resort: archive+delete the stuck revision alone if page row already gone.
  if (byRev) {
    const { error: a } = await sb
      .from("cms_page_revisions")
      .update({ status: "archived" })
      .eq("id", REVISION_ID)
      .in("status", ["published", "superseded"]);
    if (a) throw a;
    const { error: d } = await sb.from("cms_page_revisions").delete().eq("id", REVISION_ID);
    if (d) throw d;
    console.log("orphaned revision purged");
  } else {
    console.log("nothing to purge");
  }
  process.exit(0);
}

for (const id of pageIds) {
  await purgePage(id);
}

const { data: left } = await sb
  .from("cms_page_revisions")
  .select("id, status")
  .eq("id", REVISION_ID)
  .maybeSingle();
console.log("revision remaining:", left ?? null);
console.log("done");
