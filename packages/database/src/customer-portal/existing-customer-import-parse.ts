/**
 * CSV / XLSX parsers for existing-customer import.
 * Business rules live in existing-customer-import.ts — only parsing differs here.
 */

import ExcelJS from "exceljs";

export const EXISTING_CUSTOMER_IMPORT_MAX_BYTES = 2_000_000;
export const EXISTING_CUSTOMER_IMPORT_MAX_ROWS = 5_000;
export const EXISTING_CUSTOMER_IMPORT_MAX_SHEETS = 10;

export type ExistingCustomerColumnMap = {
  externalCustomerId?: string;
  legalName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  vatNumber?: string;
  kvkNumber?: string;
  invoiceAllowed?: string;
  companyStatus?: string;
  partyType?: string;
  contactPersonName?: string;
  addressStreet?: string;
  addressHouseNumber?: string;
  addressHouseSuffix?: string;
  addressPostalCode?: string;
  addressCity?: string;
  addressCountry?: string;
};

export type ExistingCustomerRawRow = {
  sourceRowNumber: number;
  cells: string[];
};

export type ExistingCustomerRawSheet = {
  sheetName: string;
  sheetNames: string[];
  headers: string[];
  rows: ExistingCustomerRawRow[];
};

function detectDelimiter(headerLine: string): "," | ";" {
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

export function splitDelimitedLine(line: string, delimiter: "," | ";"): string[] {
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

export function parseExistingCustomerCsv(text: string): ExistingCustomerRawSheet {
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/);
  const nonEmpty = lines
    .map((l, idx) => ({ line: l, sourceRowNumber: idx + 1 }))
    .filter((x) => x.line.trim().length > 0);
  if (!nonEmpty.length) {
    throw new Error("CSV is leeg.");
  }

  const delimiter = detectDelimiter(nonEmpty[0]!.line);
  const headers = splitDelimitedLine(nonEmpty[0]!.line, delimiter).map((h) => h.trim());
  if (!headers.some((h) => h.length > 0)) {
    throw new Error("CSV heeft geen kolomkoppen.");
  }

  const rows: ExistingCustomerRawRow[] = [];
  for (let i = 1; i < nonEmpty.length && rows.length < EXISTING_CUSTOMER_IMPORT_MAX_ROWS; i += 1) {
    const entry = nonEmpty[i]!;
    const cells = splitDelimitedLine(entry.line, delimiter).map((c) => c.trim());
    rows.push({ sourceRowNumber: entry.sourceRowNumber, cells });
  }

  return {
    sheetName: "CSV",
    sheetNames: ["CSV"],
    headers,
    rows,
  };
}

function excelCellToString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && value.text != null) return String(value.text).trim();
    if ("result" in value && value.result != null) {
      return excelCellToString(value.result as ExcelJS.CellValue);
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((p) => p.text).join("").trim();
    }
  }
  return String(value).trim();
}

export async function parseExistingCustomerXlsx(input: {
  bytes: Uint8Array | Buffer;
  sheetName?: string;
}): Promise<ExistingCustomerRawSheet> {
  const workbook = new ExcelJS.Workbook();
  // exceljs reads values only — formulas are not evaluated as executable code.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(input.bytes as any);

  const sheetNames = workbook.worksheets.map((ws) => ws.name).slice(0, EXISTING_CUSTOMER_IMPORT_MAX_SHEETS);
  if (!sheetNames.length) {
    throw new Error("Werkboek bevat geen werkbladen.");
  }

  let worksheet = workbook.worksheets[0]!;
  if (input.sheetName?.trim()) {
    const found = workbook.worksheets.find((ws) => ws.name === input.sheetName!.trim());
    if (!found) {
      throw new Error(
        `Werkblad "${input.sheetName}" niet gevonden. Beschikbaar: ${sheetNames.join(", ")}.`,
      );
    }
    worksheet = found;
  }

  const matrix: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (matrix.length > EXISTING_CUSTOMER_IMPORT_MAX_ROWS + 1) return;
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = excelCellToString(cell.value);
    });
    // normalize sparse array
    const width = Math.max(values.length, ...(matrix[0] ? [matrix[0].length] : [0]));
    for (let i = 0; i < width; i += 1) {
      if (values[i] == null) values[i] = "";
    }
    matrix.push(values);
    void rowNumber;
  });

  if (!matrix.length) {
    throw new Error("Geselecteerd werkblad is leeg.");
  }

  const headers = matrix[0]!.map((h) => h.trim());
  if (!headers.some((h) => h.length > 0)) {
    throw new Error("Werkblad heeft geen kolomkoppen.");
  }

  const rows: ExistingCustomerRawRow[] = [];
  for (let i = 1; i < matrix.length && rows.length < EXISTING_CUSTOMER_IMPORT_MAX_ROWS; i += 1) {
    rows.push({
      sourceRowNumber: i + 1,
      cells: matrix[i]!.map((c) => c.trim()),
    });
  }

  return {
    sheetName: worksheet.name,
    sheetNames,
    headers,
    rows,
  };
}

export function detectExistingCustomerImportKind(
  fileName: string,
): "csv" | "xlsx" | "unsupported" {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return "csv";
  if (lower.endsWith(".xlsx")) return "xlsx";
  return "unsupported";
}

export async function parseExistingCustomerSpreadsheet(input: {
  fileName: string;
  bytes: Uint8Array | Buffer;
  sheetName?: string;
}): Promise<ExistingCustomerRawSheet> {
  const kind = detectExistingCustomerImportKind(input.fileName);
  if (kind === "unsupported") {
    throw new Error("Alleen .csv of .xlsx wordt ondersteund.");
  }
  if (input.bytes.byteLength === 0) {
    throw new Error("Bestand is leeg.");
  }
  if (input.bytes.byteLength > EXISTING_CUSTOMER_IMPORT_MAX_BYTES) {
    throw new Error(`Bestand te groot (max ${EXISTING_CUSTOMER_IMPORT_MAX_BYTES} bytes).`);
  }

  if (kind === "csv") {
    const text = Buffer.from(input.bytes).toString("utf8");
    return parseExistingCustomerCsv(text);
  }

  return parseExistingCustomerXlsx({ bytes: input.bytes, sheetName: input.sheetName });
}
