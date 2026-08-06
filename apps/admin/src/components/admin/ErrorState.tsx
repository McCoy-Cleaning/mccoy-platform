import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type ErrorStateProps = {
  title?: string;
  message: string;
  code?: string;
  onRetry?: () => void;
  retryLabel?: string;
  children?: React.ReactNode;
  className?: string;
};

export function ErrorState({
  title,
  message,
  code,
  onRetry,
  retryLabel = "Opnieuw proberen",
  children,
  className,
}: ErrorStateProps) {
  const isConfig = code === "config";

  return (
    <div
      role="alert"
      className={cn(
        "space-y-4 p-10 text-center",
        isConfig ? null : "text-base text-red-300",
        className,
      )}
    >
      {isConfig ? (
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-300/80" aria-hidden />
      ) : null}
      {title ? (
        <p
          className={cn(
            "text-base font-semibold",
            isConfig ? "text-amber-100" : "text-red-200",
          )}
        >
          {title}
        </p>
      ) : null}
      <p
        className={cn(
          "mx-auto max-w-md text-sm leading-relaxed",
          isConfig ? "text-white/55" : "text-base text-red-300",
        )}
      >
        {message}
      </p>
      {children}
      {onRetry ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={onRetry} className="a-btn a-btn-secondary">
            <RefreshCw className="h-4 w-4" aria-hidden />
            {retryLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
