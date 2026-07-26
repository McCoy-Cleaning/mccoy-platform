import * as React from "react";
import { StructuredLinkField, PAGE_DESTINATION_LINK_KINDS } from "@mccoy/cms-editor";
import type { CmsLink } from "@mccoy/cms-schema";
import { useCms } from "@/lib/cms/store";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  /** Current link, or legacy string href for migration. */
  value: CmsLink | string | null | undefined;
  onChange: (link: CmsLink | null) => void;
  className?: string;
};

/**
 * Admin link field — wraps the shared StructuredLinkField with live page list.
 */
export function LinkField({ label = "Bestemming", value, onChange, className }: Props) {
  const state = useCms();
  const customPages = state.pages
    .filter((p) => p.isCustom)
    .map((p) => ({ id: p.id, title: p.title, slug: p.slug }));

  return (
    <div className={cn(className)}>
      <StructuredLinkField
        label={label}
        value={value}
        onChange={onChange}
        pages={customPages}
        allowedKinds={PAGE_DESTINATION_LINK_KINDS}
      />
    </div>
  );
}
