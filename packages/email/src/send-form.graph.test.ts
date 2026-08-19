import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendGraphAdminReply = vi.fn();
const sendSmtpMail = vi.fn();
const createWebsiteRequest = vi.fn();
const updateRequestNotification = vi.fn();
const processNotificationOutbox = vi.fn();
const hasSupabaseServiceConfig = vi.fn(() => false);
const finalizeWebsiteRequestUploadedAttachments = vi.fn();
const getStoredWebsiteRequestAttachment = vi.fn();
const storeWebsiteRequestAttachments = vi.fn();

vi.mock("./graph-mail", () => ({
  sendGraphAdminReply: (...args: unknown[]) => sendGraphAdminReply(...args),
}));

vi.mock("./smtp", () => ({
  defaultTransactionalFrom: () => "McCoy <info@mccoy.nl>",
  isSmtpConfigured: () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  sendSmtpMail: (...args: unknown[]) => sendSmtpMail(...args),
}));

vi.mock("./graph-config", () => ({
  isGraphMailConfigured: () =>
    Boolean(
      process.env.TENANT_ID &&
        process.env.CLIENT_ID &&
        process.env.CLIENT_SECRET &&
        process.env.GRAPH_MAILBOX,
    ),
}));

vi.mock("./form-inbox-provider", () => ({
  shouldAttemptGraphMail: () => process.env.FORM_INBOX_PROVIDER !== "imap",
}));

vi.mock("@mccoy/database/server", () => ({
  attachmentMetaFromBase64: (filename: string, contentType: string) => ({
    filename,
    contentType,
    sizeBytes: 1,
  }),
  createWebsiteRequest: (...args: unknown[]) => createWebsiteRequest(...args),
  finalizeWebsiteRequestUploadedAttachments: (...args: unknown[]) =>
    finalizeWebsiteRequestUploadedAttachments(...args),
  getStoredWebsiteRequestAttachment: (...args: unknown[]) =>
    getStoredWebsiteRequestAttachment(...args),
  storeWebsiteRequestAttachments: (...args: unknown[]) => storeWebsiteRequestAttachments(...args),
  hasSupabaseServiceConfig: () => hasSupabaseServiceConfig(),
  processNotificationOutbox: (...args: unknown[]) => processNotificationOutbox(...args),
  updateRequestNotification: (...args: unknown[]) => updateRequestNotification(...args),
}));


const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");
const KEYS = [
  "MCCOY_E2E",
  "FORM_INBOX_PROVIDER",
  "FORM_TO_EMAIL",
  "TENANT_ID",
  "CLIENT_ID",
  "CLIENT_SECRET",
  "GRAPH_MAILBOX",
  "SMTP_USER",
  "SMTP_PASS",
] as const;

const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

function clearEnv(): void {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreEnv(): void {
  for (const key of KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function enableGraph(): void {
  process.env.FORM_INBOX_PROVIDER = "graph";
  process.env.FORM_TO_EMAIL = "info@mccoy.nl";
  process.env.TENANT_ID = "11111111-1111-1111-1111-111111111111";
  process.env.CLIENT_ID = "22222222-2222-2222-2222-222222222222";
  process.env.CLIENT_SECRET = "secret";
  process.env.GRAPH_MAILBOX = "info@mccoy.nl";
  process.env.SMTP_USER = "sander@mccoy.nl";
  process.env.SMTP_PASS = "app-password";
}

beforeEach(() => {
  clearEnv();
  vi.clearAllMocks();
  createWebsiteRequest.mockResolvedValue({
    id: "req-1",
    number: "WR-TEST-1",
  });
  updateRequestNotification.mockResolvedValue(undefined);
  sendGraphAdminReply.mockResolvedValue({ ok: true });
  sendSmtpMail.mockResolvedValue({ ok: true });
  finalizeWebsiteRequestUploadedAttachments.mockResolvedValue({
    ok: true,
    attachments: [],
  });
  getStoredWebsiteRequestAttachment.mockResolvedValue(null);
  storeWebsiteRequestAttachments.mockResolvedValue({ status: "stored", count: 0 });
});

afterEach(() => {
  restoreEnv();
});

describe("sendWebsiteFormEmail delivery channel", () => {
  it("prefers Graph Mail.Send over SMTP when Graph is configured", async () => {
    enableGraph();

    const { sendWebsiteFormEmail } = await import("./send-form");
    await sendWebsiteFormEmail({
      kind: "inquiry",
      pageId: "page_contact",
      sourceId: "fixed:contact:form",
      fields: { name: "Test", email: "visitor@example.com", message: "Hallo" },
    });

    expect(sendGraphAdminReply).toHaveBeenCalledTimes(1);
    expect(sendSmtpMail).not.toHaveBeenCalled();
    expect(updateRequestNotification).toHaveBeenCalledWith("req-1", "sent");
    const graphArgs = sendGraphAdminReply.mock.calls[0]?.[0] as {
      to: string;
      replyTo: string;
      headers: Record<string, string>;
      saveToSentItems: boolean;
    };
    expect(graphArgs.to).toBe("info@mccoy.nl");
    expect(graphArgs.replyTo).toBe("visitor@example.com");
    expect(graphArgs.headers["X-McCoy-Form-Kind"]).toBe("inquiry");
    expect(graphArgs.headers["X-McCoy-Submitter-Email"]).toBe("visitor@example.com");
    expect(graphArgs.saveToSentItems).toBe(false);
  });

  it("falls back to SMTP when Graph send fails", async () => {
    enableGraph();
    sendGraphAdminReply.mockResolvedValue({ ok: false, error: "AccessDenied" });

    const { sendWebsiteFormEmail } = await import("./send-form");
    await sendWebsiteFormEmail({
      kind: "inquiry",
      pageId: "page_contact",
      sourceId: "fixed:contact:form",
      fields: { name: "Test", email: "visitor@example.com", message: "Hallo" },
    });

    expect(sendGraphAdminReply).toHaveBeenCalledTimes(1);
    expect(sendSmtpMail).toHaveBeenCalledTimes(1);
    expect(updateRequestNotification).toHaveBeenCalledWith("req-1", "sent");
  });

  it("attaches staged images and PDFs/CVs after finalize, without failing a missing download", async () => {
    enableGraph();
    finalizeWebsiteRequestUploadedAttachments.mockResolvedValue({
      ok: true,
      attachments: [
        {
          filename: "foto1.jpg",
          contentType: "image/jpeg",
          sizeBytes: 1_200,
          storagePath: "req-1/foto1.jpg",
        },
        {
          filename: "cv.pdf",
          contentType: "application/pdf",
          sizeBytes: 8_000,
          storagePath: "req-1/cv.pdf",
        },
        {
          filename: "missing.webp",
          contentType: "image/webp",
          sizeBytes: 900,
          storagePath: "req-1/missing.webp",
        },
      ],
    });
    getStoredWebsiteRequestAttachment.mockImplementation(async (_id: string, filename: string) => {
      if (filename === "foto1.jpg") {
        return { contentBase64: JPEG_BYTES.toString("base64"), sizeBytes: JPEG_BYTES.length };
      }
      if (filename === "cv.pdf") {
        return { contentBase64: PDF_BYTES.toString("base64"), sizeBytes: PDF_BYTES.length };
      }
      return null;
    });

    const { sendWebsiteFormEmail } = await import("./send-form");
    await sendWebsiteFormEmail({
      kind: "glass_washing",
      pageId: "page_offerte",
      sourceId: "fixed:quote:form",
      fields: { name: "Jorien", email: "jorien@example.com", motivation: "Hallo" },
      uploadedAttachments: [
        {
          filename: "foto1.jpg",
          contentType: "image/jpeg",
          sizeBytes: 1_200,
          storagePath: "uploads/11111111-1111-4111-8111-111111111111/01-foto1.jpg",
        },
        {
          filename: "cv.pdf",
          contentType: "application/pdf",
          sizeBytes: 8_000,
          storagePath: "uploads/11111111-1111-4111-8111-111111111111/02-cv.pdf",
        },
        {
          filename: "missing.webp",
          contentType: "image/webp",
          sizeBytes: 900,
          storagePath: "uploads/11111111-1111-4111-8111-111111111111/03-missing.webp",
        },
      ],
    });

    expect(finalizeWebsiteRequestUploadedAttachments).toHaveBeenCalledTimes(1);
    expect(getStoredWebsiteRequestAttachment).toHaveBeenCalled();
    const graphArgs = sendGraphAdminReply.mock.calls[0]?.[0] as {
      attachments: Array<{ filename: string; contentBase64: string }>;
      html: string;
      saveToSentItems: boolean;
    };
    expect(graphArgs.saveToSentItems).toBe(false);
    expect(graphArgs.attachments.map((a) => a.filename)).toEqual(["foto1.jpg", "cv.pdf"]);
    expect(graphArgs.html).toContain("foto1.jpg");
    expect(graphArgs.html).toContain("cv.pdf");
    expect(graphArgs.html).toContain("missing.webp");
    expect(updateRequestNotification).toHaveBeenCalledWith("req-1", "sent");
  });

  it("does not attach a staged file twice when the same name is also in legacyAttachments", async () => {
    enableGraph();
    const bytes = JPEG_BYTES.toString("base64");
    finalizeWebsiteRequestUploadedAttachments.mockResolvedValue({
      ok: true,
      attachments: [
        {
          filename: "situatie.jpg",
          contentType: "image/jpeg",
          sizeBytes: 12,
          storagePath: "req-1/situatie.jpg",
        },
      ],
    });
    getStoredWebsiteRequestAttachment.mockResolvedValue({
      contentBase64: bytes,
      sizeBytes: 12,
    });

    const { sendWebsiteFormEmail } = await import("./send-form");
    await sendWebsiteFormEmail({
      kind: "glass_washing",
      pageId: "page_offerte",
      sourceId: "fixed:quote:form",
      fields: { name: "Anna", email: "anna@example.com" },
      attachments: [
        { filename: "situatie.jpg", contentType: "image/jpeg", contentBase64: bytes },
      ],
      uploadedAttachments: [
        {
          filename: "situatie.jpg",
          contentType: "image/jpeg",
          sizeBytes: 12,
          storagePath: "uploads/11111111-1111-4111-8111-111111111111/01-situatie.jpg",
        },
      ],
    });

    const graphArgs = sendGraphAdminReply.mock.calls[0]?.[0] as {
      attachments: Array<{ filename: string }>;
    };
    expect(graphArgs.attachments.map((a) => a.filename)).toEqual(["situatie.jpg"]);
    expect(getStoredWebsiteRequestAttachment).not.toHaveBeenCalled();
  });

  it("skips a staged file that would exceed the mailbox cap and still sends the rest", async () => {
    enableGraph();
    const { MAILBOX_MAX_ATTACHMENT_BYTES } = await import("./send-form");
    finalizeWebsiteRequestUploadedAttachments.mockResolvedValue({
      ok: true,
      attachments: [
        {
          filename: "huge.jpg",
          contentType: "image/jpeg",
          sizeBytes: MAILBOX_MAX_ATTACHMENT_BYTES - 100,
          storagePath: "req-1/huge.jpg",
        },
        {
          filename: "extra.pdf",
          contentType: "application/pdf",
          sizeBytes: 1_000,
          storagePath: "req-1/extra.pdf",
        },
      ],
    });
    getStoredWebsiteRequestAttachment.mockImplementation(async (_id: string, filename: string) => {
      if (filename === "huge.jpg") {
        return { contentBase64: JPEG_BYTES.toString("base64"), sizeBytes: MAILBOX_MAX_ATTACHMENT_BYTES - 100 };
      }
      if (filename === "extra.pdf") {
        return { contentBase64: PDF_BYTES.toString("base64"), sizeBytes: 1_000 };
      }
      return null;
    });

    const { sendWebsiteFormEmail } = await import("./send-form");
    await sendWebsiteFormEmail({
      kind: "furniture_cleaning",
      pageId: "page_offerte",
      sourceId: "fixed:quote:form",
      fields: { name: "Piet", email: "piet@example.com" },
      uploadedAttachments: [
        {
          filename: "huge.jpg",
          contentType: "image/jpeg",
          sizeBytes: MAILBOX_MAX_ATTACHMENT_BYTES - 100,
          storagePath: "uploads/11111111-1111-4111-8111-111111111111/01-huge.jpg",
        },
        {
          filename: "extra.pdf",
          contentType: "application/pdf",
          sizeBytes: 1_000,
          storagePath: "uploads/11111111-1111-4111-8111-111111111111/02-extra.pdf",
        },
      ],
    });

    const graphArgs = sendGraphAdminReply.mock.calls[0]?.[0] as {
      attachments: Array<{ filename: string }>;
      html: string;
    };
    expect(graphArgs.attachments.map((a) => a.filename)).toEqual(["huge.jpg"]);
    expect(graphArgs.html).toContain("huge.jpg");
    expect(graphArgs.html).toContain("extra.pdf");
    expect(updateRequestNotification).toHaveBeenCalledWith("req-1", "sent");
  });
});
