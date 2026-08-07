import {
  homeHeroMigrationBlockId,
  resolveHomeHeroBlocksLayout,
  type BuiltinCmsPage,
  type CmsPage,
} from "@mccoy/cms-schema";

const FALLBACK_HERO_SRC = "/images/cms/hero-cleaning.jpg";

/** Resolve LCP hero image from migrated hero block or legacy fixed section. */
export function resolveHomeHeroImageSrc(page: CmsPage | undefined | null): string {
  if (!page || page.kind !== "builtin" || page.pageKey !== "home") {
    return FALLBACK_HERO_SRC;
  }
  const resolved = resolveHomeHeroBlocksLayout(page as BuiltinCmsPage).page;
  const heroId = homeHeroMigrationBlockId(resolved.id);
  const block =
    resolved.blocks.find((b) => b.id === heroId && b.type === "hero") ??
    resolved.blocks.find((b) => b.type === "hero");
  const fromBlock =
    block?.data && typeof block.data === "object"
      ? (block.data as { image?: { src?: string } }).image?.src
      : undefined;
  if (typeof fromBlock === "string" && fromBlock.trim()) return fromBlock;

  const fromFixed = (
    resolved.sectionContent?.["home.hero"] as { image?: { src?: string } } | undefined
  )?.image?.src;
  if (typeof fromFixed === "string" && fromFixed.trim()) return fromFixed;

  return FALLBACK_HERO_SRC;
}
