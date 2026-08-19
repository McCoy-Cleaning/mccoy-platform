/**
 * Public GA4 measurement ID for the storefront.
 * Client builds only see VITE_* unless SSR injects window.__MCCOY_GA_MEASUREMENT_ID__.
 * Server aliases (GA_MEASUREMENT_ID / GOOGLE_ANALYTICS_MEASUREMENT_ID) do not need VITE_.
 */

import { readServerEnv } from "@mccoy/security";

import { resolvePublicGaMeasurementId } from "./ga-config";

declare global {
  interface Window {
    __MCCOY_GA_MEASUREMENT_ID__?: string;
  }
}

export function readPublicGaMeasurementId(): string | null {
  let injected: unknown;
  try {
    if (typeof window !== "undefined") {
      injected = window.__MCCOY_GA_MEASUREMENT_ID__;
    }
  } catch {
    injected = undefined;
  }

  const viteFromImport =
    typeof import.meta !== "undefined" ? import.meta.env?.VITE_GA_MEASUREMENT_ID : undefined;

  return resolvePublicGaMeasurementId({
    viteMeasurementId: viteFromImport || readServerEnv("VITE_GA_MEASUREMENT_ID"),
    gaMeasurementId: readServerEnv("GA_MEASUREMENT_ID"),
    googleAnalyticsMeasurementId: readServerEnv("GOOGLE_ANALYTICS_MEASUREMENT_ID"),
    injectedMeasurementId: injected,
  });
}
