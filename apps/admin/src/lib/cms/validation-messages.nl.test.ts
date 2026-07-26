import { describe, expect, it } from "vitest";
import { PUBLISH_VALIDATION_CODES } from "@mccoy/cms-schema";
import { formatValidateIssuesNl } from "./validation-messages.nl";

describe("formatValidateIssuesNl", () => {
  it("prefixes hero empty-title with section and title field hint", () => {
    const messages = formatValidateIssuesNl([
      {
        code: PUBLISH_VALIDATION_CODES.HERO_TITLE_REQUIRED,
        message: PUBLISH_VALIDATION_CODES.HERO_TITLE_REQUIRED,
        path: "block_1.title",
        blockLabel: "Hero",
        blockType: "hero",
      },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/Sectie "Hero"/);
    expect(messages[0]).toMatch(/Titel is verplicht voor publicatie/);
    expect(messages[0]).toMatch(/\(veld: titel\)/);
  });
});
