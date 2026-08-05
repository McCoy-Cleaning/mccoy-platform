import { describe, expect, it } from "vitest";
import {
  ensureBuiltinSectionContent,
  migrateProductsCompositeSplit,
  type BuiltinCmsPage,
} from "./index";

describe("products composite split", () => {
  it("moves cards from products.main into products.info", () => {
    const migrated = migrateProductsCompositeSplit({
      "products.main": {
        eyebrow: "Producten",
        heading: "McCoy Products",
        intro: "Intro tekst",
        cards: [
          {
            id: "prod_hygiene",
            title: "Hygiëne papier",
            description: "Desc",
            image: {
              assetId: "local:images/cms/products-flyer.png",
              src: "/images/cms/products-flyer.png",
              alt: "Hygiëne papier",
              decorative: false,
            },
          },
        ],
      } as never,
    });

    expect(migrated["products.main"]).toMatchObject({
      eyebrow: "Producten",
      heading: "Geurproducten met een premium sanitaire beleving.",
      intro: "Intro tekst",
    });
    // Legacy upgrade fills the default webshop notice into Extra sectietekst.
    expect(migrated["products.main"]?.body).toContain("webshop");
    expect(migrated["products.info"]?.cards).toHaveLength(1);
    expect(migrated["products.info"]?.cards[0]?.id).toBe("prod_hygiene");
    expect(migrated["products.info"]?.heading).toBeTruthy();
    expect(migrated["products.info"]?.intro).toBeTruthy();
  });

  it("adds title and intro to products.info that only has cards", () => {
    const migrated = migrateProductsCompositeSplit({
      "products.info": {
        cards: [
          {
            id: "prod_hygiene",
            title: "Hygiëne papier",
            description: "Desc",
          },
        ],
      } as never,
    });

    expect(migrated["products.info"]?.heading).toBeTruthy();
    expect(migrated["products.info"]?.intro).toBeTruthy();
    expect(migrated["products.info"]?.cards).toHaveLength(1);
  });

  it("folds products.flyer image back into products.main", () => {
    const migrated = migrateProductsCompositeSplit({
      "products.main": {
        eyebrow: "Producten",
        heading: "McCoy Products",
        intro: "Intro",
      },
      "products.flyer": {
        image: {
          assetId: "local:images/cms/products-flyer.png",
          src: "/images/cms/products-flyer.png",
          alt: "Flyer",
          decorative: false,
        },
      },
    } as never);

    expect((migrated as Record<string, unknown>)["products.flyer"]).toBeUndefined();
    expect(migrated["products.main"]?.image?.src).toContain("products-flyer");
  });

  it("ensureBuiltinSectionContent hydrates products main and info", () => {
    const page = {
      kind: "builtin",
      isCustom: false,
      pageKey: "products",
      id: "page_products",
      slug: "/products",
      title: "Producten",
      description: "",
      inNav: true,
      blocks: [],
      layout: [],
      layoutVersion: 6,
      sectionContent: {},
      updatedAt: 0,
      version: 1,
    } as BuiltinCmsPage;

    const ensured = ensureBuiltinSectionContent(page);
    expect(ensured["products.main"]?.heading).toBeTruthy();
    expect(ensured["products.main"]?.intro.length).toBeGreaterThan(40);
    expect(ensured["products.main"]?.body).toBeTruthy();
    expect(ensured["products.main"]?.image?.src).toBeTruthy();
    expect(ensured["products.info"]?.cards.length).toBeGreaterThan(0);
    expect(ensured["products.info"]?.heading).toBeTruthy();
    expect(ensured["products.info"]?.intro).toBeTruthy();
  });

  it("upgrades legacy short products.main intro into full sectietekst", () => {
    const migrated = migrateProductsCompositeSplit({
      "products.main": {
        eyebrow: "Producten",
        heading: "McCoy Products",
        intro: "Hygiënepapier, zepen, reinigingsmiddelen en meer.",
      },
    } as never);

    expect(migrated["products.main"]?.heading).toContain("Geurproducten");
    expect(migrated["products.main"]?.intro).toContain("McCoy Products");
    expect(migrated["products.main"]?.intro).toContain("contactformulier");
    // Short legacy intro upgrade also restores the default webshop notice body.
    expect(migrated["products.main"]?.body).toContain("webshop");
  });

  it("rewrites legacy contact body into webshop notice", () => {
    const migrated = migrateProductsCompositeSplit({
      "products.main": {
        eyebrow: "Producten",
        heading: "Geurproducten met een premium sanitaire beleving.",
        intro: "Custom intro",
        body: "Voor het verkrijgen van onze producten kunt u bellen of contact op nemen via het contactformulier, we helpen u dan graag.",
      },
    } as never);

    expect(migrated["products.main"]?.intro).toBe("Custom intro");
    expect(migrated["products.main"]?.body).toContain("webshop");
  });

  it("does not regenerate cleared products.main intro or body", () => {
    const migrated = migrateProductsCompositeSplit({
      "products.main": {
        eyebrow: "Producten",
        heading: "Geurproducten met een premium sanitaire beleving.",
        intro: "",
        body: "",
      },
    } as never);

    expect(migrated["products.main"]?.intro).toBe("");
    expect(migrated["products.main"]?.body).toBeFalsy();
  });

  it("accepts products.info with empty heading and intro", () => {
    const migrated = migrateProductsCompositeSplit({
      "products.info": {
        heading: "",
        intro: "",
        cards: [
          {
            id: "prod_hygiene",
            title: "Hygiëne papier",
            description: "Desc",
          },
        ],
      } as never,
    });

    expect(migrated["products.info"]?.heading).toBe("");
    expect(migrated["products.info"]?.intro).toBe("");
  });
});
