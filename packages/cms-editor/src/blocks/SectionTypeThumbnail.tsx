import * as React from "react";
import type { BlockType } from "@mccoy/cms-schema";
import { cn } from "@mccoy/ui";

/** Lightweight static layout sketches so editors recognize section shapes. */
export function SectionTypeThumbnail({
  type,
  className,
}: {
  type: BlockType;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#12141c] to-[#0b0c12]",
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:10px_10px]" />
      <div className="relative flex h-full items-center justify-center p-3">
        <ThumbnailSketch type={type} />
      </div>
    </div>
  );
}

function ThumbnailSketch({ type }: { type: BlockType }) {
  switch (type) {
    case "hero":
      return (
        <div className="flex h-full w-full gap-2">
          <div className="flex flex-1 flex-col justify-center gap-1.5">
            <Bar className="h-1.5 w-1/3 bg-sky-400/70" />
            <Bar className="h-2.5 w-4/5" />
            <Bar className="h-1.5 w-3/5 opacity-50" />
            <Bar className="mt-1 h-3 w-2/5 rounded-md bg-sky-500/80" />
          </div>
          <div className="w-[42%] rounded-lg bg-white/15 ring-1 ring-white/10" />
        </div>
      );
    case "richText":
      return (
        <div className="flex h-full w-full flex-col justify-center gap-1.5 px-1">
          <Bar className="h-2.5 w-1/2" />
          <Bar className="h-1.5 w-full opacity-55" />
          <Bar className="h-1.5 w-[92%] opacity-45" />
          <Bar className="h-1.5 w-4/5 opacity-35" />
          <Bar className="mt-1 h-3 w-1/3 rounded-md bg-sky-500/70" />
        </div>
      );
    case "centered":
      return (
        <div className="mx-auto flex h-full w-[70%] flex-col items-center justify-center gap-1.5">
          <Bar className="h-2.5 w-3/5" />
          <Bar className="h-1.5 w-full opacity-50" />
          <Bar className="h-1.5 w-4/5 opacity-40" />
          <Bar className="mt-1 h-3 w-2/5 rounded-md bg-sky-500/80" />
        </div>
      );
    case "textImage":
      return (
        <div className="flex h-full w-full gap-2">
          <div className="flex flex-1 flex-col justify-center gap-1.5">
            <Bar className="h-2 w-3/4" />
            <Bar className="h-1.5 w-full opacity-50" />
            <Bar className="h-1.5 w-5/6 opacity-40" />
          </div>
          <div className="w-[45%] rounded-lg bg-white/15 ring-1 ring-white/10" />
        </div>
      );
    case "columns":
      return (
        <div className="flex h-full w-full gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-1 flex-col justify-center gap-1 rounded-lg bg-white/[0.04] p-1.5 ring-1 ring-white/10"
            >
              <Bar className="h-1.5 w-3/4" />
              <Bar className="h-1 w-full opacity-45" />
              <Bar className="h-1 w-5/6 opacity-30" />
            </div>
          ))}
        </div>
      );
    case "gallery":
      return (
        <div className="grid h-full w-full grid-cols-3 grid-rows-2 gap-1.5">
          <Tile className="col-span-2 row-span-2" />
          <Tile />
          <Tile />
        </div>
      );
    case "offers":
      return (
        <div className="flex h-full w-full gap-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/10"
            >
              <div className="relative h-[45%] bg-white/15">
                <span className="absolute left-1 top-1 rounded bg-amber-400/90 px-1 py-0.5 text-[7px] font-bold text-black">
                  %
                </span>
              </div>
              <div className="flex flex-1 flex-col justify-center gap-1 bg-white/[0.04] p-1.5">
                <Bar className="h-1.5 w-3/4" />
                <Bar className="h-1 w-1/2 opacity-40" />
              </div>
            </div>
          ))}
        </div>
      );
    case "cta":
      return (
        <div className="flex h-full w-full items-center justify-between gap-3 rounded-xl bg-sky-500/20 px-3 ring-1 ring-sky-400/30">
          <div className="flex flex-1 flex-col gap-1.5">
            <Bar className="h-2 w-3/5" />
            <Bar className="h-1.5 w-4/5 opacity-50" />
          </div>
          <Bar className="h-4 w-1/4 shrink-0 rounded-md bg-sky-500/90" />
        </div>
      );
    case "featureGrid":
      return (
        <div className="grid h-full w-full grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-1 rounded-lg bg-white/[0.05] p-1.5 ring-1 ring-white/10"
            >
              <div className="h-2.5 w-2.5 rounded bg-sky-400/70" />
              <Bar className="h-1.5 w-3/4" />
              <Bar className="h-1 w-full opacity-40" />
            </div>
          ))}
        </div>
      );
    case "steps":
      return (
        <div className="flex h-full w-full items-end justify-center gap-1 px-0.5 pb-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={
                i === 1
                  ? "flex h-[88%] w-[38%] flex-col overflow-hidden rounded-md bg-sky-500/25 ring-1 ring-sky-400/50"
                  : "flex h-[62%] w-[28%] flex-col overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/10 opacity-55"
              }
            >
              <div className={i === 1 ? "h-3 w-full bg-sky-400/50" : "h-2 w-full bg-white/15"} />
              <div className="flex flex-1 flex-col justify-center gap-0.5 p-1">
                <Bar className="h-1 w-3/4" />
                <Bar className="h-0.5 w-full opacity-40" />
              </div>
            </div>
          ))}
        </div>
      );
    case "benefits":
      return (
        <div className="flex h-full w-full flex-col justify-center gap-1.5 px-1">
          <Bar className="mb-1 h-2 w-2/5" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="grid h-3 w-3 shrink-0 place-items-center rounded bg-emerald-500/80 text-[8px] font-bold text-white">
                ✓
              </div>
              <Bar className="h-1.5" style={{ width: `${88 - i * 10}%` }} />
            </div>
          ))}
        </div>
      );
    case "quote":
      return (
        <div className="mx-auto flex h-full w-[85%] flex-col justify-center gap-2 rounded-xl bg-white/[0.04] px-3 ring-1 ring-white/10">
          <div className="text-[18px] leading-none text-sky-400/80">“</div>
          <Bar className="h-1.5 w-full opacity-60" />
          <Bar className="h-1.5 w-4/5 opacity-45" />
          <div className="mt-1 flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-white/20" />
            <Bar className="h-1.5 w-1/3 opacity-50" />
          </div>
        </div>
      );
    case "video":
      return (
        <div className="relative flex h-full w-full items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-sky-500/90 text-white shadow-lg">
            <div
              className="ml-0.5 h-0 w-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-white"
              aria-hidden
            />
          </div>
          <Bar className="absolute bottom-2 left-2 h-1.5 w-1/3 opacity-50" />
        </div>
      );
    case "beforeAfter":
      return (
        <div className="relative flex h-full w-full overflow-hidden rounded-lg ring-1 ring-white/10">
          <div className="w-1/2 bg-white/10" />
          <div className="w-1/2 bg-white/25" />
          <div className="absolute inset-y-1 left-1/2 w-0.5 -translate-x-1/2 bg-sky-400" />
          <div className="absolute left-1/2 top-1/2 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-sky-500 text-[8px] font-bold text-white shadow">
            ↔
          </div>
        </div>
      );
    case "carousel":
      return (
        <div className="flex h-full w-full flex-col gap-1.5">
          <div className="flex flex-1 gap-1.5">
            <Tile className="w-[18%] opacity-40" />
            <Tile className="flex-1" />
            <Tile className="w-[18%] opacity-40" />
          </div>
          <div className="flex justify-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/25" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/25" />
          </div>
        </div>
      );
    case "comparisonTable":
      return (
        <div className="flex h-full w-full flex-col gap-1 rounded-lg bg-white/[0.03] p-1.5 ring-1 ring-white/10">
          <div className="grid grid-cols-3 gap-1">
            <Bar className="h-2 opacity-30" />
            <Bar className="h-2 bg-sky-400/60" />
            <Bar className="h-2 bg-sky-400/40" />
          </div>
          {[0, 1, 2].map((r) => (
            <div key={r} className="grid grid-cols-3 gap-1">
              <Bar className="h-1.5 opacity-50" />
              <div className="grid place-items-center rounded bg-emerald-500/30 text-[8px] text-emerald-200">
                ✓
              </div>
              <div className="grid place-items-center rounded bg-white/5 text-[8px] text-white/35">
                —
              </div>
            </div>
          ))}
        </div>
      );
    case "spacer":
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2">
          <Bar className="h-1 w-full opacity-20" />
          <div className="flex w-full items-center gap-2">
            <div className="h-px flex-1 border-t border-dashed border-white/30" />
            <span className="text-[8px] uppercase tracking-wider text-white/40">spacer</span>
            <div className="h-px flex-1 border-t border-dashed border-white/30" />
          </div>
          <Bar className="h-1 w-full opacity-20" />
        </div>
      );
    case "teamGrid":
      return (
        <div className="grid h-full w-full grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center justify-center gap-1">
              <div className="h-6 w-6 rounded-full bg-white/20 ring-1 ring-white/15" />
              <Bar className="h-1.5 w-4/5" />
              <Bar className="h-1 w-3/5 opacity-40" />
            </div>
          ))}
        </div>
      );
    case "teamProfile":
      return (
        <div className="flex h-full w-full gap-2">
          <div className="w-[38%] rounded-lg bg-white/15 ring-1 ring-white/10" />
          <div className="flex flex-1 flex-col justify-center gap-1.5">
            <Bar className="h-2 w-3/4" />
            <Bar className="h-1.5 w-1/2 bg-sky-400/60" />
            <Bar className="h-1.5 w-full opacity-45" />
            <Bar className="h-1.5 w-5/6 opacity-35" />
          </div>
        </div>
      );
    case "values":
      return (
        <div className="flex h-full w-full gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg bg-white/[0.05] p-1.5 ring-1 ring-white/10"
            >
              <div className="grid h-4 w-4 place-items-center rounded-full bg-sky-500/70 text-[8px] text-white">
                ★
              </div>
              <Bar className="h-1.5 w-4/5" />
              <Bar className="h-1 w-full opacity-35" />
            </div>
          ))}
        </div>
      );
    case "timeline":
      return (
        <div className="flex h-full w-full flex-col justify-center gap-1.5 px-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div className="h-2.5 w-2.5 rounded-full bg-sky-400 ring-2 ring-sky-400/30" />
                {i < 2 ? <div className="h-2 w-px bg-white/25" /> : null}
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <Bar className="h-1.5 w-1/4 bg-sky-400/50" />
                <Bar className="h-1.5 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      );
    case "roadmap":
      return (
        <div className="flex h-full w-full items-end gap-1.5 px-1 pb-1">
          {[40, 70, 55, 85].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-sky-500/50 ring-1 ring-sky-400/30"
                style={{ height: `${h}%` }}
              />
              <Bar className="h-1 w-3/4 opacity-40" />
            </div>
          ))}
        </div>
      );
    case "plans":
      return (
        <div className="flex h-full w-full gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "flex flex-1 flex-col gap-1 rounded-lg p-1.5 ring-1",
                i === 1
                  ? "bg-sky-500/20 ring-sky-400/40"
                  : "bg-white/[0.04] ring-white/10",
              )}
            >
              <Bar className="h-1.5 w-3/4" />
              <Bar className={cn("h-2.5 w-1/2", i === 1 ? "bg-sky-400/80" : "")} />
              <Bar className="h-1 w-full opacity-35" />
              <Bar className="mt-auto h-2.5 w-full rounded-md bg-sky-500/70" />
            </div>
          ))}
        </div>
      );
    case "newsletter":
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl bg-sky-500/15 px-3 ring-1 ring-sky-400/25">
          <Bar className="h-2 w-2/5" />
          <Bar className="h-1.5 w-3/5 opacity-45" />
          <div className="mt-1 flex w-full max-w-[90%] gap-1.5">
            <div className="h-4 flex-1 rounded-md bg-white/10 ring-1 ring-white/15" />
            <Bar className="h-4 w-1/4 shrink-0 rounded-md bg-sky-500/90" />
          </div>
        </div>
      );
    case "contactForm":
    case "quoteRequestForm":
      return (
        <div className="flex h-full w-full gap-2">
          <div className="flex flex-1 flex-col justify-center gap-1.5">
            <Bar className="h-2 w-1/2" />
            <Bar className="h-1.5 w-4/5 opacity-40" />
          </div>
          <div className="flex w-[48%] flex-col gap-1 rounded-lg bg-white/[0.05] p-1.5 ring-1 ring-white/10">
            <div className="h-2.5 rounded bg-white/10" />
            <div className="h-2.5 rounded bg-white/10" />
            <div className="h-5 rounded bg-white/10" />
            <Bar className="mt-0.5 h-3 w-full rounded-md bg-sky-500/80" />
          </div>
        </div>
      );
    case "announcement":
      return (
        <div className="flex h-full w-full items-center gap-2 rounded-lg bg-amber-500/20 px-2.5 ring-1 ring-amber-400/30">
          <div className="grid h-4 w-4 shrink-0 place-items-center rounded bg-amber-400/90 text-[8px] font-bold text-black">
            !
          </div>
          <Bar className="h-1.5 flex-1" />
          <Bar className="h-3 w-1/5 shrink-0 rounded-md bg-amber-400/80" />
        </div>
      );
    case "popup":
      return (
        <div className="relative flex h-full w-full items-center justify-center">
          <div className="absolute inset-1 rounded-lg bg-white/[0.04] opacity-50" />
          <div className="relative z-[1] flex w-[70%] flex-col gap-1.5 rounded-xl bg-[#161822] p-2.5 shadow-xl ring-1 ring-white/20">
            <Bar className="h-2 w-3/5" />
            <Bar className="h-1.5 w-full opacity-45" />
            <Bar className="mt-1 h-3 w-2/5 rounded-md bg-sky-500/80" />
          </div>
        </div>
      );
    case "portfolio":
      return (
        <div className="grid h-full w-full grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-md ring-1 ring-white/10">
              <div className="h-[55%] bg-white/15" />
              <div className="flex flex-1 flex-col justify-center gap-0.5 bg-white/[0.04] p-1">
                <Bar className="h-1 w-3/4" />
                <Bar className="h-1 w-1/2 opacity-35" />
              </div>
            </div>
          ))}
        </div>
      );
    case "jobs":
      return (
        <div className="flex h-full w-full flex-col justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2 py-1.5 ring-1 ring-white/10"
            >
              <div className="h-4 w-4 shrink-0 rounded bg-sky-500/60" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <Bar className="h-1.5 w-3/5" />
                <Bar className="h-1 w-2/5 opacity-40" />
              </div>
              <Bar className="h-2.5 w-1/5 shrink-0 rounded-md bg-sky-500/70" />
            </div>
          ))}
        </div>
      );
    case "latestPosts":
      return (
        <div className="flex h-full w-full gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-1 flex-col overflow-hidden rounded-lg ring-1 ring-white/10"
            >
              <div className="h-[40%] bg-white/15" />
              <div className="flex flex-1 flex-col justify-center gap-1 p-1.5">
                <Bar className="h-1 w-1/3 bg-sky-400/50" />
                <Bar className="h-1.5 w-full" />
                <Bar className="h-1 w-4/5 opacity-35" />
              </div>
            </div>
          ))}
        </div>
      );
    case "partnersMarquee":
      return (
        <div className="flex h-full w-full items-center gap-2 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-7 w-12 shrink-0 rounded-md bg-white/10 ring-1 ring-white/10"
              style={{ opacity: 0.35 + i * 0.12 }}
            />
          ))}
        </div>
      );
    case "statsCounters":
      return (
        <div className="flex h-full w-full gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg bg-white/[0.04] ring-1 ring-white/10"
            >
              <Bar className="h-3 w-3/5 bg-sky-400/80" />
              <Bar className="h-1 w-4/5 opacity-40" />
            </div>
          ))}
        </div>
      );
    case "contactInfoCards":
      return (
        <div className="flex h-full w-full gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg bg-white/[0.05] p-1.5 ring-1 ring-white/10"
            >
              <div className="h-3.5 w-3.5 rounded-full bg-sky-500/70" />
              <Bar className="h-1.5 w-3/4" />
              <Bar className="h-1 w-full opacity-35" />
            </div>
          ))}
        </div>
      );
    case "legalArticles":
      return (
        <div className="flex h-full w-full flex-col justify-center gap-1.5 px-1">
          <Bar className="mb-0.5 h-2 w-2/5" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className="w-4 shrink-0 text-[8px] font-semibold text-sky-400/80">
                {i + 1}.
              </span>
              <Bar className="h-1.5" style={{ width: `${90 - i * 8}%` }} />
            </div>
          ))}
        </div>
      );
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return <Bar className="h-3 w-1/2" />;
    }
  }
}

function Bar({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("rounded-sm bg-white/70", className)} style={style} />;
}

function Tile({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-white/15 ring-1 ring-white/10", className)} />;
}
