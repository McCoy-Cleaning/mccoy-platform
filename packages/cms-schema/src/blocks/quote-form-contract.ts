/**
 * E12 — Offerte (quoteRequestForm) contract protection.
 * Presentation may change; tab.kind / field id / type / payloadKey must not.
 */
import {
  formFieldPayloadKey,
  withFrozenPayloadKey,
  withFrozenPayloadKeys,
  type FormFieldItem,
} from "./form-fields";
import {
  normalizeQuoteRequestForm,
  type QuoteFormKind,
  type QuoteRequestFormBlockData,
  type QuoteRequestFormTab,
} from "./new-sections";

export type QuoteFieldPresentationPatch = {
  label?: string;
  placeholder?: string | null;
};

export type QuoteContractGuardResult =
  | { ok: true; data: QuoteRequestFormBlockData }
  | { ok: false; reason: string };

const QUOTE_SYSTEM_FIELD_ID_PREFIXES = ["quote-glass-", "quote-furniture-", "builtin-"] as const;

export function isQuoteSystemFieldId(fieldId: string): boolean {
  return QUOTE_SYSTEM_FIELD_ID_PREFIXES.some((p) => fieldId.startsWith(p));
}

export function isQuoteProtectedField(field: FormFieldItem): boolean {
  if (isQuoteSystemFieldId(field.id)) return true;
  const key = formFieldPayloadKey(field);
  return (
    key === "name" ||
    key === "email" ||
    key === "phone" ||
    key === "company" ||
    key === "message" ||
    key === "photos"
  );
}

/**
 * Apply safe presentation-only edits to one field. Preserves id/type/payloadKey/options/required.
 */
export function applyQuoteFieldPresentation(
  tab: QuoteRequestFormTab,
  fieldId: string,
  patch: QuoteFieldPresentationPatch,
): { ok: true; tab: QuoteRequestFormTab } | { ok: false; reason: string } {
  const idx = tab.fields.findIndex((f) => f.id === fieldId);
  if (idx < 0) return { ok: false, reason: "Veld niet gevonden" };
  const current = withFrozenPayloadKey(tab.fields[idx]!);
  const next: FormFieldItem = {
    ...current,
    label:
      typeof patch.label === "string" && patch.label.trim()
        ? patch.label.trim()
        : current.label,
    placeholder:
      patch.placeholder === null
        ? undefined
        : typeof patch.placeholder === "string"
          ? patch.placeholder.trim() || undefined
          : current.placeholder,
    // Identity locked:
    id: current.id,
    type: current.type,
    payloadKey: current.payloadKey,
    required: current.required,
    options: current.options,
  };
  if (formFieldPayloadKey(next) !== formFieldPayloadKey(current)) {
    return { ok: false, reason: "Submission key mag niet wijzigen" };
  }
  const fields = tab.fields.slice();
  fields[idx] = next;
  return { ok: true, tab: { ...tab, fields } };
}

function protectField(prev: FormFieldItem | undefined, next: FormFieldItem): FormFieldItem {
  const frozenNext = withFrozenPayloadKey(next);
  if (!prev) {
    // New field: freeze key from its own label/type now.
    return frozenNext;
  }
  const frozenPrev = withFrozenPayloadKey(prev);
  return {
    ...frozenNext,
    id: frozenPrev.id,
    type: frozenPrev.type,
    payloadKey: frozenPrev.payloadKey,
    // Presentation may change:
    label: frozenNext.label,
    placeholder: frozenNext.placeholder,
    // Required / options: keep previous for protected; allow for ad-hoc extras
    required: isQuoteProtectedField(frozenPrev) ? frozenPrev.required : frozenNext.required,
    options: isQuoteProtectedField(frozenPrev)
      ? freezeOptionValues(frozenPrev.options, frozenNext.options)
      : frozenNext.options,
  };
}

function freezeOptionValues(
  prev: FormFieldItem["options"],
  next: FormFieldItem["options"],
): FormFieldItem["options"] {
  if (!prev?.length) return next;
  if (!next?.length) return prev;
  // Match by id; keep value from prev, allow label from next.
  return next.map((opt) => {
    const prior = prev.find((p) => p.id === opt.id);
    if (!prior) return opt;
    return { ...opt, id: prior.id, value: prior.value };
  });
}

function protectTab(prev: QuoteRequestFormTab | undefined, next: QuoteRequestFormTab): QuoteRequestFormTab {
  if (!prev) {
    return {
      ...next,
      fields: withFrozenPayloadKeys(next.fields),
    };
  }
  const prevById = new Map(prev.fields.map((f) => [f.id, f]));
  const nextIds = new Set(next.fields.map((f) => f.id));
  // System fields cannot be deleted.
  const restored: FormFieldItem[] = [];
  for (const field of prev.fields) {
    if (isQuoteProtectedField(field) && !nextIds.has(field.id)) {
      restored.push(withFrozenPayloadKey(field));
    }
  }
  const mergedFields = [
    ...next.fields.map((f) => protectField(prevById.get(f.id), f)),
    ...restored,
  ];
  return {
    ...next,
    id: prev.id,
    kind: prev.kind as QuoteFormKind,
    scope: prev.scope,
    fields: withFrozenPayloadKeys(mergedFields),
    // Presentation:
    tag: next.tag,
    title: next.title,
    description: next.description,
    icon: next.icon,
    submitLabel: next.submitLabel,
    successMessage: next.successMessage,
  };
}

/**
 * Reconcile a proposed quoteRequestForm block data against the previous snapshot.
 * Locks tab.kind, field identity, and submission keys.
 */
export function protectQuoteRequestFormData(
  previous: unknown,
  proposed: unknown,
): QuoteContractGuardResult {
  const prev = normalizeQuoteRequestForm(previous);
  const next = normalizeQuoteRequestForm(proposed);
  const prevById = new Map(prev.tabs.map((t) => [t.id, t]));

  // Tabs with known ids keep kind; unknown new tabs keep their proposed kind (Geavanceerd add).
  const tabs = next.tabs.map((tab) => protectTab(prevById.get(tab.id), tab));

  // Do not allow dropping the last glass/furniture system tab silently when previous had it.
  for (const prior of prev.tabs) {
    if (!tabs.some((t) => t.id === prior.id)) {
      // Tab removal via Geavanceerd remains possible only when not the sole tab of that kind —
      // restore protected tab if it disappeared while still referenced as default.
      if (prior.id === prev.defaultTabId || prev.tabs.length === 1) {
        tabs.push(protectTab(prior, prior));
      }
    }
  }

  const data: QuoteRequestFormBlockData = {
    ...next,
    tabs,
    defaultTabId:
      next.defaultTabId && tabs.some((t) => t.id === next.defaultTabId)
        ? next.defaultTabId
        : prev.defaultTabId && tabs.some((t) => t.id === prev.defaultTabId)
          ? prev.defaultTabId
          : tabs[0]?.id,
  };

  return { ok: true, data: normalizeQuoteRequestForm(data) };
}

/** True when a patch only touches presentation strings on an existing field. */
export function quoteFieldPresentationPatchPreservesContract(
  before: FormFieldItem,
  after: FormFieldItem,
): boolean {
  const a = withFrozenPayloadKey(before);
  const b = withFrozenPayloadKey(after);
  return (
    a.id === b.id &&
    a.type === b.type &&
    formFieldPayloadKey(a) === formFieldPayloadKey(b) &&
    a.required === b.required
  );
}
