import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu, ArrowUpRight, Briefcase } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { resolveCmsLinkHref, resolveLogoHeightDesktop, resolveStorefrontNavLinks } from "@mccoy/cms-schema";
import { LanguageToggle } from "./LanguageToggle";
import { MobileMenu } from "./MobileMenu";
import { AnimatedLogo } from "./AnimatedLogo";
import { CmsLinkAnchor } from "./CmsLinkAnchor";
import { useCms, useSiteNavigation } from "@/lib/cms/store";
import { useI18n } from "@/lib/i18n";
import { localizedNavLabel } from "@/lib/cms-i18n";
import { localWebpSibling, NAV_LOGO_HEIGHT, NAV_LOGO_WIDTH } from "@/lib/image-delivery";
import { useMobileLiteMotion } from "@/lib/use-mobile-lite-motion";
import { SECTION_PAGE_RAIL } from "@mccoy/cms-renderer";
import { cn } from "@/lib/utils";

export function Navbar() {
  const cmsState = useCms();
  const navigation = useSiteNavigation();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const reducedMotion = useReducedMotion();
  const mobileLite = useMobileLiteMotion();
  const softMotion = Boolean(reducedMotion) || mobileLite;

  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  const pages = cmsState.pages.map((p) => ({ id: p.id, slug: p.slug }));
  const navLinks = resolveStorefrontNavLinks(navigation, cmsState.pages);

  const logoSrc = navigation.logo?.src;
  const logoWebp = logoSrc ? localWebpSibling(logoSrc) : undefined;
  const logoHeightPx = resolveLogoHeightDesktop(navigation);

  return (
    <>
      <motion.header
        initial={softMotion ? false : { y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: softMotion ? 0 : 0.5, ease: "easeOut" }}
        className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-background/85 backdrop-blur-xl shadow-[0_10px_30px_-24px_rgba(63,182,242,0.45)]"
      >
        <div
          className={cn(SECTION_PAGE_RAIL, "flex items-center justify-between gap-3")}
          style={{ minHeight: Math.max(80, logoHeightPx + 24) }}
        >
          <Link to="/" className="flex items-center gap-2">
            {logoSrc ? (
              <picture>
                {logoWebp ? <source type="image/webp" srcSet={logoWebp} /> : null}
                <img
                  src={logoWebp ?? logoSrc}
                  alt={navigation.logo?.decorative ? "" : navigation.logo?.alt || "McCoy Cleaning"}
                  width={NAV_LOGO_WIDTH}
                  height={NAV_LOGO_HEIGHT}
                  decoding="async"
                  fetchPriority="low"
                  style={{ height: logoHeightPx }}
                  className="w-auto object-contain"
                />
              </picture>
            ) : (
              <AnimatedLogo style={{ height: logoHeightPx }} className="w-auto" />
            )}
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] px-2 py-1.5 backdrop-blur md:flex">
            {navLinks.map((l) => {
              const href = resolveCmsLinkHref(l.link, pages) ?? "/";
              const exact = href === "/";
              const label = localizedNavLabel(l.label, l.link, t);
              return (
                <NavLinkItem key={l.id} to={href} exact={exact} link={l.link}>
                  {label}
                </NavLinkItem>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <LanguageToggle className="hidden sm:inline-flex" />
            {navigation.jobsCta ? (
              <CmsLinkAnchor
                link={navigation.jobsCta.link}
                fallbackHref="/vacatures"
                className="hidden items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3.5 py-2 text-[13px] font-semibold text-white/85 transition hover:bg-primary/15 hover:text-white md:inline-flex lg:px-4 lg:py-2.5"
              >
                <Briefcase className="h-3.5 w-3.5 text-primary" />
                {localizedNavLabel(navigation.jobsCta.label, navigation.jobsCta.link, t)}
              </CmsLinkAnchor>
            ) : null}
            {navigation.quoteCta ? (
              <CmsLinkAnchor
                link={navigation.quoteCta.link}
                fallbackHref="/offerte"
                className="group hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-[1.03] hover:shadow-primary/50 md:inline-flex lg:px-5 lg:py-2.5 lg:text-sm"
              >
                {localizedNavLabel(navigation.quoteCta.label, navigation.quoteCta.link, t)}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </CmsLinkAnchor>
            ) : null}
            <button
              aria-label="Menu openen"
              onClick={() => setOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </motion.header>
      {open && <MobileMenu onClose={() => setOpen(false)} />}
    </>
  );
}

function NavLinkItem({
  to,
  children,
  exact,
  link,
}: {
  to: string;
  children: React.ReactNode;
  exact?: boolean;
  link: import("@mccoy/cms-schema").CmsLink;
}) {
  if (link.type === "external") {
    return (
      <CmsLinkAnchor
        link={link}
        className="group relative rounded-full px-4 py-2 text-[13px] font-medium uppercase tracking-[0.1em] text-white/65 transition hover:text-white lg:px-5"
      >
        {children}
      </CmsLinkAnchor>
    );
  }

  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="group relative rounded-full px-4 py-2 text-[13px] font-medium uppercase tracking-[0.1em] text-white/65 transition hover:text-white lg:px-5"
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute inset-0 rounded-full bg-primary/15 ring-1 ring-primary/40" />
          )}
          <span className="relative z-10">{children}</span>
        </>
      )}
    </Link>
  );
}
