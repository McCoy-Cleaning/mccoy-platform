import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const pages = await sb.from("cms_pages").select("kind,stable_key").eq("kind", "custom");
const rev = await sb
  .from("cms_page_revisions")
  .select("id")
  .eq("id", "619104bc-02fa-4269-a387-4d51c59a85c2");
const paths = await sb
  .from("cms_page_locale_states")
  .select("path")
  .ilike("path", "%referenties%");
console.log(
  JSON.stringify(
    {
      customPages: pages.data,
      stuckRevision: rev.data,
      referentiesPaths: paths.data,
      errors: { pages: pages.error, rev: rev.error, paths: paths.error },
    },
    null,
    2,
  ),
);
