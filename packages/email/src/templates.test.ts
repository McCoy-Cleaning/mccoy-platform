import { describe, expect, it } from "vitest";

import { buildFormEmail, buildSubmitterConfirmationEmail } from "./templates";

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

describe("buildSubmitterConfirmationEmail", () => {
  const fields = {
    name: "Anna",
    email: "anna@example.com",
    message: "Geheim bericht dat niet in de bevestiging hoort.",
    motivation: "Privé motivatie.",
  };

  it("puts Dutch copy first, English underneath, with request number", () => {
    const { subject, html } = buildSubmitterConfirmationEmail("inquiry", fields, "WR-123");

    expect(subject).toBe("We hebben uw aanvraag ontvangen / We received your request (WR-123)");
    expect(html).toContain("McCoy Cleaning");
    expect(html).toContain("background:#0b1220");
    expect(html).toContain("Beste Anna,");
    expect(html).toContain("We hebben uw aanvraag ontvangen en zijn deze aan het verwerken");
    expect(html).toContain("Dear Anna,");
    expect(html).toContain("We have received your inquiry and it is being processed");
    expect(html).toContain("WR-123");
    expect(html.indexOf("Beste Anna,")).toBeLessThan(html.indexOf("Dear Anna,"));
    expect(html.indexOf("aan het verwerken")).toBeLessThan(html.indexOf("being processed"));
    expect(html).not.toContain("Geheim bericht");
    expect(html).not.toContain("Privé motivatie");
    expect(html).not.toContain("anna@example.com");
  });

  it("uses sollicitatie / application wording for job applications", () => {
    const { subject, html } = buildSubmitterConfirmationEmail(
      "job_application",
      fields,
      "WR-456",
    );
    expect(subject).toBe(
      "We hebben uw sollicitatie ontvangen / We received your application (WR-456)",
    );
    expect(html).toContain("sollicitatie ontvangen");
    expect(html).toContain("your application");
    expect(html).toContain("WR-456");
  });

  it("uses aanmelding / signup wording for newsletter", () => {
    const { subject, html } = buildSubmitterConfirmationEmail(
      "newsletter",
      { name: "Piet", email: "piet@example.com" },
      "WR-789",
    );
    expect(subject).toBe("We hebben uw aanmelding ontvangen / We received your signup (WR-789)");
    expect(html).toContain("aanmelding ontvangen");
    expect(html).toContain("your signup");
    expect(html).toContain("being processed");
  });
});
