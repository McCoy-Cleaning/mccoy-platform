import { describe, expect, it } from "vitest";
import {
  aliasTranslateFields,
  buildGenerateDutchCopyMessages,
  buildGenerateSectionDutchMessages,
  buildTranslateNlToEnMessages,
  fieldRoleGuidance,
  remapAliasedFields,
} from "./prompts";
import { CONTENT_AI_PROMPT_VERSION } from "./types";

describe("fieldRoleGuidance", () => {
  it("guides eyebrow vs heading vs body vs cta", () => {
    expect(fieldRoleGuidance("eyebrow")).toMatch(/2–5 woorden/i);
    expect(fieldRoleGuidance("heading")).toMatch(/scannbaar/i);
    expect(fieldRoleGuidance("body")).toMatch(/1–3 zinnen/i);
    expect(fieldRoleGuidance("cta")).toMatch(/werkwoord/i);
  });
});

describe("buildGenerateSectionDutchMessages", () => {
  it("embeds brand voice, field roles, and prompt version", () => {
    const { system, user } = buildGenerateSectionDutchMessages({
      brief: "Hero voor kantoren in Twente; vast eigen team",
      tone: "catchy",
      fields: {
        eyebrow: { fieldHint: "Eyebrow", maxChars: 40 },
        heading: { fieldHint: "Kop", maxChars: 80, currentText: "Kwaliteit zichtbaar" },
        body: { fieldHint: "Tekst", maxChars: 280 },
      },
    });
    expect(system).toContain(CONTENT_AI_PROMPT_VERSION);
    expect(system).toMatch(/McCoy Cleaning/i);
    expect(system).toMatch(/clichés/i);
    expect(user).toMatch(/Twente/);
    expect(user).toMatch(/eyebrow/);
    expect(user).toMatch(/2–5 woorden/i);
    expect(user).toMatch(/Kwaliteit zichtbaar/);
  });
});

describe("buildGenerateDutchCopyMessages", () => {
  it("asks for JSON and respects briefing priority", () => {
    const { system, user } = buildGenerateDutchCopyMessages({
      brief: "Korte CTA naar offerte",
      fieldHint: "cta",
      tone: "concise",
      maxChars: 40,
    });
    expect(system).toContain('"text"');
    expect(system).toMatch(/werkwoord/i);
    expect(user).toMatch(/Prioriteit: duidelijkheid/);
    expect(user).toMatch(/offerte/);
  });
});

describe("translate field aliases", () => {
  it("maps CMS paths to f0… and remaps back", () => {
    const fields = {
      "section:home.hero:title": "Schone kantoren",
      "block:blk:offers.0.badge": "Actie",
      "block:blk:steps.0.image.alt": "Team",
    };
    const { aliased, aliasToKey } = aliasTranslateFields(fields);
    expect(Object.keys(aliased)).toEqual(["f0", "f1", "f2"]);
    expect(aliased.f0).toBe("Schone kantoren");
    const remapped = remapAliasedFields({ f0: "Clean offices", f1: "Offer", f2: "Team" }, aliasToKey);
    expect(remapped["section:home.hero:title"]).toBe("Clean offices");
    expect(remapped["block:blk:offers.0.badge"]).toBe("Offer");
  });

  it("prompt schema uses short aliases not colon paths", () => {
    const { system, user, aliasToKey } = buildTranslateNlToEnMessages({
      fields: {
        "section:home.workGallery:images.0.title": "Ons werk",
        "section:home.workGallery:images.0.caption": "Kantoor",
      },
      maxCharsPerField: 200,
    });
    expect(system).toContain('"f0"');
    expect(system).toContain('"f1"');
    expect(system).not.toContain("section:home.workGallery");
    expect(user).toContain("Ons werk");
    expect(aliasToKey.f0).toBe("section:home.workGallery:images.0.title");
    expect(system).toContain(CONTENT_AI_PROMPT_VERSION);
  });

  it("requires preserving quotes, line breaks, and separator lines", () => {
    const { system, user } = buildTranslateNlToEnMessages({
      fields: {
        notice:
          '"Binnenkort: onze nieuwe webshop"\n\nAchter de schermen werken we hard.\n__________________________________________',
      },
      maxCharsPerField: 2000,
    });
    expect(system).toMatch(/STRUCTURE LOCK/i);
    expect(system).toMatch(/line count|\\n sequences|pagination/i);
    expect(system).toMatch(/bullet/i);
    expect(system).toMatch(/quotation marks|quotes/i);
    expect(system).toMatch(/separator/i);
    expect(user).toMatch(/line skeleton|bullets/i);
    expect(user).toContain("__________________________________________");
    expect(user).toContain("Binnenkort");
  });
});