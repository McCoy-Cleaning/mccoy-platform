import { describe, expect, it } from "vitest";

import { RateLimitError } from "./rate-limit";
import { AdminAuthError, assertContentAiRateLimit } from "./session";

describe("assertContentAiRateLimit", () => {
  it("reports the local throttle as rate limiting, not authentication failure", () => {
    const key = "content-ai-local-limit-test";

    expect(() => assertContentAiRateLimit(key, 1, 60_000)).not.toThrow();

    try {
      assertContentAiRateLimit(key, 1, 60_000);
      throw new Error("expected local rate limit");
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error).not.toBeInstanceOf(AdminAuthError);
      expect(error).toMatchObject({ code: "rate_limit" });
    }
  });
});
