import { createFileRoute } from "@tanstack/react-router";
import { Package, Plus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/admin/AdminBits";

export const Route = createFileRoute("/admin/products")({
  component: ProductsAdminPage,
});

const PRODUCTS = [
  { name: "Luxe dispenser — Wood Noir", cat: "Dispenser", price: "op aanvraag", stock: "Voorraad" },
  { name: "Geur — Allure", cat: "Luxe geur", price: "€ 24,50", stock: "Voorraad" },
  { name: "Geur — Ibiza Vibes", cat: "Luxe geur", price: "€ 24,50", stock: "Voorraad" },
  { name: "Geur — Aromatic Amber", cat: "Luxe geur", price: "€ 24,50", stock: "Voorraad" },
  { name: "Geur — Eucalyptus", cat: "Basis geur", price: "€ 14,50", stock: "Voorraad" },
  { name: "Geur — Lavendel", cat: "Basis geur", price: "€ 14,50", stock: "Voorraad" },
];

function ProductsAdminPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Package}
        accent="#f59e0b"
        title="Producten"
        subtitle="Catalogus, dispensers, geuren en abonnementen."
        actions={[{ label: "Toevoegen", icon: Plus }]}
      />

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <div className="hidden grid-cols-[1.5fr_1fr_1fr_auto] gap-4 border-b border-white/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/50 sm:grid">
          <div>Product</div>
          <div>Categorie</div>
          <div>Prijs</div>
          <div>Status</div>
        </div>
        <ul className="divide-y divide-white/5">
          {PRODUCTS.map((p) => (
            <li
              key={p.name}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-5 py-4 transition hover:bg-white/[0.04] sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#f59e0b]/30 to-[#ef4444]/20 text-[#f59e0b]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="truncate text-xs text-white/50 sm:hidden">{p.cat} · {p.price}</div>
                </div>
              </div>
              <div className="hidden text-sm text-white/70 sm:block">{p.cat}</div>
              <div className="hidden text-sm text-white/70 sm:block">{p.price}</div>
              <div className="justify-self-end">
                <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                  {p.stock}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}