import * as React from "react";
import { localizeCmsPageForLocale } from "@mccoy/cms-schema";
import { useCms } from "@/lib/cms/store";
import { useActiveCmsLocale } from "@/lib/cms/use-active-cms-locale";
import { BlocksView } from "@/components/site/BlockView";

const PAGE_IDS: Record<string, string> = {
  "/": "page_home",
  "/about": "page_about",
  "/services": "page_services",
  "/products": "page_products",
  "/contact": "page_contact",
  "/vacatures": "page_vacatures",
};

/** Renders published extraBlocks after fixed sections on builtin pages. */
export function BuiltinExtraBlocks({ path }: { path: string }) {
  const state = useCms();
  const locale = useActiveCmsLocale();
  const pageId = PAGE_IDS[path.replace(/\/$/, "") || "/"];
  if (!pageId) return null;
  const raw = state.pages.find((p) => p.id === pageId);
  if (!raw) return null;
  const page = localizeCmsPageForLocale(raw, locale);
  const blocks = page.extraBlocks ?? [];
  if (!blocks.length) return null;
  return <BlocksView blocks={blocks} pageId={pageId} />;
}
