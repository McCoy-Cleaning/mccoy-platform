/**
 * Microsoft Graph mail query safety: never send unsupported OData/KQL, and
 * do not retry a 400 query shape in a loop.
 *
 * Logs URL query *names/values* only (no tokens, no request bodies).
 */

const GRAPH_ORIGIN = "https://graph.microsoft.com";

export type GraphQueryLog = {
  path: string;
  filter?: string;
  search?: string;
  select?: string;
  orderby?: string;
  expand?: string;
  count?: string;
};

const blockedShapes = new Map<string, { status: number; code: string }>();
const loggedSkipShapes = new Set<string>();
const loggedIllegalShapes = new Set<string>();

export function resetGraphQueryCircuitForTests(): void {
  blockedShapes.clear();
  loggedSkipShapes.clear();
  loggedIllegalShapes.clear();
}

export function parseGraphQuery(pathOrUrl: string): GraphQueryLog {
  const url = toGraphUrl(pathOrUrl);
  const path = url.pathname
    .replace(/\/users\/[^/]+/gi, "/users/{mailbox}")
    .replace(/\/messages\/[^/]+/gi, "/messages/{id}")
    .replace(/\/attachments\/[^/]+/gi, "/attachments/{id}");
  const filter = url.searchParams.get("$filter") || undefined;
  const search = url.searchParams.get("$search") || undefined;
  const select = url.searchParams.get("$select") || undefined;
  const orderby = url.searchParams.get("$orderby") || undefined;
  const expand = url.searchParams.get("$expand") || undefined;
  const count = url.searchParams.get("$count") || undefined;
  return { path, filter, search, select, orderby, expand, count };
}

export function graphQueryLogFields(parsed: GraphQueryLog): Record<string, string> {
  const out: Record<string, string> = { path: parsed.path };
  if (parsed.filter) out.filter = parsed.filter;
  if (parsed.search) out.search = parsed.search;
  if (parsed.select) out.select = parsed.select;
  if (parsed.orderby) out.orderby = parsed.orderby;
  if (parsed.expand) out.expand = parsed.expand;
  if (parsed.count) out.count = parsed.count;
  return out;
}

/**
 * Graph-documented `$search` for messages is a quoted phrase alone.
 * Do not mix `$search` with `$filter` / `$orderby` / `$count`.
 */
export function illegalGraphMailQueryReason(parsed: GraphQueryLog): string | null {
  const filter = parsed.filter ?? "";
  const search = parsed.search ?? "";
  const select = parsed.select ?? "";
  const expand = parsed.expand ?? "";
  const orderby = parsed.orderby ?? "";

  if (/contains\s*\(\s*subject/i.test(filter)) {
    return "contains(subject) is not supported on Graph message $filter";
  }
  if (search && filter) return "$search cannot be combined with $filter";
  if (search && orderby) return "$search cannot be combined with $orderby";
  if (search && parsed.select) return "$search cannot be combined with $select";
  if (/(?:^|[\s"(])attachment\s*:/i.test(search)) {
    return "attachment: KQL is not reliable on Graph $search";
  }
  if (/subject\s*:/i.test(search) || /body\s*:/i.test(search)) {
    return "Graph $search must be a quoted phrase only (no subject:/body: KQL)";
  }
  if (/attachments/i.test(expand) && select) {
    return "$expand=attachments cannot be combined with $select";
  }
  if (/\/attachments$/i.test(parsed.path) && /contentBytes/i.test(select)) {
    return "attachments $select cannot include contentBytes";
  }
  return null;
}

export function graphQueryShape(parsed: GraphQueryLog): string {
  const flags: string[] = [];
  if (parsed.filter) {
    if (/contains\s*\(\s*subject/i.test(parsed.filter)) flags.push("filter:contains-subject");
    else if (/hasAttachments/i.test(parsed.filter) && /receivedDateTime/i.test(parsed.filter)) {
      flags.push("filter:received+hasAttachments");
    } else if (/conversationId/i.test(parsed.filter)) flags.push("filter:conversationId");
    else if (/internetMessageId/i.test(parsed.filter)) flags.push("filter:internetMessageId");
    else if (/receivedDateTime/i.test(parsed.filter)) flags.push("filter:receivedDateTime");
    else flags.push("filter:other");
  }
  if (parsed.search) {
    if (/attachment\s*:/i.test(parsed.search)) flags.push("search:attachment");
    else if (/subject\s*:/i.test(parsed.search)) flags.push("search:subject");
    else if (/body\s*:/i.test(parsed.search)) flags.push("search:body");
    else flags.push("search:phrase");
  }
  if (parsed.select) flags.push("select");
  if (parsed.orderby) flags.push("orderby");
  if (parsed.expand) flags.push("expand");
  if (parsed.search && parsed.filter) flags.push("combo:search+filter");
  if (parsed.search && parsed.orderby) flags.push("combo:search+orderby");
  return `${parsed.path}|${flags.join(",")}`;
}

export function isGraphQueryCircuitEligible(parsed: GraphQueryLog): boolean {
  return Boolean(parsed.filter || parsed.search || parsed.expand);
}

export function recordGraphQueryFailure(
  parsed: GraphQueryLog,
  status: number,
  code: string,
): void {
  if (!isGraphQueryCircuitEligible(parsed)) return;
  if (status !== 400) return;
  blockedShapes.set(graphQueryShape(parsed), { status, code });
}

export function blockedGraphQuery(parsed: GraphQueryLog): { status: number; code: string } | null {
  if (!isGraphQueryCircuitEligible(parsed)) return null;
  return blockedShapes.get(graphQueryShape(parsed)) ?? null;
}

export function logIllegalGraphQuery(parsed: GraphQueryLog, reason: string): void {
  const shape = graphQueryShape(parsed);
  if (loggedIllegalShapes.has(shape)) return;
  loggedIllegalShapes.add(shape);
  console.error("[graph-mail] blocked illegal query", {
    ...graphQueryLogFields(parsed),
    reason,
  });
}

export function logSkippedBlockedGraphQuery(
  parsed: GraphQueryLog,
  blocked: { status: number; code: string },
): void {
  const shape = graphQueryShape(parsed);
  if (loggedSkipShapes.has(shape)) return;
  loggedSkipShapes.add(shape);
  console.warn("[graph-mail] skipping known-bad query", {
    ...graphQueryLogFields(parsed),
    status: blocked.status,
    code: blocked.code,
  });
}

function toGraphUrl(pathOrUrl: string): URL {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return new URL(pathOrUrl);
  }
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return new URL(path, GRAPH_ORIGIN);
}
