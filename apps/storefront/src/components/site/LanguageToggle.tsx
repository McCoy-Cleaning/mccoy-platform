import { useI18n, type Lang } from "@/lib/i18n";
import { useCms } from "@/lib/cms/store";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  canonicalizePublicIdentityPath,
  stripLocalePrefix,
} from "@mccoy/cms-schema";
import { mapPathnameToLocale } from "@/lib/locale-path";

/**
 * Language toggle — always offers NL and EN on the public storefront.
 * EN copy uses i18n catalogs; when EN is published, soft-navigates to `/en` routes
 * via TanStack Router (no full document reload).
 * When EN is not published, switches client locale in-place (no 302 bounce back to NL).
 */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const cms = useCms();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const pathIdentity = canonicalizePublicIdentityPath(
    stripLocalePrefix(pathname).path.replace(/\/+$/, "") || "/",
  );

  const currentPage = cms.pages.find((p) => {
    const nl = canonicalizePublicIdentityPath(
      (p.paths?.nl ?? p.slug ?? "/").replace(/\/+$/, "") || "/",
    );
    const en = canonicalizePublicIdentityPath(
      (p.paths?.en ?? p.paths?.nl ?? p.slug ?? "/").replace(/\/+$/, "") || "/",
    );
    return (
      pathIdentity === nl ||
      pathIdentity === en ||
      (nl !== "/" && pathIdentity.startsWith(`${nl}/`)) ||
      (en !== "/" && pathIdentity.startsWith(`${en}/`))
    );
  });

  const siblingHref = (target: Lang): string =>
    mapPathnameToLocale(pathname, target, cms.pages);

  const enPublishedForTarget = (target: Lang): boolean => {
    if (target !== "en") return true;
    const page =
      currentPage ??
      cms.pages.find((p) => p.id === "page_home") ??
      cms.pages.find((p) => (p.paths?.nl ?? p.slug) === "/" || p.slug === "/");
    return page?.localeStates?.en?.publicationState === "published";
  };

  const langs: Lang[] = ["nl", "en"];
  const effectiveLang: Lang = lang === "en" ? "en" : "nl";
  const activeIndex = Math.max(0, langs.indexOf(effectiveLang));

  return (
    <div
      translate="no"
      role="group"
      aria-label="Language"
      className={`relative inline-flex items-center rounded-full border border-white/15 bg-white/5 p-1 ${className}`}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 w-9 rounded-full bg-primary transition-transform duration-200 ease-out"
        style={{ transform: `translate3d(${activeIndex * 36}px, 0, 0)` }}
      />
      {langs.map((l) => {
        const href = siblingHref(l);
        const allowNavigate = enPublishedForTarget(l) || l === "nl";
        const stayInPlace = !allowNavigate || href === pathname;
        const label = l === "nl" ? "Nederlands" : "English";
        return (
          <Link
            key={l}
            to={href}
            preload="intent"
            resetScroll={false}
            onClick={(e) => {
              setLang(l);
              if (stayInPlace) {
                e.preventDefault();
              }
            }}
            translate="no"
            className="notranslate relative z-10 grid h-7 w-9 place-items-center text-xs font-semibold uppercase tracking-wider"
            aria-label={label}
            aria-current={effectiveLang === l ? "true" : undefined}
            lang={l}
          >
            <span
              translate="no"
              className={
                effectiveLang === l ? "text-primary-foreground" : "text-white/70 hover:text-white"
              }
            >
              {l.toUpperCase()}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
