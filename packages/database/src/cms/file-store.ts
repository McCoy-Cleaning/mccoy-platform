/**
 * File-backed CMS store (local / preview when Supabase is not configured).
 * Mirrors Phase B constraints and atomic publish + outbox semantics.
 */
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  ensurePageLocaleFields,
  normalizeCmsPath,
  type CmsPage,
  type CmsPagePublishedEvent,
  type Locale,
} from "@mccoy/cms-schema";
import { getDataDir } from "@mccoy/security";

import {
  DEFAULT_CMS_SITE_ID,
  DEFAULT_CMS_SITE_SLUG,
  type CmsLocaleStateRecord,
  type CmsOutboxRecord,
  type CmsPageRecord,
  type CmsPublishedLookup,
  type CmsRedirectRecord,
  type CmsRevisionRecord,
  type CmsSiteRecord,
  type CmsStore,
  type PublishPageInput,
  type PublishPageResult,
  type RollbackPageInput,
  type UpsertPageInput,
  type DeletePageInput,
  type DeletePageResult,
} from "./types";

type StoreFile = {
  version: 1;
  site: CmsSiteRecord;
  pages: CmsPageRecord[];
  revisions: CmsRevisionRecord[];
  localeStates: CmsLocaleStateRecord[];
  redirects: CmsRedirectRecord[];
  outbox: CmsOutboxRecord[];
  /** Latest draft payloads keyed by page id (mutable). */
  drafts: Record<string, CmsPage>;
};

type StoreBackend = {
  memoryOnly: boolean;
  memory: StoreFile | null;
  fsAvailable: boolean | null;
  writeChain: Promise<void>;
  fileName: string;
};

function nowIso() {
  return new Date().toISOString();
}

function defaultSite(): CmsSiteRecord {
  return {
    id: DEFAULT_CMS_SITE_ID,
    slug: DEFAULT_CMS_SITE_SLUG,
    origin: "https://www.mccoy.nl",
    configVersion: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function emptyStore(): StoreFile {
  return {
    version: 1,
    site: defaultSite(),
    pages: [],
    revisions: [],
    localeStates: [],
    redirects: [],
    outbox: [],
    drafts: {},
  };
}

function storePaths(fileName: string) {
  const dir = getDataDir();
  return { dir, file: path.join(dir, fileName) };
}

async function probeFs(backend: StoreBackend): Promise<boolean> {
  if (backend.memoryOnly) return false;
  if (backend.fsAvailable !== null) return backend.fsAvailable;
  try {
    await mkdir(storePaths(backend.fileName).dir, { recursive: true });
    backend.fsAvailable = true;
  } catch {
    backend.fsAvailable = false;
  }
  return backend.fsAvailable;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Windows can transiently fail a read (EBUSY/EPERM, or a brief ENOENT while
 * `renameWindowsSafe`'s unlink-then-rename fallback is settling — e.g. a
 * virus scanner holding the just-written file) immediately after another
 * write to the same store file completes. A reader that hits this window
 * must retry rather than report "store is empty": silently discarding a
 * known-good in-memory snapshot for a transient I/O error is exactly what
 * turned a momentary FS hiccup into "cms publish: page not found" right
 * after an upsert. Only a genuinely missing file with no prior snapshot
 * (first-ever read) is treated as a real empty store.
 */
async function readStore(backend: StoreBackend): Promise<StoreFile> {
  if (!(await probeFs(backend))) {
    if (!backend.memory) backend.memory = emptyStore();
    return backend.memory;
  }
  const { file } = storePaths(backend.fileName);
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const raw = (await readFile(file, "utf8")).replace(/^\uFEFF/, "");
      const parsed = JSON.parse(raw) as StoreFile;
      if (!parsed || parsed.version !== 1) {
        return backend.memory ?? emptyStore();
      }
      backend.memory = parsed;
      return parsed;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" && !backend.memory) {
        // Bootstrap case: the store file genuinely does not exist yet.
        return emptyStore();
      }
      if (attempt < maxAttempts - 1) {
        await sleep(20 * (attempt + 1));
        continue;
      }
      // Retries exhausted on a transient error — prefer the last known-good
      // snapshot over reporting an empty store, which would otherwise erase
      // in-flight writes (e.g. a page that was just upserted) from view.
      return backend.memory ?? emptyStore();
    }
  }
  return backend.memory ?? emptyStore();
}

/**
 * Windows frequently returns EPERM/EBUSY on fs.rename over an existing file
 * when another process (e.g. a virus scanner or a second dev-server worker)
 * briefly holds a handle on the destination. Node's rename-over-existing-file
 * is atomic on POSIX but not reliably so on Windows, so we retry with
 * progressively less-atomic fallbacks instead of failing the whole publish.
 */
async function renameWindowsSafe(tmp: string, file: string): Promise<void> {
  try {
    await rename(tmp, file);
    return;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EPERM" && code !== "EEXIST" && code !== "EBUSY") {
      await unlink(tmp).catch(() => {});
      throw error;
    }
  }

  try {
    await unlink(file).catch(() => {});
    await rename(tmp, file);
    return;
  } catch {
    // fall through to copy fallback
  }

  try {
    await copyFile(tmp, file);
    await unlink(tmp).catch(() => {});
    return;
  } catch {
    // fall through to direct-write fallback
  }

  // Last resort: write the destination directly. Loses the atomic
  // rename guarantee, but keeps the store durable on locked-file Windows setups.
  const body = await readFile(tmp, "utf8");
  await writeFile(file, body, "utf8");
  await unlink(tmp).catch(() => {});
}

async function writeStore(backend: StoreBackend, next: StoreFile): Promise<void> {
  backend.memory = next;
  if (!(await probeFs(backend))) return;
  const { dir, file } = storePaths(backend.fileName);
  const tmp = path.join(dir, `cms-published.${process.pid}.${Date.now()}.tmp`);
  const body = JSON.stringify(next, null, 2);
  backend.writeChain = backend.writeChain.then(async () => {
    await writeFile(tmp, body, "utf8");
    await renameWindowsSafe(tmp, file);
  });
  await backend.writeChain;
}

function identityPath(locale: Locale, publicPath: string): string {
  if (locale === "en") {
    if (publicPath === "/en") return "/";
    return publicPath.replace(/^\/en/, "") || "/";
  }
  return publicPath;
}

function publicPathFor(locale: Locale, pathValue: string): string {
  return normalizeCmsPath(locale, pathValue);
}

function assertRedirectValid(fromPath: string, toPath: string) {
  if (fromPath === toPath) {
    throw new Error("Redirect target cannot equal source.");
  }
}

function publishedPathTaken(
  store: StoreFile,
  siteId: string,
  locale: Locale,
  publicPath: string,
  exceptPageId?: string,
): boolean {
  return store.localeStates.some(
    (row) =>
      row.siteId === siteId &&
      row.locale === locale &&
      row.publicPath === publicPath &&
      row.publicationState === "published" &&
      row.pageId !== exceptPageId,
  );
}

function pageToRecord(page: CmsPage, siteId: string, existing?: CmsPageRecord): CmsPageRecord {
  const now = nowIso();
  return {
    id: page.id,
    siteId,
    stableKey: page.id.startsWith("page_") ? page.id : existing?.stableKey ?? null,
    kind: page.kind,
    pageKey: page.kind === "builtin" ? page.pageKey : null,
    inNav: page.inNav,
    isDraftOnly: page.isDraftOnly ?? existing?.isDraftOnly ?? false,
    draftRevisionNumber: existing?.draftRevisionNumber ?? page.version ?? 1,
    activePublishedRevisionId: existing?.activePublishedRevisionId ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

async function mutate<T>(
  backend: StoreBackend,
  fn: (store: StoreFile) => T | Promise<T>,
): Promise<T> {
  /**
   * Clone-on-write + configVersion check: concurrent admin/storefront processes
   * must not clobber a completed delete with a stale publish snapshot (Windows).
   */
  const maxAttempts = 5;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const base = await readStore(backend);
    const versionBefore = base.site.configVersion;
    const store = structuredClone(base);
    const result = await fn(store);
    if (store.site.configVersion === versionBefore) {
      store.site.configVersion = versionBefore + 1;
      store.site.updatedAt = nowIso();
    }
    if (await probeFs(backend)) {
      const latest = await readStore(backend);
      if (latest.site.configVersion !== versionBefore) {
        lastError = new Error("cms store concurrent write");
        continue;
      }
    }
    await writeStore(backend, store);
    return result;
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("cms store write failed after concurrent retries");
}

function buildPublish(
  store: StoreFile,
  input: PublishPageInput,
): PublishPageResult {
  const siteId = input.siteId || store.site.id;
  const pageIdx = store.pages.findIndex((p) => p.id === input.pageId && p.siteId === siteId);
  if (pageIdx < 0) throw new Error("cms publish: page not found");
  const pageRow = store.pages[pageIdx]!;

  if (
    input.expectedDraftRevision != null &&
    pageRow.draftRevisionNumber !== input.expectedDraftRevision
  ) {
    const err = new Error(
      `cms publish: draft revision conflict (expected ${input.expectedDraftRevision}, got ${pageRow.draftRevisionNumber})`,
    );
    (err as Error & { code: string }).code = "conflict";
    throw err;
  }

  const payload = ensurePageLocaleFields(input.payload);

  // Keep payload localeStates aligned with publishedLocales so resolvePublishedCmsPage
  // (which reads the revision payload) cannot disagree with cms_page_locale_states.
  if (input.publishedLocales.includes("en")) {
    payload.localeStates = {
      ...(payload.localeStates ?? {
        nl: { publicationState: "published", freshness: "current" },
      }),
      nl: payload.localeStates?.nl ?? { publicationState: "published", freshness: "current" },
      en: { publicationState: "published", freshness: "current" },
    };
  } else {
    // NL-only publish must not demote a live EN locale when the editor payload still
    // carries draft/missing (stale admin state after Publiceer EN without local sync).
    const existingEn = store.localeStates.find(
      (r) => r.pageId === input.pageId && r.locale === "en" && r.siteId === siteId,
    );
    if (existingEn?.publicationState === "published") {
      const prev = payload.localeStates?.en;
      payload.localeStates = {
        ...(payload.localeStates ?? {
          nl: { publicationState: "published", freshness: "current" },
        }),
        nl: payload.localeStates?.nl ?? { publicationState: "published", freshness: "current" },
        en: {
          publicationState: "published",
          freshness: prev?.freshness === "stale" ? "stale" : (existingEn.freshness ?? "current"),
        },
      };
    }
  }

  for (const locale of input.publishedLocales) {
    const pathValue =
      locale === "en"
        ? payload.paths?.en ?? payload.paths?.nl ?? payload.slug
        : payload.paths?.nl ?? payload.slug;
    const pub = publicPathFor(locale, pathValue);
    if (publishedPathTaken(store, siteId, locale, pub, input.pageId)) {
      throw new Error(`cms publish: published path already taken (${locale} ${pub})`);
    }
  }

  // Supersede previous published revision
  if (pageRow.activePublishedRevisionId) {
    const prev = store.revisions.find((r) => r.id === pageRow.activePublishedRevisionId);
    if (prev && prev.status === "published") {
      prev.status = "superseded";
    }
  }

  const revisionNumber =
    Math.max(0, ...store.revisions.filter((r) => r.pageId === input.pageId).map((r) => r.revisionNumber)) +
    1;
  const revisionId = randomUUID();
  const publishedAt = nowIso();
  const revision: CmsRevisionRecord = {
    id: revisionId,
    siteId,
    pageId: input.pageId,
    revisionNumber,
    status: "published",
    payload,
    createdAt: publishedAt,
    createdBy: input.createdBy ?? null,
    publishedAt,
  };
  store.revisions.push(revision);

  // One active published revision per page
  const otherPublished = store.revisions.filter(
    (r) => r.pageId === input.pageId && r.status === "published" && r.id !== revisionId,
  );
  for (const o of otherPublished) o.status = "superseded";

  pageRow.activePublishedRevisionId = revisionId;
  pageRow.isDraftOnly = false;
  pageRow.draftRevisionNumber += 1;
  pageRow.inNav = payload.inNav;
  pageRow.updatedAt = publishedAt;
  store.pages[pageIdx] = pageRow;
  store.drafts[input.pageId] = payload;

  const changedPaths: string[] = [];
  const locales: Locale[] = ["nl", "en"];
  for (const locale of locales) {
    const state = payload.localeStates?.[locale];
    const pathValue =
      locale === "en"
        ? payload.paths?.en ?? payload.paths?.nl ?? payload.slug
        : payload.paths?.nl ?? payload.slug;
    const pub = publicPathFor(locale, pathValue);
    const publicationState =
      state?.publicationState ??
      (input.publishedLocales.includes(locale) ? "published" : locale === "nl" ? "published" : "missing");
    const freshness = state?.freshness ?? (publicationState === "published" ? "current" : "unknown");
    const record: CmsLocaleStateRecord = {
      pageId: input.pageId,
      siteId,
      locale,
      publicationState,
      freshness,
      path: identityPath(locale, pub),
      publicPath: pub,
    };
    const existingIdx = store.localeStates.findIndex(
      (r) => r.pageId === input.pageId && r.locale === locale,
    );
    if (existingIdx >= 0) store.localeStates[existingIdx] = record;
    else store.localeStates.push(record);
    if (input.publishedLocales.includes(locale)) changedPaths.push(pub);
  }

  // Sync redirects from payload
  for (const redirect of payload.redirects ?? []) {
    assertRedirectValid(redirect.fromPath, redirect.toPath);
    const fromPath = normalizeCmsPath(redirect.locale, redirect.fromPath);
    const toPath = normalizeCmsPath(redirect.locale, redirect.toPath);
    const existing = store.redirects.find(
      (r) => r.siteId === siteId && r.locale === redirect.locale && r.fromPath === fromPath,
    );
    if (existing) {
      existing.toPath = toPath;
      existing.statusCode = redirect.statusCode;
      existing.pageId = input.pageId;
      existing.retiredAt = null;
    } else {
      store.redirects.push({
        id: redirect.id || randomUUID(),
        siteId,
        pageId: input.pageId,
        locale: redirect.locale,
        fromPath,
        toPath,
        statusCode: redirect.statusCode,
        createdAt: redirect.createdAt || publishedAt,
        retiredAt: null,
      });
    }
  }

  const eventId = randomUUID();
  const event: CmsPagePublishedEvent = {
    eventId,
    siteId,
    pageId: input.pageId,
    revisionId,
    publishedLocales: input.publishedLocales,
    changedPaths,
    occurredAt: publishedAt,
  };
  store.outbox.push({
    id: eventId,
    siteId,
    eventType: "cms.page.published",
    payload: event,
    createdAt: publishedAt,
    processedAt: null,
    attempts: 0,
  });

  store.site.configVersion += 1;
  store.site.updatedAt = publishedAt;

  return {
    revisionId,
    revisionNumber,
    eventId,
    draftRevisionNumber: pageRow.draftRevisionNumber,
    event,
  };
}

/** Collect public + locale paths owned by a page (for redirect cleanup). */
function collectPagePaths(
  store: StoreFile,
  pageId: string,
  siteId: string,
): Set<string> {
  const paths = new Set<string>();
  for (const state of store.localeStates) {
    if (state.pageId !== pageId || state.siteId !== siteId) continue;
    if (state.path) paths.add(state.path);
    if (state.publicPath) paths.add(state.publicPath);
  }
  const draft = store.drafts[pageId];
  if (draft) {
    const nl = draft.paths?.nl ?? draft.slug;
    const en = draft.paths?.en;
    if (nl) {
      paths.add(normalizeCmsPath("nl", nl));
      paths.add(normalizeCmsPath("en", nl));
    }
    if (en) paths.add(normalizeCmsPath("en", en));
  }
  const rev = store.revisions.find(
    (r) => r.pageId === pageId && r.siteId === siteId && r.status === "published",
  );
  if (rev) {
    const nl = rev.payload.paths?.nl ?? rev.payload.slug;
    const en = rev.payload.paths?.en;
    if (nl) {
      paths.add(normalizeCmsPath("nl", nl));
      paths.add(normalizeCmsPath("en", nl));
    }
    if (en) paths.add(normalizeCmsPath("en", en));
  }
  return paths;
}

function purgeCustomPageFromStore(
  store: StoreFile,
  pageId: string,
  siteId: string,
): DeletePageResult {
  const idx = store.pages.findIndex((p) => p.id === pageId && p.siteId === siteId);
  if (idx < 0) return { deleted: false };

  const row = store.pages[idx]!;
  if (row.kind !== "custom") {
    throw new Error("Alleen aangepaste pagina's kunnen verwijderd worden.");
  }

  const ownedPaths = collectPagePaths(store, pageId, siteId);

  // Break circular FK: active published revision → page.
  row.activePublishedRevisionId = null;

  store.revisions = store.revisions.filter(
    (r) => !(r.pageId === pageId && r.siteId === siteId),
  );
  store.localeStates = store.localeStates.filter(
    (s) => !(s.pageId === pageId && s.siteId === siteId),
  );
  store.redirects = store.redirects.filter((r) => {
    if (r.siteId !== siteId) return true;
    if (r.pageId === pageId) return false;
    if (ownedPaths.has(r.fromPath) || ownedPaths.has(r.toPath)) return false;
    return true;
  });
  store.outbox = store.outbox.filter(
    (o) => !(o.siteId === siteId && o.payload.pageId === pageId),
  );
  delete store.drafts[pageId];
  store.pages.splice(idx, 1);
  store.site.configVersion += 1;
  store.site.updatedAt = nowIso();
  return { deleted: true };
}

export type FileCmsStoreOptions = {
  /** When true, never touch disk — ideal for unit tests. */
  memoryOnly?: boolean;
  fileName?: string;
};

export function createFileCmsStore(options: FileCmsStoreOptions = {}): CmsStore {
  const backend: StoreBackend = {
    memoryOnly: options.memoryOnly ?? false,
    memory: null,
    fsAvailable: null,
    writeChain: Promise.resolve(),
    fileName: options.fileName ?? "cms-published.json",
  };

  return {
    async getSite(siteId) {
      const store = await readStore(backend);
      if (siteId && store.site.id !== siteId && store.site.slug !== siteId) {
        throw new Error("cms site not found");
      }
      return store.site;
    },

    async listPages(siteId) {
      const store = await readStore(backend);
      const id = siteId ?? store.site.id;
      return store.pages.filter((p) => p.siteId === id);
    },

    async getPage(pageId, siteId) {
      const store = await readStore(backend);
      const id = siteId ?? store.site.id;
      return store.pages.find((p) => p.id === pageId && p.siteId === id) ?? null;
    },

    async upsertPage(input: UpsertPageInput) {
      return mutate(backend, (store) => {
        const siteId = input.siteId || store.site.id;
        const page = ensurePageLocaleFields(input.page);
        const existingIdx = store.pages.findIndex((p) => p.id === page.id && p.siteId === siteId);
        const existing = existingIdx >= 0 ? store.pages[existingIdx] : undefined;
        const record = pageToRecord(page, siteId, existing);
        if (input.stableKey !== undefined) record.stableKey = input.stableKey;
        if (existingIdx >= 0) store.pages[existingIdx] = record;
        else store.pages.push(record);
        store.drafts[page.id] = page;
        return record;
      });
    },

    async getDraftPayload(pageId, siteId) {
      const store = await readStore(backend);
      const id = siteId ?? store.site.id;
      const page = store.pages.find((p) => p.id === pageId && p.siteId === id);
      if (!page) return null;
      if (store.drafts[pageId]) return ensurePageLocaleFields(store.drafts[pageId]!);
      const rev = store.revisions.find((r) => r.id === page.activePublishedRevisionId);
      return rev ? ensurePageLocaleFields(rev.payload) : null;
    },

    async saveDraft(command) {
      return mutate(backend, (store) => {
        const siteId = command.siteId ?? store.site.id;
        const idx = store.pages.findIndex((p) => p.id === command.pageId && p.siteId === siteId);
        if (idx < 0) throw new Error("cms draft: page not found");
        const row = store.pages[idx]!;
        if (row.draftRevisionNumber !== command.expectedRevisionNumber) {
          const err = new Error("cms draft: conflict");
          (err as Error & { code: string }).code = "conflict";
          throw err;
        }
        store.drafts[command.pageId] = ensurePageLocaleFields(command.payload);
        row.draftRevisionNumber += 1;
        row.updatedAt = nowIso();
        store.pages[idx] = row;
        return { draftRevisionNumber: row.draftRevisionNumber };
      });
    },

    async getActivePublishedRevision(pageId, siteId) {
      const store = await readStore(backend);
      const id = siteId ?? store.site.id;
      const page = store.pages.find((p) => p.id === pageId && p.siteId === id);
      if (!page?.activePublishedRevisionId) return null;
      return store.revisions.find((r) => r.id === page.activePublishedRevisionId) ?? null;
    },

    async listRevisions(pageId, siteId) {
      const store = await readStore(backend);
      const id = siteId ?? store.site.id;
      return store.revisions
        .filter((r) => r.pageId === pageId && r.siteId === id)
        .sort((a, b) => b.revisionNumber - a.revisionNumber);
    },

    async publishPage(input) {
      return mutate(backend, (store) => buildPublish(store, input));
    },

    async rollbackPage(input: RollbackPageInput) {
      return mutate(backend, (store) => {
        const target = store.revisions.find(
          (r) =>
            r.id === input.targetRevisionId &&
            r.pageId === input.pageId &&
            r.siteId === input.siteId,
        );
        if (!target) throw new Error("cms rollback: target revision not found");
        const payload = ensurePageLocaleFields(target.payload);
        const publishedLocales: Locale[] = [];
        if (payload.localeStates?.nl?.publicationState === "published") publishedLocales.push("nl");
        if (payload.localeStates?.en?.publicationState === "published") publishedLocales.push("en");
        if (publishedLocales.length === 0) publishedLocales.push("nl");
        return buildPublish(store, {
          siteId: input.siteId,
          pageId: input.pageId,
          payload,
          publishedLocales,
          createdBy: input.createdBy,
        });
      });
    },

    async findPublishedByPublicPath(locale, publicPath, siteId) {
      const store = await readStore(backend);
      const id = siteId ?? store.site.id;
      const normalized = normalizeCmsPath(locale, publicPath);
      const localeState = store.localeStates.find(
        (r) =>
          r.siteId === id &&
          r.locale === locale &&
          r.publicPath === normalized &&
          r.publicationState === "published",
      );
      if (!localeState) return null;
      const page = store.pages.find((p) => p.id === localeState.pageId);
      if (!page?.activePublishedRevisionId) return null;
      const rev = store.revisions.find((r) => r.id === page.activePublishedRevisionId);
      if (!rev || rev.status !== "published") return null;
      return {
        page: ensurePageLocaleFields(rev.payload),
        revisionId: rev.id,
        publishedAt: rev.publishedAt ?? rev.createdAt,
        localeState,
        site: store.site,
      } satisfies CmsPublishedLookup;
    },

    async listPublishedLocaleStates(siteId) {
      const store = await readStore(backend);
      const id = siteId ?? store.site.id;
      return store.localeStates.filter(
        (r) => r.siteId === id && r.publicationState === "published",
      );
    },

    async listActiveRedirects(siteId) {
      const store = await readStore(backend);
      const id = siteId ?? store.site.id;
      return store.redirects.filter((r) => r.siteId === id && !r.retiredAt);
    },

    async upsertRedirect(redirect) {
      return mutate(backend, (store) => {
        assertRedirectValid(redirect.fromPath, redirect.toPath);
        const fromPath = normalizeCmsPath(redirect.locale, redirect.fromPath);
        const toPath = normalizeCmsPath(redirect.locale, redirect.toPath);
        const existingIdx = store.redirects.findIndex(
          (r) =>
            r.siteId === redirect.siteId &&
            r.locale === redirect.locale &&
            r.fromPath === fromPath,
        );
        const record: CmsRedirectRecord = {
          id: redirect.id || randomUUID(),
          siteId: redirect.siteId,
          pageId: redirect.pageId,
          locale: redirect.locale,
          fromPath,
          toPath,
          statusCode: redirect.statusCode,
          createdAt: redirect.createdAt ?? nowIso(),
          retiredAt: redirect.retiredAt ?? null,
        };
        if (existingIdx >= 0) store.redirects[existingIdx] = record;
        else store.redirects.push(record);
        return record;
      });
    },

    async listUnprocessedOutbox(limit = 50) {
      const store = await readStore(backend);
      return store.outbox.filter((o) => !o.processedAt).slice(0, limit);
    },

    async markOutboxProcessed(eventId) {
      await mutate(backend, (store) => {
        const row = store.outbox.find((o) => o.id === eventId);
        if (row) {
          row.processedAt = nowIso();
          row.attempts += 1;
        }
      });
    },

    async deletePage(input: DeletePageInput) {
      return mutate(backend, (store) => {
        const siteId = input.siteId || store.site.id;
        return purgeCustomPageFromStore(store, input.pageId, siteId);
      });
    },

    async seedBuiltinsIfEmpty(pages, siteId) {
      // Fast path: never rewrite the store file when builtins are already published.
      // Calling mutate() on every request previously forced a full read+clone+write
      // (~1s+ TTFB on Windows) even when nothing changed.
      const current = await readStore(backend);
      const id = siteId ?? current.site.id;
      const sitePages = current.pages.filter((p) => p.siteId === id);
      let needsSeed = sitePages.length === 0;
      if (!needsSeed) {
        for (const raw of pages) {
          const existing = current.pages.find((p) => p.id === raw.id && p.siteId === id);
          if (!existing || !existing.activePublishedRevisionId) {
            needsSeed = true;
            break;
          }
        }
      }
      if (!needsSeed) return;

      await mutate(backend, (store) => {
        const publishBuiltin = (raw: CmsPage) => {
          const page = ensurePageLocaleFields(raw);
          const draftSource = store.drafts[page.id] ?? page;
          const withStates: CmsPage = {
            ...ensurePageLocaleFields(draftSource),
            localeStates: {
              nl: { publicationState: "published", freshness: "current" },
              // First seed is NL-only; EN stays missing until explicit Publiceer EN.
              en: { publicationState: "missing", freshness: "unknown" },
            },
          };
          if (!store.pages.some((p) => p.id === withStates.id && p.siteId === id)) {
            store.pages.push(pageToRecord(withStates, id));
          }
          store.drafts[withStates.id] = withStates;
          buildPublish(store, {
            siteId: id,
            pageId: withStates.id,
            payload: withStates,
            publishedLocales: ["nl"],
          });
        };

        const pagesForSite = store.pages.filter((p) => p.siteId === id);
        if (pagesForSite.length === 0) {
          for (const raw of pages) publishBuiltin(raw);
          return;
        }

        // Incomplete shared `.data` (page rows without revisions) must not leave `/` unpublished.
        for (const raw of pages) {
          const existing = store.pages.find((p) => p.id === raw.id && p.siteId === id);
          if (!existing) {
            publishBuiltin(raw);
            continue;
          }
          if (!existing.activePublishedRevisionId) {
            publishBuiltin(raw);
          }
        }
      });
    },
  };
}

let singleton: CmsStore | null = null;

export function getFileCmsStore(): CmsStore {
  if (!singleton) singleton = createFileCmsStore();
  return singleton;
}
