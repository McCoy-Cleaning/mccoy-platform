/** R8 finding schema validation + dedupe (deterministic). */

export const REVIEWS = [
  "architecture",
  "ui-ux",
  "accessibility",
  "seo",
  "security",
  "bug-risk",
  "performance",
  "platform",
];

export const SEVERITIES = ["blocker", "high", "medium", "low", "info"];
export const CONFIDENCES = ["high", "medium", "low"];
export const STATUSES = ["open", "fixed", "accepted-risk", "deferred", "false-positive"];

/**
 * @param {unknown} finding
 * @returns {{ ok: true, finding: object } | { ok: false, errors: string[] }}
 */
export function validateFinding(finding) {
  const errors = [];
  if (!finding || typeof finding !== "object") return { ok: false, errors: ["finding must be an object"] };
  const f = /** @type {Record<string, unknown>} */ (finding);
  for (const key of ["id", "ruleId", "review", "severity", "confidence", "path", "title", "impact", "recommendation", "status"]) {
    if (typeof f[key] !== "string" || !String(f[key]).trim()) errors.push(`missing/invalid ${key}`);
  }
  if (!REVIEWS.includes(/** @type {string} */ (f.review))) errors.push(`invalid review: ${f.review}`);
  if (!SEVERITIES.includes(/** @type {string} */ (f.severity))) errors.push(`invalid severity: ${f.severity}`);
  if (!CONFIDENCES.includes(/** @type {string} */ (f.confidence))) errors.push(`invalid confidence: ${f.confidence}`);
  if (!STATUSES.includes(/** @type {string} */ (f.status))) errors.push(`invalid status: ${f.status}`);
  if (!Array.isArray(f.evidence)) errors.push("evidence must be an array");
  else if ((f.severity === "blocker" || f.severity === "high") && f.evidence.length === 0) {
    errors.push("blocker/high requires evidence");
  }
  if ((f.severity === "blocker" || f.severity === "high") && typeof f.path !== "string") {
    errors.push("blocker/high requires path");
  }
  return errors.length ? { ok: false, errors } : { ok: true, finding: f };
}

/**
 * @param {object[]} findings
 */
export function dedupeFindings(findings) {
  const map = new Map();
  for (const finding of findings) {
    const key = [finding.ruleId, finding.path, finding.symbol ?? ""].join("|");
    const existing = map.get(key);
    if (!existing) {
      map.set(key, finding);
      continue;
    }
    const merged = {
      ...existing,
      ...finding,
      evidence: uniqueStrings([...(existing.evidence ?? []), ...(finding.evidence ?? [])]),
      relatedFindings: uniqueStrings([...(existing.relatedFindings ?? []), ...(finding.relatedFindings ?? []), existing.id, finding.id].filter((id) => id !== existing.id && id !== finding.id)),
      id: existing.id,
    };
    // Keep higher severity
    if (severityRank(finding.severity) < severityRank(existing.severity)) {
      merged.severity = finding.severity;
      merged.title = finding.title;
      merged.impact = finding.impact;
      merged.recommendation = finding.recommendation;
    }
    map.set(key, merged);
  }
  return [...map.values()];
}

function severityRank(severity) {
  return SEVERITIES.indexOf(severity);
}

function uniqueStrings(values) {
  return [...new Set(values.filter((v) => typeof v === "string" && v.trim()))];
}

/**
 * @param {object[]} findings
 */
export function summarizeFindings(findings) {
  const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
  }
  return { total: findings.length, bySeverity, byStatus };
}
