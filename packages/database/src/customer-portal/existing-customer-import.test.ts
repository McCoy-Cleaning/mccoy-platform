import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import {
  detectExistingCustomerImportKind,
  parseExistingCustomerCsv,
  parseExistingCustomerSpreadsheet,
  parseExistingCustomerXlsx,
} from "./existing-customer-import-parse";
import { normalizeExistingCustomerRows } from "./existing-customer-import";
import { splitContactPersonName } from "./existing-customer-import-invites";

describe("existing-customer-import parse", () => {
  it("detects csv and xlsx by extension", () => {
    expect(detectExistingCustomerImportKind("klanten.csv")).toBe("csv");
    expect(detectExistingCustomerImportKind("klanten.XLSX")).toBe("xlsx");
    expect(detectExistingCustomerImportKind("legacy.xls")).toBe("unsupported");
  });

  it("parses UTF-8 BOM, quoted commas, and blank rows", () => {
    const csv =
      "\uFEFFKlantnummer,Bedrijfsnaam,Email\n" +
      '10482,"ABC Facility, BV",info@abc.example\n' +
      "\n" +
      "10483,Delta Cleaning,delta@example.com\n";
    const sheet = parseExistingCustomerCsv(csv);
    expect(sheet.headers[0]).toBe("Klantnummer");
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0]!.cells[1]).toBe("ABC Facility, BV");
  });

  it("parses semicolon-delimited Dutch exports", () => {
    const csv =
      "Debiteurnummer;Bedrijfsnaam;E-mail\n" +
      "2001;Northstar Offices;ns@example.com\n";
    const sheet = parseExistingCustomerCsv(csv);
    expect(sheet.headers).toEqual(["Debiteurnummer", "Bedrijfsnaam", "E-mail"]);
    expect(sheet.rows[0]!.cells[0]).toBe("2001");
  });

  it("classifies missing ID as INVALID and in-file conflicts", () => {
    const sheet = parseExistingCustomerCsv(
      [
        "Klantnummer,Bedrijfsnaam,Email",
        ",ABC Facility,a@example.com",
        "10482,ABC Facility,a@example.com",
        "10482,Other Name,b@example.com",
        "10482,ABC Facility,a@example.com",
      ].join("\n"),
    );
    const { rows, mappingError } = normalizeExistingCustomerRows(sheet);
    expect(mappingError).toBeNull();
    expect(rows[0]!.classification).toBe("INVALID");
    expect(rows[0]!.reason).toMatch(/Klantnummer/);
    expect(rows[1]!.classification).toBe("NEW");
    expect(rows[2]!.classification).toBe("CONFLICT");
    expect(rows[3]!.classification).toBe("INVALID");
  });

  it("fails clearly when required columns cannot be resolved", () => {
    const sheet = parseExistingCustomerCsv("Foo,Bar\n1,2\n");
    const { mappingError } = normalizeExistingCustomerRows(sheet);
    expect(mappingError).toMatch(/Verplichte kolommen/);
  });

  it("supports explicit column mapping for unknown headings", () => {
    const sheet = parseExistingCustomerCsv(
      "Debiteurnr,Naam klant,Mail\n9001,Mapped Co,map@example.com\n",
    );
    const { rows, mappingError } = normalizeExistingCustomerRows(sheet, {
      externalCustomerId: "Debiteurnr",
      legalName: "Naam klant",
      email: "Mail",
    });
    expect(mappingError).toBeNull();
    expect(rows[0]!.normalized?.externalCustomerId).toBe("9001");
    expect(rows[0]!.normalized?.legalName).toBe("Mapped Co");
    expect(rows[0]!.normalized?.email).toBe("map@example.com");
  });

  it("parses Klantsoort bedrijf vs particulier", () => {
    const sheet = parseExistingCustomerCsv(
      [
        "Klantnummer,Bedrijfsnaam,Klantsoort,Email",
        "10482,ABC Facility BV,bedrijf,a@example.com",
        "10483,Maria Jansen,particulier,m@example.com",
        "10484,Default Co,,d@example.com",
        "10485,Bad Co,franchise,b@example.com",
      ].join("\n"),
    );
    const { rows, mappingError } = normalizeExistingCustomerRows(sheet);
    expect(mappingError).toBeNull();
    expect(rows[0]!.normalized?.partyType).toBe("company");
    expect(rows[1]!.normalized?.partyType).toBe("private_person");
    expect(rows[2]!.normalized?.partyType).toBe("company");
    expect(rows[3]!.classification).toBe("INVALID");
    expect(rows[3]!.reason).toMatch(/klantsoort/i);
  });

  it("parses contact person, address columns, and plans auto-invite", () => {
    const sheet = parseExistingCustomerCsv(
      [
        "Klantnummer,Bedrijfsnaam,Email,Contactpersoon,Straat,Huisnummer,Toevoeging,Postcode,Plaats,Land",
        "10482,ABC Facility,info@abc.example,Jan de Vries,Hoofdstraat,12,a,1234AB,Amsterdam,nl",
        "10483,No Email Co,,,,,,,,",
      ].join("\n"),
    );
    const { rows, mappingError } = normalizeExistingCustomerRows(sheet);
    expect(mappingError).toBeNull();
    expect(rows[0]!.normalized?.contactPersonName).toBe("Jan de Vries");
    expect(rows[0]!.normalized?.addressStreet).toBe("Hoofdstraat");
    expect(rows[0]!.normalized?.addressHouseNumber).toBe("12");
    expect(rows[0]!.normalized?.addressHouseSuffix).toBe("a");
    expect(rows[0]!.normalized?.addressPostalCode).toBe("1234 AB");
    expect(rows[0]!.normalized?.addressCity).toBe("Amsterdam");
    expect(rows[0]!.normalized?.addressCountry).toBe("NL");
    expect(rows[0]!.autoInvitePlan).toBe("will_invite");
    expect(rows[1]!.autoInvitePlan).toBe("missing_email");
  });

  it("ignores password columns and rejects bad KVK", () => {
    const sheet = parseExistingCustomerCsv(
      "Klantnummer,Bedrijfsnaam,password,kvk\n1,Safe Co,secret,123\n",
    );
    const { rows } = normalizeExistingCustomerRows(sheet);
    expect(rows[0]!.classification).toBe("INVALID");
    expect(rows[0]!.reason).toMatch(/KVK/);
  });

  it("parses XLSX first sheet and refuses empty workbook", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Klanten");
    ws.addRow(["Klantnummer", "Bedrijfsnaam", "Email"]);
    ws.addRow(["10482", "ABC Facility", "abc@example.com"]);
    ws.addRow(["10490", "Delta Cleaning Services Client", "delta@example.com"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const sheet = await parseExistingCustomerXlsx({ bytes: buf });
    expect(sheet.sheetName).toBe("Klanten");
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0]!.cells[0]).toBe("10482");

    const empty = new ExcelJS.Workbook();
    empty.addWorksheet("Leeg");
    const emptyBuf = Buffer.from(await empty.xlsx.writeBuffer());
    await expect(parseExistingCustomerXlsx({ bytes: emptyBuf })).rejects.toThrow(/leeg/i);
  });

  it("rejects unsupported extensions through spreadsheet entry", async () => {
    await expect(
      parseExistingCustomerSpreadsheet({
        fileName: "legacy.xls",
        bytes: Buffer.from("not-a-real-file"),
      }),
    ).rejects.toThrow(/csv of \.xlsx/i);
  });
});

describe("splitContactPersonName", () => {
  it("splits first and remaining name parts", () => {
    expect(splitContactPersonName("Jan")).toEqual({ firstName: "Jan", lastName: null });
    expect(splitContactPersonName("Jan de Vries")).toEqual({
      firstName: "Jan",
      lastName: "de Vries",
    });
    expect(splitContactPersonName("  ")).toEqual({ firstName: null, lastName: null });
  });
});
