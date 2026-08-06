import { describe, expect, it, vi } from "vitest";
import { addTrustedMessageListener, isTrustedMessageOrigin } from "./trusted-message";

describe("trusted-message", () => {
  it("accepts only allowlisted origins", () => {
    expect(isTrustedMessageOrigin("http://localhost:5173", ["http://localhost:5173"])).toBe(true);
    expect(isTrustedMessageOrigin("http://evil.example", ["http://localhost:5173"])).toBe(false);
  });

  it("ignores messages from non-allowlisted origins", () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;
    const handler = vi.fn();
    const unsubscribe = addTrustedMessageListener("http://localhost:5174", handler, target);
    expect(target.addEventListener).toHaveBeenCalledWith("message", expect.any(Function));
    const onMessage = (target.addEventListener as ReturnType<typeof vi.fn>).mock.calls[0][1] as (
      event: MessageEvent,
    ) => void;
    onMessage({ origin: "http://evil.example", data: { ok: true } } as MessageEvent);
    expect(handler).not.toHaveBeenCalled();
    onMessage({ origin: "http://localhost:5174", data: { ok: true } } as MessageEvent);
    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(target.removeEventListener).toHaveBeenCalled();
  });
});
