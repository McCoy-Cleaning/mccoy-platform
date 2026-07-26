import type { PageDraft } from "./types";

export function isDraftDirty(draft: PageDraft | undefined): boolean {
  if (!draft) return false;
  if (Object.keys(draft.overrides ?? {}).length > 0) return true;
  if (draft.page) return true;
  if (draft.sectionContent && Object.keys(draft.sectionContent).length > 0) return true;
  if (draft.blocks) return true;
  if (draft.extraBlocks) return true;
  if (
    draft.title !== undefined ||
    draft.slug !== undefined ||
    draft.description !== undefined ||
    draft.inNav !== undefined
  ) {
    return true;
  }
  return false;
}
