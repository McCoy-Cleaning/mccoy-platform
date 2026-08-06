/**
 * Stage 4 — barrel/inspector split guards:
 * - public export compatibility
 * - package boundaries
 * - no cycles via ./index or package self-import
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as CmsEditor from "./index";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = here;
const pkgRoot = join(here, "..");
const repoRoot = join(pkgRoot, "..", "..");

const EXPECTED_EXPORTS = [
  "RegisteredBlockEditor",
  "ObjectListEditor",
  "StringListEditor",
  "RoadmapBlockEditor",
  "PlansBlockEditor",
  "HeroBlockEditor",
  "TextImageBlockEditor",
  "CtaBlockEditor",
  "FeatureGridBlockEditor",
  "GalleryBlockEditor",
  "CarouselBlockEditor",
  "TeamGridBlockEditor",
  "JobsBlockEditor",
  "StructuredLinkField",
  "PAGE_DESTINATION_LINK_KINDS",
  "blockEditorRegistry",
  "getRegisteredBlockEditor",
  "getBlockEditorDefinition",
  "listBlockTypesMissingDedicatedEditor",
  "listUnsupportedPublishableBlockTypes",
  "CTA_SUPPORTED_PATHS",
  "imageSupportedPaths",
  "BulkImageAddButton",
  "ImageStripPreview",
  "CmsButtonEditor",
  "PopupContentTypeChooser",
  "PopupContentTypePicker",
  "SectionTypeThumbnail",
  "CMS_MAX_IMAGE_UPLOAD_BYTES",
  "CMS_MAX_SOURCE_IMAGE_BYTES",
  "CMS_MAX_STORED_IMAGE_BYTES",
  "compressProfileFromTags",
  "prepareCmsImageUpload",
  "validateImageUploadFile",
  "CmsAiAssistProvider",
  "InspectTextField",
  "ManualEnDraftField",
  "SectionAiToolbar",
  "collectShallowStringFields",
  "defaultMaxCharsForField",
  "isTranslatableFieldKey",
  "requestCmsOverwriteConfirm",
  "useCmsAiAssist",
  "buildSectionMutation",
  "EditInteractionGuard",
  "SectionSelectFrame",
  "PrototypeImageField",
  "TypedLinkField",
  "HomeHeroInspector",
  "FormChromeInspector",
  "ContactInfoInspector",
  "ContactFormInspector",
  "AboutMainInspector",
  "ServicesMainInspector",
  "ServicesCardsInspector",
  "ProductsMainInspector",
  "ProductsInfoInspector",
  "PartnersInspector",
  "StatsInspector",
  "WorkGalleryInspector",
  "BlockDataInspector",
  "LegalMainInspector",
  "SelectedSectionInspector",
  "HomeHeroView",
  "FormPageChromeView",
  "ContentAlignControl",
] as const;

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.endsWith(".bak")) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      listSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("Stage 4 — public export compatibility", () => {
  it("exports expected public names from package root", () => {
    const missing = EXPECTED_EXPORTS.filter((name) => !(name in CmsEditor));
    expect(missing).toEqual([]);
  });

  it("buildSectionMutation returns a section mutation", () => {
    const mutation = CmsEditor.buildSectionMutation("home.hero", { heading: "x" });
    expect(mutation).toEqual({ kind: "section", sectionKey: "home.hero", patch: { heading: "x" } });
  });
});

describe("Stage 4 — package boundaries", () => {
  it("cms-editor sources never import apps/admin", () => {
    const offenders = listSourceFiles(srcRoot)
      .map((file) => ({ file, content: readFileSync(file, "utf8") }))
      .filter(
        ({ content }) =>
          /apps\/admin/.test(content) ||
          /@\/components\/admin/.test(content) ||
          /from\s+["']@mccoy\/admin/.test(content),
      )
      .map(({ file }) => relative(repoRoot, file));
    expect(offenders).toEqual([]);
  });

  it("barrel index.tsx has no function/component bodies", () => {
    const barrel = readFileSync(join(srcRoot, "index.tsx"), "utf8");
    expect(barrel).not.toMatch(/^\s*(export\s+)?function\s+/m);
    expect(barrel).not.toMatch(/^\s*(export\s+)?const\s+\w+\s*=\s*(\(|function|async)/m);
    expect(barrel).not.toMatch(/^\s*import\s+/m);
    expect(barrel).toMatch(/re-exports only/);
    expect(barrel.trim().split(/\r?\n/).length).toBeLessThan(120);
  });
});

describe("Stage 4 — cycle heuristic", () => {
  it("extracted modules do not import ./index, ../index, or @mccoy/cms-editor", () => {
    const extractedRoots = [
      join(srcRoot, "EditInteractionGuard.tsx"),
      join(srcRoot, "SectionSelectFrame.tsx"),
      join(srcRoot, "selection.ts"),
      join(srcRoot, "PrototypeImageField.tsx"),
      join(srcRoot, "CardListEditor.tsx"),
      join(srcRoot, "inspector-chrome.tsx"),
      join(srcRoot, "list-helpers.tsx"),
      join(srcRoot, "placeholder-image.ts"),
      join(srcRoot, "inspector-types.ts"),
      join(srcRoot, "inspectors"),
    ];

    const files: string[] = [];
    for (const root of extractedRoots) {
      const stat = statSync(root);
      if (stat.isDirectory()) listSourceFiles(root, files);
      else files.push(root);
    }

    const INDEX_IMPORT =
      /from\s+["'](\.\/index|\.\.\/index|\.\.\/\.\.\/index|@mccoy\/cms-editor)["']/;
    const offenders = files
      .map((file) => ({ file, content: readFileSync(file, "utf8") }))
      .filter(({ content }) => INDEX_IMPORT.test(content))
      .map(({ file }) => relative(pkgRoot, file));

    expect(offenders).toEqual([]);
  });

  it("ai-assist does not import inspectors", () => {
    const ai = readFileSync(join(srcRoot, "ai-assist.tsx"), "utf8");
    expect(ai).not.toMatch(/from\s+["']\.\/inspectors/);
    expect(ai).not.toMatch(/HomeHeroInspector|SelectedSectionInspector|BlockDataInspector/);
  });
});
