#!/usr/bin/env node
/**
 * Small deterministic R8 review runner.
 * Aggregates static checks, validates finding schema, dedupes, writes JSON.
 * Does NOT run LLM reviews and is not a subjective CI gate.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runDeterministicChecks } from "./deterministic-checks.mjs";
import { validateFinding, dedupeFindings, summarizeFindings, REVIEWS } from "./finding-schema.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

function parseArgs(argv) {
  const args = { review: "all", write: true, fixtures: false, outDir: path.join(root, "docs", "reviews") };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--review") args.review = argv[++i] ?? "all";
    else if (a === "--no-write") args.write = false;
    else if (a === "--fixtures") args.fixtures = true;
    else if (a === "--out") args.outDir = path.resolve(argv[++i] ?? args.outDir);
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      "Usage: node scripts/r8-review/cli.mjs [--review <name|all>] [--fixtures] [--no-write] [--out dir]\n",
    );
    process.exit(0);
  }

  const fixtureDir = args.fixtures ? path.join(__dirname, "fixtures") : undefined;
  let findings = runDeterministicChecks(root, { fixtureDir });
  if (args.review !== "all") {
    if (!REVIEWS.includes(args.review)) {
      process.stderr.write(`Unknown review: ${args.review}\n`);
      process.exit(2);
    }
    findings = findings.filter((f) => f.review === args.review);
  }

  const errors = [];
  const valid = [];
  for (const finding of findings) {
    const result = validateFinding(finding);
    if (!result.ok) errors.push({ id: finding.id, errors: result.errors });
    else valid.push(result.finding);
  }
  if (errors.length) {
    process.stderr.write(JSON.stringify({ schemaErrors: errors }, null, 2) + "\n");
    process.exit(2);
  }

  const deduped = dedupeFindings(valid);
  const summary = summarizeFindings(deduped);
  const head = safeGitHead();
  const payload = {
    generatedAt: new Date().toISOString(),
    head,
    mode: "deterministic-static",
    reviewFilter: args.review,
    summary,
    findings: deduped,
  };

  if (args.write) {
    fs.mkdirSync(args.outDir, { recursive: true });
    const jsonPath = path.join(args.outDir, "r8-deterministic-findings.json");
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
    process.stdout.write(`Wrote ${path.relative(root, jsonPath)}\n`);
  }

  process.stdout.write(JSON.stringify({ summary, findingCount: deduped.length, schemaErrors: 0 }, null, 2) + "\n");
  if (args.fixtures && deduped.length === 0) {
    process.stderr.write("Fixture self-test produced zero findings\n");
    process.exit(1);
  }
  process.exit(0);
}

function safeGitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

main();
