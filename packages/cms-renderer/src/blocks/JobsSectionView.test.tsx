import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDefaultVacancy, type JobsBlockData } from "@mccoy/cms-schema";
import { JobsSectionView } from "./JobsSectionView";

function renderJobs(data: JobsBlockData, mode: "preview" | "storefront" = "preview") {
  return renderToStaticMarkup(
    React.createElement(JobsSectionView, { data, mode, showHidden: true }),
  );
}

describe("JobsSectionView clickable apply control", () => {
  it("hides the apply control when sollicitatiebestemming is Geen link", () => {
    const vacancy = createDefaultVacancy({
      title: "Schoonmaker",
      applicationLink: { type: "none" },
      buttonLabel: "Solliciteer",
      visible: true,
    });
    const html = renderJobs({
      heading: "Vacatures",
      displayMode: "cards",
      vacancies: [vacancy],
    });
    expect(html).toContain("Schoonmaker");
    expect(html).not.toContain("Solliciteer");
    expect(html).not.toContain("Bekijk vacature");
  });

  it("shows the apply control when a pagina destination is set", () => {
    const vacancy = createDefaultVacancy({
      title: "Glazenwasser",
      applicationLink: { type: "internal_route", route: "contact" },
      buttonLabel: "Solliciteer nu",
      visible: true,
    });
    const html = renderJobs({
      heading: "Vacatures",
      displayMode: "cards",
      vacancies: [vacancy],
    });
    expect(html).toContain("Solliciteer nu");
  });
});

describe("JobsSectionView cards layout", () => {
  it("top-aligns cards so expand does not stretch siblings", () => {
    const vacancies = [
      createDefaultVacancy({
        title: "Reguliere schoonmaak",
        shortDescription: "Korte intro",
        fullDescription: "Lange beschrijving die de kaart verlengt.",
        applicationLink: { type: "none" },
        visible: true,
      }),
      createDefaultVacancy({
        title: "Glazenwasser",
        shortDescription: "Korte intro",
        fullDescription: "Andere lange beschrijving.",
        applicationLink: { type: "none" },
        visible: true,
      }),
    ];
    const html = renderJobs({
      heading: "Vacatures",
      displayMode: "cards",
      vacancies,
    });
    expect(html).toContain("items-start");
    expect(html).toContain("sm:grid-cols-2");
    // Cards must size to content; h-full would refill a stretched grid cell.
    expect(html).toContain("flex flex-col p-5");
    expect(html).not.toContain("flex h-full flex-col p-5");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Meer details");
  });
});
