import {
  FORM_KINDS,
  FORM_SUBJECTS,
  extractFormScopeKeyFromSubject,
  stripFormScopeMarkerFromSubject,
  stripReplyForwardPrefixes,
  type FormKind,
} from "@mccoy/domain";

/**
 * Subject patterns for McCoy website form notification emails.
 * More specific kinds are matched first. Includes Dutch templates and English aliases.
 */
const KIND_SUBJECT_PATTERNS: { kind: FormKind; patterns: RegExp[] }[] = [
  {
    kind: "job_application",
    patterns: [/sollicitatie/i, /job\s*application/i, /\bvacature\b/i],
  },
  {
    kind: "glass_washing",
    patterns: [/glasbewassing/i, /glass\s*washing/i, /offerte\s+glas/i],
  },
  {
    kind: "furniture_cleaning",
    patterns: [
      /meubelreiniging/i,
      /furniture\s*cleaning/i,
      /meubel-?\s*of\s*vloer/i,
      /offerte\s+meubel/i,
    ],
  },
  {
    kind: "inquiry",
    patterns: [
      /algemene\s*aanvraag/i,
      /\binquiry\b/i,
      /algemene\s+contact/i,
      /contactformulier/i,
    ],
  },
];

/** Canonical Dutch subjects used when sending notifications. */
export const FORM_SUBJECT_NEEDLES: string[] = [
  ...Object.values(FORM_SUBJECTS),
  "Inquiry",
  "Glass washing",
  "Furniture cleaning",
  "Job application",
  "Sollicitatie",
];

function subjectForKindMatch(subject: string): string {
  return stripFormScopeMarkerFromSubject(stripReplyForwardPrefixes(subject));
}

export function classifyFormEmailSubject(subject: string | undefined | null): FormKind | null {
  const value = (subject ?? "").trim();
  if (!value) return null;

  const forKind = subjectForKindMatch(value);

  for (const { kind, patterns } of KIND_SUBJECT_PATTERNS) {
    if (patterns.some((re) => re.test(forKind))) {
      return kind;
    }
  }

  const lower = forKind.toLowerCase();
  for (const kind of FORM_KINDS) {
    if (lower.includes(FORM_SUBJECTS[kind].toLowerCase())) {
      return kind;
    }
  }

  return null;
}

export { extractFormScopeKeyFromSubject };

/** Extract human-readable request number (WR-…) when present in subject or body. */
export function extractRequestNumber(...parts: Array<string | undefined | null>): string | null {
  for (const part of parts) {
    if (!part) continue;
    const match = part.match(/\b(WR-[A-Z0-9-]+)\b/i);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

/**
 * Visitor name from subjects like "Algemene aanvraag — Oana Dinescu (WR-…)".
 * Returns null for older emails that only used the form-kind subject.
 */
export function extractSubmitterNameFromSubject(
  subject: string | undefined | null,
): string | null {
  if (!subject?.trim()) return null;
  const cleaned = stripFormScopeMarkerFromSubject(stripReplyForwardPrefixes(subject))
    .replace(/\s*\(WR-[A-Z0-9-]+\)\s*$/i, "")
    .trim();

  for (const base of Object.values(FORM_SUBJECTS)) {
    if (!cleaned.toLowerCase().startsWith(base.toLowerCase())) continue;
    const rest = cleaned
      .slice(base.length)
      .replace(/^\s*[—–-]\s*/, "")
      .trim();
    if (rest.length >= 2 && rest.length <= 120) return rest;
  }
  return null;
}
