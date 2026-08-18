import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Globe2,
  Inbox,
  Users,
  Package,
  TrendingUp,
  ArrowRight,
  Activity,
  Sparkles,
  Minus,
} from "lucide-react";

import {
  getAdminOverviewStats,
  type AdminOverviewStats,
} from "@/lib/api/admin-overview.functions";

export const Route = createFileRoute("/_app/")({
  component: AdminOverview,
});

type StatCard = {
  label: string;
  value: string;
  delta: string;
  deltaTone: "up" | "down" | "neutral" | "pending";
  icon: typeof Inbox;
  tone: string;
};

const SECTIONS = [
  {
    to: "/website",
    label: "Website aanpassen",
    desc: "Teksten, foto's en pagina's van uw website wijzigen — meteen zichtbaar in een voorbeeld.",
    icon: Globe2,
    accent: "#1e88e5",
    cta: "Website openen",
  },
  {
    to: "/inquiries",
    label: "Aanvragen bekijken",
    desc: "Berichten van klanten: offertes, glasbewassing, meubelreiniging en sollicitaties.",
    icon: Inbox,
    accent: "#22d3ee",
    cta: "Aanvragen openen",
  },
  {
    to: "/users",
    label: "Gebruikers beheren",
    desc: "Wie mag er in het beheer? Teamleden toevoegen en rechten instellen.",
    icon: Users,
    accent: "#a78bfa",
    cta: "Gebruikers openen",
  },
  {
    to: "/products",
    label: "Producten beheren",
    desc: "Uw catalogus: dispensers, geuren en abonnementen bekijken en aanpassen.",
    icon: Package,
    accent: "#f59e0b",
    cta: "Producten openen",
  },
] as const;

const ACTIVITY = [
  { t: "2 min", text: "Nieuwe aanvraag — Glasbewassing", tag: "Aanvraag" },
  { t: "1 uur", text: "Sollicitatie ontvangen — Objectleider", tag: "Vacature" },
  { t: "3 uur", text: "Product bijgewerkt — Aromatic Amber", tag: "Product" },
  { t: "Gisteren", text: "Nieuw teamlid uitgenodigd — maria@rekp.ai", tag: "Gebruiker" },
];

function todayLabel(): string {
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());
  } catch {
    return "";
  }
}

function formatNlNumber(n: number): string {
  try {
    return new Intl.NumberFormat("nl-NL").format(n);
  } catch {
    return String(n);
  }
}

function requestTrendDelta(
  current: number,
  previous: number,
): { delta: string; deltaTone: StatCard["deltaTone"] } {
  if (previous === 0) {
    if (current === 0) return { delta: "0%", deltaTone: "neutral" };
    return { delta: "nieuw", deltaTone: "up" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { delta: `+${pct}%`, deltaTone: "up" };
  if (pct < 0) return { delta: `${pct}%`, deltaTone: "down" };
  return { delta: "0%", deltaTone: "neutral" };
}

function buildStatCards(stats: AdminOverviewStats | null): StatCard[] {
  const requests = stats?.newRequestsLast7Days ?? null;
  const previous = stats?.newRequestsPrevious7Days ?? 0;
  const requestTrend =
    requests === null
      ? { delta: "…", deltaTone: "neutral" as const }
      : requestTrendDelta(requests, previous);

  const visitors = stats?.websiteVisitors ?? null;
  const visitorsPrevious = stats?.websiteVisitorsPrevious7Days ?? 0;
  const visitorTrend =
    stats === null
      ? { delta: "…", deltaTone: "neutral" as const }
      : visitors === null
        ? { delta: "niet gekoppeld", deltaTone: "pending" as const }
        : requestTrendDelta(visitors, visitorsPrevious);

  return [
    {
      label: "Nieuwe aanvragen (7 dagen)",
      value: requests === null ? "—" : formatNlNumber(requests),
      delta: requestTrend.delta,
      deltaTone: requestTrend.deltaTone,
      icon: Inbox,
      tone: "from-[#1e88e5] to-[#22d3ee]",
    },
    {
      label: "Website bezoekers (7 dagen)",
      value: visitors === null ? "—" : formatNlNumber(visitors),
      delta: visitorTrend.delta,
      deltaTone: visitorTrend.deltaTone,
      icon: Globe2,
      tone: "from-[#7c3aed] to-[#ec4899]",
    },
    {
      label: "Actieve gebruikers",
      value:
        stats === null ? "—" : formatNlNumber(stats.activeStaffCount),
      delta: "team",
      deltaTone: "neutral",
      icon: Users,
      tone: "from-[#22c55e] to-[#84cc16]",
    },
    {
      label: "Producten",
      value: "—",
      delta: "binnenkort",
      deltaTone: "pending",
      icon: Package,
      tone: "from-[#f59e0b] to-[#ef4444]",
    },
  ];
}

function DeltaBadge({
  delta,
  tone,
}: {
  delta: string;
  tone: StatCard["deltaTone"];
}) {
  if (tone === "pending" || tone === "neutral") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/55">
        <Minus className="h-3.5 w-3.5" /> {delta}
      </span>
    );
  }
  if (tone === "down") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-rose-300">
        <TrendingUp className="h-3.5 w-3.5 rotate-180" /> {delta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-emerald-300">
      <TrendingUp className="h-3.5 w-3.5" /> {delta}
    </span>
  );
}

function AdminOverview() {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAdminOverviewStats()
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        if (!cancelled) {
          setStats({
            newRequestsLast7Days: 0,
            newRequestsPrevious7Days: 0,
            activeStaffCount: 0,
            websiteVisitors: null,
            websiteVisitorsPrevious7Days: null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = buildStatCards(stats);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1e88e5]/20 via-[#7c3aed]/10 to-transparent p-6 sm:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(30,136,229,0.35),transparent_60%)]" />
        <div className="relative">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/75 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> {todayLabel()}
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Welkom terug
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg">
            Dit is het beheer van uw website. Kies hieronder wat u wilt doen — alles is met één
            klik bereikbaar.
          </p>
        </div>
      </section>

      {/* Primary tasks */}
      <section aria-labelledby="admin-tasks-heading">
        <h2 id="admin-tasks-heading" className="mb-4 text-lg font-semibold text-white/90">
          Wat wilt u doen?
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            return (
              <Link
                key={sec.to}
                to={sec.to}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07] hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)] sm:p-7"
              >
                <div
                  className="absolute inset-x-0 top-0 h-[3px] scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                  style={{ backgroundImage: `linear-gradient(90deg, transparent, ${sec.accent}, transparent)` }}
                />
                <div className="flex items-center gap-4">
                  <div
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 transition-transform duration-200 group-hover:scale-105"
                    style={{ backgroundColor: `${sec.accent}22`, color: sec.accent }}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">{sec.label}</h3>
                </div>
                <p className="mt-4 text-[15px] leading-relaxed text-white/60">{sec.desc}</p>
                <span
                  className="mt-5 inline-flex items-center gap-2 text-[15px] font-semibold transition-transform duration-200 group-hover:translate-x-1"
                  style={{ color: sec.accent }}
                >
                  {sec.cta}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section aria-labelledby="admin-stats-heading">
        <h2 id="admin-stats-heading" className="mb-4 text-lg font-semibold text-white/90">
          Kort overzicht
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${s.tone} opacity-20 blur-2xl transition-opacity group-hover:opacity-40`} />
                <div className="relative flex items-center justify-between">
                  <div className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${s.tone} shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <DeltaBadge delta={s.delta} tone={s.deltaTone} />
                </div>
                <div className="relative mt-4">
                  <div className="text-3xl font-bold tracking-tight tabular-nums">{s.value}</div>
                  <div className="mt-1 text-sm text-white/55">{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Activity */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-7" aria-labelledby="admin-activity-heading">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1e88e5]/15 text-[#2f9ff0]">
            <Activity className="h-5 w-5" />
          </span>
          <h2 id="admin-activity-heading" className="text-lg font-semibold text-white/90">
            Recent gebeurd
          </h2>
        </div>
        <ul className="divide-y divide-white/5">
          {ACTIVITY.map((a, i) => (
            <li key={i} className="flex items-center justify-between gap-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#2f9ff0] shadow-[0_0_10px_rgba(30,136,229,0.8)]" />
                <span className="truncate text-[15px] text-white/85">{a.text}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60 sm:inline">{a.tag}</span>
                <span className="text-sm text-white/45">{a.t}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
