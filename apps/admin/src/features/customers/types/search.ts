export type CustomersPopulation = "registered" | "guests";

export type CustomersSearch = {
  tab: CustomersPopulation;
  q: string;
  status: "all" | "invited" | "active" | "blocked";
  page: number;
};

export function validateCustomersSearch(search: Record<string, unknown>): CustomersSearch {
  const tab = search.tab === "guests" ? "guests" : "registered";
  const q = typeof search.q === "string" ? search.q.slice(0, 200) : "";
  const statusRaw = typeof search.status === "string" ? search.status : "all";
  const status =
    statusRaw === "invited" || statusRaw === "active" || statusRaw === "blocked"
      ? statusRaw
      : "all";
  const page =
    typeof search.page === "number" && Number.isFinite(search.page)
      ? Math.max(1, Math.trunc(search.page))
      : typeof search.page === "string" && /^\d+$/.test(search.page)
        ? Math.max(1, Number(search.page))
        : 1;
  return { tab, q, status, page };
}
