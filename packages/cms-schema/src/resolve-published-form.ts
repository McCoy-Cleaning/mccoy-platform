import {
  FIXED_FORM_SOURCE_IDS,
  composeWebsiteFormId,
  type FormKind,
  type FormScopeSnapshot,
} from "@mccoy/domain";
import type { CmsPage } from "./types";
import type { ContactFormContent, VacaturesMainContent } from "./content";
import { isLayoutItemHidden, type LayoutItem } from "./layout";
import { fixedLayoutId } from "./sections";
import {
  getBlockDataDefinition,
  type ContactFormBlockData,
  type NewsletterBlockData,
} from "./blocks";
import {
  CANONICAL_FORM_SOURCE_KEYS,
  resolveCanonicalFormSourceKey,
} from "./form-source";

export type ResolvedPublishedForm = {
  formId: string;
  pageId: string;
  sourceId: string;
  kind: FormKind;
  scope: FormScopeSnapshot | null;
};

export type ResolvePublishedFormResult =
  | { ok: true; form: ResolvedPublishedForm }
  | { ok: false; reason: string; code: "not_found" | "hidden" | "kind_mismatch" | "invalid" };

function findLayoutItem(page: CmsPage, sourceId: string): LayoutItem | null {
  return (
    page.layout.find((item) => {
      if (item.kind === "fixed") {
        return item.id === sourceId || fixedLayoutId(item.key) === sourceId;
      }
      if (item.kind === "block") {
        return item.blockId === sourceId || item.id === sourceId;
      }
      return false;
    }) ?? null
  );
}

function sectionScope(
  content: ContactFormContent | undefined,
  kind: FormKind,
): FormScopeSnapshot | null {
  if (!content) return null;
  if (kind === "glass_washing") return content.glassScope ?? null;
  if (kind === "furniture_cleaning") return content.furnitureScope ?? null;
  return content.scope ?? null;
}

function findFormBlockByType(
  page: CmsPage,
  type: "contactForm" | "quoteRequestForm",
): { blockId: string } | null {
  const block = page.blocks.find((b) => b.type === type);
  return block ? { blockId: block.id } : null;
}

/**
 * Resolve authoritative form scope from a published CMS page.
 * Legacy fixed:* aliases and canonical builtin:* sourceKeys both resolve.
 * Historical formId continues to use FIXED_FORM_SOURCE_IDS for Aanvragen continuity.
 */
export function resolvePublishedFormScope(
  page: CmsPage | null | undefined,
  input: { pageId: string; sourceId: string; kind: FormKind },
): ResolvePublishedFormResult {
  const pageId = input.pageId.trim();
  const sourceId = input.sourceId.trim();
  const kind = input.kind;

  if (!pageId || !sourceId) {
    return { ok: false, reason: "Ongeldig formulier.", code: "invalid" };
  }
  if (!page || page.id !== pageId) {
    return { ok: false, reason: "Formulier niet gevonden.", code: "not_found" };
  }

  const formId = composeWebsiteFormId(pageId, sourceId);
  const canonical = resolveCanonicalFormSourceKey(sourceId);

  if (
    sourceId === FIXED_FORM_SOURCE_IDS.contactForm ||
    canonical === CANONICAL_FORM_SOURCE_KEYS.contact
  ) {
    if (kind !== "inquiry") {
      return { ok: false, reason: "Ongeldig formuliertype.", code: "kind_mismatch" };
    }
    const layoutId = fixedLayoutId("contact.form");
    const fixedItem =
      findLayoutItem(page, layoutId) ??
      findLayoutItem(page, FIXED_FORM_SOURCE_IDS.contactForm);
    const migrated = findFormBlockByType(page, "contactForm");
    if (!fixedItem && !migrated) {
      return { ok: false, reason: "Formulier niet gevonden.", code: "not_found" };
    }
    if (fixedItem && isLayoutItemHidden(fixedItem)) {
      return { ok: false, reason: "Dit formulier is niet beschikbaar.", code: "hidden" };
    }
    if (migrated) {
      const layoutItem =
        page.layout.find((item) => item.kind === "block" && item.blockId === migrated.blockId) ??
        null;
      if (layoutItem && isLayoutItemHidden(layoutItem)) {
        return { ok: false, reason: "Dit formulier is niet beschikbaar.", code: "hidden" };
      }
      const block = page.blocks.find((b) => b.id === migrated.blockId);
      if (block?.type === "contactForm") {
        const def = getBlockDataDefinition("contactForm");
        const data = def.normalize(block.data) as ContactFormBlockData;
        return {
          ok: true,
          form: {
            formId: composeWebsiteFormId(pageId, FIXED_FORM_SOURCE_IDS.contactForm),
            pageId,
            sourceId: FIXED_FORM_SOURCE_IDS.contactForm,
            kind,
            scope: data.scope ?? null,
          },
        };
      }
    }
    const content = page.sectionContent?.["contact.form"] as ContactFormContent | undefined;
    return {
      ok: true,
      form: {
        formId: composeWebsiteFormId(pageId, FIXED_FORM_SOURCE_IDS.contactForm),
        pageId,
        sourceId: FIXED_FORM_SOURCE_IDS.contactForm,
        kind,
        scope: sectionScope(content, kind),
      },
    };
  }

  if (
    sourceId === FIXED_FORM_SOURCE_IDS.offerteForm ||
    canonical === CANONICAL_FORM_SOURCE_KEYS.offerte
  ) {
    if (kind !== "glass_washing" && kind !== "furniture_cleaning") {
      return { ok: false, reason: "Ongeldig formuliertype.", code: "kind_mismatch" };
    }
    const layoutId = fixedLayoutId("offerte.form");
    const fixedItem =
      findLayoutItem(page, layoutId) ??
      findLayoutItem(page, FIXED_FORM_SOURCE_IDS.offerteForm);
    const migrated = findFormBlockByType(page, "quoteRequestForm");
    if (!fixedItem && !migrated) {
      return { ok: false, reason: "Formulier niet gevonden.", code: "not_found" };
    }
    if (fixedItem && isLayoutItemHidden(fixedItem)) {
      return { ok: false, reason: "Dit formulier is niet beschikbaar.", code: "hidden" };
    }
    if (migrated) {
      const layoutItem =
        page.layout.find((item) => item.kind === "block" && item.blockId === migrated.blockId) ??
        null;
      if (layoutItem && isLayoutItemHidden(layoutItem)) {
        return { ok: false, reason: "Dit formulier is niet beschikbaar.", code: "hidden" };
      }
    }
    const content = page.sectionContent?.["offerte.form"] as ContactFormContent | undefined;
    return {
      ok: true,
      form: {
        formId: composeWebsiteFormId(pageId, FIXED_FORM_SOURCE_IDS.offerteForm),
        pageId,
        sourceId: FIXED_FORM_SOURCE_IDS.offerteForm,
        kind,
        scope: sectionScope(content, kind),
      },
    };
  }

  if (
    sourceId === FIXED_FORM_SOURCE_IDS.vacaturesApplication ||
    canonical === CANONICAL_FORM_SOURCE_KEYS.vacatures
  ) {
    if (kind !== "job_application") {
      return { ok: false, reason: "Ongeldig formuliertype.", code: "kind_mismatch" };
    }
    const mainItem = findLayoutItem(page, fixedLayoutId("vacatures.main"));
    if (mainItem && isLayoutItemHidden(mainItem)) {
      return { ok: false, reason: "Dit formulier is niet beschikbaar.", code: "hidden" };
    }
    const content = page.sectionContent?.["vacatures.main"] as VacaturesMainContent | undefined;
    return {
      ok: true,
      form: {
        formId: composeWebsiteFormId(pageId, FIXED_FORM_SOURCE_IDS.vacaturesApplication),
        pageId,
        sourceId: FIXED_FORM_SOURCE_IDS.vacaturesApplication,
        kind,
        scope: content?.applicationScope ?? null,
      },
    };
  }

  const block = page.blocks.find((b) => b.id === sourceId);
  if (!block) {
    return { ok: false, reason: "Formulier niet gevonden.", code: "not_found" };
  }

  const layoutItem =
    page.layout.find((item) => item.kind === "block" && item.blockId === sourceId) ?? null;
  if (layoutItem && isLayoutItemHidden(layoutItem)) {
    return { ok: false, reason: "Dit formulier is niet beschikbaar.", code: "hidden" };
  }

  if (block.type === "contactForm") {
    if (kind !== "inquiry") {
      return { ok: false, reason: "Ongeldig formuliertype.", code: "kind_mismatch" };
    }
    const def = getBlockDataDefinition("contactForm");
    const data = def.normalize(block.data) as ContactFormBlockData;
    return {
      ok: true,
      form: {
        formId,
        pageId,
        sourceId,
        kind,
        scope: data.scope ?? null,
      },
    };
  }

  if (block.type === "newsletter") {
    if (kind !== "newsletter") {
      return { ok: false, reason: "Ongeldig formuliertype.", code: "kind_mismatch" };
    }
    const def = getBlockDataDefinition("newsletter");
    const data = def.normalize(block.data) as NewsletterBlockData;
    return {
      ok: true,
      form: {
        formId,
        pageId,
        sourceId,
        kind,
        scope: data.scope ?? null,
      },
    };
  }

  return { ok: false, reason: "Formulier niet gevonden.", code: "not_found" };
}
