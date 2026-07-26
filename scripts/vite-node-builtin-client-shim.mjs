/**
 * Client-only stubs for Node builtins that TanStack SSR helpers import.
 * SSR builds (`options.ssr`) keep the real Node modules.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const STREAM_SHIM = path.resolve(dir, "shims/node-stream-stub.mjs");
const STREAM_WEB_SHIM = path.resolve(dir, "shims/node-stream-web-stub.mjs");
const ASYNC_HOOKS_SHIM = path.resolve(dir, "shims/node-async-hooks-stub.mjs");
const PATH_SHIM = path.resolve(dir, "shims/node-path-stub.mjs");
const EMPTY_SHIM = path.resolve(dir, "shims/node-empty-stub.mjs");

const CLIENT_SHIMS = new Map([
  ["node:stream", STREAM_SHIM],
  ["stream", STREAM_SHIM],
  ["node:stream/web", STREAM_WEB_SHIM],
  ["stream/web", STREAM_WEB_SHIM],
  ["node:async_hooks", ASYNC_HOOKS_SHIM],
  ["async_hooks", ASYNC_HOOKS_SHIM],
  ["node:path", PATH_SHIM],
  ["path", PATH_SHIM],
  ["node:fs", EMPTY_SHIM],
  ["node:fs/promises", EMPTY_SHIM],
  ["fs", EMPTY_SHIM],
  ["fs/promises", EMPTY_SHIM],
  ["node:crypto", EMPTY_SHIM],
  ["crypto", EMPTY_SHIM],
  ["node:process", EMPTY_SHIM],
  ["process", EMPTY_SHIM],
  ["node:buffer", EMPTY_SHIM],
  ["buffer", EMPTY_SHIM],
  ["node:util", EMPTY_SHIM],
  ["util", EMPTY_SHIM],
  ["node:events", EMPTY_SHIM],
  ["events", EMPTY_SHIM],
  ["node:os", EMPTY_SHIM],
  ["os", EMPTY_SHIM],
  ["node:url", EMPTY_SHIM],
  ["url", EMPTY_SHIM],
  ["node:net", EMPTY_SHIM],
  ["net", EMPTY_SHIM],
  ["node:tls", EMPTY_SHIM],
  ["tls", EMPTY_SHIM],
  ["node:dns", EMPTY_SHIM],
  ["dns", EMPTY_SHIM],
  ["node:zlib", EMPTY_SHIM],
  ["zlib", EMPTY_SHIM],
  ["node:http", EMPTY_SHIM],
  ["http", EMPTY_SHIM],
  ["node:https", EMPTY_SHIM],
  ["https", EMPTY_SHIM],
  ["node:child_process", EMPTY_SHIM],
  ["child_process", EMPTY_SHIM],
]);

export function nodeBuiltinClientShimPlugin() {
  return {
    name: "mccoy-node-builtin-client-shim",
    enforce: "pre",
    resolveId(source, _importer, options) {
      if (options?.ssr) return null;
      return CLIENT_SHIMS.get(source) ?? null;
    },
  };
}
