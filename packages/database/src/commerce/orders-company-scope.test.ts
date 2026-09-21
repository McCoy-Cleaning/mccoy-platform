/**
 * Cross-company isolation cover for customer order reads.
 * A user can hold order history under more than one company (guest conversion,
 * membership changes), so any company-scoped view must filter on `company_id`.
 */

import { describe, expect, it, vi } from "vitest";

type Filter = [string, unknown];

const { calls } = vi.hoisted(() => ({ calls: { current: [] as Filter[][] } }));

const ORDERS = [
  {
    id: "order-a1",
    number: "ORD-A1",
    company_id: "company-a",
    customer_user_id: "user-1",
    guest_purchaser_id: null,
    purchaser_email: "user1@example.test",
    purchaser_email_normalized: "user1@example.test",
    purchaser_name: null,
    purchaser_phone: null,
    purchaser_company_name: null,
    billing_address: {},
    shipping_address: {},
    currency: "EUR",
    subtotal_minor: 10000,
    tax_minor: 2100,
    total_minor: 12100,
    order_status: "completed",
    payment_status: "paid",
    fulfilment_status: "fulfilled",
    source: "storefront",
    placed_at: "2026-02-01T00:00:00.000Z",
    created_at: "2026-02-01T00:00:00.000Z",
    updated_at: "2026-02-01T00:00:00.000Z",
  },
  {
    id: "order-b1",
    number: "ORD-B1",
    company_id: "company-b",
    customer_user_id: "user-1",
    guest_purchaser_id: null,
    purchaser_email: "user1@example.test",
    purchaser_email_normalized: "user1@example.test",
    purchaser_name: null,
    purchaser_phone: null,
    purchaser_company_name: null,
    billing_address: {},
    shipping_address: {},
    currency: "EUR",
    subtotal_minor: 50000,
    tax_minor: 10500,
    total_minor: 60500,
    order_status: "completed",
    payment_status: "paid",
    fulfilment_status: "fulfilled",
    source: "storefront",
    placed_at: "2026-03-01T00:00:00.000Z",
    created_at: "2026-03-01T00:00:00.000Z",
    updated_at: "2026-03-01T00:00:00.000Z",
  },
];

function createChain() {
  const filters: Filter[] = [];
  calls.current.push(filters);

  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (column: string, value: unknown) => {
    filters.push([column, value]);
    return chain;
  };
  chain.order = () => chain;
  chain.then = (
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => {
    const data = ORDERS.filter((row) =>
      filters.every(([column, value]) => (row as Record<string, unknown>)[column] === value),
    );
    return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
  };
  return chain;
}

vi.mock("../supabase", () => ({
  createSupabaseServiceClient: () => ({ from: () => createChain() }),
}));

const { listOrdersForCustomer } = await import("./core");

describe("listOrdersForCustomer", () => {
  it("returns every order for the user when no company scope is given", async () => {
    const orders = await listOrdersForCustomer("user-1");
    expect(orders.map((order) => order.number).sort()).toEqual(["ORD-A1", "ORD-B1"]);
  });

  it("never returns another company's orders when scoped to a company", async () => {
    const orders = await listOrdersForCustomer("user-1", { companyId: "company-a" });
    expect(orders.map((order) => order.number)).toEqual(["ORD-A1"]);
    expect(orders.every((order) => order.companyId === "company-a")).toBe(true);
  });

  it("applies both the user and the company filter in the query", async () => {
    calls.current = [];
    await listOrdersForCustomer("user-1", { companyId: "company-b" });
    expect(calls.current[0]).toEqual([
      ["customer_user_id", "user-1"],
      ["company_id", "company-b"],
    ]);
  });
});
