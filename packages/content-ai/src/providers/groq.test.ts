import { describe, expect, it, vi } from "vitest";

import { ContentAiError } from "../types";
import { GroqContentAiProvider } from "./groq";

describe("GroqContentAiProvider empty response handling", () => {
  it("retries once with boosted tokens when content is empty", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: "openai/gpt-oss-20b",
            choices: [{ message: { content: "" }, finish_reason: "length" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: "openai/gpt-oss-20b",
            choices: [
              {
                message: {
                  content: JSON.stringify({ fields: { f0: "Clean offices" } }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const provider = new GroqContentAiProvider({
      apiKey: "test-key",
      model: "openai/gpt-oss-20b",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await provider.complete({
      messages: [
        { role: "system", content: "Translate" },
        { role: "user", content: "Hallo" },
      ],
      maxTokens: 1600,
      temperature: 0.2,
    });

    expect(result.content).toContain("Clean offices");
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? "{}")) as {
      reasoning_effort?: string;
      max_tokens?: number;
      response_format?: unknown;
    };
    expect(firstBody.reasoning_effort).toBe("low");
    expect(firstBody.response_format).toEqual({ type: "json_object" });

    const secondBody = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body ?? "{}")) as {
      max_tokens?: number;
      response_format?: unknown;
    };
    expect(secondBody.max_tokens).toBeGreaterThanOrEqual(4096);
    expect(secondBody.response_format).toBeUndefined();
  });

  it("throws a clear error when empty response persists after retry", async () => {
    const empty = () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "  " }, finish_reason: "length" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const fetchImpl = vi.fn().mockResolvedValueOnce(empty()).mockResolvedValueOnce(empty());

    const provider = new GroqContentAiProvider({
      apiKey: "test-key",
      model: "openai/gpt-oss-20b",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      provider.complete({
        messages: [{ role: "user", content: "x" }],
        maxTokens: 800,
      }),
    ).rejects.toMatchObject({
      code: "parse",
      message: expect.stringMatching(/lege reactie/i),
    } satisfies Partial<ContentAiError>);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("GroqContentAiProvider error classification", () => {
  const request = {
    messages: [{ role: "user" as const, content: "Vertaal dit" }],
    maxTokens: 800,
  };

  it("labels only HTTP 429 or an explicit provider code as rate limiting", async () => {
    const http429 = new GroqContentAiProvider({
      apiKey: "test-key",
      fetchImpl: vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: "slow down" } }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }),
      ) as unknown as typeof fetch,
    });
    await expect(http429.complete(request)).rejects.toMatchObject({
      code: "rate_limit",
      message: expect.stringMatching(/rate limit/i),
    } satisfies Partial<ContentAiError>);

    const explicitCode = new GroqContentAiProvider({
      apiKey: "test-key",
      fetchImpl: vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "rate_limit_exceeded", message: "request budget exhausted" },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          ),
      ) as unknown as typeof fetch,
    });
    await expect(explicitCode.complete(request)).rejects.toMatchObject({
      code: "rate_limit",
    } satisfies Partial<ContentAiError>);
  });

  it("does not mislabel authentication or provider failures as rate limiting", async () => {
    const invalidKey = new GroqContentAiProvider({
      apiKey: "test-key",
      fetchImpl: vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: "invalid_api_key" } }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }),
      ) as unknown as typeof fetch,
    });
    await expect(invalidKey.complete(request)).rejects.toMatchObject({
      code: "provider",
      message: expect.stringMatching(/GROQ_API_KEY/),
    } satisfies Partial<ContentAiError>);

    const unavailable = new GroqContentAiProvider({
      apiKey: "test-key",
      fetchImpl: vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: "service_unavailable" } }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ) as unknown as typeof fetch,
    });
    await expect(unavailable.complete(request)).rejects.toMatchObject({
      code: "provider",
      message: expect.not.stringMatching(/rate limit/i),
    } satisfies Partial<ContentAiError>);
  });
});
