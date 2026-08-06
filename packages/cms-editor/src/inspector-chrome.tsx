import * as React from "react";
import { cn } from "@mccoy/ui";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-white/12 bg-[#161920] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 [color-scheme:dark]";

export const selectClass = cn(
  inputClass,
  "cursor-pointer appearance-none bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-9",
  "bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22none%22 stroke=%22%23ffffff99%22 stroke-width=%222%22%3E%3Cpath d=%22M3 4.5 6 7.5 9 4.5%22/%3E%3C/svg%3E')]",
);

export const optionClass = "bg-[#161920] text-white";

export const iconBtnClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-white/70 transition hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50";

export const addBtnClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-3 py-2.5 text-[12px] font-semibold text-white/75 transition hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50";

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export const listItemClass = "space-y-2.5 rounded-xl border border-white/[0.08] bg-black/20 p-3";
export const smallBtnClass =
  "rounded-lg border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/75 transition hover:bg-white/10 hover:text-white";
