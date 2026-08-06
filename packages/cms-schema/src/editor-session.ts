/**
 * Shared CMS editor session model — Admin + storefront agree on how a page is
 * resolved for display and which content source the editor is working from.
 *
 * Pure functions only. Persistence stays in each app store.
 */
import { CMS_SCHEMA_VERSION, type BuiltinCmsPage, type CmsPage, type PageDraft } from "./types";
import { CURRENT_LAYOUT_VERSION } from "./sections";
import { normalizeCmsPage } from "./pipeline";
import { applyDraftToPage, isDraftDirty } from "./draft";
import { localizeCmsPageForLocale } from "./en-field-drafts";
import type { Locale } from "./locale";
import { resolveProductsBlocksLayout } from "./migration/products-blocks";
import { countEditorSections } from "./composite-sections";

/** Stable JSON for hashes — browser-safe (no node:crypto). */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key]);
    }
    return out;
  }
  return value;
}

export type CmsEditorContentSource = "published" | "saved_draft" | "local_unsaved";

export type CmsEditorStatusLabel =
  | "live"
  | "local_restored"
  | "concept"
  | "conflict"
  | "load_error";

/** Dutch copy for admin chrome near page actions. */
export const CMS_EDITOR_STATUS_COPY_NL: Record<CmsEditorStatusLabel, string> = {
  live: "Live",
  local_restored: "Niet-opgeslagen hersteld",
  concept: "Concept",
  conflict: "Conflict",
  load_error: "Laden mislukt",
};

export type CmsPageRevisionRef = {
  /** Optimistic concurrency / page.version */
  version: number;
  /** page.updatedAt (ms) */
  updatedAt: number;
};

export function cmsPageRevisionId(page: Pick<CmsPage, "version" | "updatedAt">): string {
  return `v${page.version ?? 0}@${page.updatedAt ?? 0}`;
}

export function parseCmsPageRevisionId(id: string): CmsPageRevisionRef | null {
  const m = /^v(\d+)@(\d+)$/.exec(id);
  if (!m) return null;
  return { version: Number(m[1]), updatedAt: Number(m[2]) };
}

/**
 * Content fingerprint for parity / dirty / conflict checks.
 * Ignores volatile migration timestamps and updatedAt so structural migration
 * of the same content does not look like an intentional edit.
 */
export function hashCmsPageContent(page: CmsPage): string {
  const normalized = normalizeCmsPage(structuredClone(page));
  const forHash = stripVolatilePageFields(normalized);
  return fnv1aHex(stableStringify(forHash));
}

function stripVolatilePageFields(page: CmsPage): unknown {
  const clone = structuredClone(page) as Record<string, unknown>;
  delete clone.updatedAt;
  delete clone.updatedBy;
  if (
    clone.productsBlocksMigration &&
    typeof clone.productsBlocksMigration === "object"
  ) {
    const mig = { ...(clone.productsBlocksMigration as Record<string, unknown>) };
    delete mig.migratedAt;
    clone.productsBlocksMigration = mig;
  }
  return clone;
}

/** Browser-safe FNV-1a 32-bit → hex (parity / session only, not security). */
export function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Canonical display resolve shared by Admin preview and storefront public pages.
 * Does not persist. Producten fixed→blocks runs in memory only.
 */
export function resolveCmsPageForDisplay(
  page: CmsPage,
  locale: Locale = "nl",
): CmsPage {
  const normalized = normalizeCmsPage(structuredClone(page));
  if (normalized.kind === "builtin" && normalized.pageKey === "products") {
    const migrated = resolveProductsBlocksLayout(normalized as BuiltinCmsPage).page;
    return localizeCmsPageForLocale(migrated, locale);
  }
  return localizeCmsPageForLocale(normalized, locale);
}

/** Layout/block fingerprint for structured compare summaries. */
export function summarizeCmsPageStructure(page: CmsPage): {
  layoutKinds: string[];
  blockTypes: string[];
  sectionKeys: string[];
  contentHash: string;
  revisionId: string;
} {
  const display = resolveCmsPageForDisplay(page, "nl");
  return {
    layoutKinds: display.layout.map((item) =>
      item.kind === "fixed" ? `fixed:${item.key}` : `block:${item.blockId}`,
    ),
    blockTypes: display.blocks.map((b) => `${b.type}:${b.id}`),
    sectionKeys:
      display.kind === "builtin"
        ? Object.keys(display.sectionContent ?? {}).sort()
        : [],
    contentHash: hashCmsPageContent(display),
    revisionId: cmsPageRevisionId(page),
  };
}

export type CmsLocalDraftEnvelope = {
  schemaVersion: number;
  layoutVersion: number;
  pageId: string;
  baselineRevisionId: string;
  baselineContentHash: string;
  contentHash: string;
  dirty: boolean;
  savedAt: number;
  /** True when rehydrated from a previous visit's localStorage. */
  restoredFromStorage?: boolean;
  /**
   * False for pre-repair localStorage drafts that lack editorMeta.
   * Those cannot prove an intentional baseline — do not restore them.
   */
  hasEditorMeta?: boolean;
  draft: PageDraft;
};

/**
 * Section count for Admin overview / Secties badges.
 * Uses the same display resolve as storefront + editor (Producten fixed→blocks in memory).
 * Never invents a page-specific fake count from template defaults.
 */
export function countCmsPageEditorSections(page: CmsPage, locale: Locale = "nl"): number {
  return countEditorSections(resolveCmsPageForDisplay(page, locale).layout);
}

export function createLocalDraftEnvelope(input: {
  pageId: string;
  baselinePage: CmsPage;
  draft: PageDraft;
  savedAt?: number;
  restoredFromStorage?: boolean;
}): CmsLocalDraftEnvelope {
  const working = applyDraftToPage(input.baselinePage, input.draft);
  const contentHash = hashCmsPageContent(working);
  const baselineContentHash = hashCmsPageContent(input.baselinePage);
  const { editorMeta: _drop, ...draftWithoutMeta } = input.draft;
  void _drop;
  return {
    schemaVersion: CMS_SCHEMA_VERSION,
    layoutVersion:
      working.layoutVersion ??
      input.baselinePage.layoutVersion ??
      CURRENT_LAYOUT_VERSION,
    pageId: input.pageId,
    baselineRevisionId: cmsPageRevisionId(input.baselinePage),
    baselineContentHash,
    contentHash,
    dirty: isDraftDirty(draftWithoutMeta) && contentHash !== baselineContentHash,
    savedAt: input.savedAt ?? Date.now(),
    restoredFromStorage: input.restoredFromStorage ?? false,
    hasEditorMeta: true,
    draft: structuredClone(draftWithoutMeta),
  };
}

/** Attach / refresh editorMeta on a PageDraft for localStorage persistence. */
export function withEditorMetaOnDraft(
  draft: PageDraft,
  baselinePage: CmsPage,
  opts?: { restoredFromStorage?: boolean; savedAt?: number },
): PageDraft {
  const envelope = createLocalDraftEnvelope({
    pageId: baselinePage.id,
    baselinePage,
    draft,
    savedAt: opts?.savedAt,
    restoredFromStorage: opts?.restoredFromStorage,
  });
  return {
    ...structuredClone(draft),
    editorMeta: {
      schemaVersion: envelope.schemaVersion,
      layoutVersion: envelope.layoutVersion,
      baselineRevisionId: envelope.baselineRevisionId,
      baselineContentHash: envelope.baselineContentHash,
      contentHash: envelope.contentHash,
      dirty: envelope.dirty,
      savedAt: envelope.savedAt,
      restoredFromStorage: envelope.restoredFromStorage,
    },
  };
}

export function localDraftEnvelopeFromPageDraft(
  pageId: string,
  draft: PageDraft | undefined,
  baselinePage: CmsPage,
): CmsLocalDraftEnvelope | null {
  if (!draft || !isDraftDirty(draft)) return null;
  const meta = draft.editorMeta;
  if (meta) {
    const { editorMeta: _drop, ...rest } = draft;
    void _drop;
    return {
      schemaVersion: meta.schemaVersion,
      layoutVersion: meta.layoutVersion,
      pageId,
      baselineRevisionId: meta.baselineRevisionId,
      baselineContentHash: meta.baselineContentHash,
      contentHash: meta.contentHash,
      dirty: meta.dirty,
      savedAt: meta.savedAt,
      restoredFromStorage: meta.restoredFromStorage ?? true,
      hasEditorMeta: true,
      draft: structuredClone(rest),
    };
  }
  // Legacy drafts without meta — cannot prove intentional baseline (Producten
  // auto-ensure used to invent these). Mark unrestorable; reconcile deletes them.
  return {
    ...createLocalDraftEnvelope({
      pageId,
      baselinePage,
      draft,
      restoredFromStorage: true,
    }),
    hasEditorMeta: false,
  };
}

/**
 * Restore rules: never restore dirty:false or hash===baseline; reject schema/page mismatch.
 */
export function shouldRestoreLocalDraft(
  envelope: CmsLocalDraftEnvelope | null | undefined,
  currentPublished: CmsPage,
): { restore: false; reason: string } | { restore: true; envelope: CmsLocalDraftEnvelope } {
  if (!envelope) return { restore: false, reason: "missing" };
  if (envelope.pageId !== currentPublished.id) {
    return { restore: false, reason: "page_mismatch" };
  }
  if (envelope.schemaVersion !== CMS_SCHEMA_VERSION) {
    return { restore: false, reason: "schema_version" };
  }
  // Pre-repair auto-migration drafts lack editorMeta — never treat as intentional.
  if (envelope.hasEditorMeta === false) {
    return { restore: false, reason: "legacy_without_meta" };
  }
  if (!envelope.dirty) return { restore: false, reason: "not_dirty" };
  if (envelope.contentHash === envelope.baselineContentHash) {
    return { restore: false, reason: "hash_equals_baseline" };
  }
  if (!isDraftDirty(envelope.draft)) {
    return { restore: false, reason: "draft_empty" };
  }
  return { restore: true, envelope };
}

export function isServerNewerThanBaseline(
  serverPage: CmsPage,
  baselineRevisionId: string,
): boolean {
  const baseline = parseCmsPageRevisionId(baselineRevisionId);
  if (!baseline) return true;
  const serverVersion = serverPage.version ?? 0;
  const serverUpdated = serverPage.updatedAt ?? 0;
  if (serverVersion > baseline.version) return true;
  if (serverVersion < baseline.version) return false;
  return serverUpdated > baseline.updatedAt;
}

export type CmsEditorSessionInput = {
  pageId: string;
  /** Authoritative published (or hydrated) page from durable store. */
  publishedPage: CmsPage | null;
  /** Local unsaved draft envelope (localStorage). */
  localDraft: CmsLocalDraftEnvelope | null;
  /**
   * Optional saved server concept that differs from published.
   * When present and different, source is saved_draft unless a valid local draft wins.
   */
  savedDraftPage?: CmsPage | null;
  /** Load failure — never invent defaults as invisible recovery. */
  loadError?: string | null;
  locale?: Locale;
};

export type CmsEditorSessionState = {
  pageId: string;
  source: CmsEditorContentSource;
  statusLabel: CmsEditorStatusLabel;
  statusCopyNl: string;
  baselineRevisionId: string;
  baselineContentHash: string;
  workingContentHash: string;
  serverRevisionId: string;
  serverContentHash: string;
  dirty: boolean;
  restoredLocalDraft: boolean;
  hasSavedDraft: boolean;
  conflict: boolean;
  /** Working page for the editor (draft-applied when applicable). */
  page: CmsPage | null;
  /** Same pipeline as storefront public display. */
  displayPage: CmsPage | null;
  loadError: string | null;
  compareSummary?: {
    admin: ReturnType<typeof summarizeCmsPageStructure>;
    published: ReturnType<typeof summarizeCmsPageStructure>;
  };
};

/**
 * Loading precedence:
 * A — valid dirty local unsaved (unless conflict with newer server)
 * B — saved server draft ≠ published → Concept
 * C — no draft → exact published (Admin ≡ storefront after display resolve)
 * D — server newer than local baseline → conflict
 */
export function resolveCmsEditorSession(
  input: CmsEditorSessionInput,
): CmsEditorSessionState {
  const locale = input.locale ?? "nl";

  if (input.loadError) {
    return emptyErrorSession(input.pageId, input.loadError);
  }
  if (!input.publishedPage) {
    return emptyErrorSession(input.pageId, "Pagina kon niet worden geladen.");
  }

  const published = normalizeCmsPage(structuredClone(input.publishedPage));
  const serverRevisionId = cmsPageRevisionId(published);
  const serverContentHash = hashCmsPageContent(published);
  const publishedDisplay = resolveCmsPageForDisplay(published, locale);

  const savedDraft =
    input.savedDraftPage != null
      ? normalizeCmsPage(structuredClone(input.savedDraftPage))
      : null;
  const hasSavedDraft =
    savedDraft != null && hashCmsPageContent(savedDraft) !== serverContentHash;

  const restore = shouldRestoreLocalDraft(input.localDraft, published);

  if (restore.restore) {
    const conflict = isServerNewerThanBaseline(
      published,
      restore.envelope.baselineRevisionId,
    );
    const working = applyDraftToPage(published, restore.envelope.draft);
    const workingHash = hashCmsPageContent(working);
    const displayPage = resolveCmsPageForDisplay(working, locale);
    const fromStorage = restore.envelope.restoredFromStorage === true;
    const statusLabel: CmsEditorStatusLabel = conflict
      ? "conflict"
      : fromStorage
        ? "local_restored"
        : "concept";
    return {
      pageId: input.pageId,
      source: "local_unsaved",
      statusLabel,
      statusCopyNl: CMS_EDITOR_STATUS_COPY_NL[statusLabel],
      baselineRevisionId: restore.envelope.baselineRevisionId,
      baselineContentHash: restore.envelope.baselineContentHash,
      workingContentHash: workingHash,
      serverRevisionId,
      serverContentHash,
      dirty: true,
      restoredLocalDraft: fromStorage,
      hasSavedDraft,
      conflict,
      page: working,
      displayPage,
      loadError: null,
      compareSummary: {
        admin: summarizeCmsPageStructure(working),
        published: summarizeCmsPageStructure(published),
      },
    };
  }

  if (hasSavedDraft && savedDraft) {
    const displayPage = resolveCmsPageForDisplay(savedDraft, locale);
    return {
      pageId: input.pageId,
      source: "saved_draft",
      statusLabel: "concept",
      statusCopyNl: CMS_EDITOR_STATUS_COPY_NL.concept,
      baselineRevisionId: serverRevisionId,
      baselineContentHash: serverContentHash,
      workingContentHash: hashCmsPageContent(savedDraft),
      serverRevisionId,
      serverContentHash,
      dirty: false,
      restoredLocalDraft: false,
      hasSavedDraft: true,
      conflict: false,
      page: savedDraft,
      displayPage,
      loadError: null,
      compareSummary: {
        admin: summarizeCmsPageStructure(savedDraft),
        published: summarizeCmsPageStructure(published),
      },
    };
  }

  // C — no intentional draft: Admin working page ≡ published; display ≡ storefront
  return {
    pageId: input.pageId,
    source: "published",
    statusLabel: "live",
    statusCopyNl: CMS_EDITOR_STATUS_COPY_NL.live,
    baselineRevisionId: serverRevisionId,
    baselineContentHash: serverContentHash,
    workingContentHash: serverContentHash,
    serverRevisionId,
    serverContentHash,
    dirty: false,
    restoredLocalDraft: false,
    hasSavedDraft: false,
    conflict: false,
    page: published,
    displayPage: publishedDisplay,
    loadError: null,
  };
}

function emptyErrorSession(pageId: string, loadError: string): CmsEditorSessionState {
  return {
    pageId,
    source: "published",
    statusLabel: "load_error",
    statusCopyNl: CMS_EDITOR_STATUS_COPY_NL.load_error,
    baselineRevisionId: "",
    baselineContentHash: "",
    workingContentHash: "",
    serverRevisionId: "",
    serverContentHash: "",
    dirty: false,
    restoredLocalDraft: false,
    hasSavedDraft: false,
    conflict: false,
    page: null,
    displayPage: null,
    loadError,
  };
}

/**
 * Whether a migration-only change should update the local published baseline
 * without creating an intentional dirty draft.
 */
export function isMigrationOnlyChange(
  before: CmsPage,
  after: CmsPage,
): boolean {
  // Same content hash after stripping volatiles ⇒ display-equivalent.
  if (hashCmsPageContent(before) === hashCmsPageContent(after)) return true;
  const a = resolveCmsPageForDisplay(before, "nl");
  const b = resolveCmsPageForDisplay(after, "nl");
  return hashCmsPageContent(a) === hashCmsPageContent(b);
}
