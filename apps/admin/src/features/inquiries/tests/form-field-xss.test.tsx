import { describe, expect, it } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Mirrors admin Aanvragen FormFieldValue: visitor strings must be React
 * text children (auto-escaped), never raw HTML.
 */
function FormFieldValueProbe({ value }: { value: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/90">
      {value}
    </p>
  );
}

describe("Aanvragen FormFieldValue XSS contract", () => {
  it("escapes script and event-handler payloads as text", () => {
    const payload = `<img src=x onerror=alert(1)><svg/onload=alert(1)>`;
    const html = renderToStaticMarkup(React.createElement(FormFieldValueProbe, { value: payload }));
    expect(html).not.toMatch(/<img\s+src=x/i);
    expect(html).not.toMatch(/<svg\s*\/?onload/i);
    expect(html).toContain("&lt;img");
  });
});
