/**
 * Regression cover for the Klanten directory paging contract:
 * `portalStatus` is derived in application code, so it must be applied before the
 * page is sliced and it must be reflected in `total`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerPortalStatus } from "@mccoy/domain";

type Row = Record<string, unknown>;

const { state } = vi.hoisted(() => ({
  state: {
    current: {
      companies: [] as Row[],
      portalStatusById: {} as Record<string, string>,
    },
  },
}));

function matches(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([column, value]) => row[column] === value);
}

/**
 * Minimal chainable stand-in. Only the `companies` table has real filter/slice
 * behaviour; every other read resolves empty, which is enough to exercise paging.
 */
function createChain(table: string) {
  const filters: Array<[string, unknown]> = [];
  let rangeBounds: { from: number; to: number } | null = null;

  function resolve() {
    if (table !== "companies") return { data: [], error: null, count: 0 };
    const all = state.current.companies.filter((row) => matches(row, filters));
    const count = all.length;
    const data = rangeBounds ? all.slice(rangeBounds.from, rangeBounds.to + 1) : all;
    return { data, error: null, count };
  }

  const chain: Record<string, unknown> = {};
  const passthrough =
    () =>
    (..._args: unknown[]) =>
      chain;

  chain.select = passthrough();
  chain.or = passthrough();
  chain.in = passthrough();
  chain.is = passthrough();
  chain.gte = passthrough();
  chain.lt = passthrough();
  chain.order = passthrough();
  chain.limit = passthrough();
  chain.insert = passthrough();
  chain.update = passthrough();
  chain.upsert = passthrough();
  chain.eq = (column: string, value: unknown) => {
    filters.push([column, value]);
    return chain;
  };
  chain.range = (from: number, to: number) => {
    rangeBounds = { from, to };
    return chain;
  };
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
  chain.single = () => Promise.resolve({ data: null, error: null });
  chain.then = (
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(resolve()).then(onFulfilled, onRejected);

  return chain;
}

const fakeClient = {
  from: (table: string) => createChain(table),
  schema: () => ({
    from: (table: string) => createChain(table),
    rpc: () => Promise.resolve({ data: [], error: null }),
  }),
  rpc: () => Promise.resolve({ data: [], error: null }),
};

vi.mock("../supabase", () => ({
  createSupabaseServiceClient: () => fakeClient,
}));

vi.mock("../customer-portal/portal-status", () => ({
  resolveCustomerPortalStatus: async (companyId: string) =>
    (state.current.portalStatusById[companyId] ?? "registration_required") as CustomerPortalStatus,
}));

vi.mock("./core", () => ({
  getCompanyById: async () => null,
}));

vi.mock("../customer-portal/membership", () => ({
  listCompanyMemberships: async () => [],
}));

vi.mock("../customer-portal/invitations", () => ({
  listInvitationsForCompany: async () => [],
}));

const { listAdminCustomersDirectory } = await import("./admin-customers-directory");

function company(index: number, portalStatus: string): Row {
  const id = `company-${index}`;
  state.current.portalStatusById[id] = portalStatus;
  return {
    id,
    legal_name: `Bedrijf ${String(index).padStart(2, "0")}`,
    display_name: null,
    company_type: "service_client",
    status: "active",
    email: null,
    contact_person_name: null,
    external_customer_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    invoice_allowed: false,
    kvk_number: null,
    vat_number: null,
    address_street: null,
    address_house_number: null,
    address_house_suffix: null,
    address_postal_code: null,
    address_city: null,
  };
}

describe("listAdminCustomersDirectory portalStatus paging", () => {
  beforeEach(() => {
    state.current = { companies: [], portalStatusById: {} };
  });

  it("fills a full page from matches that sit beyond the first SQL page", async () => {
    // Only every 10th company is "active", so a SQL-page-then-filter implementation
    // would return a single row for page 1 and lose the rest entirely.
    const companies: Row[] = [];
    for (let i = 0; i < 40; i += 1) {
      companies.push(company(i, i % 10 === 0 ? "active" : "registration_required"));
    }
    state.current.companies = companies;

    const result = await listAdminCustomersDirectory({
      portalStatus: "active",
      page: 1,
      pageSize: 3,
    });

    expect(result.items.map((item) => item.companyId)).toEqual([
      "company-0",
      "company-10",
      "company-20",
    ]);
    expect(result.items.every((item) => item.portalStatus === "active")).toBe(true);
  });

  it("reports total as the filtered count, not the unfiltered company count", async () => {
    state.current.companies = [
      company(0, "active"),
      company(1, "registration_required"),
      company(2, "active"),
      company(3, "invited"),
    ];

    const result = await listAdminCustomersDirectory({ portalStatus: "active", pageSize: 25 });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it("pages through the filtered set without repeating or skipping rows", async () => {
    state.current.companies = [
      company(0, "active"),
      company(1, "invited"),
      company(2, "active"),
      company(3, "active"),
      company(4, "invited"),
      company(5, "active"),
    ];

    const first = await listAdminCustomersDirectory({
      portalStatus: "active",
      page: 1,
      pageSize: 2,
    });
    const second = await listAdminCustomersDirectory({
      portalStatus: "active",
      page: 2,
      pageSize: 2,
    });

    expect(first.items.map((i) => i.companyId)).toEqual(["company-0", "company-2"]);
    expect(second.items.map((i) => i.companyId)).toEqual(["company-3", "company-5"]);
    expect(first.total).toBe(4);
    expect(second.total).toBe(4);
  });

  it("still uses the SQL count and range when no portal status filter is applied", async () => {
    state.current.companies = [
      company(0, "active"),
      company(1, "invited"),
      company(2, "registration_required"),
    ];

    const result = await listAdminCustomersDirectory({ portalStatus: "all", page: 1, pageSize: 2 });

    expect(result.total).toBe(3);
    expect(result.items.map((i) => i.companyId)).toEqual(["company-0", "company-1"]);
  });
});
