import { normalizeJobs, resolveVacancyPublicSlug, type VacancyItem } from "./jobs";
import type { CmsPage } from "../types";

export type VacancyApplicationFields = {
  vacancyId: string;
  vacancyTitleSnapshot: string;
};

export type ResolveVacancyApplicationOptions = {
  /** Public slug when the client id is stale (seed vs published mismatch). */
  vacancySlug?: string;
};

export type ResolveVacancyApplicationResult =
  | { ok: true; vacancy: VacancyItem; fields: VacancyApplicationFields }
  | { ok: false; reason: string };

/**
 * Find the single jobs block on the vacatures page (first match).
 * Form roles and application validation use this block only — never merge.
 */
export function findVacaturesJobsBlock(page: CmsPage | null | undefined) {
  if (!page || page.id !== "page_vacatures") return null;
  return page.blocks.find((b) => b.type === "jobs") ?? null;
}

function findVacancyInJobs(
  vacancies: VacancyItem[],
  vacancyId: string,
  options?: ResolveVacancyApplicationOptions,
): VacancyItem | undefined {
  const byId = vacancies.find((v) => v.id === vacancyId);
  if (byId) return byId;

  const slugHint = options?.vacancySlug?.trim();
  if (slugHint) {
    const bySlug = vacancies.find(
      (v) => v.slug === slugHint || resolveVacancyPublicSlug(v) === slugHint,
    );
    if (bySlug) return bySlug;
  }

  // Legacy i18n role cards (`legacy_0`, …) when the storefront still renders static roles.
  if (vacancyId.startsWith("legacy_")) {
    const index = Number.parseInt(vacancyId.slice("legacy_".length), 10);
    if (Number.isFinite(index) && index >= 0) {
      const visible = vacancies.filter((v) => v.visible);
      if (index < visible.length) return visible[index];
    }
  }

  return undefined;
}

/**
 * Validate a job application against the published vacatures jobs block.
 * Does not trust client-supplied titles; snapshot is taken from the published vacancy.
 */
export function resolveVacancyApplication(
  page: CmsPage | null | undefined,
  vacancyId: string | undefined,
  now = new Date(),
  options?: ResolveVacancyApplicationOptions,
): ResolveVacancyApplicationResult {
  const id = typeof vacancyId === "string" ? vacancyId.trim() : "";
  if (!id) {
    return { ok: false, reason: "Selecteer een vacature." };
  }

  const block = findVacaturesJobsBlock(page);
  if (!block) {
    return { ok: false, reason: "Er zijn momenteel geen openstaande vacatures." };
  }

  const jobs = normalizeJobs(block.data);
  const vacancy = findVacancyInJobs(jobs.vacancies, id, options);
  if (!vacancy) {
    return { ok: false, reason: "De geselecteerde vacature bestaat niet meer." };
  }
  if (!vacancy.visible) {
    return { ok: false, reason: "Deze vacature is niet meer zichtbaar." };
  }
  if (vacancy.applicationDeadline) {
    const deadline = new Date(`${vacancy.applicationDeadline}T23:59:59.999Z`);
    if (!Number.isNaN(deadline.getTime()) && now.getTime() > deadline.getTime()) {
      return { ok: false, reason: "De sollicitatietermijn voor deze vacature is verstreken." };
    }
  }

  return {
    ok: true,
    vacancy,
    fields: {
      vacancyId: vacancy.id,
      vacancyTitleSnapshot: vacancy.title.trim() || "Vacature",
    },
  };
}
