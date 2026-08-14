import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  isAnalyticsConsent,
  readAnalyticsConsent,
  writeAnalyticsConsent,
} from "./consent";
import {
  isAnalyticsExemptPath,
  isGoogleAnalyticsRuntimeAllowed,
  parseGaMeasurementId,
  readGaEnableDevFlag,
  resolveGoogleAnalyticsMeasurementId,
  shouldOfferAnalyticsConsent,
} from "./ga-config";

describe("analytics consent", () => {
  const store = new Map<string, string>();

  afterEach(() => {
    store.clear();
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
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("localStorage", localStorage);
  }

  it("narrows consent values", () => {
    expect(isAnalyticsConsent("granted")).toBe(true);
    expect(isAnalyticsConsent("denied")).toBe(true);
    expect(isAnalyticsConsent("maybe")).toBe(false);
    expect(isAnalyticsConsent(null)).toBe(false);
  });

  it("reads and writes localStorage consent", () => {
    stubBrowserStorage();
    expect(readAnalyticsConsent()).toBeNull();
    writeAnalyticsConsent("granted");
    expect(readAnalyticsConsent()).toBe("granted");
    writeAnalyticsConsent("denied");
    expect(readAnalyticsConsent()).toBe("denied");
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
});

describe("ga-config", () => {
  it("parses valid GA4 measurement IDs", () => {
    expect(parseGaMeasurementId("G-MVMC3FS5GK")).toBe("G-MVMC3FS5GK");
    expect(parseGaMeasurementId("  g-abc123  ")).toBe("G-ABC123");
    expect(parseGaMeasurementId("UA-123")).toBeNull();
    expect(parseGaMeasurementId("")).toBeNull();
    expect(parseGaMeasurementId(undefined)).toBeNull();
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
