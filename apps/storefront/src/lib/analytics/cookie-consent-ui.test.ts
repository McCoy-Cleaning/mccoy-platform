import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COOKIE_CONSENT_ACTIONS_CLASS,
  COOKIE_CONSENT_CARD_CLASS,
  COOKIE_CONSENT_COPY,
  COOKIE_CONSENT_SHELL_CLASS,
  cookieConsentCopy,
} from "./cookie-consent-ui";

const stylesCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../styles.css"),
  "utf8",
);

const loadTimingPattern = /GA4|Google Analytics 4|laden we alleen|load only after/i;

describe("cookie consent UI", () => {
  it("keeps NL/EN two-button copy without script-load timing", () => {
    expect(COOKIE_CONSENT_COPY.nl.title).toBe("Analytics cookies");
    expect(COOKIE_CONSENT_COPY.nl.accept).toBe("Accepteer analytics cookies");
    expect(COOKIE_CONSENT_COPY.nl.reject).toBe("Alleen noodzakelijk");
    expect(COOKIE_CONSENT_COPY.en.title).toBe("Analytics cookies");
    expect(COOKIE_CONSENT_COPY.en.accept).toBe("Accept analytics cookies");
    expect(COOKIE_CONSENT_COPY.en.reject).toBe("Necessary only");
    expect(cookieConsentCopy("nl").privacy).toBe("Privacyverklaring");
    expect(cookieConsentCopy("en").privacy).toBe("Privacy statement");
    expect(cookieConsentCopy("nl").body).toMatch(/Google Analytics/);
    expect(cookieConsentCopy("en").body).toMatch(/Google Analytics/);
    expect(cookieConsentCopy("nl").body).not.toMatch(loadTimingPattern);
    expect(cookieConsentCopy("en").body).not.toMatch(loadTimingPattern);
    expect(cookieConsentCopy("nl").title).not.toMatch(/voorkeuren|preferences/i);
  });

  it("defaults unknown locales to NL", () => {
    expect(cookieConsentCopy("de")).toEqual(COOKIE_CONSENT_COPY.nl);
  });

  it("is a wider floating card, not a glued full-bleed bar or a toggle", () => {
    expect(COOKIE_CONSENT_SHELL_CLASS).toContain("cookie-consent-shell");
    expect(COOKIE_CONSENT_CARD_CLASS).toMatch(/rounded-3xl/);
    expect(COOKIE_CONSENT_CARD_CLASS).toMatch(/max-w-5xl/);
    expect(COOKIE_CONSENT_CARD_CLASS).toMatch(/lg:flex-row/);
    expect(COOKIE_CONSENT_CARD_CLASS).not.toMatch(/max-w-\[26rem\]/);
    expect(COOKIE_CONSENT_CARD_CLASS).not.toMatch(/rounded-none/);
    expect(COOKIE_CONSENT_CARD_CLASS).not.toMatch(/border-x-0/);
    expect(COOKIE_CONSENT_CARD_CLASS).not.toMatch(/border-b-0/);
    expect(COOKIE_CONSENT_ACTIONS_CLASS).toMatch(/flex-col/);
    expect(COOKIE_CONSENT_ACTIONS_CLASS).toMatch(/lg:flex-row/);
    expect(COOKIE_CONSENT_SHELL_CLASS).toMatch(/motion-safe:/);
  });

  it("insets the shell from viewport edges and the iOS safe area", () => {
    expect(stylesCss).toMatch(/\.cookie-consent-shell\s*\{/);
    expect(stylesCss).toMatch(/safe-area-inset-bottom/);
    expect(stylesCss).toMatch(/safe-area-inset-left/);
    expect(stylesCss).toMatch(/safe-area-inset-right/);
    expect(stylesCss).toMatch(/padding-bottom:\s*calc\(1rem \+ env\(safe-area-inset-bottom/);
  });
});
