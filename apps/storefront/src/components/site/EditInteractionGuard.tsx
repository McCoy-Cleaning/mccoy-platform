import * as React from "react";

/**
 * Storefront-local edit/preview interaction guard.
 * Intentionally kept in-app so Storefront never depends on the CMS authoring package.
 *
 * Listeners attach to `document` (capture) rather than a `display: contents` wrapper:
 * contents boxes are unreliable event targets across browsers, and document capture
 * is active for the whole iframe document as soon as the effect runs.
 */
export function EditInteractionGuard({
  children,
  mode,
  onBlockedAction,
}: {
  children: React.ReactNode;
  mode: "edit" | "preview" | "off";
  onBlockedAction?: (kind: "navigate" | "submit") => void;
}) {
  React.useEffect(() => {
    if (mode === "off") return;

    const onClick = (e: MouseEvent) => {
      if (mode !== "edit") return;
      const t = e.target as HTMLElement | null;
      if (!t) return;

      const interactive = t.closest("a, button[data-cms-nav], [data-cms-navigate]");
      if (interactive instanceof HTMLAnchorElement || interactive?.getAttribute("data-cms-nav") != null) {
        e.preventDefault();
        e.stopPropagation();
        onBlockedAction?.("navigate");
      }
    };
    const onSubmit = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      onBlockedAction?.("submit");
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [mode, onBlockedAction]);

  return (
    <div data-cms-edit-guard={mode} className="contents">
      {children}
    </div>
  );
}
