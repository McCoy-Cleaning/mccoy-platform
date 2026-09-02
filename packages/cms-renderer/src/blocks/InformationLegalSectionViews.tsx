/**
 * Stage 5 family D — extracted from RegisteredBlockView switch.
 * Markup inside each view must remain byte-equivalent to the prior case body.
 */
import * as React from "react";
import {
  createItemId,
  resolveCmsLinkHref,
  resolveSafeVideoEmbed,
  type BlockType,
  type CmsButton,
  type CmsImage,
  type RoadmapBlockData,
  type TimelineBlockData,
} from "@mccoy/cms-schema";
import { CmsButtonView } from "./CmsButtonView";
import { CmsImageView, type LinkResolverPages } from "./CmsImageView";
import { WorkMosaicGallery } from "./WorkMosaicGallery";
import { GalleryTextAndImageView } from "./GalleryTextAndImageView";
import {
  SECTION_GRID,
  SECTION_TITLE,
  SECTION_TITLE_TIGHT,
} from "../sectionLayout";
import { SectionShell } from "../SectionShell";
import { SectionEyebrow, SectionHeader, SectionIndex, SectionSurface } from "../sectionChromeUi";
import {
  CmsListAddButton,
  CmsListRemoveButton,
  EditableText,
  useCmsEditSurface,
  useCmsTypedListEditor,
} from "../edit-surface";
import {
  cn,
  SectionTitle,
  OptionalImage,
  FitImage,
  CoverFillImage,
  OptionalCta,
  type BlockSectionViewProps,
} from "./blockViewShared";


export function ContactInfoCardsSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  void pages;
  const type = "contactInfoCards" as BlockType;
  const list = useCmsTypedListEditor<{
    id: string;
    type?: string;
    label: string;
    value: string;
    secondaryValue?: string;
    action?: { kind: string; href: string; label?: string };
  }>("items");
  const editing = list.editing;
  const items =
    (d.items as Array<{
      id: string;
      type?: string;
      label: string;
      value: string;
      secondaryValue?: string;
      action?: { kind: string; href: string; label?: string };
    }>) ?? [];
  const heading = typeof d.heading === "string" ? d.heading : "";
  return (
    <SectionShell blockType={type}>
      <SectionHeader
        title={
          <EditableText path="heading" value={heading} as="span">
            {heading}
          </EditableText>
        }
        className="mb-10 sm:mb-12"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => {
          const href = item.action?.href;
          const safe =
            href &&
            (href.startsWith("/") ||
              href.startsWith("https://") ||
              href.startsWith("http://") ||
              href.startsWith("mailto:") ||
              href.startsWith("tel:"))
              ? href
              : null;
          const inner = (
            <>
              {editing ? (
                <CmsListRemoveButton
                  label={`Contactkaart verwijderen: ${item.label}`}
                  onRemove={() => list.removeById(items, item.id)}
                />
              ) : null}
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <EditableText path={`items.${index}.label`} value={item.label}>
                  {item.label}
                </EditableText>
              </p>
              <p className="mt-2 text-lg font-medium text-foreground">
                <EditableText path={`items.${index}.value`} value={item.value}>
                  {item.value}
                </EditableText>
              </p>
              {item.secondaryValue || editing ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  <EditableText
                    path={`items.${index}.secondaryValue`}
                    value={item.secondaryValue ?? ""}
                  >
                    {item.secondaryValue ?? ""}
                  </EditableText>
                </p>
              ) : null}
            </>
          );
          if (safe && !editing) {
            return (
              <a key={item.id} href={safe} className="block transition hover:opacity-95">
                <SectionSurface variant="outlined" className="relative h-full p-5 hover:border-primary/35">
                  {inner}
                </SectionSurface>
              </a>
            );
          }
          return (
            <SectionSurface key={item.id} variant="outlined" className="relative p-5">
              {inner}
            </SectionSurface>
          );
        })}
        {editing ? (
          <CmsListAddButton
            label="Contactkaart toevoegen"
            onAdd={() =>
              list.append(items, {
                id: createItemId("cinfo"),
                type: "custom",
                label: "Label",
                value: "Waarde",
              })
            }
          />
        ) : null}
      </div>
    </SectionShell>
  );
}

export function LegalArticlesSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  void pages;
  const type = "legalArticles" as BlockType;
  const list = useCmsTypedListEditor<{
    id: string;
    heading: string;
    anchor: string;
    content: string;
  }>("articles");
  const editing = list.editing;
  const articles =
    (d.articles as Array<{ id: string; heading: string; anchor: string; content: string }>) ??
    [];
  const eyebrow = typeof d.eyebrow === "string" ? d.eyebrow.trim() : "";
  const heading = String(d.heading ?? "");
  const updatedLabel = typeof d.updatedLabel === "string" ? d.updatedLabel.trim() : "";
  const tocLabel =
    typeof d.tocLabel === "string" && d.tocLabel.trim()
      ? d.tocLabel.trim()
      : "Inhoudsopgave";
  const updatedAt = typeof d.updatedAt === "string" ? d.updatedAt.trim() : "";
  const showEyebrow = Boolean(eyebrow) || editing;
  const showUpdated = Boolean(updatedLabel || updatedAt) || editing;

  const addArticle = () => {
    const used = new Set(articles.map((a) => a.anchor));
    let n = articles.length + 1;
    let anchor = `artikel-${n}`;
    while (used.has(anchor)) {
      n += 1;
      anchor = `artikel-${n}`;
    }
    list.append(articles, {
      id: createItemId("legal"),
      heading: `Artikel ${n}`,
      anchor,
      content: "Inhoud van dit artikel.",
    });
  };

  return (
    <SectionShell blockType={type} innerMaxWidth="3xl">
      {showEyebrow ? (
        <SectionEyebrow className="tracking-[0.25em]">
          <EditableText path="eyebrow" value={eyebrow}>
            {eyebrow}
          </EditableText>
        </SectionEyebrow>
      ) : null}
      <h1
        className={cn(
          "font-display text-foreground",
          eyebrow || editing ? "mt-3 text-5xl md:text-6xl" : "text-4xl",
        )}
      >
        <EditableText path="heading" value={heading} as="span">
          {heading}
        </EditableText>
      </h1>
      {showUpdated ? (
        <p className="mt-3 text-sm text-muted-foreground">
          <EditableText path="updatedLabel" value={updatedLabel}>
            {updatedLabel}
          </EditableText>
          {updatedAt ? (
            <>
              {": "}
              {updatedAt}
            </>
          ) : null}
        </p>
      ) : null}
      {articles.length > 1 ? (
        <SectionSurface variant="outlined" className="mt-8 p-4">
          <nav aria-label={tocLabel}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <EditableText path="tocLabel" value={tocLabel}>
                {tocLabel}
              </EditableText>
            </p>
            <ol className="space-y-2 text-sm">
              {articles.map((a, index) => (
                <li key={a.id}>
                  <a className="text-primary hover:underline" href={`#${a.anchor}`}>
                    <EditableText path={`articles.${index}.heading`} value={a.heading}>
                      {a.heading}
                    </EditableText>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </SectionSurface>
      ) : null}
      <div className="mt-10 space-y-6">
        {articles.map((a, index) => (
          <SectionSurface key={a.id} variant="outlined" className="relative p-7 md:p-9">
            {editing ? (
              <CmsListRemoveButton
                label={`Artikel verwijderen: ${a.heading}`}
                onRemove={() => list.removeById(articles, a.id)}
              />
            ) : null}
            <article id={a.anchor}>
              <h2 className="font-display text-2xl text-foreground md:text-3xl">
                <EditableText path={`articles.${index}.heading`} value={a.heading}>
                  {a.heading}
                </EditableText>
              </h2>
              <div className="mt-4 space-y-3 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
                <EditableText path={`articles.${index}.content`} value={a.content} multiline>
                  {a.content}
                </EditableText>
              </div>
            </article>
          </SectionSurface>
        ))}
        {editing ? (
          <CmsListAddButton label="Artikel toevoegen" onAdd={addArticle} className="min-h-[6rem]" />
        ) : null}
      </div>
    </SectionShell>
  );
}
