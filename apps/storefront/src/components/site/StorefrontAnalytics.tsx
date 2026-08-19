import { useCallback, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { CookieConsentBanner } from "@/components/site/CookieConsentBanner";
import {
  type AnalyticsConsent,
  writeAnalyticsConsent,
} from "@/lib/analytics/consent";
import { readInitialAnalyticsConsent } from "@/lib/analytics/consent-ssr";
import { GoogleAnalytics } from "@/lib/analytics/GoogleAnalytics";
import {
  isAnalyticsExemptPath,
  readGaEnableDevFlag,
  shouldOfferAnalyticsConsent,
} from "@/lib/analytics/ga-config";
import {
  activateGoogleAnalyticsAfterConsent,
  applyGoogleConsentDefault,
} from "@/lib/analytics/load-gtag";
import { readPublicGaMeasurementId } from "@/lib/analytics/public-ga-id";

function readAnalyticsOfferState(): {
  offerConsent: boolean;
  measurementId: string | null;
  enableDev: boolean;
} {
  const measurementId = readPublicGaMeasurementId();
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
 * Banner can appear in enableDev preview without a measurement ID (local only);
 * gtag still loads only with a valid ID + granted consent.
 */
export function StorefrontAnalytics() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const exempt = isAnalyticsExemptPath(pathname);
  const { offerConsent, measurementId, enableDev } = readAnalyticsOfferState();

  const [consent, setConsent] = useState<AnalyticsConsent | null>(() =>
    offerConsent && !exempt ? readInitialAnalyticsConsent() : null,
  );
  const [ready, setReady] = useState(() => offerConsent && !exempt);

  useEffect(() => {
    if (!offerConsent || exempt) {
      setReady(false);
      return;
    }
    if (import.meta.env.DEV && enableDev && !measurementId) {
      console.warn(
        "[analytics] Consent banner preview active (VITE_GA_ENABLE_DEV) but no measurement ID — gtag will not load.",
      );
    }
    if (measurementId) applyGoogleConsentDefault();
    setConsent(readInitialAnalyticsConsent());
    setReady(true);
  }, [offerConsent, exempt, enableDev, measurementId]);

  const onAccept = useCallback(() => {
    writeAnalyticsConsent("granted");
    setConsent("granted");
    if (measurementId && !exempt) {
      activateGoogleAnalyticsAfterConsent({
        measurementId,
        pathname,
        title: typeof document !== "undefined" ? document.title : undefined,
      });
    }
  }, [measurementId, exempt, pathname]);

  const onReject = useCallback(() => {
    writeAnalyticsConsent("denied");
    setConsent("denied");
    if (measurementId) applyGoogleConsentDefault();
  }, [measurementId]);

  if (!offerConsent) return null;

  return (
    <>
      <GoogleAnalytics
        consent={consent}
        pathname={pathname}
        measurementId={measurementId}
      />
      <CookieConsentBanner
        open={!exempt && ready && consent === null}
        onAccept={onAccept}
        onReject={onReject}
      />
    </>
  );
}
