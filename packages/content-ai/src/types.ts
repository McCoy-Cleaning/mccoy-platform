import { z } from "zod";

export const CONTENT_AI_PROMPT_VERSION = "v2" as const;

export const contentAiToneSchema = z.enum([
  "professional",
  "catchy",
  "warm",
  "concise",
]);
export type ContentAiTone = z.infer<typeof contentAiToneSchema>;

export const generateDutchCopyInputSchema = z.object({
  /** Optional brief / intent in Dutch or English. */
  brief: z.string().trim().max(2000).optional(),
  /** Current Dutch text to improve (optional when brief is set). */
  currentText: z.string().trim().max(4000).optional(),
  /** Field role hint for the model (e.g. heading, body, cta). */
  fieldHint: z.string().trim().max(80).optional(),
  tone: contentAiToneSchema.default("catchy"),
  maxChars: z.number().int().min(20).max(2000).default(280),
  /**
   * When true, skip the source-hash cache and ask for a different variant.
   * Use for "Opnieuw genereren" so the editor never gets a duplicate cache hit.
   */
  regenerate: z.boolean().optional(),
  /** Previous AI output to avoid repeating (regenerate only). */
  previousText: z.string().trim().max(4000).optional(),
});
export type GenerateDutchCopyInput = z.input<typeof generateDutchCopyInputSchema>;

export const translateNlToEnInputSchema = z.object({
  /** Single Dutch string — used when fields is omitted. */
  text: z.string().trim().min(1).max(4000).optional(),
  /** Batch: stable field keys → Dutch source strings. */
  fields: z.record(z.string().trim().min(1).max(4000)).optional(),
  /** Preserve brand names / product names. */
  preserveTerms: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  maxCharsPerField: z.number().int().min(20).max(4000).default(2000),
}).refine(
  (v) => Boolean(v.text?.trim()) || (v.fields && Object.keys(v.fields).length > 0),
  { message: "text or fields required" },
);
export type TranslateNlToEnInput = z.input<typeof translateNlToEnInputSchema>;

export type ContentAiProvenance = {
  generatedBy: "groq";
  model: string;
  promptVersion: typeof CONTENT_AI_PROMPT_VERSION;
  generatedAt: string;
  sourceHash: string;
};

export type GenerateDutchCopyResult = {
  text: string;
  warnings: string[];
  provenance: ContentAiProvenance;
};

export type TranslateNlToEnResult = {
  /** Present for single-text requests. */
  text?: string;
  /** Present for batch requests (and always when fields were sent). */
  fields: Record<string, string>;
  warnings: string[];
  provenance: ContentAiProvenance;
};

const sectionFieldSpecSchema = z.object({
  currentText: z.string().trim().max(4000).optional(),
  fieldHint: z.string().trim().max(80).optional(),
  maxChars: z.number().int().min(20).max(2000).optional(),
});

/** Section-scoped NL generate + automatic EN translate (preview-only; never publishes). */
export const generateSectionCopyInputSchema = z.object({
  brief: z.string().trim().max(2000).optional(),
  fields: z
    .record(sectionFieldSpecSchema)
    .refine((v) => Object.keys(v).length >= 1 && Object.keys(v).length <= 12, {
      message: "1–12 sectievelden vereist",
    }),
  tone: contentAiToneSchema.default("catchy"),
  /** Skip cache and request a distinct variant ("Opnieuw genereren"). */
  regenerate: z.boolean().optional(),
  /** Previous NL field values to avoid repeating on regenerate. */
  previousFields: z.record(z.string().trim().max(4000)).optional(),
});
export type GenerateSectionCopyInput = z.input<typeof generateSectionCopyInputSchema>;

export type GenerateSectionCopyResult = {
  nl: Record<string, string>;
  en: Record<string, string>;
  warnings: string[];
  provenance: ContentAiProvenance;
};

export type ContentAiStatus = {
  configured: boolean;
  provider: "groq";
  model: string | null;
  promptVersion: typeof CONTENT_AI_PROMPT_VERSION;
};

export type ContentAiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ContentAiCompletionRequest = {
  messages: ContentAiChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type ContentAiCompletionResult = {
  content: string;
  model: string;
};

/**
 * Vendor-agnostic content AI contract (Phase E).
 * Implementations must run server-side only — never expose API keys.
 */
export interface ContentAiProvider {
  readonly id: "groq";
  isConfigured(): boolean;
  getStatus(): ContentAiStatus;
  complete(request: ContentAiCompletionRequest): Promise<ContentAiCompletionResult>;
}

export class ContentAiError extends Error {
  readonly code:
    | "not_configured"
    | "rate_limit"
    | "provider"
    | "parse"
    | "validation"
    | "timeout";

  constructor(
    code: ContentAiError["code"],
    message: string,
  ) {
    super(message);
    this.name = "ContentAiError";
    this.code = code;
  }
}
