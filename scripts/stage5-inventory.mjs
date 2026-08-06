import { readFileSync, existsSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const root = process.cwd();
const blockTypesSrc = readFileSync(join(root, "packages/cms-schema/src/block-types.ts"), "utf8");
const types = [...blockTypesSrc.matchAll(/\|\s*"([a-zA-Z]+)"/g)].map((m) => m[1]);

const registrySrc = readFileSync(
  join(root, "packages/cms-renderer/src/blocks/blockViewRegistry.ts"),
  "utf8",
);
const editorSrc = readFileSync(
  join(root, "packages/cms-editor/src/blocks/blockEditorRegistry.ts"),
  "utf8",
);
const rbv = readFileSync(
  join(root, "packages/cms-renderer/src/blocks/RegisteredBlockView.tsx"),
  "utf8",
);

const registeredViews = [...registrySrc.matchAll(/^\s*([a-zA-Z]+):\s/gm)]
  .map((m) => m[1])
  .filter((t) => types.includes(t));
const editorKeys = [...editorSrc.matchAll(/^\s*([a-zA-Z]+):\s*def\(/gm)].map((m) => m[1]);
const switchCases = [...rbv.matchAll(/case\s+"([a-zA-Z]+)"/g)].map((m) => m[1]);

function collectTemplateTypes(path) {
  if (!existsSync(path)) return [];
  const s = readFileSync(path, "utf8");
  return [...s.matchAll(/type:\s*"([a-zA-Z]+)"/g)].map((m) => m[1]);
}

const adminTpl = collectTemplateTypes(join(root, "apps/admin/src/lib/cms/templates.ts"));
const sfTpl = collectTemplateTypes(join(root, "apps/storefront/src/lib/cms/templates.ts"));

const family = {
  hero: "A-basic-content",
  richText: "A-basic-content",
  centered: "A-basic-content",
  textImage: "A-basic-content",
  featureGrid: "A-basic-content",
  cta: "A-basic-content",
  columns: "B-structural",
  benefits: "B-structural",
  steps: "B-structural",
  comparisonTable: "B-structural",
  values: "B-structural",
  timeline: "B-structural",
  roadmap: "B-structural",
  portfolio: "B-structural",
  gallery: "C-media-social-proof",
  video: "C-media-social-proof",
  beforeAfter: "C-media-social-proof",
  carousel: "C-media-social-proof",
  quote: "C-media-social-proof",
  partnersMarquee: "C-media-social-proof",
  statsCounters: "C-media-social-proof",
  teamGrid: "C-media-social-proof",
  teamProfile: "C-media-social-proof",
  announcement: "C-media-social-proof",
  latestPosts: "C-media-social-proof",
  spacer: "C-media-social-proof",
  contactInfoCards: "D-information-legal",
  legalArticles: "D-information-legal",
  newsletter: "E-conversion-forms",
  contactForm: "E-conversion-forms",
  popup: "E-conversion-forms",
  quoteRequestForm: "E-conversion-forms",
  plans: "F-specialised",
  jobs: "F-specialised",
  offers: "F-specialised",
};

const schemaModule = {
  plans: "packages/cms-schema/src/blocks/plans.ts",
  jobs: "packages/cms-schema/src/blocks/jobs.ts",
  roadmap: "packages/cms-schema/src/blocks/roadmap.ts",
  timeline: "packages/cms-schema/src/blocks/timeline.ts",
  offers: "packages/cms-schema/src/blocks/offers.ts",
  partnersMarquee: "packages/cms-schema/src/blocks/new-sections.ts",
  statsCounters: "packages/cms-schema/src/blocks/new-sections.ts",
  contactInfoCards: "packages/cms-schema/src/blocks/new-sections.ts",
  quoteRequestForm: "packages/cms-schema/src/blocks/new-sections.ts",
  legalArticles: "packages/cms-schema/src/blocks/new-sections.ts",
};
for (const t of types) {
  if (!schemaModule[t]) schemaModule[t] = "packages/cms-schema/src/blocks/catalog.ts";
}

const editorModuleHints = {
  hero: "packages/cms-editor/src/blocks/HeroBlockEditor.tsx",
  cta: "packages/cms-editor/src/blocks/CtaBlockEditor.tsx",
  featureGrid: "packages/cms-editor/src/blocks/FeatureGridBlockEditor.tsx",
  textImage: "packages/cms-editor/src/blocks/TextImageBlockEditor.tsx",
  gallery: "packages/cms-editor/src/blocks/GalleryBlockEditor.tsx",
  carousel: "packages/cms-editor/src/blocks/GalleryBlockEditor.tsx",
  jobs: "packages/cms-editor/src/blocks/TeamJobsBlockEditor.tsx",
  teamGrid: "packages/cms-editor/src/blocks/TeamJobsBlockEditor.tsx",
  roadmap: "packages/cms-editor/src/blocks/RoadmapBlockEditor.tsx",
  plans: "packages/cms-editor/src/blocks/PlansBlockEditor.tsx",
  video: "packages/cms-editor/src/blocks/MediaBlockEditors.tsx",
  beforeAfter: "packages/cms-editor/src/blocks/MediaBlockEditors.tsx",
  quote: "packages/cms-editor/src/blocks/MiscBlockEditors.tsx",
  announcement: "packages/cms-editor/src/blocks/MiscBlockEditors.tsx",
  spacer: "packages/cms-editor/src/blocks/MiscBlockEditors.tsx",
  teamProfile: "packages/cms-editor/src/blocks/MiscBlockEditors.tsx",
  newsletter: "packages/cms-editor/src/blocks/ConversionBlockEditors.tsx",
  contactForm: "packages/cms-editor/src/blocks/ConversionBlockEditors.tsx",
  popup: "packages/cms-editor/src/blocks/ConversionBlockEditors.tsx",
  richText: "packages/cms-editor/src/blocks/TitleBodyCtaBlockEditor.tsx",
  centered: "packages/cms-editor/src/blocks/TitleBodyCtaBlockEditor.tsx",
  columns: "packages/cms-editor/src/blocks/StructureBlockEditors.tsx",
  steps: "packages/cms-editor/src/blocks/StructureBlockEditors.tsx",
  values: "packages/cms-editor/src/blocks/StructureBlockEditors.tsx",
  benefits: "packages/cms-editor/src/blocks/StructureBlockEditors.tsx",
  timeline: "packages/cms-editor/src/blocks/StructureBlockEditors.tsx",
  comparisonTable: "packages/cms-editor/src/blocks/StructureBlockEditors.tsx",
  portfolio: "packages/cms-editor/src/blocks/StructureBlockEditors.tsx",
  latestPosts: "packages/cms-editor/src/blocks/StructureBlockEditors.tsx",
  partnersMarquee: "packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx",
  statsCounters: "packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx",
  contactInfoCards: "packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx",
  quoteRequestForm: "packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx",
  legalArticles: "packages/cms-editor/src/blocks/NewSectionsBlockEditors.tsx",
  offers: "packages/cms-editor/src/blocks/OffersBlockEditor.tsx",
};

const rendererModule = {
  plans: "packages/cms-renderer/src/blocks/PlansSectionView.tsx",
  jobs: "packages/cms-renderer/src/blocks/JobsSectionView.tsx",
  offers: "packages/cms-renderer/src/blocks/OffersSectionView.tsx",
  steps: "packages/cms-renderer/src/blocks/StepsSectionView.tsx",
  newsletter: "packages/cms-renderer/src/blocks/ConversionSectionViews.tsx",
  contactForm: "packages/cms-renderer/src/blocks/ConversionSectionViews.tsx",
  popup: "packages/cms-renderer/src/blocks/ConversionSectionViews.tsx",
};

function findTests(type) {
  const dirs = [
    "packages/cms-renderer/src/blocks",
    "packages/cms-schema/src/blocks",
    "packages/cms-editor/src/blocks",
  ];
  const found = [];
  for (const dir of dirs) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (!/\.test\.(ts|tsx)$/.test(f)) continue;
      const body = readFileSync(join(abs, f), "utf8");
      if (body.includes(`"${type}"`) || body.includes(`'${type}'`) || body.includes(type)) {
        found.push(`${dir}/${f}`);
      }
    }
  }
  return found.slice(0, 8);
}

const rows = types.map((type) => {
  const inRegistry = registeredViews.includes(type);
  const inEditor = editorKeys.includes(type);
  const hasSwitch = switchCases.includes(type);
  const tplAdmin = adminTpl.filter((t) => t === type).length;
  const tplSf = sfTpl.filter((t) => t === type).length;
  let status = "complete";
  if (!inEditor) status = "missing-editor";
  else if (!inRegistry && hasSwitch) status = "switch-fallback";
  else if (!inRegistry) status = "missing-renderer";
  else if (inRegistry && hasSwitch) status = "complete"; // registered + dispatch arm
  return {
    type,
    family: family[type] ?? "F-specialised",
    publishable: true,
    selectable: true,
    persistedInFixtures: tplAdmin + tplSf > 0,
    schemaModule: schemaModule[type],
    defaultFactory: `createDefault / catalogDefinitions[${type}].createDefault`,
    normalizer: `catalogDefinitions[${type}].normalize`,
    validator: `catalogDefinitions[${type}].validateForPublish (via registry)`,
    editorModule: editorModuleHints[type] ?? null,
    editorRegistered: inEditor,
    rendererModule: rendererModule[type] ?? (hasSwitch ? "RegisteredBlockView.tsx (inline switch)" : null),
    rendererRegistered: inRegistry,
    inlineSwitchLocation: hasSwitch ? `RegisteredBlockView.tsx case "${type}"` : null,
    templateEntries: [
      ...(tplAdmin ? [`admin/templates ×${tplAdmin}`] : []),
      ...(tplSf ? [`storefront/templates ×${tplSf}`] : []),
    ],
    translatableFieldCoverage: "EN drafts via fieldPath conventions (cms-schema translation-*)",
    currentTests: findTests(type),
    status,
  };
});

const out = {
  generatedAt: new Date().toISOString(),
  blockTypeCount: types.length,
  registeredViewCount: registeredViews.length,
  editorRegisteredCount: editorKeys.length,
  missingRendererRegistry: types.filter((t) => !registeredViews.includes(t)),
  missingEditor: types.filter((t) => !editorKeys.includes(t)),
  rows,
};

writeFileSync(join(root, "scripts/stage5-inventory.json"), JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      blockTypeCount: out.blockTypeCount,
      registeredViews,
      missingRendererRegistry: out.missingRendererRegistry,
      missingEditor: out.missingEditor,
      statusCounts: rows.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {}),
    },
    null,
    2,
  ),
);
