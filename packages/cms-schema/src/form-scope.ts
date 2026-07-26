import { z } from "zod";
import {
  FORM_SCOPE_KEY_PATTERN,
  FORM_SCOPE_LABEL_MAX,
  buildFormScopeSnapshot,
  type FormScopeSnapshot,
} from "@mccoy/domain";

export type { FormScopeSnapshot };
export { FORM_SCOPE_LABEL_MAX, FORM_SCOPE_KEY_PATTERN };

export const formScopeSnapshotSchema: z.ZodType<FormScopeSnapshot> = z.object({
  key: z.string().trim().toLowerCase().regex(FORM_SCOPE_KEY_PATTERN).max(64),
  label: z.string().trim().min(1).max(FORM_SCOPE_LABEL_MAX),
});

/**
 * Normalize optional CMS scope from raw JSON.
 * Keeps an existing key when present (label-only rename).
 * Invalid values are dropped (legacy / empty) rather than failing the whole block.
 */
export function normalizeFormScopeSnapshot(value: unknown): FormScopeSnapshot | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const built = buildFormScopeSnapshot(value);
    return built.ok ? built.scope : undefined;
  }
  if (typeof value !== "object") return undefined;
  const rec = value as Record<string, unknown>;
  const label = typeof rec.label === "string" ? rec.label : "";
  const key = typeof rec.key === "string" ? rec.key : undefined;
  if (!label.trim()) return undefined;
  const built = buildFormScopeSnapshot(label, key);
  return built.ok ? built.scope : undefined;
}

/** Build/update scope from a label edit in the CMS inspector. */
export function formScopeFromLabelInput(
  labelRaw: string,
  existing?: FormScopeSnapshot | null,
): FormScopeSnapshot | undefined {
  const trimmed = labelRaw.trim();
  if (!trimmed) return undefined;
  const built = buildFormScopeSnapshot(trimmed, existing?.key);
  return built.ok ? built.scope : existing ?? undefined;
}
