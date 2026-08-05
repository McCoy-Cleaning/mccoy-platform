/**
 * Breaks shared-fields ↔ blockEditorRegistry cycle for nested popup editors.
 * Registry registers the lookup after it finishes loading; button editor reads it at call time.
 */
import type { ComponentType } from "react";
import type { PopupContentBlockType } from "@mccoy/cms-schema";
import type { BlockEditorProps } from "./editor-definition";

type PopupContentEditor = ComponentType<BlockEditorProps<unknown>>;

let lookup: ((type: PopupContentBlockType) => PopupContentEditor | null) | null = null;

export function setPopupContentEditorLookup(
  fn: (type: PopupContentBlockType) => PopupContentEditor | null,
): void {
  lookup = fn;
}

export function getPopupContentEditor(type: PopupContentBlockType): PopupContentEditor | null {
  return lookup?.(type) ?? null;
}
