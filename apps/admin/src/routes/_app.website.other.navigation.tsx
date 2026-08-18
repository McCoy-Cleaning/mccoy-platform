import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Navigation } from "lucide-react";
import { PageHeader } from "@/components/admin/AdminBits";
import { NavigationEditor } from "@/components/admin/cms/NavigationEditor";

export const Route = createFileRoute("/_app/website/other/navigation")({
  component: NavigationPage,
});

function NavigationPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 text-[11px] text-white/45">
        <Link to="/website" className="inline-flex items-center gap-1 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" />
          Website
        </Link>
        <span>/</span>
        <span>Overig</span>
        <span>/</span>
        <span className="text-white/70">Navigatie</span>
      </div>

      <PageHeader
        icon={Navigation}
        accent="#1e88e5"
        title="Navigatie"
        subtitle="Bewerk het sitebrede menu: logo, links en knoppen. Tablet deelt het compacte (mobiele) ontwerp."
      />

      <NavigationEditor />
    </div>
  );
}
