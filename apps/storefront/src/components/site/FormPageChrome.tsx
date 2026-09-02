import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import type { FixedSectionKey, FormPageChromeContent } from "@mccoy/cms-schema";
import { withResolvedPublicImageAlt } from "@mccoy/cms-schema";
import { CmsImageView, SectionInner } from "@mccoy/cms-renderer";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { useI18n } from "@/lib/i18n";
import { localizedFormChromeCopy } from "@/lib/cms-i18n";
import { useOverlayHeading } from "@/lib/cms/aether-edge-overlay-context";
import { WysiwygInlineText } from "./cms-editor/WysiwygInlineText";
import { WysiwygMediaFrame } from "./cms-editor/WysiwygMediaButton";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";

type FormChromeSectionKey = "contact.main" | "vacatures.main" | "offerte.main";

const PAGE_ID_BY_SECTION: Record<FormChromeSectionKey, string> = {
  "contact.main": "page_contact",
  "vacatures.main": "page_vacatures",
  "offerte.main": "page_offerte",
};

/**
 * Premium hero-style chrome for app-controlled form pages (contact/vacatures/offerte).
 * Renders typed section content (eyebrow/heading/body/image) — the form beneath stays app-controlled.
 */
function FormPageChromeSection({
  sectionKey,
  badge = false,
}: {
  sectionKey: FormChromeSectionKey;
  badge?: boolean;
}) {
  const pageId = PAGE_ID_BY_SECTION[sectionKey];
  const { t, lang } = useI18n();
  const { showEditorChrome } = useLiveEditApi();
  const content = useTypedSectionContent(pageId, sectionKey as FixedSectionKey) as FormPageChromeContent;
  const copy = localizedFormChromeCopy(sectionKey, content, t, lang);
  const heading = useOverlayHeading(copy.heading);
  const en = (field: string) => `section:${sectionKey}:${field}`;
  const showMedia = Boolean(content.image) || showEditorChrome;

  return (
    <section
      className="relative flex min-h-[16rem] items-center py-10 sm:min-h-[18rem] sm:py-14 md:min-h-[20rem] md:py-16"
      data-cms-section={sectionKey}
    >
      <SectionInner>
        {badge ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <WysiwygInlineText
              label="Eyebrow"
              value={copy.eyebrow ?? ""}
              enFieldPath={en("eyebrow")}
              target={{ kind: "section", sectionKey, field: "eyebrow" }}
            />
          </motion.div>
        ) : (
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
          >
            <WysiwygInlineText
              label="Eyebrow"
              value={copy.eyebrow ?? ""}
              enFieldPath={en("eyebrow")}
              target={{ kind: "section", sectionKey, field: "eyebrow" }}
            />
          </motion.p>
        )}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.7 }}
          className={
            badge
              ? "font-display mt-6 max-w-3xl text-5xl text-white md:text-7xl"
              : "font-display mt-4 max-w-3xl text-5xl text-white md:text-7xl"
          }
        >
          <WysiwygInlineText
            as="span"
            label="Kop"
            value={heading}
            enFieldPath={en("heading")}
            target={{ kind: "section", sectionKey, field: "heading" }}
          />
        </motion.h1>
        <p className="mt-5 max-w-2xl whitespace-pre-line font-bold text-white/65">
          <WysiwygInlineText
            as="span"
            multiline
            label="Tekst"
            value={copy.body ?? ""}
            enFieldPath={en("body")}
            target={{ kind: "section", sectionKey, field: "body" }}
          />
        </p>
        {showMedia ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className={
              content.image
                ? "mt-8 max-w-3xl overflow-hidden rounded-2xl border border-white/10"
                : "mt-8 max-w-3xl"
            }
          >
            <WysiwygMediaFrame
              image={content.image}
              emptyPlaceholder
              target={{ kind: "section", sectionKey, field: "image" }}
            >
              {content.image ? (
                <CmsImageView
                  image={withResolvedPublicImageAlt(content.image, heading || "McCoy Cleaning")}
                  className="max-h-64 w-full bg-black/35 object-contain object-center"
                />
              ) : null}
            </WysiwygMediaFrame>
          </motion.div>
        ) : null}
      </SectionInner>
    </section>
  );
}

export function ContactMainChrome() {
  return <FormPageChromeSection sectionKey="contact.main" />;
}

export function VacaturesMainChrome() {
  return <FormPageChromeSection sectionKey="vacatures.main" badge />;
}

export function OfferteMainChrome() {
  return <FormPageChromeSection sectionKey="offerte.main" />;
}
