import { CONTENT_AI_PROMPT_VERSION, type ContentAiTone, type GenerateDutchCopyInput } from "./types";

const TONE_NL: Record<ContentAiTone, string> = {
  professional: "professioneel en betrouwbaar (B2B schoonmaak / facility)",
  catchy: "pakkend en memorabel, zonder clichés of overdreven hype",
  warm: "warm en uitnodigend, nog steeds zakelijk",
  concise: "kort en krachtig",
};

export function buildGenerateDutchCopyMessages(input: GenerateDutchCopyInput): {
  system: string;
  user: string;
} {
  const tone = input.tone ?? "catchy";
  const maxChars = input.maxChars ?? 280;
  const regenerate = Boolean(input.regenerate);
  const system = [
    "Je bent een Nederlandse copywriter voor McCoy Cleaning (B2B schoonmaakdiensten).",
    "Schrijf alleen in het Nederlands.",
    "Geen HTML, geen markdown, geen emoji.",
    "Geen prijzen, BTW, kortingen of juridische claims verzinnen.",
    `Toon: ${TONE_NL[tone]}.`,
    regenerate
      ? "Dit is een HERGENERATIE: schrijf een duidelijk andere formulering dan eerdere output, met behoud van de kernidee uit briefing/huidige tekst."
      : "",
    `Antwoord UITSLUITEND als JSON: {"text":"..."} met max ${maxChars} tekens in text.`,
    `promptVersion=${CONTENT_AI_PROMPT_VERSION}`,
  ]
    .filter(Boolean)
    .join(" ");

  const parts: string[] = [];
  if (input.fieldHint) parts.push(`Veldtype: ${input.fieldHint}`);
  if (input.brief?.trim()) parts.push(`Briefing / idee van de redacteur: ${input.brief.trim()}`);
  if (input.currentText?.trim()) {
    parts.push(
      regenerate
        ? `Kernidee uit de redacteurstekst (behoud intentie, herschrijf fris):\n${input.currentText.trim()}`
        : `Huidige tekst (verbeter of herschrijf):\n${input.currentText.trim()}`,
    );
  }
  if (regenerate && input.previousText?.trim()) {
    parts.push(
      `Vermijd herhaling — vorige AI-output (niet letterlijk hergebruiken):\n${input.previousText.trim()}`,
    );
  }
  if (parts.length === 0) {
    parts.push("Schrijf een korte, pakkende websitekop voor McCoy Cleaning.");
  }

  return { system, user: parts.join("\n\n") };
}

export function buildGenerateSectionDutchMessages(input: {
  brief?: string;
  tone: ContentAiTone;
  fields: Record<string, { currentText?: string; fieldHint?: string; maxChars?: number }>;
  regenerate?: boolean;
  previousFields?: Record<string, string>;
}): { system: string; user: string } {
  const keys = Object.keys(input.fields);
  const tone = input.tone;
  const regenerate = Boolean(input.regenerate);
  const system = [
    "Je bent een Nederlandse website-copywriter voor McCoy Cleaning (B2B schoonmaakdiensten).",
    "Schrijf pakkende, consistente sectieteksten in het Nederlands.",
    "Geen HTML, geen markdown, geen emoji.",
    "Geen prijzen, BTW, kortingen of juridische claims verzinnen.",
    `Toon: ${TONE_NL[tone]}.`,
    regenerate
      ? "Dit is een HERGENERATIE: lever een duidelijk andere variant dan de vorige AI-output, met behoud van briefing en redacteuridee."
      : "",
    `Antwoord UITSLUITEND als JSON: {"fields":{${keys.map((k) => `"${k}":"..."`).join(",")}}}`,
    "Respecteer maxChars per veld wanneer opgegeven.",
    `promptVersion=${CONTENT_AI_PROMPT_VERSION}`,
  ]
    .filter(Boolean)
    .join(" ");

  const fieldLines = keys.map((key) => {
    const spec = input.fields[key]!;
    const parts = [`- ${key}`];
    if (spec.fieldHint) parts.push(`rol: ${spec.fieldHint}`);
    if (spec.maxChars) parts.push(`max ${spec.maxChars} tekens`);
    if (spec.currentText?.trim()) {
      parts.push(
        regenerate
          ? `idee redacteur: ${spec.currentText.trim()}`
          : `huidig: ${spec.currentText.trim()}`,
      );
    } else {
      parts.push("huidig: (leeg — schrijf nieuw)");
    }
    const prev = input.previousFields?.[key]?.trim();
    if (regenerate && prev) {
      parts.push(`vermijd herhaling van: ${prev}`);
    }
    return parts.join(" | ");
  });

  const userParts = [
    input.brief?.trim()
      ? `Briefing / idee van de redacteur: ${input.brief.trim()}`
      : "Briefing: schrijf pakkende website-copy voor deze sectie.",
    "Velden:",
    ...fieldLines,
  ];
  return { system, user: userParts.join("\n") };
}

export function buildTranslateNlToEnMessages(input: {
  fields: Record<string, string>;
  preserveTerms?: string[];
  maxCharsPerField: number;
}): { system: string; user: string } {
  const keys = Object.keys(input.fields);
  const system = [
    "You are a professional NL→EN translator for McCoy Cleaning (B2B cleaning services).",
    "Translate faithfully; keep meaning, tone, and CTA intent.",
    "Do not invent prices, VAT, discounts, or legal claims.",
    "No HTML, no markdown, no emoji.",
    "Keep brand names unchanged: McCoy, McCoy Cleaning.",
    input.preserveTerms?.length
      ? `Also preserve these terms unchanged: ${input.preserveTerms.join(", ")}.`
      : "",
    `Return ONLY JSON: {"fields":{${keys.map((k) => `"${k}":"..."`).join(",")}}}`,
    `Each value max ${input.maxCharsPerField} characters.`,
    `promptVersion=${CONTENT_AI_PROMPT_VERSION}`,
  ]
    .filter(Boolean)
    .join(" ");

  const user = `Translate these Dutch CMS fields to English:\n${JSON.stringify(input.fields, null, 2)}`;
  return { system, user };
}
