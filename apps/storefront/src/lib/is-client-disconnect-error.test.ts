import { describe, expect, it } from "vitest";
import { isClientDisconnectError } from "./is-client-disconnect-error";

describe("isClientDisconnectError", () => {
  it("detects ECONNRESET on the error itself", () => {
    expect(isClientDisconnectError(Object.assign(new Error("aborted"), { code: "ECONNRESET" }))).toBe(
      true,
    );
  });

  it("detects ECONNRESET on nested cause (h3 HTTPError shape)", () => {
    const cause = Object.assign(new Error("aborted"), { code: "ECONNRESET" });
    const wrapped = Object.assign(new Error("aborted"), {
      cause,
      status: 500,
      unhandled: true,
    });
    expect(isClientDisconnectError(wrapped)).toBe(true);
  });

  it("detects AbortError by name", () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    expect(isClientDisconnectError(err)).toBe(true);
  });

  it("detects socket hang up", () => {
    expect(isClientDisconnectError(new Error("socket hang up"))).toBe(true);
  });

  it("rejects ordinary application errors", () => {
    expect(isClientDisconnectError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isClientDisconnectError(new Error("CMS publish failed"))).toBe(false);
    expect(isClientDisconnectError(null)).toBe(false);
    expect(isClientDisconnectError(undefined)).toBe(false);
  });
});
