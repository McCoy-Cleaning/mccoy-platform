import { FORM_KINDS } from "@mccoy/domain";
import type { FormKind } from "@/lib/forms/types";

export type KindFilter = FormKind | "all";
export type ScopeFilter = string | "all";

export type InquiriesSearch = {
  kind: KindFilter;
  scope: ScopeFilter;
  q: string;
};

export function validateInquiriesSearch(search: Record<string, unknown>): InquiriesSearch {
  const kindRaw = typeof search.kind === "string" ? search.kind : "all";
  const kind =
    kindRaw === "all" || (FORM_KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as KindFilter)
      : "all";
  const scope =
    typeof search.scope === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(search.scope)
      ? search.scope
      : "all";
  const q = typeof search.q === "string" ? search.q.slice(0, 200) : "";
  return { kind, scope, q };
}
