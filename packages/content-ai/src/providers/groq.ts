import {
  ContentAiError,
  CONTENT_AI_PROMPT_VERSION,
  type ContentAiCompletionRequest,
  type ContentAiCompletionResult,
  type ContentAiProvider,
  type ContentAiStatus,
} from "../types";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
/** Groq recommended replacement for deprecated llama-3.1-8b-instant (shutdown 2026-08-16). */
const DEFAULT_MODEL = "openai/gpt-oss-20b";
/** Used when the primary model is missing or fails JSON validation. */
const FALLBACK_MODEL = "llama-3.1-8b-instant";
const DEFAULT_TIMEOUT_MS = 25_000;

function readEnv(name: string): string {
  try {
    return (process.env[name] ?? "").trim();
  } catch {
    return "";
  }
}

type GroqErrorInfo = {
  code?: string;
  type?: string;
  messageSnippet?: string;
};

async function readGroqError(res: Response): Promise<GroqErrorInfo> {
  try {
    const errBody = (await res.json()) as {
      error?: { code?: string; type?: string; message?: string };
    };
    const rawMsg = errBody.error?.message;
    return {
      code: typeof errBody.error?.code === "string" ? errBody.error.code : undefined,
      type: typeof errBody.error?.type === "string" ? errBody.error.type : undefined,
      messageSnippet: typeof rawMsg === "string" ? rawMsg.slice(0, 160) : undefined,
    };
  } catch {
    return {};
  }
}

function isModelMissing(httpStatus: number, errorCode: string | undefined): boolean {
  return errorCode === "model_not_found" || httpStatus === 404;
}

function isJsonValidateFailed(errorCode: string | undefined): boolean {
  return errorCode === "json_validate_failed";
}

export type GroqProviderOptions = {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
};

export class GroqContentAiProvider implements ContentAiProvider {
  readonly id = "groq" as const;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GroqProviderOptions = {}) {
    this.apiKey = (options.apiKey ?? readEnv("GROQ_API_KEY")).trim();
    this.model = (options.model ?? (readEnv("GROQ_MODEL") || DEFAULT_MODEL)).trim();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  getStatus(): ContentAiStatus {
    return {
      configured: this.isConfigured(),
      provider: "groq",
      model: this.isConfigured() ? this.model : null,
      promptVersion: CONTENT_AI_PROMPT_VERSION,
    };
  }

  async complete(request: ContentAiCompletionRequest): Promise<ContentAiCompletionResult> {
    if (!this.isConfigured()) {
      throw new ContentAiError(
        "not_configured",
        "AI is niet geconfigureerd. Zet GROQ_API_KEY in de serveromgeving.",
      );
    }

    const primary = await this.requestCompletion(request, this.model);
    if (primary.ok) {
      return primary.result;
    }

    let retryModel: string | null = null;
    if (isJsonValidateFailed(primary.error.code)) {
      // Intermittent on smaller/deprecated models; one same-model retry often succeeds.
      retryModel = this.model;
    } else if (isModelMissing(primary.httpStatus, primary.error.code) && FALLBACK_MODEL !== this.model) {
      retryModel = FALLBACK_MODEL;
    }

    if (!retryModel) {
      this.throwFromHttpError(primary.httpStatus, primary.error);
    }

    const retry = await this.requestCompletion(request, retryModel);
    if (retry.ok) {
      return retry.result;
    }

    this.throwFromHttpError(retry.httpStatus, retry.error);
  }

  private throwFromHttpError(httpStatus: number, error: GroqErrorInfo): never {
    if (httpStatus === 429) {
      throw new ContentAiError(
        "rate_limit",
        "Groq rate limit bereikt. Wacht even en probeer opnieuw.",
      );
    }

    if (error.code === "json_validate_failed") {
      throw new ContentAiError(
        "provider",
        "AI kon geen geldige JSON genereren. Probeer opnieuw of pas de brief aan.",
      );
    }

    // Do not leak provider body details to callers.
    throw new ContentAiError(
      "provider",
      "AI-provider gaf een fout. Probeer het later opnieuw.",
    );
  }

  private async requestCompletion(
    request: ContentAiCompletionRequest,
    model: string,
  ): Promise<
    | { ok: true; result: ContentAiCompletionResult }
    | { ok: false; httpStatus: number; error: GroqErrorInfo }
  > {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(GROQ_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: request.temperature ?? 0.4,
          max_tokens: request.maxTokens ?? 800,
          response_format: { type: "json_object" },
          messages: request.messages,
        }),
        signal: controller.signal,
      });

      if (res.status === 429) {
        throw new ContentAiError(
          "rate_limit",
          "Groq rate limit bereikt. Wacht even en probeer opnieuw.",
        );
      }

      if (!res.ok) {
        const error = await readGroqError(res);
        return { ok: false, httpStatus: res.status, error };
      }

      const data = (await res.json()) as {
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new ContentAiError("parse", "Lege reactie van AI-provider.");
      }
      return {
        ok: true,
        result: {
          content,
          model: typeof data.model === "string" && data.model ? data.model : model,
        },
      };
    } catch (error) {
      if (error instanceof ContentAiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ContentAiError("timeout", "AI-verzoek time-out. Probeer opnieuw.");
      }
      throw new ContentAiError(
        "provider",
        "Kon AI-provider niet bereiken. Controleer netwerk en probeer opnieuw.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createGroqProviderFromEnv(
  overrides?: GroqProviderOptions,
): GroqContentAiProvider {
  return new GroqContentAiProvider(overrides);
}
