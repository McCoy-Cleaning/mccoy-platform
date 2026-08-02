import { describe, expect, it } from "vitest";

import { buildFormEmail } from "./templates";

describe("buildFormEmail vacancy fields", () => {
  it("includes only Functie in job application notification HTML", () => {
    const { html } = buildFormEmail(
      "job_application",
      {
        name: "Anna",
        email: "anna@example.com",
        vacancySlug: "reguliere-schoonmaak",
        vacancyTitleSnapshot: "Reguliere schoonmaak",
        role: "Reguliere schoonmaak",
        motivation: "Ik wil graag werken bij McCoy.",
      },
      [],
      null,
    );

    expect(html).toContain("Functie");
    expect(html).toContain("Reguliere schoonmaak");
    expect(html).not.toContain("vacancySlug");
    expect(html).not.toContain("vacancyTitleSnapshot");
    expect(html).not.toMatch(/VACANCY/i);
  });
});
