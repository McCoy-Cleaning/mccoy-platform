import { Link } from "@tanstack/react-router";
import {
  X,
  ArrowUpRight,
  Phone,
  Mail,
  Home,
  Sparkles,
  Info,
  Briefcase,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { useEffect } from "react";
import logoUrl from "@/assets/logo-mccoy.png";
import logoWebpUrl from "@/assets/logo-mccoy.webp";
import { LanguageToggle } from "./LanguageToggle";
import { CmsLinkAnchor } from "./CmsLinkAnchor";
import { useCms, useSiteNavigation } from "@/lib/cms/store";
import { resolveCmsLinkHref, resolveLogoHeightMobile, resolveStorefrontNavLinks } from "@mccoy/cms-schema";
import { useI18n } from "@/lib/i18n";
import { localizedNavLabel } from "@/lib/cms-i18n";
import { localWebpSibling, NAV_LOGO_HEIGHT, NAV_LOGO_WIDTH } from "@/lib/image-delivery";

const ICONS = [Home, Sparkles, Sparkles, Info, MessageSquare, Briefcase] as const;

export function MobileMenu({ onClose }: { onClose: () => void }) {
  const cmsState = useCms();
  const navigation = useSiteNavigation();
  const { t } = useI18n();
  const pages = cmsState.pages.map((p) => ({ id: p.id, slug: p.slug }));
  const navLinks = resolveStorefrontNavLinks(navigation, cmsState.pages);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const logoSrc = navigation.logo?.src || logoUrl;
  const logoWebp = navigation.logo?.src ? localWebpSibling(navigation.logo.src) : logoWebpUrl;
  const logoHeightPx = resolveLogoHeightMobile(navigation);

  return (
    <div className="fixed inset-0 z-[60] bg-background md:hidden">
      <div className="absolute inset-0 bg-grid opacity-20" />

      <div className="relative flex h-full flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-4">
          <picture>
            {logoWebp ? <source type="image/webp" srcSet={logoWebp} /> : null}
            <img
              src={logoSrc}
              alt={navigation.logo?.decorative ? "" : navigation.logo?.alt || "McCoy Cleaning"}
              width={NAV_LOGO_WIDTH}
              height={NAV_LOGO_HEIGHT}
              decoding="async"
              style={{ height: logoHeightPx, width: "auto", aspectRatio: "auto" }}
              className="w-auto object-contain"
            />
          </picture>
          <button
            onClick={onClose}
            aria-label="Menu sluiten"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col justify-center px-4 py-4 sm:px-5">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {navLinks.map((l, index) => {
              const Icon = ICONS[index % ICONS.length]!;
              const href = resolveCmsLinkHref(l.link, pages) ?? "#";
              const accent = index >= navLinks.length - 2;
              const label = localizedNavLabel(l.label, l.link, t);
              const inner = (
                <>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${
                      accent
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                        : "bg-primary/15 text-primary"
                    }`}
                  >
                    {l.link.type === "external" ? (
                      <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </div>
                  <span className="mt-2 font-display text-base leading-tight text-white sm:mt-3 sm:text-lg">
                    {label}
                  </span>
                  <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 text-white/30" />
                </>
              );
              const cls =
                "group relative flex aspect-[1.25/1] flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-card/80 p-3 transition-transform active:scale-[0.98] sm:aspect-[1.15/1] sm:p-4";
              return (
                <div key={l.id}>
                  {l.link.type === "external" ? (
                    <CmsLinkAnchor link={l.link} className={cls} fallbackHref={href}>
                      <span onClick={onClose}>{inner}</span>
                    </CmsLinkAnchor>
                  ) : (
                    <Link to={href} preload="intent" onClick={onClose} className={cls}>
                      {inner}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="px-4 pb-5 pt-2 sm:px-5 sm:pb-6">
          {navigation.quoteCta ? (
            <CmsLinkAnchor
              link={navigation.quoteCta.link}
              fallbackHref="/offerte"
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/30 sm:mb-4 sm:py-3.5"
            >
              <span onClick={onClose} className="inline-flex items-center gap-2">
                {localizedNavLabel(navigation.quoteCta.label, navigation.quoteCta.link, t)}
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </CmsLinkAnchor>
          ) : null}
          {navigation.jobsCta ? (
            <CmsLinkAnchor
              link={navigation.jobsCta.link}
              fallbackHref="/vacatures"
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/5 px-5 py-3 text-sm font-semibold text-white/90 sm:mb-4"
            >
              <span onClick={onClose}>
                {localizedNavLabel(navigation.jobsCta.label, navigation.jobsCta.link, t)}
              </span>
            </CmsLinkAnchor>
          ) : null}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-white/70 sm:text-xs">
            <a
              href="tel:+31541534982"
              className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5"
            >
              <Phone className="h-3.5 w-3.5 shrink-0 text-primary" /> 0541 534 982
            </a>
            <a
              href="mailto:info@mccoy.nl"
              className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5"
            >
              <Mail className="h-3.5 w-3.5 shrink-0 text-primary" /> info@mccoy.nl
            </a>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 sm:mt-4">
            <LanguageToggle />
            <span className="text-[10px] text-white/40">© 2026 McCoy Cleaning</span>
          </div>
        </div>
      </div>
    </div>
  );
}
