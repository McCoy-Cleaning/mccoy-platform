/**
 * Dry-run repair report for historical duplicate Aanvragen caused by missing
 * thread correlation. Does not mutate data — callers decide which high-confidence
 * merges to apply after review.
 */
import type { CorrelateInboundResult } from "./inquiry-thread-correlation";

export type InquiryThreadRepairCandidate = {
  canonicalInquiryId: string;
  duplicateInquiryIds: string[];
  matchingEvidence: Array<
    | "same_conversation_id"
    | "in_reply_to_match"
    | "references_match"
    | "known_outbound_message_match"
  >;
  messageIdsToMove: string[];
  confidence: "high" | "medium" | "low";
  warnings: string[];
};

export type InquiryThreadRepairReport = {
  generatedAt: string;
  candidateCount: number;
  highConfidenceCount: number;
  candidates: InquiryThreadRepairCandidate[];
};

/**
 * Build a dry-run report from pre-computed duplicate clusters.
 * Auto-merge is never performed here — only high-confidence candidates are flagged.
 */
export function buildInquiryThreadRepairReport(
  candidates: InquiryThreadRepairCandidate[],
): InquiryThreadRepairReport {
  const normalised = candidates.map((candidate) => {
    const evidence = [...new Set(candidate.matchingEvidence)];
    let confidence = candidate.confidence;
    if (evidence.length === 0) confidence = "low";
    else if (
      evidence.includes("in_reply_to_match") ||
      evidence.includes("references_match") ||
      evidence.includes("known_outbound_message_match")
    ) {
      confidence = evidence.includes("same_conversation_id") ? "high" : "medium";
    } else if (evidence.length === 1 && evidence[0] === "same_conversation_id") {
      confidence = "medium";
    }
    const warnings = [...candidate.warnings];
    if (confidence !== "high") {
      warnings.push("Requires manual review — will not auto-merge.");
    }
    return { ...candidate, matchingEvidence: evidence, confidence, warnings };
  });

  return {
    generatedAt: new Date().toISOString(),
    candidateCount: normalised.length,
    highConfidenceCount: normalised.filter((c) => c.confidence === "high").length,
    candidates: normalised,
  };
}

/** Map a correlation result into repair evidence tags when linking duplicates. */
export function evidenceFromCorrelation(
  result: CorrelateInboundResult,
): InquiryThreadRepairCandidate["matchingEvidence"] {
  if (result.status === "appended") {
    if (result.match === "in_reply_to") return ["in_reply_to_match"];
    if (result.match === "references") return ["references_match"];
    if (result.match === "conversation_id") return ["same_conversation_id"];
  }
  if (result.status === "already_processed") {
    return ["known_outbound_message_match"];
  }
  return [];
}
