import { createFileRoute, Link } from "@tanstack/react-router";
import { Globe2, Inbox, Users, Package, TrendingUp, ArrowUpRight, Activity, Sparkles } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

const STATS = [
  { label: "Aanvragen (7d)", value: "24", delta: "+18%", icon: Inbox, tone: "from-[#1e88e5] to-[#22d3ee]" },
  { label: "Website bezoekers", value: "1.842", delta: "+6%", icon: Globe2, tone: "from-[#7c3aed] to-[#ec4899]" },
  { label: "Actieve gebruikers", value: "8", delta: "+2", icon: Users, tone: "from-[#22c55e] to-[#84cc16]" },
  { label: "Producten", value: "42", delta: "live", icon: Package, tone: "from-[#f59e0b] to-[#ef4444]" },
];

const SECTIONS = [
  {
    to: "/admin/website",
    label: "Website",
    desc: "Beheer content, pagina's en SEO-instellingen van de publieke site.",
    icon: Globe2,
    accent: "#1e88e5",
  },
  {
    to: "/admin/inquiries",
    label: "Aanvragen",
    desc: "Inkomende offertes, glasbewassing, meubels en algemene vragen.",
    icon: Inbox,
    accent: "#22d3ee",
  },
  {
    to: "/admin/users",
    label: "Gebruikers",
    desc: "Teamleden, rollen en toegang tot het admin control center.",
    icon: Users,
    accent: "#a78bfa",
  },
  {
    to: "/admin/products",
    label: "Producten",
    desc: "Catalogus, dispensers, geuren en abonnementen.",
    icon: Package,
    accent: "#f59e0b",
  },
] as const;

const ACTIVITY = [
  { t: "2 min", text: "Nieuwe aanvraag — Glasbewassing", tag: "Inquiry" },
  { t: "1 uur", text: "Sollicitatie ontvangen — Objectleider", tag: "Vacature" },
  { t: "3 uur", text: "Product bijgewerkt — Aromatic Amber", tag: "Product" },
  { t: "Gisteren", text: "Nieuw teamlid uitgenodigd — maria@rekp.ai", tag: "User" },
];

function AdminOverview() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1e88e5]/20 via-[#7c3aed]/10 to-transparent p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(30,136,229,0.35),transparent_60%)]" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white/70 backdrop-blur">
            <Sparkles className="h-3 w-3" /> Control center
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Welkom terug 👋</h1>
          <p className="mt-1 max-w-xl text-sm text-white/60">
            Alles wat er op de website en binnen McCoy gebeurt, overzichtelijk op één plek.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]"
            >
              <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${s.tone} opacity-20 blur-2xl transition-opacity group-hover:opacity-40`} />
              <div className="relative flex items-center justify-between">
                <div className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${s.tone} shadow-lg`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  <TrendingUp className="h-3 w-3" /> {s.delta}
                </span>
              </div>
              <div className="relative mt-3">
                <div className="text-2xl font-bold tracking-tight">{s.value}</div>
                <div className="mt-0.5 text-[11px] text-white/50">{s.label}</div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Sections grid */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/50">Secties</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            return (
              <Link
                key={sec.to}
                to={sec.to}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06]"
              >
                <div
                  className="absolute inset-x-0 top-0 h-[2px] scale-x-0 bg-gradient-to-r from-transparent to-transparent transition-transform duration-500 group-hover:scale-x-100"
                  style={{ backgroundImage: `linear-gradient(90deg, transparent, ${sec.accent}, transparent)` }}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${sec.accent}22`, color: sec.accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold">{sec.label}</div>
                      <div className="text-xs text-white/50">Beheren</div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-white/40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
                </div>
                <p className="mt-3 text-sm text-white/60">{sec.desc}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Activity */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#1e88e5]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">Recente activiteit</h2>
        </div>
        <ul className="divide-y divide-white/5">
          {ACTIVITY.map((a, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-2 w-2 shrink-0 rounded-full bg-[#1e88e5] shadow-[0_0_10px_rgba(30,136,229,0.8)]" />
                <span className="truncate text-sm">{a.text}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60 sm:inline">{a.tag}</span>
                <span className="text-xs text-white/40">{a.t}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}