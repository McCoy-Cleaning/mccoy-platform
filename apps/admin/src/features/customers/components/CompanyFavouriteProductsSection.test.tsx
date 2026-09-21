import * as React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@/lib/api/admin-customers.functions", () => ({
  listAdminCompanyFavouriteProducts: vi.fn(),
  addAdminCompanyFavouriteProduct: vi.fn(),
  removeAdminCompanyFavouriteProduct: vi.fn(),
  searchAdminActiveProducts: vi.fn(),
}));

import {
  addAdminCompanyFavouriteProduct,
  listAdminCompanyFavouriteProducts,
  removeAdminCompanyFavouriteProduct,
  searchAdminActiveProducts,
} from "@/lib/api/admin-customers.functions";
import {
  CompanyFavouriteProductsSection,
  favouriteDisplayCategory,
  pickerProductsNotFavourited,
} from "./CompanyFavouriteProductsSection";

const listMock = vi.mocked(listAdminCompanyFavouriteProducts);
const addMock = vi.mocked(addAdminCompanyFavouriteProduct);
const removeMock = vi.mocked(removeAdminCompanyFavouriteProduct);
const searchMock = vi.mocked(searchAdminActiveProducts);

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_PRODUCT_ID = "44444444-4444-4444-8444-444444444444";

const FAVOURITE = {
  id: "fav-1",
  companyId: COMPANY_ID,
  productId: PRODUCT_ID,
  productName: "Microvezel mop",
  productSku: "MC-MOP-240",
  productStatus: "active" as const,
  createdBy: null,
  createdAt: "2026-09-18T12:00:00.000Z",
};

const CATALOGUE_PRODUCT = {
  id: OTHER_PRODUCT_ID,
  name: "Glasreiniger 5L",
  sku: "MC-GLS-005",
  status: "active" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function mount(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  mounted = { container, root };
  return container;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** A promise the test resolves by hand, so the unsettled window can be asserted. */
function deferred<T>() {
  let settle!: (value: T) => void;
  let fail!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, settle, fail };
}

function statusText(container: HTMLElement): string {
  return container.querySelector('[data-testid="favourites-status"]')?.textContent ?? "";
}

function cardNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("article h3")).map((node) => node.textContent ?? "");
}

async function openPickerAndAdd(container: HTMLElement, label: string) {
  const addButton = Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes("Product toevoegen"),
  );
  await act(async () => {
    addButton!.click();
  });
  await flush();

  const option = Array.from(container.querySelectorAll('[role="option"]')).find((button) =>
    button.textContent?.includes(label),
  );
  await act(async () => {
    (option as HTMLButtonElement).click();
  });
}

afterEach(() => {
  if (mounted) {
    act(() => mounted!.root.unmount());
    mounted.container.remove();
    mounted = null;
  }
  vi.clearAllMocks();
});

describe("CompanyFavouriteProductsSection helpers", () => {
  it("does not invent a category when the list payload has none", () => {
    expect(favouriteDisplayCategory(FAVOURITE)).toBeNull();
    expect(
      favouriteDisplayCategory({ ...FAVOURITE, category: "Schoonmaak" }),
    ).toBe("Schoonmaak");
  });

  it("hides already-favourited products from the picker", () => {
    const visible = pickerProductsNotFavourited(
      [
        { ...CATALOGUE_PRODUCT, id: PRODUCT_ID, name: "Microvezel mop" },
        CATALOGUE_PRODUCT,
      ],
      new Set([PRODUCT_ID]),
    );
    expect(visible).toEqual([CATALOGUE_PRODUCT]);
  });
});

describe("CompanyFavouriteProductsSection", () => {
  beforeEach(() => {
    listMock.mockResolvedValue({ ok: true, items: [FAVOURITE] });
    searchMock.mockResolvedValue({ ok: true, items: [CATALOGUE_PRODUCT] });
    addMock.mockResolvedValue({
      ok: true,
      item: {
        ...FAVOURITE,
        id: "fav-2",
        productId: OTHER_PRODUCT_ID,
        productName: CATALOGUE_PRODUCT.name,
        productSku: CATALOGUE_PRODUCT.sku,
      },
    });
    removeMock.mockResolvedValue({ ok: true, removed: true });
  });

  it("lists favourites from the company backend without prices", async () => {
    const container = mount(<CompanyFavouriteProductsSection companyId={COMPANY_ID} />);
    expect(container.textContent).toContain("Favorieten laden");
    await flush();

    expect(listMock).toHaveBeenCalledWith({ data: { companyId: COMPANY_ID } });
    expect(container.textContent).toContain("Microvezel mop");
    expect(container.textContent).toContain("MC-MOP-240");
    expect(container.textContent).not.toContain("€");
    expect(container.textContent).not.toContain("Voorbeeldproduct");
  });

  it("adds a catalogue product from the picker", async () => {
    const container = mount(<CompanyFavouriteProductsSection companyId={COMPANY_ID} />);
    await flush();

    const addButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Product toevoegen"),
    );
    expect(addButton).toBeTruthy();
    await act(async () => {
      addButton!.click();
    });
    await flush();

    expect(searchMock).toHaveBeenCalledWith({ data: { q: "", limit: 25 } });
    expect(container.textContent).toContain("Glasreiniger 5L");

    const option = Array.from(container.querySelectorAll('[role="option"]')).find((button) =>
      button.textContent?.includes("Glasreiniger 5L"),
    );
    expect(option).toBeTruthy();
    await act(async () => {
      (option as HTMLButtonElement).click();
    });
    await flush();

    expect(addMock).toHaveBeenCalledWith({
      data: { companyId: COMPANY_ID, productId: OTHER_PRODUCT_ID },
    });
  });

  it("removes a favourite via the trash control", async () => {
    const container = mount(<CompanyFavouriteProductsSection companyId={COMPANY_ID} />);
    await flush();

    const removeButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Microvezel mop verwijderen"]',
    );
    expect(removeButton).toBeTruthy();
    await act(async () => {
      removeButton!.click();
    });
    await flush();

    expect(removeMock).toHaveBeenCalledWith({
      data: { companyId: COMPANY_ID, productId: PRODUCT_ID },
    });
  });

  it("shows a catalogue-empty state instead of crashing when there are no products", async () => {
    listMock.mockResolvedValue({ ok: true, items: [] });
    searchMock.mockResolvedValue({ ok: true, items: [] });
    const container = mount(<CompanyFavouriteProductsSection companyId={COMPANY_ID} />);
    await flush();

    const addButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Product toevoegen"),
    );
    await act(async () => {
      addButton!.click();
    });
    await flush();

    expect(container.textContent).toContain("Nog geen catalogusproducten");
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("keeps list errors inside the favourites region", async () => {
    listMock.mockResolvedValue({ ok: false, error: "Favorieten tijdelijk onbeschikbaar." });
    const container = mount(<CompanyFavouriteProductsSection companyId={COMPANY_ID} />);
    await flush();

    expect(container.querySelector("[role='alert']")?.textContent).toContain(
      "Favorieten tijdelijk onbeschikbaar.",
    );
    expect(container.querySelector("#favorieten-heading")?.textContent).toBe("Favoriete producten");
  });
});

describe("CompanyFavouriteProductsSection optimistic rendering", () => {
  const CONFIRMED_ADD = {
    ...FAVOURITE,
    id: "fav-2",
    productId: OTHER_PRODUCT_ID,
    productName: CATALOGUE_PRODUCT.name,
    productSku: CATALOGUE_PRODUCT.sku,
  };

  beforeEach(() => {
    listMock.mockResolvedValue({ ok: true, items: [FAVOURITE] });
    searchMock.mockResolvedValue({ ok: true, items: [CATALOGUE_PRODUCT] });
    addMock.mockResolvedValue({ ok: true, item: CONFIRMED_ADD });
    removeMock.mockResolvedValue({ ok: true, removed: true });
  });

  it("shows an added product before the server confirms it", async () => {
    const pendingAdd = deferred<{ ok: true; item: typeof CONFIRMED_ADD }>();
    addMock.mockReturnValue(pendingAdd.promise as never);

    const container = mount(<CompanyFavouriteProductsSection companyId={COMPANY_ID} />);
    await flush();
    await openPickerAndAdd(container, "Glasreiniger 5L");

    // The add has not resolved, yet the card is already on screen.
    expect(cardNames(container)).toEqual(["Glasreiniger 5L", "Microvezel mop"]);
    const pendingCard = container.querySelector("article[aria-busy='true']");
    expect(pendingCard?.textContent).toContain("Glasreiniger 5L");
    expect(pendingCard?.textContent).toContain("Toevoegen…");

    // Its own remove control is locked, so the row cannot be double-submitted.
    const removeControl = container.querySelector<HTMLButtonElement>(
      '[aria-label="Glasreiniger 5L verwijderen"]',
    );
    expect(removeControl?.disabled).toBe(true);
    // A different row stays operable.
    expect(
      container.querySelector<HTMLButtonElement>('[aria-label="Microvezel mop verwijderen"]')?.disabled,
    ).toBe(false);

    await act(async () => {
      pendingAdd.settle({ ok: true, item: CONFIRMED_ADD });
    });
    await flush();

    expect(container.querySelector("article[aria-busy='true']")).toBeNull();
    expect(statusText(container)).toContain("Glasreiniger 5L toegevoegd aan de favorieten.");
  });

  it("rolls the row back and announces the failure when the server rejects an add", async () => {
    addMock.mockResolvedValue({ ok: false, error: "Product is niet meer actief." });

    const container = mount(<CompanyFavouriteProductsSection companyId={COMPANY_ID} />);
    await flush();
    await openPickerAndAdd(container, "Glasreiniger 5L");
    await flush();

    // The optimistic row is gone — the UI never shows a success the server refused.
    expect(cardNames(container)).toEqual(["Microvezel mop"]);

    const status = container.querySelector('[data-testid="favourites-status"]');
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.textContent).toContain("Glasreiniger 5L is niet toegevoegd.");
    expect(status?.textContent).toContain("Product is niet meer actief.");
  });

  it("rolls the row back when the add request throws", async () => {
    addMock.mockRejectedValue(new Error("network down"));

    const container = mount(<CompanyFavouriteProductsSection companyId={COMPANY_ID} />);
    await flush();
    await openPickerAndAdd(container, "Glasreiniger 5L");
    await flush();

    expect(cardNames(container)).toEqual(["Microvezel mop"]);
    expect(statusText(container)).toContain("is niet toegevoegd");
    // The raw transport error is never surfaced to staff.
    expect(statusText(container)).not.toContain("network down");
  });

  it("hides a removed row instantly and keeps it hidden once confirmed", async () => {
    const pendingRemove = deferred<{ ok: true; removed: boolean }>();
    removeMock.mockReturnValue(pendingRemove.promise as never);

    const container = mount(<CompanyFavouriteProductsSection companyId={COMPANY_ID} />);
    await flush();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Microvezel mop verwijderen"]')!
        .click();
    });

    expect(cardNames(container)).toEqual([]);

    await act(async () => {
      pendingRemove.settle({ ok: true, removed: true });
    });
    await flush();

    expect(cardNames(container)).toEqual([]);
    expect(statusText(container)).toContain("Microvezel mop verwijderd uit de favorieten.");
  });

  it("restores a removed row in place and announces the failure when the server rejects", async () => {
    const second = { ...FAVOURITE, id: "fav-9", productId: OTHER_PRODUCT_ID, productName: "Glasreiniger 5L" };
    listMock.mockResolvedValue({ ok: true, items: [FAVOURITE, second] });
    removeMock.mockResolvedValue({ ok: false, error: "Geen rechten." });

    const container = mount(<CompanyFavouriteProductsSection companyId={COMPANY_ID} />);
    await flush();
    expect(cardNames(container)).toEqual(["Microvezel mop", "Glasreiniger 5L"]);

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="Microvezel mop verwijderen"]')!
        .click();
    });
    await flush();

    // Restored at its original index, not appended to the end.
    expect(cardNames(container)).toEqual(["Microvezel mop", "Glasreiniger 5L"]);
    expect(statusText(container)).toContain("Microvezel mop is niet verwijderd.");
    expect(statusText(container)).toContain("Geen rechten.");
    // The control is usable again so the staff member can retry.
    expect(
      container.querySelector<HTMLButtonElement>('[aria-label="Microvezel mop verwijderen"]')?.disabled,
    ).toBe(false);
  });

  it("restores only the failed row when two removals are in flight at once", async () => {
    const second = { ...FAVOURITE, id: "fav-9", productId: OTHER_PRODUCT_ID, productName: "Glasreiniger 5L" };
    listMock.mockResolvedValue({ ok: true, items: [FAVOURITE, second] });

    const failing = deferred<{ ok: false; error: string }>();
    const succeeding = deferred<{ ok: true; removed: boolean }>();
    removeMock.mockImplementation((({ data }: { data: { productId: string } }) =>
      data.productId === PRODUCT_ID ? failing.promise : succeeding.promise) as never);

    const container = mount(<CompanyFavouriteProductsSection companyId={COMPANY_ID} />);
    await flush();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Microvezel mop verwijderen"]')!.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Glasreiniger 5L verwijderen"]')!.click();
    });
    expect(cardNames(container)).toEqual([]);

    // The successful delete settles first, then the rejected one rolls back.
    await act(async () => {
      succeeding.settle({ ok: true, removed: true });
    });
    await act(async () => {
      failing.settle({ ok: false, error: "Geen rechten." });
    });
    await flush();

    // A snapshot-based rollback would wrongly resurrect the successfully deleted row.
    expect(cardNames(container)).toEqual(["Microvezel mop"]);
  });

  it("never falls back to the loading skeleton while a mutation settles", async () => {
    const container = mount(<CompanyFavouriteProductsSection companyId={COMPANY_ID} />);
    await flush();
    expect(container.textContent).not.toContain("Favorieten laden…");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Microvezel mop verwijderen"]')!.click();
    });
    // The section stays interactive instead of blanking out mid-mutation.
    expect(container.textContent).not.toContain("Favorieten laden…");
    await flush();
    expect(container.textContent).not.toContain("Favorieten laden…");
  });

  it("reconciles with authoritative server state after the mutation settles", async () => {
    const container = mount(<CompanyFavouriteProductsSection companyId={COMPANY_ID} />);
    await flush();

    // Another staff member added a product in the meantime.
    const otherStaffRow = {
      ...FAVOURITE,
      id: "fav-7",
      productId: OTHER_PRODUCT_ID,
      productName: "Glasreiniger 5L",
    };
    listMock.mockResolvedValue({ ok: true, items: [FAVOURITE, otherStaffRow] });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Microvezel mop verwijderen"]')!.click();
    });
    await flush();

    // The silent revalidation picked up the other row without resurrecting the
    // one this user just removed.
    expect(cardNames(container)).toEqual(["Glasreiniger 5L"]);
  });
});
