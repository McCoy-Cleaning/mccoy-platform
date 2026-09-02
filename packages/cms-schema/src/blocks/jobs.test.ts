import { describe, expect, it } from "vitest";
import {
  cloneJobsDataWithNewIds,
  createDefaultJobs,
  createDefaultVacancy,
  formatHourlyRateNl,
  formatHoursPerWeekNl,
  normalizeJobs,
  validateJobsForPublish,
} from "./jobs";

describe("jobs block v2", () => {
  it("migrates v1 jobs list idempotently without inventing rates", () => {
    const v1 = {
      title: "Vacatures",
      jobs: [
        {
          id: "job_1",
          title: "Schoonmaker",
          department: "Operations",
          location: "Twente",
          type: "Fulltime",
          applyLink: { type: "internal_route", route: "vacatures" },
        },
      ],
    };
    const once = normalizeJobs(v1);
    const twice = normalizeJobs(once);
    expect(once.heading).toBe("Vacatures");
    expect(once.vacancies).toHaveLength(1);
    expect(once.vacancies[0]?.title).toBe("Schoonmaker");
    expect(once.vacancies[0]?.employmentType).toBe("Fulltime");
    expect(once.vacancies[0]?.hourlyRate).toBeUndefined();
    expect(once.vacancies[0]?.shortDescription).toBe("");
    expect(twice).toEqual(once);
  });

  it("formats Dutch hourly rates", () => {
    expect(
      formatHourlyRateNl({
        minimum: 15,
        maximum: 18,
        currency: "EUR",
        period: "hour",
        showOnWebsite: true,
      }),
    ).toMatch(/€\s*15,00\s*–\s*€\s*18,00 per uur/);
    expect(
      formatHourlyRateNl({
        minimum: 16.5,
        currency: "EUR",
        period: "hour",
        showOnWebsite: true,
      }),
    ).toMatch(/€\s*16,50 per uur/);
    expect(
      formatHourlyRateNl({
        minimum: 15,
        currency: "EUR",
        period: "hour",
        showOnWebsite: false,
      }),
    ).toBeNull();
  });

  it("formats weekly hours", () => {
    expect(formatHoursPerWeekNl({ minimum: 20, maximum: 28 })).toBe("20–28 uur per week");
    expect(formatHoursPerWeekNl({ minimum: 24, maximum: 24 })).toBe("24 uur per week");
  });

  it("rejects invalid ranges on publish for visible vacancies", () => {
    const data = createDefaultJobs();
    data.vacancies = [
      createDefaultVacancy({
        title: "Test",
        location: "Twente",
        shortDescription: "Kort",
        hoursPerWeek: { minimum: 30, maximum: 20 },
        visible: true,
      }),
    ];
    const errors = validateJobsForPublish(data);
    expect(errors.some((e) => e.includes("minimum uren"))).toBe(true);
  });

  it("allows incomplete drafts when vacancy is hidden", () => {
    const data = createDefaultJobs();
    data.vacancies = [
      createDefaultVacancy({
        title: "",
        location: "",
        shortDescription: "",
        visible: false,
      }),
    ];
    expect(validateJobsForPublish(data)).toEqual([]);
  });

  it("clones vacancies with new ids", () => {
    const data = createDefaultJobs();
    data.vacancies = [createDefaultVacancy({ title: "Clone me", location: "Twente" })];
    const originalId = data.vacancies[0]!.id;
    const cloned = cloneJobsDataWithNewIds(data);
    expect(cloned.vacancies[0]!.id).not.toBe(originalId);
    expect(cloned.vacancies[0]!.title).toBe(data.vacancies[0]!.title);
  });

  it("maps part-time free text", () => {
    const data = normalizeJobs({
      title: "Jobs",
      jobs: [{ id: "a", title: "X", location: "Y", type: "Parttime" }],
    });
    expect(data.vacancies[0]?.employmentType).toBe("Parttime");
  });

  it("preserves custom employment free text", () => {
    const data = normalizeJobs({
      heading: "Jobs",
      vacancies: [
        createDefaultVacancy({
          id: "job_custom",
          title: "Seizoen",
          employmentType: "Weekendploeg",
          shortDescription: "Tekst",
        }),
      ],
    });
    expect(data.vacancies[0]?.employmentType).toBe("Weekendploeg");
  });

  it("migrates legacy enum employmentType keys to Dutch labels", () => {
    const data = normalizeJobs({
      heading: "Jobs",
      vacancies: [
        {
          id: "job_enum",
          title: "Oud",
          location: "Twente",
          employmentType: "full-time",
          shortDescription: "Tekst",
          applicationLink: { type: "none" },
          buttonLabel: "Solliciteer",
          visible: true,
        },
      ],
    });
    expect(data.vacancies[0]?.employmentType).toBe("Fulltime");
  });

  it("allows publishing with zero visible vacancies", () => {
    const data = createDefaultJobs();
    data.emptyStateText = "Geen openstaande vacatures.";
    data.vacancies = [
      createDefaultVacancy({ title: "Draft", visible: false, shortDescription: "" }),
    ];
    expect(validateJobsForPublish(data)).toEqual([]);
  });

  it("preserves vacancy ids and order through v1→v2 normalization", () => {
    const v1 = {
      title: "Vacatures",
      jobs: [
        { id: "job_stable_a", title: "A", location: "Twente", type: "Fulltime" },
        { id: "job_stable_b", title: "B", location: "Twente", type: "Parttime" },
      ],
    };
    const normalized = normalizeJobs(v1);
    expect(normalized.vacancies.map((v) => v.id)).toEqual(["job_stable_a", "job_stable_b"]);
    // Re-normalize must not rewrite ids (locale draft keys stay aligned).
    expect(normalizeJobs(normalized).vacancies.map((v) => v.id)).toEqual([
      "job_stable_a",
      "job_stable_b",
    ]);
  });

  it("keeps featured flag through normalize", () => {
    const data = normalizeJobs({
      heading: "Jobs",
      vacancies: [
        createDefaultVacancy({ id: "job_f", title: "Featured", featured: true, visible: true }),
        createDefaultVacancy({ id: "job_r", title: "Regular", featured: false, visible: true }),
      ],
    });
    expect(data.vacancies[0]?.featured).toBe(true);
    expect(data.vacancies[1]?.featured).toBe(false);
  });

  it("seeds placeholder offer and looking-for lists for Nieuwe vacature", () => {
    const vacancy = createDefaultVacancy();
    expect(vacancy.title).toBe("Nieuwe vacature");
    expect(vacancy.shortDescription).toBe("Beschrijf hier de functie en het werk.");
    expect(vacancy.employmentType).toBe("Fulltime");
    expect(vacancy.detailsHeading).toBe("Details");
    expect(vacancy.benefitsHeading).toBe("Wat wij bieden");
    expect(vacancy.requirementsHeading).toBe("Wat wij zoeken");
    expect(vacancy.benefits).toEqual([
      "Goede arbeidsvoorwaarden",
      "Prettige werksfeer in een vast team",
    ]);
    expect(vacancy.requirements).toEqual([
      "Motivatie en betrouwbaarheid",
      "Flexibele inzetbaarheid",
    ]);
  });

  it("preserves legacy responsibilities and maps fullDescription into details when short is empty", () => {
    const data = normalizeJobs({
      heading: "Jobs",
      vacancies: [
        {
          id: "job_legacy",
          title: "Oud",
          location: "Twente",
          employmentType: "full-time",
          shortDescription: "",
          fullDescription: "Lange legacy tekst",
          responsibilities: ["Taken"],
          requirements: ["Eis A"],
          benefits: ["Voordeel A"],
          applicationLink: { type: "none" },
          buttonLabel: "Solliciteer",
          visible: true,
        },
      ],
    });
    expect(data.vacancies[0]?.shortDescription).toBe("Lange legacy tekst");
    expect(data.vacancies[0]?.fullDescription).toBe("Lange legacy tekst");
    expect(data.vacancies[0]?.responsibilities).toEqual(["Taken"]);
    expect(data.vacancies[0]?.requirements).toEqual(["Eis A"]);
    expect(data.vacancies[0]?.benefits).toEqual(["Voordeel A"]);
    expect(data.vacancies[0]?.employmentType).toBe("Fulltime");
    // Legacy payloads without heading overrides must not invent stored headings.
    expect(data.vacancies[0]?.detailsHeading).toBeUndefined();
    expect(data.vacancies[0]?.benefitsHeading).toBeUndefined();
    expect(data.vacancies[0]?.requirementsHeading).toBeUndefined();
  });

  it("preserves custom section headings through normalize", () => {
    const data = normalizeJobs({
      heading: "Jobs",
      vacancies: [
        createDefaultVacancy({
          id: "job_headings",
          title: "Kop",
          shortDescription: "Tekst",
          detailsHeading: "Over de functie",
          benefitsHeading: "Voordelen",
          requirementsHeading: "Eisen",
        }),
      ],
    });
    expect(data.vacancies[0]?.detailsHeading).toBe("Over de functie");
    expect(data.vacancies[0]?.benefitsHeading).toBe("Voordelen");
    expect(data.vacancies[0]?.requirementsHeading).toBe("Eisen");
  });

  it("does not invent offer/looking-for lists when normalizing vacancies without them", () => {
    const data = normalizeJobs({
      heading: "Jobs",
      vacancies: [
        {
          id: "job_bare",
          title: "Bare",
          location: "Twente",
          employmentType: "full-time",
          shortDescription: "Tekst",
          applicationLink: { type: "none" },
          buttonLabel: "Solliciteer",
          visible: true,
        },
      ],
    });
    expect(data.vacancies[0]?.benefits).toBeUndefined();
    expect(data.vacancies[0]?.requirements).toBeUndefined();
  });
});
