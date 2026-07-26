/**
 * Idempotent seed of storefront public/images into Supabase cms-media +
 * private.cms_media_assets, with optional CMS content rewrite to storage: refs.
 *
 * Usage (monorepo root, env loaded):
 *   npx tsx scripts/seed-cms-media.ts
 *   npx tsx scripts/seed-cms-media.ts --no-rewrite
 *
 * Requires SUPABASE_URL (+ VITE_SUPABASE_URL fallback) and SUPABASE_SECRET_KEY.
 * Migration: supabase/migrations/20260723160000_cms_media_assets.sql
 *
 * Oversized static assets are compressed with sharp before upload (900 KB stored limit).
 * CMS rewrite uses saveDraft / publishPage — never mutates published revision payloads.
 */
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  replaceCmsImagesInTree,
  storageImage,
  type CmsImage,
  type CmsPage,
  type Locale,
} from "@mccoy/cms-schema";
import {
  DEFAULT_CMS_SITE_ID,
  buildCmsMediaStoragePath,
  createSupabaseServiceClient,
  deriveCmsMediaPublicUrl,
  getCmsStore,
  getFileCmsStore,
  getSupabasePublicConfig,
  hasSupabaseServiceConfig,
  sanitizeOriginalFilename,
  sha256Hex,
  type CmsMediaProfile,
} from "@mccoy/database/server";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import { ensureCmsSeedImageFits } from "./lib/compress-cms-seed-image";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const imagesRoot = path.join(root, "apps/storefront/public/images");
const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;

type SeededAsset = {
  assetId: string;
  publicUrl: string;
  width: number;
  height: number;
  altDefault: string;
  storagePath: string;
};

type ExistingRow = {
  id: string;
  bucket_id: string;
  storage_path: string;
  tags: string[] | null;
  width: number;
  height: number;
  alt_default: string | null;
  original_filename: string | null;
};

function parseArgs(argv: string[]) {
  const noRewrite = argv.includes("--no-rewrite") || argv.includes("--catalog-only");
  const rewrite = !noRewrite;
  return { rewrite };
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/** Public URL path as used in CMS, e.g. `/images/partners/foo.png`. */
function publicPathFromFile(absFile: string): string {
  const rel = toPosix(path.relative(path.join(root, "apps/storefront/public"), absFile));
  return rel.startsWith("/") ? rel : `/${rel}`;
}

function sourceTagFor(publicPath: string): string {
  return `source:${publicPath}`;
}

function profileForPublicPath(publicPath: string): CmsMediaProfile {
  const base = path.basename(publicPath);
  if (publicPath.includes("/images/partners/") || /logo/i.test(base)) return "logo";
  return "photo";
}

function baseTagsForPublicPath(publicPath: string): string[] {
  const tags = ["seed"];
  if (publicPath.includes("/images/partners/")) tags.push("partners", "logo");
  else if (publicPath.includes("/images/cms/")) tags.push("cms");
  else tags.push("static");
  if (/logo/i.test(path.basename(publicPath))) tags.push("logo");
  tags.push(sourceTagFor(publicPath));
  return tags;
}

function mergeTags(existing: string[] | null | undefined, next: string[]): string[] {
  const set = new Set<string>([...(existing ?? []), ...next]);
  return [...set];
}

async function listImageFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listImageFiles(full)));
    } else if (entry.isFile() && IMAGE_EXT.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function normalizeLocalSrc(src: string): string | null {
  const trimmed = src.trim().split("?")[0] ?? "";
  if (trimmed.startsWith("/images/")) return trimmed;
  if (trimmed.startsWith("local:/images/")) return trimmed.slice("local:".length);
  if (trimmed.startsWith("local:images/")) return `/${trimmed.slice("local:".length)}`;
  return null;
}

/**
 * Resolve a CMS image to a seeded public path key.
 * Partners may use assetId `local:images/partners/foo` (no extension) while src has `.png`.
 */
function resolveSeededPath(
  image: CmsImage,
  pathMap: Map<string, SeededAsset>,
): string | null {
  const fromSrc = normalizeLocalSrc(image.src);
  if (fromSrc && pathMap.has(fromSrc)) return fromSrc;

  if (image.assetId.startsWith("local:")) {
    const rest = image.assetId.slice("local:".length).replace(/^\//, "");
    const asPath = `/${rest}`;
    if (pathMap.has(asPath)) return asPath;
    if (!IMAGE_EXT.test(asPath)) {
      for (const key of pathMap.keys()) {
        if (key === asPath || key.startsWith(`${asPath}.`)) return key;
      }
    }
  }
  return null;
}

function rewritePayload(
  payload: unknown,
  pathMap: Map<string, SeededAsset>,
): { next: unknown; replaced: number } {
  let replaced = 0;
  const next = replaceCmsImagesInTree(payload, (img) => {
    const key = resolveSeededPath(img, pathMap);
    if (!key) return null;
    const asset = pathMap.get(key);
    if (!asset) return null;
    replaced += 1;
    return storageImage({
      assetId: asset.assetId,
      publicUrl: asset.publicUrl,
      alt: img.alt || asset.altDefault,
      decorative: img.decorative,
      width: asset.width,
      height: asset.height,
    });
  });
  return { next, replaced };
}

function publishedLocalesFromPage(page: CmsPage): Locale[] {
  const locales: Locale[] = [];
  if (page.localeStates?.nl?.publicationState === "published") locales.push("nl");
  if (page.localeStates?.en?.publicationState === "published") locales.push("en");
  if (locales.length === 0) locales.push("nl");
  return locales;
}

function rowToSeeded(
  row: ExistingRow,
  supabaseUrl: string,
  filenameFallback: string,
): SeededAsset {
  return {
    assetId: row.id,
    publicUrl: deriveCmsMediaPublicUrl({
      supabaseUrl,
      bucketId: row.bucket_id,
      storagePath: row.storage_path,
    }),
    width: row.width,
    height: row.height,
    altDefault: row.alt_default ?? filenameFallback.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
    storagePath: row.storage_path,
  };
}

/**
 * Rewrite local `/images` refs via CmsStore: drafts via saveDraft; live pages via
 * publishPage (new revision). Never UPDATE published revision payloads.
 */
async function rewriteCmsViaStore(
  pathMap: Map<string, SeededAsset>,
): Promise<{
  draftRefs: number;
  publishedRefs: number;
  pagesTouched: number;
  draftsSaved: number;
  pagesPublished: number;
}> {
  const store = getCmsStore();
  const siteId = DEFAULT_CMS_SITE_ID;
  const pages = await store.listPages(siteId);

  let draftRefs = 0;
  let publishedRefs = 0;
  let pagesTouched = 0;
  let draftsSaved = 0;
  let pagesPublished = 0;

  for (const page of pages) {
    const label = page.pageKey ?? page.stableKey ?? page.id;
    const active = await store.getActivePublishedRevision(page.id, siteId);

    if (active?.payload) {
      const { next, replaced } = rewritePayload(active.payload, pathMap);
      if (replaced > 0) {
        const fresh = await store.getPage(page.id, siteId);
        if (!fresh) {
          console.error(`CMS rewrite: page missing after load (${label})`);
          continue;
        }
        try {
          await store.publishPage({
            siteId,
            pageId: page.id,
            payload: next as CmsPage,
            publishedLocales: publishedLocalesFromPage(next as CmsPage),
            expectedDraftRevision: fresh.draftRevisionNumber,
          });
          publishedRefs += replaced;
          pagesTouched += 1;
          pagesPublished += 1;
          console.log(
            `CMS rewrite: published new revision for ${label} (${replaced} image ref(s))`,
          );
        } catch (err) {
          console.error(
            `CMS rewrite: publish ${label}: ${err instanceof Error ? err.message : err}`,
          );
        }
        continue;
      }
    }

    const draft = await store.getDraftPayload(page.id, siteId);
    if (!draft) continue;

    const { next, replaced } = rewritePayload(draft, pathMap);
    if (replaced === 0) continue;

    const fresh = await store.getPage(page.id, siteId);
    if (!fresh) continue;

    try {
      await store.saveDraft({
        pageId: page.id,
        siteId,
        expectedRevisionNumber: fresh.draftRevisionNumber,
        changes: {},
        payload: next as CmsPage,
      });
      draftRefs += replaced;
      draftsSaved += 1;
      pagesTouched += 1;
      console.log(`CMS rewrite: saved draft for ${label} (${replaced} image ref(s))`);
    } catch (err) {
      // Drafts are file-backed; remote cms_bump_draft_revision may be missing/mismatched.
      try {
        const fileStore = getFileCmsStore();
        const filePage = await fileStore.getPage(page.id, siteId);
        if (!filePage) throw err;
        await fileStore.saveDraft({
          pageId: page.id,
          siteId,
          expectedRevisionNumber: filePage.draftRevisionNumber,
          changes: {},
          payload: next as CmsPage,
        });
        draftRefs += replaced;
        draftsSaved += 1;
        pagesTouched += 1;
        console.warn(
          `CMS rewrite: saveDraft RPC failed for ${label}; wrote file draft only (${replaced} ref(s)): ${
            err instanceof Error ? err.message : err
          }`,
        );
      } catch (fileErr) {
        console.error(
          `CMS rewrite: saveDraft ${label}: ${fileErr instanceof Error ? fileErr.message : fileErr}`,
        );
      }
    }
  }

  return { draftRefs, publishedRefs, pagesTouched, draftsSaved, pagesPublished };
}

async function main() {
  ensureMonorepoEnvLoaded();
  const { rewrite } = parseArgs(process.argv.slice(2));

  if (!hasSupabaseServiceConfig()) {
    console.error(
      "Missing SUPABASE_SECRET_KEY (service role). Add it to the monorepo .env and retry.",
    );
    process.exit(1);
  }

  let supabaseUrl: string;
  try {
    supabaseUrl = getSupabasePublicConfig().url;
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    console.error("Also require SUPABASE_URL (or VITE_SUPABASE_URL) and a publishable key.");
    process.exit(1);
  }

  const supabase = createSupabaseServiceClient();
  const siteId = DEFAULT_CMS_SITE_ID;
  const pathMap = new Map<string, SeededAsset>();

  const probe = await supabase
    .schema("private")
    .from("cms_media_assets")
    .select("id")
    .limit(1);
  if (probe.error) {
    const msg = probe.error.message;
    console.error(`Cannot access private.cms_media_assets: ${msg}`);
    if (/Invalid schema:\s*private/i.test(msg)) {
      console.error(
        [
          "",
          "PostgREST does not expose the `private` schema for this project.",
          "Apply supabase/migrations/20260723170000_expose_private_schema_postgrest.sql",
          "(SQL Editor), or Dashboard → Project Settings → Data API → Exposed schemas → add `private`.",
          "Keep grants: service_role only; do not grant anon/authenticated USAGE; do not disable RLS.",
          "Details: docs/cms-media-storage.md",
          "Then re-run: npx tsx scripts/seed-cms-media.ts",
        ].join("\n"),
      );
    } else if (/does not exist|schema cache|Could not find/i.test(msg)) {
      console.error(
        "Apply migration supabase/migrations/20260723160000_cms_media_assets.sql, then retry.",
      );
    }
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let tagsUpdated = 0;
  let compressed = 0;

  const files = await listImageFiles(imagesRoot);
  if (files.length === 0) {
    console.warn(`No images found under ${imagesRoot}`);
  } else {
    console.log(`Found ${files.length} image(s) under public/images`);
  }

  for (const filePath of files) {
    const publicPath = publicPathFromFile(filePath);
    const buf = await readFile(filePath);
    const originalBytes = new Uint8Array(buf);
    const originalHash = sha256Hex(originalBytes);
    const filename = path.basename(filePath);
    const desiredTags = baseTagsForPublicPath(publicPath);
    const preferredProfile = profileForPublicPath(publicPath);
    const sourceTag = sourceTagFor(publicPath);

    const { data: existingByHash, error: existingErr } = await supabase
      .schema("private")
      .from("cms_media_assets")
      .select(
        "id, bucket_id, storage_path, tags, width, height, alt_default, original_filename",
      )
      .eq("site_id", siteId)
      .eq("content_hash", originalHash)
      .eq("status", "active")
      .maybeSingle();

    if (existingErr) {
      failed += 1;
      console.error(`lookup ${publicPath}: ${existingErr.message}`);
      if (/cms_media_assets|schema cache|does not exist/i.test(existingErr.message)) {
        console.error(
          "Hint: apply migration supabase/migrations/20260723160000_cms_media_assets.sql first.",
        );
        process.exit(1);
      }
      continue;
    }

    let existing = existingByHash as ExistingRow | null;

    // After seed-time compression, content_hash is of compressed bytes — match source tag.
    if (!existing) {
      const { data: bySource, error: bySourceErr } = await supabase
        .schema("private")
        .from("cms_media_assets")
        .select(
          "id, bucket_id, storage_path, tags, width, height, alt_default, original_filename",
        )
        .eq("site_id", siteId)
        .eq("status", "active")
        .contains("tags", [sourceTag])
        .limit(1)
        .maybeSingle();
      if (bySourceErr) {
        failed += 1;
        console.error(`lookup source ${publicPath}: ${bySourceErr.message}`);
        continue;
      }
      existing = (bySource as ExistingRow | null) ?? null;
    }

    if (existing) {
      const row = existing;
      const merged = mergeTags(row.tags, desiredTags);
      const tagsChanged =
        merged.length !== (row.tags ?? []).length ||
        merged.some((t) => !(row.tags ?? []).includes(t));
      if (tagsChanged) {
        const { error: tagErr } = await supabase
          .schema("private")
          .from("cms_media_assets")
          .update({ tags: merged })
          .eq("id", row.id)
          .eq("site_id", siteId);
        if (tagErr) {
          console.error(`tags ${publicPath}: ${tagErr.message}`);
        } else {
          tagsUpdated += 1;
        }
      }

      pathMap.set(publicPath, rowToSeeded(row, supabaseUrl, filename));
      skipped += 1;
      console.log(`skip (existing) ${publicPath}`);
      continue;
    }

    const prepared = await ensureCmsSeedImageFits(originalBytes, preferredProfile);
    if (!prepared.ok) {
      failed += 1;
      console.error(`fail ${publicPath}: ${prepared.reason}`);
      continue;
    }

    const { bytes, inspected } = prepared;
    if (prepared.compressed) {
      compressed += 1;
      console.log(
        `compress ${publicPath}: ${originalBytes.byteLength} → ${bytes.byteLength} B (${inspected.mimeType})`,
      );
    }

    const hash = sha256Hex(bytes);
    const assetId = randomUUID();
    const storagePath = buildCmsMediaStoragePath({
      siteId,
      assetId,
      extension: inspected.extension,
    });
    const profile: CmsMediaProfile =
      inspected.mimeType === "image/gif"
        ? "gif"
        : preferredProfile === "logo" &&
            (inspected.mimeType === "image/png" || inspected.mimeType === "image/webp")
          ? "logo"
          : "photo";

    const altDefault = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");

    // Dedupe if compressed bytes already catalogued (same content, different source path).
    const { data: existingCompressed } = await supabase
      .schema("private")
      .from("cms_media_assets")
      .select(
        "id, bucket_id, storage_path, tags, width, height, alt_default, original_filename",
      )
      .eq("site_id", siteId)
      .eq("content_hash", hash)
      .eq("status", "active")
      .maybeSingle();

    if (existingCompressed) {
      const row = existingCompressed as ExistingRow;
      const merged = mergeTags(row.tags, desiredTags);
      await supabase
        .schema("private")
        .from("cms_media_assets")
        .update({ tags: merged })
        .eq("id", row.id)
        .eq("site_id", siteId);
      pathMap.set(publicPath, rowToSeeded(row, supabaseUrl, filename));
      skipped += 1;
      console.log(`skip (hash after compress) ${publicPath}`);
      continue;
    }

    const { error: upErr } = await supabase.storage.from("cms-media").upload(storagePath, bytes, {
      contentType: inspected.mimeType,
      upsert: false,
      cacheControl: "31536000",
    });
    if (upErr && !/already exists|Duplicate/i.test(upErr.message)) {
      failed += 1;
      console.error(`storage ${publicPath}: ${upErr.message}`);
      if (/Bucket not found|not found/i.test(upErr.message)) {
        console.error(
          "Hint: apply migration supabase/migrations/20260723160000_cms_media_assets.sql (creates cms-media bucket).",
        );
      }
      continue;
    }

    const { error: insErr } = await supabase.schema("private").from("cms_media_assets").insert({
      id: assetId,
      site_id: siteId,
      bucket_id: "cms-media",
      storage_path: storagePath,
      content_hash: hash,
      original_filename: sanitizeOriginalFilename(filename),
      mime_type: inspected.mimeType,
      byte_size: inspected.byteSize,
      width: inspected.width,
      height: inspected.height,
      alt_default: altDefault,
      tags: desiredTags,
      profile,
      status: "active",
    });
    if (insErr) {
      await supabase.storage.from("cms-media").remove([storagePath]);
      failed += 1;
      console.error(`catalog ${publicPath}: ${insErr.message}`);
      if (/cms_media_assets|does not exist/i.test(insErr.message)) {
        console.error(
          "Hint: apply migration supabase/migrations/20260723160000_cms_media_assets.sql first.",
        );
        process.exit(1);
      }
      continue;
    }

    pathMap.set(publicPath, {
      assetId,
      publicUrl: deriveCmsMediaPublicUrl({
        supabaseUrl,
        bucketId: "cms-media",
        storagePath,
      }),
      width: inspected.width,
      height: inspected.height,
      altDefault,
      storagePath,
    });
    created += 1;
    console.log(`ok ${publicPath} → ${storagePath}`);
  }

  let draftRefs = 0;
  let publishedRefs = 0;
  let pagesTouched = 0;
  let draftsSaved = 0;
  let pagesPublished = 0;

  if (rewrite) {
    console.log("\nRewriting CMS local/image refs → storage:… (draft/save + new publish only)");
    const result = await rewriteCmsViaStore(pathMap);
    draftRefs = result.draftRefs;
    publishedRefs = result.publishedRefs;
    pagesTouched = result.pagesTouched;
    draftsSaved = result.draftsSaved;
    pagesPublished = result.pagesPublished;
  } else {
    console.log("\nSkipping CMS rewrite (--no-rewrite).");
  }

  console.log("\n── Summary ──");
  console.log(
    `catalog: created=${created} skipped=${skipped} failed=${failed} tagsUpdated=${tagsUpdated} compressed=${compressed}`,
  );
  console.log(`path map entries: ${pathMap.size}`);
  if (rewrite) {
    console.log(
      `cms rewrite: draftRefs=${draftRefs} publishedRefs=${publishedRefs} pagesTouched=${pagesTouched} draftsSaved=${draftsSaved} pagesPublished=${pagesPublished}`,
    );
    if (pagesPublished > 0) {
      console.log(
        "Note: live pages received new published revisions (previous revisions left immutable).",
      );
    }
    if (draftsSaved > 0 && pagesPublished === 0) {
      console.log(
        "Note: only draft payloads were rewritten (published already clean, or draft-only pages). Publish from admin if a draft-only page should go live.",
      );
    }
  }
  console.log(`Done.${failed > 0 ? " (with failures)" : ""}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
