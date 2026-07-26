import * as React from "react";

/**
 * Public pages get default (no-op) edit contexts from createContext.
 * Edit/preview iframe loads the heavy providers only when needed so the
 * public storefront does not pay for draft/postMessage/upload code on every visit.
 */
export function DeferredCmsEditShell({ children }: { children: React.ReactNode }) {
  const [EditStack, setEditStack] = React.useState<React.ComponentType<{
    children: React.ReactNode;
  }> | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const needsEdit =
      sp.get("_cmsMode") === "edit" ||
      sp.get("_cmsPreview") === "1" ||
      window.location.pathname === "/cms-preview";
    if (!needsEdit) return;

    let cancelled = false;
    void import("./cms-edit-stack").then((mod) => {
      if (!cancelled) setEditStack(() => mod.CmsEditStack);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!EditStack) return <>{children}</>;
  return <EditStack>{children}</EditStack>;
}
