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


  it("listFormInboxMessages only calls Graph mailbox on fresh Vernieuwen", () => {
    const src = sourceOf("form-inbox.ts");
    const start = src.indexOf("export async function listFormInboxMessages");
    const next = src.indexOf("export async function getFormInboxMessage", start + 1);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(next).toBeGreaterThan(start);
    const body = src.slice(start, next);
    expect(body).toMatch(/const mailboxPromise = fresh/);
    expect(body).toMatch(/listMailboxFormInboxMessages/);
    expect(body).toMatch(/mailboxPromise = fresh\s*\?[\s\S]*listMailboxFormInboxMessages[\s\S]*:\s*Promise\.resolve/);
  });

  it("keeps isReplyOrForwardSubject in a leaf module", () => {
    const subject = sourceOf("form-mail-subject.ts");
    expect(subject).toMatch(/export function isReplyOrForwardSubject/);
    expect(subject).not.toMatch(/from ["']\.\/graph-mail["']/);
    expect(subject).not.toMatch(/from ["']\.\/ingest/);
  });
});
