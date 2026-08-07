import { Facebook, Instagram, Linkedin, Phone, Mail, MapPin, ShieldCheck } from "lucide-react";
import logoUrl from "@/assets/logo-mccoy.png";
import logoWebpUrl from "@/assets/logo-mccoy.webp";
import { CmsLinkAnchor } from "@/components/site/CmsLinkAnchor";
import { useSiteFooter } from "@/lib/cms/store";
import { NAV_LOGO_HEIGHT, NAV_LOGO_WIDTH } from "@/lib/image-delivery";
import { SECTION_PAGE_RAIL } from "@mccoy/cms-renderer/section-layout";
import { DEFAULT_FOOTER_LOGO, resolveFooterLogoHeight } from "@mccoy/cms-schema";
import { cn } from "@/lib/utils";

function SocialIcon({ network }: { network: string }) {
  if (network === "facebook") return <Facebook className="h-4 w-4" />;
  if (network === "instagram") return <Instagram className="h-4 w-4" />;
  if (network === "linkedin") return <Linkedin className="h-4 w-4" />;
  return <Linkedin className="h-4 w-4" />;
}

function ContactIcon({ kind }: { kind: string }) {
  if (kind === "phone") return <Phone className="h-4 w-4 text-primary" />;
  if (kind === "email") return <Mail className="h-4 w-4 text-primary" />;
  if (kind === "address") return <MapPin className="mt-0.5 h-4 w-4 text-primary" />;
  return <MapPin className="mt-0.5 h-4 w-4 text-primary" />;
}

export function Footer() {
  const footer = useSiteFooter();
  const logo = footer.logo ?? DEFAULT_FOOTER_LOGO;
  const logoHeight = resolveFooterLogoHeight(footer);
  const logoSrc = logo.src?.startsWith("/") || logo.src?.startsWith("http") ? logo.src : logoUrl;
  const useBundledWebp =
    !footer.logo ||
    logo.src === DEFAULT_FOOTER_LOGO.src ||
    logo.src.includes("logo-mccoy");

  return (
    <footer className="relative border-t border-white/10 bg-card/50">
      <div className={cn(SECTION_PAGE_RAIL, "py-16")}>
        <div className="grid gap-12 lg:grid-cols-4">
          <div>
            {useBundledWebp ? (
              <picture>
                <source type="image/webp" srcSet={logoWebpUrl} />
                <img
                  src={logoUrl}
                  alt={logo.alt || "McCoy Cleaning"}
                  width={NAV_LOGO_WIDTH}
                  height={NAV_LOGO_HEIGHT}
                  loading="lazy"
                  decoding="async"
                  style={{ height: logoHeight }}
                  className="w-auto"
                />
              </picture>
            ) : (
              <img
                src={logoSrc}
                alt={logo.decorative ? "" : logo.alt || "McCoy Cleaning"}
                width={NAV_LOGO_WIDTH}
                height={NAV_LOGO_HEIGHT}
                loading="lazy"
                decoding="async"
                style={{ height: logoHeight }}
                className="w-auto"
              />
            )}
            {footer.tagline ? (
              <p className="mt-4 max-w-xs text-sm text-white/60">{footer.tagline}</p>
            ) : null}
            {footer.socialLinks.length > 0 ? (
              <div className="mt-5 flex gap-3">
                {footer.socialLinks.map((social) => {
                  const href = social.href?.trim();
                  if (!href || href === "#") {
                    return (
                      <span
                        key={social.id}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/40"
                        aria-label={social.label}
                      >
                        <SocialIcon network={social.network} />
                      </span>
                    );
                  }
                  return (
                    <a
                      key={social.id}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:border-primary hover:text-primary"
                      aria-label={social.label}
                    >
                      <SocialIcon network={social.network} />
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div>
            {footer.servicesTitle ? (
              <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
                {footer.servicesTitle}
              </p>
            ) : null}
            <ul className="space-y-2 text-sm text-white/60">
              {footer.servicesLinks.map((item) => (
                <li key={item.id}>
                  <CmsLinkAnchor
                    link={item.link}
                    className="transition hover:text-primary"
                  >
                    {item.label}
                  </CmsLinkAnchor>
                </li>
              ))}
            </ul>
          </div>

          <div>
            {footer.contactTitle ? (
              <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
                {footer.contactTitle}
              </p>
            ) : null}
            <ul className="space-y-3 text-sm text-white/60">
              {footer.contactRows.map((row) => (
                <li
                  key={row.id}
                  className={
                    row.kind === "address" || row.kind === "text"
                      ? "flex items-start gap-2"
                      : "flex items-center gap-2"
                  }
                >
                  <ContactIcon kind={row.kind} />
                  {row.href ? (
                    <a href={row.href} className="hover:text-primary">
                      {row.label}
                    </a>
                  ) : (
                    <span>{row.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            {footer.certsTitle ? (
              <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
                {footer.certsTitle}
              </p>
            ) : null}
            {footer.certs.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {footer.certs.map((c) => (
                  <div
                    key={c}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {c}
                  </div>
                ))}
              </div>
            ) : null}
            {footer.extraLinks.length > 0 ? (
              <div className="mt-6">
                <div className="flex flex-col gap-2">
                  {footer.extraLinks.map((item) => (
                    <CmsLinkAnchor
                      key={item.id}
                      link={item.link}
                      className="text-sm text-white/70 hover:text-primary"
                    >
                      {item.label}
                    </CmsLinkAnchor>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row">
          <p>{footer.copyright}</p>
          <div className="flex gap-5">
            {footer.legalLinks.map((item) => (
              <CmsLinkAnchor key={item.id} link={item.link} className="hover:text-primary">
                {item.label}
              </CmsLinkAnchor>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
