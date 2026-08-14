/**
 * Consent card copy + layout tokens. Two explicit buttons (accept vs reject),
 * never a toggle. Layout is a floating inset card — wider bar on desktop,
 * stacked on small screens — never a full-bleed glued bar.
 *
 * Banner copy is purpose + consent, not script-load timing (that belongs in
 * the privacy statement).
 */

export const COOKIE_CONSENT_COPY = {
  nl: {
    title: "Analytics cookies",
    body: "We gebruiken Google Analytics alleen met jouw toestemming, om te begrijpen hoe deze site wordt gebruikt. Noodzakelijke cookies (bijvoorbeeld taalvoorkeur) blijven altijd werken.",
    accept: "Accepteer analytics cookies",
    reject: "Alleen noodzakelijk",
    privacy: "Privacyverklaring",
  },
  en: {
    title: "Analytics cookies",
    body: "We use Google Analytics only with your consent, to understand how this site is used. Necessary cookies (for example language preference) always work.",
    accept: "Accept analytics cookies",
    reject: "Necessary only",
    privacy: "Privacy statement",
  },
} as const;

export type CookieConsentCopy = {
  title: string;
  body: string;
  accept: string;
  reject: string;
  privacy: string;
};

export function cookieConsentCopy(lang: string): CookieConsentCopy {
  return lang === "en" ? COOKIE_CONSENT_COPY.en : COOKIE_CONSENT_COPY.nl;
}

/** Viewport shell — inset + safe-area live in `.cookie-consent-shell` (styles.css). */
export const COOKIE_CONSENT_SHELL_CLASS =
  "cookie-consent-shell pointer-events-none motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-300";

/** Card surface — rounded on all sides, never flush to the viewport edge. */
export const COOKIE_CONSENT_CARD_CLASS = [
  "pointer-events-auto w-full max-w-5xl",
  "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8",
  "rounded-3xl border border-white/10 bg-card/95 p-5 backdrop-blur-xl",
  "shadow-[0_24px_64px_-16px_rgba(0,0,0,0.55),0_20px_50px_-20px_rgba(63,182,242,0.4)]",
  "sm:p-6",
].join(" ");

/** Copy column (title, body, privacy link). */
export const COOKIE_CONSENT_COPY_CLASS = "min-w-0 flex-1 space-y-1.5";

/** Reject + accept — stacked full-width on small screens, row on desktop. */
export const COOKIE_CONSENT_ACTIONS_CLASS =
  "flex w-full shrink-0 flex-col gap-2.5 lg:w-auto lg:flex-row lg:items-center";
