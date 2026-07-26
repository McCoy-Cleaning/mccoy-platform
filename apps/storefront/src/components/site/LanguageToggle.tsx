import { useI18n, type Lang } from "@/lib/i18n";
import { useCms } from "@/lib/cms/store";
import { useRouterState } from "@tanstack/react-router";
import { normalizeCmsPath } from "@mccoy/cms-schema";

/**
 * Language toggle — always offers NL and EN on the public storefront.
 * EN copy uses i18n catalogs; when EN is published, also navigates to `/en` routes.
 * When EN is not published, switches client locale in-place (no 302 bounce back to NL).
 */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const cms = useCms();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const currentPage = cms.pages.find((p) => {
    const nl = p.paths?.nl ?? p.slug;
    const en = p.paths?.en ?? nl;
    const nlPath = normalizeCmsPath("nl", nl);
    const enPath = normalizeCmsPath("en", en);
    return pathname === nlPath || pathname === enPath;
  });

  const siblingHref = (target: Lang): string => {
    if (!currentPage) return target === "en" ? "/en" : "/";
    const nl = currentPage.paths?.nl ?? currentPage.slug;
    const en = currentPage.paths?.en ?? nl;
    return target === "en" ? normalizeCmsPath("en", en) : normalizeCmsPath("nl", nl);
  };

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
        return (
          <a
            key={l}
            href={href}
            onClick={(e) => {
              setLang(l);
              // Unpublished EN → stay on current path; setLang drives chrome + CMS overlays.
              if (!allowNavigate || href === pathname) {
                e.preventDefault();
              }
            }}
            translate="no"
            className="notranslate relative z-10 grid h-7 w-9 place-items-center text-xs font-semibold uppercase tracking-wider"
            aria-label={l === "nl" ? "Nederlands" : "English"}
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
          </a>
        );
      })}
    </div>
  );
}
