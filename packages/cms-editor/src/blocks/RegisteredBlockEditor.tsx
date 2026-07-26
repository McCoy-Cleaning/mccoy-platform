import * as React from "react";
import {
  getBlockDataDefinition,
  parseBlockData,
  toPersistedBlockData,
  UNPUBLISHABLE_BLOCK_WARNING_NL,
  type Block,
  type BlockEditorPresentation,
  type BlockType,
} from "@mccoy/cms-schema";

import { getBlockEditorDefinition, getRegisteredBlockEditor } from "./blockEditorRegistry";
import { Field, inputClass } from "./shared-fields";
import { ManualEnDraftField, isTranslatableFieldKey } from "../ai-assist";
import type { CmsImagePickerProps } from "../image-picker-props";

export type RegisteredBlockEditorProps = {
  block: Block;
  onChange: (patch: { data: Record<string, unknown>; dataVersion?: number }) => void;
  presentation?: BlockEditorPresentation;
} & CmsImagePickerProps;

export function RegisteredBlockEditor({
  block,
  onChange,
  presentation = "inspector",
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: RegisteredBlockEditorProps) {
  const imagePickerProps: CmsImagePickerProps = {
    projectImages,
    assetBaseUrl,
    uploadToMediaLibrary,
    mediaLibraryItems,
    resolveProjectImage,
  };
  const def = getBlockDataDefinition(block.type);
  const parsed = parseBlockData(block.type, block.data);
  if (!parsed.ok) {
    return (
      <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
        Ongeldige gegevens — herstel naar standaard.
        <button
          type="button"
          className="mt-2 block text-xs underline"
          onClick={() => {
            const next = toPersistedBlockData(block.type, def.createDefault());
            onChange(next);
          }}
        >
          Herstel standaard
        </button>
      </div>
    );
  }

  const commit = (data: unknown) => {
    onChange(toPersistedBlockData(block.type, data));
  };

  const d = parsed.data as Record<string, unknown>;

  if (!def.capabilities.publishable) {
    return (
      <div className="space-y-3">
        <div
          className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"
          role="status"
        >
          <p className="font-semibold uppercase tracking-wider text-amber-200">
            Nog niet publiceerbaar
          </p>
          <p className="mt-1">{UNPUBLISHABLE_BLOCK_WARNING_NL}</p>
          <p className="mt-1 text-amber-100/70">
            Concept blijft bewaard in het concept; niets wordt stilzwijgend verwijderd.
          </p>
        </div>
        <GenericScalarEditor type={block.type} data={d} onCommit={commit} blockId={block.id} />
      </div>
    );
  }

  const definition = getBlockEditorDefinition(block.type);
  const Dedicated = definition?.Editor ?? getRegisteredBlockEditor(block.type);
  if (Dedicated) {
    const Editor = Dedicated as React.ComponentType<{
      value: unknown;
      onChange: (next: unknown) => void;
      presentation?: BlockEditorPresentation;
      blockId?: string;
    } & CmsImagePickerProps>;
    return (
      <Editor
        value={d}
        onChange={commit}
        presentation={presentation}
        blockId={block.id}
        {...imagePickerProps}
      />
    );
  }

  // Should not happen for publishable types after registry completeness — keep safe fallback.
  return <GenericScalarEditor type={block.type} data={d} onCommit={commit} blockId={block.id} />;
}

function GenericScalarEditor({
  type,
  data,
  onCommit,
  blockId,
}: {
  type: BlockType;
  data: Record<string, unknown>;
  onCommit: (d: unknown) => void;
  blockId?: string;
}) {
  void type;
  const keys = Object.keys(data).filter(
    (k) => typeof data[k] === "string" || typeof data[k] === "boolean",
  );
  return (
    <div className="space-y-3">
      {keys.map((key) =>
        typeof data[key] === "boolean" ? (
          <label key={key} className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={data[key] === true}
              onChange={(e) => onCommit({ ...data, [key]: e.target.checked })}
            />
            {key}
          </label>
        ) : (
          <div key={key} className="space-y-1.5">
            <Field label={key}>
              <textarea
                className={inputClass}
                rows={key === "body" || key === "quote" ? 4 : 2}
                value={String(data[key] ?? "")}
                onChange={(e) => onCommit({ ...data, [key]: e.target.value })}
              />
            </Field>
            {blockId && isTranslatableFieldKey(key) ? (
              <ManualEnDraftField
                fieldPath={`block:${blockId}:${key}`}
                label={key}
                multiline={key === "body" || key === "quote" || key === "description"}
              />
            ) : null}
          </div>
        ),
      )}
      {keys.length === 0 ? (
        <p className="text-xs text-white/50">
          Gebruik de canvas-preview; complexe velden volgen in deze inspector.
        </p>
      ) : null}
    </div>
  );
}
