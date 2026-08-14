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
  isGoogleAnalyticsRuntimeAllowed,
  parseGaMeasurementId,
  readGaEnableDevFlag,
} from "@/lib/analytics/ga-config";

function gaFeatureEnabled(): boolean {
  const measurementId = parseGaMeasurementId(import.meta.env.VITE_GA_MEASUREMENT_ID);
  if (!measurementId) return false;
  return isGoogleAnalyticsRuntimeAllowed({
    isProd: import.meta.env.PROD === true,
    enableDev: readGaEnableDevFlag(import.meta.env.VITE_GA_ENABLE_DEV),
  });
}

/**
 * Consent-gated GA4 + banner. Mount once in the storefront root.
 * Does nothing when measurement ID is unset or runtime is not allowed.
 */
export function StorefrontAnalytics() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const exempt = isAnalyticsExemptPath(pathname);
  const enabled = gaFeatureEnabled();

  const [consent, setConsent] = useState<AnalyticsConsent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || exempt) {
      setReady(false);
      return;
    }
    setConsent(readAnalyticsConsent());
    setReady(true);
  }, [enabled, exempt]);

  const onAccept = useCallback(() => {
    writeAnalyticsConsent("granted");
    setConsent("granted");
  }, []);

  const onReject = useCallback(() => {
    writeAnalyticsConsent("denied");
    setConsent("denied");
  }, []);

  if (!enabled || exempt) return null;

  return (
    <>
      <GoogleAnalytics consent={consent} />
      <CookieConsentBanner
        open={ready && consent === null}
        onAccept={onAccept}
        onReject={onReject}
      />
    </>
  );
}
