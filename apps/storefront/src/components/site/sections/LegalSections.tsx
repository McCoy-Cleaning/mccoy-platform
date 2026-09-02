import { Shield, ScrollText } from "lucide-react";
import type { LegalMainContent } from "@mccoy/cms-schema";
import {
  SECTION_PAGE_RAIL,
  SECTION_WIDE_READING_RAIL,
  SectionEyebrow,
  SectionSurface,
} from "@mccoy/cms-renderer";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { cn } from "@/lib/utils";
import { useOverlayHeading } from "@/lib/cms/aether-edge-overlay-context";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { WysiwygInlineText } from "../cms-editor/WysiwygInlineText";

function LegalArticlesView({
  pageId,
  sectionKey,
  icon: Icon,
}: {
  pageId: "page_privacy" | "page_terms";
  sectionKey: "privacy.main" | "terms.main";
  icon: typeof Shield;
}) {
  const { sendMutation } = useLiveEditApi();
  const content = useTypedSectionContent(pageId, sectionKey) as LegalMainContent | null;
  const heading = useOverlayHeading(content?.heading ?? "");
  if (!content) return null;

  const patch = (next: Partial<LegalMainContent>) =>
    sendMutation({ kind: "section", sectionKey, patch: next });

  return (
    <div className={cn(SECTION_PAGE_RAIL, "pb-24 pt-8")} data-cms-section={sectionKey}>
      <div className={SECTION_WIDE_READING_RAIL}>
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        {content.eyebrow ? (
          <SectionEyebrow className="mt-6 tracking-[0.25em]">
            <WysiwygInlineText
              label="Eyebrow"
              value={content.eyebrow}
              enFieldPath={`section:${sectionKey}:eyebrow`}
              target={{ kind: "section", sectionKey, field: "eyebrow" }}
            />
          </SectionEyebrow>
        ) : null}
        <h1 className="font-display mt-3 text-5xl text-foreground md:text-6xl">
          <WysiwygInlineText
            as="span"
            label="Kop"
            value={heading}
            enFieldPath={`section:${sectionKey}:heading`}
            target={{ kind: "section", sectionKey, field: "heading" }}
          />
        </h1>
        {content.updatedLabel ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <WysiwygInlineText
              as="span"
              label="Bijgewerkt"
              value={content.updatedLabel}
              enFieldPath={`section:${sectionKey}:updatedLabel`}
              target={{ kind: "section", sectionKey, field: "updatedLabel" }}
            />
          </p>
        ) : null}

        <div className="mt-12 space-y-6">
          {content.articles.map((article) => (
            <SectionSurface key={article.id} variant="outlined" className="p-7 md:p-9">
              <article>
                <h2 className="font-display text-2xl text-foreground md:text-3xl">
                  <WysiwygInlineText
                    as="span"
                    label="Artikel titel"
                    value={article.title}
                    target={{
                      kind: "custom",
                      onCommit: (next) =>
                        patch({
                          articles: content.articles.map((a) =>
                            a.id === article.id ? { ...a, title: next } : a,
                          ),
                        }),
                    }}
                  />
                </h2>
                <div className="mt-4 space-y-3 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
                  <WysiwygInlineText
                    as="span"
                    multiline
                    label="Artikel tekst"
                    value={article.body}
                    target={{
                      kind: "custom",
                      onCommit: (next) =>
                        patch({
                          articles: content.articles.map((a) =>
                            a.id === article.id ? { ...a, body: next } : a,
                          ),
                        }),
                    }}
                  />
                </div>
              </article>
            </SectionSurface>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PrivacyMainSection() {
  return (
    <LegalArticlesView pageId="page_privacy" sectionKey="privacy.main" icon={Shield} />
  );
}

export function TermsMainSection() {
  return (
    <LegalArticlesView pageId="page_terms" sectionKey="terms.main" icon={ScrollText} />
  );
}
