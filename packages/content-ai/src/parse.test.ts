import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  extractJsonObject,
  parseFieldsResult,
  parseTextResult,
  sanitizePlainText,
  stripModelWrappers,
} from "./parse";
import { globalContentAiCache } from "./cache";
import { createContentAiService } from "./service";
import type { ContentAiProvider } from "./types";

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
        promptVersion: "v1",
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
        promptVersion: "v1",
      }),
      complete: async () => ({
        content: JSON.stringify({
          fields: { heading: "Professional cleaning", body: "Reliable partners." },
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

  it("rejects empty generate input", async () => {
    const provider: ContentAiProvider = {
      id: "groq",
      isConfigured: () => true,
      getStatus: () => ({
        configured: false,
        provider: "groq",
        model: null,
        promptVersion: "v1",
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
          fields: { title: "Clean workplaces", body: "McCoy makes the difference." },
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
        promptVersion: "v1",
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
        content: JSON.stringify({ fields: { title: "First variant" } }),
        model: "mock-en",
      });
    const provider: ContentAiProvider = {
      id: "groq",
      isConfigured: () => true,
      getStatus: () => ({
        configured: true,
        provider: "groq",
        model: "mock",
        promptVersion: "v1",
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
        content: JSON.stringify({ fields: { title: "First variant" } }),
        model: "mock-en",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ fields: { title: "Tweede variant" } }),
        model: "mock-nl-2",
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ fields: { title: "Second variant" } }),
        model: "mock-en-2",
      });
    const provider: ContentAiProvider = {
      id: "groq",
      isConfigured: () => true,
      getStatus: () => ({
        configured: true,
        provider: "groq",
        model: "mock",
        promptVersion: "v1",
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
