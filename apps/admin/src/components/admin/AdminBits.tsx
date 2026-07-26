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
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 shadow-lg"
          style={{ backgroundColor: `${accent}22`, color: accent, boxShadow: `0 10px 30px -12px ${accent}66` }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle && <p className="truncate text-xs text-white/50 sm:text-sm">{subtitle}</p>}
        </div>
      </div>
      {actions.length > 0 && (
        <div className="flex shrink-0 items-center gap-2">
          {actions.map((a) => {
            const AIcon = a.icon;
            const cls =
              "inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:border-white/25 hover:bg-white/10 hover:text-white";
            if (a.href) {
              return (
                <a key={a.label} href={a.href} className={cls} target={a.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                  <AIcon className="h-3.5 w-3.5" />
                  {a.label}
                </a>
              );
            }
            return (
              <button key={a.label} onClick={a.onClick} className={cls}>
                <AIcon className="h-3.5 w-3.5" />
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5">
          <Icon className="h-4 w-4 text-white/70" />
        </div>
        <div>
          <div className="text-xs text-white/50">{title}</div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </div>
      {hint && <div className="mt-3 text-xs text-white/40">{hint}</div>}
    </div>
  );
}