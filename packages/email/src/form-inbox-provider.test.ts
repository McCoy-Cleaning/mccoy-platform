import { afterEach, describe, expect, it } from "vitest";

import {
  formInboxConfigHelpMessage,
  getFormInboxProviderMode,
  shouldAllowImapInbox,
  shouldAttemptGraphMail,
  shouldFallbackFromGraph,
} from "./form-inbox-provider";

const KEYS = [
  "FORM_INBOX_PROVIDER",
  "TENANT_ID",
  "CLIENT_ID",
  "APPLICATION_ID",
  "CLIENT_SECRET",
  "GRAPH_MAILBOX",
  "SMTP_USER",
] as const;

const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

function clearEnv(): void {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreEnv(): void {
  for (const key of KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function setGraphConfigured(): void {
  process.env.TENANT_ID = "11111111-1111-1111-1111-111111111111";
  process.env.CLIENT_ID = "22222222-2222-2222-2222-222222222222";
  process.env.CLIENT_SECRET = "test-secret";
  process.env.GRAPH_MAILBOX = "mailbox@example.com";
}

afterEach(() => {
  restoreEnv();
});

describe("getFormInboxProviderMode", () => {
  it("defaults to auto when unset", () => {
    clearEnv();
    expect(getFormInboxProviderMode()).toBe("auto");
  });

  it("accepts imap, smtp alias, graph, and auto", () => {
    clearEnv();
    process.env.FORM_INBOX_PROVIDER = "imap";
    expect(getFormInboxProviderMode()).toBe("imap");

    process.env.FORM_INBOX_PROVIDER = "SMTP";
    expect(getFormInboxProviderMode()).toBe("imap");

    process.env.FORM_INBOX_PROVIDER = "graph";
    expect(getFormInboxProviderMode()).toBe("graph");

    process.env.FORM_INBOX_PROVIDER = "auto";
    expect(getFormInboxProviderMode()).toBe("auto");
  });

  it("falls back to auto for unknown values", () => {
    clearEnv();
    process.env.FORM_INBOX_PROVIDER = "pigeon";
    expect(getFormInboxProviderMode()).toBe("auto");
  });
});

describe("shouldAttemptGraphMail", () => {
  it("is false when Graph env is missing", () => {
    clearEnv();
    expect(shouldAttemptGraphMail()).toBe(false);
  });

  it("is true in auto when Graph is configured", () => {
    clearEnv();
    setGraphConfigured();
    expect(shouldAttemptGraphMail()).toBe(true);
  });

  it("is false when FORM_INBOX_PROVIDER=imap even if Graph env is set", () => {
    clearEnv();
    setGraphConfigured();
    process.env.FORM_INBOX_PROVIDER = "imap";
    expect(shouldAttemptGraphMail()).toBe(false);
    expect(shouldAllowImapInbox()).toBe(true);
    expect(shouldFallbackFromGraph()).toBe(false);
  });

  it("is true when FORM_INBOX_PROVIDER=graph and Graph is configured", () => {
    clearEnv();
    setGraphConfigured();
    process.env.FORM_INBOX_PROVIDER = "graph";
    expect(shouldAttemptGraphMail()).toBe(true);
    expect(shouldAllowImapInbox()).toBe(false);
    expect(shouldFallbackFromGraph()).toBe(false);
  });
});

describe("formInboxConfigHelpMessage", () => {
  it("mentions SMTP/IMAP when provider is imap and warns about M365", () => {
    clearEnv();
    process.env.FORM_INBOX_PROVIDER = "imap";
    expect(formInboxConfigHelpMessage()).toMatch(/SMTP_\*|FORM_INBOX_\*/);
    expect(formInboxConfigHelpMessage()).toMatch(/FORM_INBOX_PROVIDER=imap/);
    expect(formInboxConfigHelpMessage()).toMatch(/Microsoft 365|graph/i);
  });

  it("mentions Graph when provider is graph", () => {
    clearEnv();
    process.env.FORM_INBOX_PROVIDER = "graph";
    expect(formInboxConfigHelpMessage()).toMatch(/Microsoft Graph/);
    expect(formInboxConfigHelpMessage()).toMatch(/Mail\.Read|admin consent/i);
  });

  it("recommends Graph for M365 in auto mode", () => {
    clearEnv();
    process.env.FORM_INBOX_PROVIDER = "auto";
    expect(formInboxConfigHelpMessage()).toMatch(/M365|Microsoft Graph/);
  });
});
