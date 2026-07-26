/**
 * Strip common LLM wrappers (markdown fences, leading labels) and return plain text.
 */
export function stripModelWrappers(raw: string): string {
  let text = raw.trim();
  if (!text) return "";

  // ```json ... ``` or ``` ... ```
  const fence = /^```(?:json|text|markdown)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i.exec(text);
  if (fence?.[1]) {
    text = fence[1].trim();
  }

  // Remove zero-width / BOM
  text = text.replace(/^\uFEFF/, "").replace(/[\u200B-\u200D\uFEFF]/g, "");
  return text.trim();
}

/** Remove HTML tags and collapse whitespace for CMS plain-text fields. */
export function sanitizePlainText(raw: string, maxChars: number): string {
  let text = stripModelWrappers(raw);
  text = text.replace(/<[^>]*>/g, " ");
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Collapse 3+ newlines to 2
  text = text.replace(/\n{3,}/g, "\n\n");
  // Collapse horizontal whitespace (keep newlines)
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
  if (text.length > maxChars) {
    text = text.slice(0, maxChars).trimEnd();
  }
  return text;
}

/**
 * Parse a JSON object from model output. Tolerates leading/trailing prose
 * by extracting the first `{...}` block when needed.
 */
export function extractJsonObject(raw: string): unknown {
  const cleaned = stripModelWrappers(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Model output is not valid JSON");
  }
}

export function parseTextResult(raw: string, maxChars: number): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  let text = "";

  try {
    const parsed = extractJsonObject(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.text === "string") {
        text = obj.text;
      } else if (typeof obj.copy === "string") {
        text = obj.copy;
      }
    }
  } catch {
    // Fall back to plain text
    text = raw;
    warnings.push("Model gaf geen JSON terug; platte tekst gebruikt.");
  }

  const sanitized = sanitizePlainText(text, maxChars);
  if (!sanitized) {
    throw new Error("Lege AI-output na opschonen");
  }
  if (sanitized.length < text.trim().length) {
    warnings.push(`Tekst ingekort tot ${maxChars} tekens.`);
  }
  return { text: sanitized, warnings };
}

export function parseFieldsResult(
  raw: string,
  expectedKeys: string[],
  maxCharsPerField: number,
): { fields: Record<string, string>; warnings: string[] } {
  const warnings: string[] = [];
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Verwacht een JSON-object met fields");
  }
  const obj = parsed as Record<string, unknown>;
  const bag =
    obj.fields && typeof obj.fields === "object" && !Array.isArray(obj.fields)
      ? (obj.fields as Record<string, unknown>)
      : obj;

  const fields: Record<string, string> = {};
  for (const key of expectedKeys) {
    const value = bag[key];
    if (typeof value !== "string" || !value.trim()) {
      warnings.push(`Veld "${key}" ontbreekt in AI-output.`);
      continue;
    }
    const sanitized = sanitizePlainText(value, maxCharsPerField);
    if (!sanitized) {
      warnings.push(`Veld "${key}" was leeg na opschonen.`);
      continue;
    }
    fields[key] = sanitized;
  }

  if (Object.keys(fields).length === 0) {
    throw new Error("Geen vertaalbare velden in AI-output");
  }
  return { fields, warnings };
}
