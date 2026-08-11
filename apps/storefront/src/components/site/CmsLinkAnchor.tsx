import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  resolveCmsLinkHref,
  linkRel,
  linkTarget,
  type CmsLink,
} from "@mccoy/cms-schema";
import { useCms } from "@/lib/cms/store";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { warmPublishedCmsOnNavIntent } from "@/lib/cms/published-hydrate";
import { prefetchMarketingPage } from "@/lib/cms/route-page-loader";
import { localeFromPathname, localizeInternalHref } from "@/lib/locale-path";
import { cn } from "@/lib/utils";

/**
 * Renders a CmsLink as either a TanStack route link or an <a>.
 * In Bewerken, clicks select/edit only — navigation is blocked by EditInteractionGuard.
 * Preserves `#hash` / `?query` and localizes to `/en/...` when on an English path.
 */
export function CmsLinkAnchor({
  link,
  className,
  children,
  fallbackHref = "#",
}: {
  link: CmsLink | null | undefined;
  className?: string;
  children: React.ReactNode;
  fallbackHref?: string;
}) {
  const state = useCms();
  const { isEdit } = useLiveEditApi();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pages = React.useMemo(
    () => state.pages.map((p) => ({ id: p.id, slug: p.slug, paths: p.paths })),
    [state.pages],
  );
  const locale = localeFromPathname(pathname);
  const rawHref = resolveCmsLinkHref(link, pages) ?? fallbackHref;
  const href =
    link?.type === "internal_route" || link?.type === "internal"
      ? localizeInternalHref(rawHref, locale, pages)
      : rawHref;
  const external = link?.type === "external";
  const target = linkTarget(link) ?? (external ? "_blank" : undefined);
  const rel = linkRel(link) ?? (external ? "noopener noreferrer" : undefined);

  if (link?.type === "internal_route" || (link?.type === "internal" && href.startsWith("/"))) {
    const warmNav = () => {
      warmPublishedCmsOnNavIntent();
      const path = href.split(/[?#]/)[0] ?? href;
      if (path.startsWith("/")) prefetchMarketingPage(path);
    };
    // TanStack typed routes prefer `to`; use plain <a> for hash/query and edit safety.
    if (href.includes("#") || href.includes("?") || isEdit) {
      return (
        <a
          href={href}
          className={className}
          target={target}
          rel={rel}
          data-cms-nav={isEdit ? "" : undefined}
          onMouseEnter={isEdit ? undefined : warmNav}
          onFocus={isEdit ? undefined : warmNav}
          onTouchStart={isEdit ? undefined : warmNav}
        >
          {children}
        </a>
      );
    }
    return (
      <Link
        to={href}
        preload="intent"
        className={className}
        onMouseEnter={warmNav}
        onFocus={warmNav}
        onTouchStart={warmNav}
      >
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={cn(className)} target={target} rel={rel} data-cms-nav={isEdit ? "" : undefined}>
      {children}
    </a>
  );
}

export function useResolvedCmsHref(link: CmsLink | null | undefined, fallback = "#"): string {
  const state = useCms();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pages = React.useMemo(
    () => state.pages.map((p) => ({ id: p.id, slug: p.slug, paths: p.paths })),
    [state.pages],
  );
  const locale = localeFromPathname(pathname);
  const raw = resolveCmsLinkHref(link, pages) ?? fallback;
  if (link?.type === "internal_route" || link?.type === "internal") {
    return localizeInternalHref(raw, locale, pages);
  }
  return raw;
}
