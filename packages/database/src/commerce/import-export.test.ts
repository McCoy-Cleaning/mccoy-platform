import { describe, expect, it } from "vitest";
import { parseCustomerImportCsv } from "./import-export";

describe("parseCustomerImportCsv", () => {
  it("validates rows and rejects scripty names", () => {
    const preview = parseCustomerImportCsv(
      [
        "email,full_name,phone,company",
        "ada@example.com,Ada Lovelace,0612345678,Ada BV",
        "bad,,,",
        'x@y.com,<script>alert(1)</script>,,Evil',
      ].join("\n"),
    );
    expect(preview.validCount).toBe(1);
    expect(preview.errorCount).toBe(2);
  });

  it("accepts formula-looking company as text (escaped later on export)", () => {
    const preview = parseCustomerImportCsv("email,company\nsafe@example.com,=CMD()\n");
    expect(preview.validCount).toBe(1);
    expect(preview.rows[0]?.companyLegalName).toBe("=CMD()");
  });
});
