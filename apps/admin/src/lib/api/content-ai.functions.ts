import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  ContentAiError,
  createContentAiFromEnv,
  type ContentAiStatus,
  type GenerateDutchCopyResult,
  type GenerateSectionCopyResult,
  type TranslateNlToEnResult,
} from "@mccoy/content-ai";
import { requireAdminSession } from "@mccoy/database/server";
import {
  AdminAuthError,
  assertContentAiRateLimit,
  readServerEnv,
} from "@mccoy/security";
import {
  contentAiGenerateDutchSchema,
  contentAiGenerateSectionSchema,
  contentAiTranslateSchema,
} from "@mccoy/validation";

function getService(options?: { actorUsername?: string; pageId?: string }) {
  // Prefer monorepo .env via security helper when process.env is empty (Vite/Nitro).
  const apiKey = readServerEnv("GROQ_API_KEY") || process.env.GROQ_API_KEY || "";
  const model = readServerEnv("GROQ_MODEL") || process.env.GROQ_MODEL || undefined;
  if (apiKey) {
    process.env.GROQ_API_KEY = apiKey;
  }
  if (model) {
    process.env.GROQ_MODEL = model;
  }
  return createContentAiFromEnv(options);
}

function mapError(error: unknown): {
  ok: false;
  error: string;
  code: ContentAiError["code"] | "auth" | "unknown";
} {
  if (error instanceof AdminAuthError) {
    return { ok: false, error: error.message, code: "auth" };
  }
  if (error instanceof ContentAiError) {
    return { ok: false, error: error.message, code: error.code };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, error: "Ongeldige AI-invoer.", code: "validation" };
  }
  console.error("[content-ai] unexpected error", error);
  return {
    ok: false,
    error: "Er ging iets mis bij AI-generatie. Probeer het later opnieuw.",
    code: "unknown",
  };
}

export const getContentAiStatus = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true; status: ContentAiStatus } | { ok: false; error: string; code: string }> => {
    try {
      await requireAdminSession();
      return { ok: true, status: getService().getStatus() };
    } catch (error) {
      return mapError(error);
    }
  },
);

export const generateDutchCopy = createServerFn({ method: "POST" })
  .validator(contentAiGenerateDutchSchema)
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; result: GenerateDutchCopyResult }
      | { ok: false; error: string; code: string }
    > => {
      try {
        const session = await requireAdminSession();
        assertContentAiRateLimit(session.username);
        const result = await getService({ actorUsername: session.username }).generateDutchCopy(data);
        return { ok: true, result };
      } catch (error) {
        return mapError(error);
      }
    },
  );

export const translateNlToEn = createServerFn({ method: "POST" })
  .validator(contentAiTranslateSchema)
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; result: TranslateNlToEnResult }
      | { ok: false; error: string; code: string }
    > => {
      try {
        const session = await requireAdminSession();
        assertContentAiRateLimit(session.username);
        const result = await getService({ actorUsername: session.username }).translateNlToEn(data);
        return { ok: true, result };
      } catch (error) {
        return mapError(error);
      }
    },
  );

export const generateSectionCopy = createServerFn({ method: "POST" })
  .validator(contentAiGenerateSectionSchema)
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; result: GenerateSectionCopyResult }
      | { ok: false; error: string; code: string }
    > => {
      try {
        const session = await requireAdminSession();
        assertContentAiRateLimit(session.username);
        const result = await getService({ actorUsername: session.username }).generateSectionCopy(data);
        return { ok: true, result };
      } catch (error) {
        return mapError(error);
      }
    },
  );
