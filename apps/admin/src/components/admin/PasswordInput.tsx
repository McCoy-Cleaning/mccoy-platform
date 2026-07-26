import * as React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  /** Leading lock icon (login / invite dark fields). */
  showLockIcon?: boolean;
};

/**
 * Password field with accessible show/hide toggle (Dutch aria-labels).
 * Matches admin dark UI; pass className for surface-specific styling.
 */
export function PasswordInput({
  className,
  showLockIcon = false,
  id,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);
  const ariaLabel = visible ? "Verberg wachtwoord" : "Toon wachtwoord";

  return (
    <div className="relative">
      {showLockIcon ? (
        <Lock
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
          aria-hidden
        />
      ) : null}
      <input
        {...props}
        id={id}
        type={visible ? "text" : "password"}
        className={cn(showLockIcon ? "pl-10 pr-11" : "pr-11", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={ariaLabel}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5]/50"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
