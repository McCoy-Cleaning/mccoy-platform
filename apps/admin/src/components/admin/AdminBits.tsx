import * as React from "react";

type Action = { label: string; icon: React.ComponentType<{ className?: string }>; href?: string; onClick?: () => void };

export function PageHeader({
  icon: Icon,
  accent,
  title,
  subtitle,
  actions = [],
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  title: string;
  subtitle?: string;
  actions?: Action[];
}) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl border border-white/10 shadow-lg"
          style={{ backgroundColor: `${accent}22`, color: accent, boxShadow: `0 10px 30px -12px ${accent}66` }}
        >
          <Icon className="h-8 w-8" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[15px] leading-relaxed text-white/55 sm:text-base">{subtitle}</p>}
        </div>
      </div>
      {actions.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {actions.map((a) => {
            const AIcon = a.icon;
            if (a.href) {
              return (
                <a key={a.label} href={a.href} className="a-btn a-btn-secondary" target={a.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                  <AIcon className="h-4 w-4" />
                  {a.label}
                </a>
              );
            }
            return (
              <button key={a.label} onClick={a.onClick} className="a-btn a-btn-secondary">
                <AIcon className="h-4 w-4" />
                {a.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}

export function PlaceholderPanel({
  icon: Icon,
  title,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5">
          <Icon className="h-6 w-6 text-white/70" />
        </div>
        <div>
          <div className="text-sm text-white/55">{title}</div>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        </div>
      </div>
      {hint && <div className="mt-4 text-sm leading-relaxed text-white/45">{hint}</div>}
    </div>
  );
}
