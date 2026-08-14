import { useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { localizeInternalHref, localeFromPathname } from "@/lib/locale-path";
import { cn } from "@/lib/utils";

type CookieConsentBannerProps = {
  open: boolean;
  onAccept: () => void;
  onReject: () => void;
};

/**
 * Minimal analytics consent banner (NL-first). Shown only when GA is configured
 * and the visitor has not yet chosen.
 */
export function CookieConsentBanner({ open, onAccept, onReject }: CookieConsentBannerProps) {
  const { lang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const privacyHref = localizeInternalHref("/privacy", localeFromPathname(pathname));
  const copy =
    lang === "en"
      ? {
          title: "Analytics cookies",
          body: "We use Google Analytics only with your consent, to understand how this site is used. Necessary cookies (for example language preference) always work.",
          accept: "Accept analytics cookies",
          reject: "Necessary only",
          privacy: "Privacy statement",
        }
      : {
          title: "Analytics cookies",
          body: "Wij gebruiken Google Analytics alleen met jouw toestemming, om te begrijpen hoe deze website wordt gebruikt. Noodzakelijke cookies (bijvoorbeeld taalvoorkeur) werken altijd.",
          accept: "Accepteer analytics cookies",
          reject: "Alleen noodzakelijk",
          privacy: "Privacyverklaring",
        };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="mccoy-cookie-consent-title"
      aria-describedby="mccoy-cookie-consent-desc"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[80] p-4 sm:p-6",
        "pointer-events-none",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex max-w-3xl flex-col gap-4",
          "rounded-2xl border border-border/80 bg-background/95 p-5 shadow-lg backdrop-blur-md",
          "sm:flex-row sm:items-end sm:gap-6 sm:p-6",
        )}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <h2
            id="mccoy-cookie-consent-title"
            className="text-sm font-semibold tracking-tight text-foreground"
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
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {copy.privacy}
            </a>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onReject}>
            {copy.reject}
          </Button>
          <Button type="button" onClick={onAccept}>
            {copy.accept}
          </Button>
        </div>
      </div>
    </div>
  );
}
