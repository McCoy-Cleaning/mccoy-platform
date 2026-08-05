import type { BlockType } from "./block-types";

export type { BlockType } from "./block-types";

/** CMS block instance stored on a page. */
export interface Block {
  id: string;
  type: BlockType;
  data: Record<string, unknown>;
  /** Canonical data shape version for this block type after edit/republish. */
  dataVersion?: number;
}
