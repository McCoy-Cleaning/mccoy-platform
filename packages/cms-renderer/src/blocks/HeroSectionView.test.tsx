import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultBlock } from "@mccoy/cms-schema";
import { HeroSectionView } from "./BasicContentSectionViews";

describe("HeroSectionView Home parity", () => {
  it("renders accent, secondary CTA, trust strip, and media chrome", () => {
    const block = createDefaultBlock("hero");
    const html = renderToStaticMarkup(
      <HeroSectionView data={block.data as Record<string, unknown>} pages={[]} />,
    );
    expect(html).toContain('data-testid="hero-heading"');
    expect(html).toContain("McCoy Cleaning,");
    expect(html).toContain("schoonmaakbedrijf in Twente.");
    expect(html).toContain("Bekijk onze diensten");
    expect(html).toContain("Jaar ervaring");
    expect(html).toContain("Gecertificeerd");
    expect(html).toContain("min-h-[100svh]");
    expect(html).toContain('data-cms-width-mode="fullBleed"');
  });

  it("formChrome Offerte intro stays content-sized (no full-viewport hero)", () => {
    const html = renderToStaticMarkup(
      <HeroSectionView
        data={{
          presentation: "formChrome",
          eyebrow: "Offerte",
          title: "Vraag een offerte aan",
          subtitle: "Vertel ons wat u nodig heeft.",
          align: "left",
        }}
        pages={[]}
      />,
    );
    expect(html).toContain('data-cms-presentation="formChrome"');
    expect(html).toContain("Offerte");
    expect(html).toContain("Vraag een offerte aan");
    expect(html).toContain("Vertel ons wat u nodig heeft.");
    expect(html).not.toContain("min-h-[100svh]");
    expect(html).not.toContain('id="home"');
    expect(html).toContain(
      'class="relative flex min-h-[16rem] items-center py-10 sm:min-h-[18rem] sm:py-14 md:min-h-[20rem] md:py-16"',
    );
  });
});
