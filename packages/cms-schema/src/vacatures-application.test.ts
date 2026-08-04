import { describe, expect, it } from "vitest";
import {
  DEFAULT_VACATURES_FACEBOOK_VIDEO_URL,
  defaultVacaturesApplicationContent,
  formFieldPayloadKey,
  normalizeVacaturesApplicationContent,
  resolveJobApplicationFields,
  resolveSafeVideoEmbed,
  validateContactFormSubmission,
} from "./index";

describe("vacatures application content", () => {
  it("defaults to Facebook video + CV/letter/motivation fields", () => {
    const content = defaultVacaturesApplicationContent();
    expect(content.media.kind).toBe("video");
    if (content.media.kind === "video") {
      expect(content.media.videoUrl).toBe(DEFAULT_VACATURES_FACEBOOK_VIDEO_URL);
    }
    const fields = resolveJobApplicationFields(content.fields);
    expect(fields.map((f) => f.type)).toEqual([
      "name",
      "email",
      "phone",
      "file",
      "file",
      "textarea",
    ]);
    expect(formFieldPayloadKey(fields[3]!)).toBe("cv");
    expect(formFieldPayloadKey(fields[4]!)).toBe("letter");
    expect(formFieldPayloadKey(fields[5]!)).toBe("motivation");
  });

  it("inherits applicationScope from vacatures.main when missing", () => {
    const content = normalizeVacaturesApplicationContent(
      { fields: [], media: { kind: "video", videoUrl: DEFAULT_VACATURES_FACEBOOK_VIDEO_URL } },
      { key: "hr", label: "HR" },
    );
    expect(content.applicationScope).toEqual({ key: "hr", label: "HR" });
    expect(content.fields.length).toBeGreaterThan(0);
  });

  it("switches media to image when kind is image", () => {
    const content = normalizeVacaturesApplicationContent({
      media: {
        kind: "image",
        image: {
          assetId: "local:team.jpg",
          src: "/images/team.jpg",
          alt: "Team McCoy",
          decorative: false,
        },
      },
    });
    expect(content.media.kind).toBe("image");
    if (content.media.kind === "image") {
      expect(content.media.image.alt).toBe("Team McCoy");
    }
  });
});

describe("resolveSafeVideoEmbed facebook", () => {
  it("embeds Facebook video URLs via the plugin iframe", () => {
    const result = resolveSafeVideoEmbed(DEFAULT_VACATURES_FACEBOOK_VIDEO_URL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("facebook");
      expect(result.embedUrl).toContain("facebook.com/plugins/video.php");
      expect(result.embedUrl).toContain(encodeURIComponent(DEFAULT_VACATURES_FACEBOOK_VIDEO_URL));
    }
  });
});

describe("job application field validation", () => {
  it("requires name and email and skips file string values", () => {
    const fields = resolveJobApplicationFields(
      defaultVacaturesApplicationContent().fields,
    );
    expect(validateContactFormSubmission(fields, { name: "", email: "" }).ok).toBe(false);
    const ok = validateContactFormSubmission(fields, {
      name: "Jan",
      email: "jan@example.com",
      phone: "06",
      motivation: "Hallo",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.sanitized.cv).toBeUndefined();
      expect(ok.sanitized.letter).toBeUndefined();
    }
  });
});
