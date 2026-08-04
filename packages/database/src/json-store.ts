/**
 * Website-request persistence (server-only).
 *
 * Limitation: no Postgres/Supabase is wired yet. This uses a JSON file under
 * `<monorepo>/.data/website-requests.json` when the Node filesystem is available,
 * with an in-memory fallback (e.g. some edge runtimes). Data does not survive cold
 * starts on ephemeral hosts — migrate to Postgres when the platform DB lands.
 *
 * Override storage location with MCCOY_DATA_DIR.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";

import { FORM_SUBJECTS } from "@mccoy/domain";
import type {
  AttachmentMeta,
  NotificationState,
  RequestReply,
  RequestStatus,
  WebsiteRequest,
  WebsiteRequestSummary,
} from "@mccoy/domain";
import { getDataDir } from "@mccoy/security";

import type {
  CreateWebsiteRequestInput,
  ListWebsiteRequestsFilter,
  WebsiteRequestsStore,
} from "./types";

type StoreFile = {
  version: 1;
  sequence: number;
  requests: WebsiteRequest[];
};

const memory: StoreFile = {
  version: 1,
  sequence: 0,
  requests: [],
};

let fsAvailable: boolean | null = null;
let writeChain: Promise<void> = Promise.resolve();

function storePaths() {
  const dir = getDataDir();
  return {
    dir,
    file: path.join(dir, "website-requests.json"),
  };
}

function emptyStore(): StoreFile {
  return { version: 1, sequence: 0, requests: [] };
}

async function probeFs(): Promise<boolean> {
  if (fsAvailable !== null) return fsAvailable;
  try {
    await mkdir(storePaths().dir, { recursive: true });
    fsAvailable = true;
  } catch {
    fsAvailable = false;
  }
  return fsAvailable;
}

async function readStore(): Promise<StoreFile> {
  if (!(await probeFs())) {
    return memory;
  }
  const { file } = storePaths();
  try {
    // Strip UTF-8 BOM (e.g. Windows editors / PowerShell Set-Content)
    const raw = (await readFile(file, "utf8")).replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw) as StoreFile;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.requests)) {
      return emptyStore();
    }
    memory.sequence = parsed.sequence ?? 0;
    memory.requests = parsed.requests;
    return memory;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code !== "ENOENT") {
      console.error("[requests] failed to read store", error);
    }
    return memory.requests.length ? memory : emptyStore();
  }
}

async function writeStore(store: StoreFile): Promise<void> {
  memory.sequence = store.sequence;
  memory.requests = store.requests;

  if (!(await probeFs())) return;

  const { file } = storePaths();
  const payload = `${JSON.stringify(store, null, 2)}\n`;
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(tmp, payload, "utf8");
    await rename(tmp, file);
  } catch (error) {
    console.error("[requests] failed to persist store", error);
    fsAvailable = false;
  }
}

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function nextNumber(sequence: number): string {
  const year = new Date().getUTCFullYear();
  return `WR-${year}-${String(sequence).padStart(5, "0")}`;
}

function toSummary(request: WebsiteRequest): WebsiteRequestSummary {
  return {
    id: request.id,
    number: request.number,
    kind: request.kind,
    status: request.status,
    submitterName: request.submitterName,
    submitterEmail: request.submitterEmail,
    subject: request.subject,
    attachmentCount: request.attachments.length,
    replyCount: request.replies.length,
    formId: request.formId ?? null,
    sourcePageId: request.sourcePageId ?? null,
    scopeKey: request.scopeKey ?? null,
    scopeLabel: request.scopeLabel ?? null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    lastRepliedAt: request.lastRepliedAt,
  };
}

export async function createWebsiteRequest(
  input: CreateWebsiteRequestInput,
): Promise<WebsiteRequest> {
  return withLock(async () => {
    const store = await readStore();
    store.sequence += 1;
    const now = new Date().toISOString();
    const request: WebsiteRequest = {
      id: randomUUID(),
      number: nextNumber(store.sequence),
      kind: input.kind,
      status: "new",
      submitterName: input.fields.name?.trim() || "Onbekend",
      submitterEmail: input.fields.email?.trim().toLowerCase() || "",
      submitterPhone: input.fields.phone?.trim() || null,
      submitterCompany: input.fields.company?.trim() || null,
      subject: FORM_SUBJECTS[input.kind],
      fields: { ...input.fields },
      attachments: input.attachments,
      replies: [],
      notificationState: input.notificationState ?? "pending",
      notificationError: input.notificationError ?? null,
      companyId: null,
      formId: input.formId ?? null,
      sourcePageId: input.sourcePageId ?? null,
      scopeKey: input.scopeKey ?? null,
      scopeLabel: input.scopeLabel ?? null,
      createdAt: now,
      updatedAt: now,
      lastRepliedAt: null,
    };
    store.requests.unshift(request);
    await writeStore(store);
    return request;
  });
}

export async function updateRequestNotification(
  id: string,
  state: NotificationState,
  error: string | null = null,
): Promise<void> {
  await withLock(async () => {
    const store = await readStore();
    const request = store.requests.find((r) => r.id === id);
    if (!request) return;
    request.notificationState = state;
    request.notificationError = error;
    request.updatedAt = new Date().toISOString();
    await writeStore(store);
  });
}

export async function listWebsiteRequests(
  filter: ListWebsiteRequestsFilter = {},
): Promise<WebsiteRequestSummary[]> {
  const store = await readStore();
  const q = filter.q?.trim().toLowerCase() ?? "";
  return store.requests
    .filter((r) => {
      if (filter.kind && filter.kind !== "all" && r.kind !== filter.kind) return false;
      if (filter.status && filter.status !== "all" && r.status !== filter.status) return false;
      if (filter.scopeKey && filter.scopeKey !== "all") {
        if ((r.scopeKey ?? null) !== filter.scopeKey) return false;
      }
      if (!q) return true;
      const hay = [
        r.submitterName,
        r.submitterEmail,
        r.submitterCompany ?? "",
        r.subject,
        r.number,
        r.fields.message ?? "",
        r.fields.motivation ?? "",
        r.scopeLabel ?? "",
        r.scopeKey ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .map(toSummary);
}

export async function getWebsiteRequest(id: string): Promise<WebsiteRequest | null> {
  const store = await readStore();
  return store.requests.find((r) => r.id === id) ?? null;
}

export async function setWebsiteRequestStatus(
  id: string,
  status: RequestStatus,
): Promise<WebsiteRequest | null> {
  return withLock(async () => {
    const store = await readStore();
    const request = store.requests.find((r) => r.id === id);
    if (!request) return null;
    request.status = status;
    request.updatedAt = new Date().toISOString();
    await writeStore(store);
    return request;
  });
}

export async function appendWebsiteRequestReply(
  id: string,
  reply: Omit<RequestReply, "id">,
  nextStatus: RequestStatus = "replied",
): Promise<WebsiteRequest | null> {
  return withLock(async () => {
    const store = await readStore();
    const request = store.requests.find((r) => r.id === id);
    if (!request) return null;
    const full: RequestReply = { id: randomUUID(), ...reply };
    request.replies.push(full);
    request.status = nextStatus;
    request.lastRepliedAt = full.sentAt;
    request.updatedAt = full.sentAt;
    await writeStore(store);
    return request;
  });
}

export async function countWebsiteRequests(): Promise<number> {
  const store = await readStore();
  return store.requests.length;
}

export async function clearOrphanWebsiteRequestScopes(
  activeScopeKeys: string[],
): Promise<{ cleared: number }> {
  return withLock(async () => {
    const store = await readStore();
    const active = new Set(
      activeScopeKeys.map((key) => key.trim().toLowerCase()).filter(Boolean),
    );
    let cleared = 0;
    const now = new Date().toISOString();
    for (const request of store.requests) {
      if (!request.scopeKey?.trim()) continue;
      const key = request.scopeKey.trim().toLowerCase();
      if (active.has(key)) continue;
      request.scopeKey = null;
      request.scopeLabel = null;
      request.updatedAt = now;
      cleared += 1;
    }
    if (cleared > 0) await writeStore(store);
    return { cleared };
  });
}

export function attachmentMetaFromBase64(
  filename: string,
  contentType: string,
  contentBase64: string,
): AttachmentMeta {
  const sizeBytes = Math.floor((contentBase64.length * 3) / 4);
  return {
    filename,
    contentType: contentType || "application/octet-stream",
    sizeBytes,
  };
}

/** Default JSON-file store implementing WebsiteRequestsStore. */
export const jsonWebsiteRequestsStore: WebsiteRequestsStore = {
  createWebsiteRequest,
  updateRequestNotification,
  listWebsiteRequests,
  getWebsiteRequest,
  setWebsiteRequestStatus,
  appendWebsiteRequestReply,
  countWebsiteRequests,
  clearOrphanWebsiteRequestScopes,
};
