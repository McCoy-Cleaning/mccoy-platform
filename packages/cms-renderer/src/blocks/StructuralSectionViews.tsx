/**
 * Stage 5 family B — extracted from RegisteredBlockView switch.
 * Markup inside each view must remain byte-equivalent to the prior case body
 * for public (non-edit) rendering; edit mode adds list add/remove chrome.
 */
import * as React from "react";
import {
  createItemId,
  createRoadmapMilestone,
  createTextListItem,
  createTimelineMilestone,
  type BlockType,
  type CmsImage,
  type RoadmapBlockData,
  type TimelineBlockData,
} from "@mccoy/cms-schema";
import { SECTION_GRID } from "../sectionLayout";
import { SectionShell } from "../SectionShell";
import { SectionEyebrow, SectionIndex, SectionSurface } from "../sectionChromeUi";
import {
  CmsListAddButton,
  CmsListRemoveButton,
  EditableMedia,
  EditableText,
  useCmsBlockEditScope,
  useCmsEditSurface,
  useCmsTypedListEditor,
} from "../edit-surface";
import { cn, SectionTitle, FitImage, type BlockSectionViewProps } from "./blockViewShared";

export function ColumnsSectionView({ data: d }: BlockSectionViewProps) {
  const type = "columns" as BlockType;
  const list = useCmsTypedListEditor<{ id: string; title: string; body: string }>("columns");
  const editing = list.editing;
  const columns = (d.columns as Array<{ id: string; title: string; body: string }>) ?? [];
  const title = String(d.title ?? "");
  const showTitle = Boolean(title.trim()) || editing;
  return (
    <SectionShell blockType={type}>
      {showTitle ? (
        <SectionTitle>
          <EditableText path="title" value={title}>
            {title}
          </EditableText>
        </SectionTitle>
      ) : null}
      <div className={cn(SECTION_GRID, "md:grid-cols-2 lg:grid-cols-3")}>
        {columns.map((c, index) => (
          <SectionSurface key={c.id} variant="outlined" className="relative p-5 sm:p-6">
            {editing ? (
              <CmsListRemoveButton
                label={`Kolom verwijderen: ${c.title || `kolom ${index + 1}`}`}
                onRemove={() => list.removeById(columns, c.id)}
              />
            ) : null}
            <h3 className="text-lg font-semibold text-foreground">
              <EditableText path={`columns.${index}.title`} value={c.title}>
                {c.title}
              </EditableText>
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              <EditableText path={`columns.${index}.body`} value={c.body} multiline>
                {c.body}
              </EditableText>
            </p>
          </SectionSurface>
        ))}
        {editing ? (
          <CmsListAddButton
            label="Kolom toevoegen"
            onAdd={() =>
              list.append(columns, {
                id: createItemId("col"),
                title: "Nieuwe kolom",
                body: "Tekst",
              })
            }
          />
        ) : null}
      </div>
    </SectionShell>
  );
}

export function BenefitsSectionView({ data: d }: BlockSectionViewProps) {
  const type = "benefits" as BlockType;
  const list = useCmsTypedListEditor<{ id: string; text: string }>("items");
  const editing = list.editing;
  const items = (d.items as Array<{ id: string; text: string }>) ?? [];
  const title = String(d.title ?? "");
  return (
    <SectionShell blockType={type}>
      <SectionTitle>
        <EditableText path="title" value={title}>
          {title}
        </EditableText>
      </SectionTitle>
      <ul className={cn(SECTION_GRID, "sm:grid-cols-2")}>
        {items.map((item, index) => (
          <li key={item.id} className="relative">
            {editing ? (
              <CmsListRemoveButton
                label={`Voordeel verwijderen: ${item.text || `item ${index + 1}`}`}
                onRemove={() => list.removeById(items, item.id)}
              />
            ) : null}
            <SectionSurface variant="outlined" className="flex h-full gap-3 p-5">
              <SectionIndex value={String(index + 1).padStart(2, "0")} />
              <span className="text-foreground/90">
                <EditableText path={`items.${index}.text`} value={item.text}>
                  {item.text}
                </EditableText>
              </span>
            </SectionSurface>
          </li>
        ))}
        {editing ? (
          <li>
            <CmsListAddButton
              label="Voordeel toevoegen"
              onAdd={() => list.append(items, createTextListItem("Nieuw voordeel"))}
            />
          </li>
        ) : null}
      </ul>
    </SectionShell>
  );
}

export function RoadmapSectionView({ data: d }: BlockSectionViewProps) {
  const type = "roadmap" as BlockType;
  const list = useCmsTypedListEditor<RoadmapBlockData["milestones"][number]>("milestones");
  const editing = list.editing;
  const data = d as unknown as RoadmapBlockData;
  const milestones = data.milestones ?? [];

  const patchMilestoneBullets = (
    milestoneId: string,
    bullets: RoadmapBlockData["milestones"][number]["bullets"],
  ) => {
    list.patchList(
      milestones.map((m) => (m.id === milestoneId ? { ...m, bullets } : m)),
    );
  };

  return (
    <SectionShell blockType={type}>
      <SectionTitle>
        <EditableText path="title" value={data.title}>
          {data.title}
        </EditableText>
      </SectionTitle>
      {milestones.length === 0 && !editing ? (
        <p className="text-sm text-white/55">Nog geen mijlpalen toegevoegd.</p>
      ) : (
        <ol className="relative space-y-6 border-l border-border pl-6 sm:pl-8">
          {milestones.map((m, i) => (
            <li key={m.id} className="relative">
              <SectionSurface variant="outlined" className="relative p-5 sm:p-6">
                {editing ? (
                  <CmsListRemoveButton
                    label={`Mijlpaal verwijderen: ${m.title}`}
                    onRemove={() => list.removeById(milestones, m.id)}
                  />
                ) : null}
                <div className="mb-2 flex items-center gap-3">
                  <SectionIndex value={String(i + 1).padStart(2, "0")} />
                  {m.year || editing ? (
                    <SectionEyebrow className="tracking-wider">
                      <EditableText path={`milestones.${i}.year`} value={m.year ?? ""}>
                        {m.year ?? ""}
                      </EditableText>
                    </SectionEyebrow>
                  ) : null}
                </div>
                <h3 className="text-xl font-semibold text-foreground break-words">
                  <EditableText path={`milestones.${i}.title`} value={m.title}>
                    {m.title}
                  </EditableText>
                </h3>
                {m.body || editing ? (
                  <p className="mt-1 text-muted-foreground break-words">
                    <EditableText path={`milestones.${i}.body`} value={m.body ?? ""} multiline>
                      {m.body ?? ""}
                    </EditableText>
                  </p>
                ) : null}
                {m.bullets.length || editing ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {m.bullets.map((b, bi) => (
                      <li key={b.id} className="relative break-words pr-16">
                        <EditableText path={`milestones.${i}.bullets.${bi}.text`} value={b.text}>
                          {b.text}
                        </EditableText>
                        {editing ? (
                          <CmsListRemoveButton
                            label={`Punt verwijderen: ${b.text || `punt ${bi + 1}`}`}
                            className="right-0 top-0"
                            onRemove={() =>
                              patchMilestoneBullets(
                                m.id,
                                m.bullets.filter((x) => x.id !== b.id),
                              )
                            }
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {editing ? (
                  <CmsListAddButton
                    compact
                    label="Punt toevoegen"
                    onAdd={() =>
                      patchMilestoneBullets(m.id, [
                        ...m.bullets,
                        createTextListItem("Nieuw punt"),
                      ])
                    }
                  />
                ) : null}
              </SectionSurface>
            </li>
          ))}
        </ol>
      )}
      {editing ? (
        <div className="mt-6">
          <CmsListAddButton
            label="Mijlpaal toevoegen"
            onAdd={() => list.append(milestones, createRoadmapMilestone())}
            className="min-h-[6rem]"
          />
        </div>
      ) : null}
    </SectionShell>
  );
}

export function TimelineSectionView({ data: d }: BlockSectionViewProps) {
  const type = "timeline" as BlockType;
  const list = useCmsTypedListEditor<TimelineBlockData["milestones"][number]>("milestones");
  const editing = list.editing;
  const data = d as unknown as TimelineBlockData;
  const milestones = data.milestones ?? [];
  return (
    <SectionShell blockType={type}>
      <SectionTitle>
        <EditableText path="title" value={data.title}>
          {data.title}
        </EditableText>
      </SectionTitle>
      {milestones.length === 0 && !editing ? (
        <p className="text-sm text-muted-foreground">Nog geen mijlpalen.</p>
      ) : (
        <ol className="space-y-4 border-l border-border pl-6">
          {milestones.map((m, i) => (
            <li key={m.id} className="relative">
              <SectionSurface variant="outlined" className="relative p-4 sm:p-5">
                {editing ? (
                  <CmsListRemoveButton
                    label={`Tijdpunt verwijderen: ${m.title}`}
                    onRemove={() => list.removeById(milestones, m.id)}
                  />
                ) : null}
                <div className="mb-2 flex items-center gap-3">
                  <SectionIndex value={i + 1} />
                  {m.year || editing ? (
                    <SectionEyebrow>
                      <EditableText path={`milestones.${i}.year`} value={m.year ?? ""}>
                        {m.year ?? ""}
                      </EditableText>
                    </SectionEyebrow>
                  ) : null}
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  <EditableText path={`milestones.${i}.title`} value={m.title}>
                    {m.title}
                  </EditableText>
                </h3>
                {m.body || editing ? (
                  <p className="mt-1 text-muted-foreground">
                    <EditableText path={`milestones.${i}.body`} value={m.body ?? ""} multiline>
                      {m.body ?? ""}
                    </EditableText>
                  </p>
                ) : null}
              </SectionSurface>
            </li>
          ))}
        </ol>
      )}
      {editing ? (
        <div className="mt-4">
          <CmsListAddButton
            label="Tijdpunt toevoegen"
            onAdd={() => list.append(milestones, createTimelineMilestone())}
            className="min-h-[6rem]"
          />
        </div>
      ) : null}
    </SectionShell>
  );
}

export function ComparisonTableSectionView({ data: d }: BlockSectionViewProps) {
  const type = "comparisonTable" as BlockType;
  const surface = useCmsEditSurface();
  const scope = useCmsBlockEditScope();
  const editing = Boolean(surface?.enabled && scope && surface.sendBlockPatch);
  const columns = (d.columns as string[]) ?? [];
  const rows = (d.rows as Array<{ id: string; feature: string; values: boolean[] }>) ?? [];
  const title = String(d.title ?? "");

  const patchTable = (nextColumns: string[], nextRows: typeof rows) => {
    if (!scope || !surface?.sendBlockPatch) return;
    surface.sendBlockPatch(scope.blockId, { columns: nextColumns, rows: nextRows });
  };

  return (
    <SectionShell blockType={type}>
      <SectionTitle>
        <EditableText path="title" value={title}>
          {title}
        </EditableText>
      </SectionTitle>
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm text-muted-foreground">
          <thead>
            <tr>
              <th className="border-b border-border p-3" />
              {columns.map((c, ci) => (
                <th
                  key={`col-${ci}`}
                  className="relative border-b border-border p-3 font-semibold text-foreground"
                >
                  {editing ? (
                    <CmsListRemoveButton
                      label={`Kolom verwijderen: ${c || `kolom ${ci + 1}`}`}
                      className="right-1 top-1"
                      onRemove={() => {
                        const nextColumns = columns.filter((_, i) => i !== ci);
                        const nextRows = rows.map((r) => ({
                          ...r,
                          values: nextColumns.map((_, i) => Boolean(r.values[i < ci ? i : i + 1])),
                        }));
                        patchTable(nextColumns, nextRows);
                      }}
                    />
                  ) : null}
                  <EditableText path={`columns.${ci}`} value={c}>
                    {c}
                  </EditableText>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.id}>
                <td className="relative border-b border-border/60 p-3 text-foreground">
                  {editing ? (
                    <CmsListRemoveButton
                      label={`Rij verwijderen: ${r.feature}`}
                      className="right-1 top-1"
                      onRemove={() =>
                        patchTable(
                          columns,
                          rows.filter((row) => row.id !== r.id),
                        )
                      }
                    />
                  ) : null}
                  <EditableText path={`rows.${ri}.feature`} value={r.feature}>
                    {r.feature}
                  </EditableText>
                </td>
                {columns.map((_, i) => (
                  <td key={`${r.id}-${i}`} className="border-b border-border/60 p-3">
                    {r.values[i] ? "✓" : "✗"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <CmsListAddButton
            compact
            label="Kolom toevoegen"
            onAdd={() => {
              const nextColumns = [...columns, `Optie ${columns.length + 1}`];
              const nextRows = rows.map((r) => ({
                ...r,
                values: [...r.values.slice(0, columns.length), false],
              }));
              patchTable(nextColumns, nextRows);
            }}
          />
          <CmsListAddButton
            compact
            label="Rij toevoegen"
            onAdd={() =>
              patchTable(columns, [
                ...rows,
                {
                  id: createItemId("row"),
                  feature: "Nieuw kenmerk",
                  values: columns.map(() => false),
                },
              ])
            }
          />
        </div>
      ) : null}
      {editing && rows.length === 0 && columns.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nog geen rijen of kolommen.</p>
      ) : null}
    </SectionShell>
  );
}

export function ValuesSectionView({ data: d }: BlockSectionViewProps) {
  const type = "values" as BlockType;
  const list = useCmsTypedListEditor<{ id: string; title: string; body: string }>("values");
  const editing = list.editing;
  const values = (d.values as Array<{ id: string; title: string; body: string }>) ?? [];
  const title = String(d.title ?? "");
  return (
    <SectionShell blockType={type}>
      <SectionTitle>
        <EditableText path="title" value={title}>
          {title}
        </EditableText>
      </SectionTitle>
      <div className={cn(SECTION_GRID, "md:grid-cols-2")}>
        {values.map((v, i) => (
          <SectionSurface key={v.id} variant="outlined" className="relative p-5 sm:p-6">
            {editing ? (
              <CmsListRemoveButton
                label={`Waarde verwijderen: ${v.title}`}
                onRemove={() => list.removeById(values, v.id)}
              />
            ) : null}
            <div className="mb-3 flex items-center gap-3">
              <SectionIndex value={String(i + 1).padStart(2, "0")} />
              <h3 className="font-semibold text-foreground">
                <EditableText path={`values.${i}.title`} value={v.title}>
                  {v.title}
                </EditableText>
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              <EditableText path={`values.${i}.body`} value={v.body} multiline>
                {v.body}
              </EditableText>
            </p>
          </SectionSurface>
        ))}
        {editing ? (
          <CmsListAddButton
            label="Waarde toevoegen"
            onAdd={() =>
              list.append(values, {
                id: createItemId("val"),
                title: "Nieuwe waarde",
                body: "Toelichting",
              })
            }
          />
        ) : null}
      </div>
    </SectionShell>
  );
}

export function PortfolioSectionView({ data: d }: BlockSectionViewProps) {
  const type = "portfolio" as BlockType;
  const list = useCmsTypedListEditor<{
    id: string;
    title: string;
    category?: string;
    image?: CmsImage;
  }>("projects");
  const editing = list.editing;
  const projects =
    (d.projects as Array<{ id: string; title: string; category?: string; image?: CmsImage }>) ??
    [];
  const title = String(d.title ?? "");
  return (
    <SectionShell blockType={type}>
      <SectionTitle>
        <EditableText path="title" value={title}>
          {title}
        </EditableText>
      </SectionTitle>
      <div className={cn(SECTION_GRID, "sm:grid-cols-2 lg:grid-cols-3")}>
        {projects.map((p, index) => (
          <SectionSurface key={p.id} variant="media" className="relative overflow-hidden">
            {editing ? (
              <CmsListRemoveButton
                label={`Project verwijderen: ${p.title}`}
                onRemove={() => list.removeById(projects, p.id)}
              />
            ) : null}
            <EditableMedia
              path="projects"
              image={p.image}
              listItemId={p.id}
              listImageKey="image"
              emptyPlaceholder={editing}
              className="w-full"
            >
              <FitImage image={p.image} aspectClass="aspect-video" className="w-full" />
            </EditableMedia>
            <div className="p-4">
              <h3 className="font-semibold text-foreground">
                <EditableText path={`projects.${index}.title`} value={p.title}>
                  {p.title}
                </EditableText>
              </h3>
              {p.category || editing ? (
                <p className="text-xs text-muted-foreground">
                  <EditableText path={`projects.${index}.category`} value={p.category ?? ""}>
                    {p.category ?? ""}
                  </EditableText>
                </p>
              ) : null}
            </div>
          </SectionSurface>
        ))}
        {editing ? (
          <CmsListAddButton
            label="Project toevoegen"
            onAdd={() =>
              list.append(projects, {
                id: createItemId("proj"),
                title: "Nieuw project",
                category: "",
              })
            }
          />
        ) : null}
      </div>
    </SectionShell>
  );
}
