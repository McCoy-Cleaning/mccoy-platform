export type ContentAiAuditRecord = {
  id: string;
  operation: "generate_nl" | "translate_nl_en" | "generate_section";
  actorUsername?: string;
  pageId?: string;
  provider: "groq";
  model: string;
  promptVersion: string;
  sourceHash: string;
  cacheHit: boolean;
  warnings: string[];
  createdAt: string;
};

type AuditSink = (record: ContentAiAuditRecord) => Promise<void> | void;

const memoryAudit: ContentAiAuditRecord[] = [];
let sink: AuditSink | null = null;

export function setContentAiAuditSink(next: AuditSink | null): void {
  sink = next;
}

/** E6 — record provenance; never auto-publishes. */
export async function recordContentAiAudit(
  input: Omit<ContentAiAuditRecord, "id" | "createdAt">,
): Promise<ContentAiAuditRecord> {
  const record: ContentAiAuditRecord = {
    ...input,
    id: `cai_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  };
  memoryAudit.push(record);
  if (memoryAudit.length > 500) memoryAudit.shift();
  if (sink) await sink(record);
  console.info(
    JSON.stringify({
      type: "content_ai.audit",
      operation: record.operation,
      sourceHash: record.sourceHash,
      cacheHit: record.cacheHit,
      model: record.model,
      pageId: record.pageId ?? null,
    }),
  );
  return record;
}

export function listContentAiAuditMemory(limit = 50): ContentAiAuditRecord[] {
  return memoryAudit.slice(-limit);
}
