import { describe, expect, it } from "vitest";

import {
  formatGraphApiError,
  formatGraphMailWriteError,
  formatGraphTokenError,
} from "./graph-errors";

describe("formatGraphTokenError", () => {
  it("guides on invalid client secret", () => {
    const msg = formatGraphTokenError(
      "invalid_client",
      "AADSTS7000215: Invalid client secret provided.",
      401,
    );
    expect(msg).toMatch(/CLIENT_SECRET/);
    expect(msg).toMatch(/verlopen|ongeldige/i);
    expect(msg).not.toMatch(/Mail\.Read/);
  });

  it("guides on missing consent / permissions", () => {
    const msg = formatGraphTokenError(
      "unauthorized_client",
      "AADSTS65001: The user or administrator has not consented.",
      400,
    );
    expect(msg).toMatch(/admin consent/i);
    expect(msg).toMatch(/Mail\.Read/);
  });

  it("guides on bad tenant", () => {
    const msg = formatGraphTokenError(
      "invalid_request",
      "AADSTS90002: Tenant not found.",
      400,
    );
    expect(msg).toMatch(/TENANT_ID/);
  });
});

describe("formatGraphApiError", () => {
  it("lists consent and mailbox access on 403", () => {
    const msg = formatGraphApiError({
      status: 403,
      code: "ErrorAccessDenied",
      detail: "Access is denied. Check credentials and try again.",
      mailbox: "sander@mccoy.nl",
    });
    expect(msg).toMatch(/Mail\.Read/);
    expect(msg).toMatch(/Mail\.ReadWrite/);
    expect(msg).toMatch(/Application Access Policy/);
    expect(msg).toMatch(/sander@mccoy\.nl/);
  });

  it("calls out mailbox policy when message mentions it", () => {
    const msg = formatGraphApiError({
      status: 403,
      code: "ErrorAccessDenied",
      detail: "Access to OData is disabled. ApplicationAccessPolicy blocked this app.",
      mailbox: "sander@mccoy.nl",
    });
    expect(msg).toMatch(/Application Access Policy/);
    expect(msg).toMatch(/GRAPH_MAILBOX/);
  });

  it("guides on 404 mailbox", () => {
    const msg = formatGraphApiError({
      status: 404,
      code: "ErrorItemNotFound",
      detail: "The specified object was not found.",
      mailbox: "missing@mccoy.nl",
    });
    expect(msg).toMatch(/GRAPH_MAILBOX/);
    expect(msg).toMatch(/missing@mccoy\.nl/);
  });
});

describe("formatGraphMailWriteError", () => {
  it("calls out Mail.ReadWrite for delete/move 403", () => {
    const msg = formatGraphMailWriteError({
      status: 403,
      code: "ErrorAccessDenied",
      detail: "Access is denied.",
      mailbox: "info@mccoy.nl",
    });
    expect(msg).toMatch(/Mail\.ReadWrite/);
    expect(msg).toMatch(/Verwijderen uit Aanvragen/i);
  });
});
