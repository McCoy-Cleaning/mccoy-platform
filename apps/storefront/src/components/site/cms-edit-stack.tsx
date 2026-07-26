import type { ReactNode } from "react";
import { EditProvider } from "@/lib/cms/edit-context";
import { LiveEditDraftProvider } from "@/lib/cms/live-edit-draft";
import { EditModeShell } from "@/components/site/EditModeShell";

/** Loaded only for CMS edit/preview — kept out of the public entry chunk. */
export function CmsEditStack({ children }: { children: ReactNode }) {
  return (
    <EditProvider>
      <LiveEditDraftProvider>
        <EditModeShell>{children}</EditModeShell>
      </LiveEditDraftProvider>
    </EditProvider>
  );
}
