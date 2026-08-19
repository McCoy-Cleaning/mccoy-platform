import { useCallback, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { CookieConsentBanner } from "@/components/site/CookieConsentBanner";
import {
  type AnalyticsConsent,
  isCookieConsentBannerOpen,
  readAnalyticsConsent,
  retainExplicitAnalyticsConsent,
  writeAnalyticsConsent,
} from "@/lib/analytics/consent";
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
 * The banner is client-only: SSR never paints it, so a dead server copy
 * cannot stay on screen after Accept.
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
        "[analytics] Consent banner preview active (VITE_GA_ENABLE_DEV) but no measurement ID — gtag will not load.",
      );
    }
    if (measurementId) applyGoogleConsentDefault();
    setConsent((prev) => retainExplicitAnalyticsConsent(prev, readAnalyticsConsent()));
    setReady(true);
  }, [offerConsent, exempt, enableDev, measurementId]);

  const onAccept = useCallback(() => {
    setConsent("granted");
    writeAnalyticsConsent("granted");
    if (measurementId && !exempt) {
      try {
        activateGoogleAnalyticsAfterConsent({
          measurementId,
          pathname,
          title: typeof document !== "undefined" ? document.title : undefined,
        });
      } catch {
        /* gtag failure must not resurrect the banner */
      }
    }
  }, [measurementId, exempt, pathname]);

  const onReject = useCallback(() => {
    setConsent("denied");
    writeAnalyticsConsent("denied");
    if (measurementId) {
      try {
        applyGoogleConsentDefault();
      } catch {
        /* consent default failure must not resurrect the banner */
      }
    }
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
        open={isCookieConsentBannerOpen({ exempt, ready, consent })}
        onAccept={onAccept}
        onReject={onReject}
      />
    </>
  );
}
