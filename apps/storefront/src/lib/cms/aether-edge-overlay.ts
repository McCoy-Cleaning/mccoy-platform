/**
 * Opt-in Improve edge overlay — approved title / meta / H1 only.
 *
 * Frozen deployed SEO (SEO-7 ≠ SEO-8) stays the baseline. This overlay
 * bypasses CMS publish for those three fields when a human has Approved
 * a staged fix. It is not a client-after-paint script.
 */
export const MCCOY_AETHER_SITE_ID = "d06f2e13-d001-45b8-90a7-dc2724330a5e";
export const LAB_SEO_OPS_ORIGIN = "http://127.0.0.1:1480";

export type EdgePagePatch = {
  url: string;
  path: string;
  title?: string;
  description?: string;
  h1?: string;
};

export type EdgePatchesDocument = {
  version: number;
  siteId: string;
  notice?: string;
  patches: EdgePagePatch[];
};

export type StagedFixDumpPatch = {
  status?: string;
  kind?: string;
  pageUrl?: string;
  proposedValue?: string;
};

export type StagedFixDump = {
  version?: number;
  siteId?: string;
  patches?: StagedFixDumpPatch[];
};

export function decodeProposedValue(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function normalizeOverlayPath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) return "/";
  const noQuery = trimmed.split("?")[0] ?? trimmed;
  const noHash = noQuery.split("#")[0] ?? noQuery;
  const collapsed = noHash.replace(/\/+$/, "") || "/";
  return collapsed.startsWith("/") ? collapsed : `/${collapsed}`;
}

export function pathFromPageUrl(pageUrl: string): string {
  const raw = pageUrl.trim();
  if (!raw) return "/";
  try {
    return normalizeOverlayPath(new URL(raw).pathname);
  } catch {
    return normalizeOverlayPath(raw.startsWith("/") ? raw : `/${raw}`);
  }
}

function blank(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const t = decodeProposedValue(value).trim();
  return t.length ? t : undefined;
}

/** Approved-only. Pending / rejected / other kinds are ignored. */
export function edgeDocumentFromDump(dump: StagedFixDump | EdgePatchesDocument | null | undefined): EdgePatchesDocument | null {
  if (!dump || typeof dump !== "object") return null;
  const siteId = "siteId" in dump && typeof dump.siteId === "string" ? dump.siteId : MCCOY_AETHER_SITE_ID;
  const rows = Array.isArray(dump.patches) ? dump.patches : [];
  if (rows.length && "path" in (rows[0] as object)) {
    const approved = (rows as EdgePagePatch[]).filter((p) => p && typeof p.path === "string");
    return {
      version: typeof dump.version === "number" ? dump.version : 1,
      siteId,
      notice: "notice" in dump && typeof dump.notice === "string" ? dump.notice : undefined,
      patches: approved.map((p) => ({
        url: p.url,
        path: normalizeOverlayPath(p.path),
        title: blank(p.title),
        description: blank(p.description),
        h1: blank(p.h1),
      })),
    };
  }
  const byPath = new Map<string, EdgePagePatch>();
  for (const row of rows as StagedFixDumpPatch[]) {
    if (row.status !== "approved") continue;
    const kind = row.kind;
    const proposed = blank(row.proposedValue);
    const pageUrl = typeof row.pageUrl === "string" ? row.pageUrl : "";
    if (!proposed || !pageUrl) continue;
    if (kind !== "title" && kind !== "meta_description" && kind !== "h1") continue;
    const path = pathFromPageUrl(pageUrl);
    const prev = byPath.get(path) ?? { url: pageUrl, path };
    if (kind === "title") prev.title = proposed;
    else if (kind === "meta_description") prev.description = proposed;
    else prev.h1 = proposed;
    byPath.set(path, prev);
  }
  return {
    version: 1,
    siteId,
    notice:
      "Opt-in Improve overlay. Approved title/meta/H1 apply without CMS publish. Frozen deployed SEO remains the baseline when no approved patch exists.",
    patches: [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export function lookupEdgePatch(
  doc: EdgePatchesDocument | null | undefined,
  pathname: string,
): EdgePagePatch | null {
  if (!doc) return null;
  const path = normalizeOverlayPath(pathname);
  return doc.patches.find((p) => p.path === path) ?? null;
}

export type OverlayHead = {
  title?: string;
  meta?: Array<{ name?: string; content?: string; title?: string; property?: string }>;
};

/** Overlay approved title/description on a resolved CMS head. */
export function applyEdgeHead<T extends OverlayHead>(head: T, patch: EdgePagePatch | null | undefined): T {
  if (!patch || (!patch.title && !patch.description)) return head;
  const meta = head.meta ? head.meta.map((m) => ({ ...m })) : [];
  if (patch.title) {
    head = { ...head, title: patch.title };
    const titleMeta = meta.find((m) => m.title != null);
    if (titleMeta) titleMeta.title = patch.title;
    const ogTitle = meta.find((m) => m.property === "og:title");
    if (ogTitle) ogTitle.content = patch.title;
  }
  if (patch.description) {
    const desc = meta.find((m) => m.name === "description");
    if (desc) desc.content = patch.description;
    else meta.push({ name: "description", content: patch.description });
    const og = meta.find((m) => m.property === "og:description");
    if (og) og.content = patch.description;
  }
  return { ...head, meta };
}

export type OverlayH1Plan =
  | { mode: "replace"; text: string }
  | { mode: "inject"; text: string }
  | { mode: "none" };

/**
 * Replace the heading the template already renders, or inject a single H1
 * when the page has none. Never two H1s.
 */
export function planOverlayH1(input: {
  hasExistingH1: boolean;
  existingHeading?: string | null;
  pageTitle?: string | null;
  patchH1?: string | null;
}): OverlayH1Plan {
  const patch = blank(input.patchH1 ?? undefined);
  if (input.hasExistingH1) {
    if (patch) return { mode: "replace", text: patch };
    return { mode: "none" };
  }
  const inject = patch ?? blank(input.pageTitle ?? undefined);
  if (inject) return { mode: "inject", text: inject };
  return { mode: "none" };
}

export function resolveOverlayHeading(existingHeading: string, patchH1?: string | null): string {
  const plan = planOverlayH1({
    hasExistingH1: true,
    existingHeading,
    patchH1,
  });
  return plan.mode === "replace" ? plan.text : existingHeading;
}

export function labEdgePatchesUrl(siteId: string = MCCOY_AETHER_SITE_ID): string {
  return `${LAB_SEO_OPS_ORIGIN}/v1/sites/${siteId}/edge-patches.json`;
}
