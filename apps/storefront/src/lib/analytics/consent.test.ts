import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  isAnalyticsConsent,
  isCookieConsentBannerOpen,
  parseAnalyticsConsentFromCookie,
  readAnalyticsConsent,
  retainExplicitAnalyticsConsent,
  writeAnalyticsConsent,
} from "./consent";
import {
  isAnalyticsExemptPath,
  isGoogleAnalyticsRuntimeAllowed,
  parseGaMeasurementId,
  readGaEnableDevFlag,
  resolveGoogleAnalyticsMeasurementId,
  resolvePublicGaMeasurementId,
  shouldOfferAnalyticsConsent,
} from "./ga-config";

describe("analytics consent", () => {
  const store = new Map<string, string>();
  let cookieJar = "";

  afterEach(() => {
    store.clear();
    cookieJar = "";
    vi.unstubAllGlobals();
  });

  function stubBrowserStorage(overrides?: {
    getItem?: (key: string) => string | null;
    setItem?: (key: string, value: string) => void;
  }) {
    const localStorage = {
      getItem: (key: string) =>
        overrides?.getItem ? overrides.getItem(key) : (store.get(key) ?? null),
      setItem: (key: string, value: string) => {
        if (overrides?.setItem) {
          overrides.setItem(key, value);
          return;
        }
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    const document = {
      get cookie() {
        return cookieJar;
      },
      set cookie(value: string) {
        const pair = value.split(";", 1)[0] ?? "";
        const eq = pair.indexOf("=");
        if (eq < 0) return;
        const name = pair.slice(0, eq);
        const val = pair.slice(eq + 1);
        const parts = cookieJar
          .split(";")
          .map((part) => part.trim())
          .filter((part) => part && !part.startsWith(`${name}=`));
        parts.push(`${name}=${val}`);
        cookieJar = parts.join("; ");
      },
    };
    vi.stubGlobal("window", { localStorage, location: { protocol: "http:" } });
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("document", document);
  }

  it("narrows consent values", () => {
    expect(isAnalyticsConsent("granted")).toBe(true);
    expect(isAnalyticsConsent("denied")).toBe(true);
    expect(isAnalyticsConsent("maybe")).toBe(false);
    expect(isAnalyticsConsent("null")).toBe(false);
    expect(isAnalyticsConsent(null)).toBe(false);
  });

  it("reads and writes localStorage + first-party cookie consent", () => {
    stubBrowserStorage();
    expect(readAnalyticsConsent()).toBeNull();
    writeAnalyticsConsent("granted");
    expect(readAnalyticsConsent()).toBe("granted");
    expect(store.get(ANALYTICS_CONSENT_STORAGE_KEY)).toBe("granted");
    expect(cookieJar).toContain(`${ANALYTICS_CONSENT_STORAGE_KEY}=granted`);
    writeAnalyticsConsent("denied");
    expect(readAnalyticsConsent()).toBe("denied");
    expect(cookieJar).toContain(`${ANALYTICS_CONSENT_STORAGE_KEY}=denied`);
  });

  it("falls back to the consent cookie when localStorage is empty", () => {
    stubBrowserStorage();
    cookieJar = `${ANALYTICS_CONSENT_STORAGE_KEY}=granted`;
    expect(readAnalyticsConsent()).toBe("granted");
  });

  it("parses consent from a Cookie header for SSR", () => {
    expect(parseAnalyticsConsentFromCookie("foo=bar; mccoy-analytics-consent=denied")).toBe(
      "denied",
    );
    expect(parseAnalyticsConsentFromCookie("mccoy-analytics-consent=maybe")).toBeNull();
    expect(parseAnalyticsConsentFromCookie("")).toBeNull();
  });

  it("returns null when localStorage throws", () => {
    stubBrowserStorage({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readAnalyticsConsent()).toBeNull();
    expect(() => writeAnalyticsConsent("granted")).not.toThrow();
  });

  it("keeps an explicit accept even if the SSR isomorphic snapshot is still null", () => {
    const isomorphicSnapshot = null; // readInitialAnalyticsConsent() after accept
    const consent = retainExplicitAnalyticsConsent("granted", isomorphicSnapshot);
    expect(consent).toBe("granted");
    expect(
      isCookieConsentBannerOpen({ exempt: false, ready: true, consent }),
    ).toBe(false);
  });

  it("keeps an explicit reject even if storage/SSR still reads null", () => {
    const consent = retainExplicitAnalyticsConsent("denied", null);
    expect(consent).toBe("denied");
    expect(
      isCookieConsentBannerOpen({ exempt: false, ready: true, consent }),
    ).toBe(false);
  });

  it("adopts storage only while still undecided", () => {
    expect(retainExplicitAnalyticsConsent(null, "granted")).toBe("granted");
    expect(retainExplicitAnalyticsConsent(null, "denied")).toBe("denied");
    expect(retainExplicitAnalyticsConsent(null, null)).toBeNull();
    expect(retainExplicitAnalyticsConsent("granted", "denied")).toBe("granted");
    expect(
      isCookieConsentBannerOpen({ exempt: false, ready: true, consent: null }),
    ).toBe(true);
    expect(
      isCookieConsentBannerOpen({ exempt: true, ready: true, consent: null }),
    ).toBe(false);
  });
});

describe("ga-config", () => {
  it("parses valid GA4 measurement IDs", () => {
    expect(parseGaMeasurementId("G-MVMC3FS5GK")).toBe("G-MVMC3FS5GK");
    expect(parseGaMeasurementId("  g-abc123  ")).toBe("G-ABC123");
    expect(parseGaMeasurementId("UA-123")).toBeNull();
    expect(parseGaMeasurementId("")).toBeNull();
    expect(parseGaMeasurementId(undefined)).toBeNull();
  });

  it("resolves measurement ID from VITE_ or server aliases", () => {
    expect(
      resolvePublicGaMeasurementId({
        viteMeasurementId: undefined,
        gaMeasurementId: "G-SERVER01",
      }),
    ).toBe("G-SERVER01");
    expect(
      resolvePublicGaMeasurementId({
        viteMeasurementId: "G-VITE01",
        gaMeasurementId: "G-SERVER01",
        googleAnalyticsMeasurementId: "G-GOOGLE01",
      }),
    ).toBe("G-VITE01");
    expect(
      resolvePublicGaMeasurementId({
        googleAnalyticsMeasurementId: "G-GOOGLE01",
      }),
    ).toBe("G-GOOGLE01");
    expect(
      resolvePublicGaMeasurementId({
        injectedMeasurementId: "G-INJECT1",
      }),
    ).toBe("G-INJECT1");
    expect(resolvePublicGaMeasurementId({})).toBeNull();
  });

  it("gates runtime to production unless enableDev", () => {
    expect(isGoogleAnalyticsRuntimeAllowed({ isProd: true, enableDev: false })).toBe(true);
    expect(isGoogleAnalyticsRuntimeAllowed({ isProd: false, enableDev: false })).toBe(false);
    expect(isGoogleAnalyticsRuntimeAllowed({ isProd: false, enableDev: true })).toBe(true);
  });

  it("offers consent UI with ID, or enableDev preview without ID", () => {
    expect(
      shouldOfferAnalyticsConsent({
        measurementId: "G-ABC",
        isProd: true,
        enableDev: false,
      }),
    ).toBe(true);
    expect(
      shouldOfferAnalyticsConsent({
        measurementId: null,
        isProd: true,
        enableDev: false,
      }),
    ).toBe(false);
    expect(
      shouldOfferAnalyticsConsent({
        measurementId: null,
        isProd: false,
        enableDev: false,
      }),
    ).toBe(false);
    expect(
      shouldOfferAnalyticsConsent({
        measurementId: null,
        isProd: false,
        enableDev: true,
      }),
    ).toBe(true);
    expect(
      shouldOfferAnalyticsConsent({
        measurementId: "G-ABC",
        isProd: false,
        enableDev: false,
      }),
    ).toBe(false);
    expect(
      shouldOfferAnalyticsConsent({
        measurementId: null,
        isProd: true,
        enableDev: true,
      }),
    ).toBe(false);
  });

  it("parses enable-dev flag", () => {
    expect(readGaEnableDevFlag("1")).toBe(true);
    expect(readGaEnableDevFlag("true")).toBe(true);
    expect(readGaEnableDevFlag("0")).toBe(false);
    expect(readGaEnableDevFlag(undefined)).toBe(false);
  });

  it("exempts CMS bridge paths", () => {
    expect(isAnalyticsExemptPath("/cms-preview")).toBe(true);
    expect(isAnalyticsExemptPath("/cms-sync/x")).toBe(true);
    expect(isAnalyticsExemptPath("/privacy")).toBe(false);
  });

  it("never enables GA before consent or after denial", () => {
    const base = {
      rawMeasurementId: "G-ABC123",
      isProd: true,
      enableDev: false,
      pathname: "/",
    };
    expect(resolveGoogleAnalyticsMeasurementId({ ...base, consent: null })).toBeNull();
    expect(resolveGoogleAnalyticsMeasurementId({ ...base, consent: "denied" })).toBeNull();
    expect(
      resolveGoogleAnalyticsMeasurementId({ ...base, consent: "granted" }),
    ).toBe("G-ABC123");
  });

  it("excludes preview routes and invalid or unavailable IDs", () => {
    const base = {
      consent: "granted" as const,
      rawMeasurementId: "G-ABC123",
      isProd: true,
      enableDev: false,
    };
    expect(
      resolveGoogleAnalyticsMeasurementId({ ...base, pathname: "/cms-preview" }),
    ).toBeNull();
    expect(
      resolveGoogleAnalyticsMeasurementId({ ...base, pathname: "/cms-sync/nl" }),
    ).toBeNull();
    expect(
      resolveGoogleAnalyticsMeasurementId({
        ...base,
        pathname: "/",
        rawMeasurementId: "UA-123",
      }),
    ).toBeNull();
    expect(
      resolveGoogleAnalyticsMeasurementId({
        ...base,
        pathname: "/",
        isProd: false,
      }),
    ).toBeNull();
  });
});
