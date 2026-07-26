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
} from "lucide-react";
import { useEffect } from "react";
import logoAsset from "@/assets/logo-mccoy.png.asset.json";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "./LanguageToggle";

export function MobileMenu({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const homeBase = "/";
  const contactHref = "/contact";
  const quoteHref = "/offerte";
  const jobsHref = "/vacatures";

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

  const tiles: {
    href?: string;
    to?: string;
    label: string;
    Icon: typeof Home;
    accent?: boolean;
  }[] = [
    { to: homeBase, label: t.nav.home, Icon: Home },
    { to: "/services", label: t.nav.services, Icon: Sparkles },
    { to: "/products", label: t.nav.products, Icon: Sparkles },
    { to: "/about", label: t.nav.about, Icon: Info },
    { to: contactHref, label: t.nav.contact, Icon: MessageSquare, accent: true },
    { to: jobsHref, label: t.nav.jobs, Icon: Briefcase, accent: true },
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-background lg:hidden">
      <div className="absolute inset-0 bg-grid opacity-20" />

      <div className="relative flex h-full flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-4">
          <img src={logoAsset.url} alt="McCoy Cleaning" className="h-8 w-auto" />
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col justify-center px-4 py-4 sm:px-5">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {tiles.map((l) => {
              const inner = (
                <>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${
                      l.accent
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                        : "bg-primary/15 text-primary"
                    }`}
                  >
                    <l.Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className="mt-2 font-display text-base leading-tight text-white sm:mt-3 sm:text-lg">
                    {l.label}
                  </span>
                  <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 text-white/30" />
                </>
              );
              const cls =
                "group relative flex aspect-[1.25/1] flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-card/80 p-3 transition-transform active:scale-[0.98] sm:aspect-[1.15/1] sm:p-4";
              return (
                <div key={l.label}>
                  {l.to ? (
                    <Link to={l.to} onClick={onClose} className={cls}>
                      {inner}
                    </Link>
                  ) : (
                    <a href={l.href} onClick={onClose} className={cls}>
                      {inner}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="px-4 pb-5 pt-2 sm:px-5 sm:pb-6">
          <a
            href={quoteHref}
            onClick={onClose}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/30 sm:mb-4 sm:py-3.5"
          >
            {t.nav.cta}
            <ArrowUpRight className="h-4 w-4" />
          </a>
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
