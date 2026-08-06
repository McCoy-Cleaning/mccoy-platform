import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type InlineLoaderProps = {
  /** Visible label and accessible name for the loading region. */
  label: string;
  className?: string;
};

export function InlineLoader({ label, className }: InlineLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex items-center justify-center gap-3 p-12 text-base text-white/55",
        className,
      )}
    >
      <Loader2 className="h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
