import { beforeEach, describe, expect, it, vi } from "vitest";

const prepareWebsiteFormAttachments = vi.fn();
const uploadToSignedUrl = vi.fn();

vi.mock("@/lib/api/forms.functions", () => ({
  prepareWebsiteFormAttachments: (...args: unknown[]) => prepareWebsiteFormAttachments(...args),
}));

vi.mock("@mccoy/database/client", () => ({
  createBrowserSupabaseClient: () => ({
    storage: {
      from: () => ({ uploadToSignedUrl }),
    },
  }),
}));

import { uploadWebsiteFormAttachments } from "./upload-client";

beforeEach(() => {
  vi.clearAllMocks();
  uploadToSignedUrl.mockResolvedValue({ data: { path: "ok" }, error: null });
});

describe("uploadWebsiteFormAttachments", () => {
  it("uploads large files directly with server-issued tokens", async () => {
    const first = new File([new Uint8Array(8 * 1024 * 1024)], "front.jpg", {
      type: "image/jpeg",
    });
    const second = new File([new Uint8Array(6 * 1024 * 1024)], "report.pdf", {
      type: "application/pdf",
    });
    prepareWebsiteFormAttachments.mockResolvedValue({
      ok: true,
      slots: [
        {
          filename: first.name,
          contentType: first.type,
          sizeBytes: first.size,
          storagePath: "uploads/11111111-1111-4111-8111-111111111111/01-front.jpg",
          token: "token-1",
        },
        {
          filename: second.name,
          contentType: second.type,
          sizeBytes: second.size,
          storagePath: "uploads/11111111-1111-4111-8111-111111111111/02-report.pdf",
          token: "token-2",
        },
      ],
    });

    const result = await uploadWebsiteFormAttachments({
      kind: "glass_washing",
      pageId: "page_offerte",
      sourceId: "block-1",
      fields: { name: "Test", email: "test@example.com" },
      files: [first, second],
    });

    expect(uploadToSignedUrl).toHaveBeenCalledTimes(2);
    expect(uploadToSignedUrl.mock.calls[0]?.[2]).toBe(first);
    expect(uploadToSignedUrl.mock.calls[1]?.[2]).toBe(second);
    expect(result).toHaveLength(2);
    expect(result[0]).not.toHaveProperty("token");
  });

  it("surfaces storage failures instead of submitting without the file", async () => {
    const file = new File(["%PDF"], "report.pdf", { type: "application/pdf" });
    prepareWebsiteFormAttachments.mockResolvedValue({
      ok: true,
      slots: [
        {
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          storagePath: "uploads/11111111-1111-4111-8111-111111111111/01-report.pdf",
          token: "token-1",
        },
      ],
    });
    uploadToSignedUrl.mockResolvedValue({ data: null, error: new Error("failed") });

    await expect(
      uploadWebsiteFormAttachments({
        kind: "job_application",
        pageId: "page_vacatures",
        sourceId: "jobs",
        fields: { name: "Test", email: "test@example.com" },
        files: [file],
      }),
    ).rejects.toThrow(/mislukt/i);
  });
});
