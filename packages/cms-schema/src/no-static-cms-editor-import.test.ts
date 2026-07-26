import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// packages/cms-schema/src -> packages/cms-schema -> packages -> <repo root>
const repoRoot = join(here, "..", "..", "..");
const storefrontSrc = join(repoRoot, "apps", "storefront", "src");
const storefrontPkg = join(repoRoot, "apps", "storefront", "package.json");
const storefrontRoutes = join(storefrontSrc, "routes");
const cmsRendererSrc = join(repoRoot, "packages", "cms-renderer", "src");

/**
 * Storefront must not depend on CMS authoring. Catch static imports, dynamic
 * imports, and package.json dependency declarations.
 */
const STATIC_IMPORT_PATTERN =
  /(?:from\s+["']@mccoy\/cms-editor["']|^\s*import\s+["']@mccoy\/cms-editor["'])/m;
const DYNAMIC_IMPORT_PATTERN = /import\(\s*["']@mccoy\/cms-editor["']\s*\)/;
const ANY_CMS_EDITOR_REF = /@mccoy\/cms-editor/;

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".output") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      listSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function cmsEditorOffenders(root: string): string[] {
  return listSourceFiles(root)
    .map((file) => ({ file, content: readFileSync(file, "utf8") }))
    .filter(
      ({ content }) =>
        STATIC_IMPORT_PATTERN.test(content) ||
        DYNAMIC_IMPORT_PATTERN.test(content) ||
        ANY_CMS_EDITOR_REF.test(content),
    )
    .map(({ file }) => file);
}

describe("bundle hygiene — @mccoy/cms-editor stays admin-only", () => {
  it("storefront package.json does not declare @mccoy/cms-editor", () => {
    const pkg = JSON.parse(readFileSync(storefrontPkg, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.["@mccoy/cms-editor"]).toBeUndefined();
    expect(pkg.devDependencies?.["@mccoy/cms-editor"]).toBeUndefined();
  });

  it("no file under apps/storefront/src imports or references @mccoy/cms-editor", () => {
    const files = listSourceFiles(storefrontSrc);
    expect(files.length).toBeGreaterThan(0);
    expect(cmsEditorOffenders(storefrontSrc)).toEqual([]);
  });

  it("cms-renderer never imports @mccoy/cms-editor (storefront → renderer → schema)", () => {
    const files = listSourceFiles(cmsRendererSrc);
    expect(files.length).toBeGreaterThan(0);
    expect(cmsEditorOffenders(cmsRendererSrc)).toEqual([]);
  });

  it("EditModeShell uses a local guard, not cms-editor", () => {
    const shellPath = join(storefrontSrc, "components", "site", "EditModeShell.tsx");
    const content = readFileSync(shellPath, "utf8");
    expect(ANY_CMS_EDITOR_REF.test(content)).toBe(false);
    expect(content).toContain("EditInteractionGuard");
  });

  it("storefront has no /admin* route modules", () => {
    const adminRoutes = readdirSync(storefrontRoutes).filter(
      (name) => name === "admin.tsx" || name.startsWith("admin."),
    );
    expect(adminRoutes).toEqual([]);
  });
});
