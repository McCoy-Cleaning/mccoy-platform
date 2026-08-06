import * as React from "react";

/** Capture-phase guards for Bewerken / Preview.
 * - edit: block navigation (links) and form submit; do NOT stopPropagation so section selection still works
 * - preview: allow navigation/CTAs; still block form submit to avoid production side effects
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
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (mode === "off") return;
    const root = ref.current;
    if (!root) return;

    const onClick = (e: MouseEvent) => {
      if (mode !== "edit") return;
      const t = e.target as HTMLElement | null;
      if (!t) return;

      // Router buttons / role=link without <a>
      const interactive = t.closest("a, button[data-cms-nav], [data-cms-navigate]");
      if (interactive instanceof HTMLAnchorElement || interactive?.getAttribute("data-cms-nav") != null) {
        e.preventDefault();
        // Intentionally no stopPropagation — FixedSelectChrome capture/bubble must still select.
        onBlockedAction?.("navigate");
      }
    };
    const onSubmit = (e: Event) => {
      // Block real form side effects in both edit and preview.
      e.preventDefault();
      e.stopPropagation();
      onBlockedAction?.("submit");
    };

    root.addEventListener("click", onClick, true);
    root.addEventListener("submit", onSubmit, true);
    return () => {
      root.removeEventListener("click", onClick, true);
      root.removeEventListener("submit", onSubmit, true);
    };
  }, [mode, onBlockedAction]);

  return (
    <div ref={ref} data-cms-edit-guard={mode} className="contents">
      {children}
    </div>
  );
}
