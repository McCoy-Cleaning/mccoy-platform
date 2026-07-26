import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu, ArrowUpRight, Briefcase } from "lucide-react";
import { motion } from "motion/react";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "./LanguageToggle";
import { MobileMenu } from "./MobileMenu";
import { AnimatedLogo } from "./AnimatedLogo";
import { useCms } from "@/lib/cms/store";

export function Navbar() {
  const { t } = useI18n();
  const cmsState = useCms();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  const customNav = cmsState.pages
    .filter((p) => p.isCustom && !p.isDraftOnly && p.inNav)
    .map((p) => ({ to: p.slug, label: p.title }));

  const navLinks: { to: string; label: string; exact?: boolean }[] = [
    { to: "/", label: t.nav.home, exact: true },
    { to: "/services", label: t.nav.services },
    { to: "/products", label: t.nav.products },
    { to: "/about", label: t.nav.about },
    { to: "/contact", label: t.nav.contact },
    ...customNav,
  ];

  const jobsHref = "/vacatures";
  const quoteHref = "/offerte";

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-background/85 backdrop-blur-xl shadow-[0_10px_30px_-24px_rgba(63,182,242,0.45)]"
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <AnimatedLogo className="h-14 w-auto md:h-16 lg:h-28" />
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] px-2 py-1.5 backdrop-blur md:flex">
            {navLinks.map((l) => (
              <NavLinkItem key={l.to} to={l.to} exact={l.exact}>
                {l.label}
              </NavLinkItem>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <LanguageToggle className="hidden sm:inline-flex" />
            <Link
              to={jobsHref}
              className="hidden items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3.5 py-2 text-[13px] font-semibold text-white/85 transition hover:bg-primary/15 hover:text-white md:inline-flex lg:px-4 lg:py-2.5"
            >
              <Briefcase className="h-3.5 w-3.5 text-primary" />
              {t.nav.jobs}
            </Link>
            <a
              href={quoteHref}
              className="group hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-[1.03] hover:shadow-primary/50 md:inline-flex lg:px-5 lg:py-2.5 lg:text-sm"
            >
              {t.nav.cta}
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <button
              aria-label="Open menu"
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
}: {
  to: string;
  children: React.ReactNode;
  exact?: boolean;
}) {
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
