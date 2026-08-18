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

function jsonOk(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  };
}

function jsonError(status: number, code: string) {
  return {
    ok: false,
    status,
    text: async () => JSON.stringify({ error: { code, message: code } }),
  };
}

describe("getGraphFormInboxAttachment", () => {
  it("returns contentBytes from the attachments list for a 33KB .doc", async () => {
    const bytes = Buffer.from("cv-doc-bytes").toString("base64");
    fetchMock.mockResolvedValueOnce(
      jsonOk({
        value: [
          {
            id: "att-1",
            name: "Curriculum Vitae Jorien 20201 (1).doc",
            contentType: "application/msword",
            size: 33_000,
            contentBytes: bytes,
            isInline: false,
            "@odata.type": "#microsoft.graph.fileAttachment",
          },
        ],
      }),
    );

    const { getGraphFormInboxAttachment } = await import("./graph-mail");
    const result = await getGraphFormInboxAttachment(
      "msg-1",
      "Curriculum Vitae Jorien 20201 (1).doc",
      "info@mccoy.nl",
    );

    expect(result?.contentBase64).toBe(bytes);
    expect(result?.size).toBe(33_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/attachments$/);
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toMatch(/\$select=/);
  });

  it("downloads the only file when Graph renamed the attachment", async () => {
    const bytes = Buffer.from("pdf-bytes").toString("base64");
    fetchMock.mockResolvedValueOnce(
      jsonOk({
        value: [
          {
            id: "att-pdf",
            name: "bijlage.pdf",
            contentType: "application/pdf",
            size: 12_000,
            contentBytes: bytes,
            isInline: false,
            "@odata.type": "#microsoft.graph.fileAttachment",
          },
        ],
      }),
    );

    const { getGraphFormInboxAttachment } = await import("./graph-mail");
    const result = await getGraphFormInboxAttachment(
      "msg-1",
      "sollicitatie.pdf",
      "info@mccoy.nl",
    );
    expect(result?.contentBase64).toBe(bytes);
  });

  it("returns inline image bytes so form photos appear in BIJLAGEN", async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
    fetchMock.mockResolvedValueOnce(
      jsonOk({
        value: [
          {
            id: "att-img",
            name: "situatie.jpg",
            contentType: "image/jpeg",
            size: 4,
            contentBytes: bytes,
            isInline: true,
            "@odata.type": "#microsoft.graph.fileAttachment",
          },
        ],
      }),
    );

    const { getGraphFormInboxAttachment } = await import("./graph-mail");
    const result = await getGraphFormInboxAttachment(
      "msg-1",
      "situatie.jpg",
      "info@mccoy.nl",
    );
    expect(result?.contentBase64).toBe(bytes);
  });
});

describe("findGraphFormNotificationByRequestNumber", () => {
  it("never sends contains(subject), subject:/body:/attachment: KQL, or mixed $search+$filter", async () => {
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("$search=")) {
        return jsonOk({
          value: [
            {
              id: "graph-body-only",
              subject: "Sollicitatie — Jorien",
              bodyPreview: "Aanvraag WR-2026-00007",
              hasAttachments: true,
            },
          ],
        });
      }
      return jsonOk({ value: [] });
    });

    const { findGraphFormNotificationByRequestNumber } = await import("./graph-mail");
    const hit = await findGraphFormNotificationByRequestNumber({
      requestNumber: "WR-2026-00007",
      mailbox: "info@mccoy.nl",
      filename: "Curriculum Vitae Jorien 20201 (1).doc",
    });
    expect(hit?.id).toBe("graph-body-only");

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("contains("))).toBe(false);
    expect(urls.some((url) => /attachment:/i.test(decodeURIComponent(url)))).toBe(false);
    expect(urls.some((url) => /subject:/i.test(decodeURIComponent(url)))).toBe(false);
    expect(urls.some((url) => /body:/i.test(decodeURIComponent(url)))).toBe(false);
    expect(urls.filter((url) => url.includes("$search="))).toHaveLength(1);
    expect(urls.some((url) => url.includes("$search=") && url.includes("$filter="))).toBe(
      false,
    );
    expect(urls.some((url) => url.includes("$search=") && url.includes("$select="))).toBe(
      false,
    );
    expect(urls.some((url) => url.includes("$search=") && url.includes("$orderby="))).toBe(
      false,
    );
  });

  it("does not retry a 400 $search in a storm", async () => {
    fetchMock.mockImplementation(async () => jsonError(400, "BadRequest"));

    const { findGraphFormNotificationByRequestNumber } = await import("./graph-mail");
    await findGraphFormNotificationByRequestNumber({
      requestNumber: "WR-2026-00007",
      mailbox: "info@mccoy.nl",
    });
    const afterFirst = fetchMock.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);
    expect(afterFirst).toBeLessThan(8);

    await findGraphFormNotificationByRequestNumber({
      requestNumber: "WR-2026-00007",
      mailbox: "info@mccoy.nl",
    });
    const afterSecond = fetchMock.mock.calls.length;
    expect(afterSecond - afterFirst).toBeLessThan(afterFirst);
    const searchCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("$search="),
    );
    expect(searchCalls).toHaveLength(1);
  });
});
