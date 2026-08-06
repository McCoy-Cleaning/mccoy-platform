import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultBlock } from "@mccoy/cms-schema";
import { RegisteredBlockView } from "./RegisteredBlockView";

const XSS_PAYLOAD = `<img src=x onerror=alert(1)><script>alert(1)</script>`;

describe("CMS renderer XSS (React text nodes)", () => {
  it("renders hostile hero title as escaped text, not HTML nodes", () => {
    const block = createDefaultBlock("hero");
    block.data = { ...block.data, title: XSS_PAYLOAD, subtitle: XSS_PAYLOAD };

    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, { block, adminMode: true }),
    );

    expect(html).toContain("hero-heading");
    expect(html).not.toMatch(/<img\s+src=x/i);
    expect(html).not.toMatch(/<script>alert\(1\)<\/script>/i);
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders hostile richText body without executable markup", () => {
    const block = createDefaultBlock("richText");
    block.data = { ...block.data, title: "Safe", body: XSS_PAYLOAD };

    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, { block, adminMode: true }),
    );

    expect(html).not.toMatch(/<img\s+src=x/i);
    expect(html).not.toMatch(/<script>alert\(1\)<\/script>/i);
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
  });
});
