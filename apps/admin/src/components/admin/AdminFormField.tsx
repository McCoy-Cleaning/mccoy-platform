import * as React from "react";
import { cn } from "@/lib/utils";

/** Canonical admin text-input class (matches `.a-input` in styles.css). */
export const adminInputClassName =
  "a-input w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/35 focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30";

export type AdminFormFieldProps = {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
};

export function AdminFormField({
  id,
  label,
  hint,
  error,
  children,
  className,
}: AdminFormFieldProps) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  const control = React.isValidElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean | "true" | "false";
  }>(children)
    ? React.cloneElement(children, {
        id: children.props.id ?? fieldId,
        "aria-invalid": error ? true : children.props["aria-invalid"],
        "aria-describedby":
          [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") ||
          undefined,
      })
    : children;

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={fieldId} className="a-label mb-0">
        {label}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="a-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
