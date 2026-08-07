import type { Locale } from "@mccoy/cms-schema";

/**
 * Storefront URL for the Admin website edit/preview iframe.
 *
 * Locale uses `?_cmsLocale=` (authenticated preview) on the NL page path so
 * unpublished EN does not 302 away from the draft canvas. Equivalent to
 * loading `/en/...` for translation review.
 */
export function buildStorefrontEditCanvasUrl(input: {
  origin: string;
  slug: string;
  pageId: string;
  locale: Locale;
}): string {
  const origin = input.origin.replace(/\/$/, "");
  const path =
    input.slug === "/"
      ? "/"
      : input.slug.startsWith("/")
        ? input.slug
        : `/${input.slug}`;
  const q = new URLSearchParams({
    _cmsMode: "edit",
    _cmsPage: input.pageId,
    _cmsLocale: input.locale,
  });
  return `${origin}${path}?${q.toString()}`;
}
