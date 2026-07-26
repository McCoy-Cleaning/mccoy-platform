import { z } from "zod";
import type { CmsPage } from "./types";
import type { FixedSectionKey } from "./sections";
import { isFixedSectionKey } from "./sections";
import type { PageSectionContent } from "./content";

export const CMS_EDIT_CHANNEL = "mccoy-cms-edit-v2";

export const MAX_EDIT_MESSAGE_BYTES = 1_500_000;

export type CmsMutation =
  | {
      kind: "section";
      sectionKey: FixedSectionKey;
      patch: Record<string, unknown>;
    }
  | {
      kind: "block";
      blockId: string;
      patch: Record<string, unknown>;
    }
  | {
      kind: "layout";
      /** Opaque layout op result already applied on parent — child only receives draft. */
      op: "move" | "add" | "remove" | "toggle" | "replace";
    }
  | {
      kind: "pageMeta";
      patch: Partial<Pick<CmsPage, "title" | "slug" | "description" | "inNav">>;
    };

export type EditableDraftSnapshot = {
  page: CmsPage;
  sectionContent: PageSectionContent;
  overrides: Record<string, string>;
};

export type CmsEditMessage =
  | {
      channel: typeof CMS_EDIT_CHANNEL;
      type: "cms-edit-ready";
      sessionId: string;
      pageId: string;
    }
  | {
      channel: typeof CMS_EDIT_CHANNEL;
      type: "cms-draft-patch";
      sessionId: string;
      pageId: string;
      baseRevision: number;
      mutationId: string;
      patch: CmsMutation;
    }
  | {
      channel: typeof CMS_EDIT_CHANNEL;
      type: "cms-edit-draft";
      sessionId: string;
      pageId: string;
      revision: number;
      draft: EditableDraftSnapshot;
    }
  | {
      channel: typeof CMS_EDIT_CHANNEL;
      type: "cms-mutation-rejected";
      sessionId: string;
      mutationId: string;
      reason: string;
      currentRevision: number;
    }
  | {
      channel: typeof CMS_EDIT_CHANNEL;
      type: "cms-selection";
      sessionId: string;
      pageId: string;
      selection:
        | { kind: "fixed"; sectionKey: FixedSectionKey; part?: string }
        | { kind: "block"; blockId: string; layoutItemId: string }
        | null;
    };

const mutationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("section"),
    sectionKey: z.string(),
    patch: z.record(z.unknown()),
  }),
  z.object({
    kind: z.literal("block"),
    blockId: z.string().min(1),
    patch: z.record(z.unknown()),
  }),
  z.object({
    kind: z.literal("layout"),
    op: z.enum(["move", "add", "remove", "toggle", "replace"]),
  }),
  z.object({
    kind: z.literal("pageMeta"),
    patch: z
      .object({
        title: z.string().optional(),
        slug: z.string().optional(),
        description: z.string().optional(),
        inNav: z.boolean().optional(),
      })
      .strict(),
  }),
]);

function estimateBytes(data: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(data)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

export function parseCmsEditMessage(data: unknown): CmsEditMessage | null {
  if (!data || typeof data !== "object") return null;
  const msg = data as Record<string, unknown>;
  if (msg.channel !== CMS_EDIT_CHANNEL) return null;
  if (estimateBytes(data) > MAX_EDIT_MESSAGE_BYTES) return null;

  const type = msg.type;
  if (type === "cms-edit-ready") {
    if (typeof msg.sessionId !== "string" || typeof msg.pageId !== "string") return null;
    return {
      channel: CMS_EDIT_CHANNEL,
      type: "cms-edit-ready",
      sessionId: msg.sessionId,
      pageId: msg.pageId,
    };
  }

  if (type === "cms-draft-patch") {
    if (
      typeof msg.sessionId !== "string" ||
      typeof msg.pageId !== "string" ||
      typeof msg.baseRevision !== "number" ||
      typeof msg.mutationId !== "string"
    ) {
      return null;
    }
    const patch = mutationSchema.safeParse(msg.patch);
    if (!patch.success) return null;
    if (patch.data.kind === "section" && !isFixedSectionKey(patch.data.sectionKey)) return null;
    return {
      channel: CMS_EDIT_CHANNEL,
      type: "cms-draft-patch",
      sessionId: msg.sessionId,
      pageId: msg.pageId,
      baseRevision: msg.baseRevision,
      mutationId: msg.mutationId,
      patch:
        patch.data.kind === "section"
          ? { ...patch.data, sectionKey: patch.data.sectionKey as FixedSectionKey }
          : patch.data,
    };
  }

  if (type === "cms-edit-draft") {
    if (
      typeof msg.sessionId !== "string" ||
      typeof msg.pageId !== "string" ||
      typeof msg.revision !== "number" ||
      !msg.draft ||
      typeof msg.draft !== "object"
    ) {
      return null;
    }
    const draft = msg.draft as EditableDraftSnapshot;
    if (!draft.page || typeof draft.page !== "object") return null;
    return {
      channel: CMS_EDIT_CHANNEL,
      type: "cms-edit-draft",
      sessionId: msg.sessionId,
      pageId: msg.pageId,
      revision: msg.revision,
      draft: {
        page: draft.page,
        sectionContent: (draft.sectionContent ?? {}) as PageSectionContent,
        overrides: (draft.overrides ?? {}) as Record<string, string>,
      },
    };
  }

  if (type === "cms-mutation-rejected") {
    if (
      typeof msg.sessionId !== "string" ||
      typeof msg.mutationId !== "string" ||
      typeof msg.reason !== "string" ||
      typeof msg.currentRevision !== "number"
    ) {
      return null;
    }
    return {
      channel: CMS_EDIT_CHANNEL,
      type: "cms-mutation-rejected",
      sessionId: msg.sessionId,
      mutationId: msg.mutationId,
      reason: msg.reason,
      currentRevision: msg.currentRevision,
    };
  }

  if (type === "cms-selection") {
    if (typeof msg.sessionId !== "string" || typeof msg.pageId !== "string") return null;
    return {
      channel: CMS_EDIT_CHANNEL,
      type: "cms-selection",
      sessionId: msg.sessionId,
      pageId: msg.pageId,
      selection: (msg.selection ?? null) as CmsEditMessage extends { type: "cms-selection" }
        ? CmsEditMessage["selection"]
        : null,
    };
  }

  return null;
}

export function createSessionId(): string {
  return `sess_${Math.random().toString(36).slice(2, 12)}`;
}

export function createMutationId(): string {
  return `mut_${Math.random().toString(36).slice(2, 12)}`;
}

/** Parent-side revision gate. */
export function canApplyPatch(baseRevision: number, currentRevision: number): boolean {
  return baseRevision === currentRevision;
}

/** Child-side: ignore stale drafts. */
export function shouldApplyDraft(revision: number, lastAppliedRevision: number): boolean {
  return revision >= lastAppliedRevision;
}
