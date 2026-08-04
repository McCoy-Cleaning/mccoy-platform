import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CmsButtonView } from "./primitives";

describe("CmsButtonView", () => {
  it("renders an anchor for page links", () => {
    const html = renderToStaticMarkup(
      React.createElement(CmsButtonView, {
        button: {
          label: "Contact",
          link: { type: "internal_route", route: "contact" },
        },
        className: "btn",
      }),
    );
    expect(html).toContain("href=");
    expect(html).toContain("Contact");
  });

  it("renders nothing for geen link", () => {
    const html = renderToStaticMarkup(
      React.createElement(CmsButtonView, {
        button: {
          label: "Verborgen",
          link: { type: "none" },
        },
      }),
    );
    expect(html).toBe("");
  });

  it("renders a dialog-trigger button for popup action (closed on SSR)", () => {
    const html = renderToStaticMarkup(
      React.createElement(CmsButtonView, {
        button: {
          label: "Meer info",
          action: "popup",
          link: { type: "none" },
          popup: {
            type: "richText",
            data: { title: "Popup titel", body: "Inhoud" },
          },
        },
        className: "btn",
      }),
    );
    expect(html).toContain("Meer info");
    expect(html).toContain('type="button"');
    expect(html).not.toContain("href=");
    expect(html).not.toContain("Popup titel");
  });
});
