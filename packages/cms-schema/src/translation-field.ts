/**
 * Field-level EN translation classifier + shared locale resolver.
 *
 * Contract: an empty/whitespace English overlay without explicit intentional_blank
 * is treated as missing and must fall back to the Dutch source at render time.
 *
 * Clearing an EN override in the editor sets `override_removed`: NL fallback at
 * render until the next Opslaan (or “vertaal ontbrekende”), which treats empty
 * `override_removed` as translate-eligible so stuck clears are repaired without
 * another clear. Intentional blank is a separate action (render empty EN, not
 * NL fallback; never auto-filled).
 */

export type TranslationFieldState =
  | "not_translatable"
  | "source_empty"
  | "missing"
  | "blank"
  | "machine_translated"
  | "manually_translated"
  | "intentional_blank"
  | "override_removed"
  | "stale"
  | "invalid";

export type TranslationFieldStatus =
  | "machine_translated"
  | "manually_translated"
  | "intentional_blank"
  | "translation_pending"
  | "translation_failed"
  /** Editor cleared EN overlay — use NL at render; Opslaan may refill when draft empty. */
  | "override_removed";

export type TranslationFieldMetadata = {
  status: TranslationFieldStatus;
  sourceHash?: string;
  translatedAt?: string;
  translatedBy?: string;
  provider?: string;
  /** Last provider attempt for cooldown/deduplication of an empty EN field. */
  attemptSourceHash?: string;
  attemptedAt?: string;
  attemptErrorCode?: string;
};

export type TranslationFieldInput = {
  path: string;
  sourceLocale: "nl";
  targetLocale: "en";
  sourceValue: unknown;
  targetValue: unknown;
  sourceHash?: string;
  translatedSourceHash?: string;
  metadata?: TranslationFieldMetadata;
  /** When false, field is excluded from coverage/translation. */
  translatable?: boolean;
};

export type ResolveLocalizedFieldInput = {
  sourceValue: unknown;
  translatedValue: unknown;
  metadata?: TranslationFieldMetadata;
  sourceHash?: string;
  translatedSourceHash?: string;
  fallbackToSource: boolean;
};

export type ResolveLocalizedFieldResult = {
  value: unknown;
  state: TranslationFieldState;
  usedFallback: boolean;
};

function asTrimmedString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  return value.trim();
}

export function isBlankTranslationValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "string") return false;
  return value.trim() === "";
}

export function isValidNonEmptyTranslationValue(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Deterministic hash of normalized source text for stale detection. */
export function createTranslationSourceHash(normalizedSourceValue: unknown): string {
  const text =
    typeof normalizedSourceValue === "string"
      ? normalizedSourceValue.trim()
      : normalizedSourceValue == null
        ? ""
        : JSON.stringify(normalizedSourceValue);
  // FNV-1a 32-bit — stable, sync, no crypto dependency in browser bundles.
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function classifyTranslationField(input: TranslationFieldInput): TranslationFieldState {
  if (input.translatable === false) return "not_translatable";

  const source = asTrimmedString(input.sourceValue);
  if (source == null && input.sourceValue != null && typeof input.sourceValue !== "string") {
    return "invalid";
  }

  if (input.metadata?.status === "intentional_blank") {
    return "intentional_blank";
  }

  if (input.targetValue != null && typeof input.targetValue !== "string") {
    return "invalid";
  }

  const target = asTrimmedString(input.targetValue);

  // Empty NL: nothing to translate for coverage — but a stored non-empty EN draft
  // must still win at render (optional gallery/feature bodies, editor-only EN, etc.).
  if (!source) {
    if (!target) return "source_empty";
    if (input.metadata?.status === "manually_translated") return "manually_translated";
    if (input.metadata?.status === "machine_translated") return "machine_translated";
    return "machine_translated";
  }

  // Cleared override: no EN text → NL fallback at render; coverage still flags it
  // so Opslaan / translate-missing can refill without another clear.
  // If a non-empty EN is present again, classify the live value instead.
  if (input.metadata?.status === "override_removed" && (!target || target === source)) {
    return "override_removed";
  }

  if (input.targetValue === undefined) return "missing";
  if (target == null || target === "") return "blank";

  const sourceHash = input.sourceHash ?? createTranslationSourceHash(source);
  const translatedHash = input.translatedSourceHash ?? input.metadata?.sourceHash;
  if (translatedHash && translatedHash !== sourceHash) {
    return "stale";
  }

  if (input.metadata?.status === "manually_translated") {
    return "manually_translated";
  }
  if (input.metadata?.status === "machine_translated") {
    return "machine_translated";
  }
  // Any non-empty EN is protected, including a deliberate source echo.
  return "machine_translated";
}

/**
 * Canonical field resolver for preview + storefront.
 * Blank EN without intentional_blank → Dutch fallback when fallbackToSource.
 */
export function resolveLocalizedField(
  input: ResolveLocalizedFieldInput,
): ResolveLocalizedFieldResult {
  const state = classifyTranslationField({
    path: "",
    sourceLocale: "nl",
    targetLocale: "en",
    sourceValue: input.sourceValue,
    targetValue: input.translatedValue,
    sourceHash: input.sourceHash,
    translatedSourceHash: input.translatedSourceHash,
    metadata: input.metadata,
  });

  if (state === "intentional_blank") {
    return { value: "", state, usedFallback: false };
  }

  if (state === "override_removed") {
    if (input.fallbackToSource) {
      return { value: input.sourceValue ?? "", state, usedFallback: true };
    }
    return { value: "", state, usedFallback: false };
  }

  if (state === "machine_translated" || state === "manually_translated" || state === "stale") {
    return {
      value: typeof input.translatedValue === "string" ? input.translatedValue : input.sourceValue,
      state,
      usedFallback: false,
    };
  }

  if (state === "invalid") {
    return {
      value: input.fallbackToSource ? input.sourceValue : "",
      state,
      usedFallback: input.fallbackToSource,
    };
  }

  // missing | blank | source_empty | not_translatable
  // source_empty: skip overlay writes (preserve null/absent NL); do not invent "".
  if (state === "source_empty") {
    return {
      value: input.sourceValue ?? "",
      state,
      usedFallback: true,
    };
  }
  if (input.fallbackToSource) {
    return { value: input.sourceValue ?? "", state, usedFallback: true };
  }
  return { value: "", state, usedFallback: false };
}

/** True when EN publication / coverage should require a translation. */
export function translationFieldRequiresEnglish(state: TranslationFieldState): boolean {
  return state === "missing" || state === "blank" || state === "invalid" || state === "stale";
}

/** States that count as “resolved” for coverage completeness. */
export function translationFieldIsResolved(state: TranslationFieldState): boolean {
  return (
    state === "not_translatable" ||
    state === "source_empty" ||
    state === "machine_translated" ||
    state === "manually_translated" ||
    state === "intentional_blank" ||
    state === "override_removed"
  );
}

/**
 * Resolve a draft path onto its canonical key and collect index/colon aliases
 * that must be purged together (otherwise lookup can resurrect a cleared EN).
 */
export function relatedEnFieldDraftKeys(
  path: string,
  aliases: Record<string, string> = {},
): { canonical: string; related: string[] } {
  const canonical = aliases[path] ?? path;
  const related = new Set<string>([path, canonical]);
  for (const [alias, canon] of Object.entries(aliases)) {
    if (canon === canonical || alias === canonical) related.add(alias);
  }
  return { canonical, related: [...related] };
}

/**
 * Apply an editor EN draft patch with meta side-effects:
 * - blank after a non-empty EN draft → delete draft/source keys and mark
 *   `override_removed` (NL fallback until Opslaan / translate-missing refills)
 * - blank when every alias draft is already empty (including stuck
 *   `override_removed`) → delete meta so the field is `missing` again
 * - non-blank → keep draft (raw editor value, including trailing spaces while typing),
 *   pin NL source, mark `manually_translated`. Trim is only used to detect blank.
 *
 * When `aliases` is provided (alias → canonical), clears/writes also purge sibling
 * index/colon keys so ghost EN drafts cannot snap the editor value back.
 */
export function applyEnFieldDraftEditorPatch(input: {
  drafts?: Record<string, string>;
  sources?: Record<string, string>;
  meta?: Record<string, TranslationFieldMetadata>;
  patch: Record<string, string>;
  nlFields?: Record<string, string>;
  /** Full draft path alias → canonical full path (from collectPageNlFieldDraftCollection). */
  aliases?: Record<string, string>;
}): {
  enFieldDrafts: Record<string, string>;
  enFieldDraftSources: Record<string, string>;
  enFieldDraftMeta: Record<string, TranslationFieldMetadata>;
} {
  const enFieldDrafts = { ...(input.drafts ?? {}) };
  const enFieldDraftSources = { ...(input.sources ?? {}) };
  const enFieldDraftMeta = { ...(input.meta ?? {}) };
  const nlFields = input.nlFields ?? {};
  const aliases = input.aliases ?? {};

  for (const [key, value] of Object.entries(input.patch)) {
    const trimmed = value.trim();
    const { canonical, related } = relatedEnFieldDraftKeys(key, aliases);
    // Also sweep draft/meta keys that alias onto the same canonical even if they
    // were missing from the related set (stale/partial alias maps).
    const sweep = new Set<string>(related);
    for (const draftKey of Object.keys(enFieldDrafts)) {
      if ((aliases[draftKey] ?? draftKey) === canonical) sweep.add(draftKey);
    }
    for (const metaKey of Object.keys(enFieldDraftMeta)) {
      if ((aliases[metaKey] ?? metaKey) === canonical) sweep.add(metaKey);
    }
    if (!trimmed) {
      // Intentional clear only when a prior non-empty EN draft existed.
      // Stuck `override_removed` on an already-empty draft must become `missing`
      // so Opslaan can auto-fill again. Never keep override_removed solely because
      // meta was already that status (that was the gallery stuck-meta bug).
      let hadNonEmptyDraft = false;
      let hadIntentionalBlank = false;
      for (const path of sweep) {
        if ((enFieldDrafts[path] ?? "").trim()) hadNonEmptyDraft = true;
        if (enFieldDraftMeta[path]?.status === "intentional_blank") {
          hadIntentionalBlank = true;
        }
      }
      for (const path of sweep) {
        delete enFieldDrafts[path];
        delete enFieldDraftSources[path];
        if (hadNonEmptyDraft) {
          // Keep override_removed on every related key so index-path lookups cannot
          // miss a canonical-only meta and resurrect a ghost draft.
          enFieldDraftMeta[path] = { status: "override_removed" };
        } else if (hadIntentionalBlank) {
          enFieldDraftMeta[path] = { status: "intentional_blank" };
        } else {
          delete enFieldDraftMeta[path];
        }
      }
      if (hadNonEmptyDraft) {
        enFieldDraftMeta[canonical] = { status: "override_removed" };
      } else if (hadIntentionalBlank) {
        enFieldDraftMeta[canonical] = { status: "intentional_blank" };
      } else {
        delete enFieldDraftMeta[canonical];
      }
    } else {
      for (const path of sweep) {
        if (path !== canonical) {
          delete enFieldDrafts[path];
          delete enFieldDraftSources[path];
          delete enFieldDraftMeta[path];
        }
      }
      // Preserve raw editor value (incl. trailing spaces) so Space while typing works
      // in controlled EN textareas. Blank detection still uses trim above.
      enFieldDrafts[canonical] = value;
      const nl = (nlFields[canonical] ?? nlFields[key])?.trim();
      if (nl) enFieldDraftSources[canonical] = nl;
      else delete enFieldDraftSources[canonical];
      enFieldDraftMeta[canonical] = {
        status: "manually_translated",
        sourceHash: nl ? createTranslationSourceHash(nl) : undefined,
        translatedAt: new Date().toISOString(),
      };
    }
  }

  return { enFieldDrafts, enFieldDraftSources, enFieldDraftMeta };
}
