import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetGraphQueryCircuitForTests } from "./graph-query-guard";

vi.mock("./graph-config", () => ({
  getGraphMailConfig: () => ({
    tenantId: "t",
    clientId: "c",
    clientSecret: "s",
    mailbox: "info@mccoy.nl",
  }),
}));

vi.mock("./graph-auth", () => ({
  getGraphAccessToken: vi.fn(async () => "token"),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  resetGraphQueryCircuitForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonOk(body: unknown, status = 200) {
  return {
    ok: true,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

function accepted() {
  return {
    ok: true,
    status: 202,
    text: async () => "",
  };
}

describe("Graph large attachment send", () => {
  it("keeps tiny payloads on sendMail", async () => {
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/sendMail")) return jsonOk({});
      return jsonOk({ value: [] });
    });

    const { sendGraphAdminReply, shouldUseGraphLargeAttachmentSend } = await import("./graph-mail");
    expect(
      shouldUseGraphLargeAttachmentSend(
        [{ filename: "tiny.jpg", contentBase64: "QQ==", contentType: "image/jpeg" }],
        800,
      ),
    ).toBe(false);

    const result = await sendGraphAdminReply({
      to: "info@mccoy.nl",
      subject: "Offerte glasbewassing — Test (WR-1)",
      html: "<p>Hallo</p>",
      text: "Hallo",
      saveToSentItems: false,
      attachments: [{ filename: "tiny.jpg", contentBase64: "QQ==", contentType: "image/jpeg" }],
    });
    expect(result.ok).toBe(true);
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("/sendMail"))).toBe(true);
    expect(urls.some((url) => url.includes("createUploadSession"))).toBe(false);
    const sendMailCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/sendMail"));
    const body = JSON.parse(String(sendMailCall?.[1]?.body ?? "{}")) as { saveToSentItems?: boolean };
    expect(body.saveToSentItems).toBe(false);
  });

  it("uses a draft + upload session when a file exceeds simple send", async () => {
    const big = Buffer.alloc(Math.floor(2.6 * 1024 * 1024), 7).toString("base64");
    fetchMock.mockImplementation(async (input: unknown, init?: { method?: string }) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.startsWith("https://upload.example/")) {
        return { ok: true, status: 201, text: async () => "" };
      }
      if (url.includes("/sendMail")) {
        throw new Error("simple sendMail must not be used for large attachments");
      }
      if (method === "POST" && url.includes("createUploadSession")) {
        return jsonOk({ uploadUrl: "https://upload.example/session" });
      }
      if (method === "POST" && /\/messages\/[^/]+\/send$/.test(url)) {
        return accepted();
      }
      if (method === "POST" && /\/users\/[^/]+\/messages$/.test(url)) {
        return jsonOk({ id: "draft-1" });
      }
      if (url.includes("sentitems")) {
        return jsonOk({ value: [] });
      }
      if (method === "DELETE") return { ok: true, status: 204, text: async () => "" };
      return jsonOk({});
    });

    const {
      sendGraphAdminReply,
      shouldUseGraphLargeAttachmentSend,
      estimateGraphSendMailPayloadBytes,
    } = await import("./graph-mail");
    const attachments = [
      { filename: "cv.pdf", contentBase64: big, contentType: "application/pdf" },
    ];
    const payloadBytes = estimateGraphSendMailPayloadBytes({
      subject: "Sollicitatie — Jorien (WR-1)",
      html: "<p>cv</p>",
      text: "cv",
      attachments,
    });
    expect(shouldUseGraphLargeAttachmentSend(attachments, payloadBytes)).toBe(true);

    const result = await sendGraphAdminReply({
      to: "info@mccoy.nl",
      subject: "Sollicitatie — Jorien (WR-1)",
      html: "<p>cv</p>",
      text: "cv",
      saveToSentItems: false,
      attachments,
    });
    expect(result.ok).toBe(true);

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("/sendMail"))).toBe(false);
    expect(urls.some((url) => url.includes("createUploadSession"))).toBe(true);
    expect(urls.some((url) => url.startsWith("https://upload.example/"))).toBe(true);
    expect(urls.some((url) => /\/messages\/draft-1\/send$/.test(url))).toBe(true);

    const sessionCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("createUploadSession"),
    );
    const sessionBody = JSON.parse(String(sessionCall?.[1]?.body ?? "{}")) as {
      AttachmentItem?: { name?: string; attachmentType?: string };
    };
    expect(sessionBody.AttachmentItem?.attachmentType).toBe("file");
    expect(sessionBody.AttachmentItem?.name).toBe("cv.pdf");

    const putCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).startsWith("https://upload.example/"),
    );
    expect(putCall?.[1]?.method).toBe("PUT");
    expect(String(putCall?.[1]?.headers?.["Content-Range"] || "")).toMatch(/^bytes 0-\d+\/\d+$/);
  });
});
