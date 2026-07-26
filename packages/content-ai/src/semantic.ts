import { z } from "zod";

/**
 * E4 — Semantic preservation warnings (never auto-truncate; never block publish).
 */
export type SemanticCheckResult = {
  ok: boolean;
  warnings: string[];
  score: number;
};

const NUMBER_RE = /\d+(?:[.,]\d+)?%?/g;
const URL_RE = /https?:\/\/[^\s]+/gi;

export function extractAnchors(text: string): { numbers: string[]; urls: string[] } {
  return {
    numbers: text.match(NUMBER_RE) ?? [],
    urls: text.match(URL_RE) ?? [],
  };
}

/**
 * Lightweight semantic check: preserve numbers/URLs; flag drastic length changes.
 */
export function checkSemanticPreservation(input: {
  source: string;
  target: string;
  maxShrinkRatio?: number;
  maxGrowRatio?: number;
}): SemanticCheckResult {
  const warnings: string[] = [];
  const source = input.source.trim();
  const target = input.target.trim();
  if (!source || !target) {
    return { ok: false, warnings: ["Bron of vertaling ontbreekt."], score: 0 };
  }

  const srcAnchors = extractAnchors(source);
  const tgtAnchors = extractAnchors(target);

  for (const n of srcAnchors.numbers) {
    if (!tgtAnchors.numbers.includes(n)) {
      warnings.push(`Getal/percentage mogelijk verloren: ${n}`);
    }
  }
  for (const u of srcAnchors.urls) {
    if (!tgtAnchors.urls.includes(u)) {
      warnings.push(`URL mogelijk verloren: ${u}`);
    }
  }

  const shrink = input.maxShrinkRatio ?? 0.35;
  const grow = input.maxGrowRatio ?? 2.5;
  const ratio = target.length / Math.max(1, source.length);
  if (ratio < shrink) {
    warnings.push("Vertaling is veel korter dan de bron — controleer inhoud.");
  }
  if (ratio > grow) {
    warnings.push("Vertaling is veel langer dan de bron — controleer op toevoegingen.");
  }

  // Soft score 0–1
  let score = 1;
  score -= warnings.length * 0.15;
  score = Math.max(0, Math.min(1, score));

  return {
    ok: warnings.length === 0,
    warnings,
    score,
  };
}

export const semanticCheckInputSchema = z.object({
  source: z.string().min(1).max(8000),
  target: z.string().min(1).max(8000),
});
