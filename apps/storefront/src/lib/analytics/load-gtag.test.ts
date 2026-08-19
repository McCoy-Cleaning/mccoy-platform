import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activateGoogleAnalyticsAfterConsent,
  applyGoogleConsentDefault,
  loadGoogleAnalyticsGtag,
  resetGoogleAnalyticsPageViewDedupe,
  resetGtagLoadStateForTests,
  sendGoogleAnalyticsPageView,
} from "./load-gtag";

type FakeScript = {
  async?: boolean;
  src?: string;
  dataset: Record<string, string>;
};

function stubDom() {
  const scripts: FakeScript[] = [];
  const dataLayer: unknown[] = [];
  const document = {
    title: "Home",
    querySelector: vi.fn((selector: string) => {
      const id = selector.match(/data-mccoy-ga4="([^"]+)"/)?.[1];
      return scripts.find((script) => script.dataset.mccoyGa4 === id) ?? null;
    }),
    createElement: vi.fn((): FakeScript => ({ dataset: {} })),
    head: {
      appendChild: vi.fn((script: FakeScript) => {
        scripts.push(script);
        return script;
      }),
    },
  };
  const window = {
    dataLayer,
    location: { origin: "https://www.mccoy.nl" },
  };
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  return { dataLayer, document, scripts };
}

afterEach(() => {
  resetGtagLoadStateForTests();
  vi.unstubAllGlobals();
});

describe("GA4 gtag lifecycle", () => {
  it("loads the script and initializes config exactly once", () => {
    const { dataLayer, document, scripts } = stubDom();

    expect(loadGoogleAnalyticsGtag("G-ABC123")).toBe(true);
    expect(loadGoogleAnalyticsGtag("G-ABC123")).toBe(false);

    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-ABC123",
    );
    expect(document.head.appendChild).toHaveBeenCalledTimes(1);
    const configs = dataLayer.filter(
      (entry) => Array.isArray(entry) && entry[0] === "config",
    );
    expect(configs).toEqual([
      [
        "config",
        "G-ABC123",
        { anonymize_ip: true, send_page_view: false },
      ],
    ]);
  });

  it("emits one explicit page view per SPA path without query data", () => {
    const { dataLayer } = stubDom();
    loadGoogleAnalyticsGtag("G-ABC123");

    expect(
      sendGoogleAnalyticsPageView({
        measurementId: "G-ABC123",
        pathname: "/",
        title: "Home",
      }),
    ).toBe(true);
    expect(
      sendGoogleAnalyticsPageView({
        measurementId: "G-ABC123",
        pathname: "/",
        title: "Home",
      }),
    ).toBe(false);
    expect(
      sendGoogleAnalyticsPageView({
        measurementId: "G-ABC123",
        pathname: "/en/contact?email=private@example.test",
        title: "Contact",
      }),
    ).toBe(true);

    const pageViews = dataLayer.filter(
      (entry) =>
        Array.isArray(entry) &&
        entry[0] === "event" &&
        entry[1] === "page_view",
    ) as Array<[string, string, Record<string, unknown>]>;
    expect(pageViews).toHaveLength(2);
    expect(pageViews[1]?.[2]).toMatchObject({
      page_path: "/en/contact",
      page_location: "https://www.mccoy.nl/en/contact",
      send_to: "G-ABC123",
    });
    expect(JSON.stringify(pageViews)).not.toContain("private@example.test");
  });

  it("treats an exempt route as a no-event navigation boundary", () => {
    const { dataLayer } = stubDom();
    loadGoogleAnalyticsGtag("G-ABC123");
    sendGoogleAnalyticsPageView({
      measurementId: "G-ABC123",
      pathname: "/",
    });

    resetGoogleAnalyticsPageViewDedupe("G-ABC123");
    expect(
      sendGoogleAnalyticsPageView({
        measurementId: "G-ABC123",
        pathname: "/",
      }),
    ).toBe(true);
    const pageViews = dataLayer.filter(
      (entry) =>
        Array.isArray(entry) &&
        entry[0] === "event" &&
        entry[1] === "page_view",
    );
    expect(pageViews).toHaveLength(2);
  });
});


describe("Consent Mode v2", () => {
  it("applies default denied before any gtag config", () => {
    const { dataLayer } = stubDom();
    expect(applyGoogleConsentDefault()).toBe(true);
    expect(applyGoogleConsentDefault()).toBe(false);
    expect(dataLayer[0]).toEqual([
      "consent",
      "default",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        wait_for_update: 500,
      },
    ]);
    loadGoogleAnalyticsGtag("G-ABC123");
    expect(dataLayer.find((entry) => Array.isArray(entry) && entry[0] === "config")).toEqual([
      "config",
      "G-ABC123",
      { anonymize_ip: true, send_page_view: false },
    ]);
    const defaultIndex = dataLayer.findIndex(
      (entry) => Array.isArray(entry) && entry[0] === "consent" && entry[1] === "default",
    );
    const configIndex = dataLayer.findIndex(
      (entry) => Array.isArray(entry) && entry[0] === "config",
    );
    expect(defaultIndex).toBeGreaterThanOrEqual(0);
    expect(defaultIndex).toBeLessThan(configIndex);
  });

  it("on accept: updates consent, loads gtag, and sends the first page_view", () => {
    const { dataLayer, scripts } = stubDom();
    applyGoogleConsentDefault();
    expect(
      activateGoogleAnalyticsAfterConsent({
        measurementId: "G-ABC123",
        pathname: "/",
        title: "Home",
      }),
    ).toBe(true);
    expect(scripts[0]?.src).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-ABC123",
    );
    expect(dataLayer).toEqual(
      expect.arrayContaining([
        [
          "consent",
          "update",
          { analytics_storage: "granted" },
        ],
        [
          "config",
          "G-ABC123",
          { anonymize_ip: true, send_page_view: false },
        ],
        [
          "event",
          "page_view",
          expect.objectContaining({
            page_path: "/",
            send_to: "G-ABC123",
          }),
        ],
      ]),
    );
    const updateIndex = dataLayer.findIndex(
      (entry) => Array.isArray(entry) && entry[0] === "consent" && entry[1] === "update",
    );
    const pageViewIndex = dataLayer.findIndex(
      (entry) => Array.isArray(entry) && entry[0] === "event" && entry[1] === "page_view",
    );
    expect(updateIndex).toBeLessThan(pageViewIndex);
    expect(
      sendGoogleAnalyticsPageView({
        measurementId: "G-ABC123",
        pathname: "/",
        title: "Home",
      }),
    ).toBe(false);
  });

  it("does not load gtag on reject — default stays denied", () => {
    const { dataLayer, scripts } = stubDom();
    applyGoogleConsentDefault();
    expect(scripts).toHaveLength(0);
    expect(dataLayer.filter((entry) => Array.isArray(entry) && entry[0] === "config")).toHaveLength(0);
    expect(
      dataLayer.some(
        (entry) => Array.isArray(entry) && entry[0] === "consent" && entry[1] === "update",
      ),
    ).toBe(false);
  });
});
