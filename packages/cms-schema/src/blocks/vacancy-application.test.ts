import { describe, expect, it } from "vitest";
import { createDefaultJobs, createDefaultVacancy } from "./jobs";
import { resolveVacancyApplication } from "./vacancy-application";
import { newBlockLayoutItem } from "../layout";
import type { BuiltinCmsPage } from "../types";

function publishedVacatures(vacancies = [createDefaultVacancy({ title: "Schoonmaker", visible: true })]) {
  const jobs = createDefaultJobs();
  jobs.vacancies = vacancies;
  const block = {
    id: "block_jobs",
    type: "jobs" as const,
    data: jobs as unknown as Record<string, unknown>,
    dataVersion: 2,
  };
  return {
    id: "page_vacatures",
    kind: "builtin",
    pageKey: "vacatures",
    slug: "/vacatures",
    title: "Vacatures",
    description: "",
    inNav: true,
    blocks: [block],
    layout: [
      { id: "lay_fixed", kind: "fixed", key: "vacatures.main" },
      newBlockLayoutItem(block.id),
    ],
    version: 1,
    updatedAt: Date.now(),
  } as BuiltinCmsPage;
}

describe("resolveVacancyApplication", () => {
  it("accepts a visible vacancy and returns id + title snapshot", () => {
    const vacancy = createDefaultVacancy({ title: "Schoonmaker", visible: true });
    const page = publishedVacatures([vacancy]);
    const result = resolveVacancyApplication(page, vacancy.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.vacancyId).toBe(vacancy.id);
    expect(result.fields.vacancyTitleSnapshot).toBe("Schoonmaker");
  });

  it("rejects unknown vacancy ids", () => {
    const page = publishedVacatures();
    const result = resolveVacancyApplication(page, "job_missing");
    expect(result.ok).toBe(false);
  });

  it("rejects hidden vacancies", () => {
    const vacancy = createDefaultVacancy({ title: "Hidden", visible: false });
    const page = publishedVacatures([vacancy]);
    expect(resolveVacancyApplication(page, vacancy.id).ok).toBe(false);
  });

  it("rejects past application deadlines", () => {
    const vacancy = createDefaultVacancy({
      title: "Closed",
      visible: true,
      applicationDeadline: "2020-01-01",
    });
    const page = publishedVacatures([vacancy]);
    expect(resolveVacancyApplication(page, vacancy.id, new Date("2024-01-01")).ok).toBe(false);
  });

  it("keeps snapshot independent of later rename (caller stores snapshot)", () => {
    const vacancy = createDefaultVacancy({ title: "Old title", visible: true });
    const page = publishedVacatures([vacancy]);
    const first = resolveVacancyApplication(page, vacancy.id);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const snapshot = first.fields.vacancyTitleSnapshot;
    vacancy.title = "Renamed";
    expect(snapshot).toBe("Old title");
    expect(resolveVacancyApplication(page, vacancy.id).ok).toBe(true);
  });
});
