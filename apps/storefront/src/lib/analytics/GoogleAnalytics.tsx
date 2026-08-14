import { useEffect } from "react";
import type { AnalyticsConsent } from "./consent";
import {
  isAnalyticsExemptPath,
  parseGaMeasurementId,
  readGaEnableDevFlag,
  resolveGoogleAnalyticsMeasurementId,
} from "./ga-config";
import {
  loadGoogleAnalyticsGtag,
  resetGoogleAnalyticsPageViewDedupe,
  sendGoogleAnalyticsPageView,
} from "./load-gtag";

/**
 * Loads gtag only when:
 * - VITE_GA_MEASUREMENT_ID is a valid G-… id
 * - runtime is production (or VITE_GA_ENABLE_DEV)
 * - analytics consent is granted
 * - the route is not a CMS preview/sync bridge
 */
export function GoogleAnalytics({
  consent,
  pathname,
}: {
  consent: AnalyticsConsent | null;
  pathname: string;
}) {
  useEffect(() => {
    const enableDev = readGaEnableDevFlag(import.meta.env.VITE_GA_ENABLE_DEV);
    const rawMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    const parsedMeasurementId = parseGaMeasurementId(rawMeasurementId);
    if (parsedMeasurementId && isAnalyticsExemptPath(pathname)) {
      resetGoogleAnalyticsPageViewDedupe(parsedMeasurementId);
      return;
    }
    const measurementId = resolveGoogleAnalyticsMeasurementId({
      consent,
      rawMeasurementId,
      isProd: import.meta.env.PROD === true,
      enableDev,
      pathname,
    });
    if (!measurementId) return;

    loadGoogleAnalyticsGtag(measurementId);
    sendGoogleAnalyticsPageView({
      measurementId,
      pathname,
      title: document.title,
    });
  }, [consent, pathname]);

  return null;
}
