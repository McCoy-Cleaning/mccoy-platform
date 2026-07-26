/**
 * Form scope identity for Aanvragen classification.
 *
 * - `key` is stable (filters, URLs, equality).
 * - `label` is display-only (email body, badges, historical snapshot).
 */

export const FORM_SCOPE_KEY_MAX = 64;
export const FORM_SCOPE_LABEL_MAX = 80;

/** Namespaced subject marker — never parse arbitrary leading brackets. */
export const FORM_SCOPE_MARKER_PREFIX = "FORM_SCOPE";

export const FORM_SCOPE_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

const FORM_SCOPE_MARKER_RE =
  /\[FORM_SCOPE:([a-z0-9][a-z0-9-]{0,63})\]/i;

const REPLY_FORWARD_PREFIX_RE = /^(?:(?:RE|FW|FWD|AW|WG)\s*:\s*)+/i;

export type FormScopeSnapshot = {
  key: string;
  label: string;
};

/** Precedence when reconstructing scope from inbox (lower = stronger). */
export const FORM_SCOPE_RESOLVE_PRECEDENCE = [
  "persisted_request",
  "custom_headers",
  "body_metadata",
  "subject_marker",
  "null",
] as const;

export type FormScopeResolveSource = (typeof FORM_SCOPE_RESOLVE_PRECEDENCE)[number];

export function hasControlOrNewline(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/**
 * Normalize a CMS/user label: trim + collapse whitespace.
 * Returns null when empty after normalize.
 * Throws / returns error string via validateFormScopeLabel for invalid input.
 */
export function normalizeFormScopeLabel(raw: string): string | null {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  return collapsed.length > 0 ? collapsed : null;
}

export type FormScopeValidationError =
  | "empty"
  | "too_long"
  | "control_chars"
  | "invalid_key";

export function validateFormScopeLabel(
  raw: string,
): { ok: true; label: string } | { ok: false; error: FormScopeValidationError } {
  if (hasControlOrNewline(raw)) {
    return { ok: false, error: "control_chars" };
  }
  const label = normalizeFormScopeLabel(raw);
  if (!label) return { ok: false, error: "empty" };
  if (label.length > FORM_SCOPE_LABEL_MAX) {
    return { ok: false, error: "too_long" };
  }
  return { ok: true, label };
}

/** Generate a stable key from a label. Returns null if result is empty/invalid. */
export function formScopeKeyFromLabel(label: string): string | null {
  const normalized = normalizeFormScopeLabel(label);
  if (!normalized) return null;
  const slug = normalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, FORM_SCOPE_KEY_MAX);
  if (!slug || !FORM_SCOPE_KEY_PATTERN.test(slug)) return null;
  return slug;
}

export function validateFormScopeKey(
  raw: string,
): { ok: true; key: string } | { ok: false; error: FormScopeValidationError } {
  const key = raw.trim().toLowerCase();
  if (!key) return { ok: false, error: "empty" };
  if (hasControlOrNewline(key)) return { ok: false, error: "control_chars" };
  if (key.length > FORM_SCOPE_KEY_MAX || !FORM_SCOPE_KEY_PATTERN.test(key)) {
    return { ok: false, error: "invalid_key" };
  }
  return { ok: true, key };
}

/**
 * Build a scope snapshot from a CMS label.
 * Keeps an existing key when provided (label-only renames).
 */
export function buildFormScopeSnapshot(
  labelRaw: string,
  existingKey?: string | null,
): { ok: true; scope: FormScopeSnapshot } | { ok: false; error: FormScopeValidationError } {
  const labelResult = validateFormScopeLabel(labelRaw);
  if (!labelResult.ok) return labelResult;

  if (existingKey?.trim()) {
    const keyResult = validateFormScopeKey(existingKey);
    if (!keyResult.ok) return keyResult;
    return { ok: true, scope: { key: keyResult.key, label: labelResult.label } };
  }

  const key = formScopeKeyFromLabel(labelResult.label);
  if (!key) return { ok: false, error: "invalid_key" };
  return { ok: true, scope: { key, label: labelResult.label } };
}

/** Subject-safe fragment — strips CR/LF already via validation; defensive strip. */
export function sanitizeScopeForSubject(value: string): string {
  return value.replace(/[\r\n\u0000-\u001f\u007f]/g, "").trim();
}

export function encodeFormScopeSubjectMarker(key: string): string {
  const safe = sanitizeScopeForSubject(key).toLowerCase();
  return `[${FORM_SCOPE_MARKER_PREFIX}:${safe}]`;
}

export function stripReplyForwardPrefixes(subject: string): string {
  return subject.trim().replace(REPLY_FORWARD_PREFIX_RE, "").trim();
}

/**
 * Extract FORM_SCOPE key from a subject. Ignores other bracket prefixes
 * (e.g. [EXTERNAL]) — only matches the namespaced marker.
 */
export function extractFormScopeKeyFromSubject(
  subject: string | undefined | null,
): string | null {
  if (!subject?.trim()) return null;
  const cleaned = stripReplyForwardPrefixes(subject);
  const match = cleaned.match(FORM_SCOPE_MARKER_RE);
  if (!match?.[1]) return null;
  const keyResult = validateFormScopeKey(match[1]);
  return keyResult.ok ? keyResult.key : null;
}

/** Remove the FORM_SCOPE marker (anywhere) for kind/name classification. */
export function stripFormScopeMarkerFromSubject(subject: string): string {
  return subject.replace(FORM_SCOPE_MARKER_RE, " ").replace(/\s+/g, " ").trim();
}

export function composeWebsiteFormId(pageId: string, sourceId: string): string {
  return `${pageId}:${sourceId}`;
}

/** Known fixed / synthetic form source IDs. */
export const FIXED_FORM_SOURCE_IDS = {
  contactForm: "fixed:contact:form",
  offerteForm: "fixed:offerte:form",
  vacaturesApplication: "fixed:vacatures:application",
} as const;
