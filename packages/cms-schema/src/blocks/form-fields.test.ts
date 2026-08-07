import { describe, expect, it } from "vitest";
import {
  createFormFieldItem,
  formFieldPayloadKey,
  normalizeContactFormColumnsDesktop,
  normalizeContactFormTextPlacement,
  normalizeFormFields,
  orderContactFormFieldsForDisplay,
  resolveContactFormFields,
  seedDefaultContactFormFields,
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

describe("seedDefaultContactFormFields", () => {
  it("defaults to company, phone, and message with live placeholders", () => {
    const fields = seedDefaultContactFormFields();
    expect(fields.map((f) => formFieldPayloadKey(f))).toEqual(["company", "phone", "message"]);
    expect(fields.find((f) => f.type === "company")?.placeholder).toBe("Optioneel");
    expect(fields.find((f) => formFieldPayloadKey(f) === "message")?.label).toBe("Uw bericht");
  });

  it("applies legacy label/placeholder overrides", () => {
    const fields = seedDefaultContactFormFields({
      labels: { company: "Firma" },
      placeholders: { message: "Schrijf hier…" },
    });
    expect(fields[0]?.label).toBe("Firma");
    expect(fields.find((f) => formFieldPayloadKey(f) === "message")?.placeholder).toBe(
      "Schrijf hier…",
    );
  });
});

describe("orderContactFormFieldsForDisplay", () => {
  it("orders name, company, phone, email, message like the live Contact form", () => {
    const fields = orderContactFormFieldsForDisplay(
      resolveContactFormFields(seedDefaultContactFormFields()),
    );
    expect(fields.map((f) => formFieldPayloadKey(f))).toEqual([
      "name",
      "company",
      "phone",
      "email",
      "message",
    ]);
  });
});

describe("validateContactFormSubmission", () => {
  const fields = resolveContactFormFields(seedDefaultContactFormFields());

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

  it("accepts the default contact field set including company/phone/message", () => {
    const result = validateContactFormSubmission(fields, {
      name: "Maria",
      email: "maria@example.com",
      company: "Acme",
      phone: "0612345678",
      message: "Hallo",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sanitized).toMatchObject({
        name: "Maria",
        email: "maria@example.com",
        company: "Acme",
        phone: "0612345678",
        message: "Hallo",
      });
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

describe("normalizeContactFormTextPlacement", () => {
  it("defaults to left and maps above→top", () => {
    expect(normalizeContactFormTextPlacement(undefined)).toBe("left");
    expect(normalizeContactFormTextPlacement("top")).toBe("top");
    expect(normalizeContactFormTextPlacement("above")).toBe("top");
    expect(normalizeContactFormTextPlacement("right")).toBe("right");
    expect(normalizeContactFormTextPlacement("left")).toBe("left");
    expect(normalizeContactFormTextPlacement("below")).toBe("left");
  });
});

describe("normalizeContactFormColumnsDesktop", () => {
  it("defaults to 2 and accepts 1", () => {
    expect(normalizeContactFormColumnsDesktop(undefined)).toBe(2);
    expect(normalizeContactFormColumnsDesktop(2)).toBe(2);
    expect(normalizeContactFormColumnsDesktop("2")).toBe(2);
    expect(normalizeContactFormColumnsDesktop(1)).toBe(1);
    expect(normalizeContactFormColumnsDesktop("1")).toBe(1);
    expect(normalizeContactFormColumnsDesktop(3)).toBe(2);
  });
});
