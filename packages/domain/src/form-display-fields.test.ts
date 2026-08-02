import { describe, expect, it } from "vitest";

import { displayFormFields } from "./form-display-fields";

describe("displayFormFields", () => {
  it("keeps role and drops redundant vacancy metadata", () => {
    expect(
      displayFormFields({
        name: "Anna",
        vacancySlug: "reguliere-schoonmaak",
        vacancyTitleSnapshot: "Reguliere schoonmaak",
        role: "Reguliere schoonmaak",
        email: "anna@example.com",
      }),
    ).toEqual({
      name: "Anna",
      role: "Reguliere schoonmaak",
      email: "anna@example.com",
    });
  });

  it("promotes vacancyTitleSnapshot to role when role is missing", () => {
    expect(
      displayFormFields({
        name: "Anna",
        vacancySlug: "reguliere-schoonmaak",
        vacancyTitleSnapshot: "Reguliere schoonmaak",
        email: "anna@example.com",
      }),
    ).toEqual({
      name: "Anna",
      role: "Reguliere schoonmaak",
      email: "anna@example.com",
    });
  });

  it("drops internal vacancy keys when no title is available", () => {
    expect(
      displayFormFields({
        name: "Anna",
        vacancyId: "job_1",
        vacancySlug: "reguliere-schoonmaak",
      }),
    ).toEqual({
      name: "Anna",
    });
  });
});
