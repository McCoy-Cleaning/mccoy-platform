import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

// Side-effect import so Start can discover CSS for Early Hints.
// Do not use `?url` + head link when relying on Start-managed stylesheet assets.
import "../styles.css";
import { I18nProvider } from "@/lib/i18n";
import logoUrl from "@/assets/logo-mccoy.png";
import { PublishedCmsProvider } from "@/lib/cms/published-provider";
import { DeferredCmsEditShell } from "@/components/site/DeferredCmsEditShell";

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
      { name: "robots", content: "index, follow" },
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
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800&family=Quicksand:wght@500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800&family=Quicksand:wght@500;600;700&display=swap",
        // Avoid render-blocking: start as print, promote after load (see RootShell).
        media: "print",
        "data-mccoy-fonts": "",
      },
    ],
    scripts: [
      {
        children: `(function(){try{document.querySelectorAll('link[data-mccoy-fonts]').forEach(function(l){l.addEventListener('load',function(){l.media='all'});if(l.sheet)l.media='all';});}catch(e){}})();`,
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
  return (
    <html lang="nl" translate="no" className="notranslate">
      <head>
        {/* Paint dark brand bg before the full stylesheet arrives / hydrates. */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              "html,body{background:#141a28;color:#f5f7fb;margin:0}#home h1{font-size:clamp(2.75rem,12vw,4.5rem);line-height:0.98;letter-spacing:-0.02em;font-weight:700}",
          }}
        />
        <HeadContent />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800&family=Quicksand:wght@500;600;700&display=swap"
          />
        </noscript>
      </head>
      <body translate="no" className="notranslate">
        {/* Above CatchBoundary so leaf useCmsPageForView/useI18n always have context. */}
        <I18nProvider>{children}</I18nProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <PublishedCmsProvider>
        <DeferredCmsEditShell>
          <Outlet />
        </DeferredCmsEditShell>
      </PublishedCmsProvider>
    </QueryClientProvider>
  );
}
