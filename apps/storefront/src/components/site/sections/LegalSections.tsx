import { Shield, ScrollText } from "lucide-react";
import type { LegalMainContent } from "@mccoy/cms-schema";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";

function LegalArticlesView({
  pageId,
  sectionKey,
  icon: Icon,
}: {
  pageId: "page_privacy" | "page_terms";
  sectionKey: "privacy.main" | "terms.main";
  icon: typeof Shield;
}) {
  const content = useTypedSectionContent(pageId, sectionKey) as LegalMainContent | null;
  if (!content) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      {content.eyebrow ? (
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          {content.eyebrow}
        </p>
      ) : null}
      <h1 className="font-display mt-3 text-5xl text-white md:text-6xl">{content.heading}</h1>
      {content.updatedLabel ? (
        <p className="mt-4 text-sm text-white/55">{content.updatedLabel}</p>
      ) : null}

      <div className="mt-12 space-y-6">
        {content.articles.map((article) => (
          <article
            key={article.id}
            className="rounded-3xl border border-white/10 bg-card/60 p-7 md:p-9"
          >
            <h2 className="font-display text-2xl text-white md:text-3xl">{article.title}</h2>
            <div className="mt-4 space-y-3 whitespace-pre-line text-[15px] leading-relaxed text-white/75">
              {article.body}
            </div>
          </article>
        ))}
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
