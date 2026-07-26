import { describe, expect, it } from "vitest";

import {
  isMicrosoft365ImapHost,
  microsoft365ImapBasicAuthBlockedMessage,
} from "./m365-imap";

describe("isMicrosoft365ImapHost", () => {
  it("detects Outlook / Office 365 IMAP hosts", () => {
    expect(isMicrosoft365ImapHost("outlook.office365.com")).toBe(true);
    expect(isMicrosoft365ImapHost("Outlook.Office365.com")).toBe(true);
    expect(isMicrosoft365ImapHost("outlook.office.com")).toBe(true);
    expect(isMicrosoft365ImapHost("imap-mail.outlook.com")).toBe(true);
  });

  it("rejects Gmail and empty hosts", () => {
    expect(isMicrosoft365ImapHost("imap.gmail.com")).toBe(false);
    expect(isMicrosoft365ImapHost("")).toBe(false);
    expect(isMicrosoft365ImapHost("mail.example.com")).toBe(false);
  });
});

describe("microsoft365ImapBasicAuthBlockedMessage", () => {
  it("points operators to Graph and mentions SMTP may still send", () => {
    const msg = microsoft365ImapBasicAuthBlockedMessage("sander@mccoy.nl");
    expect(msg).toMatch(/Microsoft 365/);
    expect(msg).toMatch(/basic auth/i);
    expect(msg).toMatch(/Microsoft Graph/);
    expect(msg).toMatch(/FORM_INBOX_PROVIDER=graph/);
    expect(msg).toMatch(/SMTP kan wel werken/);
    expect(msg).toMatch(/sander@mccoy\.nl/);
  });
});
