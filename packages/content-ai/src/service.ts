import { recordContentAiAudit } from "./audit";
import { globalContentAiCache } from "./cache";
import { hashSourcePayload } from "./hash";
import {
  collapseLineUnitsToFields,
  estimateTranslateMaxTokens,
  expandFieldsToLineUnits,
  parseFieldsResult,
  parseTextResult,
  preserveTranslatedFieldStructure,
  sanitizePlainText,
} from "./parse";
import {
  buildGenerateDutchCopyMessages,
  buildGenerateSectionDutchMessages,
  buildTranslateNlToEnMessages,
} from "./prompts";
import { createGroqProviderFromEnv } from "./providers/groq";
import { checkSemanticPreservation } from "./semantic";
import {
  ContentAiError,
  CONTENT_AI_PROMPT_VERSION,
  generateDutchCopyInputSchema,
  generateSectionCopyInputSchema,
  translateNlToEnInputSchema,
  type ContentAiProvider,
  type ContentAiStatus,
  type GenerateDutchCopyInput,
  type GenerateDutchCopyResult,
  type GenerateSectionCopyInput,
  type GenerateSectionCopyResult,
  type TranslateNlToEnInput,
  type TranslateNlToEnResult,
} from "./types";

export type ContentAiServiceOptions = {
  actorUsername?: string;
  pageId?: string;
  useCache?: boolean;
};

export type ContentAiService = {
  getStatus(): ContentAiStatus;
  generateDutchCopy(input: GenerateDutchCopyInput): Promise<GenerateDutchCopyResult>;
  translateNlToEn(input: TranslateNlToEnInput): Promise<TranslateNlToEnResult>;
  generateSectionCopy(input: GenerateSectionCopyInput): Promise<GenerateSectionCopyResult>;
};

export function createContentAiService(
  provider: ContentAiProvider,
  options: ContentAiServiceOptions = {},
): ContentAiService {
  const useCache = options.useCache !== false;

  return {
    getStatus() {
      return provider.getStatus();
    },

    async generateDutchCopy(rawInput) {
      const input = generateDutchCopyInputSchema.parse(rawInput);
      if (!input.brief?.trim() && !input.currentText?.trim()) {
        throw new ContentAiError(
          "validation",
          "Geef een briefing of huidige tekst om te verbeteren.",
        );
      }

      const regenerate = Boolean(input.regenerate);
      const sourceHash = hashSourcePayload({
        brief: input.brief ?? "",
        currentText: input.currentText ?? "",
        fieldHint: input.fieldHint ?? "",
        tone: input.tone,
        previousText: regenerate ? (input.previousText ?? "") : "",
        regenerate,
        op: "generate_nl",
      });

      if (useCache && !regenerate) {
        const cached = globalContentAiCache.get<GenerateDutchCopyResult>(sourceHash);
        if (cached) {
          const result = {
            ...cached.value,
            provenance: { ...cached.provenance, sourceHash },
            warnings: [...cached.value.warnings, "Cache-hit (zelfde bron-hash)."],
          };
          await recordContentAiAudit({
            operation: "generate_nl",
            actorUsername: options.actorUsername,
            pageId: options.pageId,
            provider: "groq",
            model: result.provenance.model,
            promptVersion: result.provenance.promptVersion,
            sourceHash,
            cacheHit: true,
            warnings: result.warnings,
          });
          return result;
        }
      }

      const { system, user } = buildGenerateDutchCopyMessages(input);
      const completion = await provider.complete({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: regenerate ? 0.85 : 0.4,
        maxTokens: 500,
      });
      try {
        const { text, warnings } = parseTextResult(completion.content, input.maxChars ?? 280);
        if (input.currentText?.trim()) {
          const semantic = checkSemanticPreservation({
            source: input.currentText,
            target: text,
          });
          warnings.push(...semantic.warnings);
        }
        const result: GenerateDutchCopyResult = {
          text,
          warnings,
          provenance: {
            generatedBy: "groq",
            model: completion.model,
            promptVersion: CONTENT_AI_PROMPT_VERSION,
            generatedAt: new Date().toISOString(),
            sourceHash,
          },
        };
        if (useCache && !regenerate) {
          globalContentAiCache.set(sourceHash, result, result.provenance);
        }
        await recordContentAiAudit({
          operation: "generate_nl",
          actorUsername: options.actorUsername,
          pageId: options.pageId,
          provider: "groq",
          model: completion.model,
          promptVersion: CONTENT_AI_PROMPT_VERSION,
          sourceHash,
          cacheHit: false,
          warnings,
        });
        return result;
      } catch (error) {
        throw new ContentAiError(
          "parse",
          error instanceof Error ? error.message : "Kon AI-tekst niet verwerken.",
        );
      }
    },

    async translateNlToEn(rawInput) {
      const input = translateNlToEnInputSchema.parse(rawInput);
      const rawFields: Record<string, string> = input.fields
        ? { ...input.fields }
        : { text: input.text!.trim() };
      // Never call the provider for blank strings (avoids empty JSON / empty responses).
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(rawFields)) {
        const trimmed = value.trim();
        if (trimmed) fields[key] = trimmed;
      }
      const maxChars = input.maxCharsPerField ?? 2000;
      const sourceHash = hashSourcePayload({
        fields,
        op: "translate_nl_en",
        promptVersion: CONTENT_AI_PROMPT_VERSION,
      });

      if (Object.keys(fields).length === 0) {
        const emptyResult: TranslateNlToEnResult = {
          fields: {},
          warnings: ["Geen vertaalbare NL-velden."],
          provenance: {
            generatedBy: "groq",
            model: provider.getStatus().model ?? "none",
            promptVersion: CONTENT_AI_PROMPT_VERSION,
            generatedAt: new Date().toISOString(),
            sourceHash,
          },
        };
        return emptyResult;
      }

      if (useCache) {
        const cached = globalContentAiCache.get<TranslateNlToEnResult>(sourceHash);
        if (cached) {
          const result = {
            ...cached.value,
            provenance: { ...cached.provenance, sourceHash },
            warnings: [...cached.value.warnings, "Cache-hit (zelfde bron-hash)."],
          };
          await recordContentAiAudit({
            operation: "translate_nl_en",
            actorUsername: options.actorUsername,
            pageId: options.pageId,
            provider: "groq",
            model: result.provenance.model,
            promptVersion: result.provenance.promptVersion,
            sourceHash,
            cacheHit: true,
            warnings: result.warnings,
          });
          return result;
        }
      }

      // Multiline CMS strings → one translate unit per content line so the model
      // cannot flatten bullets/blank lines/subheads into a single paragraph.
      const { units, plans } = expandFieldsToLineUnits(fields);
      const { system, user, aliasToKey } = buildTranslateNlToEnMessages({
        fields: units,
        preserveTerms: input.preserveTerms,
        maxCharsPerField: maxChars,
      });
      const completion = await provider.complete({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        maxTokens: estimateTranslateMaxTokens(units),
      });
      try {
        const aliasKeys = Object.keys(aliasToKey);
        const unitKeys = Object.keys(units);
        const originalKeys = Object.keys(fields);
        const parsed = parseFieldsResult(
          completion.content,
          [...aliasKeys, ...unitKeys],
          maxChars,
        );
        const unitOut: Record<string, string> = {};
        for (const [alias, unitKey] of Object.entries(aliasToKey)) {
          const value = parsed.fields[alias] ?? parsed.fields[unitKey];
          if (value?.trim()) {
            unitOut[unitKey] = value;
          }
        }
        const collapsed = collapseLineUnitsToFields(unitOut, plans);
        const out: Record<string, string> = {};
        for (const key of originalKeys) {
          const value = collapsed[key];
          if (value?.trim()) {
            out[key] = preserveTranslatedFieldStructure(fields[key] ?? "", value);
          }
        }
        // Drop "missing" warnings for unit/alias keys we successfully resolved.
        const resolvedUnits = new Set(Object.keys(unitOut));
        const resolvedFields = new Set(Object.keys(out));
        const warnings = parsed.warnings.filter((w) => {
          for (const key of resolvedUnits) {
            if (w.includes(`"${key}"`)) return false;
          }
          for (const [alias, unitKey] of Object.entries(aliasToKey)) {
            if (resolvedUnits.has(unitKey) && w.includes(`"${alias}"`)) return false;
          }
          for (const key of resolvedFields) {
            if (w.includes(`"${key}"`)) return false;
          }
          return true;
        });
        for (const key of originalKeys) {
          const src = fields[key] ?? "";
          const tgt = out[key] ?? "";
          if (src && tgt) {
            const semantic = checkSemanticPreservation({ source: src, target: tgt });
            warnings.push(...semantic.warnings.map((w) => `${key}: ${w}`));
          }
        }
        const result: TranslateNlToEnResult = {
          fields: out,
          warnings,
          provenance: {
            generatedBy: "groq",
            model: completion.model,
            promptVersion: CONTENT_AI_PROMPT_VERSION,
            generatedAt: new Date().toISOString(),
            sourceHash,
          },
        };
        if (!input.fields && typeof out.text === "string") {
          result.text = out.text;
        }
        if (useCache) {
          globalContentAiCache.set(sourceHash, result, result.provenance);
        }
        await recordContentAiAudit({
          operation: "translate_nl_en",
          actorUsername: options.actorUsername,
          pageId: options.pageId,
          provider: "groq",
          model: completion.model,
          promptVersion: CONTENT_AI_PROMPT_VERSION,
          sourceHash,
          cacheHit: false,
          warnings,
        });
        return result;
      } catch (error) {
        throw new ContentAiError(
          "parse",
          error instanceof Error ? error.message : "Kon vertaling niet verwerken.",
        );
      }
    },

    async generateSectionCopy(rawInput) {
      const input = generateSectionCopyInputSchema.parse(rawInput);
      const fieldKeys = Object.keys(input.fields);
      const regenerate = Boolean(input.regenerate);
      const sourceHash = hashSourcePayload({
        brief: input.brief ?? "",
        fields: input.fields,
        tone: input.tone,
        previousFields: regenerate ? (input.previousFields ?? {}) : {},
        regenerate,
        op: "generate_section",
      });

      if (useCache && !regenerate) {
        const cached = globalContentAiCache.get<GenerateSectionCopyResult>(sourceHash);
        if (cached) {
          const result = {
            ...cached.value,
            provenance: { ...cached.provenance, sourceHash },
            warnings: [...cached.value.warnings, "Cache-hit (zelfde bron-hash)."],
          };
          await recordContentAiAudit({
            operation: "generate_section",
            actorUsername: options.actorUsername,
            pageId: options.pageId,
            provider: "groq",
            model: result.provenance.model,
            promptVersion: result.provenance.promptVersion,
            sourceHash,
            cacheHit: true,
            warnings: result.warnings,
          });
          return result;
        }
      }

      const warnings: string[] = [];
      const { system, user } = buildGenerateSectionDutchMessages({
        brief: input.brief,
        tone: input.tone ?? "catchy",
        fields: input.fields,
        regenerate,
        previousFields: input.previousFields,
      });
      const nlCompletion = await provider.complete({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: regenerate ? 0.85 : 0.4,
        maxTokens: 1600,
      });

      let nl: Record<string, string>;
      try {
        const maxByKey = Object.fromEntries(
          fieldKeys.map((key) => [key, input.fields[key]?.maxChars ?? 280]),
        );
        // Use the largest max for parse, then re-sanitize per field.
        const parsed = parseFieldsResult(nlCompletion.content, fieldKeys, 2000);
        warnings.push(...parsed.warnings);
        nl = {};
        for (const key of fieldKeys) {
          const max = maxByKey[key] ?? 280;
          const raw = parsed.fields[key] ?? "";
          const text = sanitizePlainText(raw, max);
          if (!text) {
            throw new Error(`Lege AI-output voor veld ${key}`);
          }
          nl[key] = text;
        }
      } catch (error) {
        throw new ContentAiError(
          "parse",
          error instanceof Error ? error.message : "Kon sectietekst niet verwerken.",
        );
      }

      const enMax = Math.max(
        400,
        ...fieldKeys.map((key) => input.fields[key]?.maxChars ?? 280),
      );
      const { units: enUnits, plans: enPlans } = expandFieldsToLineUnits(nl);
      const {
        system: enSystem,
        user: enUser,
        aliasToKey: enAliasToKey,
      } = buildTranslateNlToEnMessages({
        fields: enUnits,
        maxCharsPerField: enMax,
      });
      const enCompletion = await provider.complete({
        messages: [
          { role: "system", content: enSystem },
          { role: "user", content: enUser },
        ],
        temperature: 0.2,
        maxTokens: estimateTranslateMaxTokens(enUnits),
      });

      let en: Record<string, string>;
      try {
        const enAliasKeys = Object.keys(enAliasToKey);
        const enUnitKeys = Object.keys(enUnits);
        const parsedEn = parseFieldsResult(
          enCompletion.content,
          [...enAliasKeys, ...enUnitKeys],
          enMax,
        );
        warnings.push(...parsedEn.warnings);
        const unitOut: Record<string, string> = {};
        for (const [alias, unitKey] of Object.entries(enAliasToKey)) {
          const value = parsedEn.fields[alias] ?? parsedEn.fields[unitKey];
          if (value?.trim()) unitOut[unitKey] = value;
        }
        const collapsed = collapseLineUnitsToFields(unitOut, enPlans);
        en = {};
        for (const key of fieldKeys) {
          const text = collapsed[key]?.trim();
          if (!text) {
            throw new Error(`Lege EN-vertaling voor veld ${key}`);
          }
          en[key] = preserveTranslatedFieldStructure(nl[key] ?? "", text);
          const semantic = checkSemanticPreservation({ source: nl[key] ?? "", target: en[key]! });
          warnings.push(...semantic.warnings.map((w) => `${key}: ${w}`));
        }
      } catch (error) {
        throw new ContentAiError(
          "parse",
          error instanceof Error ? error.message : "Kon EN-vertaling niet verwerken.",
        );
      }

      const result: GenerateSectionCopyResult = {
        nl,
        en,
        warnings,
        provenance: {
          generatedBy: "groq",
          model: enCompletion.model || nlCompletion.model,
          promptVersion: CONTENT_AI_PROMPT_VERSION,
          generatedAt: new Date().toISOString(),
          sourceHash,
        },
      };
      if (useCache && !regenerate) {
        globalContentAiCache.set(sourceHash, result, result.provenance);
      }
      await recordContentAiAudit({
        operation: "generate_section",
        actorUsername: options.actorUsername,
        pageId: options.pageId,
        provider: "groq",
        model: result.provenance.model,
        promptVersion: CONTENT_AI_PROMPT_VERSION,
        sourceHash,
        cacheHit: false,
        warnings,
      });
      return result;
    },
  };
}

/** Default server wiring — Groq from env. */
export function createContentAiFromEnv(
  options: ContentAiServiceOptions = {},
): ContentAiService {
  return createContentAiService(createGroqProviderFromEnv(), options);
}
