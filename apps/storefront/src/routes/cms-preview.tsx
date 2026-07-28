import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import {
  CMS_PREVIEW_CHANNEL,
  isPreviewParentMessage,
  localizeCmsPageForLocale,
  resolveAdminParentOrigins,
  type BuiltinPageKey,
  type PreviewSnapshot,
} from "@mccoy/cms-schema";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { BlocksView } from "@/components/site/BlockView";
import { PreviewSnapshotProvider } from "@/lib/cms/preview-snapshot-context";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useActiveCmsLocale } from "@/lib/cms/use-active-cms-locale";

export const Route = createFileRoute("/cms-preview")({
  head: () => ({
    meta: [
      { title: "CMS Preview — McCoy (noindex)" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    pageId: typeof search.pageId === "string" ? search.pageId : "",
    /** D3 — authenticated preview locale; ignored on public routes. */
    _cmsLocale:
      search._cmsLocale === "en" || search._cmsLocale === "nl"
        ? (search._cmsLocale as "nl" | "en")
        : undefined,
  }),
  component: CmsPreviewFrame,
});

/**
 * Preview iframe target. Does NOT read unpublished drafts from localStorage.
 * Renders only an explicit snapshot delivered via origin-checked postMessage.
 */
function CmsPreviewFrame() {
  const { pageId } = Route.useSearch();
  const [snapshot, setSnapshot] = React.useState<PreviewSnapshot | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pageId) {
      setError("Missing pageId");
      return;
    }

    const allowedParents = resolveAdminParentOrigins({
      currentOrigin: window.location.origin,
      envAdminOrigin: import.meta.env.VITE_ADMIN_ORIGIN as string | undefined,
      referrer: document.referrer,
    });

    const onMessage = (event: MessageEvent) => {
      if (!allowedParents.includes(event.origin)) return;
      if (!isPreviewParentMessage(event.data)) return;
      if (event.data.type === "preview-clear") {
        setSnapshot(null);
        return;
      }
      if (event.data.type !== "preview-snapshot") return;
      if (event.data.snapshot.pageId !== pageId) return;
      setSnapshot(event.data.snapshot);
      setError(null);
    };

    window.addEventListener("message", onMessage);

    for (const origin of allowedParents) {
      try {
        window.parent.postMessage(
          { channel: CMS_PREVIEW_CHANNEL, type: "preview-ready", pageId },
          origin,
        );
      } catch {
        /* ignore */
      }
    }

    return () => window.removeEventListener("message", onMessage);
  }, [pageId]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-red-400 text-sm">
        {error}
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-white/50 text-sm">
        Wachten op preview-snapshot…
      </div>
    );
  }

  return (
    <PreviewSnapshotProvider snapshot={snapshot}>
      <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <Navbar />
        <main className={snapshot.page.id === "page_home" ? "" : "pt-24 pb-16"}>
          <PageFromSnapshot snapshot={snapshot} />
        </main>
        <Footer />
      </div>
    </PreviewSnapshotProvider>
  );
}

const PAGE_KEY_BY_ID: Record<string, BuiltinPageKey> = {
  page_home: "home",
  page_about: "about",
  page_services: "services",
  page_products: "products",
  page_contact: "contact",
  page_vacatures: "vacatures",
  page_offerte: "offerte",
  page_privacy: "privacy",
  page_terms: "terms",
};

function PageFromSnapshot({ snapshot }: { snapshot: PreviewSnapshot }) {
  const locale = useActiveCmsLocale();
  const page = localizeCmsPageForLocale(snapshot.page, locale);

  if (page.isCustom) {
    return <BlocksView blocks={page.blocks} pageId={page.id} />;
  }

  const pageKey =
    (page.kind === "builtin" ? page.pageKey : null) ?? PAGE_KEY_BY_ID[page.id] ?? null;

  if (!pageKey) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-white/60 text-sm">
        Preview voor deze vaste pagina toont paginasecties en vaste inhoud.
        <BlocksView blocks={page.blocks} pageId={page.id} />
      </div>
    );
  }

  return (
    <PageLayoutRenderer
      page={page}
      pageKey={pageKey}
      renderers={pageSectionRenderers}
      mode="preview"
      respectHidden
    />
  );
}
