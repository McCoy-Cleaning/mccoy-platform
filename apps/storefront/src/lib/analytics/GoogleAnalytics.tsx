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
  updateGoogleAnalyticsConsentGranted,
} from "./load-gtag";
import { readPublicGaMeasurementId } from "./public-ga-id";

/**
 * Loads gtag only when:
 * - a valid G-… id is available (VITE_ or server/injected alias)
 * - runtime is production (or VITE_GA_ENABLE_DEV)
 * - analytics consent is granted
 * - the route is not a CMS preview/sync bridge
 *
 * SPA navigations emit one explicit page_view. The first view after accept is
 * sent immediately by activateGoogleAnalyticsAfterConsent; this effect covers
 * reloads and later route changes.
 */
export function GoogleAnalytics({
  consent,
  pathname,
  measurementId: measurementIdProp,
}: {
  consent: AnalyticsConsent | null;
  pathname: string;
  measurementId?: string | null;
}) {
  useEffect(() => {
    const enableDev = readGaEnableDevFlag(import.meta.env.VITE_GA_ENABLE_DEV);
    const rawMeasurementId =
      measurementIdProp ?? readPublicGaMeasurementId() ?? import.meta.env.VITE_GA_MEASUREMENT_ID;
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

    updateGoogleAnalyticsConsentGranted();
    loadGoogleAnalyticsGtag(measurementId);
    sendGoogleAnalyticsPageView({
      measurementId,
      pathname,
      title: document.title,
    });
  }, [consent, pathname, measurementIdProp]);

  return null;
}
