import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_BLOCK_TYPES, PUBLISHABLE_BLOCK_TYPES } from "./blocks/registry";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");

function extractTemplateTypes(filePath: string): string[] {
  const content = readFileSync(filePath, "utf8");
  // Only top-level TEMPLATES entries (4-space indent), not nested defaultData fields.
  const types = [...content.matchAll(/^ {4}type:\s*"([a-zA-Z]+)"/gm)].map((m) => m[1]!);
  return [...new Set(types)];
}

describe("admin + storefront TEMPLATES sync with registry", () => {
  it("selectable template types equal PUBLISHABLE_BLOCK_TYPES (sorted)", () => {
    const adminTypes = extractTemplateTypes(
      join(repoRoot, "apps", "admin", "src", "lib", "cms", "templates.ts"),
    );
    const storefrontTypes = extractTemplateTypes(
      join(repoRoot, "apps", "storefront", "src", "lib", "cms", "templates.ts"),
    );

    expect([...adminTypes].sort()).toEqual([...PUBLISHABLE_BLOCK_TYPES].sort());
    expect([...storefrontTypes].sort()).toEqual([...PUBLISHABLE_BLOCK_TYPES].sort());
    expect(adminTypes).toContain("newsletter");
    expect(adminTypes).toContain("contactForm");
    expect(adminTypes).toContain("popup");
  });

  it("both TEMPLATES files call assertPickerTypesMatchRegistry at load", () => {
    for (const rel of [
      join("apps", "admin", "src", "lib", "cms", "templates.ts"),
      join("apps", "storefront", "src", "lib", "cms", "templates.ts"),
    ]) {
      const content = readFileSync(join(repoRoot, rel), "utf8");
      expect(content).toContain("assertPickerTypesMatchRegistry(TEMPLATES.map((t) => t.type))");
    }
  });
});
