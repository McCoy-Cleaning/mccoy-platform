export type UsersSearch = {
  q: string;
  companyId: string | undefined;
  userId: string | undefined;
  page: number;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUsersSearch(search: Record<string, unknown>): UsersSearch {
  const q = typeof search.q === "string" ? search.q.slice(0, 200) : "";
  const page =
    typeof search.page === "number" && Number.isFinite(search.page)
      ? Math.max(1, Math.trunc(search.page))
      : typeof search.page === "string" && /^\d+$/.test(search.page)
        ? Math.max(1, Number(search.page))
        : 1;
  const companyRaw = typeof search.companyId === "string" ? search.companyId.trim() : "";
  const companyId = UUID_RE.test(companyRaw) ? companyRaw : undefined;
  const userRaw = typeof search.userId === "string" ? search.userId.trim().slice(0, 160) : "";
  const userId = userRaw.length > 0 ? userRaw : undefined;
  return { q, companyId, userId, page };
}
