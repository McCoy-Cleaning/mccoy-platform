import type { CmsMutation, FixedSectionKey } from "@mccoy/cms-schema";

export type CmsSelection =
  | { kind: "fixed"; sectionKey: FixedSectionKey; part?: string }
  | { kind: "block"; blockId: string; layoutItemId: string }
  | null;

export function buildSectionMutation(sectionKey: FixedSectionKey, patch: Record<string, unknown>): CmsMutation {
  return { kind: "section", sectionKey, patch };
}
