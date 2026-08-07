import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PanelBottom } from "lucide-react";
import { PageHeader } from "@/components/admin/AdminBits";
import { FooterEditor } from "@/components/admin/cms/FooterEditor";

export const Route = createFileRoute("/admin/website/other/footer")({
  component: FooterPage,
});

function FooterPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 text-[11px] text-white/45">
        <Link to="/admin/website" className="inline-flex items-center gap-1 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" />
          Website
        </Link>
        <span>/</span>
        <span>Overig</span>
        <span>/</span>
        <span className="text-white/70">Footer</span>
      </div>

      <PageHeader
        icon={PanelBottom}
        accent="#1e88e5"
        title="Footer"
        subtitle="Bewerk de sitebrede voettekst: logo, diensten, contact, keurmerken en juridische links."
      />

      <FooterEditor />
    </div>
  );
}
