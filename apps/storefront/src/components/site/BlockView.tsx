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
import { type Block, type QuoteFormKind, sanitizePublicCmsImageTree } from "@mccoy/cms-schema";
import type { FormKind, UploadedFormAttachment } from "@mccoy/domain";
import { submitWebsiteForm } from "@/lib/api/forms.functions";
import { uploadWebsiteFormAttachments } from "@/lib/forms/upload-client";
import { usesStorefrontPresentationAdapter } from "./block-presentation";
import { renderStorefrontPresentationAdapter } from "./blockPresentationAdapters";

async function uploadFilesForSubmit(input: {
  kind: FormKind;
  pageId: string;
  sourceId: string;
  fields: Record<string, string>;
  files?: File[];
  website?: string;
}): Promise<UploadedFormAttachment[]> {
  const files = input.files ?? [];
  if (!files.length) return [];
  return uploadWebsiteFormAttachments({
    kind: input.kind,
    pageId: input.pageId,
    sourceId: input.sourceId,
    fields: input.fields,
    files,
    website: input.website,
  });
}

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
    try {
      const uploadedAttachments = await uploadFilesForSubmit({
        kind: "inquiry",
        pageId: input.pageId,
        sourceId: input.blockId,
        fields: input.fields,
        files: input.files,
        website: input.website,
      });
      const result = await submitWebsiteForm({
        data: {
          kind: "inquiry",
          pageId: input.pageId,
          sourceId: input.blockId,
          fields: {
            ...input.fields,
            sourceBlockId: input.blockId.slice(0, 64),
          },
          uploadedAttachments,
          website: input.website ?? "",
        },
      });
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : "Bestanden konden niet worden geüpload.",
      };
    }
  },
  async submitQuoteForm(input) {
    const kind = input.kind as QuoteFormKind;
    try {
      const uploadedAttachments = await uploadFilesForSubmit({
        kind,
        pageId: input.pageId,
        sourceId: input.blockId,
        fields: input.fields,
        files: input.files,
        website: input.website,
      });
      const result = await submitWebsiteForm({
        data: {
          kind,
          pageId: input.pageId,
          sourceId: input.blockId,
          fields: {
            ...input.fields,
            sourceBlockId: input.blockId.slice(0, 64),
          },
          uploadedAttachments,
          website: input.website ?? "",
        },
      });
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : "Bestanden konden niet worden geüpload.",
      };
    }
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
  // Public delivery: replace generic CMS alts without touching cms-renderer.
  const publicBlock = adminMode ? block : sanitizePublicCmsImageTree(block);
  const presentation = usesStorefrontPresentationAdapter(publicBlock)
    ? renderStorefrontPresentationAdapter(publicBlock)
    : null;
  const rendered = presentation ?? (
    <RegisteredBlockView block={publicBlock} adminMode={adminMode} />
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
