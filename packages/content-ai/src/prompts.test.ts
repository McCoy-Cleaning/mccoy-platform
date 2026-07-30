import { describe, expect, it } from "vitest";
import {
  buildGenerateDutchCopyMessages,
  buildGenerateSectionDutchMessages,
  fieldRoleGuidance,
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
