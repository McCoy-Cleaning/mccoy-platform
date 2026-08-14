import { useEffect } from "react";
import type { AnalyticsConsent } from "./consent";
import {
  isGoogleAnalyticsRuntimeAllowed,
  parseGaMeasurementId,
  readGaEnableDevFlag,
} from "./ga-config";
import { loadGoogleAnalyticsGtag } from "./load-gtag";

/**
 * Loads gtag only when:
 * - VITE_GA_MEASUREMENT_ID is a valid G-… id
 * - runtime is production (or VITE_GA_ENABLE_DEV)
 * - analytics consent is granted
 */
export function GoogleAnalytics({ consent }: { consent: AnalyticsConsent | null }) {
  useEffect(() => {
    if (consent !== "granted") return;

    const measurementId = parseGaMeasurementId(import.meta.env.VITE_GA_MEASUREMENT_ID);
    if (!measurementId) return;

    const allowed = isGoogleAnalyticsRuntimeAllowed({
      isProd: import.meta.env.PROD === true,
      enableDev: readGaEnableDevFlag(import.meta.env.VITE_GA_ENABLE_DEV),
    });
    if (!allowed) return;

    loadGoogleAnalyticsGtag(measurementId);
  }, [consent]);

  return null;
}
