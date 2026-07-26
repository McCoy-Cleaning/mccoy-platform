import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const l of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const file = JSON.parse(readFileSync(".data/cms-published.json", "utf8"));
const pages = file.pages ?? file?.sites?.[0]?.pages ?? [];
const nav = file.navigation ?? file?.sites?.[0]?.navigation;
const titles = (Array.isArray(pages) ? pages : Object.values(pages || {}))
  .flat()
  .map((p) => ({ id: p?.id, title: p?.title, slug: p?.slug, inNav: p?.inNav, isCustom: p?.isCustom }));

console.log(
  "file custom/referenties",
  titles.filter(
    (p) =>
      p?.isCustom ||
      String(p?.title || "").toLowerCase().includes("refer") ||
      String(p?.slug || "").toLowerCase().includes("refer"),
  ),
);
console.log(
  "file nav labels",
  (nav?.links ?? []).map((l) => l.label),
);

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: dbPages } = await sb.from("cms_pages").select("kind,stable_key");
const { data: sites } = await sb.from("cms_sites").select("id,slug,settings").limit(5);
console.log("db pages", dbPages);
console.log("db sites keys", sites?.map((s) => ({ id: s.id, slug: s.slug, settingsKeys: s.settings && Object.keys(s.settings) })));
