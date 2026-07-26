import * as React from "react";
import { InlineText, ImageEdit } from "./InlineEdit";
import type { Block } from "@/lib/cms/types";
import { Sparkles, Shield, Clock, Leaf, Check, X as XIcon, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  block: Block;
  onChange: (patch: Record<string, any>) => void;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  shield: Shield,
  clock: Clock,
  leaf: Leaf,
};

export function BlockRenderer({ block, onChange }: Props) {
  const d = block.data;
  switch (block.type) {
    case "hero":
      return (
        <div className={cn("grid gap-8 items-center", d.image ? "md:grid-cols-2" : "md:grid-cols-1")}>
          <div className="space-y-4">
            {d.eyebrow !== undefined && (
              <InlineText
                value={d.eyebrow}
                onChange={(v) => onChange({ eyebrow: v })}
                className="inline-block rounded-full border border-[#1e88e5]/30 bg-[#1e88e5]/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[#1e88e5]"
                placeholder="Eyebrow"
              />
            )}
            <InlineText
              value={d.title}
              onChange={(v) => onChange({ title: v })}
              as="h2"
              className="text-4xl md:text-5xl font-black tracking-tight"
              placeholder="Titel"
              multiline
            />
            <InlineText
              value={d.subtitle}
              onChange={(v) => onChange({ subtitle: v })}
              className="text-lg text-white/70"
              placeholder="Subtitel"
              multiline
            />
            <div className="pt-2">
              <InlineText
                value={d.ctaLabel}
                onChange={(v) => onChange({ ctaLabel: v })}
                className="inline-flex items-center rounded-xl bg-[#1e88e5] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1e88e5]/30"
                placeholder="CTA"
              />
            </div>
          </div>
          <ImageEdit src={d.image} onChange={(v) => onChange({ image: v })} aspect="aspect-[4/3]" />
        </div>
      );

    case "richText":
      return (
        <div className="max-w-3xl space-y-4">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl font-bold" placeholder="Kop" />
          <InlineText value={d.body} onChange={(v) => onChange({ body: v })} className="text-white/70 leading-relaxed" placeholder="Tekst" multiline />
        </div>
      );

    case "centered":
      return (
        <div className="mx-auto max-w-2xl text-center space-y-4">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl md:text-4xl font-black" placeholder="Titel" />
          <InlineText value={d.body} onChange={(v) => onChange({ body: v })} className="text-white/70" placeholder="Beschrijving" multiline />
          <InlineText value={d.ctaLabel} onChange={(v) => onChange({ ctaLabel: v })} className="inline-flex rounded-xl bg-[#1e88e5] px-5 py-3 text-sm font-semibold" placeholder="CTA" />
        </div>
      );

    case "textImage":
      return (
        <div className={cn("grid gap-8 items-center md:grid-cols-2", d.reverse && "md:[direction:rtl] md:[&>*]:[direction:ltr]") }>
          <div className="space-y-4">
            <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl font-bold" placeholder="Titel" />
            <InlineText value={d.body} onChange={(v) => onChange({ body: v })} className="text-white/70" placeholder="Tekst" multiline />
            <label className="flex items-center gap-2 text-xs text-white/50">
              <input type="checkbox" checked={!!d.reverse} onChange={(e) => onChange({ reverse: e.target.checked })} />
              Beeld links
            </label>
          </div>
          <ImageEdit src={d.image} onChange={(v) => onChange({ image: v })} />
        </div>
      );

    case "columns":
      return (
        <div className="space-y-6">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl font-bold" placeholder="Titel" />
          <div className={cn("grid gap-6", d.columns?.length === 2 ? "md:grid-cols-2" : d.columns?.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3")}>
            {(d.columns || []).map((c: any, i: number) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
                <InlineText value={c.title} onChange={(v) => onChange({ columns: d.columns.map((x: any, j: number) => (j === i ? { ...x, title: v } : x)) })} as="h4" className="text-lg font-semibold" />
                <InlineText value={c.body} onChange={(v) => onChange({ columns: d.columns.map((x: any, j: number) => (j === i ? { ...x, body: v } : x)) })} className="text-sm text-white/60" multiline />
              </div>
            ))}
          </div>
          <div className="flex gap-2 text-xs">
            <button onClick={() => onChange({ columns: [...(d.columns || []), { title: "Nieuwe kolom", body: "Beschrijving" }] })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">+ Kolom</button>
            {d.columns?.length > 1 && (
              <button onClick={() => onChange({ columns: d.columns.slice(0, -1) })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">− Kolom</button>
            )}
          </div>
        </div>
      );

    case "benefits":
      return (
        <div className="space-y-4 max-w-2xl">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl font-bold" placeholder="Titel" />
          <ul className="space-y-2">
            {(d.items || []).map((it: string, i: number) => (
              <li key={i} className="flex items-start gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />
                <InlineText value={it} onChange={(v) => onChange({ items: d.items.map((x: string, j: number) => (j === i ? v : x)) })} className="flex-1" />
                <button onClick={() => onChange({ items: d.items.filter((_: any, j: number) => j !== i) })} className="text-white/30 hover:text-red-300"><XIcon className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
          <button onClick={() => onChange({ items: [...(d.items || []), "Nieuw voordeel"] })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs">+ Item</button>
        </div>
      );

    case "quote":
      return (
        <div className="mx-auto max-w-3xl text-center space-y-6">
          <InlineText value={d.quote} onChange={(v) => onChange({ quote: v })} className="text-2xl md:text-3xl font-medium italic" placeholder="Quote" multiline />
          <div className="flex items-center justify-center gap-3">
            <ImageEdit src={d.avatar} onChange={(v) => onChange({ avatar: v })} aspect="aspect-square" className="!w-14" />
            <div className="text-left">
              <InlineText value={d.author} onChange={(v) => onChange({ author: v })} className="text-sm font-semibold" placeholder="Naam" />
              <InlineText value={`${d.role} · ${d.company}`} onChange={(v) => { const [r, c] = v.split("·").map((s) => s.trim()); onChange({ role: r || "", company: c || "" }); }} className="text-xs text-white/50" placeholder="Rol · Bedrijf" />
            </div>
          </div>
        </div>
      );

    case "gallery":
      return (
        <div className="space-y-4">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-2xl font-bold" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(d.images || []).map((img: string, i: number) => (
              <ImageEdit key={i} src={img} onChange={(v) => onChange({ images: v ? d.images.map((x: string, j: number) => (j === i ? v : x)) : d.images.filter((_: string, j: number) => j !== i) })} />
            ))}
            <ImageEdit src="" onChange={(v) => v && onChange({ images: [...(d.images || []), v] })} />
          </div>
        </div>
      );

    case "fullImage":
      return (
        <div className="space-y-3">
          <div className="relative">
            <ImageEdit src={d.image} onChange={(v) => onChange({ image: v })} aspect="aspect-[21/9]" />
            {d.overlayTitle !== undefined && d.image && (
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <InlineText value={d.overlayTitle} onChange={(v) => onChange({ overlayTitle: v })} as="h3" className="pointer-events-auto text-3xl md:text-5xl font-black text-white drop-shadow-lg" placeholder="Overlay" />
              </div>
            )}
          </div>
          <InlineText value={d.caption} onChange={(v) => onChange({ caption: v })} className="text-center text-xs text-white/50" placeholder="Onderschrift" />
        </div>
      );

    case "video":
      return (
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div className="space-y-2">
            <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-2xl font-bold" />
            <InlineText value={d.description} onChange={(v) => onChange({ description: v })} className="text-white/60" multiline />
            <InlineText value={d.videoUrl} onChange={(v) => onChange({ videoUrl: v })} className="text-xs text-[#1e88e5] font-mono" placeholder="Video URL (YouTube/Vimeo)" />
          </div>
          <ImageEdit src={d.poster} onChange={(v) => onChange({ poster: v })} aspect="aspect-video" />
        </div>
      );

    case "beforeAfter":
      return (
        <div className="space-y-3">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-xl font-bold" />
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-xs text-white/50 mb-1">Voor</div><ImageEdit src={d.before} onChange={(v) => onChange({ before: v })} /></div>
            <div><div className="text-xs text-white/50 mb-1">Na</div><ImageEdit src={d.after} onChange={(v) => onChange({ after: v })} /></div>
          </div>
        </div>
      );

    case "carousel":
      return (
        <div className="space-y-4">
          <div className="flex gap-4 overflow-x-auto snap-x pb-2">
            {(d.slides || []).map((s: any, i: number) => (
              <div key={i} className="snap-center shrink-0 w-72 rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <ImageEdit src={s.image} onChange={(v) => onChange({ slides: d.slides.map((x: any, j: number) => (j === i ? { ...x, image: v } : x)) })} aspect="aspect-video" />
                <InlineText value={s.title} onChange={(v) => onChange({ slides: d.slides.map((x: any, j: number) => (j === i ? { ...x, title: v } : x)) })} as="h4" className="text-base font-semibold" />
                <InlineText value={s.body} onChange={(v) => onChange({ slides: d.slides.map((x: any, j: number) => (j === i ? { ...x, body: v } : x)) })} className="text-xs text-white/60" multiline />
              </div>
            ))}
          </div>
          <button onClick={() => onChange({ slides: [...(d.slides || []), { title: "Nieuwe slide", body: "", image: "" }] })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs">+ Slide</button>
        </div>
      );

    case "steps":
      return (
        <div className="space-y-6">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl font-bold" />
          <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(d.steps || []).map((s: any, i: number) => (
              <li key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[#1e88e5] text-sm font-bold">{i + 1}</div>
                <InlineText value={s.title} onChange={(v) => onChange({ steps: d.steps.map((x: any, j: number) => (j === i ? { ...x, title: v } : x)) })} as="h4" className="text-base font-semibold" />
                <InlineText value={s.body} onChange={(v) => onChange({ steps: d.steps.map((x: any, j: number) => (j === i ? { ...x, body: v } : x)) })} className="text-sm text-white/60" multiline />
              </li>
            ))}
          </ol>
        </div>
      );

    case "comparisonTable":
      return (
        <div className="space-y-4">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-2xl font-bold" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th></th>{d.columns.map((c: string, i: number) => (
                <th key={i} className="p-3 text-center"><InlineText value={c} onChange={(v) => onChange({ columns: d.columns.map((x: string, j: number) => (j === i ? v : x)) })} /></th>
              ))}</tr></thead>
              <tbody>
                {d.rows.map((r: any, ri: number) => (
                  <tr key={ri} className="border-t border-white/10">
                    <td className="p-3"><InlineText value={r.feature} onChange={(v) => onChange({ rows: d.rows.map((x: any, j: number) => (j === ri ? { ...x, feature: v } : x)) })} /></td>
                    {r.values.map((val: boolean, ci: number) => (
                      <td key={ci} className="p-3 text-center">
                        <button onClick={() => onChange({ rows: d.rows.map((x: any, j: number) => j === ri ? { ...x, values: x.values.map((y: boolean, k: number) => k === ci ? !y : y) } : x) })}>
                          {val ? <Check className="mx-auto h-4 w-4 text-emerald-400" /> : <XIcon className="mx-auto h-4 w-4 text-white/20" />}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case "featureGrid":
      return (
        <div className="space-y-6">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl font-bold" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(d.features || []).map((f: any, i: number) => {
              const I = ICONS[f.icon] || Sparkles;
              return (
                <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1e88e5]/20 text-[#1e88e5]"><I className="h-5 w-5" /></div>
                  <InlineText value={f.title} onChange={(v) => onChange({ features: d.features.map((x: any, j: number) => (j === i ? { ...x, title: v } : x)) })} as="h4" className="text-lg font-semibold" />
                  <InlineText value={f.body} onChange={(v) => onChange({ features: d.features.map((x: any, j: number) => (j === i ? { ...x, body: v } : x)) })} className="text-sm text-white/60" multiline />
                </div>
              );
            })}
          </div>
        </div>
      );

    case "spacer":
      return (
        <div className="flex items-center gap-3">
          <div className={cn("flex-1", d.size === "sm" ? "h-8" : d.size === "lg" ? "h-32" : "h-16")}>
            {d.divider && <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent mt-auto translate-y-1/2" />}
          </div>
          <select value={d.size} onChange={(e) => onChange({ size: e.target.value })} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs">
            <option value="sm">Klein</option><option value="md">Middel</option><option value="lg">Groot</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-white/50"><input type="checkbox" checked={!!d.divider} onChange={(e) => onChange({ divider: e.target.checked })} />lijn</label>
        </div>
      );

    case "teamGrid":
      return (
        <div className="space-y-6">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl font-bold" />
          <div className="grid gap-4 md:grid-cols-3">
            {(d.members || []).map((m: any, i: number) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <ImageEdit src={m.photo} onChange={(v) => onChange({ members: d.members.map((x: any, j: number) => (j === i ? { ...x, photo: v } : x)) })} aspect="aspect-square" />
                <InlineText value={m.name} onChange={(v) => onChange({ members: d.members.map((x: any, j: number) => (j === i ? { ...x, name: v } : x)) })} as="h4" className="text-base font-semibold" />
                <InlineText value={m.role} onChange={(v) => onChange({ members: d.members.map((x: any, j: number) => (j === i ? { ...x, role: v } : x)) })} className="text-xs text-[#1e88e5]" />
                <InlineText value={m.bio} onChange={(v) => onChange({ members: d.members.map((x: any, j: number) => (j === i ? { ...x, bio: v } : x)) })} className="text-xs text-white/60" multiline />
              </div>
            ))}
          </div>
          <button onClick={() => onChange({ members: [...(d.members || []), { name: "Naam", role: "Rol", bio: "", photo: "" }] })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs">+ Teamlid</button>
        </div>
      );

    case "teamProfile":
      return (
        <div className="grid md:grid-cols-[1fr_2fr] gap-6 items-start">
          <ImageEdit src={d.photo} onChange={(v) => onChange({ photo: v })} aspect="aspect-square" />
          <div className="space-y-3">
            <InlineText value={d.name} onChange={(v) => onChange({ name: v })} as="h3" className="text-3xl font-bold" />
            <InlineText value={d.role} onChange={(v) => onChange({ role: v })} className="text-sm text-[#1e88e5]" />
            <InlineText value={d.bio} onChange={(v) => onChange({ bio: v })} className="text-white/70" multiline />
            <InlineText value={d.email} onChange={(v) => onChange({ email: v })} className="text-sm text-white/50" placeholder="email@..." />
          </div>
        </div>
      );

    case "values":
      return (
        <div className="space-y-6">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl font-bold" />
          <div className="grid gap-4 md:grid-cols-3">
            {(d.values || []).map((v: any, i: number) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
                <Star className="h-5 w-5 text-[#1e88e5]" />
                <InlineText value={v.title} onChange={(nv) => onChange({ values: d.values.map((x: any, j: number) => (j === i ? { ...x, title: nv } : x)) })} as="h4" className="text-lg font-semibold" />
                <InlineText value={v.body} onChange={(nv) => onChange({ values: d.values.map((x: any, j: number) => (j === i ? { ...x, body: nv } : x)) })} className="text-sm text-white/60" multiline />
              </div>
            ))}
          </div>
        </div>
      );

    case "timeline":
      return (
        <div className="space-y-6">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl font-bold" />
          <ol className="relative border-l-2 border-white/10 pl-6 space-y-6">
            {(d.milestones || []).map((m: any, i: number) => (
              <li key={i} className="relative">
                <span className="absolute -left-[31px] top-1 grid h-5 w-5 place-items-center rounded-full bg-[#1e88e5] text-[10px] font-bold">{i + 1}</span>
                <InlineText value={m.year} onChange={(v) => onChange({ milestones: d.milestones.map((x: any, j: number) => (j === i ? { ...x, year: v } : x)) })} className="text-xs font-mono text-[#1e88e5]" />
                <InlineText value={m.title} onChange={(v) => onChange({ milestones: d.milestones.map((x: any, j: number) => (j === i ? { ...x, title: v } : x)) })} as="h4" className="text-lg font-semibold" />
                <InlineText value={m.body} onChange={(v) => onChange({ milestones: d.milestones.map((x: any, j: number) => (j === i ? { ...x, body: v } : x)) })} className="text-sm text-white/60" multiline />
              </li>
            ))}
          </ol>
        </div>
      );

    case "cta":
      return (
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1e88e5]/20 to-[#7c3aed]/20 p-8 md:p-12 text-center space-y-4">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl md:text-4xl font-black" />
          <InlineText value={d.body} onChange={(v) => onChange({ body: v })} className="text-white/70 max-w-xl mx-auto" multiline />
          <InlineText value={d.ctaLabel} onChange={(v) => onChange({ ctaLabel: v })} className="inline-flex rounded-xl bg-white text-black px-6 py-3 text-sm font-bold" />
        </div>
      );

    case "newsletter":
      return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 space-y-4">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-2xl font-bold" />
          <InlineText value={d.body} onChange={(v) => onChange({ body: v })} className="text-white/60" multiline />
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/40">email@voorbeeld.nl</div>
            <InlineText value={d.buttonLabel} onChange={(v) => onChange({ buttonLabel: v })} className="rounded-xl bg-[#1e88e5] px-5 py-3 text-sm font-semibold" />
          </div>
          <InlineText value={d.consent} onChange={(v) => onChange({ consent: v })} className="text-[11px] text-white/40" multiline />
        </div>
      );

    case "contactForm":
      return (
        <div className="grid md:grid-cols-2 gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="space-y-4">
            <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-2xl font-bold" />
            <div className="text-xs text-white/50">Ontvanger: <InlineText value={d.recipient} onChange={(v) => onChange({ recipient: v })} className="inline text-white/80" /></div>
            <div className="text-xs text-white/50">Bevestiging: <InlineText value={d.confirmation} onChange={(v) => onChange({ confirmation: v })} className="inline text-white/80" /></div>
          </div>
          <div className="space-y-2">
            {(d.fields || []).map((f: string, i: number) => (
              <div key={i} className="flex gap-2">
                <InlineText value={f} onChange={(v) => onChange({ fields: d.fields.map((x: string, j: number) => (j === i ? v : x)) })} className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm" />
                <button onClick={() => onChange({ fields: d.fields.filter((_: any, j: number) => j !== i) })} className="text-white/30 hover:text-red-300"><XIcon className="h-4 w-4" /></button>
              </div>
            ))}
            <button onClick={() => onChange({ fields: [...(d.fields || []), "Nieuw veld"] })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs">+ Veld</button>
          </div>
        </div>
      );

    case "announcement":
      return (
        <div className="flex items-center gap-3 rounded-full border border-[#1e88e5]/30 bg-[#1e88e5]/10 px-5 py-3 text-sm">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#1e88e5]/30">📢</span>
          <InlineText value={d.message} onChange={(v) => onChange({ message: v })} className="flex-1" />
          <InlineText value={d.linkLabel} onChange={(v) => onChange({ linkLabel: v })} className="font-semibold text-[#1e88e5]" />
        </div>
      );

    case "popup":
      return (
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-black/60 p-6 space-y-3 shadow-2xl">
          <div className="text-[10px] uppercase tracking-wider text-white/40">Popup preview</div>
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-xl font-bold" />
          <InlineText value={d.body} onChange={(v) => onChange({ body: v })} className="text-sm text-white/60" multiline />
          <InlineText value={d.ctaLabel} onChange={(v) => onChange({ ctaLabel: v })} className="inline-flex rounded-xl bg-[#1e88e5] px-4 py-2 text-sm font-semibold" />
        </div>
      );

    case "portfolio":
      return (
        <div className="space-y-6">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl font-bold" />
          <div className="grid gap-4 md:grid-cols-3">
            {(d.projects || []).map((p: any, i: number) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <ImageEdit src={p.image} onChange={(v) => onChange({ projects: d.projects.map((x: any, j: number) => (j === i ? { ...x, image: v } : x)) })} />
                <div className="p-4 space-y-1">
                  <InlineText value={p.category} onChange={(v) => onChange({ projects: d.projects.map((x: any, j: number) => (j === i ? { ...x, category: v } : x)) })} className="text-[11px] uppercase tracking-wider text-[#1e88e5]" />
                  <InlineText value={p.title} onChange={(v) => onChange({ projects: d.projects.map((x: any, j: number) => (j === i ? { ...x, title: v } : x)) })} as="h4" className="text-base font-semibold" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "jobs":
      return (
        <div className="space-y-4">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl font-bold" />
          <ul className="space-y-2">
            {(d.jobs || []).map((j: any, i: number) => (
              <li key={i} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 items-center">
                <div>
                  <InlineText value={j.title} onChange={(v) => onChange({ jobs: d.jobs.map((x: any, k: number) => (k === i ? { ...x, title: v } : x)) })} as="h4" className="text-base font-semibold" />
                  <div className="text-xs text-white/50 flex gap-2 flex-wrap">
                    <InlineText value={j.department} onChange={(v) => onChange({ jobs: d.jobs.map((x: any, k: number) => (k === i ? { ...x, department: v } : x)) })} />
                    <span>·</span>
                    <InlineText value={j.location} onChange={(v) => onChange({ jobs: d.jobs.map((x: any, k: number) => (k === i ? { ...x, location: v } : x)) })} />
                    <span>·</span>
                    <InlineText value={j.type} onChange={(v) => onChange({ jobs: d.jobs.map((x: any, k: number) => (k === i ? { ...x, type: v } : x)) })} />
                  </div>
                </div>
                <button onClick={() => onChange({ jobs: d.jobs.filter((_: any, k: number) => k !== i) })} className="text-white/30 hover:text-red-300"><XIcon className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
          <button onClick={() => onChange({ jobs: [...(d.jobs || []), { title: "Nieuwe vacature", department: "", location: "", type: "" }] })} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs">+ Vacature</button>
        </div>
      );

    case "latestPosts":
      return (
        <div className="space-y-4">
          <InlineText value={d.title} onChange={(v) => onChange({ title: v })} as="h3" className="text-3xl font-bold" />
          <div className="grid md:grid-cols-2 gap-4">
            {(d.posts || []).map((p: any, i: number) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
                <div className="text-xs text-white/40"><InlineText value={p.date} onChange={(v) => onChange({ posts: d.posts.map((x: any, j: number) => (j === i ? { ...x, date: v } : x)) })} /></div>
                <InlineText value={p.title} onChange={(v) => onChange({ posts: d.posts.map((x: any, j: number) => (j === i ? { ...x, title: v } : x)) })} as="h4" className="text-lg font-semibold" />
                <InlineText value={p.excerpt} onChange={(v) => onChange({ posts: d.posts.map((x: any, j: number) => (j === i ? { ...x, excerpt: v } : x)) })} className="text-sm text-white/60" multiline />
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return <div className="text-sm text-white/40">Onbekend blok: {block.type}</div>;
  }
}