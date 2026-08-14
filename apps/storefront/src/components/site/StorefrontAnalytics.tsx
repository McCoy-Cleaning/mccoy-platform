import { useCallback, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { CookieConsentBanner } from "@/components/site/CookieConsentBanner";
import {
  type AnalyticsConsent,
  readAnalyticsConsent,
  writeAnalyticsConsent,
} from "@/lib/analytics/consent";
import { GoogleAnalytics } from "@/lib/analytics/GoogleAnalytics";
import {
  isAnalyticsExemptPath,
  parseGaMeasurementId,
  readGaEnableDevFlag,
  shouldOfferAnalyticsConsent,
} from "@/lib/analytics/ga-config";

function readAnalyticsOfferState(): {
  offerConsent: boolean;
  measurementId: string | null;
  enableDev: boolean;
} {
  const measurementId = parseGaMeasurementId(import.meta.env.VITE_GA_MEASUREMENT_ID);
  const enableDev = readGaEnableDevFlag(import.meta.env.VITE_GA_ENABLE_DEV);
  const offerConsent = shouldOfferAnalyticsConsent({
    measurementId,
    isProd: import.meta.env.PROD === true,
    enableDev,
  });
  return { offerConsent, measurementId, enableDev };
}

/**
 * Consent-gated GA4 + banner. Mount once in the storefront root.
 * Banner can appear in enableDev preview without a measurement ID;
 * gtag still loads only with a valid ID + granted consent.
 */
export function StorefrontAnalytics() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const exempt = isAnalyticsExemptPath(pathname);
  const { offerConsent, measurementId, enableDev } = readAnalyticsOfferState();

  const [consent, setConsent] = useState<AnalyticsConsent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!offerConsent || exempt) {
      setReady(false);
      return;
    }
    if (import.meta.env.DEV && enableDev && !measurementId) {
      console.warn(
        "[analytics] Consent banner preview active (VITE_GA_ENABLE_DEV) but VITE_GA_MEASUREMENT_ID is unset — gtag will not load.",
      );
    }
    setConsent(readAnalyticsConsent());
    setReady(true);
  }, [offerConsent, exempt, enableDev, measurementId]);

  const onAccept = useCallback(() => {
    writeAnalyticsConsent("granted");
    setConsent("granted");
  }, []);

  const onReject = useCallback(() => {
    writeAnalyticsConsent("denied");
    setConsent("denied");
  }, []);

  if (!offerConsent) return null;

  return (
    <>
      <GoogleAnalytics consent={consent} pathname={pathname} />
      <CookieConsentBanner
        open={!exempt && ready && consent === null}
        onAccept={onAccept}
        onReject={onReject}
      />
    </>
  );
}
