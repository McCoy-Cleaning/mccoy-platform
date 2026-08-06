import * as React from "react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn("p-12 text-center", className)}
    >
      {Icon ? <Icon className="mx-auto mb-4 h-10 w-10 text-white/30" aria-hidden /> : null}
      <p className="text-lg font-semibold text-white/80">{title}</p>
      {description ? (
        <p className="mt-2 text-[15px] text-white/50">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
