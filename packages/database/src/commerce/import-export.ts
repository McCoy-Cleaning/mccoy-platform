import {
  buildCsvRow,
  normalizeEmail,
} from "@mccoy/domain";

import {
  listGuestPurchasers,
  listRegisteredCustomers,
  type CustomerListQuery,
  type GuestCustomerListItem,
  type RegisteredCustomerListItem,
} from "./core";
import { inviteRegisteredCustomer } from "./conversion";

export async function exportCustomersCsv(input: {
  population: "registered" | "guests";
  query?: CustomerListQuery;
}): Promise<string> {
  const query = { ...(input.query ?? {}), page: 1, pageSize: 100 };
  const header =
    input.population === "registered"
      ? buildCsvRow([
          "id",
          "email",
          "full_name",
          "phone",
          "status",
          "company",
          "order_count",
          "total_spend_eur",
          "last_order_at",
          "created_at",
        ])
      : buildCsvRow([
          "id",
          "email",
          "full_name",
          "company_name",
          "phone",
          "order_count",
          "total_spend_eur",
          "first_order_at",
          "last_order_at",
          "conversion_status",
        ]);

  const rows: string[] = [header];
  let page = 1;
  let total = Infinity;
  while ((page - 1) * 100 < total && page <= 50) {
    if (input.population === "registered") {
      const result = await listRegisteredCustomers({ ...query, page, pageSize: 100 });
      total = result.total;
      for (const item of result.items) {
        rows.push(registeredCsvRow(item));
      }
    } else {
      const result = await listGuestPurchasers({ ...query, page, pageSize: 100 });
      total = result.total;
      for (const item of result.items) {
        rows.push(guestCsvRow(item));
      }
    }
    page += 1;
  }
  return `\uFEFF${rows.join("\n")}\n`;
}

function registeredCsvRow(item: RegisteredCustomerListItem): string {
  return buildCsvRow([
    item.id,
    item.email,
    item.fullName,
    item.phone,
    item.status,
    item.companyName,
    item.orderCount,
    (item.totalSpendMinor / 100).toFixed(2),
    item.lastOrderAt,
    item.createdAt,
  ]);
}

function guestCsvRow(item: GuestCustomerListItem): string {
  return buildCsvRow([
    item.id,
    item.email,
    item.fullName,
    item.companyName,
    item.phone,
    item.orderCount,
    (item.totalSpendMinor / 100).toFixed(2),
    item.firstOrderAt,
    item.lastOrderAt,
    item.conversionStatus,
  ]);
}

export type CustomerImportRow = {
  line: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  companyLegalName: string;
  errors: string[];
};

export type CustomerImportPreview = {
  rows: CustomerImportRow[];
  validCount: number;
  errorCount: number;
};

/** Parse CSV for customer CRM import (does not create Auth until commit).
 * Canonical headers map to DB fields:
 *   email → users.email
 *   full_name → users.full_name
 *   phone → users.phone
 *   company → companies.legal_name
 */
export function parseCustomerImportCsv(csvText: string): CustomerImportPreview {
  const cleaned = csvText.replace(/^\uFEFF/, "");
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { rows: [], validCount: 0, errorCount: 0 };
  }

  const delimiter = detectCsvDelimiter(lines[0]!);
  const headerCells = splitCsvLine(lines[0]!, delimiter).map((h) => normalizeImportHeader(h));
  const emailIdx = findImportColumn(headerCells, ["email", "e-mail", "e mail", "emailadres", "e-mailadres"]);
  const nameIdx = findImportColumn(headerCells, [
    "full_name",
    "fullname",
    "naam",
    "full name",
    "contactpersoon",
  ]);
  const phoneIdx = findImportColumn(headerCells, ["phone", "telefoon", "telefoonnummer", "tel"]);
  const companyIdx = findImportColumn(headerCells, [
    "company",
    "company_legal_name",
    "legal_name",
    "bedrijfsnaam",
    "company_name",
  ]);

  if (emailIdx < 0 || companyIdx < 0) {
    const missing: string[] = [];
    if (emailIdx < 0) missing.push("email");
    if (companyIdx < 0) missing.push("company");
    return {
      rows: [
        {
          line: 1,
          email: "",
          fullName: null,
          phone: null,
          companyLegalName: "",
          errors: [
            `Verplichte kolommen ontbreken: ${missing.join(", ")}. Gebruik: email, full_name, phone, company.`,
          ],
        },
      ],
      validCount: 0,
      errorCount: 1,
    };
  }

  const rows: CustomerImportRow[] = [];
  for (let i = 1; i < lines.length && i <= 500; i += 1) {
    const cells = splitCsvLine(lines[i]!, delimiter);
    const errors: string[] = [];
    const emailRaw = cells[emailIdx] ?? "";
    const email = normalizeEmail(emailRaw);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Ongeldig e-mailadres");
    }
    const fullName = nameIdx >= 0 ? cells[nameIdx]?.trim() || null : null;
    const phone = phoneIdx >= 0 ? cells[phoneIdx]?.trim() || null : null;
    const companyLegalName = (cells[companyIdx] ?? "").trim();
    if (!companyLegalName) errors.push("Bedrijfsnaam ontbreekt (company → companies.legal_name)");
    if (fullName && /<script/i.test(fullName)) errors.push("Ongeldige naam");
    rows.push({
      line: i + 1,
      email,
      fullName,
      phone,
      companyLegalName,
      errors,
    });
  }

  return {
    rows,
    validCount: rows.filter((r) => r.errors.length === 0).length,
    errorCount: rows.filter((r) => r.errors.length > 0).length,
  };
}

function normalizeImportHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function findImportColumn(headers: string[], aliases: string[]): number {
  const normalizedAliases = aliases.map((a) => normalizeImportHeader(a));
  return headers.findIndex((h) => normalizedAliases.includes(h));
}

function detectCsvDelimiter(headerLine: string): "," | ";" {
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  for (let i = 0; i < headerLine.length; i += 1) {
    const ch = headerLine[i]!;
    if (ch === '"') {
      if (inQuotes && headerLine[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === ",") commas += 1;
    if (ch === ";") semis += 1;
  }
  return semis > commas ? ";" : ",";
}

export function importCustomersPreview(csvText: string): CustomerImportPreview {
  return parseCustomerImportCsv(csvText);
}

/** Commit valid import rows as Auth invites + companies (no passwords). */
export async function commitCustomerImport(input: {
  csvText: string;
  actorUserId: string;
}): Promise<{ invited: number; skipped: number; errors: string[] }> {
  const preview = parseCustomerImportCsv(input.csvText);
  let invited = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const row of preview.rows) {
    if (row.errors.length) {
      skipped += 1;
      continue;
    }
    const result = await inviteRegisteredCustomer({
      email: row.email,
      fullName: row.fullName,
      phone: row.phone,
      companyLegalName: row.companyLegalName,
      actorUserId: input.actorUserId,
    });
    if (result.ok) {
      if (result.mode === "invited") invited += 1;
      else skipped += 1;
    } else {
      errors.push(`Regel ${row.line}: ${result.error}`);
      skipped += 1;
    }
  }
  return { invited, skipped, errors };
}

function splitCsvLine(line: string, delimiter: "," | ";" = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
