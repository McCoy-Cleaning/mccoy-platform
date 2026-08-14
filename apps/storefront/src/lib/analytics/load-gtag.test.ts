import { afterEach, describe, expect, it, vi } from "vitest";
import {
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
