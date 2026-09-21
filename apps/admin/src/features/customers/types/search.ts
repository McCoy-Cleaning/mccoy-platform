export type CustomersPopulation = "guests" | "portal";

export type CustomersDirectoryTab = "all" | "service" | "enrolled" | "awaiting";

export type CustomersSearch = {
  tab: CustomersDirectoryTab;
  q: string;
  status: "all" | "invited" | "active" | "blocked";
  portalStatus:
    | "all"
    | "active"
    | "registration_required"
    | "invited"
    | "reminder_sent"
    | "invite_expired"
    | "suspended";
  page: number;
  companyId: string | undefined;
};

const PORTAL_STATUSES = new Set([
  "all",
  "active",
  "registration_required",
  "invited",
  "reminder_sent",
  "invite_expired",
  "suspended",
]);

const DIRECTORY_TABS = new Set<CustomersDirectoryTab>(["all", "service", "enrolled", "awaiting"]);

export function validateCustomersSearch(search: Record<string, unknown>): CustomersSearch {
  const rawTab = search.tab;
  let tab: CustomersDirectoryTab = "all";
  if (rawTab === "service" || rawTab === "portal" || rawTab === "registered") {
    tab = "service";
  } else if (rawTab === "enrolled") {
    tab = "enrolled";
  } else if (rawTab === "awaiting") {
    tab = "awaiting";
  } else if (rawTab === "all" || rawTab === "guests") {
    tab = "all";
  } else if (typeof rawTab === "string" && DIRECTORY_TABS.has(rawTab as CustomersDirectoryTab)) {
    tab = rawTab as CustomersDirectoryTab;
  }

  const q = typeof search.q === "string" ? search.q.slice(0, 200) : "";
  const statusRaw = typeof search.status === "string" ? search.status : "all";
  const status =
    statusRaw === "invited" || statusRaw === "active" || statusRaw === "blocked"
      ? statusRaw
      : "all";
  const portalRaw = typeof search.portalStatus === "string" ? search.portalStatus : "all";
  const portalStatus = PORTAL_STATUSES.has(portalRaw)
    ? (portalRaw as CustomersSearch["portalStatus"])
    : "all";
  const page =
    typeof search.page === "number" && Number.isFinite(search.page)
      ? Math.max(1, Math.trunc(search.page))
      : typeof search.page === "string" && /^\d+$/.test(search.page)
        ? Math.max(1, Number(search.page))
        : 1;
  const companyRaw = typeof search.companyId === "string" ? search.companyId.trim() : "";
  const companyId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyRaw)
      ? companyRaw
      : undefined;
  return { tab, q, status, portalStatus, page, companyId };
}
