import { describe, expect, it } from "vitest";
import {
  buildFormScopeSnapshot,
  encodeFormScopeSubjectMarker,
  extractFormScopeKeyFromSubject,
  formScopeKeyFromLabel,
  stripFormScopeMarkerFromSubject,
  stripReplyForwardPrefixes,
  validateFormScopeLabel,
} from "./form-scope";

describe("form scope", () => {
  it("generates stable keys from labels", () => {
    expect(formScopeKeyFromLabel("Vestiging Amsterdam")).toBe("vestiging-amsterdam");
    expect(formScopeKeyFromLabel("  Vestiging   Amsterdam  ")).toBe("vestiging-amsterdam");
  });

  it("rejects control characters and overlong labels", () => {
    expect(validateFormScopeLabel("Bad\nLabel").ok).toBe(false);
    expect(validateFormScopeLabel("x".repeat(81)).ok).toBe(false);
  });

  it("keeps existing key when label is renamed", () => {
    const result = buildFormScopeSnapshot("Vestiging A'dam", "vestiging-amsterdam");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scope.key).toBe("vestiging-amsterdam");
      expect(result.scope.label).toBe("Vestiging A'dam");
    }
  });

  it("extracts FORM_SCOPE markers and ignores other brackets", () => {
    expect(
      extractFormScopeKeyFromSubject(
        "[FORM_SCOPE:vestiging-amsterdam] Algemene aanvraag — Maria",
      ),
    ).toBe("vestiging-amsterdam");
    expect(
      extractFormScopeKeyFromSubject(
        "[EXTERNAL] [FORM_SCOPE:amsterdam] Algemene aanvraag — Maria",
      ),
    ).toBe("amsterdam");
    expect(extractFormScopeKeyFromSubject("[EXTERNAL] Algemene aanvraag")).toBeNull();
    expect(extractFormScopeKeyFromSubject("[FORM_SCOPE:] Algemene aanvraag")).toBeNull();
    expect(extractFormScopeKeyFromSubject("[FORM_SCOPE:../admin] Algemene aanvraag")).toBeNull();
  });

  it("strips reply/forward prefixes before parsing", () => {
    expect(
      extractFormScopeKeyFromSubject("Re: [FORM_SCOPE:amsterdam] Algemene aanvraag — Maria"),
    ).toBe("amsterdam");
    expect(
      extractFormScopeKeyFromSubject("FW: [FORM_SCOPE:amsterdam] Algemene aanvraag — Maria"),
    ).toBe("amsterdam");
    expect(stripReplyForwardPrefixes("AW: WG: Hello")).toBe("Hello");
  });

  it("encodes markers and strips them for kind classification", () => {
    const marker = encodeFormScopeSubjectMarker("vestiging-amsterdam");
    expect(marker).toBe("[FORM_SCOPE:vestiging-amsterdam]");
    expect(
      stripFormScopeMarkerFromSubject(`${marker} Algemene aanvraag — Maria`),
    ).toBe("Algemene aanvraag — Maria");
  });
});
