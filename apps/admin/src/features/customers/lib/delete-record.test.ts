import { describe, expect, it } from "vitest";

import {
  DELETE_RECORD_LABEL,
  deleteRecordConfirmCopy,
  deleteRecordRequest,
  deleteRecordSuccessMessage,
  interpretDeleteRecordResult,
  mapDeleteRecordError,
  nextDirectorySelectionAfterDelete,
} from "./delete-record";

describe("delete record mapper", () => {
  it("uses admin delete copy and that row's company id", () => {
    expect(DELETE_RECORD_LABEL).toBe("Record verwijderen");
    const companyId = "22222222-2222-4222-8222-222222222222";
    expect(deleteRecordRequest(companyId)).toEqual({ companyIds: [companyId] });

    const copy = deleteRecordConfirmCopy("Fixture Collision BV");
    expect(copy.title).toBe("Record verwijderen?");
    expect(copy.confirmLabel).toBe("Verwijderen");
    expect(copy.cancelLabel).toBe("Annuleren");
    expect(copy.description).toContain("Fixture Collision BV");
    expect(copy.description).toMatch(/niet ongedaan/i);
    expect(copy.description).toMatch(/zonder orders/i);
    expect(copy.description).toMatch(/orderhistorie blijft bewaard/i);
    expect(deleteRecordSuccessMessage("ABC Facility")).toContain("ABC Facility");
  });

  it("maps known failure codes without leaking internals", () => {
    expect(mapDeleteRecordError({ code: "has_orders" })).toMatch(/orders/i);
    expect(mapDeleteRecordError({ code: "not_service_client" })).toMatch(/serviceklanten/i);
    expect(mapDeleteRecordError({ code: "not_found" })).toBe("Bedrijf niet gevonden.");
    expect(
      mapDeleteRecordError({
        code: "persist",
        error: "Pas migratie 20260830180000_delete_portal_service_company_rpc.sql toe. Error: stack",
      }),
    ).toBe("Verwijderen mislukt. Probeer het opnieuw.");
    expect(mapDeleteRecordError({ error: "Niet geautoriseerd. Log opnieuw in." })).toMatch(
      /toestemming/i,
    );
    expect(mapDeleteRecordError({ error: "Error: at Object.delete (vm.js:1:1)" })).not.toMatch(
      /vm\.js|stack/i,
    );
  });

  it("interprets the staff deleteAdminPortalCompanies payload", () => {
    const companyId = "11111111-1111-4111-8111-111111111111";
    expect(
      interpretDeleteRecordResult({
        ok: true,
        deleted: 1,
        failed: 0,
        results: [{ ok: true, companyId, legalName: "ABC Facility BV" }],
      }),
    ).toEqual({ ok: true, legalName: "ABC Facility BV" });

    expect(
      interpretDeleteRecordResult({
        ok: true,
        deleted: 0,
        failed: 1,
        results: [
          {
            ok: false,
            companyId,
            error: "Bedrijf heeft orders — verwijderen geblokkeerd om orderhistorie te bewaren.",
            code: "has_orders",
          },
        ],
      }),
    ).toEqual({
      ok: false,
      message: mapDeleteRecordError({ code: "has_orders" }),
    });

    expect(interpretDeleteRecordResult({ ok: false, error: "Niet geautoriseerd." })).toEqual({
      ok: false,
      message: mapDeleteRecordError({ error: "Niet geautoriseerd." }),
    });
  });

  it("selects another remaining row after the deleted company", () => {
    const items = [
      { companyId: "11111111-1111-4111-8111-111111111111" },
      { companyId: "22222222-2222-4222-8222-222222222222" },
      { companyId: "33333333-3333-4333-8333-333333333333" },
    ];
    expect(
      nextDirectorySelectionAfterDelete(items, items[1]!.companyId, items[1]!.companyId)?.companyId,
    ).toBe(items[2]!.companyId);
    expect(
      nextDirectorySelectionAfterDelete(items, items[0]!.companyId, items[2]!.companyId)?.companyId,
    ).toBe(items[2]!.companyId);
    expect(nextDirectorySelectionAfterDelete([items[0]!], items[0]!.companyId, items[0]!.companyId)).toBeNull();
  });
});
