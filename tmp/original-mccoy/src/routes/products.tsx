import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { Products } from "@/components/site/Sections";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Producten — McCoy Cleaning Products" },
      {
        name: "description",
        content:
          "McCoy Products: groothandel in hygiëne papier, professionele zepen, reinigingsmiddelen voor horeca en schoonmaakapparatuur. Neem contact op voor het assortiment.",
      },
      { property: "og:title", content: "Producten — McCoy Cleaning Products" },
      {
        property: "og:description",
        content:
          "McCoy Products: groothandel in hygiëne papier, professionele zepen, reinigingsmiddelen voor horeca en schoonmaakapparatuur.",
      },
      { property: "og:url", content: "/products" },
    ],
    links: [{ rel: "canonical", href: "/products" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "McCoy Cleaning Products",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              item: {
                "@type": "Product",
                name: "Luxe geurbeleving dispenser",
                description:
                  "Premium geurdispenser met verfijnde uitstraling voor sanitair, kantoren en representatieve ruimtes.",
              },
            },
            {
              "@type": "ListItem",
              position: 2,
              item: {
                "@type": "Product",
                name: "Luxe geuren",
                description:
                  "Exclusieve geuren zoals Wood Noir, Allure, Ibiza Vibes en Aromatic Amber.",
              },
            },
            {
              "@type": "ListItem",
              position: 3,
              item: {
                "@type": "Product",
                name: "Basis geuren",
                description:
                  "Frisse dagelijkse geuren zoals Eucalyptus en Lavendel voor sanitaire en algemene ruimtes.",
              },
            },
            {
              "@type": "ListItem",
              position: 4,
              item: {
                "@type": "Service",
                name: "Volledige service",
                description:
                  "Bijvullen en onderhoud elke twee maanden door McCoy, met tot 20% korting bij meerdere dispensers.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-24">
        <Products />
      </main>
      <Footer />
    </div>
  );
}