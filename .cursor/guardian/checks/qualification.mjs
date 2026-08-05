import fs from "node:fs";
import path from "node:path";
import { packageScripts } from "../lib/project.mjs";
import { runPackageScript, run } from "../lib/process.mjs";
import { safeRead, normalizeSlashes } from "../lib/io.mjs";

export function determineMajorChange(changedFiles, policy) {
  const source = changedFiles.filter((file) => /\.(js|jsx|ts|tsx|mjs|cjs|py|go|rs|java|cs|vue|svelte)$/.test(file));
  let changedLines = 0;
  for (const file of source) {
    const text = safeRead(file);
    if (text != null) changedLines += text.split(/\r?\n/).length;
  }
  const major = source.length >= (policy.majorChangeMinSourceFiles ?? 4) ||
    changedLines >= (policy.majorChangeMinChangedLines ?? 150);
  return { major, sourceFiles: source.length, changedLines };
}

export function runQualification(root, guardian, changedFiles) {
  const q = guardian.qualification ?? {};
  const scripts = packageScripts(root);
  const majorInfo = determineMajorChange(changedFiles, q);
  const webAffected = changedFiles.some((file) => {
    const rel = normalizeSlashes(path.relative(root, file));
    return (q.webPathPatterns ?? []).some((prefix) => rel.startsWith(prefix));
  });
  const groups = ["lint", "typecheck", "test", "architecture", "security"];
  if (majorInfo.major) groups.push("mock", "contract", "integration", "live");
  if (webAffected) groups.push("seo");

  const results = [];
  const blockers = [];

  for (const group of groups) {
    const candidates = q.scriptGroups?.[group] ?? [];
    const selected = candidates.find((name) => scripts[name]);
    const required = isRequired(group, majorInfo.major, q);

    if (!selected) {
      results.push({ group, status: required ? "missing" : "skipped", script: null });
      if (required) blockers.push(`Required '${group}' script is missing. Add one of: ${candidates.join(", ") || "(configure candidates)"}`);
      continue;
    }

    if (group === "live") {
      const target = process.env.CURSOR_GUARDIAN_LIVE_BASE_URL;
      const validation = validateLiveTarget(target, q.allowedLiveHostPatterns ?? []);
      if (!validation.ok) {
        results.push({ group, status: "blocked", script: selected, message: validation.reason });
        blockers.push(`Live test blocked: ${validation.reason}`);
        continue;
      }
    }

    const execution = runPackageScript(root, selected, group === "live" ? 1_800_000 : 900_000);
    results.push({
      group,
      status: execution.ok ? "passed" : "failed",
      script: selected,
      stdout: truncate(execution.stdout),
      stderr: truncate(execution.stderr || execution.error || "")
    });
    if (!execution.ok) blockers.push(`${group} failed using '${selected}': ${truncate(execution.stderr || execution.stdout || execution.error || "unknown failure", 1000)}`);
  }

  if (!fs.existsSync(path.join(root, "package.json"))) {
    const git = run("git", ["diff", "--check"], { cwd: root, timeout: 60_000 });
    results.push({ group: "git-diff-check", status: git.ok ? "passed" : "failed", stderr: truncate(git.stderr) });
    if (!git.ok) blockers.push("git diff --check failed");
  }

  return { ok: blockers.length === 0, majorInfo, webAffected, results, blockers };
}

function isRequired(group, major, q) {
  if (["lint", "typecheck", "test"].includes(group)) return true;
  if (!major) return false;
  if (group === "mock") return q.requireMajorMockTests !== false;
  if (group === "contract") return q.requireMajorContractTests !== false;
  if (group === "integration") return q.requireMajorIntegrationTests !== false;
  if (group === "live") return q.requireMajorLiveTests !== false;
  return false;
}

function validateLiveTarget(value, patterns) {
  if (!value) return { ok: false, reason: "CURSOR_GUARDIAN_LIVE_BASE_URL is not set" };
  let url;
  try { url = new URL(value); }
  catch { return { ok: false, reason: "live base URL is invalid" }; }
  if (!["http:", "https:"].includes(url.protocol)) return { ok: false, reason: "live target must use HTTP(S)" };
  if (/(^|[.-])(prod|production)([.-]|$)/i.test(url.hostname)) return { ok: false, reason: `production-like hostname '${url.hostname}' is forbidden` };
  if (!patterns.some((pattern) => new RegExp(pattern, "i").test(url.hostname))) {
    return { ok: false, reason: `hostname '${url.hostname}' is not allowlisted` };
  }
  return { ok: true };
}
function truncate(value, max = 4000) { value = String(value ?? ""); return value.length > max ? value.slice(0, max) + "\n...[truncated]" : value; }
