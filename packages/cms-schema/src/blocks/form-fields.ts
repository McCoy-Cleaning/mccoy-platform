import { z } from "zod";
import { createItemId } from "../content";

export const FORM_FIELD_TYPES = [
  "name",
  "email",
  "phone",
  "company",
  "text",
  "textarea",
  "select",
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Dutch labels for the CMS field-type dropdown (stable keys → UI copy). */
export const FORM_FIELD_TYPE_LABELS_NL: Record<FormFieldType, string> = {
  name: "Naam",
  email: "E-mail",
  phone: "Telefoon",
  company: "Bedrijf",
  text: "Tekst (één regel)",
  textarea: "Tekstvak (meer regels)",
  select: "Keuzelijst",
};

export type FormFieldOption = {
  id: string;
  label: string;
  /** Stable option value; defaults from label when omitted. */
  value?: string;
};

export type FormFieldItem = {
  id: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: FormFieldOption[];
};

export const formFieldOptionSchema: z.ZodType<FormFieldOption> = z.object({
  id: z.string().min(1),
  label: z.string(),
  value: z.string().optional(),
});

export const formFieldItemSchema: z.ZodType<FormFieldItem> = z.object({
  id: z.string().min(1),
  label: z.string(),
  type: z.enum(FORM_FIELD_TYPES),
  required: z.boolean().optional(),
  options: z.array(formFieldOptionSchema).optional(),
});

export function createFormFieldOption(label = "", value?: string): FormFieldOption {
  return { id: createItemId("opt"), label, value: value?.trim() || undefined };
}

export function createFormFieldItem(
  label: string,
  type: FormFieldType = "text",
  partial?: Partial<Omit<FormFieldItem, "id" | "label" | "type">>,
): FormFieldItem {
  const required =
    partial?.required ?? (type === "name" || type === "email" ? true : undefined);
  return {
    id: createItemId("fld"),
    label,
    type,
    required,
    options: partial?.options,
  };
}

/** Stable ids for built-in contact form fields (always rendered on the storefront). */
export const BUILTIN_CONTACT_FORM_NAME_ID = "builtin-contact-name";
export const BUILTIN_CONTACT_FORM_EMAIL_ID = "builtin-contact-email";

export const BUILTIN_CONTACT_FORM_NAME_FIELD: FormFieldItem = {
  id: BUILTIN_CONTACT_FORM_NAME_ID,
  label: "Naam",
  type: "name",
  required: true,
};

export const BUILTIN_CONTACT_FORM_EMAIL_FIELD: FormFieldItem = {
  id: BUILTIN_CONTACT_FORM_EMAIL_ID,
  label: "E-mail",
  type: "email",
  required: true,
};

/** Field types editors may add as extra contact-form fields (name/email are built-in). */
export const CONTACT_FORM_CUSTOM_FIELD_TYPES = FORM_FIELD_TYPES.filter(
  (type) => type !== "name" && type !== "email",
);

/** Default CMS fields for new contact forms — name/email are always built-in on the storefront. */
export const DEFAULT_CONTACT_FORM_FIELDS: FormFieldItem[] = [
  createFormFieldItem("Bericht", "textarea"),
];

function inferFieldTypeFromLabel(label: string): FormFieldType {
  const lower = label.trim().toLowerCase();
  if (/^(e-?mail|email)$/i.test(lower)) return "email";
  if (/^(naam|name)$/i.test(lower)) return "name";
  if (/^(telefoon|phone|tel|mobiel)$/i.test(lower)) return "phone";
  if (/^(bedrijf|company|organisatie|organization)$/i.test(lower)) return "company";
  if (/^(bericht|message|opmerking|vraag)$/i.test(lower)) return "textarea";
  return "text";
}

function slugFromLabel(label: string, id: string): string {
  const lower = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return lower || `field_${id.slice(0, 12)}`;
}

function normalizeFieldOptions(value: unknown): FormFieldOption[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const out: FormFieldOption[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const label = entry.trim();
      if (!label) continue;
      out.push(createFormFieldOption(label));
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const label =
      typeof rec.label === "string"
        ? rec.label
        : typeof rec.text === "string"
          ? rec.text
          : "";
    if (!label.trim()) continue;
    const id =
      typeof rec.id === "string" && rec.id.length > 0 ? rec.id : createItemId("opt");
    const rawValue = typeof rec.value === "string" ? rec.value.trim() : "";
    out.push({
      id,
      label,
      value: rawValue || undefined,
    });
  }
  return out.length > 0 ? out : undefined;
}

function normalizeFieldType(raw: unknown, label: string): FormFieldType {
  if (typeof raw === "string" && (FORM_FIELD_TYPES as readonly string[]).includes(raw)) {
    return raw as FormFieldType;
  }
  return inferFieldTypeFromLabel(label);
}

/** Normalize legacy TextListItem[] or mixed JSON into typed form fields. */
export function normalizeFormFields(value: unknown): FormFieldItem[] {
  if (!Array.isArray(value)) return [];
  const out: FormFieldItem[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const label = entry.trim();
      if (!label) continue;
      const type = inferFieldTypeFromLabel(label);
      out.push(createFormFieldItem(label, type));
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const label =
      typeof rec.label === "string"
        ? rec.label
        : typeof rec.text === "string"
          ? rec.text
          : "";
    if (!label.trim() && typeof rec.type !== "string") continue;
    const id =
      typeof rec.id === "string" && rec.id.length > 0 ? rec.id : createItemId("fld");
    const type = normalizeFieldType(rec.type, label || "Veld");
    const required =
      typeof rec.required === "boolean"
        ? rec.required
        : type === "name" || type === "email"
          ? true
          : undefined;
    const options = type === "select" ? normalizeFieldOptions(rec.options) : undefined;
    out.push({
      id,
      label: label || "Veld",
      type,
      required,
      options,
    });
  }
  return out;
}

function isReservedContactFormField(field: FormFieldItem): boolean {
  if (field.type === "name" || field.type === "email") return true;
  const key = formFieldPayloadKey(field);
  return key === "name" || key === "email";
}

/**
 * Built-in name/email plus CMS-configured extra fields.
 * Legacy name/email rows in CMS data are ignored to avoid duplicate inputs.
 */
export function resolveContactFormFields(customFields: unknown): FormFieldItem[] {
  const custom = normalizeFormFields(customFields).filter(
    (field) => field.label.trim() && !isReservedContactFormField(field),
  );
  return [BUILTIN_CONTACT_FORM_NAME_FIELD, BUILTIN_CONTACT_FORM_EMAIL_FIELD, ...custom];
}

/** Map a configured field to the payload key used by website form submit. */
export function formFieldPayloadKey(field: FormFieldItem): string {
  if (field.type === "name") return "name";
  if (field.type === "email") return "email";
  if (field.type === "phone") return "phone";
  if (field.type === "company") return "company";
  const lower = field.label.trim().toLowerCase();
  if (/^(naam|name)$/i.test(lower)) return "name";
  if (/^(e-?mail|email)$/i.test(lower)) return "email";
  if (/^(bericht|message|opmerking)$/i.test(lower)) return "message";
  if (/^(telefoon|phone|tel|mobiel)$/i.test(lower)) return "phone";
  if (/^(bedrijf|company|organisatie)$/i.test(lower)) return "company";
  return slugFromLabel(field.label, field.id);
}

export function optionPayloadValue(option: FormFieldOption): string {
  const fromValue = option.value?.trim();
  if (fromValue) return fromValue.slice(0, 120);
  return slugFromLabel(option.label, option.id).slice(0, 120);
}

export type ValidateContactFormSubmissionResult =
  | { ok: true; sanitized: Record<string, string> }
  | { ok: false; reason: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate and normalize a contact/inquiry submission against published field config.
 */
export function validateContactFormSubmission(
  fields: FormFieldItem[],
  payload: Record<string, string>,
): ValidateContactFormSubmissionResult {
  const sanitized: Record<string, string> = {};

  for (const field of fields) {
    const key = formFieldPayloadKey(field);
    const raw = payload[key] ?? payload[field.id] ?? "";
    const value = typeof raw === "string" ? raw.trim().slice(0, 2000) : "";
    const required =
      field.required ?? (field.type === "name" || field.type === "email");

    if (!value) {
      if (required) {
        if (field.type === "name") {
          return { ok: false, reason: "Naam is verplicht." };
        }
        if (field.type === "email") {
          return { ok: false, reason: "E-mail is verplicht." };
        }
        return { ok: false, reason: `${field.label.trim() || "Dit veld"} is verplicht.` };
      }
      continue;
    }

    if (field.type === "email" && !EMAIL_RE.test(value)) {
      return { ok: false, reason: "Vul een geldig e-mailadres in." };
    }

    if (field.type === "select") {
      const options = field.options ?? [];
      const allowed = new Set(options.map((o) => optionPayloadValue(o)));
      if (options.length > 0 && !allowed.has(value)) {
        return { ok: false, reason: `Ongeldige keuze voor ${field.label.trim() || "selectie"}.` };
      }
    }

    sanitized[key] = value;
  }

  if (!sanitized.name || !sanitized.email) {
    return { ok: false, reason: "Naam en e-mail zijn verplicht." };
  }
  if (!EMAIL_RE.test(sanitized.email)) {
    return { ok: false, reason: "Vul een geldig e-mailadres in." };
  }

  return { ok: true, sanitized };
}
