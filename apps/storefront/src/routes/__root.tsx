import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { CmsUiLocaleProvider } from "@mccoy/cms-renderer";

// Side-effect import so Start can discover CSS for Early Hints.
// Do not use `?url` + head link when relying on Start-managed stylesheet assets.
import "../styles.css";
import { I18nProvider, resolveInitialUiLang } from "@/lib/i18n";
import logoUrl from "@/assets/logo-mccoy.png";
import { PublishedCmsProvider } from "@/lib/cms/published-provider";
import { useActiveCmsLocale } from "@/lib/cms/use-active-cms-locale";
import { DeferredCmsEditShell } from "@/components/site/DeferredCmsEditShell";
import { MarketingChrome } from "@/components/site/MarketingChrome";
import {
  readIndexingEnv,
  storefrontRobotsMetaContent,
} from "@mccoy/security/indexing";
import { UI_LOCALE_COOKIE } from "@mccoy/cms-schema";

/** Trusted static critical CSS — never feed CMS/user strings into this. */
const STOREFRONT_CRITICAL_CSS = [
  "html{color-scheme:dark}",
  "html,body,#root{background:#141a28;color:#f5f7fb;margin:0}",
  'body{font-family:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif}',
  // Home / default heroes only — Offerte formChrome intros must stay content-sized.
  "#home,[data-cms-block-type=hero]:not([data-cms-presentation=formChrome]){min-height:100svh;box-sizing:border-box;padding-top:5.5rem}",
  '#home h1,[data-cms-block-type=hero]:not([data-cms-presentation=formChrome]) h1{font-family:Archivo,"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:clamp(2.75rem,12vw,4.5rem);line-height:0.98;letter-spacing:-0.03em;font-weight:700;color:#fff;margin:1.5rem 0 0}',
  "header[data-site-header]{background:rgba(20,26,40,.92)}",
].join("");

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  if (import.meta.env.DEV) console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "McCoy Cleaning — Schoonmaakbedrijf Twente" },
      {
        name: "description",
        content:
          "Professioneel schoonmaakbedrijf in Twente. Kantoorschoonmaak, glasbewassing, vloeronderhoud en horecaschoonmaak door een vast eigen team.",
      },
      { name: "google", content: "notranslate" },
      {
        name: "keywords",
        content:
          "schoonmaakbedrijf Twente, schoonmaakbedrijf Oldenzaal, kantoorschoonmaak Hengelo, schoonmaak Enschede, glasbewassing Twente, glazenwasser Oldenzaal, opleveringsschoonmaak, vloeronderhoud, tapijtreiniging, horeca schoonmaak, dieptereiniging sanitair, professionele schoonmaak bedrijven, commercial cleaning Twente, office cleaning Netherlands, window cleaning Twente",
      },
      { name: "author", content: "McCoy Cleaning" },
      {
        name: "robots",
        content: storefrontRobotsMetaContent(readIndexingEnv()),
      },
      { name: "theme-color", content: "#141a28" },
      { name: "color-scheme", content: "dark" },
      { name: "geo.region", content: "NL-OV" },
      { name: "geo.placename", content: "Oldenzaal" },
      { property: "og:site_name", content: "McCoy Cleaning" },
      { property: "og:title", content: "McCoy Cleaning — Schoonmaakbedrijf Twente" },
      {
        property: "og:description",
        content:
          "Professionele schoonmaak, glasbewassing en vloeronderhoud voor bedrijven, horeca en specialistische projecten in Twente. Kwaliteit boven alles — al meer dan 25 jaar.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "nl_NL" },
      { property: "og:locale:alternate", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "McCoy Cleaning — Schoonmaakbedrijf Twente" },
      {
        name: "twitter:description",
        content:
          "Professionele schoonmaak, glasbewassing en vloeronderhoud in Twente. Vast eigen team, 25+ jaar ervaring.",
      },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      {
        // Same-origin Archivo for `.font-display` — no Google Fonts CSS chain.
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "/fonts/archivo-latin.woff2",
        crossOrigin: "anonymous",
      },
    ],
    // Critical dark/hero CSS lives only in RootShell (before HeadContent) so we
    // do not duplicate ~400B of inline CSS in the document head.
    scripts: [
      {
        // No cookie yet: promote legacy localStorage (reload if it differs from
        // SSR <html lang>), else persist SSR Accept-Language decision into cookie.
        children: `(function(){try{var k=${JSON.stringify(UI_LOCALE_COOKIE)};var html=document.documentElement.lang;if(html!=="nl"&&html!=="en")html="";if(document.cookie.split(";").some(function(c){return c.trim().indexOf(k+"=")===0;}))return;var secure=location.protocol==="https:"?"; Secure":"";var s=null;try{s=localStorage.getItem(k);}catch(e){}if(s==="nl"||s==="en"){document.cookie=k+"="+s+"; Path=/; Max-Age=31536000; SameSite=Lax"+secure;if(html&&s!==html){if(sessionStorage.getItem("mccoy-lang-migrated")==="1")return;sessionStorage.setItem("mccoy-lang-migrated","1");location.reload();}return;}if(html){document.cookie=k+"="+html+"; Path=/; Max-Age=31536000; SameSite=Lax"+secure;}}catch(e){}})();`,
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CleaningService",
          name: "McCoy Cleaning",
          description:
            "Professioneel schoonmaakbedrijf in Twente. Kantoorschoonmaak, glasbewassing, vloeronderhoud, horeca- en opleveringsschoonmaak.",
          image: logoUrl,
          telephone: "+31541534982",
          email: "info@mccoy.nl",
          priceRange: "€€",
          address: {
            "@type": "PostalAddress",
            streetAddress: "Nijverheidsstraat 63",
            postalCode: "7575 BH",
            addressLocality: "Oldenzaal",
            addressRegion: "Overijssel",
            addressCountry: "NL",
          },
          areaServed: [
            { "@type": "City", name: "Oldenzaal" },
            { "@type": "City", name: "Hengelo" },
            { "@type": "City", name: "Enschede" },
            { "@type": "City", name: "Almelo" },
            { "@type": "AdministrativeArea", name: "Twente" },
          ],
          openingHoursSpecification: [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
              opens: "08:30",
              closes: "17:00",
            },
          ],
          serviceType: [
            "Kantoorschoonmaak",
            "Glasbewassing",
            "Vloeronderhoud",
            "Horeca schoonmaak",
            "Opleveringsschoonmaak",
            "Tapijtreiniging",
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // SSR: cookie / Accept-Language / URL. Client hydration reads the same value
  // from this attribute via resolveClientHydrationUiLang (see i18n.tsx).
  // suppressHydrationWarning: browser extensions may alter <html> attributes.
  const htmlLang = resolveInitialUiLang();
  return (
    <html lang={htmlLang} translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        {/*
          Trusted static critical CSS only (no user/CMS input).
          Text child avoids dangerouslySetInnerHTML while preserving LCP shell styles.
        */}
        <style>{STOREFRONT_CRITICAL_CSS}</style>
        <HeadContent />
      </head>
      <body
        translate="no"
        className="notranslate"
        style={{ background: "#141a28", color: "#f5f7fb", margin: 0 }}
        suppressHydrationWarning
      >
        {/* Above CatchBoundary so leaf useCmsPageForView/useI18n always have context. */}
        <I18nProvider>{children}</I18nProvider>
        <Scripts />
      </body>
    </html>
  );
}

function CmsUiLocaleBridge({ children }: { children: ReactNode }) {
  const locale = useActiveCmsLocale();
  return <CmsUiLocaleProvider locale={locale}>{children}</CmsUiLocaleProvider>;
}

function isCmsBridgePath(pathname: string): boolean {
  return (
    pathname === "/cms-preview" ||
    pathname === "/cms-sync" ||
    pathname.startsWith("/cms-preview/") ||
    pathname.startsWith("/cms-sync/")
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const cmsBridge = useRouterState({
    select: (s) => isCmsBridgePath(s.location.pathname),
  });

  return (
    <QueryClientProvider client={queryClient}>
      <PublishedCmsProvider>
        <CmsUiLocaleBridge>
          <DeferredCmsEditShell>
            {cmsBridge ? (
              <Outlet />
            ) : (
              <MarketingChrome>
                <Outlet />
              </MarketingChrome>
            )}
          </DeferredCmsEditShell>
        </CmsUiLocaleBridge>
      </PublishedCmsProvider>
      {/*
        Vercel Web Analytics: cookieless / hashed visitor identity.
        No storefront cookie-consent banner yet — when one is added for optional
        tracking, gate with beforeSend returning null until accepted.
        Skip CMS bridge routes so admin preview traffic does not inflate counts.
      */}
      <Analytics
        beforeSend={(event) => {
          try {
            const path = new URL(event.url).pathname;
            if (
              path === "/cms-preview" ||
              path === "/cms-sync" ||
              path.startsWith("/cms-preview/") ||
              path.startsWith("/cms-sync/")
            ) {
              return null;
            }
          } catch {
            return event;
          }
          return event;
        }}
      />
    </QueryClientProvider>
  );
}
