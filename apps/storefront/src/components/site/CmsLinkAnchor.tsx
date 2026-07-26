import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  resolveCmsLinkHref,
  linkRel,
  linkTarget,
  type CmsLink,
} from "@mccoy/cms-schema";
import { useCms } from "@/lib/cms/store";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { cn } from "@/lib/utils";

/**
 * Renders a CmsLink as either a TanStack route link or an <a>.
 * In Bewerken, clicks select/edit only — navigation is blocked by EditInteractionGuard.
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
  const pages = React.useMemo(
    () => state.pages.map((p) => ({ id: p.id, slug: p.slug })),
    [state.pages],
  );
  const href = resolveCmsLinkHref(link, pages) ?? fallbackHref;
  const external = link?.type === "external";
  const target = linkTarget(link) ?? (external ? "_blank" : undefined);
  const rel = linkRel(link) ?? (external ? "noopener noreferrer" : undefined);

  if (link?.type === "internal_route" || (link?.type === "internal" && href.startsWith("/"))) {
    // TanStack typed routes prefer `to`; use plain <a> for hash/query and edit safety.
    if (href.includes("#") || href.includes("?") || isEdit) {
      return (
        <a href={href} className={className} target={target} rel={rel} data-cms-nav={isEdit ? "" : undefined}>
          {children}
        </a>
      );
    }
    return (
      <Link to={href} className={className}>
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
  const pages = React.useMemo(
    () => state.pages.map((p) => ({ id: p.id, slug: p.slug })),
    [state.pages],
  );
  return resolveCmsLinkHref(link, pages) ?? fallback;
}
