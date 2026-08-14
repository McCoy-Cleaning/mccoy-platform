import { useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  COOKIE_CONSENT_ACTIONS_CLASS,
  COOKIE_CONSENT_CARD_CLASS,
  COOKIE_CONSENT_COPY_CLASS,
  COOKIE_CONSENT_SHELL_CLASS,
  cookieConsentCopy,
} from "@/lib/analytics/cookie-consent-ui";
import { localizeInternalHref, localeFromPathname } from "@/lib/locale-path";

type CookieConsentBannerProps = {
  open: boolean;
  onAccept: () => void;
  onReject: () => void;
};

/**
 * Floating analytics consent card (NL-first). Shown when analytics consent is
 * offered (measurement ID and/or enableDev preview) and the visitor has not yet chosen.
 */
export function CookieConsentBanner({ open, onAccept, onReject }: CookieConsentBannerProps) {
  const { lang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const privacyHref = localizeInternalHref("/privacy", localeFromPathname(pathname));
  const copy = cookieConsentCopy(lang);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="mccoy-cookie-consent-title"
      aria-describedby="mccoy-cookie-consent-desc"
      className={COOKIE_CONSENT_SHELL_CLASS}
    >
      <div className={COOKIE_CONSENT_CARD_CLASS}>
        <div className={COOKIE_CONSENT_COPY_CLASS}>
          <h2
            id="mccoy-cookie-consent-title"
            className="text-[15px] font-semibold tracking-tight text-foreground"
          >
            {copy.title}
          </h2>
          <p
            id="mccoy-cookie-consent-desc"
            className="text-sm leading-relaxed text-muted-foreground"
          >
            {copy.body}{" "}
            <a
              href={privacyHref}
              className="font-medium text-primary/90 underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {copy.privacy}
            </a>
          </p>
        </div>

        <div className={COOKIE_CONSENT_ACTIONS_CLASS}>
          <Button
            type="button"
            variant="outline"
            onClick={onReject}
            className="h-11 w-full rounded-full border-white/15 bg-transparent px-4 text-sm text-foreground/85 hover:bg-white/5 hover:text-foreground lg:w-auto lg:px-5"
          >
            {copy.reject}
          </Button>
          <Button
            type="button"
            onClick={onAccept}
            className="h-11 w-full rounded-full px-5 text-sm font-semibold shadow-md shadow-primary/25 lg:w-auto lg:px-6"
          >
            {copy.accept}
          </Button>
        </div>
      </div>
    </div>
  );
}
