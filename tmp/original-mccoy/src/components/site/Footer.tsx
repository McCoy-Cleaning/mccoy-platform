import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Linkedin, Phone, Mail, MapPin, ShieldCheck } from "lucide-react";
import logoAsset from "@/assets/logo-mccoy.png.asset.json";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  const jobsHref = "/vacatures";
  return (
    <footer className="relative border-t border-white/10 bg-card/50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-4">
          <div>
            <img src={logoAsset.url} alt="McCoy Cleaning" className="h-10 w-auto" />
            <p className="mt-4 max-w-xs text-sm text-white/60">{t.footer.tagline}</p>
            <div className="mt-5 flex gap-3">
              <a
                href="https://www.facebook.com/McCoyCleaning/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:border-primary hover:text-primary"
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com/mccoycleaning/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:border-primary hover:text-primary"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:border-primary hover:text-primary"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              {t.nav.services}
            </h4>
            <ul className="space-y-2 text-sm text-white/60">
              {t.work.items.map((w) => (
                <li key={w.title}>
                  <Link to="/services" className="transition hover:text-primary">{w.title}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              {t.nav.contact}
            </h4>
            <ul className="space-y-3 text-sm text-white/60">
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-primary" /> Nijverheidsstraat 63, 7575 BH Oldenzaal</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> <a href="tel:+31541534982" className="hover:text-primary">0541 534 982</a></li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> <a href="mailto:info@mccoy.nl" className="hover:text-primary">info@mccoy.nl</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              {t.footer.certs}
            </h4>
            <div className="flex flex-wrap gap-2">
              {["OSB", "VSR", "Code Verantwoordelijk Marktgedrag"].map((c) => (
                <div key={c} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {c}
                </div>
              ))}
            </div>
            <div className="mt-6">
              <div className="flex flex-col gap-2">
                <Link to="/products" className="text-sm text-white/70 hover:text-primary">{t.nav.products}</Link>
                <Link to={jobsHref} className="text-sm text-white/70 hover:text-primary">{t.nav.jobs}</Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row">
          <p>© 2026 McCoy Cleaning — {t.footer.tagline}</p>
          <div className="flex gap-5">
            <Link to="/terms" className="hover:text-primary">{t.footer.terms}</Link>
            <Link to="/privacy" className="hover:text-primary">{t.footer.privacy}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}