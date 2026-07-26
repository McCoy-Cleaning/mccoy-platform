import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { I18nProvider } from "@/lib/i18n";
import logoAsset from "@/assets/logo-mccoy.png.asset.json";
import { EditProvider } from "@/lib/cms/edit-context";

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
        rel: "stylesheet",
        href: appCss,
      },
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
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100,400;100,600;110,700;125,800;125,900&family=Quicksand:wght@500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CleaningService",
          name: "McCoy Cleaning",
          description:
            "Professioneel schoonmaakbedrijf in Twente. Kantoorschoonmaak, glasbewassing, vloeronderhoud, horeca- en opleveringsschoonmaak.",
          image: logoAsset.url,
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
        <HeadContent />
      </head>
      <body translate="no" className="notranslate">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <EditProvider>
          {/* Required: nested routes render here. */}
          <Outlet />
        </EditProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
