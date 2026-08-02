import {
  displayFormFields,
  FIELD_LABELS_NL,
  FORM_SUBJECTS,
  encodeFormScopeSubjectMarker,
  sanitizeScopeForSubject,
  type FormKind,
  type FormScopeSnapshot,
} from "@mccoy/domain";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function rowsHtml(fields: Record<string, string>): string {
  return Object.entries(displayFormFields(fields))
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value]) => {
      const label = FIELD_LABELS_NL[key] ?? key;
      const display = escapeHtml(value).replaceAll("\n", "<br />");
      return `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e8e8ee;color:#6b7280;font-size:13px;width:160px;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e8e8ee;color:#111827;font-size:14px;vertical-align:top;">${display}</td>
        </tr>`;
    })
    .join("");
}

function formSubjectLine(
  kind: FormKind,
  fields: Record<string, string>,
  scope: FormScopeSnapshot | null | undefined,
): string {
  const base = FORM_SUBJECTS[kind];
  const name = fields.name?.trim();
  const core = name ? `${base} — ${sanitizeScopeForSubject(name).slice(0, 80)}` : base;
  if (!scope?.key) return core;
  return `${encodeFormScopeSubjectMarker(scope.key)} ${core}`;
}

function shell(
  kind: FormKind,
  title: string,
  intro: string,
  fields: Record<string, string>,
  attachmentNote: string,
  scope: FormScopeSnapshot | null | undefined,
): string {
  const name = fields.name?.trim();
  const headline = name || title;
  const subline = name ? title : FORM_SUBJECTS[kind];
  const scopeRow =
    scope?.label?.trim() ?
      `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e8e8ee;color:#6b7280;font-size:13px;width:160px;vertical-align:top;">Scope</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e8e8ee;color:#111827;font-size:14px;vertical-align:top;">${escapeHtml(sanitizeScopeForSubject(scope.label))}</td>
        </tr>`
    : "";
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#0b1220;padding:24px 28px;">
                <div style="color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">McCoy Cleaning</div>
                <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:8px;">${escapeHtml(headline)}</div>
                <div style="color:#cbd5e1;font-size:13px;margin-top:6px;">${escapeHtml(subline)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 8px;color:#374151;font-size:14px;line-height:1.55;">
                ${escapeHtml(intro)}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 14px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8ee;border-radius:12px;overflow:hidden;">
                  ${scopeRow}
                  ${rowsHtml(fields)}
                </table>
                ${attachmentNote}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;color:#9ca3af;font-size:12px;">
                Verstuurd via het McCoy websiteformulier · Antwoord rechtstreeks aan de afzender wanneer een e-mailadres aanwezig is.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildFormEmail(
  kind: FormKind,
  fields: Record<string, string>,
  attachmentNames: string[],
  scope?: FormScopeSnapshot | null,
) {
  const attachmentNote =
    attachmentNames.length > 0
      ? `<p style="margin:16px 14px 0;color:#6b7280;font-size:13px;">Bijlagen: ${escapeHtml(attachmentNames.join(", "))}</p>`
      : "";
  const subject = formSubjectLine(kind, fields, scope);

  switch (kind) {
    case "inquiry":
      return {
        subject,
        html: shell(
          kind,
          "Nieuwe algemene aanvraag",
          "Een bezoeker heeft het algemene contactformulier ingevuld.",
          fields,
          attachmentNote,
          scope,
        ),
      };
    case "glass_washing":
      return {
        subject,
        html: shell(
          kind,
          "Offerteaanvraag glasbewassing",
          "Een bezoeker heeft een offerte aangevraagd voor glasbewassing.",
          fields,
          attachmentNote,
          scope,
        ),
      };
    case "furniture_cleaning":
      return {
        subject,
        html: shell(
          kind,
          "Offerteaanvraag meubelreiniging",
          "Een bezoeker heeft een offerte aangevraagd voor meubel- of vloerreiniging.",
          fields,
          attachmentNote,
          scope,
        ),
      };
    case "job_application":
      return {
        subject,
        html: shell(
          kind,
          "Nieuwe sollicitatie",
          "Een kandidaat heeft via de vacaturepagina gesolliciteerd.",
          fields,
          attachmentNote,
          scope,
        ),
      };
    case "newsletter":
      return {
        subject,
        html: shell(
          kind,
          "Nieuwsbrief-aanmelding",
          "Een bezoeker wil updates ontvangen via de nieuwsbriefsectie.",
          fields,
          attachmentNote,
          scope,
        ),
      };
  }
}

export { escapeHtml };
