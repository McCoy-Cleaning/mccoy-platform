import { beforeEach, describe, expect, it, vi } from "vitest";

const submitWebsiteForm = vi.fn();
const uploadWebsiteFormAttachments = vi.fn();
const collectFormFileAttachments = vi.fn();

vi.mock("@/lib/api/forms.functions", () => ({
  submitWebsiteForm: (...args: unknown[]) => submitWebsiteForm(...args),
}));

vi.mock("@/lib/forms/upload-client", () => ({
  uploadWebsiteFormAttachments: (...args: unknown[]) => uploadWebsiteFormAttachments(...args),
}));

vi.mock("@mccoy/cms-renderer", async () => {
  const actual = await vi.importActual<typeof import("@mccoy/cms-renderer")>("@mccoy/cms-renderer");
  return {
    ...actual,
    collectFormFileAttachments: (...args: unknown[]) => collectFormFileAttachments(...args),
  };
});

import {
  attachExtraFileFieldNames,
  fieldsFromForm,
  submitSiteForm,
} from "./submit-client";

beforeEach(() => {
  vi.clearAllMocks();
  submitWebsiteForm.mockResolvedValue({ ok: true });
  uploadWebsiteFormAttachments.mockResolvedValue([
    {
      filename: "cv.pdf",
      contentType: "application/pdf",
      sizeBytes: 12,
      storagePath: "uploads/11111111-1111-4111-8111-111111111111/01-cv.pdf",
    },
  ]);
  collectFormFileAttachments.mockImplementation(async (_form: HTMLFormElement, extra: File[] = []) =>
    extra.filter((file) => file.size > 0),
  );
});

function stubForm(entries: Array<[string, string]>): HTMLFormElement {
  const map = new Map(entries);
  return {
    // Minimal FormData stand-in used by fieldsFromForm.
  } as unknown as HTMLFormElement;
}

describe("attachExtraFileFieldNames", () => {
  it("fills photos from React-managed offerte files", () => {
    const photo = new File(["img"], "gevel.jpg", { type: "image/jpeg" });
    expect(attachExtraFileFieldNames({ name: "Jan" }, [photo])).toEqual({
      name: "Jan",
      photos: "gevel.jpg",
    });
  });

  it("does not overwrite an existing photos field", () => {
    const photo = new File(["img"], "gevel.jpg", { type: "image/jpeg" });
    expect(attachExtraFileFieldNames({ photos: "existing.jpg" }, [photo])).toEqual({
      photos: "existing.jpg",
    });
  });
});

describe("submitSiteForm", () => {
  it("uploads careers PDF via private storage and submits uploadedAttachments", async () => {
    const file = new File(["%PDF-1.4 cv"], "cv.pdf", { type: "application/pdf" });
    const formEntries: Array<[string, FormDataEntryValue]> = [
      ["name", "Anna Applicant"],
      ["email", "anna@example.com"],
      ["website", ""],
    ];

    vi.stubGlobal(
      "FormData",
      class {
        entries() {
          return formEntries[Symbol.iterator]();
        }
      },
    );

    const form = stubForm([
      ["name", "Anna Applicant"],
      ["email", "anna@example.com"],
    ]);

    const result = await submitSiteForm({
      kind: "job_application",
      pageId: "page_vacatures",
      sourceId: "fixed:vacatures:application",
      form,
      extras: {
        vacancyId: "vac-1",
        role: "Schoonmaker",
        cv: "cv.pdf",
      },
      extraFiles: [file],
    });

    expect(result).toEqual({ ok: true });
    expect(collectFormFileAttachments).toHaveBeenCalledWith(form, [file]);
    expect(uploadWebsiteFormAttachments).toHaveBeenCalledTimes(1);
    expect(uploadWebsiteFormAttachments.mock.calls[0]?.[0]).toMatchObject({
      kind: "job_application",
      pageId: "page_vacatures",
      files: [file],
    });
    expect(submitWebsiteForm).toHaveBeenCalledTimes(1);
    const payload = submitWebsiteForm.mock.calls[0]?.[0]?.data;
    expect(payload).toMatchObject({
      kind: "job_application",
      pageId: "page_vacatures",
      fields: expect.objectContaining({
        name: "Anna Applicant",
        email: "anna@example.com",
        cv: "cv.pdf",
        role: "Schoonmaker",
      }),
      uploadedAttachments: [
        {
          filename: "cv.pdf",
          contentType: "application/pdf",
          sizeBytes: 12,
          storagePath: "uploads/11111111-1111-4111-8111-111111111111/01-cv.pdf",
        },
      ],
    });
    expect(payload.attachments).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("surfaces upload failures instead of submitting without the PDF", async () => {
    uploadWebsiteFormAttachments.mockRejectedValue(new Error("Upload van “cv.pdf” is mislukt."));
    const file = new File(["%PDF"], "cv.pdf", { type: "application/pdf" });

    vi.stubGlobal(
      "FormData",
      class {
        entries() {
          return [
            ["name", "Anna Applicant"],
            ["email", "anna@example.com"],
          ][Symbol.iterator]();
        }
      },
    );

    const result = await submitSiteForm({
      kind: "job_application",
      pageId: "page_vacatures",
      sourceId: "fixed:vacatures:application",
      form: stubForm([
        ["name", "Anna Applicant"],
        ["email", "anna@example.com"],
      ]),
      extras: { cv: "cv.pdf" },
      extraFiles: [file],
    });

    expect(result).toEqual({
      ok: false,
      error: "Upload van “cv.pdf” is mislukt.",
    });
    expect(submitWebsiteForm).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("fieldsFromForm", () => {
  it("merges string fields, extras, and named file filenames", () => {
    const cv = new File(["%PDF"], "cv.pdf", { type: "application/pdf" });
    vi.stubGlobal(
      "FormData",
      class {
        entries() {
          return [
            ["name", "Anna Applicant"],
            ["email", "anna@example.com"],
            ["cv", cv],
          ][Symbol.iterator]();
        }
      },
    );

    const fields = fieldsFromForm(stubForm([]), { role: "Schoonmaker" });
    expect(fields).toEqual({
      name: "Anna Applicant",
      email: "anna@example.com",
      role: "Schoonmaker",
      cv: "cv.pdf",
    });
    vi.unstubAllGlobals();
  });
});
