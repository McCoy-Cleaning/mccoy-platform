/**
 * Thin storefront block entry — form adapters + optional presentation adapters,
 * then canonical `@mccoy/cms-renderer` RegisteredBlockView.
 *
 * R7: no BlockType mega-switch here. Presentation adapters are dual-read brand
 * chrome for Producten/About until MG5; everything else uses the registry.
 */

import {
  CmsFormAdaptersProvider,
  CmsPageIdProvider,
  RegisteredBlockView,
  type CmsFormAdapters,
} from "@mccoy/cms-renderer";
import { type Block, type QuoteFormKind } from "@mccoy/cms-schema";
import { submitWebsiteForm } from "@/lib/api/forms.functions";
import { usesStorefrontPresentationAdapter } from "./block-presentation";
import { renderStorefrontPresentationAdapter } from "./blockPresentationAdapters";

const storefrontFormAdapters: CmsFormAdapters = {
  async submitNewsletter(input) {
    const result = await submitWebsiteForm({
      data: {
        kind: "newsletter",
        pageId: input.pageId,
        sourceId: input.blockId,
        fields: {
          email: input.email,
          consentAccepted: input.consentAccepted ? "true" : "false",
          sourceBlockId: input.blockId.slice(0, 64),
        },
        website: input.website ?? "",
      },
    });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true };
  },
  async submitContactForm(input) {
    const result = await submitWebsiteForm({
      data: {
        kind: "inquiry",
        pageId: input.pageId,
        sourceId: input.blockId,
        fields: {
          ...input.fields,
          sourceBlockId: input.blockId.slice(0, 64),
        },
        website: input.website ?? "",
      },
    });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true };
  },
  async submitQuoteForm(input) {
    const kind = input.kind as QuoteFormKind;
    const result = await submitWebsiteForm({
      data: {
        kind,
        pageId: input.pageId,
        sourceId: input.blockId,
        fields: {
          ...input.fields,
          sourceBlockId: input.blockId.slice(0, 64),
        },
        website: input.website ?? "",
      },
    });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true };
  },
};

/** Public + preview block renderer — single implementation via cms-renderer. */
export function BlockView({
  block,
  adminMode = false,
  pageId,
}: {
  block: Block;
  adminMode?: boolean;
  pageId?: string;
}) {
  const presentation = usesStorefrontPresentationAdapter(block)
    ? renderStorefrontPresentationAdapter(block)
    : null;
  const rendered = presentation ?? (
    <RegisteredBlockView block={block} adminMode={adminMode} />
  );

  const withAdapters = (
    <CmsFormAdaptersProvider adapters={adminMode ? {} : storefrontFormAdapters}>
      {rendered}
    </CmsFormAdaptersProvider>
  );
  if (!pageId) return withAdapters;
  return <CmsPageIdProvider pageId={pageId}>{withAdapters}</CmsPageIdProvider>;
}

export function BlocksView({
  blocks,
  adminMode = false,
  pageId,
}: {
  blocks: Block[];
  adminMode?: boolean;
  pageId?: string;
}) {
  // Width/padding live in cms-renderer SectionShell so all CMS sections stay aligned.
  return (
    <>
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} adminMode={adminMode} pageId={pageId} />
      ))}
    </>
  );
}
