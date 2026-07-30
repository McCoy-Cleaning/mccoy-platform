import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Sparkles, ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import {
  SECTION_GRID,
  SECTION_HEADER_TO_CONTENT,
  SECTION_INNER,
  SECTION_SHELL_Y,
} from "@mccoy/cms-renderer";

export interface CityLandingProps {
  city: string;
  intro: string;
  services: { title: string; body: string }[];
  reasons: string[];
}

export function CityLanding({ city, intro, services, reasons }: CityLandingProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-32">
        <section className={`${SECTION_SHELL_Y} px-4 sm:px-6 lg:px-8`}>
          <div className="pointer-events-none absolute -top-20 right-0 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="mx-auto max-w-[96rem]">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary"
            >
              <MapPin className="h-3.5 w-3.5" />
              Schoonmaakbedrijf {city}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.7 }}
              className="font-display mt-6 max-w-3xl text-5xl text-white md:text-7xl"
            >
              Schoonmaakbedrijf in {city}
            </motion.h1>
            <p className="mt-5 max-w-2xl text-lg font-medium text-white/70">{intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/offerte"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110"
              >
                Vraag een offerte aan
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-primary/40 hover:text-white"
              >
                Alle diensten
              </Link>
            </div>
          </div>
        </section>

        <section className={`${SECTION_SHELL_Y} ${SECTION_INNER}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Sparkles className="mr-1 inline h-3.5 w-3.5" />
            Onze diensten in {city}
          </p>
          <h2 className="font-display mt-3 text-3xl text-white md:text-4xl">
            Professionele schoonmaak voor bedrijven in {city}
          </h2>
          <div className={`${SECTION_HEADER_TO_CONTENT} ${SECTION_GRID} sm:grid-cols-2 lg:grid-cols-3`}>
            {services.map((s) => (
              <article
                key={s.title}
                className="rounded-3xl border border-white/10 bg-card/70 p-6 transition hover:border-primary/40"
              >
                <h3 className="font-display text-xl text-white">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={`${SECTION_SHELL_Y} ${SECTION_INNER} pb-28`}>
          <div className="grid gap-8 rounded-[2rem] border border-white/10 bg-card/60 p-8 md:p-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Waarom McCoy in {city}
              </p>
              <h2 className="font-display mt-3 text-3xl text-white md:text-4xl">
                Vast eigen team, korte lijnen en 25+ jaar ervaring in Twente.
              </h2>
              <p className="mt-4 text-white/70">
                Vanuit Oldenzaal zijn we snel ter plaatse in {city} en omgeving.
                Kantoren, horeca, zorginstellingen en specialistische projecten —
                één aanspreekpunt, één vast team, één kwaliteitsstandaard.
              </p>
            </div>
            <ul className="grid gap-3">
              {reasons.map((r) => (
                <li
                  key={r}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-background/40 p-4"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm text-white/80">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export function cityJsonLd(city: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: `McCoy Cleaning — Schoonmaakbedrijf ${city}`,
    description: `Professioneel schoonmaakbedrijf actief in ${city} en omgeving. Kantoorschoonmaak, glasbewassing, vloeronderhoud en horecaschoonmaak.`,
    url: path,
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
    areaServed: { "@type": "City", name: city },
  };
}