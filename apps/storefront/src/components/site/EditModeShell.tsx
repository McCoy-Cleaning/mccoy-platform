import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { EditInteractionGuard } from "@/components/site/EditInteractionGuard";

/**
 * Blocks navigation/submit while inside the admin edit iframe or on the
 * noindex /cms-preview route. Guard is Storefront-local (not the authoring package).
 */
export function EditModeShell({ children }: { children: ReactNode }) {
  const { mode } = useEdit();
  const location = useLocation();
  const isPreviewRoute = location.pathname === "/cms-preview";

  const guardMode: "edit" | "preview" | "off" = mode === "edit" ? "edit" : isPreviewRoute ? "preview" : "off";

  if (guardMode === "off") return <>{children}</>;

  return <EditInteractionGuard mode={guardMode}>{children}</EditInteractionGuard>;
}
