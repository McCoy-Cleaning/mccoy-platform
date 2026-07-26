import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FormPageChromeView } from "./index";

describe("FormPageChromeView", () => {
  it("renders optional content.image", () => {
    const html = renderToStaticMarkup(
      FormPageChromeView({
        sectionKey: "contact.main",
        content: {
          eyebrow: "Contact",
          heading: "Neem contact op",
          body: "We helpen graag.",
          image: {
            assetId: "local:hero",
            src: "/images/hero-placeholder.jpg",
            alt: "Contact visual",
            decorative: false,
          },
        },
      }),
    );
    expect(html).toContain("/images/hero-placeholder.jpg");
    expect(html).toContain("Contact visual");
    expect(html).toContain("Neem contact op");
  });

  it("omits image markup when content.image is absent", () => {
    const html = renderToStaticMarkup(
      FormPageChromeView({
        sectionKey: "contact.main",
        content: {
          eyebrow: "Contact",
          heading: "Neem contact op",
        },
      }),
    );
    expect(html).not.toContain("<img");
  });
});
