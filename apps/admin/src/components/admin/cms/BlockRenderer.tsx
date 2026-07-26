import * as React from "react";
import {
  SectionAiToolbar,
  RegisteredBlockEditor,
  collectShallowStringFields,
  isTranslatableFieldKey,
  type CmsImagePickerProps,
} from "@mccoy/cms-editor";
import {
  getBlockDataDefinition,
  UNPUBLISHABLE_BLOCK_WARNING_NL,
  type Block,
} from "@mccoy/cms-schema";

type Props = {
  block: Block;
  onChange: (patch: Record<string, unknown> & { dataVersion?: number }) => void;
} & CmsImagePickerProps;

function BlockImproveTextToolbar({
  block,
  onChange,
}: {
  block: Block;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const data = block.data as Record<string, unknown>;
  const copyKeys = Object.keys(data).filter(
    (key) => typeof data[key] === "string" && isTranslatableFieldKey(key),
  );
  if (copyKeys.length === 0) return null;
  const fields = collectShallowStringFields(data, copyKeys, { includeEmpty: true });
  return (
    <div className="mb-4">
      <SectionAiToolbar
        pathPrefix={`block:${block.id}`}
        fields={fields}
        fieldLabels={Object.fromEntries(copyKeys.map((k) => [k, k]))}
        onApplyDutch={(nl) => {
          const patch: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(nl)) {
            if (copyKeys.includes(key)) patch[key] = value;
          }
          onChange(patch);
        }}
      />
    </div>
  );
}

/**
 * Authoritative editor from the block registry (inspector presentation).
 * Full-page preview lives in the website editor preview pane — do not mount
 * a per-block visual preview here.
 */
export function BlockRenderer({
  block,
  onChange,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: Props) {
  const def = getBlockDataDefinition(block.type);
  const summary =
    typeof def.getSummary === "function"
      ? def.getSummary(block.data)
      : null;
  return (
    <div className="space-y-4">
      {!def.capabilities.publishable ? (
        <div
          className="rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"
          role="status"
        >
          <span className="inline-flex items-center rounded-md border border-amber-300/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-100">
            Nog niet publiceerbaar
          </span>
          <p className="mt-2">{UNPUBLISHABLE_BLOCK_WARNING_NL}</p>
        </div>
      ) : null}
      {summary ? (
        <p className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] text-white/55">
          {summary}
        </p>
      ) : null}
      <BlockImproveTextToolbar
        block={block}
        onChange={(patch) => onChange({ ...block.data, ...patch })}
      />
      <RegisteredBlockEditor
        block={block}
        presentation="inspector"
        projectImages={projectImages}
        assetBaseUrl={assetBaseUrl}
        uploadToMediaLibrary={uploadToMediaLibrary}
        mediaLibraryItems={mediaLibraryItems}
        resolveProjectImage={resolveProjectImage}
        onChange={(next) => {
          onChange({ ...next.data, dataVersion: next.dataVersion });
        }}
      />
    </div>
  );
}
