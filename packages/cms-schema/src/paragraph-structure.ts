/**
 * Keep NL/EN multiline CMS fields on the same blank-line paragraph structure.
 * Bodies stay language-specific; only separator structure is mirrored from NL → EN.
 */

/** Non-empty paragraphs separated by one or more blank lines. */
export function splitCmsParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * How many blank lines NL uses between consecutive non-empty paragraphs.
 * Index i is the gap between paragraph i and i+1 (minimum 1).
 */
export function paragraphGapSizes(text: string): number[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "");
  if (!normalized.trim()) return [];
  const tokens = normalized.split(/(\n{2,})/);
  const gaps: number[] = [];
  for (let i = 1; i < tokens.length; i += 2) {
    const sep = tokens[i] ?? "\n\n";
    const newlineCount = (sep.match(/\n/g) ?? []).length;
    gaps.push(Math.max(1, newlineCount - 1));
  }
  return gaps;
}

function joinWithGaps(paragraphs: string[], gaps: number[]): string {
  if (paragraphs.length === 0) return "";
  let out = paragraphs[0]!;
  for (let i = 1; i < paragraphs.length; i++) {
    const gap = gaps[i - 1] ?? 1;
    out += "\n".repeat(gap + 1) + paragraphs[i]!;
  }
  return out;
}

function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+(?:[.!?]+(?:\s+|$)|$)/g);
  if (!matches) return text.trim() ? [text.trim()] : [];
  return matches.map((part) => part.trim()).filter(Boolean);
}

/**
 * Re-shape `contentTarget` so it uses the same blank-line paragraph structure as
 * `structureSource`. Paragraph copy is taken from `contentTarget` in order.
 */
export function syncParagraphStructure(structureSource: string, contentTarget: string): string {
  const structureParas = splitCmsParagraphs(structureSource);
  const hardParas = splitCmsParagraphs(contentTarget);
  const softParas = contentTarget
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  // Prefer blank-line splits; fall back to single-newline lines when EN was
  // stored as one block with ordinary line breaks.
  const contentParas =
    hardParas.length >= structureParas.length
      ? hardParas
      : softParas.length >= structureParas.length
        ? softParas
        : hardParas.length > 0
          ? hardParas
          : softParas;
  const gaps = paragraphGapSizes(structureSource);

  if (structureParas.length <= 1 || contentParas.length === 0) {
    return contentTarget;
  }

  let bodies = [...contentParas];

  if (bodies.length > structureParas.length) {
    const head = bodies.slice(0, structureParas.length - 1);
    const tail = bodies.slice(structureParas.length - 1).join(" ");
    bodies = [...head, tail];
  } else if (bodies.length < structureParas.length) {
    while (bodies.length < structureParas.length) {
      const lastIndex = bodies.length - 1;
      const last = bodies[lastIndex] ?? "";
      const sentences = splitIntoSentences(last);
      if (sentences.length < 2) break;
      const moved = sentences.pop()!;
      bodies[lastIndex] = sentences.join(" ").trim();
      bodies.push(moved);
    }
  }

  // If we still can't match counts, fall back to equal `\n\n` joins on what we have.
  if (bodies.length !== structureParas.length) {
    return bodies.join("\n\n");
  }

  return joinWithGaps(bodies, gaps);
}

/** True when either side uses multi-paragraph blank-line structure. */
export function shouldSyncParagraphStructure(structureSource: string, contentTarget: string): boolean {
  return splitCmsParagraphs(structureSource).length > 1 || splitCmsParagraphs(contentTarget).length > 1;
}
