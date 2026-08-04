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
