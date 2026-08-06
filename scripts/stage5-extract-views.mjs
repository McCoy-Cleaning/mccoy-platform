/**
 * Mechanical Stage 5 extractor: pull RegisteredBlockView switch cases into
 * family modules and rewrite orchestration + registry.
 *
 * Preserves case body JSX textually (bit-for-bit inside the component body).
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const rbvPath = join(root, "packages/cms-renderer/src/blocks/RegisteredBlockView.tsx");
const src = readFileSync(rbvPath, "utf8");

const switchStart = src.indexOf("  switch (type) {");
// Windows checkouts may use CRLF; accept either line ending before the closing brace.
const switchEndLf = src.lastIndexOf("  }\n}");
const switchEndCrlf = src.lastIndexOf("  }\r\n}");
const switchEnd = Math.max(switchEndLf, switchEndCrlf);
if (switchStart < 0 || switchEnd < 0) {
  throw new Error("Could not locate switch in RegisteredBlockView");
}

const switchBody = src.slice(switchStart + "  switch (type) {".length, switchEnd);

/** @type {Array<{ types: string[], body: string }>} */
const cases = [];
const caseRe = /case\s+"([a-zA-Z]+)":/g;
const indices = [];
let m;
while ((m = caseRe.exec(switchBody))) {
  indices.push({ type: m[1], index: m.index, end: m.index + m[0].length });
}
indices.push({ type: "__END__", index: switchBody.length, end: switchBody.length });

for (let i = 0; i < indices.length - 1; i++) {
  const type = indices[i].type;
  if (type === "default" || type.startsWith("__")) continue;
  // find contiguous fall-through cases
  const types = [type];
  let j = i + 1;
  let bodyStart = indices[i].end;
  // If next case has empty body (fall-through), merge
  while (j < indices.length - 1) {
    const between = switchBody.slice(bodyStart, indices[j].index).trim();
    if (between === "" || between === "{") {
      // fall-through empty — but our cases usually have `{` immediately
    }
    // Detect fall-through: case "a":\n    case "b":
    const segment = switchBody.slice(indices[i].index, indices[j].index);
    if (/case\s+"[^"]+":\s*$/.test(segment.trim()) || segment.match(/case\s+"/g)?.length > 1) {
      // handled below via looking at empty bodies
    }
    break;
  }

  // Special handling: collect fall-through types that share one body
  let k = i;
  while (k + 1 < indices.length - 1) {
    const between = switchBody.slice(indices[k].end, indices[k + 1].index);
    // fall-through if only whitespace/newlines between case labels
    if (between.trim() === "") {
      types.push(indices[k + 1].type);
      k++;
    } else {
      break;
    }
  }

  const bodyBegin = indices[k].end;
  const bodyEnd = indices[k + 1].index;
  let body = switchBody.slice(bodyBegin, bodyEnd);
  // strip leading `{` / trailing `}` of case block
  body = body.replace(/^\s*\{\s*/, "").replace(/\s*\}\s*$/, "");
  // remove trailing break if any
  body = body.replace(/\s*break;\s*$/, "");
  cases.push({ types, body });
  i = k; // skip merged
}

const familyOf = {
  hero: "A",
  richText: "A",
  centered: "A",
  textImage: "A",
  featureGrid: "A",
  cta: "A",
  columns: "B",
  benefits: "B",
  steps: "B",
  comparisonTable: "B",
  values: "B",
  timeline: "B",
  roadmap: "B",
  portfolio: "B",
  gallery: "C",
  video: "C",
  beforeAfter: "C",
  carousel: "C",
  quote: "C",
  partnersMarquee: "C",
  statsCounters: "C",
  teamGrid: "C",
  teamProfile: "C",
  announcement: "C",
  latestPosts: "C",
  spacer: "C",
  contactInfoCards: "D",
  legalArticles: "D",
  newsletter: "E",
  contactForm: "E",
  popup: "E",
  quoteRequestForm: "E",
  plans: "F",
  jobs: "F",
  offers: "F",
};

const alreadyExtracted = new Set(["plans", "steps", "jobs", "offers"]);
// conversion already have dedicated components
const conversionReuse = new Set(["newsletter", "contactForm", "popup"]);

const byFamily = { A: [], B: [], C: [], D: [], E: [], F: [] };

for (const c of cases) {
  const primary = c.types[0];
  if (alreadyExtracted.has(primary) || conversionReuse.has(primary)) continue;
  if (c.types.every((t) => alreadyExtracted.has(t) || conversionReuse.has(t))) continue;
  // skip if all types already extracted
  const remaining = c.types.filter((t) => !alreadyExtracted.has(t) && !conversionReuse.has(t));
  if (!remaining.length) continue;
  const fam = familyOf[primary] || "F";
  byFamily[fam].push({ types: remaining.length === c.types.length ? c.types : remaining, body: c.body, allTypes: c.types });
}

const sharedHeader = `import * as React from "react";
import {
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
  cn,
  SectionTitle,
  OptionalImage,
  FitImage,
  CoverFillImage,
  OptionalCta,
  type BlockSectionViewProps,
} from "./blockViewShared";
`;

function componentName(type) {
  return type.charAt(0).toUpperCase() + type.slice(1) + "SectionView";
}

function emitFamily(letter, entries) {
  if (!entries.length) return null;
  const exports = [];
  let body = `/**
 * Stage 5 family ${letter} — extracted from RegisteredBlockView switch.
 * Markup inside each view must remain byte-equivalent to the prior case body.
 */
${sharedHeader}
`;

  for (const entry of entries) {
    if (entry.types.length === 1) {
      const type = entry.types[0];
      const name = componentName(type);
      exports.push(name);
      body += `
export function ${name}({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = ${JSON.stringify(type)} as BlockType;
${entry.body}
}
`;
    } else {
      // shared multi-type (richText/centered/cta)
      const name = "TitleBodyCtaSectionView";
      exports.push(name);
      for (const t of entry.types) {
        const wrap = componentName(t);
        exports.push(wrap);
      }
      body += `
export function ${name}({
  data: d,
  pages = [],
  blockType,
}: BlockSectionViewProps & { blockType: "richText" | "centered" | "cta" }) {
  const type = blockType;
${entry.body}
}
`;
      for (const t of entry.types) {
        const wrap = componentName(t);
        body += `
export function ${wrap}(props: BlockSectionViewProps) {
  return <TitleBodyCtaSectionView {...props} blockType=${JSON.stringify(t)} />;
}
`;
      }
    }
  }

  return { body, exports };
}

const familyFiles = {
  A: "BasicContentSectionViews.tsx",
  B: "StructuralSectionViews.tsx",
  C: "MediaSocialSectionViews.tsx",
  D: "InformationLegalSectionViews.tsx",
  E: "QuoteRequestFormSectionView.tsx",
  F: "SpecialisedSectionViews.tsx",
};

const registryImports = [];
const registryEntries = [
  `  jobs: JobsSectionView as unknown as ComponentType<Record<string, unknown>>,`,
  `  offers: OffersSectionView as unknown as ComponentType<Record<string, unknown>>,`,
  `  plans: PlansSectionView as unknown as ComponentType<Record<string, unknown>>,`,
  `  steps: StepsSectionView as unknown as ComponentType<Record<string, unknown>>,`,
  `  newsletter: NewsletterSectionView as unknown as ComponentType<Record<string, unknown>>,`,
  `  contactForm: ContactFormSectionView as unknown as ComponentType<Record<string, unknown>>,`,
  `  popup: PopupSectionView as unknown as ComponentType<Record<string, unknown>>,`,
];

const allNewExports = [];

for (const letter of ["A", "B", "C", "D", "E", "F"]) {
  const emitted = emitFamily(letter, byFamily[letter]);
  if (!emitted) continue;
  const file = familyFiles[letter];
  writeFileSync(join(root, "packages/cms-renderer/src/blocks", file), emitted.body);
  console.log("Wrote", file, "exports", emitted.exports.join(","));
  registryImports.push(
    `import { ${emitted.exports.join(", ")} } from "./${file.replace(/\\.tsx$/, "")}";`,
  );
  for (const exp of emitted.exports) {
    // skip shared TitleBodyCtaSectionView itself for registry keys
    if (exp === "TitleBodyCtaSectionView") continue;
    const type = exp.replace(/SectionView$/, "");
    const blockType = type.charAt(0).toLowerCase() + type.slice(1);
    // fix camelCase: RichText -> richText already handled by charAt lower of first only — wrong for FeatureGrid
    // Better: map from byFamily entries
  }
  allNewExports.push({ letter, file, exports: emitted.exports, entries: byFamily[letter] });
}

// Build accurate registry entries from family entries
for (const pack of allNewExports) {
  for (const entry of pack.entries) {
    for (const type of entry.types) {
      const name = componentName(type);
      registryEntries.push(
        `  ${type}: ${name} as unknown as ComponentType<Record<string, unknown>>,`,
      );
    }
  }
}

const registrySrc = `import type { BlockType } from "@mccoy/cms-schema";
import type { ComponentType } from "react";
import { JobsSectionView, type JobsSectionViewProps } from "./JobsSectionView";
import { OffersSectionView, type OffersSectionViewProps } from "./OffersSectionView";
import { PlansSectionView, type PlansSectionViewProps } from "./PlansSectionView";
import { StepsSectionView, type StepsSectionViewProps } from "./StepsSectionView";
import {
  ContactFormSectionView,
  NewsletterSectionView,
  PopupSectionView,
} from "./ConversionSectionViews";
${allNewExports
  .map((p) => {
    const exps = p.exports.filter((e) => e !== "TitleBodyCtaSectionView");
    return `import { ${exps.join(", ")} } from "./${p.file.replace(".tsx", "")}";`;
  })
  .join("\n")}

/**
 * Canonical publishable block views. RegisteredBlockView looks up here only.
 */
export const blockViewRegistry: Partial<
  Record<BlockType, ComponentType<Record<string, unknown>>>
> = {
${registryEntries.join("\n")}
};

export type {
  JobsSectionViewProps,
  OffersSectionViewProps,
  PlansSectionViewProps,
  StepsSectionViewProps,
};
`;

writeFileSync(join(root, "packages/cms-renderer/src/blocks/blockViewRegistry.ts"), registrySrc);

// Write orchestration-only RegisteredBlockView
const orchestration = `import * as React from "react";
import {
  parseBlockData,
  type Block,
  type BlockType,
} from "@mccoy/cms-schema";
import { blockViewRegistry } from "./blockViewRegistry";
import { registerPopupBlockView } from "./popupBlockRenderer";
import type { LinkResolverPages } from "./CmsImageView";

export type RegisteredBlockViewProps = {
  block: Block;
  pages?: LinkResolverPages;
  /** When true, show admin-visible warnings for invalid data instead of silent skip. */
  adminMode?: boolean;
};

export type BlockViewFallbackReason =
  | "unknown_type"
  | "legacy_non_block"
  | "unsupported_future_version"
  | "unregistered_publishable";

function FallbackView({
  type,
  reason,
  adminMode,
}: {
  type: string;
  reason: BlockViewFallbackReason;
  adminMode: boolean;
}) {
  console.error("[cms-renderer] block view fallback", { type, reason });
  if (adminMode) {
    return (
      <div className="rounded-xl border border-amber-400/40 p-4 text-amber-100" role="alert">
        Geen renderer voor {type} ({reason})
      </div>
    );
  }
  return null;
}

export function RegisteredBlockView({
  block,
  pages = [],
  adminMode = false,
}: RegisteredBlockViewProps) {
  const parsed = parseBlockData(block.type, block.data);
  if (!parsed.ok) {
    console.error("[cms-renderer] invalid block", {
      type: block.type,
      id: block.id,
      error: parsed.error,
    });
    if (adminMode) {
      return (
        <div
          className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100"
          role="alert"
        >
          Ongeldige sectie ({block.type}): {parsed.error}
        </div>
      );
    }
    return null;
  }

  const type = block.type as BlockType;
  const View = blockViewRegistry[type];
  if (!View) {
    return (
      <FallbackView type={type} reason="unknown_type" adminMode={adminMode} />
    );
  }

  return (
    <View
      data={parsed.data as Record<string, unknown>}
      pages={pages}
      blockId={block.id}
      adminMode={adminMode}
      mode={adminMode ? "preview" : "storefront"}
      showHidden={adminMode}
    />
  );
}

/** @deprecated Prefer RegisteredBlockView — kept for gradual migration. */
export function CmsBlockView({ type, data }: { type: string; data: Record<string, unknown> }) {
  return (
    <RegisteredBlockView
      block={{ id: "legacy", type: type as BlockType, data }}
      adminMode
    />
  );
}

registerPopupBlockView(RegisteredBlockView);
`;

writeFileSync(rbvPath, orchestration);

console.log("Cases parsed:", cases.length);
console.log(
  "By family counts:",
  Object.fromEntries(Object.entries(byFamily).map(([k, v]) => [k, v.length])),
);
console.log("RegisteredBlockView rewritten to orchestration-only");
