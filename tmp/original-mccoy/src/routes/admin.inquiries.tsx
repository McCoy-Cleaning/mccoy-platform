import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { Inbox, Briefcase, GlassWater, Sofa, HelpCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/AdminBits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/inquiries")({
  component: InquiriesPage,
});

type Category = "all" | "job" | "glass" | "furniture" | "general";

const FILTERS: { id: Category; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { id: "all", label: "Alles", icon: Inbox, color: "#e8e8f0" },
  { id: "job", label: "Sollicitatie", icon: Briefcase, color: "#a78bfa" },
  { id: "glass", label: "Glasbewassing", icon: GlassWater, color: "#22d3ee" },
  { id: "furniture", label: "Meubels", icon: Sofa, color: "#f59e0b" },
  { id: "general", label: "Algemeen", icon: HelpCircle, color: "#22c55e" },
];

const MOCK = [
  { id: 1, cat: "glass" as Category, from: "Jan de Vries", subject: "Glasbewassing kantoorpand Enschede", time: "2 min", unread: true },
  { id: 2, cat: "job" as Category, from: "Sophie Bakker", subject: "Sollicitatie objectleider", time: "1 uur", unread: true },
  { id: 3, cat: "general" as Category, from: "Peter Jansen", subject: "Vraag over dienstverlening", time: "3 uur", unread: false },
  { id: 4, cat: "furniture" as Category, from: "Meubelbank Twente", subject: "Aanvraag ophaling banken", time: "Gisteren", unread: false },
  { id: 5, cat: "glass" as Category, from: "Restaurant De Bonte Koe", subject: "Periodiek onderhoud ramen", time: "2d", unread: false },
];

function InquiriesPage() {
  const [active, setActive] = React.useState<Category>("all");
  const [q, setQ] = React.useState("");
  const filtered = MOCK.filter((m) => (active === "all" || m.cat === active) && (q === "" || m.subject.toLowerCase().includes(q.toLowerCase()) || m.from.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader icon={Inbox} accent="#22d3ee" title="Aanvragen" subtitle="Alle inkomende berichten, gecategoriseerd." />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek op naam of onderwerp..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-10 py-2.5 text-sm outline-none transition focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
          />
        </div>
      </div>

      {/* Segmented filter */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const isActive = active === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActive(f.id)}
              className={cn(
                "group relative flex shrink-0 snap-start items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all",
                isActive
                  ? "border-transparent bg-white text-[#0a0a0f] shadow-lg"
                  : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-white/50">Geen aanvragen gevonden.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {filtered.map((m) => {
              const meta = FILTERS.find((f) => f.id === m.cat)!;
              const Icon = meta.icon;
              return (
                <li key={m.id} className="group flex cursor-pointer items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.04]">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10" style={{ backgroundColor: `${meta.color}22`, color: meta.color }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold">{m.from}</div>
                      {m.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1e88e5] shadow-[0_0_8px_rgba(30,136,229,0.9)]" />}
                    </div>
                    <div className="truncate text-xs text-white/50">{m.subject}</div>
                  </div>
                  <div className="shrink-0 text-xs text-white/40">{m.time}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}