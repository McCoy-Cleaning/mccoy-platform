import * as React from "react";
import type { Block } from "@/lib/cms/types";
import { Sparkles, Shield, Clock, Leaf, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  shield: Shield,
  clock: Clock,
  leaf: Leaf,
};

/** Display-only renderer for custom-page blocks (public site + admin preview pane). */
export function BlockView({ block }: { block: Block }) {
  const d = block.data;
  switch (block.type) {
    case "hero":
      return (
        <section className={cn("grid gap-8 items-center py-16", d.image ? "md:grid-cols-2" : "md:grid-cols-1")}>
          <div className="space-y-4">
            {d.eyebrow && (
              <span className="inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
                {d.eyebrow}
              </span>
            )}
            {d.title && <h1 className="text-4xl md:text-5xl font-black tracking-tight">{d.title}</h1>}
            {d.subtitle && <p className="text-lg text-white/70">{d.subtitle}</p>}
            {d.ctaLabel && (
              <a href={d.ctaHref || "#"} className="inline-flex items-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30">
                {d.ctaLabel}
              </a>
            )}
          </div>
          {d.image && <img src={d.image} alt="" className="rounded-2xl aspect-[4/3] object-cover w-full" />}
        </section>
      );
    case "richText":
      return (
        <section className="max-w-3xl py-12 space-y-4">
          {d.title && <h2 className="text-3xl font-bold">{d.title}</h2>}
          {d.body && <p className="text-white/70 leading-relaxed whitespace-pre-wrap">{d.body}</p>}
        </section>
      );
    case "centered":
      return (
        <section className="mx-auto max-w-2xl text-center py-16 space-y-4">
          {d.title && <h2 className="text-3xl md:text-4xl font-black">{d.title}</h2>}
          {d.body && <p className="text-white/70 whitespace-pre-wrap">{d.body}</p>}
          {d.ctaLabel && (
            <a href={d.ctaHref || "#"} className="inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
              {d.ctaLabel}
            </a>
          )}
        </section>
      );
    case "textImage":
      return (
        <section className={cn("grid gap-8 items-center py-16 md:grid-cols-2", d.reverse && "md:[direction:rtl] md:[&>*]:[direction:ltr]")}>
          <div className="space-y-4">
            {d.title && <h2 className="text-3xl font-bold">{d.title}</h2>}
            {d.body && <p className="text-white/70 whitespace-pre-wrap">{d.body}</p>}
          </div>
          {d.image && <img src={d.image} alt="" className="rounded-2xl aspect-[4/3] object-cover w-full" />}
        </section>
      );
    case "featureGrid":
      return (
        <section className="py-16 space-y-8">
          {d.title && <h2 className="text-3xl font-bold text-center">{d.title}</h2>}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(d.features || []).map((f: any, i: number) => {
              const I = ICONS[f.icon] || Sparkles;
              return (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/20 text-primary"><I className="h-5 w-5" /></div>
                  {f.title && <h3 className="text-lg font-semibold">{f.title}</h3>}
                  {f.body && <p className="text-sm text-white/60">{f.body}</p>}
                </div>
              );
            })}
          </div>
        </section>
      );
    case "cta":
      return (
        <section className="rounded-3xl border border-primary/30 bg-primary/10 p-12 text-center space-y-4 my-12">
          {d.title && <h2 className="text-3xl font-bold">{d.title}</h2>}
          {d.subtitle && <p className="text-white/70">{d.subtitle}</p>}
          {d.ctaLabel && (
            <a href={d.ctaHref || "#"} className="inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
              {d.ctaLabel}
            </a>
          )}
        </section>
      );
    case "columns":
      return (
        <section className="py-16 space-y-6">
          {d.title && <h2 className="text-3xl font-bold">{d.title}</h2>}
          <div className={cn("grid gap-6", d.columns?.length === 2 ? "md:grid-cols-2" : d.columns?.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3")}>
            {(d.columns || []).map((c: any, i: number) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
                {c.title && <h3 className="text-lg font-semibold">{c.title}</h3>}
                {c.body && <p className="text-sm text-white/60 whitespace-pre-wrap">{c.body}</p>}
              </div>
            ))}
          </div>
        </section>
      );
    case "benefits":
      return (
        <section className="py-12 max-w-2xl space-y-4">
          {d.title && <h2 className="text-3xl font-bold">{d.title}</h2>}
          <ul className="space-y-2">
            {(d.items || []).map((it: string, i: number) => (
              <li key={i} className="flex items-start gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    case "fullImage":
      return (
        <section className="py-12">
          {d.image && <img src={d.image} alt="" className="rounded-2xl aspect-[21/9] object-cover w-full" />}
          {d.caption && <p className="text-center text-xs text-white/50 mt-2">{d.caption}</p>}
        </section>
      );
    case "gallery":
      return (
        <section className="py-12 space-y-4">
          {d.title && <h2 className="text-2xl font-bold">{d.title}</h2>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(d.images || []).map((img: string, i: number) => (
              <img key={i} src={img} alt="" className="rounded-xl aspect-[4/3] object-cover w-full" />
            ))}
          </div>
        </section>
      );
    case "spacer":
      return <div className={d.size === "sm" ? "h-8" : d.size === "lg" ? "h-32" : "h-16"}>{d.divider && <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent mt-auto translate-y-1/2" />}</div>;
    default:
      return null;
  }
}

export function BlocksView({ blocks }: { blocks: Block[] }) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      {blocks.map((b) => <BlockView key={b.id} block={b} />)}
    </div>
  );
}