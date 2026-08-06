import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import { isStorefrontIndexable, readIndexingEnv } from "@mccoy/security/indexing";
import { applySecurityHeaders } from "@mccoy/security/headers";
import { brotliCompressSync, gzipSync } from "node:zlib";
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

ensureMonorepoEnvLoaded();

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function shouldCompress(contentType: string | null): boolean {
  if (!contentType) return false;
  return (
    contentType.includes("text/") ||
    contentType.includes("javascript") ||
    contentType.includes("json") ||
    contentType.includes("xml") ||
    contentType.includes("svg")
  );
}

/**
 * Gzip/Brotli for production Node serving (`npm start` / srvx).
 * Disabled by default: Vite preview forces Content-Encoding: identity on HTML
 * for streaming and would mislabel a gzip body if we compressed first.
 */
async function maybeCompressResponse(request: Request, response: Response): Promise<Response> {
  if (process.env.MCCOY_ENABLE_RESPONSE_COMPRESSION !== "1") return response;
  if (request.method === "HEAD") return response;
  if (!shouldCompress(response.headers.get("content-type"))) return response;

  const existing = response.headers.get("content-encoding");
  if (existing && existing !== "identity") return response;

  const accept = request.headers.get("accept-encoding") ?? "";
  const useBr = /\bbr\b/.test(accept);
  const useGzip = /\bgzip\b/.test(accept);
  if (!useBr && !useGzip) return response;

  const input = Buffer.from(await response.arrayBuffer());
  if (input.byteLength < 1024) {
    return new Response(input, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const compressed = useBr ? brotliCompressSync(input) : gzipSync(input);
  const headers = new Headers(response.headers);
  headers.set("content-encoding", useBr ? "br" : "gzip");
  headers.set("content-length", String(compressed.byteLength));
  headers.set("vary", mergeVary(headers.get("vary"), "Accept-Encoding"));
  headers.delete("transfer-encoding");

  return new Response(compressed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function mergeVary(existing: string | null, value: string): string {
  if (!existing) return value;
  const parts = existing.split(",").map((p) => p.trim().toLowerCase());
  if (parts.includes(value.toLowerCase())) return existing;
  return `${existing}, ${value}`;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const captured = consumeLastCapturedError();
  // #region agent log
  const capturedSummary =
    captured instanceof Error
      ? {
          name: captured.name,
          message: captured.message,
          isNotFound: (captured as { isNotFound?: boolean }).isNotFound === true,
        }
      : captured && typeof captured === "object"
        ? {
            keys: Object.keys(captured as object).slice(0, 12),
            isNotFound: (captured as { isNotFound?: boolean }).isNotFound === true,
            message: String((captured as { message?: unknown }).message ?? ""),
          }
        : { raw: String(captured) };
  fetch("http://127.0.0.1:7637/ingest/e5fb6361-a078-4df0-a695-d0e399b9e246", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8f1793" },
    body: JSON.stringify({
      sessionId: "8f1793",
      runId: "pre-fix",
      hypothesisId: "A",
      location: "server.ts:normalizeCatastrophicSsrResponse",
      message: "h3 HTTPError 500 normalized",
      data: { bodyPreview: body.slice(0, 200), capturedSummary },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  console.error(captured ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function withIndexingHeaders(response: Response): Response {
  if (isStorefrontIndexable(readIndexingEnv())) return response;
  // Align with Vercel preview X-Robots-Tag; also covers staging prod-like deploys
  // that set MCCOY_ALLOW_INDEXING=0.
  if (response.headers.get("x-robots-tag")?.toLowerCase().includes("noindex")) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const reqUrl = request.url;
    const reqMethod = request.method;
    try {
      ensureMonorepoEnvLoaded();
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      // #region agent log
      fetch("http://127.0.0.1:7637/ingest/e5fb6361-a078-4df0-a695-d0e399b9e246", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8f1793" },
        body: JSON.stringify({
          sessionId: "8f1793",
          runId: "pre-fix",
          hypothesisId: "B",
          location: "server.ts:fetch",
          message: "SSR handler response",
          data: {
            url: reqUrl,
            method: reqMethod,
            status: response.status,
            contentType: response.headers.get("content-type"),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      const normalized = await normalizeCatastrophicSsrResponse(response);
      const withRobots = withIndexingHeaders(normalized);
      const secured = applySecurityHeaders(withRobots, { app: "storefront" });
      return await maybeCompressResponse(request, secured);
    } catch (error) {
      // #region agent log
      fetch("http://127.0.0.1:7637/ingest/e5fb6361-a078-4df0-a695-d0e399b9e246", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8f1793" },
        body: JSON.stringify({
          sessionId: "8f1793",
          runId: "pre-fix",
          hypothesisId: "C",
          location: "server.ts:fetch:catch",
          message: "fetch threw before normalize",
          data: {
            url: reqUrl,
            method: reqMethod,
            name: error instanceof Error ? error.name : typeof error,
            message: error instanceof Error ? error.message : String(error),
            code: (error as { code?: string })?.code,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      console.error(error);
      return applySecurityHeaders(
        withIndexingHeaders(
          new Response(renderErrorPage(), {
            status: 500,
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
        ),
        { app: "storefront" },
      );
    }
  },
};

// Warm home snapshot after boot so the first visitor skips cold CMS resolve.
void import("./lib/cms/load-published-page.server")
  .then((m) => Promise.all([m.loadPublishedPageSnapshot("/"), m.loadPublishedPageSnapshot("/en")]))
  .catch(() => {
    /* ignore warm failures — request path still loads */
  });
