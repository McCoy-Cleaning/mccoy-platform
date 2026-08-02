import { describe, expect, it } from "vitest";

import {
  buildStaffInviteEmail,
  buildStaffInviteSupabaseAuthTemplate,
  buildStaffPasswordResetEmail,
  buildStaffAccountRecoveryEmail,
  staffAuthEmailConfigErrorMessage,
} from "./staff-invite";
import { renderTransactionalEmailHtml } from "./transactional-layout";

describe("buildStaffInviteEmail", () => {
  it("renders a professional McCoy invite with escaped user content and CTA", () => {
    const built = buildStaffInviteEmail({
      to: "oana@example.com",
      inviteUrl: "https://admin.example.com/admin/invite?token=abc",
      invitedByName: 'Ra <script>alert(1)</script>',
      inviteeFullName: "Oana & Co",
      expiresAt: "2026-08-06T12:00:00.000Z",
    });

    expect(built.subject).toBe("Uitnodiging voor McCoy Admin");
    expect(built.html).toContain("McCoy Cleaning");
    expect(built.html).toContain("Admin-uitnodiging");
    expect(built.html).toContain("Uitnodiging accepteren");
    expect(built.html).toContain("https://admin.example.com/admin/invite?token=abc");
    expect(built.html).toContain("Beste Oana &amp; Co,");
    expect(built.html).toContain("Ra &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(built.html).not.toContain("<script>alert(1)</script>");
    expect(built.html).toContain("Stel een sterk wachtwoord in");
    expect(built.html).toContain("tweestapsverificatie");
    expect(built.html).toContain('alt="McCoy Cleaning"');
    expect(built.html).toMatch(/src="https?:\/\/[^"]+\/images\/cms\/logo-mccoy\.png"/);
    expect(built.text).toContain("Uitnodiging accepteren:");
    expect(built.text).toContain("https://admin.example.com/admin/invite?token=abc");
  });

  it("asks for name when invitee full name is missing", () => {
    const built = buildStaffInviteEmail({
      to: "new@example.com",
      inviteUrl: "https://admin.example.com/admin/invite",
      invitedByEmail: "admin@mccoy.nl",
    });

    expect(built.html).toContain("Beste uitgenodigde,");
    expect(built.html).toContain("Vul je naam in als die nog ontbreekt");
    expect(built.html).toContain("admin@mccoy.nl");
    expect(built.text).toContain("Beste uitgenodigde,");
  });

  it("uses generic uitgenodigde greeting for test placeholder names", () => {
    const built = buildStaffInviteEmail({
      to: "new@example.com",
      inviteUrl: "https://admin.example.com/admin/invite",
      inviteeFullName: "Test invitee",
    });

    expect(built.html).toContain("Beste uitgenodigde,");
    expect(built.html).not.toContain("Test invitee");
    expect(built.html).toContain("Vul je naam in als die nog ontbreekt");
  });
});

describe("buildStaffPasswordResetEmail", () => {
  it("renders Dutch password-reset copy with CTA", () => {
    const built = buildStaffPasswordResetEmail({
      to: "admin@example.com",
      resetUrl: "https://admin.example.com/admin/invite?token=abc",
      staffFullName: "Maria",
    });

    expect(built.subject).toBe("Wachtwoord resetten — McCoy Admin");
    expect(built.html).toContain("Nieuw wachtwoord instellen");
    expect(built.html).toContain("Beste Maria,");
    expect(built.text).toContain("https://admin.example.com/admin/invite?token=abc");
  });

  it("uses uitgenodigde greeting when name is missing", () => {
    const built = buildStaffPasswordResetEmail({
      to: "admin@example.com",
      resetUrl: "https://admin.example.com/admin/invite?token=abc",
    });

    expect(built.html).toContain("Beste uitgenodigde,");
  });
});

describe("buildStaffAccountRecoveryEmail", () => {
  it("renders distinct Dutch account-recovery copy", () => {
    const built = buildStaffAccountRecoveryEmail({
      to: "admin@example.com",
      recoveryUrl: "https://admin.example.com/admin/recover-mfa?token=abc",
      staffFullName: "Maria",
      recoveredByName: "Ra",
    });

    expect(built.subject).toBe("Account herstellen — McCoy Admin");
    expect(built.html).toContain("Account herstellen");
    expect(built.html).toContain("authenticator-app");
    expect(built.html).toContain("Ra");
    expect(built.html).not.toContain("Uitnodiging accepteren");
    expect(built.html).not.toContain("wachtwoord opnieuw");
    expect(built.text).toContain("https://admin.example.com/admin/recover-mfa?token=abc");
  });
});

describe("staffAuthEmailConfigErrorMessage", () => {
  it("mentions Graph and SMTP", () => {
    expect(staffAuthEmailConfigErrorMessage()).toMatch(/Graph/);
    expect(staffAuthEmailConfigErrorMessage()).toMatch(/SMTP/);
  });
});

describe("buildStaffInviteSupabaseAuthTemplate", () => {
  it("keeps ConfirmationURL placeholder for Auth Dashboard reuse", () => {
    const template = buildStaffInviteSupabaseAuthTemplate();
    expect(template.subject).toBe("Uitnodiging voor McCoy Admin");
    expect(template.html).toContain("{{ .ConfirmationURL }}");
    expect(template.html).toContain("Admin-uitnodiging");
    expect(template.html).toContain("Uitnodiging accepteren");
    expect(template.html).toContain("https://www.mccoy.nl/images/cms/logo-mccoy.png");
  });
});

describe("renderTransactionalEmailHtml", () => {
  it("escapes CTA urls and titles for Graph/SMTP reuse", () => {
    const html = renderTransactionalEmailHtml({
      title: 'Invite "test"',
      bodyHtml: "<p>Hallo</p>",
      logoUrl: "https://www.mccoy.nl/images/cms/logo-mccoy.png",
      cta: { label: "Open", url: 'https://example.com/"onclick' },
      footerText: "McCoy",
    });
    expect(html).toContain("Invite &quot;test&quot;");
    expect(html).toContain('href="https://example.com/&quot;onclick"');
    expect(html).toContain('src="https://www.mccoy.nl/images/cms/logo-mccoy.png"');
    expect(html).toContain("Hallo");
  });
});
