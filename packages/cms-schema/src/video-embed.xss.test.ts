import { describe, expect, it } from "vitest";
import { resolveSafeVideoEmbed } from "./blocks/video-embed";

describe("resolveSafeVideoEmbed XSS / allowlist", () => {
  it("rejects javascript and data URLs", () => {
    expect(resolveSafeVideoEmbed("javascript:alert(1)").ok).toBe(false);
    expect(resolveSafeVideoEmbed("data:text/html,<script>alert(1)</script>").ok).toBe(false);
  });

  it("rejects http embeds", () => {
    const result = resolveSafeVideoEmbed("http://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/https/i);
  });

  it("rejects non-allowlisted https hosts", () => {
    expect(resolveSafeVideoEmbed("https://evil.example/embed/abc").ok).toBe(false);
    expect(resolveSafeVideoEmbed("https://www.youtube.com.evil.tld/watch?v=abc123").ok).toBe(false);
  });

  it("accepts YouTube and returns nocookie embed", () => {
    const result = resolveSafeVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("youtube");
      expect(result.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    }
  });

  it("accepts Vimeo", () => {
    const result = resolveSafeVideoEmbed("https://vimeo.com/123456789");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.embedUrl).toBe("https://player.vimeo.com/video/123456789");
    }
  });
});
