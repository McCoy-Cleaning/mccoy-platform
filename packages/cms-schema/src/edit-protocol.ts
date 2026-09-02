import { z } from "zod";
import type { CmsPage } from "./types";
import type { FixedSectionKey } from "./sections";
import { isFixedSectionKey } from "./sections";
import type { PageSectionContent } from "./content";

export const CMS_EDIT_CHANNEL = "mccoy-cms-edit-v2";

export const MAX_EDIT_MESSAGE_BYTES = 1_500_000;

export type CmsLayoutMutation =
  | {
      kind: "layout";
      op: "move";
      layoutItemId: string;
      direction: "up" | "down";
    }
  | {
      kind: "layout";
      op: "toggle";
      layoutItemId: string;
    }
  | {
      kind: "layout";
      op: "remove";
      /** Block layout items require blockId; fixed items use layoutItemId only. */
      layoutItemId: string;
      blockId?: string;
    }
  | {
      kind: "layout";
      op: "duplicate";
      blockId: string;
    }
  | {
      kind: "layout";
      op: "add";
      blockType: string;
      atIndex: number;
      templateId?: string;
    }
  | {
      kind: "layout";
      /** @deprecated Prefer typed move/add/remove/toggle/duplicate payloads. */
      op: "replace";
    };

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
  | CmsLayoutMutation
  | {
      kind: "pageMeta";
      patch: Partial<Pick<CmsPage, "title" | "slug" | "description" | "inNav">>;
    }
  | {
      /** Patch English field drafts only — never overwrites NL source values. */
      kind: "enField";
      path: string;
      value: string;
    };

export type CmsUiCommand =
  | { kind: "openAddPicker"; atIndex: number }
  | {
      kind: "openAdvanced";
      selection:
        | { kind: "fixed"; sectionKey: FixedSectionKey; part?: string }
        | { kind: "block"; blockId: string; layoutItemId: string };
    }
  | {
      kind: "openMediaPicker";
      target:
        | {
            kind: "section";
            sectionKey: FixedSectionKey;
            field: string;
            /** When set, `field` is an items array; update that item's image key. */
            listItemId?: string;
            listImageKey?: string;
            /**
             * Append a new list item with the chosen image (add-image flow).
             * Mutually exclusive with updating an existing `listItemId`.
             */
            listAppend?: boolean;
          }
        | {
            kind: "block";
            blockId: string;
            field: string;
            listItemId?: string;
            listImageKey?: string;
            listAppend?: boolean;
          };
    }
  | { kind: "undo" }
  | { kind: "redo" };

export type CmsEditorInteractionMode = "edit" | "preview";

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
    }
  | {
      channel: typeof CMS_EDIT_CHANNEL;
      type: "cms-ui-command";
      sessionId: string;
      pageId: string;
      command: CmsUiCommand;
    }
  | {
      channel: typeof CMS_EDIT_CHANNEL;
      type: "cms-editor-mode";
      sessionId: string;
      pageId: string;
      interactionMode: CmsEditorInteractionMode;
    };

const mutationSchema = z.union([
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
    op: z.enum(["move", "add", "remove", "toggle", "duplicate", "replace"]),
    layoutItemId: z.string().min(1).optional(),
    direction: z.enum(["up", "down"]).optional(),
    blockId: z.string().min(1).optional(),
    blockType: z.string().min(1).optional(),
    atIndex: z.number().int().min(0).optional(),
    templateId: z.string().min(1).optional(),
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
  z.object({
    kind: z.literal("enField"),
    path: z.string().min(1).max(500),
    value: z.string().max(50_000),
  }),
]);

function isValidLayoutMutation(layout: {
  op: string;
  layoutItemId?: string;
  direction?: string;
  blockId?: string;
  blockType?: string;
  atIndex?: number;
}): boolean {
  if (layout.op === "move") return Boolean(layout.layoutItemId && layout.direction);
  if (layout.op === "toggle" || layout.op === "remove") return Boolean(layout.layoutItemId);
  if (layout.op === "duplicate") return Boolean(layout.blockId);
  if (layout.op === "add") return Boolean(layout.blockType && layout.atIndex !== undefined);
  if (layout.op === "replace") return true;
  return false;
}

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
    if (patch.data.kind === "layout" && !isValidLayoutMutation(patch.data)) return null;
    let normalized: CmsMutation;
    if (patch.data.kind === "section") {
      normalized = { ...patch.data, sectionKey: patch.data.sectionKey as FixedSectionKey };
    } else if (patch.data.kind === "layout") {
      const layout = patch.data;
      if (layout.op === "move") {
        normalized = {
          kind: "layout",
          op: "move",
          layoutItemId: layout.layoutItemId!,
          direction: layout.direction!,
        };
      } else if (layout.op === "toggle") {
        normalized = { kind: "layout", op: "toggle", layoutItemId: layout.layoutItemId! };
      } else if (layout.op === "remove") {
        normalized = {
          kind: "layout",
          op: "remove",
          layoutItemId: layout.layoutItemId!,
          blockId: layout.blockId,
        };
      } else if (layout.op === "duplicate") {
        normalized = { kind: "layout", op: "duplicate", blockId: layout.blockId! };
      } else if (layout.op === "add") {
        normalized = {
          kind: "layout",
          op: "add",
          blockType: layout.blockType!,
          atIndex: layout.atIndex!,
          templateId: layout.templateId,
        };
      } else {
        normalized = { kind: "layout", op: "replace" };
      }
    } else if (patch.data.kind === "enField") {
      normalized = patch.data;
    } else {
      normalized = patch.data;
    }
    return {
      channel: CMS_EDIT_CHANNEL,
      type: "cms-draft-patch",
      sessionId: msg.sessionId,
      pageId: msg.pageId,
      baseRevision: msg.baseRevision,
      mutationId: msg.mutationId,
      patch: normalized,
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

  if (type === "cms-ui-command") {
    if (typeof msg.sessionId !== "string" || typeof msg.pageId !== "string") return null;
    const command = msg.command;
    if (!command || typeof command !== "object") return null;
    const cmd = command as Record<string, unknown>;
    if (cmd.kind === "openAddPicker") {
      if (typeof cmd.atIndex !== "number" || !Number.isInteger(cmd.atIndex) || cmd.atIndex < 0) {
        return null;
      }
      return {
        channel: CMS_EDIT_CHANNEL,
        type: "cms-ui-command",
        sessionId: msg.sessionId,
        pageId: msg.pageId,
        command: { kind: "openAddPicker", atIndex: cmd.atIndex },
      };
    }
    if (cmd.kind === "openAdvanced") {
      const sel = cmd.selection;
      if (!sel || typeof sel !== "object") return null;
      const s = sel as Record<string, unknown>;
      if (s.kind === "fixed" && typeof s.sectionKey === "string" && isFixedSectionKey(s.sectionKey)) {
        return {
          channel: CMS_EDIT_CHANNEL,
          type: "cms-ui-command",
          sessionId: msg.sessionId,
          pageId: msg.pageId,
          command: {
            kind: "openAdvanced",
            selection: {
              kind: "fixed",
              sectionKey: s.sectionKey,
              part: typeof s.part === "string" ? s.part : undefined,
            },
          },
        };
      }
      if (
        s.kind === "block" &&
        typeof s.blockId === "string" &&
        typeof s.layoutItemId === "string"
      ) {
        return {
          channel: CMS_EDIT_CHANNEL,
          type: "cms-ui-command",
          sessionId: msg.sessionId,
          pageId: msg.pageId,
          command: {
            kind: "openAdvanced",
            selection: {
              kind: "block",
              blockId: s.blockId,
              layoutItemId: s.layoutItemId,
            },
          },
        };
      }
      return null;
    }
    if (cmd.kind === "openMediaPicker") {
      const target = cmd.target;
      if (!target || typeof target !== "object") return null;
      const t = target as Record<string, unknown>;
      const listItemId = typeof t.listItemId === "string" ? t.listItemId : undefined;
      const listImageKey = typeof t.listImageKey === "string" ? t.listImageKey : undefined;
      const listAppend = t.listAppend === true;
      if (
        t.kind === "section" &&
        typeof t.sectionKey === "string" &&
        isFixedSectionKey(t.sectionKey) &&
        typeof t.field === "string"
      ) {
        return {
          channel: CMS_EDIT_CHANNEL,
          type: "cms-ui-command",
          sessionId: msg.sessionId,
          pageId: msg.pageId,
          command: {
            kind: "openMediaPicker",
            target: {
              kind: "section",
              sectionKey: t.sectionKey,
              field: t.field,
              ...(listAppend
                ? { listAppend: true, listImageKey: listImageKey ?? "image" }
                : listItemId
                  ? { listItemId, listImageKey: listImageKey ?? "image" }
                  : {}),
            },
          },
        };
      }
      if (t.kind === "block" && typeof t.blockId === "string" && typeof t.field === "string") {
        return {
          channel: CMS_EDIT_CHANNEL,
          type: "cms-ui-command",
          sessionId: msg.sessionId,
          pageId: msg.pageId,
          command: {
            kind: "openMediaPicker",
            target: {
              kind: "block",
              blockId: t.blockId,
              field: t.field,
              ...(listAppend
                ? { listAppend: true, listImageKey: listImageKey ?? "image" }
                : listItemId
                  ? { listItemId, listImageKey: listImageKey ?? "image" }
                  : {}),
            },
          },
        };
      }
      return null;
    }
    if (cmd.kind === "undo" || cmd.kind === "redo") {
      return {
        channel: CMS_EDIT_CHANNEL,
        type: "cms-ui-command",
        sessionId: msg.sessionId,
        pageId: msg.pageId,
        command: { kind: cmd.kind },
      };
    }
    return null;
  }

  if (type === "cms-editor-mode") {
    if (
      typeof msg.sessionId !== "string" ||
      typeof msg.pageId !== "string" ||
      (msg.interactionMode !== "edit" && msg.interactionMode !== "preview")
    ) {
      return null;
    }
    return {
      channel: CMS_EDIT_CHANNEL,
      type: "cms-editor-mode",
      sessionId: msg.sessionId,
      pageId: msg.pageId,
      interactionMode: msg.interactionMode,
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
