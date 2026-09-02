import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createDefaultVacancy,
  VACANCY_CARD_LABELS_NL,
  type JobsBlockData,
} from "@mccoy/cms-schema";
import {
  CmsBlockEditScope,
  CmsEditSurfaceProvider,
  type CmsEditSurfaceApi,
} from "../edit-surface";
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
      benefits: undefined,
      requirements: undefined,
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
      benefits: undefined,
      requirements: undefined,
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
  it("top-aligns cards and shows the four-part content structure without expand chrome", () => {
    const vacancies = [
      createDefaultVacancy({
        title: "Reguliere schoonmaak",
        shortDescription: "Korte intro",
        benefits: ["Vast contract"],
        requirements: ["Motivatie"],
        applicationLink: { type: "none" },
        visible: true,
      }),
      createDefaultVacancy({
        title: "Glazenwasser",
        shortDescription: "Korte intro",
        benefits: ["Teamverband"],
        requirements: ["Rijbewijs"],
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
    expect(html).not.toContain("Meer details");
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("Verantwoordelijkheden");
    expect(html).not.toContain("Contact");
    expect(html).toContain(VACANCY_CARD_LABELS_NL.offer);
    expect(html).toContain(VACANCY_CARD_LABELS_NL.lookingFor);
    expect(html).toContain("Vast contract");
    expect(html).toContain("Motivatie");
  });
});

describe("JobsSectionView canvas text paths", () => {
  it("exposes title, details, employment, headings, offer and looking-for paths when edit surface is on", () => {
    const vacancy = createDefaultVacancy({
      title: "Schoonmaker",
      shortDescription: "Korte intro",
      location: "Enschede",
      department: "Operatie",
      employmentType: "Fulltime",
      detailsHeading: "Details",
      benefitsHeading: "Wat wij bieden",
      requirementsHeading: "Wat wij zoeken",
      benefits: ["Goede voorwaarden"],
      requirements: ["Betrouwbaarheid"],
      responsibilities: ["Schoonmaken"],
      applicationLink: { type: "none" },
      visible: true,
    });
    const surface: CmsEditSurfaceApi = {
      enabled: true,
      sendBlockPatch: () => {},
      renderText: ({ path, value }) =>
        React.createElement("span", { "data-cms-edit-path": path }, value),
      renderMedia: ({ children }) => React.createElement(React.Fragment, null, children),
      renderCta: ({ children }) => React.createElement(React.Fragment, null, children),
    };
    const html = renderToStaticMarkup(
      <CmsEditSurfaceProvider value={surface}>
        <CmsBlockEditScope blockId="blk_jobs" blockType="jobs">
          <JobsSectionView
            data={{
              heading: "Openstaande vacatures",
              introduction: "Kom werken bij McCoy",
              displayMode: "cards",
              vacancies: [vacancy],
            }}
            mode="preview"
            showHidden
          />
        </CmsBlockEditScope>
      </CmsEditSurfaceProvider>,
    );
    expect(html).toContain('data-cms-edit-path="heading"');
    expect(html).toContain('data-cms-edit-path="introduction"');
    expect(html).toContain('data-cms-edit-path="vacancies.0.title"');
    expect(html).toContain('data-cms-edit-path="vacancies.0.employmentType"');
    expect(html).toContain('data-cms-edit-path="vacancies.0.detailsHeading"');
    expect(html).toContain('data-cms-edit-path="vacancies.0.shortDescription"');
    expect(html).toContain('data-cms-edit-path="vacancies.0.location"');
    expect(html).toContain('data-cms-edit-path="vacancies.0.department"');
    expect(html).toContain('data-cms-edit-path="vacancies.0.benefitsHeading"');
    expect(html).toContain('data-cms-edit-path="vacancies.0.requirementsHeading"');
    expect(html).toContain('data-cms-edit-path="vacancies.0.benefits.0"');
    expect(html).toContain('data-cms-edit-path="vacancies.0.requirements.0"');
    expect(html).not.toContain('data-cms-edit-path="vacancies.0.responsibilities.0"');
    expect(html).not.toContain('data-cms-edit-path="vacancies.0.fullDescription"');
    expect(html).toContain("Vacature toevoegen");
    expect(html).toContain("Korte intro");
    expect(html).toContain(VACANCY_CARD_LABELS_NL.offer);
    expect(html).toContain(VACANCY_CARD_LABELS_NL.lookingFor);
    expect(html).toContain(VACANCY_CARD_LABELS_NL.details);
  });

  it("shows details placeholder text under DETAILS when shortDescription is empty in edit mode", () => {
    const vacancy = createDefaultVacancy({
      title: "Nieuwe vacature",
      shortDescription: "",
      benefits: ["Nieuw voordeel"],
      requirements: [],
      visible: true,
    });
    const surface: CmsEditSurfaceApi = {
      enabled: true,
      sendBlockPatch: () => {},
      renderText: ({ path, value }) =>
        React.createElement("span", { "data-cms-edit-path": path }, value),
      renderMedia: ({ children }) => React.createElement(React.Fragment, null, children),
      renderCta: ({ children }) => React.createElement(React.Fragment, null, children),
    };
    const html = renderToStaticMarkup(
      <CmsEditSurfaceProvider value={surface}>
        <CmsBlockEditScope blockId="blk_jobs" blockType="jobs">
          <JobsSectionView
            data={{
              heading: "Openstaande vacatures",
              displayMode: "cards",
              vacancies: [vacancy],
            }}
            mode="preview"
            showHidden
          />
        </CmsBlockEditScope>
      </CmsEditSurfaceProvider>,
    );
    expect(html).toContain("Beschrijf hier de functie en het werk.");
    expect(html).toContain('data-cms-edit-path="vacancies.0.shortDescription"');
  });
});
