import { describe, expect, it } from "vitest";

import {
  REALTIME_TOKEN_MIN_REMAINING_MS,
  decodeAccessTokenExpMs,
  isAccessTokenUsable,
} from "./realtime-token";

/** Builds a fake JWT with the given `exp` (Unix seconds). */
function fakeJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ exp: expSeconds }));
  return `${header}.${payload}.sig`;
}

describe("decodeAccessTokenExpMs", () => {
  it("decodes the exp claim to epoch milliseconds", () => {
    const exp = Math.floor(Date.now() / 1000) + 600;
    expect(decodeAccessTokenExpMs(fakeJwt(exp))).toBe(exp * 1000);
  });

  it("returns null for a malformed token", () => {
    expect(decodeAccessTokenExpMs("not-a-jwt")).toBeNull();
    expect(decodeAccessTokenExpMs("")).toBeNull();
    expect(decodeAccessTokenExpMs("only.one")).toBeNull();
  });

  it("returns null when exp is missing or non-numeric", () => {
    const header = btoa(JSON.stringify({ alg: "none" }));
    expect(
      decodeAccessTokenExpMs(`${header}.${btoa(JSON.stringify({ sub: "x" }))}.sig`),
    ).toBeNull();
    expect(
      decodeAccessTokenExpMs(`${header}.${btoa(JSON.stringify({ exp: "soon" }))}.sig`),
    ).toBeNull();
  });
});

describe("isAccessTokenUsable", () => {
  it("accepts a token with comfortable remaining lifetime", () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    expect(isAccessTokenUsable(fakeJwt(exp), REALTIME_TOKEN_MIN_REMAINING_MS)).toBe(true);
  });

  it("rejects a token inside the safety margin (would make setAuth silently no-op)", () => {
    // 20s left — less than the 30s margin, so subscribing risks joining as anon.
    const exp = Math.floor(Date.now() / 1000) + 20;
    expect(isAccessTokenUsable(fakeJwt(exp), REALTIME_TOKEN_MIN_REMAINING_MS)).toBe(false);
  });

  it("rejects an already-expired token", () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    expect(isAccessTokenUsable(fakeJwt(exp), REALTIME_TOKEN_MIN_REMAINING_MS)).toBe(false);
  });

  it("rejects a malformed token (never subscribe as anon)", () => {
    expect(isAccessTokenUsable("garbage", REALTIME_TOKEN_MIN_REMAINING_MS)).toBe(false);
    expect(isAccessTokenUsable("", REALTIME_TOKEN_MIN_REMAINING_MS)).toBe(false);
  });

  it("respects a custom minimum-remaining threshold", () => {
    const exp = Math.floor(Date.now() / 1000) + 45;
    expect(isAccessTokenUsable(fakeJwt(exp), 60_000)).toBe(false);
    expect(isAccessTokenUsable(fakeJwt(exp), 30_000)).toBe(true);
  });
});
