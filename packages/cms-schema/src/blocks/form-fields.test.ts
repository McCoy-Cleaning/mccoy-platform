import { describe, expect, it } from "vitest";
import {
  createFormFieldItem,
  formFieldPayloadKey,
  normalizeFormFields,
  resolveContactFormFields,
  validateContactFormSubmission,
} from "./form-fields";

describe("normalizeFormFields", () => {
  it("migrates legacy TextListItem rows to typed fields", () => {
    const fields = normalizeFormFields([
      { id: "a", text: "Label 1" },
      { id: "b", text: "Naam" },
      { id: "c", text: "E-mail" },
    ]);
    expect(fields).toHaveLength(3);
    expect(fields[0]?.type).toBe("text");
    expect(fields[1]?.type).toBe("name");
    expect(fields[2]?.type).toBe("email");
  });

  it("defaults empty arrays to no output", () => {
    expect(normalizeFormFields([])).toEqual([]);
  });
});

describe("formFieldPayloadKey", () => {
  it("maps typed name and email fields to server keys", () => {
    expect(formFieldPayloadKey(createFormFieldItem("Contactpersoon", "name"))).toBe("name");
    expect(formFieldPayloadKey(createFormFieldItem("Mail", "email"))).toBe("email");
    expect(formFieldPayloadKey(createFormFieldItem("Mobiel", "phone"))).toBe("phone");
    expect(formFieldPayloadKey(createFormFieldItem("Organisatie", "company"))).toBe("company");
    expect(formFieldPayloadKey(createFormFieldItem("Label 1", "text"))).toBe("label_1");
  });
});

describe("resolveContactFormFields", () => {
  it("always includes built-in name and email", () => {
    const fields = resolveContactFormFields([]);
    expect(fields[0]?.type).toBe("name");
    expect(fields[1]?.type).toBe("email");
    expect(fields).toHaveLength(2);
  });

  it("appends custom fields and filters duplicate name/email rows", () => {
    const fields = resolveContactFormFields([
      createFormFieldItem("Naam", "name"),
      createFormFieldItem("E-mail", "email"),
      createFormFieldItem("Bericht", "textarea"),
      createFormFieldItem("Telefoon", "phone"),
    ]);
    expect(fields).toHaveLength(4);
    expect(fields.map((f) => f.type)).toEqual(["name", "email", "textarea", "phone"]);
  });

  it("filters legacy label-based name/email mappings", () => {
    const fields = resolveContactFormFields([createFormFieldItem("Naam", "text")]);
    expect(fields).toHaveLength(2);
    expect(fields.every((f) => f.type === "name" || f.type === "email")).toBe(true);
  });
});

describe("validateContactFormSubmission", () => {
  const fields = resolveContactFormFields([
    createFormFieldItem("Bericht", "textarea"),
  ]);

  it("requires name and email", () => {
    expect(validateContactFormSubmission(fields, { name: "", email: "" }).ok).toBe(false);
    const result = validateContactFormSubmission(fields, {
      name: "Maria",
      email: "maria@example.com",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sanitized.name).toBe("Maria");
      expect(result.sanitized.email).toBe("maria@example.com");
    }
  });

  it("rejects invalid select values", () => {
    const selectFields = [
      ...fields.slice(0, 2),
      createFormFieldItem("Onderwerp", "select", {
        required: true,
        options: [{ id: "o1", label: "Info", value: "info" }],
      }),
    ];
    expect(
      validateContactFormSubmission(selectFields, {
        name: "Maria",
        email: "maria@example.com",
        onderwerp: "spam",
      }).ok,
    ).toBe(false);
  });
});
