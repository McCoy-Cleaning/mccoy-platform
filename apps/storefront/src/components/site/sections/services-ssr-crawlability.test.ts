import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Wind } from "lucide-react";
import { SERVICE_DETAIL_ANCHORS } from "./service-detail-anchors";

vi.mock("motion/react", async () => {
  const React = await import("react");
  const passthrough = (tag: string) =>
    ({
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      ...rest
    }: { children?: unknown } & Record<string, unknown>) =>
      React.createElement(tag, rest, children as never);
  return {
    motion: {
      p: passthrough("p"),
      h3: passthrough("h3"),
      div: passthrough("div"),
    },
  };
});

vi.mock("@/components/site/DeliveryImage", () => ({
  DeliveryImage: (props: Record<string, unknown>) =>
    createElement("img", { src: String(props.src ?? ""), alt: String(props.alt ?? "") }),
}));

vi.mock("@mccoy/cms-renderer", () => ({
  CmsButtonView: ({ children }: { children?: unknown }) => createElement("span", null, children as never),
}));

const dir = dirname(fileURLToPath(import.meta.url));

describe("Services Phase 7 SSR crawlability", () => {
  it("keeps one real detail panel tree in SSR (no document-gated portal, no sr-only clone)", () => {
    const sections = readFileSync(join(dir, "ServicesSections.tsx"), "utf8");
    const panel = readFileSync(join(dir, "ServiceDetailPanel.tsx"), "utf8");

    expect(sections).toContain("BodyPortal");
    expect(sections).toContain("<ServiceDetailPanel");
    expect(sections).toContain("serviceDetailHref");
    expect(sections).toMatch(/<a[\s\S]*href=\{href\}/);
    expect(sections).not.toMatch(/typeof document !== "undefined" &&/);
    expect(sections).not.toMatch(/<button[\s\S]{0,200}t\.services\.readMore/);

    expect(panel).toContain("card.full.map");
    expect(panel).toContain("hidden={!open}");
    expect(panel).toContain("inert={!open");
    expect(panel).not.toMatch(/\bsr-only\b/);
    expect(panel).not.toMatch(/open \?[\s\S]{0,40}card\.full\.map/);
    expect(panel).not.toMatch(/open &&[\s\S]{0,40}card\.full\.map/);
  });

  it("renderToStaticMarkup includes each full paragraph once when closed (no click)", async () => {
    const { ServiceDetailPanel } = await import("./ServiceDetailPanel");

    const unique = "Phase7CrawlUniquePhrase-ReguliereSchoonmaak-SSR-OnlyOnce-9f3a";
    const card = {
      id: "svc_regular",
      title: "Reguliere schoonmaak",
      full: [unique, "Second paragraph for regular cleaning crawl fixture."],
      imageSrc: "/images/cms/work-regular-sander.png",
      cta: null,
      Icon: Wind,
    };

    const html = renderToStaticMarkup(
      createElement(ServiceDetailPanel, {
        card,
        anchor: "reguliere-schoonmaak",
        open: false,
        eyebrow: "Diensten",
        closeLabel: "Sluiten",
        onClose: () => {},
      }),
    );

    expect(html).toContain('id="reguliere-schoonmaak"');
    expect(html).toContain("hidden");
    expect(html).toContain(unique);
    expect(html).toContain("Second paragraph for regular cleaning crawl fixture.");
    expect(html.match(new RegExp(unique, "g"))?.length).toBe(1);
    expect(html).not.toMatch(/sr-only/);
    expect(SERVICE_DETAIL_ANCHORS).toHaveLength(6);
  });
});
