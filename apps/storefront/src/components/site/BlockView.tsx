import {
  CmsFormAdaptersProvider,
  CmsPageIdProvider,
  RegisteredBlockView,
  type CmsFormAdapters,
} from "@mccoy/cms-renderer";
import {
  cmsTextOrFallback,
  parseBlockData,
  productAssortmentTemplateData,
  productIntroTemplateData,
  resolveLegacyLinkAsCmsButton,
  type Block,
  type CmsButton,
  type CmsImage,
  type CmsLink,
} from "@mccoy/cms-schema";
import { submitWebsiteForm } from "@/lib/api/forms.functions";
import { useI18n } from "@/lib/i18n";
import {
  ProductsAssortmentView,
  ProductsIntroView,
} from "@/components/site/sections/ProductsBlockViews";

const ASSORTMENT_CARD_EN: Record<string, { title: string; body: string }> = {
  prod_hygiene: {
    title: "Hygiene paper",
    body: "Professional hygiene paper for washrooms, kitchens and commercial buildings.",
  },
  prod_soaps: {
    title: "Professional soaps",
    body: "High-quality soaps and dispensers for a fresh, presentable sanitary space.",
  },
  prod_agents: {
    title: "Cleaning agents & hardware",
    body: "Cleaning agents for hospitality plus equipment and hardware for cleaning.",
  },
};

const ASSORTMENT_INTRO_EN =
  "Hygiene paper, professional soaps, cleaning agents and hardware for a fresh, presentable environment.";
const ASSORTMENT_EYEBROW_EN = "Our range";

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
};

function ProductsPresentationBlock({ block }: { block: Block }) {
  const { t, lang } = useI18n();
  const parsed = parseBlockData(block.type, block.data);
  if (!parsed.ok) return null;
  const d = parsed.data as Record<string, unknown>;

  if (block.type === "textImage" && d.presentation === "productsIntro") {
    const isEn = lang === "en";
    const def = productIntroTemplateData;
    const metrics = Array.isArray(d.metrics)
      ? (d.metrics as Array<{ id?: string; value?: string; label?: string }>).map((m) => ({
          id: typeof m.id === "string" ? m.id : undefined,
          value: typeof m.value === "string" ? m.value : "",
          label: typeof m.label === "string" ? m.label : "",
        }))
      : null;
    const rawEyebrow = typeof d.eyebrow === "string" ? d.eyebrow : "";
    const rawTitle = String(d.title ?? "");
    const rawBody = typeof d.body === "string" ? d.body : "";
    const rawNotice = typeof d.notice === "string" ? d.notice : "";
    const headingFallback = isEn
      ? "Fragrance products with a premium sanitary experience."
      : def.title;
    const introFallback = isEn
      ? "An important part of McCoy Cleaning is McCoy Products, our wholesale division. In our range you will find: hygiene paper, professional soaps, cleaning agents for hospitality, and equipment and hardware for cleaning.\n\nTo obtain our products, you can call or contact us via the contact form; we will be happy to help you."
      : def.body;
    const noticeFallback = isEn
      ? "We are currently busy behind the scenes with the online webshop! Coming soon."
      : def.notice;
    return (
      <ProductsIntroView
        eyebrow={cmsTextOrFallback(rawEyebrow, t.products.kicker, def.eyebrow)}
        heading={cmsTextOrFallback(rawTitle, headingFallback, def.title)}
        intro={cmsTextOrFallback(rawBody, introFallback, def.body)}
        notice={cmsTextOrFallback(rawNotice, noticeFallback, def.notice)}
        image={(d.image as CmsImage | undefined) ?? null}
        ctaLabel={t.products.cta}
        isEn={isEn}
        metrics={metrics}
      />
    );
  }

  if (block.type === "featureGrid" && d.presentation === "productsAssortment") {
    const isEn = lang === "en";
    const def = productAssortmentTemplateData;
    const features =
      (d.features as Array<{
        id: string;
        title: string;
        body: string;
        link?: CmsLink;
        cta?: CmsButton;
      }>) ?? [];
    const rawEyebrow = typeof d.eyebrow === "string" ? d.eyebrow : "";
    const rawTitle = String(d.title ?? "");
    const rawIntro = typeof d.intro === "string" ? d.intro : "";
    const eyebrowFallback = isEn ? ASSORTMENT_EYEBROW_EN : def.eyebrow;
    const introFallback = isEn ? ASSORTMENT_INTRO_EN : def.intro;
    const defaultCtaLabel = isEn ? t.products.cta : "Productofferte aanvragen";
    const cards = features.map((f) => {
      const factory = def.features.find((item) => item.id === f.id);
      const enCard = ASSORTMENT_CARD_EN[f.id];
      const titleFallback = isEn && enCard ? enCard.title : f.title;
      const bodyFallback = isEn && enCard ? enCard.body : f.body;
      const cta = resolveLegacyLinkAsCmsButton(f.cta, f.link, defaultCtaLabel);
      return {
        id: f.id,
        title: cmsTextOrFallback(f.title, titleFallback, factory?.title),
        description: cmsTextOrFallback(f.body, bodyFallback, factory?.body),
        cta: cta
          ? {
              ...cta,
              label: cmsTextOrFallback(cta.label, isEn ? t.products.cta : cta.label, factory?.cta?.label),
            }
          : null,
      };
    });

    return (
      <ProductsAssortmentView
        eyebrow={cmsTextOrFallback(rawEyebrow, eyebrowFallback, def.eyebrow)}
        heading={cmsTextOrFallback(rawTitle, t.products.title, def.title)}
        intro={cmsTextOrFallback(rawIntro, introFallback, def.intro)}
        cards={cards}
      />
    );
  }

  return null;
}

function usesProductsPresentation(block: Block): boolean {
  const parsed = parseBlockData(block.type, block.data);
  if (!parsed.ok) return false;
  const presentation = (parsed.data as { presentation?: string }).presentation;
  return (
    (block.type === "textImage" && presentation === "productsIntro") ||
    (block.type === "featureGrid" && presentation === "productsAssortment")
  );
}

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
  const rendered = usesProductsPresentation(block) ? (
    <ProductsPresentationBlock block={block} />
  ) : (
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
