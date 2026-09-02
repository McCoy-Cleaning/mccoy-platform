export type CustomersPopulation = "guests" | "portal";

export type CustomersSearch = {
  tab: CustomersPopulation;
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

export function validateCustomersSearch(search: Record<string, unknown>): CustomersSearch {
  // Legacy "registered" / "bestaande klanten" URLs land on Serviceklanten (portal).
  const tab =
    search.tab === "guests"
      ? "guests"
      : search.tab === "registered"
        ? "portal"
        : search.tab === "portal"
          ? "portal"
          : "portal";
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
  return { tab, q, status, portalStatus, page };
}
