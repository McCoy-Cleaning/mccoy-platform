import { useI18n } from "@/lib/i18n";
import { CountUp } from "../CountUp";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { localizedStatsCopy } from "@/lib/cms-i18n";
import { SECTION_PAGE_RAIL } from "@mccoy/cms-renderer/section-layout";
import { SectionAmbient, SectionEyebrow, SectionSurface } from "@mccoy/cms-renderer";
import { cn } from "@/lib/utils";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { WysiwygInlineText } from "../cms-editor/WysiwygInlineText";
import type { StatsContent } from "@mccoy/cms-schema";

/**
 * Below-fold home stats — no Motion. Keeps the Motion package out of the
 * homepage dependency graph (route-tree sharing otherwise pulls it into the
 * main chunk and inflates TBT).
 */
export function Stats() {
  const { t } = useI18n();
  const { sendMutation, showEditorChrome } = useLiveEditApi();
  const content = useTypedSectionContent("page_home", "home.stats");
  const copy = localizedStatsCopy(content, t);
  const eyebrow = copy.eyebrow;
  const body = copy.body;
  const items = copy.items;

  const patchStats = (patch: Partial<StatsContent>) =>
    sendMutation({ kind: "section", sectionKey: "home.stats", patch });

  const patchItem = (id: string, field: "value" | "label", next: string) => {
    patchStats({
      items: content.items.map((item) => (item.id === id ? { ...item, [field]: next } : item)),
    });
  };

  const headingDisplay =
    copy.heading ||
    `${t.stats.title} ${t.stats.titleAccent} ${t.stats.titleEnd}`.replace(/\s+/g, " ").trim();

  return (
    <section className="relative isolate overflow-hidden py-24">
      <SectionAmbient />
      <div className={cn("relative", SECTION_PAGE_RAIL, "grid gap-16 lg:grid-cols-2")}>
        <div>
          <SectionEyebrow>
            <WysiwygInlineText
              label="Eyebrow"
              value={eyebrow ?? ""}
              enFieldPath="section:home.stats:eyebrow"
              target={{ kind: "section", sectionKey: "home.stats", field: "eyebrow" }}
            />
          </SectionEyebrow>
          <h2 className="font-display mt-4 text-4xl leading-tight text-foreground md:text-5xl lg:text-6xl">
            {copy.heading || showEditorChrome ? (
              <WysiwygInlineText
                as="span"
                label="Kop"
                value={headingDisplay}
                enFieldPath="section:home.stats:heading"
                target={{ kind: "section", sectionKey: "home.stats", field: "heading" }}
              />
            ) : (
              <>
                {t.stats.title} <span className="text-primary">{t.stats.titleAccent}</span>{" "}
                {t.stats.titleEnd}
              </>
            )}
          </h2>
          <p className="mt-6 max-w-lg whitespace-pre-line text-muted-foreground">
            <WysiwygInlineText
              as="span"
              multiline
              label="Tekst"
              value={body ?? ""}
              enFieldPath="section:home.stats:body"
              target={{ kind: "section", sectionKey: "home.stats", field: "body" }}
            />
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 self-center sm:grid-cols-3">
          {items.map((s, i) => (
            <div key={s.id || `${s.value}-${s.label}-${i}`}>
              <SectionSurface
                variant="outlined"
                className="h-full p-6 text-center transition hover:border-primary/40 sm:text-left"
              >
                <div className="font-display text-5xl text-primary md:text-6xl">
                  {showEditorChrome ? (
                    <WysiwygInlineText
                      as="span"
                      label="Waarde"
                      value={s.value}
                      target={{
                        kind: "custom",
                        onCommit: (next) => patchItem(s.id, "value", next),
                      }}
                    />
                  ) : (
                    <CountUp value={s.value} duration={2.0 + i * 0.15} />
                  )}
                </div>
                <div className="mt-2 text-sm font-bold text-muted-foreground">
                  <WysiwygInlineText
                    as="span"
                    label="Label"
                    value={s.label}
                    target={{
                      kind: "custom",
                      onCommit: (next) => patchItem(s.id, "label", next),
                    }}
                  />
                </div>
              </SectionSurface>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
