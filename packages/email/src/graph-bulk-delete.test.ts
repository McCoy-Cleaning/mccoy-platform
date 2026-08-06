import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GRAPH_BATCH_SIZE, bulkDeleteGraphMessages } from "./graph-bulk-delete";

vi.mock("./graph-config", () => ({
  getGraphMailConfig: () => ({
    tenantId: "t",
    clientId: "c",
    clientSecret: "s",
    mailbox: "inbox@mccoy.nl",
  }),
}));

vi.mock("./graph-auth", () => ({
  getGraphAccessToken: vi.fn(async () => "token"),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function batchOk(ids: string[], status = 204) {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        responses: ids.map((id) => ({ id, status })),
      }),
  };
}

describe("bulkDeleteGraphMessages", () => {
  it("returns a per-ID result for every unique target", async () => {
    fetchMock.mockResolvedValueOnce(batchOk(["1", "2"]));

    const result = await bulkDeleteGraphMessages({
      mailbox: "inbox@mccoy.nl",
      targets: [
        { messageId: "graph:a", graphId: "g1" },
        { messageId: "graph:b", graphId: "g2" },
      ],
    });

    expect(result.requestedCount).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.deletedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.requests).toHaveLength(2);
    expect(body.requests[0].method).toBe("POST");
    expect(body.requests[0].url).toContain("/move");
  });

  it("chunks more than 20 IDs into multiple Graph batches", async () => {
    const targets = Array.from({ length: 41 }, (_, i) => ({
      messageId: `graph:m${i}`,
      graphId: `gid-${i}`,
    }));

    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        requests: Array<{ id: string }>;
      };
      return batchOk(body.requests.map((r) => r.id));
    });

    const result = await bulkDeleteGraphMessages({
      mailbox: "inbox@mccoy.nl",
      targets,
    });

    expect(result.results).toHaveLength(41);
    expect(result.deletedCount).toBe(41);
    expect(result.chunkCount).toBe(Math.ceil(41 / GRAPH_BATCH_SIZE));
    expect(result.graphRequestCount).toBe(result.chunkCount);
    expect(fetchMock.mock.calls.length).toBe(result.chunkCount);
    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse(String(call[1]?.body)) as { requests: unknown[] };
      expect(body.requests.length).toBeLessThanOrEqual(GRAPH_BATCH_SIZE);
    }
  });

  it("treats envelope 200 with a failed subresponse as partial failure", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            responses: [
              { id: "1", status: 204 },
              { id: "2", status: 403 },
            ],
          }),
      })
      // hard-delete fallback for the failed move
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            responses: [{ id: "1", status: 403 }],
          }),
      });

    const result = await bulkDeleteGraphMessages({
      mailbox: "inbox@mccoy.nl",
      targets: [
        { messageId: "graph:ok", graphId: "ok" },
        { messageId: "graph:bad", graphId: "bad" },
      ],
    });

    expect(result.deletedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    const failed = result.results.find((r) => r.messageId === "graph:bad");
    expect(failed?.status).toBe("failed");
    expect(failed?.statusCode).toBe(403);
    expect(failed?.retryable).toBe(false);
  });

  it("marks missing subresponses as failed instead of silent success", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        requests: Array<{ id: string; method: string }>;
      };
      if (body.requests.length === 1) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              responses: [{ id: "1", status: 403 }],
            }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            responses: [{ id: "1", status: 204 }],
          }),
      };
    });

    const result = await bulkDeleteGraphMessages({
      mailbox: "inbox@mccoy.nl",
      targets: [
        { messageId: "graph:a", graphId: "a" },
        { messageId: "graph:b", graphId: "b" },
      ],
    });

    expect(result.results.find((r) => r.messageId === "graph:a")?.status).toBe("deleted");
    expect(result.results.find((r) => r.messageId === "graph:b")?.status).toBe("failed");
    expect(result.failedCount).toBe(1);
  });

  it("treats 404 as already_absent", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          responses: [{ id: "1", status: 404 }],
        }),
    });

    const result = await bulkDeleteGraphMessages({
      mailbox: "inbox@mccoy.nl",
      targets: [{ messageId: "graph:gone", graphId: "gone" }],
    });

    expect(result.alreadyAbsentCount).toBe(1);
    expect(result.results[0]?.status).toBe("already_absent");
  });
});
