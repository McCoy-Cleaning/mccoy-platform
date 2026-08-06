import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)));

function sourceOf(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

describe("Aanvragen Graph module dependency boundaries", () => {
  it("does not create graph-mail ↔ ingest/sync circular imports", () => {
    const graphMail = sourceOf("graph-mail.ts");
    const ingest = sourceOf("ingest-graph-replies.ts");
    const sync = sourceOf("graph-inbox-sync.ts");
    const requestSync = sourceOf("sync-request-graph-thread.ts");

    expect(graphMail).not.toMatch(/ingest-graph-replies/);
    expect(graphMail).not.toMatch(/graph-inbox-sync['"]/);
    expect(graphMail).not.toMatch(/sync-request-graph-thread/);
    expect(ingest).not.toMatch(/from ["']\.\/graph-mail["']/);
    expect(sync).not.toMatch(/from ["']\.\/graph-mail["']/);
    // Request detail sync may call Graph helpers; Graph must not import it back.
    expect(requestSync).toMatch(/from ["']\.\/graph-mail["']/);
  });

  it("keeps isReplyOrForwardSubject in a leaf module", () => {
    const subject = sourceOf("form-mail-subject.ts");
    expect(subject).toMatch(/export function isReplyOrForwardSubject/);
    expect(subject).not.toMatch(/from ["']\.\/graph-mail["']/);
    expect(subject).not.toMatch(/from ["']\.\/ingest/);
  });
});
