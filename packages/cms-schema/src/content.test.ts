import { describe, expect, it } from "vitest";
import {
  canApplyPatch,
  createMutationId,
  createSessionId,
  defaultSectionContent,
  ensureStableCollectionIds,
  mergeSectionPatch,
  migrateLegacyHeroOverrides,
  migrateLegacyHeroContent,
  migrateLegacyStatsContent,
  migrateLegacyWorkGalleryContent,
  migrateEmptyPartnersContent,
  migratePartnersLogoBackdrop,
  migrateOriginalServicesImages,
  migrateOriginalWorkGalleryImages,
  migrateOriginalHeroImage,
  normalizeContactFormContent,
  parseCmsEditMessage,
  parseSectionContent,
  ensureBuiltinSectionContent,
  resolveContactFormHighlights,
  shouldApplyDraft,
  CMS_EDIT_CHANNEL,
  uploadedImage,
  isUploadedCmsImage,
  storageImage,
  isStorageCmsImage,
  isLegacyEmbeddedCmsImage,
  collectLegacyEmbeddedImages,
  replaceCmsImagesInTree,
  SECTION_CONTENT_SCHEMAS,
} from "./index";
import type { FixedSectionKey } from "./sections";
import { FIXED_SECTION_DEFS } from "./sections";

describe("section content", () => {
  it("SECTION_CONTENT_SCHEMAS safeParse defaults without throwing (no circular Zod init)", () => {
    const keys = Object.keys(FIXED_SECTION_DEFS) as FixedSectionKey[];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const schema = SECTION_CONTENT_SCHEMAS[key];
      expect(schema, `missing schema for ${key}`).toBeDefined();
      expect(typeof schema.safeParse, `${key} schema.safeParse`).toBe("function");
      const result = schema.safeParse(defaultSectionContent(key));
      expect(result.success, `${key} default should parse`).toBe(true);
    }
    // Builtins used by resolvePublishedFormScope must be present and healthy.
    for (const key of ["contact.form", "offerte.form", "vacatures.application"] as const) {
      expect(SECTION_CONTENT_SCHEMAS[key].safeParse(defaultSectionContent(key)).success).toBe(true);
    }
  });

  it("parses default home hero matching the original copy without primary Offerte CTA", () => {
    const raw = defaultSectionContent("home.hero") as {
      eyebrow: string;
      heading: string;
      headingAccent: string;
      body: string;
      primaryCta?: unknown;
      secondaryCta?: { label: string };
    };
    const parsed = parseSectionContent("home.hero", raw);
    expect(parsed?.eyebrow).toBe("Live Clean");
    expect(parsed?.heading).toBe("Bij McCoy wordt kwaliteit");
    expect(parsed?.headingAccent).toBe("zichtbaar.");
    expect(parsed?.body).toContain("Geen onderaannemers");
    expect(raw.primaryCta).toBeUndefined();
    expect(raw.secondaryCta?.label).toBe("Bekijk onze diensten");
    expect(parsed?.image?.assetId.startsWith("local:")).toBe(true);
  });

  it("migrates legacy prototype hero to the original defaults", () => {
    const migrated = migrateLegacyHeroContent({
      eyebrow: "Schoonmaakbedrijf Twente",
      heading: "Bij McCoy wordt",
      headingAccent: "kwaliteit zichtbaar.",
      body: "Al meer dan 25 jaar staan wij voor schoonmaak met karakter — uitgevoerd door een vast eigen team.",
      image: {
        assetId: "local:custom",
        src: "/images/hero-cleaning.jpg",
        alt: "Custom",
        decorative: false,
      },
      primaryCta: {
        label: "Offerte aanvragen",
        link: { type: "internal_route", route: "offerte" },
      },
      secondaryCta: {
        label: "Bekijk onze diensten",
        link: { type: "internal_route", route: "services" },
      },
    });
    expect(migrated.eyebrow).toBe("Live Clean");
    expect(migrated.heading).toBe("Bij McCoy wordt kwaliteit");
    expect(migrated.headingAccent).toBe("zichtbaar.");
    expect(migrated.primaryCta).toBeUndefined();
    expect(migrated.image?.src).toBe("/images/hero-cleaning.jpg");
  });

  it("migrates truncated prototype work gallery to six tiles", () => {
    const migrated = migrateLegacyWorkGalleryContent({
      eyebrow: "Ons werk",
      heading: "Een blik op wat wij doen",
      body: "x",
      items: [
        {
          id: "gallery_regular",
          title: "Reguliere schoonmaak",
          image: {
            assetId: "local:a",
            src: "/images/gallery-placeholder.jpg",
            alt: "a",
            decorative: false,
          },
        },
        {
          id: "gallery_horeca",
          title: "Horeca schoonmaak",
          image: {
            assetId: "local:b",
            src: "/images/gallery-placeholder.jpg",
            alt: "b",
            decorative: false,
          },
        },
        {
          id: "gallery_oplevering",
          title: "Opleveringsschoonmaak",
          image: {
            assetId: "local:c",
            src: "/images/gallery-placeholder.jpg",
            alt: "c",
            decorative: false,
          },
        },
      ],
    });
    expect(migrated.items).toHaveLength(6);
    expect(migrated.items.map((i) => i.title)).toEqual([
      "Reguliere schoonmaak",
      "Horeca schoonmaak",
      "Opleveringsschoonmaak",
      "Vloeronderhoud",
      "Meubelreiniging",
      "Glasbewassing & Buitenreiniging",
    ]);
  });

  it("remaps mis-seeded service and gallery images to the original paths", () => {
    const services = defaultSectionContent("services.cards") as {
      cards: Array<{ id: string; image: { src: string } }>;
    };
    // Simulate pre-fix generic defaults
    services.cards = services.cards.map((c) => ({
      ...c,
      image: {
        ...c.image,
        src:
          c.id === "svc_regular" || c.id === "svc_furniture"
            ? "/images/cms/work-regular.jpg"
            : c.id === "svc_oplevering"
              ? "/images/cms/work-oplevering.jpg"
              : c.id === "svc_floor"
                ? "/images/cms/work-floor.jpg"
                : c.id === "svc_glass"
                  ? "/images/cms/work-glass.jpg"
                  : c.image.src,
      },
    }));
    const migratedServices = migrateOriginalServicesImages(services as never);
    expect(migratedServices.cards.find((c) => c.id === "svc_regular")?.image.src).toBe(
      "/images/cms/work-regular-sander.png",
    );
    expect(migratedServices.cards.find((c) => c.id === "svc_furniture")?.image.src).toBe(
      "/images/cms/work-furniture-bank.jpg",
    );
    expect(migratedServices.cards.find((c) => c.id === "svc_glass")?.image.src).toBe(
      "/images/cms/work-glass-van.jpg",
    );

    const gallery = migrateOriginalWorkGalleryImages({
      eyebrow: "Ons werk",
      heading: "Een blik",
      items: [
        {
          id: "gallery_furniture",
          title: "Meubelreiniging",
          image: {
            assetId: "local:x",
            src: "/images/cms/work-regular.jpg",
            alt: "x",
            decorative: false,
          },
        },
      ],
    });
    expect(gallery.items[0]?.image.src).toBe("/images/cms/about-vision-alt.png");
  });

  it("does not remap Supabase Storage URLs back to local /images paths", () => {
    const seedBase =
      "https://example.supabase.co/storage/v1/object/public/cms-media/media/a0000000-0000-4000-8000-000000000001";
    const regularSrc = `${seedBase}/66ca60d5-3e8f-45d6-924b-0ae30446eb62.jpg`;
    const glassSrc = `${seedBase}/23323708-7f6d-44c3-83f8-622f2494ec71.jpg`;
    const heroSrc = `${seedBase}/134be222-7354-472a-852f-68584c9ee3c2.jpg`;

    const services = migrateOriginalServicesImages({
      cards: [
        {
          id: "svc_regular",
          title: "Reguliere schoonmaak",
          description: "x",
          image: {
            assetId: "storage:x",
            src: regularSrc,
            alt: "x",
            decorative: false,
          },
        },
        {
          id: "svc_furniture",
          title: "Meubelreiniging",
          description: "x",
          image: {
            assetId: "storage:x",
            src: regularSrc,
            alt: "x",
            decorative: false,
          },
        },
        {
          id: "svc_glass",
          title: "Glas",
          description: "x",
          image: {
            assetId: "storage:x",
            src: glassSrc,
            alt: "x",
            decorative: false,
          },
        },
      ],
    });
    expect(services.cards.find((c) => c.id === "svc_regular")?.image.src).toBe(regularSrc);
    expect(services.cards.find((c) => c.id === "svc_furniture")?.image.src).toBe(regularSrc);
    expect(services.cards.find((c) => c.id === "svc_glass")?.image.src).toBe(glassSrc);

    const gallery = migrateOriginalWorkGalleryImages({
      eyebrow: "Ons werk",
      heading: "Een blik",
      items: [
        {
          id: "gallery_furniture",
          title: "Meubelreiniging",
          image: {
            assetId: "storage:x",
            src: regularSrc,
            alt: "x",
            decorative: false,
          },
        },
        {
          id: "gallery_regular",
          title: "Reguliere schoonmaak",
          image: {
            assetId: "storage:x",
            src: regularSrc,
            alt: "x",
            decorative: false,
          },
        },
      ],
    });
    expect(gallery.items.find((i) => i.id === "gallery_furniture")?.image.src).toBe(regularSrc);
    expect(gallery.items.find((i) => i.id === "gallery_regular")?.image.src).toBe(regularSrc);

    const hero = migrateOriginalHeroImage({
      eyebrow: "Live Clean",
      heading: "Bij McCoy wordt kwaliteit",
      headingAccent: "zichtbaar.",
      body: "x",
      image: {
        assetId: "storage:x",
        src: heroSrc,
        alt: "x",
        decorative: false,
      },
    });
    expect(hero.image?.src).toBe(heroSrc);
  });

  it("migrates legacy hero overrides without inventing cards", () => {
    const migrated = migrateLegacyHeroOverrides({
      "hero.title": "Hallo",
      "hero.sub": "Body",
      "hero.ctaSecondary": "Diensten",
    });
    expect(migrated.heading).toBe("Hallo");
    expect(migrated.body).toBe("Body");
    expect(migrated.secondaryCta?.label).toBe("Diensten");
    expect(migrated.secondaryCta?.link).toEqual({ type: "internal_route", route: "services" });
  });

  it("migrates legacy prototype stats to approved homepage copy", () => {
    const bad = {
      eyebrow: "Kwaliteit boven alles",
      heading: "Meer dan 25 jaar expertise in zichtbare kwaliteit.",
      body: "Wij geloven dat schoonmaak een vak is — geen bijzaak.",
      items: [
        { id: "stat_years", value: "25+", label: "jaar ervaring" },
        { id: "stat_team", value: "1", label: "vast team" },
        { id: "stat_focus", value: "100%", label: "eigen mensen" },
      ],
    };
    const migrated = migrateLegacyStatsContent(bad);
    expect(migrated.items.map((i) => i.value)).toEqual(["25+", "100%", "160+"]);
    expect(migrated.items.map((i) => i.label)).toEqual([
      "Jaar ervaring",
      "Vast eigen team",
      "Tevreden klanten",
    ]);
    expect(migrated.body).toContain("Daarom investeren wij in mensen");
    expect(migrated.heading).toBeUndefined();
  });

  it("keeps stable ids across ensureStableCollectionIds", () => {
    const items = ensureStableCollectionIds(
      [
        { id: "a", value: "1", label: "x" },
        { value: "2", label: "y" },
      ],
      "stat",
    );
    expect(items[0]!.id).toBe("a");
    expect(items[1]!.id).toMatch(/^stat_/);
    const again = ensureStableCollectionIds(items, "stat");
    expect(again.map((i) => i.id)).toEqual(items.map((i) => i.id));
  });

  it("mergeSectionPatch replaces arrays and deep-merges objects", () => {
    const base = defaultSectionContent("home.stats") as {
      heading?: string;
      items: Array<{ id: string; value: string; label: string }>;
    };
    const merged = mergeSectionPatch(base, {
      heading: "Nieuw",
      items: [{ id: "stat_years", value: "30+", label: "jaar" }],
    });
    expect(merged.heading).toBe("Nieuw");
    expect(merged.items).toHaveLength(1);
    expect(merged.items[0]!.id).toBe("stat_years");
  });

  it("mergeSectionPatch deletes optional fields with null", () => {
    const base = {
      ...(defaultSectionContent("home.hero") as Record<string, unknown>),
      primaryCta: {
        label: "Offerte aanvragen",
        link: { type: "internal_route" as const, route: "offerte" as const },
      },
    } as Record<string, unknown>;
    expect(base.primaryCta).toBeTruthy();
    const merged = mergeSectionPatch(base, { primaryCta: null, secondaryCta: null });
    expect(merged.primaryCta).toBeUndefined();
    expect(merged.secondaryCta).toBeUndefined();
    expect(merged.heading).toBe(base.heading);
  });

  it("keeps empty services.cards empty after ensure (legacy main.cards split)", () => {
    const page = {
      id: "page_services",
      slug: "diensten",
      title: "Diensten",
      description: "",
      inNav: true,
      blocks: [],
      updatedAt: 0,
      version: 1,
      kind: "builtin" as const,
      isCustom: false as const,
      pageKey: "services" as const,
      layout: [],
      layoutVersion: 1,
      sectionContent: {
        "services.main": {
          heading: "Custom heading",
          intro: "Custom intro",
          cards: [],
        },
      },
    };
    const ensured = ensureBuiltinSectionContent(page);
    const main = ensured["services.main"];
    const cards = ensured["services.cards"];
    expect(main?.heading).toBe("Custom heading");
    expect(main?.intro).toBe("Custom intro");
    expect(main && "cards" in main ? main.cards : undefined).toBeUndefined();
    expect(cards?.cards).toEqual([]);
  });

  it("does not re-apply flat hero.* overrides over existing structured hero content", () => {
    const page = {
      id: "page_home",
      slug: "/",
      title: "Home",
      description: "",
      inNav: true,
      blocks: [],
      updatedAt: 0,
      version: 1,
      kind: "builtin" as const,
      isCustom: false as const,
      pageKey: "home" as const,
      layout: [],
      layoutVersion: 1,
      sectionContent: {
        "home.hero": {
          eyebrow: "Live Clean",
          heading: "Structured heading",
          headingAccent: "zichtbaar.",
          body: "Al meer dan 25 jaar staan wij voor schoonmaak met karakter — uitgevoerd door een vast eigen team, met professionele middelen en een onmiskenbaar oog voor detail. Geen onderaannemers, geen losse krachten: alleen vakmensen die uw pand behandelen alsof het hun eigen pand is.",
          image: {
            assetId: "local:images/cms/hero-cleaning.jpg",
            src: "/images/cms/hero-cleaning.jpg",
            alt: "Hero",
            decorative: false,
          },
          secondaryCta: {
            label: "Bekijk onze diensten",
            link: { type: "internal_route" as const, route: "services" as const },
          },
        },
      },
    };
    const ensured = ensureBuiltinSectionContent(page, {
      "hero.title": "Override must not win",
      "hero.image": "/images/cms/old-override.jpg",
    });
    expect(ensured["home.hero"]?.heading).toBe("Structured heading");
    expect(ensured["home.hero"]?.image?.src).toBe("/images/cms/hero-cleaning.jpg");
  });
});

describe("edit protocol", () => {
  it("parses and validates draft patch", () => {
    const msg = parseCmsEditMessage({
      channel: CMS_EDIT_CHANNEL,
      type: "cms-draft-patch",
      sessionId: createSessionId(),
      pageId: "page_home",
      baseRevision: 3,
      mutationId: createMutationId(),
      patch: {
        kind: "section",
        sectionKey: "home.hero",
        patch: { heading: "X" },
      },
    });
    expect(msg?.type).toBe("cms-draft-patch");
  });

  it("rejects wrong channel and oversized conceptually via schema miss", () => {
    expect(parseCmsEditMessage({ channel: "other", type: "cms-edit-ready" })).toBeNull();
    expect(
      parseCmsEditMessage({
        channel: CMS_EDIT_CHANNEL,
        type: "cms-draft-patch",
        sessionId: "s",
        pageId: "p",
        baseRevision: 1,
        mutationId: "m",
        patch: { kind: "section", sectionKey: "not.real", patch: {} },
      }),
    ).toBeNull();
  });

  it("revision gates", () => {
    expect(canApplyPatch(5, 5)).toBe(true);
    expect(canApplyPatch(4, 5)).toBe(false);
    expect(shouldApplyDraft(5, 5)).toBe(true);
    expect(shouldApplyDraft(4, 5)).toBe(false);
    expect(shouldApplyDraft(6, 5)).toBe(true);
  });
});

describe("partners defaults", () => {
  it("seeds default partners when items are empty", () => {
    const empty = {
      eyebrow: "Onze klanten",
      heading: "Klanten waar wij voor werken",
      items: [],
    };
    const migrated = migrateEmptyPartnersContent(empty);
    expect(migrated.items.length).toBeGreaterThan(10);
    expect(migrated.items[0]?.image.src).toMatch(/^\/images\/partners\//);
  });

  it("keeps an explicit non-empty partners list", () => {
    const custom = {
      heading: "Partners",
      items: [
        {
          id: "partner_x",
          name: "Only One",
          image: {
            assetId: "local:x",
            src: "/images/partners/benitech.png",
            alt: "Only One",
            decorative: false,
          },
        },
      ],
    };
    expect(migrateEmptyPartnersContent(custom).items).toHaveLength(1);
  });

  it("ensureBuiltinSectionContent migrates empty published partners on read", () => {
    const page = {
      id: "page_home",
      slug: "/",
      title: "Home",
      description: "",
      inNav: true,
      blocks: [],
      updatedAt: 0,
      version: 1,
      kind: "builtin" as const,
      isCustom: false as const,
      pageKey: "home" as const,
      layout: [],
      layoutVersion: 1,
      sectionContent: {
        "home.partners": {
          eyebrow: "Onze klanten",
          heading: "Klanten waar wij voor werken",
          items: [],
        },
      },
    };
    const ensured = ensureBuiltinSectionContent(page);
    const partners = ensured["home.partners"];
    expect(partners?.items.length).toBeGreaterThan(10);
    expect(partners?.items.every((i) => i.image.src.startsWith("/images/partners/"))).toBe(true);
    const byId = Object.fromEntries((partners?.items ?? []).map((i) => [i.id, i]));
    expect(byId["partner_de-dominee-grand-cafe"]?.resolvedBackdrop).toBe("#000000");
    expect(byId["partner_finbrokers"]?.resolvedBackdrop).toBe("#000000");
    expect(byId["partner_benitech"]?.resolvedBackdrop).toBe("#000000");
    expect(byId["partner_laurens"]?.resolvedBackdrop).toBe("#ffffff");
    expect(byId["partner_laurens"]?.logoBackdrop).toBe("light");
    expect(byId["partner_benerink"]?.resolvedBackdrop).toBe("#ffffff");
    expect(byId["partner_steggink"]?.resolvedBackdrop).toBe("#fdf100");
    expect(byId["partner_steggink"]?.logoBackdrop).toBe("auto");
    expect(byId["partner_nanomi"]?.resolvedBackdrop).toBe("#ffffff");
  });

  it("backfills logo backdrop on existing partner items without changing images", () => {
    const before = {
      heading: "Partners",
      items: [
        {
          id: "partner_benitech",
          name: "Benitech",
          image: {
            assetId: "local:images/partners/benitech",
            src: "/images/partners/benitech.png",
            alt: "Benitech",
            decorative: false,
          },
        },
        {
          id: "partner_custom",
          name: "Custom Co",
          image: {
            assetId: "storage:x",
            src: "https://cdn.example/logo.png",
            alt: "Custom Co",
            decorative: false,
          },
        },
        {
          id: "partner_legacy_dark",
          name: "Legacy Dark",
          logoBackdrop: "auto" as const,
          resolvedBackdrop: "dark" as unknown as string,
          image: {
            assetId: "storage:y",
            src: "https://cdn.example/legacy.png",
            alt: "Legacy Dark",
            decorative: false,
          },
        },
        {
          id: "partner_plate",
          name: "Plate Co",
          logoBackdrop: "auto" as const,
          resolvedBackdrop: "#03295a",
          image: {
            assetId: "storage:z",
            src: "https://cdn.example/plate.png",
            alt: "Plate Co",
            decorative: false,
          },
        },
        {
          id: "partner_manual",
          name: "Manual Dark",
          logoBackdrop: "dark" as const,
          resolvedBackdrop: "light" as unknown as string,
          image: {
            assetId: "storage:m",
            src: "https://cdn.example/manual.png",
            alt: "Manual Dark",
            decorative: false,
          },
        },
        {
          id: "partner_finbrokers",
          name: "Finbrokers",
          logoBackdrop: "auto" as const,
          resolvedBackdrop: "#ffffff",
          image: {
            assetId: "local:images/partners/finbrokers",
            src: "/images/partners/finbrokers.png",
            alt: "Finbrokers",
            decorative: false,
          },
        },
      ],
    };
    const migrated = migratePartnersLogoBackdrop(before);
    expect(migrated.items[0]?.image.src).toBe("/images/partners/benitech.png");
    expect(migrated.items[0]?.logoBackdrop).toBe("dark");
    expect(migrated.items[0]?.resolvedBackdrop).toBe("#000000");
    expect(migrated.items[1]?.resolvedBackdrop).toBe("#ffffff");
    expect(migrated.items[1]?.logoBackdrop).toBe("auto");
    expect(migrated.items[2]?.resolvedBackdrop).toBe("#ffffff");
    expect(migrated.items[3]?.resolvedBackdrop).toBe("#03295a");
    expect(migrated.items[4]?.logoBackdrop).toBe("dark");
    expect(migrated.items[4]?.resolvedBackdrop).toBe("#000000");
    expect(migrated.items[5]?.logoBackdrop).toBe("dark");
    expect(migrated.items[5]?.resolvedBackdrop).toBe("#000000");
  });
});

describe("uploadedImage", () => {
  it("accepts image data URLs and rejects other schemes", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const img = uploadedImage(png, "Logo", "logo1");
    expect(img?.assetId).toBe("upload:logo1");
    expect(img?.src).toBe(png);
    expect(img && isUploadedCmsImage(img)).toBe(true);
    expect(uploadedImage("https://example.com/x.png", "x")).toBeNull();
    expect(uploadedImage("data:text/plain;base64,YQ==", "x")).toBeNull();
  });

  it("builds storage images and detects legacy embeds", () => {
    const storage = storageImage({
      assetId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      publicUrl: "https://proj.supabase.co/storage/v1/object/public/cms-media/media/s/a.webp",
      alt: "Hero",
      width: 800,
      height: 600,
    });
    expect(storage.assetId).toBe("storage:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(isStorageCmsImage(storage)).toBe(true);
    expect(isLegacyEmbeddedCmsImage(storage)).toBe(false);

    const legacy = uploadedImage(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "x",
    )!;
    const tree = { section: { image: legacy, nested: [{ image: storage }] } };
    expect(collectLegacyEmbeddedImages(tree)).toHaveLength(1);
    const replaced = replaceCmsImagesInTree(tree, (img) =>
      isLegacyEmbeddedCmsImage(img) ? storage : null,
    ) as typeof tree;
    expect(replaced.section.image.assetId.startsWith("storage:")).toBe(true);
    expect(collectLegacyEmbeddedImages(replaced)).toHaveLength(0);
  });

  it("default contact.form is public-safe and editable", () => {
    const form = defaultSectionContent("contact.form") as {
      highlights?: Array<{ text: string }>;
      submitLabel?: string;
      body?: string;
      textPlacement?: string;
      heading?: string;
      fields?: Array<{ label: string; type: string; placeholder?: string }>;
    };
    expect(form.submitLabel).toBe("Verstuur aanvraag");
    expect(form.heading).toBe("Laten we praten over uw pand.");
    expect(form.body).toBe(
      "Of het nu gaat om het aanvragen van reguliere schoonmaak, specialistische reiniging of een algemene vraag, wij staan voor u klaar.",
    );
    expect(form.highlights).toEqual([]);
    expect(form.textPlacement).toBe("left");
    expect((form as { formColumnsDesktop?: number }).formColumnsDesktop).toBe(2);
    expect(form.fields?.map((f) => f.type)).toEqual(["company", "phone", "textarea"]);
    expect(form.fields?.find((f) => f.type === "company")?.placeholder).toBe("Optioneel");

    const parsed = parseSectionContent("contact.form", {
      heading: "Custom",
      textPlacement: "right",
      formColumnsDesktop: 1,
      highlights: [{ id: "h1", text: "Bel ons vandaag" }],
      labels: { name: "Uw naam" },
    });
    expect(parsed).toMatchObject({
      heading: "Custom",
      textPlacement: "right",
      formColumnsDesktop: 1,
      labels: { name: "Uw naam" },
    });
  });

  it("normalizeContactFormContent seeds fields from legacy labels/placeholders", () => {
    const normalized = normalizeContactFormContent({
      heading: "Hallo",
      labels: { company: "Organisatie", message: "Vraag" },
      placeholders: { phone: "Bel ons" },
    });
    expect(normalized.fields?.map((f) => f.label)).toEqual([
      "Organisatie",
      "Telefoon",
      "Vraag",
    ]);
    expect(normalized.fields?.find((f) => f.type === "phone")?.placeholder).toBe("Bel ons");
  });

  it("resolveContactFormHighlights never injects hard-coded fallbacks", () => {
    expect(resolveContactFormHighlights({}, ["A", "B"])).toEqual([]);
    expect(resolveContactFormHighlights({ highlights: [] }, ["A", "B"])).toEqual([]);
    expect(
      resolveContactFormHighlights({ highlights: [{ id: "1", text: " Custom " }] }, ["A"]),
    ).toEqual(["Custom"]);
    expect(
      resolveContactFormHighlights(
        {
          highlights: [
            { id: "1", text: "Persoonlijk antwoord binnen één werkdag" },
            { id: "2", text: "Aanvragen verschijnen in het admin-portaal" },
          ],
        },
        [],
      ),
    ).toEqual([]);
  });
});
