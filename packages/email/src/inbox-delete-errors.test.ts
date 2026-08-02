import { describe, expect, it } from "vitest";

import { bulkDeleteFailureMessage } from "./inbox-delete-errors";

describe("bulkDeleteFailureMessage", () => {
  const permissionError =
    "Microsoft Graph toegang geweigerd (ErrorAccessDenied). Verwijderen uit Aanvragen vereist Mail.ReadWrite.";

  it("returns the single failure message for one item", () => {
    expect(
      bulkDeleteFailureMessage(0, [{ id: "graph:a", error: permissionError }]),
    ).toBe(permissionError);
  });

  it("returns the shared error when all bulk failures match", () => {
    expect(
      bulkDeleteFailureMessage(0, [
        { id: "graph:a", error: permissionError },
        { id: "graph:b", error: permissionError },
        { id: "graph:c", error: permissionError },
      ]),
    ).toBe(permissionError);
  });

  it("summarizes multiple distinct errors", () => {
    const msg = bulkDeleteFailureMessage(0, [
      { id: "graph:a", error: "Eerste fout." },
      { id: "graph:b", error: "Tweede fout." },
      { id: "graph:c", error: "Derde fout." },
    ]);
    expect(msg).toMatch(/3 berichten konden niet worden verwijderd/);
    expect(msg).toMatch(/Eerste fout/);
    expect(msg).toMatch(/Tweede fout/);
  });
});
