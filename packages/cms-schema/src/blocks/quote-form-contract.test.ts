import { describe, expect, it } from "vitest";
import {
  applyQuoteFieldPresentation,
  createDefaultBlock,
  createDefaultQuoteRequestForm,
  createEmptyEditorHistory,
  formFieldPayloadKey,
  normalizeQuoteRequestForm,
  parseMigrateNormalizePage,
  protectQuoteRequestFormData,
  pushEditorHistory,
  quoteFieldPresentationPatchPreservesContract,
  redoEditorHistory,
  resolveContactFormFields,
  seedDefaultGlassWashingFields,
  undoEditorHistory,
  updateLayoutBlockData,
  validateContactFormSubmission,
  withFrozenPayloadKey,
} from "../index";

function quotePage() {
  const block = createDefaultBlock("quoteRequestForm");
  const page = parseMigrateNormalizePage({
    id: "page_offerte",
    slug: "/offerte",
    title: "Offerte",
    description: "",
    isCustom: true,
    inNav: false,
    blocks: [block],
    updatedAt: 1,
    version: 1,
  })!;
  return { page, blockId: page.blocks[0]!.id };
}

describe("E12 quote form payloadKey freeze", () => {
  it("keeps submission keys after label change on glass seed fields", () => {
    const fields = seedDefaultGlassWashingFields();
    const windows = fields.find((f) => f.id === "quote-glass-windows")!;
    const beforeKey = formFieldPayloadKey(windows);
    expect(beforeKey).toBe("aantal_ramen_indicatie");

    const relabeled = withFrozenPayloadKey({
      ...windows,
      label: "Hoeveel ramen moeten worden gereinigd?",
    });
    expect(formFieldPayloadKey(relabeled)).toBe(beforeKey);
    expect(relabeled.id).toBe("quote-glass-windows");
    expect(relabeled.type).toBe("text");
  });

  it("applyQuoteFieldPresentation never mutates id/type/payloadKey/required", () => {
    const data = createDefaultQuoteRequestForm();
    const tab = data.tabs[0]!;
    const field = tab.fields.find((f) => f.id === "quote-glass-floors")!;
    const before = {
      id: field.id,
      type: field.type,
      key: formFieldPayloadKey(field),
      required: field.required,
    };

    const result = applyQuoteFieldPresentation(tab, field.id, {
      label: "Verdiepingen (indicatie)",
      placeholder: "bijv. 3",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.tab.fields.find((f) => f.id === field.id)!;
    expect(after.label).toBe("Verdiepingen (indicatie)");
    expect(after.placeholder).toBe("bijv. 3");
    expect(after.id).toBe(before.id);
    expect(after.type).toBe(before.type);
    expect(formFieldPayloadKey(after)).toBe(before.key);
    expect(after.required).toBe(before.required);
    expect(quoteFieldPresentationPatchPreservesContract(field, after)).toBe(true);
  });
});

describe("E12 protectQuoteRequestFormData", () => {
  it("restores deleted system fields and locks type/kind/payloadKey", () => {
    const prev = createDefaultQuoteRequestForm();
    const glass = prev.tabs[0]!;
    const proposed = {
      ...prev,
      tabs: [
        {
          ...glass,
          kind: "furniture_cleaning" as const,
          fields: glass.fields
            .filter((f) => f.id !== "quote-glass-windows")
            .map((f) =>
              f.id === "quote-glass-floors"
                ? { ...f, type: "select" as const, label: "X", payloadKey: "hacked" }
                : f,
            ),
        },
        ...prev.tabs.slice(1),
      ],
    };

    const guarded = protectQuoteRequestFormData(prev, proposed);
    expect(guarded.ok).toBe(true);
    if (!guarded.ok) return;
    const tab = guarded.data.tabs[0]!;
    expect(tab.kind).toBe("glass_washing");
    expect(tab.fields.some((f) => f.id === "quote-glass-windows")).toBe(true);
    const floors = tab.fields.find((f) => f.id === "quote-glass-floors")!;
    expect(floors.type).toBe("text");
    expect(formFieldPayloadKey(floors)).toBe("aantal_verdiepingen");
  });

  it("allows presentation label edits while preserving option values", () => {
    const prev = createDefaultQuoteRequestForm();
    const glass = prev.tabs[0]!;
    const access = glass.fields.find((f) => f.id === "quote-glass-access")!;
    const priorValues = (access.options ?? []).map((o) => o.value);

    const proposed = {
      ...prev,
      tabs: [
        {
          ...glass,
          fields: glass.fields.map((f) =>
            f.id === "quote-glass-access"
              ? {
                  ...f,
                  label: "Hoe bereikbaar?",
                  options: (f.options ?? []).map((o) => ({
                    ...o,
                    label: `NL ${o.label}`,
                    value: "MUTATED",
                  })),
                }
              : f,
          ),
        },
        ...prev.tabs.slice(1),
      ],
    };

    const guarded = protectQuoteRequestFormData(prev, proposed);
    expect(guarded.ok).toBe(true);
    if (!guarded.ok) return;
    const nextAccess = guarded.data.tabs[0]!.fields.find((f) => f.id === "quote-glass-access")!;
    expect(nextAccess.label).toBe("Hoe bereikbaar?");
    expect((nextAccess.options ?? []).map((o) => o.value)).toEqual(priorValues);
  });
});

describe("E12 updateLayoutBlockData quote contract", () => {
  it("label patch via tabs.N.fields keeps submission keys", () => {
    const { page, blockId } = quotePage();
    const before = normalizeQuoteRequestForm(page.blocks[0]!.data);
    const glass = before.tabs[0]!;
    const windows = glass.fields.find((f) => f.id === "quote-glass-windows")!;
    const keyBefore = formFieldPayloadKey(windows);

    const fields = glass.fields.map((f) =>
      f.id === windows.id ? { ...f, label: "Hoeveel ramen?" } : f,
    );
    const result = updateLayoutBlockData(page, blockId, {
      [`tabs.0.fields`]: fields,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = normalizeQuoteRequestForm(result.page.blocks[0]!.data);
    const next = after.tabs[0]!.fields.find((f) => f.id === windows.id)!;
    expect(next.label).toBe("Hoeveel ramen?");
    expect(formFieldPayloadKey(next)).toBe(keyBefore);
    expect(next.type).toBe("text");
    expect(next.id).toBe(windows.id);
  });

  it("rejects type mutation by restoring previous type", () => {
    const { page, blockId } = quotePage();
    const before = normalizeQuoteRequestForm(page.blocks[0]!.data);
    const glass = before.tabs[0]!;
    const fields = glass.fields.map((f) =>
      f.id === "quote-glass-windows" ? { ...f, type: "email" as const } : f,
    );
    const result = updateLayoutBlockData(page, blockId, {
      [`tabs.0.fields`]: fields,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = normalizeQuoteRequestForm(result.page.blocks[0]!.data);
    const windows = after.tabs[0]!.fields.find((f) => f.id === "quote-glass-windows")!;
    expect(windows.type).toBe("text");
  });

  it("restores deleted protected field on patch", () => {
    const { page, blockId } = quotePage();
    const before = normalizeQuoteRequestForm(page.blocks[0]!.data);
    const glass = before.tabs[0]!;
    const fields = glass.fields.filter((f) => f.id !== "quote-glass-phone");
    const result = updateLayoutBlockData(page, blockId, {
      [`tabs.0.fields`]: fields,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = normalizeQuoteRequestForm(result.page.blocks[0]!.data);
    expect(after.tabs[0]!.fields.some((f) => f.id === "quote-glass-phone")).toBe(true);
  });

  it("edits tab presentation via dotted paths", () => {
    const { page, blockId } = quotePage();
    const result = updateLayoutBlockData(page, blockId, {
      "tabs.0.title": "Glas & gevel",
      "tabs.0.tag": "Service",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = normalizeQuoteRequestForm(result.page.blocks[0]!.data);
    expect(after.tabs[0]!.title).toBe("Glas & gevel");
    expect(after.tabs[0]!.tag).toBe("Service");
    expect(after.tabs[0]!.kind).toBe("glass_washing");
    expect(after.tabs[0]!.id).toBe("tab_glass");
  });
});

describe("E12 submission contract after presentation edit", () => {
  it("validateContactFormSubmission keys match frozen payload keys", () => {
    const data = createDefaultQuoteRequestForm();
    const glass = data.tabs[0]!;
    const presented = applyQuoteFieldPresentation(glass, "quote-glass-windows", {
      label: "Hoeveel ramen?",
    });
    expect(presented.ok).toBe(true);
    if (!presented.ok) return;

    const fields = resolveContactFormFields(presented.tab.fields);
    const payload: Record<string, string> = {
      name: "Test",
      email: "test@example.com",
      phone: "0612345678",
      company: "Acme",
      aantal_verdiepingen: "2",
      aantal_ramen_indicatie: "5",
      hoogste_raam_meter: "4",
      bereikbaarheid: "Ladder",
      binnen_buiten_of_beide: "Alleen buiten",
      frequentie: "Eenmalig",
      message: "Hallo",
    };

    // Must not accept the visible label as a key
    expect(payload).not.toHaveProperty("Hoeveel ramen?");

    const validated = validateContactFormSubmission(fields, payload);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.sanitized.aantal_ramen_indicatie).toBe("5");
    expect(validated.sanitized).not.toHaveProperty("Hoeveel ramen?");
  });
});

describe("E12 history undo/redo for presentation", () => {
  it("undo restores prior label without changing payload key", () => {
    const { page, blockId } = quotePage();
    const beforeSnap = structuredClone(page);
    const beforeData = normalizeQuoteRequestForm(page.blocks[0]!.data);
    const windows = beforeData.tabs[0]!.fields.find((f) => f.id === "quote-glass-windows")!;
    const key = formFieldPayloadKey(windows);

    const fields = beforeData.tabs[0]!.fields.map((f) =>
      f.id === windows.id ? { ...f, label: "Hoeveel ramen?" } : f,
    );
    const afterResult = updateLayoutBlockData(page, blockId, { "tabs.0.fields": fields });
    expect(afterResult.ok).toBe(true);
    if (!afterResult.ok) return;

    let history = createEmptyEditorHistory();
    const mutation = {
      kind: "block" as const,
      blockId,
      patch: { "tabs.0.fields": fields },
    };
    history = pushEditorHistory(history, {
      kind: "FORM_FIELD_UPDATED",
      label: "Formulierveld gewijzigd",
      mutation,
      before: { overrides: {}, page: beforeSnap } as never,
      after: { overrides: {}, page: afterResult.page } as never,
    });

    const undone = undoEditorHistory(history);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    const restored = undone.restore as { page: typeof page };
    const restoredData = normalizeQuoteRequestForm(restored.page.blocks[0]!.data);
    const restoredField = restoredData.tabs[0]!.fields.find((f) => f.id === windows.id)!;
    expect(restoredField.label).toBe(windows.label);
    expect(formFieldPayloadKey(restoredField)).toBe(key);

    const redone = redoEditorHistory(undone.state);
    expect(redone.ok).toBe(true);
    if (!redone.ok) return;
    const redonePage = (redone.restore as { page: typeof page }).page;
    const redoneData = normalizeQuoteRequestForm(redonePage.blocks[0]!.data);
    const redoneField = redoneData.tabs[0]!.fields.find((f) => f.id === windows.id)!;
    expect(redoneField.label).toBe("Hoeveel ramen?");
    expect(formFieldPayloadKey(redoneField)).toBe(key);
  });
});
