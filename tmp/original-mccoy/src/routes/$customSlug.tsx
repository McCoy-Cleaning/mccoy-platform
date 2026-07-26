import { createFileRoute, notFound } from "@tanstack/react-router";
import { useCms } from "@/lib/cms/store";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { BlocksView } from "@/components/admin/cms/BlockView";

export const Route = createFileRoute("/$customSlug")({
  head: ({ params }) => {
    return {
      meta: [
        { title: `${params.customSlug} — McCoy Cleaning` },
      ],
    };
  },
  component: CustomSlugPage,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground">
      <div className="text-center space-y-2">
        <div className="text-6xl font-black">404</div>
        <div className="text-white/60">Pagina niet gevonden</div>
      </div>
    </div>
  ),
});

function CustomSlugPage() {
  const { customSlug } = Route.useParams();
  const state = useCms();
  const slug = `/${customSlug}`;
  const page = state.pages.find(
    (p) => p.isCustom && !p.isDraftOnly && p.slug === slug,
  );

  if (!page) throw notFound();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16">
        <BlocksView blocks={page.blocks} />
      </main>
      <Footer />
    </div>
  );
}