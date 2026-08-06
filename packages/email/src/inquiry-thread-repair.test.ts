import { describe, expect, it } from "vitest";
import {
  buildInquiryThreadRepairReport,
  evidenceFromCorrelation,
} from "./inquiry-thread-repair";

describe("buildInquiryThreadRepairReport", () => {
  it("flags only high-confidence clusters for auto-merge eligibility", () => {
    const report = buildInquiryThreadRepairReport([
      {
        canonicalInquiryId: "a",
        duplicateInquiryIds: ["b"],
        matchingEvidence: ["in_reply_to_match", "same_conversation_id"],
        messageIdsToMove: ["m1"],
        confidence: "low",
        warnings: [],
      },
      {
        canonicalInquiryId: "c",
        duplicateInquiryIds: ["d"],
        matchingEvidence: ["same_conversation_id"],
        messageIdsToMove: ["m2"],
        confidence: "high",
        warnings: [],
      },
    ]);

    expect(report.candidateCount).toBe(2);
    expect(report.highConfidenceCount).toBe(1);
    expect(report.candidates[0]?.confidence).toBe("high");
    expect(report.candidates[1]?.confidence).toBe("medium");
    expect(report.candidates[1]?.warnings[0]).toMatch(/manual review/i);
  });

  it("maps correlation results to evidence tags", () => {
    expect(
      evidenceFromCorrelation({
        status: "appended",
        inquiryId: "x",
        match: "in_reply_to",
      }),
    ).toEqual(["in_reply_to_match"]);
  });
});
