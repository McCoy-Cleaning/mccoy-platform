/**
 * Re-export shared CMS schema. App-local CMS modules should import from here
 * or directly from `@mccoy/cms-schema`.
 */
export type {
  Block,
  BlockCategory,
  BlockType,
  BuiltinRouteKey,
  CmsLink,
  CmsPersistedState,
  EditorStatus,
  Page,
  PageDraft,
  PageOverrides,
  PreviewSnapshot,
  PreviewStatus,
} from "@mccoy/cms-schema";

/** @deprecated Use CmsPersistedState — kept for gradual migration */
export type { CmsPersistedState as CmsState } from "@mccoy/cms-schema";
