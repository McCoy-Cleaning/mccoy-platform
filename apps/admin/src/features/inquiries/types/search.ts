import { FORM_KINDS } from "@mccoy/domain";
import type { FormKind } from "@/lib/forms/types";

export type KindFilter = FormKind | "all";
export type ScopeFilter = string | "all";

/** Matches packages/email inbox-message-id encoding (imap/graph/req/e2e). */
const INBOX_MESSAGE_ID_RE =
  /^(imap:[^:]+:\d+|graph:[^:]+:.+|req:[^:]+:.+|e2e:[^:]+:.+)$/;

export type InquiriesSearch = {
  kind: KindFilter;
  scope: ScopeFilter;
  q: string;
  /** Open inquiry detail — survives refresh / notification deep links. */
  id?: string;
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
  const idRaw = typeof search.id === "string" ? search.id.trim() : "";
  const id =
    idRaw.length > 0 && idRaw.length <= 500 && INBOX_MESSAGE_ID_RE.test(idRaw) ? idRaw : undefined;
  return id ? { kind, scope, q, id } : { kind, scope, q };
}
