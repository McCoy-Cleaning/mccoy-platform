import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getWebsiteRequest = vi.fn();
const listWebsiteRequestMailMessages = vi.fn();
const getStoredWebsiteRequestAttachment = vi.fn();
const createStoredWebsiteRequestAttachmentAccess = vi.fn();
const storeWebsiteRequestAttachments = vi.fn();
const getGraphFormInboxAttachment = vi.fn();
const findGraphFormNotificationByRequestNumber = vi.fn();
const shouldAttemptGraphMail = vi.fn(() => true);
const getGraphMailConfig = vi.fn(() => ({
  tenantId: "t",
  clientId: "c",
  clientSecret: "s",
  mailbox: "info@mccoy.nl",
}));

vi.mock("@mccoy/database/server", () => ({
  getWebsiteRequest: (...args: unknown[]) => getWebsiteRequest(...args),
  listWebsiteRequests: vi.fn(),
  setWebsiteRequestStatus: vi.fn(),
  listWebsiteRequestMailMessages: (...args: unknown[]) => listWebsiteRequestMailMessages(...args),
  getStoredWebsiteRequestAttachment: (...args: unknown[]) =>
    getStoredWebsiteRequestAttachment(...args),
  createStoredWebsiteRequestAttachmentAccess: (...args: unknown[]) =>
    createStoredWebsiteRequestAttachmentAccess(...args),
  storeWebsiteRequestAttachments: (...args: unknown[]) =>
    storeWebsiteRequestAttachments(...args),
}));

vi.mock("./form-inbox-provider", () => ({
  shouldAttemptGraphMail: () => shouldAttemptGraphMail(),
}));

vi.mock("./graph-config", () => ({
  getGraphMailConfig: () => getGraphMailConfig(),
}));

vi.mock("./graph-mail", () => ({
  getGraphFormInboxAttachment: (...args: unknown[]) => getGraphFormInboxAttachment(...args),
  findGraphFormNotificationByRequestNumber: (...args: unknown[]) =>
    findGraphFormNotificationByRequestNumber(...args),
  findGraphMessageByInternetMessageId: vi.fn(async () => null),
  listGraphConversationSyncMessages: vi.fn(async () => []),
  listGraphFormInboxAttachments: vi.fn(async () => []),
  deleteGraphFormInboxMessage: vi.fn(),
}));

import { getWebsiteRequestFormInboxAttachment } from "./website-request-inbox";
import { encodeRequestMessageId } from "./inbox-message-id";

describe("getWebsiteRequestFormInboxAttachment", () => {
  beforeEach(() => {
    getWebsiteRequest.mockReset();
    listWebsiteRequestMailMessages.mockReset();
    getStoredWebsiteRequestAttachment.mockReset();
    getStoredWebsiteRequestAttachment.mockResolvedValue(null);
    createStoredWebsiteRequestAttachmentAccess.mockReset();
    createStoredWebsiteRequestAttachmentAccess.mockResolvedValue(null);
    storeWebsiteRequestAttachments.mockReset();
    storeWebsiteRequestAttachments.mockResolvedValue({ status: "stored", count: 1 });
    getGraphFormInboxAttachment.mockReset();
    findGraphFormNotificationByRequestNumber.mockReset();
    findGraphFormNotificationByRequestNumber.mockResolvedValue(null);
    shouldAttemptGraphMail.mockReturnValue(true);
    getGraphMailConfig.mockReturnValue({
      tenantId: "t",
      clientId: "c",
      clientSecret: "s",
      mailbox: "info@mccoy.nl",
    });
  });

  it("returns short-lived private-storage URLs before consulting mail", async () => {
    const requestId = "99999999-9999-4999-8999-999999999999";
    const inboxId = encodeRequestMessageId(requestId, "website-requests");
    const filename = "situatie.webp";
    getWebsiteRequest.mockResolvedValue({
      id: requestId,
      number: "WR-2026-00100",
      kind: "glass_washing",
      status: "new",
      fields: {},
      attachments: [{ filename, contentType: "image/webp", sizeBytes: 12 }],
      replies: [],
      createdAt: "2026-08-18T10:00:00.000Z",
      updatedAt: "2026-08-18T10:00:00.000Z",
    });
    createStoredWebsiteRequestAttachmentAccess.mockResolvedValue({
      contentUrl: "https://storage.test/content",
      downloadUrl: "https://storage.test/download",
      expiresAt: "2026-08-18T10:05:00.000Z",
      sizeBytes: 12,
    });

    const result = await getWebsiteRequestFormInboxAttachment(inboxId, filename);

    expect(createStoredWebsiteRequestAttachmentAccess).toHaveBeenCalledWith({
      requestId,
      filename,
      storagePath: undefined,
    });
    expect(getStoredWebsiteRequestAttachment).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        filename,
        contentType: "image/webp",
        contentUrl: "https://storage.test/content",
        downloadUrl: "https://storage.test/download",
        size: 12,
      }),
    );
    expect(getGraphFormInboxAttachment).not.toHaveBeenCalled();
    expect(findGraphFormNotificationByRequestNumber).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("downloads PDF/photo bytes from the Graph form-notification message", async () => {
    const requestId = "11111111-1111-4111-8111-111111111111";
    const inboxId = encodeRequestMessageId(requestId, "website-requests");

    getWebsiteRequest.mockResolvedValue({
      id: requestId,
      number: "WR-2026-00042",
      kind: "job_application",
      status: "new",
      submitterName: "Jorien",
      submitterEmail: "j@example.com",
      submitterPhone: null,
      submitterCompany: null,
      subject: "Sollicitatie",
      fields: {},
      attachments: [
        {
          filename: "Curriculum Vitae Jorien 20201 (1).doc",
          contentType: "application/msword",
          sizeBytes: 33_000,
        },
      ],
      replies: [],
      notificationState: "sent",
      notificationError: null,
      companyId: null,
      formId: null,
      sourcePageId: null,
      scopeKey: null,
      scopeLabel: null,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
      lastRepliedAt: null,
    });

    listWebsiteRequestMailMessages.mockResolvedValue([
      {
        id: "mail-1",
        request_id: requestId,
        direction: "inbound",
        provider: "website_form",
        mailbox: "info@mccoy.nl",
        graph_message_id: "graph-form-root",
        internet_message_id: null,
        conversation_id: null,
        conversation_index: null,
        in_reply_to: null,
        references_header: null,
        sender_address: "noreply@mccoy.nl",
        recipient_addresses: ["info@mccoy.nl"],
        subject: "Sollicitatie (WR-2026-00042)",
        body_text: null,
        occurred_at: "2026-08-01T10:00:00.000Z",
        is_read: true,
        created_at: "2026-08-01T10:00:00.000Z",
      },
    ]);

    const contentBase64 = Buffer.from("%PDF-1.4").toString("base64");
    getGraphFormInboxAttachment.mockResolvedValue({
      filename: "Curriculum Vitae Jorien 20201 (1).doc",
      contentType: "application/msword",
      size: 33_000,
      contentBase64,
      omitted: false,
      part: "att-1",
    });

    const result = await getWebsiteRequestFormInboxAttachment(
      inboxId,
      "Curriculum Vitae Jorien 20201 (1).doc",
    );

    expect(getGraphFormInboxAttachment).toHaveBeenCalledWith(
      "graph-form-root",
      "Curriculum Vitae Jorien 20201 (1).doc",
      "info@mccoy.nl",
      { sizeBytes: 33_000, maxBytes: 25 * 1024 * 1024 },
    );
    expect(result?.contentBase64).toBe(contentBase64);
    expect(findGraphFormNotificationByRequestNumber).not.toHaveBeenCalled();
  });

  it("returns null when request-backed download has no Graph content", async () => {
    const requestId = "22222222-2222-4222-8222-222222222222";
    const inboxId = encodeRequestMessageId(requestId, "website-requests");

    getWebsiteRequest.mockResolvedValue({
      id: requestId,
      number: "WR-2026-00099",
      kind: "job_application",
      status: "open",
      submitterName: "Ada",
      submitterEmail: "a@example.com",
      submitterPhone: null,
      submitterCompany: null,
      subject: "Sollicitatie",
      fields: {},
      attachments: [{ filename: "cv.pdf", contentType: "application/pdf", sizeBytes: 12_000 }],
      replies: [],
      notificationState: "sent",
      notificationError: null,
      companyId: null,
      formId: null,
      sourcePageId: null,
      scopeKey: null,
      scopeLabel: null,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
      lastRepliedAt: null,
    });
    listWebsiteRequestMailMessages.mockResolvedValue([]);

    await expect(getWebsiteRequestFormInboxAttachment(inboxId, "cv.pdf")).resolves.toBeNull();
    expect(findGraphFormNotificationByRequestNumber).toHaveBeenCalledWith({
      requestNumber: "WR-2026-00099",
      mailbox: "info@mccoy.nl",
      createdAt: "2026-08-01T10:00:00.000Z",
    });
  });

  it("downloads a 33KB .doc when mail_messages is empty and recency scan would miss it", async () => {
    const requestId = "33333333-3333-4333-8333-333333333333";
    const inboxId = encodeRequestMessageId(requestId, "website-requests");
    const filename = "Curriculum Vitae Jorien 20201 (1).doc";
    const contentBase64 = Buffer.from("old-cv-bytes").toString("base64");

    getWebsiteRequest.mockResolvedValue({
      id: requestId,
      number: "WR-2026-00007",
      kind: "job_application",
      status: "open",
      submitterName: "Jorien",
      submitterEmail: "j@example.com",
      submitterPhone: null,
      submitterCompany: null,
      subject: "Sollicitatie",
      fields: {},
      attachments: [{ filename, contentType: "application/msword", sizeBytes: 33_000 }],
      replies: [],
      notificationState: "sent",
      notificationError: null,
      companyId: null,
      formId: null,
      sourcePageId: null,
      scopeKey: null,
      scopeLabel: null,
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
      lastRepliedAt: null,
    });
    listWebsiteRequestMailMessages.mockResolvedValue([]);
    findGraphFormNotificationByRequestNumber.mockResolvedValue({
      id: "graph-old-form",
      mailbox: "info@mccoy.nl",
      subject: "Sollicitatie (WR-2026-00007)",
    });
    getGraphFormInboxAttachment.mockResolvedValue({
      filename,
      contentType: "application/msword",
      size: 33_000,
      contentBase64,
      omitted: false,
      part: "att-doc",
    });

    const result = await getWebsiteRequestFormInboxAttachment(inboxId, filename);

    expect(findGraphFormNotificationByRequestNumber).toHaveBeenCalledWith({
      requestNumber: "WR-2026-00007",
      mailbox: "info@mccoy.nl",
      createdAt: "2026-01-01T10:00:00.000Z",
    });
    expect(getGraphFormInboxAttachment).toHaveBeenCalledWith(
      "graph-old-form",
      filename,
      "info@mccoy.nl",
      { sizeBytes: 33_000, maxBytes: 25 * 1024 * 1024 },
    );
    expect(result?.contentBase64).toBe(contentBase64);
    expect(result?.size).toBe(33_000);
  });

  it("looks up by WR in body when subject-only contains() would miss the message", async () => {
    const requestId = "44444444-4444-4444-8444-444444444444";
    const inboxId = encodeRequestMessageId(requestId, "website-requests");
    const filename = "Curriculum Vitae Jorien 20201 (1).doc";
    const contentBase64 = Buffer.from("body-wr-cv").toString("base64");

    getWebsiteRequest.mockResolvedValue({
      id: requestId,
      number: "WR-2026-00007",
      kind: "job_application",
      status: "open",
      submitterName: "Jorien",
      submitterEmail: "j@example.com",
      submitterPhone: null,
      submitterCompany: null,
      subject: "Sollicitatie",
      fields: {},
      attachments: [{ filename, contentType: "application/msword", sizeBytes: 33_000 }],
      replies: [],
      notificationState: "sent",
      notificationError: null,
      companyId: null,
      formId: null,
      sourcePageId: null,
      scopeKey: null,
      scopeLabel: null,
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
      lastRepliedAt: null,
    });
    listWebsiteRequestMailMessages.mockResolvedValue([]);
    findGraphFormNotificationByRequestNumber.mockResolvedValue({
      id: "graph-body-wr",
      mailbox: "info@mccoy.nl",
      subject: "Sollicitatie — Jorien",
    });
    getGraphFormInboxAttachment.mockResolvedValue({
      filename,
      contentType: "application/msword",
      size: 33_000,
      contentBase64,
      omitted: false,
      part: "att-doc",
    });

    const result = await getWebsiteRequestFormInboxAttachment(inboxId, filename);

    expect(findGraphFormNotificationByRequestNumber).toHaveBeenCalledWith({
      requestNumber: "WR-2026-00007",
      mailbox: "info@mccoy.nl",
      createdAt: "2026-01-01T10:00:00.000Z",
    });
    expect(result?.contentBase64).toBe(contentBase64);
  });
});
