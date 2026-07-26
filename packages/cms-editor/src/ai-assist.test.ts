import { describe, expect, it } from "vitest";
import { collectShallowStringFields, defaultMaxCharsForField, isTranslatableFieldKey } from "./ai-assist";

describe("isTranslatableFieldKey", () => {
  it("allows copy fields", () => {
    expect(isTranslatableFieldKey("title")).toBe(true);
    expect(isTranslatableFieldKey("body")).toBe(true);
    expect(isTranslatableFieldKey("headingAccent")).toBe(true);
    expect(isTranslatableFieldKey("ctaLabel")).toBe(true);
  });

  it("rejects media and url fields", () => {
    expect(isTranslatableFieldKey("image")).toBe(false);
    expect(isTranslatableFieldKey("before")).toBe(false);
    expect(isTranslatableFieldKey("poster")).toBe(false);
    expect(isTranslatableFieldKey("ctaHref")).toBe(false);
    expect(isTranslatableFieldKey("videoUrl")).toBe(false);
    expect(isTranslatableFieldKey("missionImage")).toBe(false);
    expect(isTranslatableFieldKey("email")).toBe(false);
    expect(isTranslatableFieldKey("contactEmail")).toBe(false);
    expect(isTranslatableFieldKey("icon")).toBe(false);
    expect(isTranslatableFieldKey("size")).toBe(false);
  });
});

describe("collectShallowStringFields", () => {
  it("skips non-translatable keys", () => {
    const fields = collectShallowStringFields({
      title: "Hallo",
      image: "/images/x.jpg",
      body: "Tekst",
      ctaHref: "/contact",
    });
    expect(fields).toEqual({ title: "Hallo", body: "Tekst" });
  });

  it("can include empty string targets", () => {
    const fields = collectShallowStringFields(
      { title: "", body: "Tekst", image: "/x.jpg" },
      ["title", "body", "image"],
      { includeEmpty: true },
    );
    expect(fields).toEqual({ title: "", body: "Tekst" });
  });
});

describe("defaultMaxCharsForField", () => {
  it("picks sensible limits", () => {
    expect(defaultMaxCharsForField("body")).toBe(600);
    expect(defaultMaxCharsForField("heading")).toBe(120);
    expect(defaultMaxCharsForField("ctaLabel")).toBe(60);
  });
});
