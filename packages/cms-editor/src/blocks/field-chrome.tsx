/**
 * Shared inspector field chrome — leaf module (no editor/registry imports).
 */
import * as React from "react";

export const inputClass =
  "w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-[15px] text-white outline-none placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-sky-400/50";

export const selectClass = `${inputClass} cursor-pointer`;

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = React.useId();
  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id })
    : children;
  return (
    <div className="block space-y-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-white/65">
        {label}
      </label>
      {control}
      {hint ? <span className="block text-xs text-white/40">{hint}</span> : null}
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h4 className="text-[13px] font-semibold uppercase tracking-wider text-white/55">{title}</h4>
      {children}
    </section>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-white/15 px-4 py-4 text-[13px] leading-relaxed text-white/50">
      {children}
    </p>
  );
}
