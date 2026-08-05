import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { CmsUiLocaleProvider } from "@mccoy/cms-renderer";

// Side-effect import so Start can discover CSS for Early Hints.
// Do not use `?url` + head link when relying on Start-managed stylesheet assets.
import "../styles.css";
import { I18nProvider, resolveInitialUiLang } from "@/lib/i18n";
import logoUrl from "@/assets/logo-mccoy.png";
import { PublishedCmsProvider } from "@/lib/cms/published-provider";
import { useActiveCmsLocale } from "@/lib/cms/use-active-cms-locale";
import { DeferredCmsEditShell } from "@/components/site/DeferredCmsEditShell";
import {
  readIndexingEnv,
  storefrontRobotsMetaContent,
} from "@mccoy/security/indexing";
import { UI_LOCALE_COOKIE } from "@mccoy/cms-schema";

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
  console.error(error);
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
      {
        // Same-origin Archivo for `.font-display` — no Google Fonts CSS chain.
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: "/fonts/archivo-latin.woff2",
        crossOrigin: "anonymous",
      },
    ],
    styles: [
      {
        children: [
          "html{color-scheme:dark}",
          "html,body,#root{background:#141a28;color:#f5f7fb;margin:0}",
          'body{font-family:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif}',
          "#home{min-height:100svh;box-sizing:border-box;padding-top:5.5rem}",
          "#home h1{font-family:Archivo,\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:clamp(2.75rem,12vw,4.5rem);line-height:0.98;letter-spacing:-0.03em;font-weight:700;color:#fff;margin:1.5rem 0 0}",
          // Scope to the fixed site nav only — bare `header{}` also painted CMS section intros.
          'header[data-site-header]{background:rgba(20,26,40,.92)}',
        ].join(""),
      },
    ],
    scripts: [
      {
        // Migrate legacy localStorage → cookie, then reload once so SSR HTML
        // matches preference (avoids NL→EN filmstrip on the first post-deploy visit).
        children: `(function(){try{var k=${JSON.stringify(UI_LOCALE_COOKIE)};if(document.cookie.split(";").some(function(c){return c.trim().indexOf(k+"=")===0;}))return;var s=localStorage.getItem(k);if(s!=="nl"&&s!=="en")return;document.cookie=k+"="+s+"; Path=/; Max-Age=31536000; SameSite=Lax"+(location.protocol==="https:"?"; Secure":"");if(s!=="en")return;if(sessionStorage.getItem("mccoy-lang-migrated")==="1")return;sessionStorage.setItem("mccoy-lang-migrated","1");location.reload();}catch(e){}})();`,
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
  // SSR seeds lang from cookie / Accept-Language; client may differ until the
  // I18nProvider effect syncs documentElement.lang (suppress mismatch warning).
  const htmlLang = resolveInitialUiLang();
  return (
    <html lang={htmlLang} translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        {/* Dark shell + hero LCP text before the main Tailwind stylesheet arrives. */}
        <style
          dangerouslySetInnerHTML={{
            __html: [
              "html{color-scheme:dark}",
              "html,body,#root{background:#141a28;color:#f5f7fb;margin:0}",
              'body{font-family:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif}',
              "#home{min-height:100svh;box-sizing:border-box;padding-top:5.5rem}",
              "#home h1{font-family:Archivo,\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:clamp(2.75rem,12vw,4.5rem);line-height:0.98;letter-spacing:-0.03em;font-weight:700;color:#fff;margin:1.5rem 0 0}",
              'header[data-site-header]{background:rgba(20,26,40,.92)}',
            ].join(""),
          }}
        />
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <PublishedCmsProvider>
        <CmsUiLocaleBridge>
          <DeferredCmsEditShell>
            <Outlet />
          </DeferredCmsEditShell>
        </CmsUiLocaleBridge>
      </PublishedCmsProvider>
    </QueryClientProvider>
  );
}
