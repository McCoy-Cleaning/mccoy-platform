import { describe, expect, it } from "vitest";

import {
  MAX_FORM_ATTACHMENT_COUNT,
  MAX_FORM_ATTACHMENT_FILE_BYTES,
  prepareFormFileAttachments,
} from "./form-file-attachments";

function testFile(size: number, name: string, type = "application/pdf"): File {
  return new File([new Uint8Array(size)], name, { type, lastModified: 1 });
}

describe("form file attachment preparation", () => {
  it("keeps multiple files, including equal-size files", async () => {
    const first = new File(["%PDF-one"], "first.pdf", { type: "application/pdf" });
    const second = new File(["%PDF-two"], "second.pdf", { type: "application/pdf" });

    const result = await prepareFormFileAttachments([first, second]);

    expect(result).toEqual([first, second]);
  });

  it("rejects more than eight files instead of silently dropping the rest", async () => {
    const files = Array.from({ length: MAX_FORM_ATTACHMENT_COUNT + 1 }, (_, index) =>
      testFile(1, `${index}.pdf`),
    );
    await expect(prepareFormFileAttachments(files)).rejects.toThrow(/maximaal 8/i);
  });

  it("accepts a document above the old 3 MB transport limit", async () => {
    const large = testFile(8 * 1024 * 1024, "large.pdf");
    await expect(prepareFormFileAttachments([large])).resolves.toEqual([large]);
  });

  it("rejects a file above the explicit private-storage limit", async () => {
    const oversized = testFile(MAX_FORM_ATTACHMENT_FILE_BYTES + 1, "large.pdf");
    await expect(prepareFormFileAttachments([oversized])).rejects.toThrow(/25 MB/i);
  });
});
