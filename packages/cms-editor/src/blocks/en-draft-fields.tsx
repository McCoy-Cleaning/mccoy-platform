import * as React from "react";
import { ManualEnDraftField, isTranslatableFieldKey } from "../ai-assist";
import { Field } from "./field-chrome";

/** `block:{id}:{dottedField}` — undefined when no block id (tests / compact). */
export function blockEnPath(blockId: string | undefined, field: string): string | undefined {
  if (!blockId) return undefined;
  return `block:${blockId}:${field}`;
}

/** `section:{sectionKey}:{dottedField}` */
export function sectionEnPath(sectionKey: string, field: string): string {
  return `section:${sectionKey}:${field}`;
}

function fieldSegments(fieldPath: string): string[] {
  // Paths are `scope:id:dotted.field` — only inspect the field segment.
  const colonParts = fieldPath.split(":");
  const field =
    colonParts.length >= 3 &&
    (colonParts[0] === "block" || colonParts[0] === "section" || colonParts[0] === "page")
      ? colonParts.slice(2).join(":")
      : fieldPath;
  return field.split(".").filter(Boolean);
}

function leafKey(fieldPath: string): string {
  const parts = fieldSegments(fieldPath);
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]!;
    if (!/^\d+$/.test(part)) return part;
  }
  return parts[parts.length - 1] ?? fieldPath;
}

/** True when the draft path is UI copy (incl. form `labels.email` / `placeholders.phone`). */
function isEnDraftEligiblePath(fieldPath: string): boolean {
  const parts = fieldSegments(fieldPath);
  const parent = parts.length >= 2 ? parts[parts.length - 2]! : "";
  if (parent === "labels" || parent === "placeholders") return true;
  return isTranslatableFieldKey(leafKey(fieldPath));
}

/**
 * Manual EN draft control for a block (or any full) field path.
 * Skips non-translatable leaf keys (ids, urls, emails, layout enums, …).
 */
export function EnDraftFor({
  fieldPath,
  label,
  multiline = false,
}: {
  /** Full draft path (`block:…:title` or `section:…:heading`) or relative when used via NlEnField. */
  fieldPath?: string;
  label?: string;
  multiline?: boolean;
}) {
  if (!fieldPath) return null;
  if (!isEnDraftEligiblePath(fieldPath)) return null;
  return <ManualEnDraftField fieldPath={fieldPath} label={label} multiline={multiline} />;
}

/**
 * NL field wrapper that appends a manual EN draft when `enPath` is set.
 * Prefer this over copy-pasting Field + ManualEnDraftField pairs.
 */
export function NlEnField({
  label,
  enPath,
  children,
  hint,
  multiline,
}: {
  label: string;
  /** Full `block:` / `section:` path; omit to render NL-only. */
  enPath?: string;
  children: React.ReactNode;
  hint?: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Field label={label} hint={hint}>
        {children}
      </Field>
      <EnDraftFor fieldPath={enPath} label={label} multiline={multiline} />
    </div>
  );
}
