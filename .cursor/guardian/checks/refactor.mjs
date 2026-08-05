import path from "node:path";
import { safeRead } from "../lib/io.mjs";

export function checkRefactor(changedFiles, policy) {
  const findings = [];
  for (const file of changedFiles) {
    const text = safeRead(file);
    if (text == null || !/\.(js|jsx|ts|tsx|mjs|cjs|py|go|rs|java|cs|vue|svelte)$/.test(file)) continue;
    const lines = text.split(/\r?\n/);
    const nonEmpty = lines.filter((line) => line.trim()).length;
    const branchCount = (text.match(/\b(if|else if|switch|case|for|while|catch|except|match)\b/g) ?? []).length;

    if (nonEmpty > (policy.maxFileLines ?? 700)) {
      findings.push(warn("large-file", file, `${path.basename(file)} has ${nonEmpty} non-empty lines; split responsibilities before adding more behavior.`));
    }
    if (branchCount > (policy.maxBranchKeywords ?? 35)) {
      findings.push(warn("branch-heavy", file, `${path.basename(file)} has approximately ${branchCount} branch constructs; consider extracting strategies or smaller functions.`));
    }
    if (policy.warnOnTsIgnore && /@ts-ignore|@ts-nocheck/.test(text)) {
      findings.push(warn("typescript-suppression", file, "TypeScript checking is suppressed; replace with a typed boundary or documented narrow exception."));
    }
    if (policy.warnOnBroadLintDisable && /eslint-disable(?!-next-line\s+\S)/.test(text)) {
      findings.push(warn("broad-lint-disable", file, "Broad eslint-disable detected; use a narrow rule-specific suppression."));
    }
    if (/\b(TODO|FIXME|HACK)\b/.test(text)) {
      findings.push(warn("debt-marker", file, "TODO/FIXME/HACK marker remains in changed code."));
    }
    if (/:\s*any\b|<any>|as\s+any\b/.test(text)) {
      findings.push(warn("explicit-any", file, "Explicit 'any' detected; prefer a real contract, unknown, or a validated boundary."));
    }
  }
  return findings;
}
function warn(rule, file, message) { return { severity: "warning", category: "refactor", rule, file, message }; }
