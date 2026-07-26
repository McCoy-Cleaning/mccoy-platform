import { afterEach, describe, expect, it } from "vitest";

import { getGraphMailConfig, isGraphMailConfigured } from "./graph-config";

const KEYS = [
  "MICROSOFT_GRAPH_TENANT_ID",
  "AZURE_TENANT_ID",
  "MS_TENANT_ID",
  "TENANT_ID",
  "MICROSOFT_GRAPH_CLIENT_ID",
  "AZURE_CLIENT_ID",
  "MS_CLIENT_ID",
  "CLIENT_ID",
  "APPLICATION_ID",
  "AZURE_APPLICATION_ID",
  "MS_APPLICATION_ID",
  "MICROSOFT_GRAPH_CLIENT_SECRET",
  "AZURE_CLIENT_SECRET",
  "MS_CLIENT_SECRET",
  "CLIENT_SECRET",
  "GRAPH_MAILBOX",
  "SMTP_USER",
  "FORM_INBOX_USER",
  "SMTP_FROM_EMAIL",
  "FORM_TO_EMAIL",
] as const;

const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

function clearGraphEnv(): void {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreGraphEnv(): void {
  for (const key of KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  restoreGraphEnv();
});

describe("getGraphMailConfig", () => {
  it("accepts APPLICATION_ID as client id alias", () => {
    clearGraphEnv();
    process.env.TENANT_ID = "11111111-1111-1111-1111-111111111111";
    process.env.APPLICATION_ID = "22222222-2222-2222-2222-222222222222";
    process.env.CLIENT_SECRET = "test-secret";
    process.env.SMTP_USER = "mailbox@example.com";

    expect(isGraphMailConfigured()).toBe(true);
    const config = getGraphMailConfig();
    expect(config?.clientId).toBe("22222222-2222-2222-2222-222222222222");
    expect(config?.mailbox).toBe("mailbox@example.com");
  });

  it("recovers tenant UUID from malformed prefix=uuid values", () => {
    clearGraphEnv();
    process.env.TENANT_ID = "1234567890=F3061848-6fb3-4c91-9572-09b878dc89b1";
    process.env.CLIENT_ID = "22222222-2222-2222-2222-222222222222";
    process.env.CLIENT_SECRET = "test-secret";
    process.env.GRAPH_MAILBOX = "sander@mccoy.nl";

    const config = getGraphMailConfig();
    expect(config?.tenantId).toBe("F3061848-6fb3-4c91-9572-09b878dc89b1");
  });

  it("returns null when client id is missing", () => {
    clearGraphEnv();
    process.env.TENANT_ID = "11111111-1111-1111-1111-111111111111";
    process.env.CLIENT_SECRET = "test-secret";
    process.env.SMTP_USER = "mailbox@example.com";

    expect(isGraphMailConfigured()).toBe(false);
    expect(getGraphMailConfig()).toBeNull();
  });
});
