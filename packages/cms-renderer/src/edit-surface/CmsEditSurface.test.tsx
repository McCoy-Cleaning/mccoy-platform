import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CmsBlockEditScope,
  CmsEditSurfaceProvider,
  EditableCta,
  EditableMedia,
  EditableText,
  type CmsEditSurfaceApi,
} from "./CmsEditSurface";

describe("Editable* without CmsEditSurfaceProvider", () => {
  it("EditableText with children matches bare children DOM", () => {
    const bare = renderToStaticMarkup(<h2 className="font-display">Hello</h2>);
    const wrapped = renderToStaticMarkup(
      <EditableText path="title" value="Hello">
        <h2 className="font-display">Hello</h2>
      </EditableText>,
    );
    expect(wrapped).toBe(bare);
  });

  it("EditableText without children renders plain tag", () => {
    const html = renderToStaticMarkup(
      <EditableText path="title" value="Hello" as="h2" className="t" />,
    );
    expect(html).toBe('<h2 class="t">Hello</h2>');
  });

  it("EditableMedia is a pure children passthrough", () => {
    const bare = renderToStaticMarkup(
      <img src="/x.jpg" alt="x" className="w-full" />,
    );
    const wrapped = renderToStaticMarkup(
      <EditableMedia path="image">
        <img src="/x.jpg" alt="x" className="w-full" />
      </EditableMedia>,
    );
    expect(wrapped).toBe(bare);
  });

  it("EditableCta is a pure children passthrough", () => {
    const button = {
      label: "Offerte",
      link: { type: "internal_route" as const, route: "offerte" as const },
    };
    const bare = renderToStaticMarkup(<a href="/offerte">Offerte</a>);
    const wrapped = renderToStaticMarkup(
      <EditableCta path="cta" button={button}>
        <a href="/offerte">Offerte</a>
      </EditableCta>,
    );
    expect(wrapped).toBe(bare);
  });
});

describe("Editable* with surface enabled", () => {
  const surface: CmsEditSurfaceApi = {
    enabled: true,
    renderText: ({ value, className, as = "span" }) => {
      const Tag = as;
      return (
        <Tag className={className} data-cms-edit-text="">
          {value}
        </Tag>
      );
    },
    renderMedia: ({ children }) => <div data-cms-edit-media="">{children}</div>,
    renderCta: ({ children }) => <span data-cms-edit-cta="">{children}</span>,
  };

  it("EditableText uses surface when path is canvas-capable for the scoped block", () => {
    const html = renderToStaticMarkup(
      <CmsEditSurfaceProvider value={surface}>
        <CmsBlockEditScope blockId="b1" blockType="hero">
          <EditableText path="title" value="Hero" as="h1" className="x" />
        </CmsBlockEditScope>
      </CmsEditSurfaceProvider>,
    );
    expect(html).toContain('data-cms-edit-text=""');
    expect(html).toContain("Hero");
  });

  it("EditableText stays no-op for advancedOnly paths even when surface is enabled", () => {
    const bare = renderToStaticMarkup(<span>left</span>);
    const wrapped = renderToStaticMarkup(
      <CmsEditSurfaceProvider value={surface}>
        <CmsBlockEditScope blockId="b1" blockType="hero">
          <EditableText path="align" value="left">
            <span>left</span>
          </EditableText>
        </CmsBlockEditScope>
      </CmsEditSurfaceProvider>,
    );
    expect(wrapped).toBe(bare);
  });

  it("EditableMedia wraps children via surface for canvas media paths", () => {
    const html = renderToStaticMarkup(
      <CmsEditSurfaceProvider value={surface}>
        <CmsBlockEditScope blockId="b1" blockType="hero">
          <EditableMedia path="image">
            <img src="/x.jpg" alt="" />
          </EditableMedia>
        </CmsBlockEditScope>
      </CmsEditSurfaceProvider>,
    );
    expect(html).toContain('data-cms-edit-media=""');
    expect(html).toContain("<img");
  });
});
