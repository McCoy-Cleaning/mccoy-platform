import { describe, expect, it } from "vitest";
import {
  addLayoutBlock,
  applyDraftToPage,
  createDefaultBlock,
  createItemId,
  createPreviewSnapshot,
  createRoadmapMilestone,
  createTextListItem,
  localImage,
  parseMigrateNormalizePage,
  resolvePreviewStatus,
  toPersistedBlockData,
  updateLayoutBlockData,
  validatePublishableCmsPage,
  type BlockType,
  type CmsPage,
  type GalleryBlockData,
  type PageDraft,
  type PlansBlockData,
  type PreviewSnapshot,
  type RoadmapBlockData,
} from "./index";

/**
 * In-memory harness that mirrors admin `cms` draft / preview / save / discard
 * without localStorage or postMessage. Same pure APIs the store uses.
 */
class LifecycleHarness {
  published: CmsPage;
  draft: PageDraft | undefined;
  snap: PreviewSnapshot | null = null;
  trackedVersion: number | undefined;
  private epoch = 1;

  constructor(published: CmsPage) {
    this.published = structuredClone(published);
  }

  editable(): CmsPage {
    return applyDraftToPage(this.published, this.draft);
  }

  commitDraft(page: CmsPage) {
    this.draft = { ...(this.draft ?? { overrides: {} }), page: structuredClone(page) };
    this.trackedVersion = undefined; // markPreviewStale
  }

  previewStatus() {
    return resolvePreviewStatus(this.snap, this.trackedVersion);
  }

  capturePreview() {
    const effective = this.editable();
    const overrides = { ...(this.draft?.overrides ?? {}) };
    this.epoch += 1;
    this.snap = createPreviewSnapshot(this.published.id, effective, overrides, this.epoch);
    this.trackedVersion = this.snap.version;
    return this.snap;
  }

  save(): { ok: true } | { ok: false; reason: string } {
    const effective = this.editable();
    const validated = validatePublishableCmsPage(effective);
    if (!validated.ok) {
      return { ok: false, reason: validated.issues.map((i) => i.message).join(" ") };
    }
    this.published = structuredClone(validated.page);
    this.published.version = (this.published.version ?? 1) + 1;
    this.draft = undefined;
    this.snap = null;
    this.trackedVersion = undefined;
    return { ok: true };
  }

  discard() {
    this.draft = undefined;
    this.snap = null;
    this.trackedVersion = undefined;
  }

  addBlock(type: BlockType) {
    const block = createDefaultBlock(type);
    const result = addLayoutBlock(this.editable(), block, this.editable().layout.length);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.code);
    this.commitDraft(result.page);
    return block.id;
  }

  updateBlock(blockId: string, data: Record<string, unknown>) {
    const persisted = toPersistedBlockData(
      this.editable().blocks.find((b) => b.id === blockId)!.type,
      data,
    );
    const result = updateLayoutBlockData(this.editable(), blockId, {
      ...persisted.data,
      dataVersion: persisted.dataVersion,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.code);
    this.commitDraft(result.page);
  }

  blockData<T>(blockId: string): T {
    return this.editable().blocks.find((b) => b.id === blockId)!.data as T;
  }

  publishedBlockData<T>(blockId: string): T | undefined {
    return this.published.blocks.find((b) => b.id === blockId)?.data as T | undefined;
  }

  snapBlockData<T>(blockId: string): T | undefined {
    return this.snap?.page.blocks.find((b) => b.id === blockId)?.data as T | undefined;
  }
}

function emptyCustomPage(): CmsPage {
  return parseMigrateNormalizePage({
    id: "page_lifecycle_test",
    slug: "/lifecycle-test",
    title: "Lifecycle",
    description: "",
    isCustom: true,
    inNav: false,
    blocks: [],
    updatedAt: 1,
    version: 1,
  })!;
}

function runLifecycleFor(
  type: BlockType,
  mutateCollection: (data: Record<string, unknown>) => Record<string, unknown>,
  assertMutated: (data: Record<string, unknown>) => void,
  secondEdit: (data: Record<string, unknown>) => Record<string, unknown>,
  assertSecondEdit: (data: Record<string, unknown>) => void,
) {
  const h = new LifecycleHarness(emptyCustomPage());

  // 1. Add block
  const blockId = h.addBlock(type);
  expect(h.editable().blocks.some((b) => b.id === blockId && b.type === type)).toBe(true);
  expect(h.previewStatus()).toBe("locked");

  // 2. Edit collection (add/remove/reorder)
  const afterCollection = mutateCollection(h.blockData(blockId));
  h.updateBlock(blockId, afterCollection);
  assertMutated(h.blockData(blockId));

  // 3. Bewerken (edit canvas) updates immediately
  const liveTitle = `Live ${type} ${Date.now()}`;
  h.updateBlock(blockId, { ...h.blockData(blockId), title: liveTitle });
  expect(h.blockData<{ title: string }>(blockId).title).toBe(liveTitle);
  expect(h.publishedBlockData<{ title: string }>(blockId)).toBeUndefined();

  // 4. Preview becomes stale after draft edit (once a snapshot exists)
  h.capturePreview();
  expect(h.previewStatus()).toBe("up_to_date");
  expect(h.snapBlockData<{ title: string }>(blockId)?.title).toBe(liveTitle);

  h.updateBlock(blockId, { ...h.blockData(blockId), title: `${liveTitle} — draft 2` });
  expect(h.previewStatus()).toBe("outdated");

  // 5. Capture preview snapshot → frozen
  const frozenTitle = h.blockData<{ title: string }>(blockId).title;
  h.capturePreview();
  expect(h.previewStatus()).toBe("up_to_date");
  expect(h.snapBlockData<{ title: string }>(blockId)?.title).toBe(frozenTitle);

  // 6. Edit draft again → Preview does NOT change until next capture
  const afterSecond = secondEdit(h.blockData(blockId));
  h.updateBlock(blockId, afterSecond);
  assertSecondEdit(h.blockData(blockId));
  expect(h.previewStatus()).toBe("outdated");
  expect(h.snapBlockData<{ title: string }>(blockId)?.title).toBe(frozenTitle);
  expect(h.blockData<{ title: string }>(blockId).title).not.toBe(frozenTitle);

  // 7. Save/publish
  const savedTitle = h.blockData<{ title: string }>(blockId).title;
  const save = h.save();
  expect(save.ok).toBe(true);
  expect(h.draft).toBeUndefined();
  expect(h.previewStatus()).toBe("locked");

  // 8. Reload public page → published block + ordering persist
  expect(h.publishedBlockData<{ title: string }>(blockId)?.title).toBe(savedTitle);
  assertSecondEdit(h.publishedBlockData(blockId)!);

  // 9. Reopen editor → saved content loads
  expect(h.editable().blocks.find((b) => b.id === blockId)?.data).toEqual(
    h.published.blocks.find((b) => b.id === blockId)?.data,
  );

  // 10. Modify then Discard → published content restored
  h.updateBlock(blockId, { ...h.blockData(blockId), title: "MOET VERDWIJNEN" });
  expect(h.blockData<{ title: string }>(blockId).title).toBe("MOET VERDWIJNEN");
  h.discard();
  expect(h.blockData<{ title: string }>(blockId).title).toBe(savedTitle);
  expect(h.publishedBlockData<{ title: string }>(blockId)?.title).toBe(savedTitle);
}

describe("CMS block lifecycle (draft → preview → publish → reload → discard)", () => {
  it("Roadmap: milestones + nested bullets add/remove/reorder through full lifecycle", () => {
    runLifecycleFor(
      "roadmap",
      (raw) => {
        const data = raw as unknown as RoadmapBlockData;
        const extra = createRoadmapMilestone({
          year: "2026",
          title: "Diepte",
          bullets: [createTextListItem("E2E dekking"), createTextListItem("A11y")],
        });
        const milestones = [...data.milestones, extra];
        // reorder: move first to end
        const reordered = [milestones[1]!, milestones[2]!, milestones[0]!];
        // remove a bullet from first remaining original
        reordered[0] = {
          ...reordered[0]!,
          bullets: reordered[0]!.bullets.slice(0, 1),
        };
        return { ...data, milestones: reordered } as unknown as Record<string, unknown>;
      },
      (raw) => {
        const data = raw as unknown as RoadmapBlockData;
        expect(data.milestones).toHaveLength(3);
        expect(data.milestones.some((m) => m.title === "Diepte")).toBe(true);
        expect(data.milestones[0]!.bullets.length).toBeLessThanOrEqual(2);
      },
      (raw) => {
        const data = raw as unknown as RoadmapBlockData;
        return {
          ...data,
          title: "Roadmap gepubliceerd",
          milestones: data.milestones.filter((m) => m.title !== "Start"),
        } as unknown as Record<string, unknown>;
      },
      (raw) => {
        const data = raw as unknown as RoadmapBlockData;
        expect(data.title).toBe("Roadmap gepubliceerd");
        expect(data.milestones.every((m) => m.title !== "Start")).toBe(true);
      },
    );
  });

  it("Plans: feature matrix add/remove/reorder through full lifecycle", () => {
    runLifecycleFor(
      "plans",
      (raw) => {
        const data = raw as unknown as PlansBlockData;
        const newFeat = { id: createItemId("feat"), label: "Spoeddienst" };
        const features = [...data.features, newFeat];
        // reorder features
        const reorderedFeatures = [features[2]!, features[0]!, features[1]!, features[3]!];
        const plans = data.plans.map((p, i) =>
          i === 0
            ? { ...p, includedFeatureIds: [...p.includedFeatureIds, newFeat.id] }
            : p,
        );
        // remove second plan
        return {
          ...data,
          features: reorderedFeatures,
          plans: plans.filter((_, i) => i !== 1),
        } as unknown as Record<string, unknown>;
      },
      (raw) => {
        const data = raw as unknown as PlansBlockData;
        expect(data.features.some((f) => f.label === "Spoeddienst")).toBe(true);
        expect(data.plans).toHaveLength(1);
        expect(data.features[0]!.label).toBe("Priority support");
      },
      (raw) => {
        const data = raw as unknown as PlansBlockData;
        return {
          ...data,
          title: "Pakketten live",
          plans: [
            ...data.plans,
            {
              id: createItemId("plan"),
              name: "Enterprise",
              price: "Op aanvraag",
              includedFeatureIds: data.features.map((f) => f.id),
              highlighted: true,
            },
          ],
        } as unknown as Record<string, unknown>;
      },
      (raw) => {
        const data = raw as unknown as PlansBlockData;
        expect(data.title).toBe("Pakketten live");
        expect(data.plans.some((p) => p.name === "Enterprise")).toBe(true);
      },
    );
  });

  it("Gallery: images add/remove/reorder through full lifecycle", () => {
    runLifecycleFor(
      "gallery",
      (raw) => {
        const data = raw as unknown as GalleryBlockData;
        const images = [
          { id: createItemId("img"), image: localImage("/images/cms/a.jpg", "A") },
          { id: createItemId("img"), image: localImage("/images/cms/b.jpg", "B") },
          { id: createItemId("img"), image: localImage("/images/cms/c.jpg", "C") },
        ];
        // reorder + remove middle
        return {
          ...data,
          images: [images[2]!, images[0]!],
        } as unknown as Record<string, unknown>;
      },
      (raw) => {
        const data = raw as unknown as GalleryBlockData;
        expect(data.images).toHaveLength(2);
        expect(data.images[0]!.image.alt).toBe("C");
        expect(data.images[1]!.image.alt).toBe("A");
      },
      (raw) => {
        const data = raw as unknown as GalleryBlockData;
        return {
          ...data,
          title: "Galerij gepubliceerd",
          images: [
            ...data.images,
            { id: createItemId("img"), image: localImage("/images/cms/d.jpg", "D") },
          ],
        } as unknown as Record<string, unknown>;
      },
      (raw) => {
        const data = raw as unknown as GalleryBlockData;
        expect(data.title).toBe("Galerij gepubliceerd");
        expect(data.images).toHaveLength(3);
        expect(data.images[2]!.image.alt).toBe("D");
      },
    );
  });

  it("preview stays frozen until next capture (shared protocol)", () => {
    const h = new LifecycleHarness(emptyCustomPage());
    const id = h.addBlock("featureGrid");
    h.capturePreview();
    const v1 = h.snap!.version;
    h.updateBlock(id, { ...h.blockData(id), title: "Stale check" });
    expect(h.previewStatus()).toBe("outdated");
    expect(h.snap!.version).toBe(v1);
    expect(h.snapBlockData<{ title: string }>(id)?.title).not.toBe("Stale check");
    h.capturePreview();
    expect(h.snap!.version).toBeGreaterThan(v1);
    expect(h.snapBlockData<{ title: string }>(id)?.title).toBe("Stale check");
    expect(h.previewStatus()).toBe("up_to_date");
  });
});
