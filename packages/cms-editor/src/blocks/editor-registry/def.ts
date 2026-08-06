import type { ComponentType } from "react";
import type {
  BlockEditorDefinition,
  BlockEditorProps,
  EditorQuality,
} from "../editor-definition";

export function def<T>(
  Editor: ComponentType<BlockEditorProps<T>>,
  quality: Exclude<EditorQuality, "unsupported">,
  supportedPaths: readonly string[],
  nonEditablePaths?: Readonly<Record<string, string>>,
): BlockEditorDefinition<T> {
  return { Editor, quality, supportedPaths, nonEditablePaths };
}
