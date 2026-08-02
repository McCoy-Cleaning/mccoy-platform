import type { FormScopeSnapshot } from "@mccoy/domain";
import type { CmsPage } from "./types";
import { getBlockDataDefinition, type ContactFormBlockData, type NewsletterBlockData } from "./blocks";
import type { ContactFormContent, VacaturesMainContent } from "./content";
import { isLayoutItemHidden } from "./layout";
import { normalizeCmsPage } from "./pipeline";
import { fixedLayoutId } from "./sections";

export type PublishedFormScopeFacet = {
  key: string;
  label: string;
  count: number;
};

function addScope(map: Map<string, PublishedFormScopeFacet>, scope: FormScopeSnapshot | undefined) {
  if (!scope?.key?.trim() || !scope.label?.trim()) return;
  const key = scope.key.trim().toLowerCase();
  const label = scope.label.trim();
  const prev = map.get(key);
  map.set(key, {
    key,
    label: label || prev?.label || key,
    count: prev?.count ?? 0,
  });
}

function blockVisible(page: CmsPage, blockId: string): boolean {
  const layoutItem =
    page.layout.find((item) => item.kind === "block" && item.blockId === blockId) ?? null;
  if (!layoutItem) return true;
  return !isLayoutItemHidden(layoutItem);
}

function fixedSectionVisible(page: CmsPage, sectionKey: string): boolean {
  const layoutId = fixedLayoutId(sectionKey as Parameters<typeof fixedLayoutId>[0]);
  const item = page.layout.find((entry) => entry.kind === "fixed" && entry.id === layoutId);
  if (!item) return true;
  return !isLayoutItemHidden(item);
}

/** Collect configured Aanvragen scopes from live published CMS pages (count stays 0). */
export function collectPublishedFormScopes(pages: CmsPage[]): PublishedFormScopeFacet[] {
  const map = new Map<string, PublishedFormScopeFacet>();

  for (const raw of pages) {
    const page = normalizeCmsPage(raw);

    for (const block of page.blocks) {
      if (!blockVisible(page, block.id)) continue;

      if (block.type === "contactForm") {
        const def = getBlockDataDefinition("contactForm");
        const data = def.normalize(block.data) as ContactFormBlockData;
        addScope(map, data.scope);
      }

      if (block.type === "newsletter") {
        const def = getBlockDataDefinition("newsletter");
        const data = def.normalize(block.data) as NewsletterBlockData;
        addScope(map, data.scope);
      }
    }

    const contactFormContent = page.sectionContent?.["contact.form"] as ContactFormContent | undefined;
    if (fixedSectionVisible(page, "contact.form")) {
      addScope(map, contactFormContent?.scope);
    }

    const offerteFormContent = page.sectionContent?.["offerte.form"] as ContactFormContent | undefined;
    if (fixedSectionVisible(page, "offerte.form")) {
      addScope(map, offerteFormContent?.scope);
      addScope(map, offerteFormContent?.glassScope);
      addScope(map, offerteFormContent?.furnitureScope);
    }

    const vacaturesMain = page.sectionContent?.["vacatures.main"] as VacaturesMainContent | undefined;
    if (fixedSectionVisible(page, "vacatures.main")) {
      addScope(map, vacaturesMain?.applicationScope);
    }
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "nl"));
}
