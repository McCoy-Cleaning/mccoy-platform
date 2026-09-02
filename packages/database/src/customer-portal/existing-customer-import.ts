/**
 * Existing McCoy service-customer file import (Phase 2.3-A).
 *
 * Frozen rule: EXISTING_CLIENT_SOURCE = OPERATOR_MANAGED_FILE_IMPORT.
 * Pipeline: CSV|XLSX → normalize → validate → classify → (preview) →
 * commerce_legacy_service_clients → LegacyMirrorExistingCustomerProvider →
 * syncExistingServiceClients() → companies → (NEW + email) auto Account Admin invite.
 *
 * Does NOT create auth.users / passwords from CSV.
 * Auto-invite creates a portal invitation only (activation creates the user).
 * NEW customers (self-registration) remain out of scope.
 */

import type { CompanyPartyType, CompanyStatus } from "@mccoy/domain";
import { normalizeEmail } from "@mccoy/domain";

import { createSupabaseServiceClient } from "../supabase";
import { writeStaffAudit } from "../staff";
import { syncExistingServiceClients } from "./existing-customer-sync";
import {
  autoInviteNewImportedCompanies,
  planAutoInviteForClassification,
  type ExistingCustomerAutoInvitePlan,
  type ExistingCustomerAutoInviteSummary,
} from "./existing-customer-import-invites";
import {
  EXISTING_CUSTOMER_IMPORT_MAX_BYTES,
  EXISTING_CUSTOMER_IMPORT_MAX_ROWS,
  parseExistingCustomerSpreadsheet,
  type ExistingCustomerColumnMap,
  type ExistingCustomerRawSheet,
} from "./existing-customer-import-parse";

export type ExistingCustomerImportClassification =
  | "NEW"
  | "UPDATE"
  | "UNCHANGED"
  | "INVALID"
  | "CONFLICT";

/**
 * Field ownership for existing-customer import / sync.
 *
 * IMPORT_SOURCE_OWNED — may be overwritten from mirror sync:
 *   legal_name, display_name, kvk_number, vat_number, email, phone,
 *   contact_person_name, address_*, invoice_allowed, company_status,
 *   party_type, company_type (= service_client)
 *
 * PORTAL_OWNED — never touched by import/sync:
 *   company_users, invitations, auth.users, public.users passwords/roles
 *
 * STAFF_MANAGED — not written by this importer:
 *   companies.notes
 *
 * HISTORICAL_SNAPSHOT — never rewritten:
 *   orders, order_items, payments
 */
export const EXISTING_CUSTOMER_FIELD_OWNERSHIP = {
  importSourceOwned: [
    "legal_name",
    "display_name",
    "kvk_number",
    "vat_number",
    "email",
    "phone",
    "contact_person_name",
    "address_street",
    "address_house_number",
    "address_house_suffix",
    "address_postal_code",
    "address_city",
    "address_country",
    "invoice_allowed",
    "company_status",
    "party_type",
    "company_type",
  ],
  portalOwned: ["company_users", "invitations", "auth.users", "passwords"],
  staffManaged: ["notes"],
  historicalSnapshot: ["orders", "order_items", "payments"],
} as const;

export type NormalizedExistingCustomerRow = {
  externalCustomerId: string;
  legalName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  kvkNumber: string | null;
  contactPersonName: string | null;
  addressStreet: string | null;
  addressHouseNumber: string | null;
  addressHouseSuffix: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
  addressCountry: string | null;
  invoiceAllowed: boolean;
  companyStatus: CompanyStatus;
  partyType: CompanyPartyType;
  sourceRowNumber: number;
};

export type ExistingCustomerImportPreviewRow = {
  sourceRowNumber: number;
  externalCustomerId: string | null;
  companyName: string | null;
  classification: ExistingCustomerImportClassification;
  reason: string | null;
  normalized: NormalizedExistingCustomerRow | null;
  autoInvitePlan: ExistingCustomerAutoInvitePlan;
};

export type ExistingCustomerImportPreview = {
  fileName: string;
  sheetName: string | null;
  headers: string[];
  sheetNames: string[];
  totalRows: number;
  counts: {
    new: number;
    update: number;
    unchanged: number;
    invalid: number;
    conflict: number;
  };
  inviteCounts: {
    willInvite: number;
    missingEmail: number;
    skippedNotNew: number;
  };
  rows: ExistingCustomerImportPreviewRow[];
  /** Rows that may be persisted (NEW + UPDATE). UNCHANGED is a no-op. */
  importableCount: number;
};

export type ExistingCustomerImportCommitResult = {
  ok: true;
  fileName: string;
  mirrored: number;
  unchanged: number;
  skippedInvalid: number;
  skippedConflict: number;
  sync: { created: number; updated: number; skipped: number };
  invites: ExistingCustomerAutoInviteSummary;
};

export type ExistingCustomerImportError = {
  ok: false;
  error: string;
  code: "validation" | "parse" | "limit" | "persist";
};

type MirrorRow = {
  external_customer_id: string;
  legal_name: string;
  display_name: string | null;
  kvk_number: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  contact_person_name: string | null;
  address_street: string | null;
  address_house_number: string | null;
  address_house_suffix: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
  invoice_allowed: boolean;
  company_status: CompanyStatus;
  party_type: CompanyPartyType;
};

const COMPANY_STATUSES: CompanyStatus[] = ["pending", "active", "blocked"];

function normalizeHeaderKey(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

const EXTERNAL_ID_ALIASES = new Set([
  "klantnummer",
  "debiteurnummer",
  "debiteurnr",
  "debiteur nummer",
  "customer number",
  "customer id",
  "customerid",
  "account number",
  "accountnumber",
  "external customer id",
  "external_customer_id",
  "externalcustomerid",
]);

const LEGAL_NAME_ALIASES = new Set([
  "bedrijfsnaam",
  "company",
  "company name",
  "company_name",
  "legal name",
  "legal_name",
  "naam",
  "naam klant",
  "klantnaam",
]);

const DISPLAY_ALIASES = new Set(["display name", "display_name", "handelsnaam"]);
const EMAIL_ALIASES = new Set(["email", "e-mail", "e mail", "e-mailadres", "emailadres"]);
const PHONE_ALIASES = new Set(["phone", "telefoon", "telefoonnummer", "tel"]);
const VAT_ALIASES = new Set(["vat", "vat number", "vat_number", "btw", "btw-nummer", "btw nummer"]);
const KVK_ALIASES = new Set(["kvk", "kvk number", "kvk_number", "kvk-nummer", "kvk nummer"]);
const INVOICE_ALIASES = new Set(["invoice allowed", "invoice_allowed", "factuur toegestaan"]);
const STATUS_ALIASES = new Set(["company status", "company_status", "status"]);
const PARTY_TYPE_ALIASES = new Set([
  "klantsoort",
  "klant soort",
  "partij",
  "partijtype",
  "party type",
  "party_type",
  "partytype",
  "customer kind",
  "customer_kind",
  "customer type",
  "customer_type",
  "type klant",
]);
const CONTACT_ALIASES = new Set([
  "contactpersoon",
  "contact persoon",
  "contact person",
  "contact_person",
  "contactperson",
  "contact name",
  "contactnaam",
]);
const STREET_ALIASES = new Set(["straat", "street", "address street", "address_street", "adres"]);
const HOUSE_NUMBER_ALIASES = new Set([
  "huisnummer",
  "huis nr",
  "huisnr",
  "house number",
  "house_number",
  "housenumber",
]);
const HOUSE_SUFFIX_ALIASES = new Set([
  "toevoeging",
  "huisnummer toevoeging",
  "house suffix",
  "house_suffix",
  "suffix",
]);
const POSTAL_ALIASES = new Set(["postcode", "postal code", "postal_code", "zip", "zipcode"]);
const CITY_ALIASES = new Set(["plaats", "stad", "city", "woonplaats"]);
const COUNTRY_ALIASES = new Set(["land", "country", "country code", "country_code"]);
const PASSWORD_ALIASES = new Set([
  "password",
  "wachtwoord",
  "password hash",
  "password_hash",
  "temporary password",
]);

function resolveColumnIndex(
  headers: string[],
  aliases: Set<string>,
  explicitHeader?: string,
): number {
  if (explicitHeader?.trim()) {
    const want = normalizeHeaderKey(explicitHeader);
    return headers.findIndex((h) => normalizeHeaderKey(h) === want);
  }
  return headers.findIndex((h) => aliases.has(normalizeHeaderKey(h)));
}

function parseBool(raw: string, fallback: boolean): boolean {
  const v = raw.trim().toLowerCase();
  if (!v) return fallback;
  if (["1", "true", "yes", "ja", "y", "j"].includes(v)) return true;
  if (["0", "false", "no", "nee", "n"].includes(v)) return false;
  return fallback;
}

function parseStatus(raw: string): CompanyStatus | null {
  const v = raw.trim().toLowerCase();
  if (!v) return "active";
  if (COMPANY_STATUSES.includes(v as CompanyStatus)) return v as CompanyStatus;
  return null;
}

/**
 * Parse bedrijf / particulier (and EN aliases). Empty → company (backward compatible).
 * Invalid non-empty → null.
 */
function parsePartyType(raw: string): CompanyPartyType | null {
  const v = raw.trim().toLowerCase();
  if (!v) return "company";
  if (
    ["company", "bedrijf", "zakelijk", "b2b", "bv", "organisatie", "organization", "organisation"].includes(
      v,
    )
  ) {
    return "company";
  }
  if (
    [
      "private_person",
      "private person",
      "private",
      "particulier",
      "persoon",
      "privé",
      "prive",
      "consument",
      "consumer",
      "individual",
    ].includes(v)
  ) {
    return "private_person";
  }
  return null;
}

function normalizePostalCode(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const compact = v.replace(/\s+/g, "").toUpperCase();
  const nl = compact.match(/^([1-9][0-9]{3})([A-Z]{2})$/);
  if (nl) return `${nl[1]} ${nl[2]}`;
  return v;
}

function normalizeCountry(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return v;
}

function normalizeComparable(row: NormalizedExistingCustomerRow): string {
  return JSON.stringify({
    legalName: row.legalName,
    displayName: row.displayName,
    email: row.email,
    phone: row.phone,
    vatNumber: row.vatNumber,
    kvkNumber: row.kvkNumber,
    contactPersonName: row.contactPersonName,
    addressStreet: row.addressStreet,
    addressHouseNumber: row.addressHouseNumber,
    addressHouseSuffix: row.addressHouseSuffix,
    addressPostalCode: row.addressPostalCode,
    addressCity: row.addressCity,
    addressCountry: row.addressCountry,
    invoiceAllowed: row.invoiceAllowed,
    companyStatus: row.companyStatus,
    partyType: row.partyType,
  });
}

function mirrorToComparable(m: MirrorRow): string {
  return JSON.stringify({
    legalName: m.legal_name.trim(),
    displayName: m.display_name?.trim() || null,
    email: m.email ? normalizeEmail(m.email) : null,
    phone: m.phone?.trim() || null,
    vatNumber: m.vat_number?.trim().toUpperCase() || null,
    kvkNumber: m.kvk_number?.trim() || null,
    contactPersonName: m.contact_person_name?.trim() || null,
    addressStreet: m.address_street?.trim() || null,
    addressHouseNumber: m.address_house_number?.trim() || null,
    addressHouseSuffix: m.address_house_suffix?.trim() || null,
    addressPostalCode: m.address_postal_code?.trim() || null,
    addressCity: m.address_city?.trim() || null,
    addressCountry: m.address_country?.trim() || null,
    invoiceAllowed: Boolean(m.invoice_allowed),
    companyStatus: m.company_status,
    partyType: m.party_type ?? "company",
  });
}

function autoInvitePlanForRow(
  classification: ExistingCustomerImportClassification,
  email: string | null | undefined,
): ExistingCustomerAutoInvitePlan {
  if (classification === "INVALID" || classification === "CONFLICT") {
    return "skipped_not_new";
  }
  return planAutoInviteForClassification({ classification, email });
}

function cell(row: string[], idx: number): string {
  if (idx < 0) return "";
  return (row[idx] ?? "").trim();
}

export function normalizeExistingCustomerRows(
  sheet: ExistingCustomerRawSheet,
  columnMap?: ExistingCustomerColumnMap,
): { rows: ExistingCustomerImportPreviewRow[]; mappingError: string | null } {
  const headers = sheet.headers;
  const idIdx = resolveColumnIndex(headers, EXTERNAL_ID_ALIASES, columnMap?.externalCustomerId);
  const nameIdx = resolveColumnIndex(headers, LEGAL_NAME_ALIASES, columnMap?.legalName);

  if (idIdx < 0 || nameIdx < 0) {
    const missing: string[] = [];
    if (idIdx < 0) missing.push("Klantnummer / Debiteurnummer (external_customer_id)");
    if (nameIdx < 0) missing.push("Bedrijfsnaam (legal_name)");
    return {
      rows: [],
      mappingError: `Verplichte kolommen ontbreken: ${missing.join("; ")}. Map kolommen expliciet of gebruik bekende koppen.`,
    };
  }

  const displayIdx = resolveColumnIndex(headers, DISPLAY_ALIASES, columnMap?.displayName);
  const emailIdx = resolveColumnIndex(headers, EMAIL_ALIASES, columnMap?.email);
  const phoneIdx = resolveColumnIndex(headers, PHONE_ALIASES, columnMap?.phone);
  const vatIdx = resolveColumnIndex(headers, VAT_ALIASES, columnMap?.vatNumber);
  const kvkIdx = resolveColumnIndex(headers, KVK_ALIASES, columnMap?.kvkNumber);
  const invoiceIdx = resolveColumnIndex(headers, INVOICE_ALIASES, columnMap?.invoiceAllowed);
  const statusIdx = resolveColumnIndex(headers, STATUS_ALIASES, columnMap?.companyStatus);
  const partyIdx = resolveColumnIndex(headers, PARTY_TYPE_ALIASES, columnMap?.partyType);
  const contactIdx = resolveColumnIndex(headers, CONTACT_ALIASES, columnMap?.contactPersonName);
  const streetIdx = resolveColumnIndex(headers, STREET_ALIASES, columnMap?.addressStreet);
  const houseNumberIdx = resolveColumnIndex(
    headers,
    HOUSE_NUMBER_ALIASES,
    columnMap?.addressHouseNumber,
  );
  const houseSuffixIdx = resolveColumnIndex(
    headers,
    HOUSE_SUFFIX_ALIASES,
    columnMap?.addressHouseSuffix,
  );
  const postalIdx = resolveColumnIndex(headers, POSTAL_ALIASES, columnMap?.addressPostalCode);
  const cityIdx = resolveColumnIndex(headers, CITY_ALIASES, columnMap?.addressCity);
  const countryIdx = resolveColumnIndex(headers, COUNTRY_ALIASES, columnMap?.addressCountry);

  // Password columns are ignored (never imported).
  for (const h of headers) {
    if (PASSWORD_ALIASES.has(normalizeHeaderKey(h))) {
      /* intentionally ignored */
    }
  }

  const previewRows: ExistingCustomerImportPreviewRow[] = [];
  const seenInFile = new Map<string, { firstRow: number; comparable: string }>();

  for (const raw of sheet.rows) {
    if (previewRows.length >= EXISTING_CUSTOMER_IMPORT_MAX_ROWS) break;
    const sourceRowNumber = raw.sourceRowNumber;
    const externalCustomerId = cell(raw.cells, idIdx);
    const legalName = cell(raw.cells, nameIdx);

    if (!externalCustomerId && !legalName && raw.cells.every((c) => !c.trim())) {
      continue; // blank row
    }

    if (!externalCustomerId) {
      previewRows.push({
        sourceRowNumber,
        externalCustomerId: null,
        companyName: legalName || null,
        classification: "INVALID",
        reason: "Klantnummer / Debiteurnummer is verplicht",
        normalized: null,
        autoInvitePlan: "skipped_not_new",
      });
      continue;
    }

    if (!legalName) {
      previewRows.push({
        sourceRowNumber,
        externalCustomerId,
        companyName: null,
        classification: "INVALID",
        reason: "Bedrijfsnaam / naam is verplicht",
        normalized: null,
        autoInvitePlan: "skipped_not_new",
      });
      continue;
    }

    const partyType = parsePartyType(cell(raw.cells, partyIdx));
    if (partyType === null) {
      previewRows.push({
        sourceRowNumber,
        externalCustomerId,
        companyName: legalName,
        classification: "INVALID",
        reason: "Ongeldige klantsoort (gebruik bedrijf of particulier)",
        normalized: null,
        autoInvitePlan: "skipped_not_new",
      });
      continue;
    }

    const emailRaw = cell(raw.cells, emailIdx);
    let email: string | null = null;
    if (emailRaw) {
      email = normalizeEmail(emailRaw);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        previewRows.push({
          sourceRowNumber,
          externalCustomerId,
          companyName: legalName,
          classification: "INVALID",
          reason: "Ongeldig e-mailadres",
          normalized: null,
          autoInvitePlan: "skipped_not_new",
        });
        continue;
      }
    }

    const kvkNumber = cell(raw.cells, kvkIdx) || null;
    if (kvkNumber && !/^[0-9]{8}$/.test(kvkNumber)) {
      previewRows.push({
        sourceRowNumber,
        externalCustomerId,
        companyName: legalName,
        classification: "INVALID",
        reason: "KVK-nummer moet 8 cijfers zijn",
        normalized: null,
        autoInvitePlan: "skipped_not_new",
      });
      continue;
    }

    const statusRaw = cell(raw.cells, statusIdx);
    const companyStatus = parseStatus(statusRaw);
    if (companyStatus === null) {
      previewRows.push({
        sourceRowNumber,
        externalCustomerId,
        companyName: legalName,
        classification: "INVALID",
        reason: "Ongeldige company status (pending|active|blocked)",
        normalized: null,
        autoInvitePlan: "skipped_not_new",
      });
      continue;
    }

    const vatNumber = cell(raw.cells, vatIdx).toUpperCase() || null;
    const normalized: NormalizedExistingCustomerRow = {
      externalCustomerId,
      legalName,
      displayName: cell(raw.cells, displayIdx) || null,
      email,
      phone: cell(raw.cells, phoneIdx) || null,
      vatNumber,
      kvkNumber,
      contactPersonName: cell(raw.cells, contactIdx) || null,
      addressStreet: cell(raw.cells, streetIdx) || null,
      addressHouseNumber: cell(raw.cells, houseNumberIdx) || null,
      addressHouseSuffix: cell(raw.cells, houseSuffixIdx) || null,
      addressPostalCode: normalizePostalCode(cell(raw.cells, postalIdx)),
      addressCity: cell(raw.cells, cityIdx) || null,
      addressCountry: normalizeCountry(cell(raw.cells, countryIdx)),
      invoiceAllowed: parseBool(cell(raw.cells, invoiceIdx), false),
      companyStatus,
      partyType,
      sourceRowNumber,
    };

    const comparable = normalizeComparable(normalized);
    const prior = seenInFile.get(externalCustomerId);
    if (prior) {
      if (prior.comparable === comparable) {
        previewRows.push({
          sourceRowNumber,
          externalCustomerId,
          companyName: legalName,
          classification: "INVALID",
          reason: `Dubbele rij in bestand (zelfde klantnummer als rij ${prior.firstRow})`,
          normalized: null,
          autoInvitePlan: "skipped_not_new",
        });
      } else {
        previewRows.push({
          sourceRowNumber,
          externalCustomerId,
          companyName: legalName,
          classification: "CONFLICT",
          reason: `Conflicterende dubbele klantnummer in bestand (eerste op rij ${prior.firstRow})`,
          normalized: null,
          autoInvitePlan: "skipped_not_new",
        });
      }
      continue;
    }
    seenInFile.set(externalCustomerId, { firstRow: sourceRowNumber, comparable });

    previewRows.push({
      sourceRowNumber,
      externalCustomerId,
      companyName: legalName,
      classification: "NEW", // provisional — classified against DB below
      reason: null,
      normalized,
      autoInvitePlan: autoInvitePlanForRow("NEW", email),
    });
  }

  return { rows: previewRows, mappingError: null };
}

async function classifyAgainstDatabase(
  rows: ExistingCustomerImportPreviewRow[],
): Promise<ExistingCustomerImportPreviewRow[]> {
  const candidates = rows.filter((r) => r.normalized);
  if (!candidates.length) return rows;

  const ids = [...new Set(candidates.map((r) => r.normalized!.externalCustomerId))];
  const kvks = [
    ...new Set(
      candidates.map((r) => r.normalized!.kvkNumber).filter((k): k is string => Boolean(k)),
    ),
  ];

  const supabase = createSupabaseServiceClient();
  const mirrorById = new Map<string, MirrorRow>();
  const companyByExternal = new Map<string, { id: string; legal_name: string }>();
  const companyByKvk = new Map<string, { id: string; external_customer_id: string | null }>();

  // Batch in chunks of 200
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data: mirrors, error } = await supabase
      .from("commerce_legacy_service_clients")
      .select(
        "external_customer_id, legal_name, display_name, kvk_number, vat_number, email, phone, contact_person_name, address_street, address_house_number, address_house_suffix, address_postal_code, address_city, address_country, invoice_allowed, company_status, party_type",
      )
      .in("external_customer_id", chunk);
    if (error) throw new Error(`mirror lookup failed: ${error.message}`);
    for (const m of mirrors ?? []) {
      mirrorById.set(String(m.external_customer_id), m as MirrorRow);
    }

    const { data: companies, error: cErr } = await supabase
      .from("companies")
      .select("id, legal_name, external_customer_id")
      .in("external_customer_id", chunk);
    if (cErr) throw new Error(`company lookup failed: ${cErr.message}`);
    for (const c of companies ?? []) {
      if (c.external_customer_id) {
        companyByExternal.set(String(c.external_customer_id), {
          id: String(c.id),
          legal_name: String(c.legal_name),
        });
      }
    }
  }

  for (let i = 0; i < kvks.length; i += 200) {
    const chunk = kvks.slice(i, i + 200);
    const { data: byKvk, error } = await supabase
      .from("companies")
      .select("id, external_customer_id, kvk_number")
      .in("kvk_number", chunk);
    if (error) throw new Error(`kvk lookup failed: ${error.message}`);
    for (const c of byKvk ?? []) {
      if (c.kvk_number) {
        companyByKvk.set(String(c.kvk_number), {
          id: String(c.id),
          external_customer_id: c.external_customer_id ? String(c.external_customer_id) : null,
        });
      }
    }
  }

  return rows.map((row) => {
    if (!row.normalized) return row;
    const n = row.normalized;
    const id = n.externalCustomerId;

    if (n.kvkNumber) {
      const kvkHit = companyByKvk.get(n.kvkNumber);
      if (kvkHit && kvkHit.external_customer_id && kvkHit.external_customer_id !== id) {
        return {
          ...row,
          classification: "CONFLICT" as const,
          reason: `KVK ${n.kvkNumber} hoort al bij een ander klantnummer (${kvkHit.external_customer_id})`,
          normalized: null,
          autoInvitePlan: "skipped_not_new" as const,
        };
      }
      if (kvkHit && !kvkHit.external_customer_id) {
        return {
          ...row,
          classification: "CONFLICT" as const,
          reason: `KVK ${n.kvkNumber} bestaat al op een bedrijf zonder dit klantnummer — handmatige interventie vereist`,
          normalized: null,
          autoInvitePlan: "skipped_not_new" as const,
        };
      }
    }

    const mirror = mirrorById.get(id);
    if (!mirror) {
      const classification = "NEW" as const;
      return {
        ...row,
        classification,
        reason: null,
        autoInvitePlan: autoInvitePlanForRow(classification, n.email),
      };
    }

    if (mirrorToComparable(mirror) === normalizeComparable(n)) {
      const classification = "UNCHANGED" as const;
      return {
        ...row,
        classification,
        reason: null,
        autoInvitePlan: autoInvitePlanForRow(classification, n.email),
      };
    }

    const classification = "UPDATE" as const;
    return {
      ...row,
      classification,
      reason: "Bestaande bronwaarden wijzigen",
      autoInvitePlan: autoInvitePlanForRow(classification, n.email),
    };
  });
}

function summarize(rows: ExistingCustomerImportPreviewRow[]) {
  const counts = { new: 0, update: 0, unchanged: 0, invalid: 0, conflict: 0 };
  const inviteCounts = { willInvite: 0, missingEmail: 0, skippedNotNew: 0 };
  for (const r of rows) {
    if (r.classification === "NEW") counts.new += 1;
    else if (r.classification === "UPDATE") counts.update += 1;
    else if (r.classification === "UNCHANGED") counts.unchanged += 1;
    else if (r.classification === "INVALID") counts.invalid += 1;
    else if (r.classification === "CONFLICT") counts.conflict += 1;

    if (r.autoInvitePlan === "will_invite") inviteCounts.willInvite += 1;
    else if (r.autoInvitePlan === "missing_email") inviteCounts.missingEmail += 1;
    else inviteCounts.skippedNotNew += 1;
  }
  return { counts, inviteCounts };
}

export async function previewExistingCustomerImport(input: {
  fileName: string;
  bytes: Uint8Array | Buffer;
  columnMap?: ExistingCustomerColumnMap;
  sheetName?: string;
}): Promise<ExistingCustomerImportPreview | ExistingCustomerImportError> {
  if (input.bytes.byteLength > EXISTING_CUSTOMER_IMPORT_MAX_BYTES) {
    return {
      ok: false,
      error: `Bestand te groot (max ${EXISTING_CUSTOMER_IMPORT_MAX_BYTES} bytes).`,
      code: "limit",
    };
  }

  let sheet: ExistingCustomerRawSheet;
  try {
    sheet = await parseExistingCustomerSpreadsheet({
      fileName: input.fileName,
      bytes: input.bytes,
      sheetName: input.sheetName,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Bestand kon niet worden gelezen.",
      code: "parse",
    };
  }

  const { rows: provisional, mappingError } = normalizeExistingCustomerRows(sheet, input.columnMap);
  if (mappingError) {
    return { ok: false, error: mappingError, code: "validation" };
  }

  let rows: ExistingCustomerImportPreviewRow[];
  try {
    rows = await classifyAgainstDatabase(provisional);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Classificatie mislukt.",
      code: "persist",
    };
  }

  const { counts, inviteCounts } = summarize(rows);
  return {
    fileName: input.fileName,
    sheetName: sheet.sheetName,
    headers: sheet.headers,
    sheetNames: sheet.sheetNames,
    totalRows: rows.length,
    counts,
    inviteCounts,
    rows,
    importableCount: counts.new + counts.update,
  };
}

export async function commitExistingCustomerImport(input: {
  fileName: string;
  bytes: Uint8Array | Buffer;
  columnMap?: ExistingCustomerColumnMap;
  sheetName?: string;
  actorUserId: string;
}): Promise<ExistingCustomerImportCommitResult | ExistingCustomerImportError> {
  const preview = await previewExistingCustomerImport(input);
  if ("ok" in preview && preview.ok === false) return preview;

  const p = preview as ExistingCustomerImportPreview;
  const toWrite = p.rows.filter(
    (r) => (r.classification === "NEW" || r.classification === "UPDATE") && r.normalized,
  );

  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();
  let mirrored = 0;

  try {
    for (let i = 0; i < toWrite.length; i += 100) {
      const chunk = toWrite.slice(i, i + 100).map((r) => {
        const n = r.normalized!;
        return {
          external_customer_id: n.externalCustomerId,
          legal_name: n.legalName,
          display_name: n.displayName,
          kvk_number: n.kvkNumber,
          vat_number: n.vatNumber,
          email: n.email,
          phone: n.phone,
          contact_person_name: n.contactPersonName,
          address_street: n.addressStreet,
          address_house_number: n.addressHouseNumber,
          address_house_suffix: n.addressHouseSuffix,
          address_postal_code: n.addressPostalCode,
          address_city: n.addressCity,
          address_country: n.addressCountry,
          invoice_allowed: n.invoiceAllowed,
          company_status: n.companyStatus,
          party_type: n.partyType,
          source_updated_at: now,
        };
      });
      const { error } = await supabase.from("commerce_legacy_service_clients").upsert(chunk, {
        onConflict: "external_customer_id",
      });
      if (error) {
        await writeStaffAudit({
          actorUserId: input.actorUserId,
          action: "commerce.existing_customer_import_failed",
          targetType: "commerce_legacy_service_clients",
          targetId: null,
          after: {
            fileName: input.fileName,
            error: error.message,
            counts: p.counts,
          },
        }).catch(() => undefined);
        return { ok: false, error: `Import mislukt: ${error.message}`, code: "persist" };
      }
      mirrored += chunk.length;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Import mislukt: ${message}`, code: "persist" };
  }

  const externalIds = toWrite.map((r) => r.normalized!.externalCustomerId);
  const sync =
    externalIds.length > 0
      ? await syncExistingServiceClients({
          actorUserId: input.actorUserId,
          externalCustomerIds: externalIds,
        })
      : { created: 0, updated: 0, skipped: 0 };

  const inviteCandidates = p.rows
    .filter((r) => r.classification === "NEW" && r.normalized)
    .map((r) => ({
      externalCustomerId: r.normalized!.externalCustomerId,
      email: r.normalized!.email,
      contactPersonName: r.normalized!.contactPersonName,
      classification: r.classification,
    }));

  const invites = await autoInviteNewImportedCompanies({
    actorUserId: input.actorUserId,
    candidates: inviteCandidates,
  });

  await writeStaffAudit({
    actorUserId: input.actorUserId,
    action: "commerce.existing_customer_import_completed",
    targetType: "commerce_legacy_service_clients",
    targetId: null,
    after: {
      fileName: input.fileName,
      totalRows: p.totalRows,
      counts: p.counts,
      inviteCounts: p.inviteCounts,
      mirrored,
      sync,
      invites: {
        sent: invites.sent,
        skipped: invites.skipped,
        failed: invites.failed,
      },
    },
  });

  return {
    ok: true,
    fileName: input.fileName,
    mirrored,
    unchanged: p.counts.unchanged,
    skippedInvalid: p.counts.invalid,
    skippedConflict: p.counts.conflict,
    sync,
    invites,
  };
}

/**
 * Operator-fillable CSV template for existing service-client import.
 * Klantsoort: bedrijf | particulier (required for correct classification).
 * For particulier, Bedrijfsnaam = full person name; KVK/BTW usually empty.
 */
export const EXISTING_CUSTOMER_IMPORT_TEMPLATE_CSV = `\uFEFFKlantnummer,Klantsoort,Bedrijfsnaam,Handelsnaam,E-mail,Telefoon,Contactpersoon,KVK,BTW,Straat,Huisnummer,Toevoeging,Postcode,Plaats,Land,Factuur toegestaan
10482,bedrijf,ABC Facility BV,ABC Facility,info@abc.example,0612345678,Jan de Vries,12345678,NL123456789B01,Hoofdstraat,12,a,1234 AB,Amsterdam,NL,nee
10483,particulier,Maria Jansen,,maria@example.com,0687654321,,,,,,,Hoofdstraat,1,,1000 AA,Amsterdam,NL,nee
`;

export type { ExistingCustomerColumnMap };
export type {
  ExistingCustomerAutoInvitePlan,
  ExistingCustomerAutoInviteSummary,
} from "./existing-customer-import-invites";
export { splitContactPersonName } from "./existing-customer-import-invites";
