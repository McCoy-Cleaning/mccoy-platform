import { CONTENT_AI_PROMPT_VERSION, type ContentAiTone, type GenerateDutchCopyInput } from "./types";

const TONE_NL: Record<ContentAiTone, string> = {
  professional: "professioneel en betrouwbaar (B2B schoonmaak / facility)",
  catchy: "pakkend en memorabel, zonder clichés of overdreven hype",
  warm: "warm en uitnodigend, nog steeds zakelijk",
  concise: "kort en krachtig",
};

const BRAND_VOICE = [
  "Merkstem McCoy Cleaning: premium B2B, vast eigen team, vakmanschap, Twente/Nederland, zichtbaar resultaat.",
  "Schrijf concreet en geloofwaardig — liever één scherp voordeel dan vage superlatieven.",
  "Vermijd clichés zoals 'uw partner in schoonmaak', 'kwaliteit staat voorop', 'alles-in-één oplossing', 'wij gaan een stap verder'.",
  "Geen HTML, geen markdown, geen emoji, geen aanhalingstekens om de hele zin.",
  "Geen prijzen, BTW, kortingen, garanties of juridische claims verzinnen.",
  "Gebruik 'u/uw' (niet 'je/jij') tenzij de briefing expliciet informeel vraagt.",
].join(" ");

/** Role-specific length and style cues for CMS field keys / hints. */
export function fieldRoleGuidance(fieldHintOrKey: string | undefined): string {
  const key = (fieldHintOrKey ?? "").toLowerCase();
  if (!key) return "Schrijf natuurlijke website-copy die past bij het veld.";
  if (/(eyebrow|kicker|label)/.test(key)) {
    return "Eyebrow/kicker: 2–5 woorden, labelachtig, geen zin met punt, geen uitroepteken.";
  }
  if (/(headingaccent|titleaccent|accent)/.test(key)) {
    return "Heading-accent: kort zinsdeel of 1–3 woorden die de kop afronden; geen volledige zin.";
  }
  if (/(heading|title|kop)/.test(key)) {
    return "Kop: scherp en scannbaar, bij voorkeur één zin of zinsdeel, geen slogan-stapeling.";
  }
  if (/(body|sub|tekst|description|beschrijving)/.test(key)) {
    return "Lopende tekst: 1–3 zinnen, voordeelgericht, concreet; geen herhaling van de kop.";
  }
  if (/(cta|button|knop)/.test(key)) {
    return "CTA: 2–5 woorden, werkwoord eerst (bijv. 'Vraag een offerte'), geen uitroepteken.";
  }
  if (/(caption|bijschrift)/.test(key)) {
    return "Bijschrift: kort, informatief, geen marketing-hype.";
  }
  return "Schrijf natuurlijke website-copy die past bij de rol van dit veld.";
}

export function buildGenerateDutchCopyMessages(input: GenerateDutchCopyInput): {
  system: string;
  user: string;
} {
  const tone = input.tone ?? "catchy";
  const maxChars = input.maxChars ?? 280;
  const regenerate = Boolean(input.regenerate);
  const system = [
    "Je bent senior Nederlandse website-copywriter voor McCoy Cleaning.",
    BRAND_VOICE,
    `Toon: ${TONE_NL[tone]}.`,
    fieldRoleGuidance(input.fieldHint),
    regenerate
      ? "Dit is een HERGENERATIE: schrijf een duidelijk andere formulering dan eerdere output, met behoud van de kernidee uit briefing/huidige tekst."
      : "Verbeter of schrijf nieuw: behoud feiten uit de briefing; vul geen ontbrekende feiten in.",
    "Als de briefing dun is: schrijf generieke maar sterke McCoy-copy zonder verzonnen klantnamen, cijfers of locaties.",
    `Antwoord UITSLUITEND als JSON: {"text":"..."} met max ${maxChars} tekens in text.`,
    `promptVersion=${CONTENT_AI_PROMPT_VERSION}`,
  ]
    .filter(Boolean)
    .join(" ");

  const parts: string[] = [];
  if (input.fieldHint) parts.push(`Veldtype: ${input.fieldHint}`);
  if (input.brief?.trim()) parts.push(`Briefing / idee van de redacteur:\n${input.brief.trim()}`);
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
  parts.push(
    "Prioriteit: duidelijkheid > creativiteit. Gebruik concrete details uit de briefing; verzin niets erbij.",
  );

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
    "Je bent senior Nederlandse website-copywriter voor McCoy Cleaning.",
    "Schrijf een coherente sectie: alle velden horen bij elkaar (zelfde onderwerp, toon en belofte).",
    BRAND_VOICE,
    `Toon: ${TONE_NL[tone]}.`,
    "Eyebrow/kicker kort; kop scannbaar; body ondersteunt zonder de kop te herhalen; CTA werkwoordgericht indien aanwezig.",
    regenerate
      ? "Dit is een HERGENERATIE: lever een duidelijk andere variant dan de vorige AI-output, met behoud van briefing en redacteuridee."
      : "Gebruik briefing + bestaande veldideeën als bron van waarheid; verzin geen feiten, cijfers of klantnamen.",
    `Antwoord UITSLUITEND als JSON: {"fields":{${keys.map((k) => `"${k}":"..."`).join(",")}}}`,
    "Respecteer maxChars per veld strikt. Geen lege strings.",
    `promptVersion=${CONTENT_AI_PROMPT_VERSION}`,
  ]
    .filter(Boolean)
    .join(" ");

  const fieldLines = keys.map((key) => {
    const spec = input.fields[key]!;
    const hint = spec.fieldHint ?? key;
    const parts = [`- ${key}`, `rol: ${hint}`, fieldRoleGuidance(hint)];
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
      ? `Briefing / idee van de redacteur:\n${input.brief.trim()}`
      : "Briefing: schrijf sterke, concrete website-copy voor deze McCoy-sectie (geen verzonnen details).",
    "Velden:",
    ...fieldLines,
    "Controleer intern: geen herhaling tussen kop en body; geen clichés; alle velden in het Nederlands.",
  ];
  return { system, user: userParts.join("\n") };
}

/**
 * Map long CMS draft paths (`section:home.hero:columns.0.title`) to short
 * aliases (`f0`…) so the model JSON schema stays simple and less error-prone.
 */
export function aliasTranslateFields(fields: Record<string, string>): {
  aliased: Record<string, string>;
  aliasToKey: Record<string, string>;
  keyToAlias: Record<string, string>;
} {
  const keys = Object.keys(fields);
  const aliasToKey: Record<string, string> = {};
  const keyToAlias: Record<string, string> = {};
  const aliased: Record<string, string> = {};
  keys.forEach((key, index) => {
    const alias = `f${index}`;
    aliasToKey[alias] = key;
    keyToAlias[key] = alias;
    aliased[alias] = fields[key]!;
  });
  return { aliased, aliasToKey, keyToAlias };
}

export function remapAliasedFields(
  aliasedFields: Record<string, string>,
  aliasToKey: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [alias, value] of Object.entries(aliasedFields)) {
    const key = aliasToKey[alias] ?? alias;
    out[key] = value;
  }
  return out;
}

export function buildTranslateNlToEnMessages(input: {
  fields: Record<string, string>;
  preserveTerms?: string[];
  maxCharsPerField: number;
  /** Prefer short f0… aliases for JSON stability with long CMS paths. */
  useFieldAliases?: boolean;
}): { system: string; user: string; aliasToKey: Record<string, string> } {
  const useAliases = input.useFieldAliases !== false;
  const { aliased, aliasToKey } = useAliases
    ? aliasTranslateFields(input.fields)
    : {
        aliased: input.fields,
        aliasToKey: Object.fromEntries(Object.keys(input.fields).map((k) => [k, k])),
      };
  const keys = Object.keys(aliased);
  const system = [
    "You are a professional NL→EN translator for McCoy Cleaning (B2B cleaning services).",
    "Translate faithfully; keep meaning, tone, and CTA intent.",
    "Prefer natural marketing English over literal word-for-word translation.",
    "Do not invent prices, VAT, discounts, or legal claims.",
    "No HTML, no markdown, no emoji, no code fences.",
    "Keep brand names unchanged: McCoy, McCoy Cleaning.",
    // Structure is part of CMS plain-text layout (whitespace-pre-line); only translate words.
    "STRUCTURE LOCK — identical pagination to Dutch; translate words only:",
    "Multiline CMS text is often split into one JSON field per source line. Never merge fields or glue bullet/subheading lines together.",
    "Each value must keep the same line count as its Dutch source (same number of \\n sequences). Do not reflow into fewer lines.",
    "Preserve bullet markers (•), quotation marks („ “ \" ' « »), and leading/trailing spaces on that line.",
    "Preserve decorative separator lines (underscores/dashes) as their own line(s) — never glue them onto the last sentence.",
    "Do not flatten blank lines, subheadings, or list items into one dense paragraph.",
    input.preserveTerms?.length
      ? `Also preserve these terms unchanged: ${input.preserveTerms.join(", ")}.`
      : "",
    // Short f0… keys avoid colon/dot CMS paths breaking weaker JSON generators.
    `Return ONLY a single JSON object: {"fields":{${keys.map((k) => `"${k}":"..."`).join(",")}}}`,
    "Use exactly these field keys. Every key must be present with a non-empty string.",
    "Prefer a single line per value unless the Dutch value itself contains \\n (then encode those as \\n).",
    `Each value max ${input.maxCharsPerField} characters.`,
    `promptVersion=${CONTENT_AI_PROMPT_VERSION}`,
  ]
    .filter(Boolean)
    .join(" ");

  const user = `Translate these Dutch CMS fields to English (keys are stable aliases). Keep each value's line breaks, bullets, quotes, and separators identical to the Dutch source — same line skeleton:\n${JSON.stringify(aliased, null, 2)}`;
  return { system, user, aliasToKey };
}

