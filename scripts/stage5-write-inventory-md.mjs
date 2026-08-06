import { readFileSync, writeFileSync } from "fs";

const data = JSON.parse(readFileSync("scripts/stage5-inventory.json", "utf8"));
const lines = [];
lines.push("# Stage 5 — CMS registry inventory");
lines.push("");
lines.push(
  data.missingRendererRegistry.length === 0 && data.missingEditor.length === 0
    ? "**Status:** Complete (all publishable types registered)"
    : "**Status:** In progress — gaps remain",
);
lines.push(`**Generated:** ${data.generatedAt}`);
lines.push(
  "**Source of truth:** `BlockType` union in `packages/cms-schema/src/block-types.ts`, catalogs, editor/renderer registries, templates, tests.",
);
lines.push("");
lines.push("## Summary");
lines.push("");
lines.push("| Metric | Value |");
lines.push("|--------|------:|");
lines.push(`| BlockType count | ${data.blockTypeCount} |`);
lines.push(
  `| Editor registered | ${data.editorRegisteredCount} / ${data.blockTypeCount} |`,
);
lines.push(
  `| Renderer registered (blockViewRegistry) | ${data.registeredViewCount} / ${data.blockTypeCount} |`,
);
lines.push(`| Missing renderer registry | ${data.missingRendererRegistry.length} |`);
lines.push(`| Missing editor | ${data.missingEditor.length} |`);
lines.push("");
lines.push("### Already registered (preserve)");
lines.push("");
lines.push("- `steps` → StepsSectionView");
lines.push("- `jobs` → JobsSectionView");
lines.push("- `offers` → OffersSectionView");
lines.push("- `plans` → PlansSectionView (checkpoint d1b3c12)");
lines.push("");
lines.push("### Conversion views exist but not registry-keyed yet");
lines.push("");
lines.push(
  "- `newsletter`, `contactForm`, `popup` → ConversionSectionViews.tsx (inline switch dispatch)",
);
lines.push("");
lines.push("## Inventory rows");
lines.push("");
lines.push(
  "| type | family | publishable | selectable | editorReg | rendererReg | status | schema | editor | renderer | switch |",
);
lines.push(
  "|------|--------|:-----------:|:----------:|:---------:|:-----------:|--------|--------|--------|----------|--------|",
);
for (const r of data.rows) {
  lines.push(
    "| " +
      [
        r.type,
        r.family,
        r.publishable ? "Y" : "N",
        r.selectable ? "Y" : "N",
        r.editorRegistered ? "Y" : "N",
        r.rendererRegistered ? "Y" : "N",
        r.status,
        r.schemaModule.replace("packages/cms-schema/src/", ""),
        (r.editorModule || "—").replace("packages/cms-editor/src/blocks/", ""),
        (r.rendererModule || "—")
          .replace("packages/cms-renderer/src/blocks/", "")
          .replace("RegisteredBlockView.tsx (inline switch)", "inline"),
        r.inlineSwitchLocation ? "Y" : "N",
      ].join(" | ") +
      " |",
  );
}
lines.push("");
lines.push("## Per-type detail");
lines.push("");
for (const r of data.rows) {
  lines.push(`### \`${r.type}\``);
  lines.push("");
  lines.push(`- **family:** ${r.family}`);
  lines.push(`- **publishable / selectable:** ${r.publishable} / ${r.selectable}`);
  lines.push(`- **persistedInFixtures:** ${r.persistedInFixtures}`);
  lines.push(`- **schemaModule:** \`${r.schemaModule}\``);
  lines.push(`- **defaultFactory:** ${r.defaultFactory}`);
  lines.push(`- **normalizer:** ${r.normalizer}`);
  lines.push(`- **validator:** ${r.validator}`);
  lines.push(
    `- **editorModule:** \`${r.editorModule || "null"}\` (registered=${r.editorRegistered})`,
  );
  lines.push(
    `- **rendererModule:** \`${r.rendererModule || "null"}\` (registered=${r.rendererRegistered})`,
  );
  lines.push(`- **inlineSwitchLocation:** ${r.inlineSwitchLocation || "null"}`);
  lines.push(
    `- **templateEntries:** ${
      r.templateEntries.length
        ? r.templateEntries.join(", ")
        : "(none detected in templates.ts type literals)"
    }`,
  );
  lines.push(`- **translatableFieldCoverage:** ${r.translatableFieldCoverage}`);
  lines.push(
    `- **currentTests:** ${
      r.currentTests.length
        ? r.currentTests.map((t) => `\`${t}\``).join(", ")
        : "(none matched)"
    }`,
  );
  lines.push(`- **status:** \`${r.status}\``);
  lines.push("");
}
lines.push("## Explicit exemptions");
lines.push("");
lines.push(
  "No BlockType exemptions at baseline. Fixed builtin sections (`services.main`, `services.cards`, `home.hero`, Producten fixed keys, etc.) are **not** BlockTypes and are out of Stage 5 registry scope (explicit non-block paths).",
);
lines.push("");
lines.push("## Baseline line counts (Phase 0)");
lines.push("");
lines.push("| File | Lines (approx) | Responsibility |");
lines.push("|------|---------------:|----------------|");
lines.push(
  "| RegisteredBlockView.tsx | 1214 | parse + large JSX switch + registry dispatch for 4 types |",
);
lines.push("| blockViewRegistry.ts | 24 | Partial map: jobs, offers, plans, steps |");
lines.push("| blockEditorRegistry.ts | 497 | Full editor map (35/35) |");
lines.push("| catalog.ts | 1413 | Inline + imported block definitions |");
lines.push("");
lines.push("## Stage5BlockInventoryRow shape");
lines.push("");
lines.push("```ts");
lines.push("type Stage5BlockInventoryRow = {");
lines.push("  type: BlockType;");
lines.push('  family: "A-basic-content" | "B-structural" | "C-media-social-proof"');
lines.push('    | "D-information-legal" | "E-conversion-forms" | "F-specialised" | "explicit-exemption";');
lines.push("  publishable: boolean;");
lines.push("  selectable: boolean;");
lines.push("  persistedInFixtures: boolean;");
lines.push("  schemaModule: string;");
lines.push("  defaultFactory: string;");
lines.push("  normalizer: string;");
lines.push("  validator: string;");
lines.push("  editorModule: string | null;");
lines.push("  editorRegistered: boolean;");
lines.push("  rendererModule: string | null;");
lines.push("  rendererRegistered: boolean;");
lines.push("  inlineSwitchLocation: string | null;");
lines.push("  templateEntries: string[];");
lines.push("  translatableFieldCoverage: string | null;");
lines.push("  currentTests: string[];");
lines.push('  status: "complete" | "missing-schema" | "missing-editor" | "missing-renderer"');
lines.push('    | "switch-fallback" | "exempt";');
lines.push("  exemptionReason?: string;");
lines.push("};");
lines.push("```");
lines.push("");

writeFileSync("docs/refactoring/stage5-registry-inventory.md", lines.join("\n"));
console.log("Wrote inventory, rows=", data.rows.length);
