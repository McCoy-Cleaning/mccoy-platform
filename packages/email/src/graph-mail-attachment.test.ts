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

function binaryOk(bytes: Uint8Array, contentType = "application/pdf") {
  const copy = bytes.slice();
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
    arrayBuffer: async () => copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength),
    text: async () => "",
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

  it("fetches /$value when the list omits contentBytes", async () => {
    const raw = Buffer.from("%PDF-1.4 value-bytes");
    fetchMock
      .mockResolvedValueOnce(
        jsonOk({
          value: [
            {
              id: "att-value",
              name: "sollicitatie.pdf",
              contentType: "application/pdf",
              size: 12_000,
              isInline: false,
              "@odata.type": "#microsoft.graph.fileAttachment",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(binaryOk(raw, "application/pdf"));

    const { getGraphFormInboxAttachment } = await import("./graph-mail");
    const result = await getGraphFormInboxAttachment(
      "msg-1",
      "sollicitatie.pdf",
      "info@mccoy.nl",
    );

    expect(result?.contentBase64).toBe(raw.toString("base64"));
    expect(result?.omitted).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/attachments$/);
    expect(String(fetchMock.mock.calls[1]?.[0])).toMatch(
      /\/attachments\/att-value\/\$value$/,
    );
  });

  it("downloads a 5MB PDF via $value when maxBytes is 25MB", async () => {
    const raw = Buffer.from("five-meg-pdf-body");
    fetchMock
      .mockResolvedValueOnce(
        jsonOk({
          value: [
            {
              id: "att-5mb",
              name: "cv.pdf",
              contentType: "application/pdf",
              size: 5 * 1024 * 1024,
              isInline: false,
              "@odata.type": "#microsoft.graph.fileAttachment",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(binaryOk(raw, "application/pdf"));

    const { getGraphFormInboxAttachment } = await import("./graph-mail");
    const result = await getGraphFormInboxAttachment("msg-1", "cv.pdf", "info@mccoy.nl", {
      maxBytes: 25 * 1024 * 1024,
    });

    expect(result?.contentBase64).toBe(raw.toString("base64"));
    expect(result?.omitted).toBe(false);
    expect(result?.size).toBe(raw.byteLength);
    expect(String(fetchMock.mock.calls[1]?.[0])).toMatch(/\/attachments\/att-5mb\/\$value$/);
  });

  it("retries attachments list without ImmutableId after 404, then $value succeeds", async () => {
    const raw = Buffer.from("cv-immutable-retry");
    fetchMock
      .mockResolvedValueOnce(jsonError(404, "ErrorItemNotFound"))
      .mockResolvedValueOnce(
        jsonOk({
          value: [
            {
              id: "att-retry",
              name: "Curriculum Vitae Jorien 20201 (1).doc",
              contentType: "application/msword",
              size: 33_000,
              isInline: false,
              "@odata.type": "#microsoft.graph.fileAttachment",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(binaryOk(raw, "application/msword"));

    const { getGraphFormInboxAttachment } = await import("./graph-mail");
    const result = await getGraphFormInboxAttachment(
      "msg-rest-id",
      "Curriculum Vitae Jorien 20201 (1).doc",
      "info@mccoy.nl",
    );

    expect(result?.contentBase64).toBe(raw.toString("base64"));
    expect(result?.omitted).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/attachments$/);
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.Prefer).toBe('IdType="ImmutableId"');
    expect(String(fetchMock.mock.calls[1]?.[0])).toMatch(/\/attachments$/);
    expect(fetchMock.mock.calls[1]?.[1]?.headers?.Prefer).toBeUndefined();
    expect(String(fetchMock.mock.calls[2]?.[0])).toMatch(
      /\/attachments\/att-retry\/\$value$/,
    );
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
      if (url.includes("/attachments")) {
        return jsonOk({
          value: [
            {
              id: "att-1",
              name: "Curriculum Vitae Jorien 20201 (1).doc",
              contentType: "application/msword",
              size: 33_000,
              isInline: false,
              "@odata.type": "#microsoft.graph.fileAttachment",
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

  it("falls back to receivedDateTime $filter when $search is circuit-broken", async () => {
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("$search=")) return jsonError(400, "BadRequest");
      if (url.includes("$filter=")) {
        return jsonOk({
          value: [
            {
              id: "graph-filter-hit",
              subject: "Sollicitatie (WR-2026-00007)",
              bodyPreview: "Aanvraag WR-2026-00007",
            },
          ],
        });
      }
      return jsonOk({ value: [] });
    });

    const { findGraphFormNotificationByRequestNumber } = await import("./graph-mail");
    await findGraphFormNotificationByRequestNumber({
      requestNumber: "WR-2026-00007",
      mailbox: "info@mccoy.nl",
      createdAt: "2026-01-01T10:00:00.000Z",
    });

    fetchMock.mockClear();
    const hit = await findGraphFormNotificationByRequestNumber({
      requestNumber: "WR-2026-00007",
      mailbox: "info@mccoy.nl",
      createdAt: "2026-01-01T10:00:00.000Z",
    });
    expect(hit?.id).toBe("graph-filter-hit");

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("$search="))).toBe(false);
    expect(urls.some((url) => url.includes("$filter="))).toBe(true);
    expect(urls.some((url) => url.includes("contains("))).toBe(false);
    expect(decodeURIComponent(urls.find((url) => url.includes("$filter=")) || "")).toMatch(
      /receivedDateTime ge /,
    );
  });

  it("finds Sollicitatie — Jorien without WR via date window + attachment list", async () => {
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("$search=")) return jsonOk({ value: [] });
      if (url.includes("$filter=")) {
        return jsonOk({
          value: [
            {
              id: "graph-jorien-cv",
              subject: "Sollicitatie — Jorien",
              bodyPreview: "Nieuwe sollicitatie via het websiteformulier.",
              receivedDateTime: "2026-01-01T10:05:00.000Z",
              hasAttachments: true,
            },
          ],
        });
      }
      if (url.includes("/attachments")) {
        return jsonOk({
          value: [
            {
              id: "att-doc",
              name: "Curriculum Vitae Jorien 20201 (1).doc",
              contentType: "application/msword",
              size: 33_000,
              isInline: false,
              "@odata.type": "#microsoft.graph.fileAttachment",
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
      createdAt: "2026-01-01T10:00:00.000Z",
      filename: "Curriculum Vitae Jorien 20201 (1).doc",
      submitterName: "Jorien",
    });
    expect(hit?.id).toBe("graph-jorien-cv");

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    const filterUrl = decodeURIComponent(urls.find((url) => url.includes("$filter=")) || "");
    expect(filterUrl).toMatch(/hasAttachments/);
    expect(filterUrl).toMatch(/receivedDateTime ge /);
    expect(urls.some((url) => url.includes("/attachments"))).toBe(true);
    expect(urls.some((url) => url.includes("contains("))).toBe(false);
    expect(urls.some((url) => /attachment:/i.test(decodeURIComponent(url)))).toBe(false);
  });
});

describe("listGraphFormInboxAttachments", () => {
  it("returns metadata without contentBytes and drops executables", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({
        value: [
          {
            id: "att-photo",
            name: "keuken.jpg",
            contentType: "image/jpeg",
            size: 120_000,
            isInline: false,
            "@odata.type": "#microsoft.graph.fileAttachment",
          },
          {
            id: "att-exe",
            name: "setup.exe",
            contentType: "application/x-msdownload",
            size: 80_000,
            isInline: false,
            "@odata.type": "#microsoft.graph.fileAttachment",
          },
        ],
      }),
    );

    const { listGraphFormInboxAttachments } = await import("./graph-mail");
    const result = await listGraphFormInboxAttachments("msg-reply", "info@mccoy.nl");

    expect(result.map((item) => item.filename)).toEqual(["keuken.jpg"]);
    expect(result[0]?.contentBase64).toBeUndefined();
    expect(result[0]?.omitted).toBe(false);
    expect(result[0]?.part).toBe("att-photo");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/attachments$/);
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toMatch(/\$value/);
  });
});
