import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  collapseLineUnitsToFields,
  estimateTranslateMaxTokens,
  expandFieldsToLineUnits,
  extractJsonObject,
  extractPartialStringFields,
  lineSkeletonFingerprint,
  parseFieldsResult,
  repairCommonJsonIssues,
  parseTextResult,
  preserveTranslatedFieldStructure,
  sanitizePlainText,
  stripModelWrappers,
} from "./parse";
import { globalContentAiCache } from "./cache";
import { createContentAiService } from "./service";
import { CONTENT_AI_PROMPT_VERSION, type ContentAiProvider } from "./types";

beforeEach(() => {
  globalContentAiCache.clear();
});

describe("parse helpers", () => {
  it("strips markdown fences", () => {
    expect(stripModelWrappers('```json\n{"text":"Hallo"}\n```')).toBe('{"text":"Hallo"}');
  });

  it("sanitizes HTML and length", () => {
    expect(sanitizePlainText("<b>Hi</b>  daar", 100)).toBe("Hi daar");
    expect(sanitizePlainText("abcdef", 3)).toBe("abc");
  });

  it("parses text JSON and plain fallback", () => {
    expect(parseTextResult('{"text":"Welkom bij McCoy"}', 200).text).toBe("Welkom bij McCoy");
    const plain = parseTextResult("Gewoon platte tekst", 200);
    expect(plain.text).toBe("Gewoon platte tekst");
    expect(plain.warnings.length).toBeGreaterThan(0);
  });

  it("parses batch fields", () => {
    const raw = JSON.stringify({
      fields: { heading: "Clean spaces", body: "We deliver quality." },
    });
    const result = parseFieldsResult(raw, ["heading", "body", "missing"], 500);
    expect(result.fields.heading).toBe("Clean spaces");
    expect(result.fields.body).toBe("We deliver quality.");
    expect(result.warnings.some((w) => w.includes("missing"))).toBe(true);
  });

  it("extracts JSON from surrounding prose", () => {
    const obj = extractJsonObject('Sure!\n{"text":"Ok"}\nThanks');
    expect(obj).toEqual({ text: "Ok" });
  });

  it("strips fences embedded in prose", () => {
    expect(stripModelWrappers('Here you go:\n```json\n{"text":"Hi"}\n```\nDone')).toBe(
      '{"text":"Hi"}',
    );
  });

  it("repairs trailing commas", () => {
    expect(repairCommonJsonIssues('{"a":1,}')).toBe('{"a":1}');
    expect(JSON.parse(repairCommonJsonIssues('{"fields":{"f0":"A",},}'))).toEqual({
      fields: { f0: "A" },
    });
  });

  it("extracts JSON with trailing commas via extractJsonObject", () => {
    expect(extractJsonObject('{"fields":{"f0":"Clean",},}')).toEqual({
      fields: { f0: "Clean" },
    });
  });

  it("recovers partial fields from truncated JSON", () => {
    const truncated =
      '{"fields":{"f0":"Clean spaces","f1":"Reliable partners","f2":"Still cut off';
    const partial = extractPartialStringFields(truncated);
    expect(partial.f0).toBe("Clean spaces");
    expect(partial.f1).toBe("Reliable partners");
    expect(partial.f2).toBeUndefined();

    const result = parseFieldsResult(truncated, ["f0", "f1", "f2"], 500);
    expect(result.fields.f0).toBe("Clean spaces");
    expect(result.fields.f1).toBe("Reliable partners");
    expect(result.fields.f2).toBeUndefined();
    expect(result.warnings.some((w) => /onvolledig|gedeeltelijke/i.test(w))).toBe(true);
  });

  it("estimates translate max tokens from payload size", () => {
    const small = estimateTranslateMaxTokens({ f0: "Hallo" });
    expect(small).toBeGreaterThanOrEqual(2560);
    const large = estimateTranslateMaxTokens({
      f0: "x".repeat(2000),
      f1: "y".repeat(2000),
      f2: "z".repeat(2000),
    });
    expect(large).toBeGreaterThan(small);
    expect(large).toBeLessThanOrEqual(8192);
  });
});

describe("expandFieldsToLineUnits / collapseLineUnitsToFields", () => {
  it("splits multiline fields into per-line units and reassembles the skeleton", () => {
    const nl = [
      '"Tagline here"',
      "",
      "Intro ending with:",
      "• First bullet",
      "• Second bullet",
      "Interstitial prose with \"quotes\"",
      "• Third bullet",
      "",
      "Closing paragraph.",
      "",
      "Subheading?",
      "Answer paragraph.",
      "__________________________________________",
    ].join("\n");

    const { units, plans } = expandFieldsToLineUnits({ body: nl });
    expect(Object.keys(units)).toHaveLength(9);
    expect(units.u0).toContain("Tagline");
    expect(units.u3).toBe("• Second bullet");
    expect(Object.values(units).some((v) => v.includes("____"))).toBe(false);

    const enUnits: Record<string, string> = {
      u0: '"English tagline"',
      u1: "Intro ending with:",
      u2: "• First bullet",
      u3: "• Second bullet",
      u4: 'Interstitial prose with "quotes"',
      u5: "• Third bullet",
      u6: "Closing paragraph.",
      u7: "Subheading?",
      u8: "Answer paragraph.",
    };
    const collapsed = collapseLineUnitsToFields(enUnits, plans);
    expect(lineSkeletonFingerprint(collapsed.body!)).toBe(lineSkeletonFingerprint(nl));
    expect(collapsed.body).toContain("\n\nClosing paragraph.\n\nSubheading?");
    expect(collapsed.body!.endsWith("__________________________________________")).toBe(true);
  });

  it("leaves single-line fields as one unit", () => {
    const { units, plans } = expandFieldsToLineUnits({ title: "Schone kantoren" });
    expect(units).toEqual({ u0: "Schone kantoren" });
    expect(collapseLineUnitsToFields({ u0: "Clean offices" }, plans)).toEqual({
      title: "Clean offices",
    });
  });
});

describe("preserveTranslatedFieldStructure", () => {
  const nlWebshop = [
    '"Binnenkort: onze nieuwe webshop"',
    "",
    "Achter de schermen werken we hard aan onze nieuwe webshop. Natuurlijk houden we u op de hoogte!",
    "__________________________________________",
  ].join("\n");

  it("splits a glued underscore separator onto its own line", () => {
    const broken =
      "Coming soon: our new webshop Behind the scenes, we are working hard. Of course, we will keep you updated on the progress!__________________________________________";
    const fixed = preserveTranslatedFieldStructure(nlWebshop, broken);
    expect(fixed).toMatch(/\n__________________________________________$/);
    expect(fixed).not.toMatch(/progress!_/);
    expect(fixed).not.toMatch(/!_/);
  });

  it("keeps an already separate separator line and NL separator characters", () => {
    const en = [
      '"Coming soon: our new webshop"',
      "",
      "Behind the scenes, we are working hard.",
      "-----",
    ].join("\n");
    const fixed = preserveTranslatedFieldStructure(nlWebshop, en);
    expect(fixed.endsWith("__________________________________________")).toBe(true);
    expect(fixed).not.toContain("-----");
  });

  it("restores quotes on a short first line when Dutch was quoted", () => {
    const en = [
      "Coming soon: our new webshop",
      "",
      "Behind the scenes, we are working hard.",
      "__________________________________________",
    ].join("\n");
    const fixed = preserveTranslatedFieldStructure(nlWebshop, en);
    expect(fixed.startsWith('"Coming soon: our new webshop"')).toBe(true);
  });

  it("does not wrap a single long paragraph in quotes", () => {
    const en =
      "Coming soon: our new webshop Behind the scenes, we are working hard on developing our new webshop and will keep you updated!";
    const nl =
      '"Binnenkort: onze nieuwe webshop" Achter de schermen werken we hard zonder scheidingslijn.';
    const fixed = preserveTranslatedFieldStructure(nl, en);
    expect(fixed.startsWith('"')).toBe(false);
  });

  it("leaves plain fields unchanged when NL has no separator or quotes", () => {
    expect(preserveTranslatedFieldStructure("Schone kantoren", "Clean offices")).toBe(
      "Clean offices",
    );
  });

  it("recovers collapsed bullets, interstitial prose, blank lines, and subheads", () => {
    const nl = [
      '"Met onze producten bent u altijd verzekerd van een frisse omgeving"',
      "",
      "Een belangrijk onderdeel van McCoy Cleaning is McCoy Products, onze groothandel. In ons assortiment vind je:",
      "• Hygiëne papier",
      "• Dispensers en diverse producten",
      "• Luxe geurbeleving",
      "• Industriële reinigingsmiddelen",
      "• Reinigingsmiddelen voor diverse toepassingen,",
      'Ook voeren wij een Bio Microbiologische reinigingslijn: "100% chemievrij reinigen"',
      "• Schoonmaakmaterialen en accessoires",
      "",
      "Of u nu op zoek bent naar dagelijkse schoonmaakproducten, bij McCoy vindt u alles onder één dak.",
      "",
      "Meer informatie of direct bestellen?",
      "Wilt u meer informatie? Bel ons of vul ons contactformulier in.",
      "",
      "Binnenkort: onze nieuwe webshop",
      "Achter de schermen werken we hard aan onze nieuwe webshop.",
    ].join("\n");

    // Mimics the production failure: first bullets OK, remainder flattened with inline •.
    const broken = [
      '"With our products you are always guaranteed a fresh environment"',
      "",
      "A key part of McCoy Cleaning is McCoy Products, our wholesale. In our range you will find:",
      "• Hygiene paper",
      "• Dispensers and various products",
      "• Luxury scent experiences",
      "• Industrial cleaning agents • Cleaning agents for various applications, We also offer a Bio Microbiological cleaning line: \"100% chemical-free cleaning\" • Cleaning materials and accessories Whether you are looking for daily cleaning products, at McCoy you will find everything under one roof. More information or place an order directly? Would you like more information? Please call us or fill in our contact form. Coming soon: our new webshop Behind the scenes we are working hard on our new webshop.",
    ].join("\n");

    const fixed = preserveTranslatedFieldStructure(nl, broken);
    expect(lineSkeletonFingerprint(fixed)).toBe(lineSkeletonFingerprint(nl));
    expect(fixed).toMatch(/^"With our products/m);
    expect(fixed).toMatch(/^• Industrial cleaning agents$/m);
    expect(fixed).toMatch(/^• Cleaning agents for various applications,/m);
    expect(fixed).toMatch(/Bio Microbiological cleaning line: "100% chemical-free cleaning"/);
    expect(fixed).toMatch(/^• Cleaning materials and accessories$/m);
    expect(fixed).toMatch(/^Meer informatie|^More information/m);
    expect(fixed).toMatch(/^Binnenkort:|^Coming soon:/m);
    expect(fixed.split("\n\n").length).toBeGreaterThanOrEqual(4);
  });
});

describe("createContentAiService", () => {
  it("generates Dutch copy via provider mock", async () => {
    const complete = vi.fn(async () => ({
      content: JSON.stringify({ text: "Schone werkplekken, elke dag." }),
      model: "mock-model",
    }));
    const provider: ContentAiProvider = {
      id: "groq",
      isConfigured: () => true,
      getStatus: () => ({
        configured: true,
        provider: "groq",
        model: "mock-model",
        promptVersion: CONTENT_AI_PROMPT_VERSION,
      }),
      complete,
    };
    const service = createContentAiService(provider);
    const result = await service.generateDutchCopy({
      brief: "hero heading",
      tone: "catchy",
      maxChars: 120,
    });
    expect(result.text).toContain("Schone");
    expect(result.provenance.generatedBy).toBe("groq");
    expect(complete).toHaveBeenCalledOnce();
  });

  it("translates NL→EN batch", async () => {
    const provider: ContentAiProvider = {
      id: "groq",
      isConfigured: () => true,
      getStatus: () => ({
        configured: true,
        provider: "groq",
        model: "mock",
        promptVersion: CONTENT_AI_PROMPT_VERSION,
      }),
      complete: async () => ({
        content: JSON.stringify({
          fields: { f0: "Professional cleaning", f1: "Reliable partners." },
        }),
        model: "mock",
      }),
    };
    const service = createContentAiService(provider);
    const result = await service.translateNlToEn({
      fields: { heading: "Professionele schoonmaak", body: "Betrouwbare partners." },
    });
    expect(result.fields.heading).toBe("Professional cleaning");
    expect(result.fields.body).toBe("Reliable partners.");
  });

  it("skips provider when all translate fields are blank", async () => {
    const complete = vi.fn(async () => ({ content: "{}", model: "mock" }));
    const provider: ContentAiProvider = {
      id: "groq",
      isConfigured: () => true,
      getStatus: () => ({
        configured: true,
        provider: "groq",
        model: "mock",
        promptVersion: CONTENT_AI_PROMPT_VERSION,
      }),
      complete,
    };
    const service = createContentAiService(provider, { useCache: false });
    const result = await service.translateNlToEn({
      fields: { heading: "   ", body: "" },
    });
    expect(result.fields).toEqual({});
    expect(result.warnings.some((w) => /geen vertaalbare/i.test(w))).toBe(true);
    expect(complete).not.toHaveBeenCalled();
  });

  it("repairs glued separators after NL→EN translation", async () => {
    const nl = '"Titel"\n\nBody tekst.\n____________________';
    const provider: ContentAiProvider = {
      id: "groq",
      isConfigured: () => true,
      getStatus: () => ({
        configured: true,
        provider: "groq",
        model: "mock",
        promptVersion: CONTENT_AI_PROMPT_VERSION,
      }),
      // Multiline NL expands to per-line units (separator not sent).
      complete: async () => ({
        content: JSON.stringify({
          fields: {
            f0: '"Title"',
            f1: "Body text. Progress!",
          },
        }),
        model: "mock",
      }),
    };
    const service = createContentAiService(provider, { useCache: false });
    const result = await service.translateNlToEn({ fields: { notice: nl } });
    expect(result.fields.notice).toMatch(/Progress!\n____________________$/);
    expect(lineSkeletonFingerprint(result.fields.notice!)).toBe(lineSkeletonFingerprint(nl));
  });

  it("translates multiline bodies line-by-line so the skeleton cannot collapse", async () => {
    const nl = [
      "Intro:",
      "• Eén",
      "• Twee",
      "",
      "Slotzin.",
    ].join("\n");
    const complete = vi.fn(async (req: { messages: Array<{ content: string }> }) => {
      const user = req.messages[1]?.content ?? "";
      // Expanded units appear as f0… in the prompt JSON.
      expect(user).toContain('"f0"');
      expect(user).toContain('"f3"');
      expect(user).not.toContain("• Eén\\n• Twee");
      return {
        content: JSON.stringify({
          fields: {
            f0: "Intro:",
            f1: "• One",
            f2: "• Two",
            f3: "Closing.",
          },
        }),
        model: "mock",
      };
    });
    const provider: ContentAiProvider = {
      id: "groq",
      isConfigured: () => true,
      getStatus: () => ({
        configured: true,
        provider: "groq",
        model: "mock",
        promptVersion: CONTENT_AI_PROMPT_VERSION,
      }),
      complete,
    };
    const service = createContentAiService(provider, { useCache: false });
    const result = await service.translateNlToEn({ fields: { body: nl } });
    expect(lineSkeletonFingerprint(result.fields.body!)).toBe(lineSkeletonFingerprint(nl));
    expect(result.fields.body).toBe(["Intro:", "• One", "• Two", "", "Closing."].join("\n"));
  });

  it("rejects empty generate input", async () => {
    const provider: ContentAiProvider = {
      id: "groq",
      isConfigured: () => true,
      getStatus: () => ({
        configured: false,
        provider: "groq",
        model: null,
        promptVersion: CONTENT_AI_PROMPT_VERSION,
      }),
      complete: async () => ({ content: "{}", model: "x" }),
    };
    const service = createContentAiService(provider);
    await expect(service.generateDutchCopy({ tone: "catchy" })).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("generates section NL then translates to EN", async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({
          fields: { title: "Schone werkplekken", body: "McCoy maakt het verschil." },
        }),
        model: "mock-nl",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          fields: { f0: "Clean workplaces", f1: "McCoy makes the difference." },
        }),
        model: "mock-en",
      });
    const provider: ContentAiProvider = {
      id: "groq",
      isConfigured: () => true,
      getStatus: () => ({
        configured: true,
        provider: "groq",
        model: "mock",
        promptVersion: CONTENT_AI_PROMPT_VERSION,
      }),
      complete,
    };
    const service = createContentAiService(provider, { useCache: false });
    const result = await service.generateSectionCopy({
      brief: "hero sectie",
      tone: "catchy",
      fields: {
        title: { fieldHint: "title", maxChars: 80 },
        body: { fieldHint: "body", maxChars: 200 },
      },
    });
    expect(result.nl.title).toContain("Schone");
    expect(result.en.title).toBe("Clean workplaces");
    expect(result.en.body).toContain("difference");
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("cache returns identical section copy for the same input", async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({ fields: { title: "Eerste variant" } }),
        model: "mock-nl",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ fields: { f0: "First variant" } }),
        model: "mock-en",
      });
    const provider: ContentAiProvider = {
      id: "groq",
      isConfigured: () => true,
      getStatus: () => ({
        configured: true,
        provider: "groq",
        model: "mock",
        promptVersion: CONTENT_AI_PROMPT_VERSION,
      }),
      complete,
    };
    const service = createContentAiService(provider, { useCache: true });
    const input = {
      brief: "mijn idee",
      tone: "catchy" as const,
      fields: { title: { currentText: "schone kantoren", fieldHint: "title", maxChars: 80 } },
    };
    const first = await service.generateSectionCopy(input);
    const second = await service.generateSectionCopy(input);
    expect(second.warnings.some((w) => w.includes("Cache-hit"))).toBe(true);
    expect(second.nl).toEqual(first.nl);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("regenerate skips cache and asks the provider again", async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce({
        content: JSON.stringify({ fields: { title: "Eerste variant" } }),
        model: "mock-nl",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ fields: { f0: "First variant" } }),
        model: "mock-en",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ fields: { title: "Tweede variant" } }),
        model: "mock-nl-2",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ fields: { f0: "Second variant" } }),
        model: "mock-en-2",
      });
    const provider: ContentAiProvider = {
      id: "groq",
      isConfigured: () => true,
      getStatus: () => ({
        configured: true,
        provider: "groq",
        model: "mock",
        promptVersion: CONTENT_AI_PROMPT_VERSION,
      }),
      complete,
    };
    const service = createContentAiService(provider, { useCache: true });
    const base = {
      brief: "mijn idee",
      tone: "catchy" as const,
      fields: { title: { currentText: "schone kantoren", fieldHint: "title", maxChars: 80 } },
    };
    const first = await service.generateSectionCopy(base);
    expect(first.nl.title).toBe("Eerste variant");
    expect(complete).toHaveBeenCalledTimes(2);

    const second = await service.generateSectionCopy({
      ...base,
      regenerate: true,
      previousFields: first.nl,
    });
    expect(complete).toHaveBeenCalledTimes(4);
    expect(second.warnings.some((w) => w.includes("Cache-hit"))).toBe(false);
    expect(second.nl.title).toBe("Tweede variant");
    const regenerateUser = String(complete.mock.calls[2]?.[0]?.messages?.[1]?.content ?? "");
    expect(regenerateUser).toContain("mijn idee");
    expect(regenerateUser).toContain("schone kantoren");
    expect(regenerateUser).toContain("Eerste variant");
  });
});
