import * as React from "react";
import type {
  CmsMutation,
  CmsPage,
  CmsUiCommand,
  FixedSectionKey,
  PageOverrides,
  PageSectionContent,
} from "@mccoy/cms-schema";
import type { CmsEditorInteractionMode } from "@mccoy/cms-schema";

export type CmsCanvasSelection =
  | { kind: "fixed"; sectionKey: FixedSectionKey; part?: string }
  | { kind: "block"; blockId: string; layoutItemId: string }
  | null;

export type LiveEditDraft = {
  pageId: string;
  page: CmsPage;
  overrides: PageOverrides;
  sectionContent: PageSectionContent;
  revision: number;
  sessionId: string;
};

export type LiveEditApi = {
  draft: LiveEditDraft | null;
  selection: CmsCanvasSelection;
  setSelection: (sel: CmsCanvasSelection) => void;
  sendMutation: (patch: CmsMutation) => void;
  sendUiCommand: (command: CmsUiCommand) => void;
  isEdit: boolean;
  /** When preview, draft sync continues but WYSIWYG chrome is hidden. */
  interactionMode: CmsEditorInteractionMode;
  /** True when edit session is active and chrome should render. */
  showEditorChrome: boolean;
  pageId: string | null;
};

const defaultApi: LiveEditApi = {
  draft: null,
  selection: null,
  setSelection: () => {},
  sendMutation: () => {},
  sendUiCommand: () => {},
  isEdit: false,
  interactionMode: "edit",
  showEditorChrome: false,
  pageId: null,
};

export const LiveEditCtx = React.createContext<LiveEditApi>(defaultApi);

export function useLiveEditApi(): LiveEditApi {
  return React.useContext(LiveEditCtx);
}

export function useLiveEditDraft(): LiveEditDraft | null {
  return React.useContext(LiveEditCtx).draft;
}
