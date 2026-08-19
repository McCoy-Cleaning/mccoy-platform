/**
 * Gesprek timeline body cleanup + dedupe.
 *
 * - Admin: Graph often stores the full HTML mail template → extract the typed reply.
 * - Customer: replies quote that template → strip the quote; never run the admin
 *   extractor (it would surface the quoted staff text as the "Klant" body).
 */
import { normaliseInternetMessageId } from "./inquiry-thread-correlation";

const MCCOY_TEMPLATE_FOOTER =
  /dit bericht is verstuurd vanuit het mccoy admin panel/i;
const MCCOY_TEMPLATE_BRAND = /mccoy cleaning/i;
const MCCOY_TEMPLATE_REF = /referentie:\s*wr-[a-z0-9-]+/i;

export function looksLikeMcCoyAdminEmailTemplate(text: string): boolean {
  const body = text.trim();
  if (!body) return false;
  const hasFooter = MCCOY_TEMPLATE_FOOTER.test(body);
  const hasBrand = MCCOY_TEMPLATE_BRAND.test(body);
  const hasRef = MCCOY_TEMPLATE_REF.test(body);
  return hasFooter || (hasBrand && hasRef);
}

/** Normalise line endings, BOM, and common HTML entities before quote detection. */
export function prepareReplyBodyText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\uFEFF/g, "")
    .replace(/&#65279;/gi, "")
    .replace(/&#xfeff;/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, digits: string) => {
      const code = Number(digits);
      if (!Number.isFinite(code) || code <= 0) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code) || code <= 0) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Prefer the staff-typed plain body when Graph returned the wrapped HTML mail.
 * Only use for outbound / admin messages — not for customer replies that quote it.
 */
export function extractSimpleReplyBody(text: string): string {
  const trimmed = prepareReplyBodyText(text);
  if (!trimmed || !looksLikeMcCoyAdminEmailTemplate(trimmed)) return trimmed;

  const lines = trimmed.split("\n").map((line) => line.trim());
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (MCCOY_TEMPLATE_REF.test(lines[i] ?? "")) {
      start = i + 1;
      break;
    }
  }
  while (start < lines.length && !(lines[start] ?? "")) start += 1;

  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (MCCOY_TEMPLATE_FOOTER.test(lines[i] ?? "")) {
      end = i;
      break;
    }
  }

  const extracted = lines.slice(start, end).join("\n").trim();
  return extracted || trimmed;
}

function isQuoteAttributionLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // Apple Mail / Gmail / Outlook-style attributions
  if (/^On .{5,240} wrote:\s*$/i.test(t)) return true;
  if (/^Op .{5,240} schreef .{0,120}:\s*$/i.test(t)) return true;
  if (/^Am .{5,240} schrieb .{0,120}:\s*$/i.test(t)) return true;
  if (/^Le .{5,240} a écrit\s*:\s*$/i.test(t)) return true;
  if (/^(-{2,}\s*)?(Original Message|Oorspronkelijk bericht)\s*-{0,}$/i.test(t)) {
    return true;
  }
  if (/^(From|Van|De|Von)\s*:\s+.+/i.test(t)) return true;
  return false;
}

function isQuotedHistoryStartLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (isQuoteAttributionLine(t)) return true;
  if (/^>{1,}\s?/.test(t)) return true;
  if (/^_{5,}$/.test(t)) return true;
  if (/^-{5,}$/.test(t)) return true;
  // Quoted McCoy admin template (often after attribution, sometimes without it).
  // Anchored to line start so a flattened body that still contains "Referentie:"
  // later does not wipe the customer's new text.
  if (/^McCoy Cleaning\b/i.test(t)) return true;
  if (/^Referentie:\s*WR-[A-Z0-9-]+/i.test(t)) return true;
  if (/^Dit bericht is verstuurd vanuit het McCoy admin panel/i.test(t)) return true;
  if (/^Re:\s*Algemene aanvraag/i.test(t)) return true;
  if (/^Re:\s*.+\(WR-[A-Z0-9-]+\)\s*$/i.test(t)) return true;
  return false;
}

/**
 * Keep only the new text above quoted history / quoted McCoy admin mail.
 * Handles iPhone/Apple Mail "On … wrote:", BOM prefixes, and lone \\r newlines.
 */
export function stripQuotedReplyBody(text: string): string {
  const trimmed = prepareReplyBodyText(text);
  if (!trimmed) return trimmed;

  const lines = trimmed.split("\n");
  let cutLine = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (isQuotedHistoryStartLine(lines[i] ?? "")) {
      // Keep leading blank lines only when there is real content above.
      cutLine = i;
      break;
    }
  }

  // Attribution glued on the same line as the new reply (HTML flatten artefact).
  if (cutLine === lines.length) {
    const inlinePatterns: RegExp[] = [
      /\s+On .{5,240} wrote:\s*/i,
      /\s+Op .{5,240} schreef .{0,120}:\s*/i,
      /\s+McCoy Cleaning\b/i,
      /\s+Referentie:\s*WR-[A-Z0-9-]+/i,
      /\s+Dit bericht is verstuurd vanuit het McCoy admin panel/i,
    ];
    let cutAt = trimmed.length;
    for (const pattern of inlinePatterns) {
      const match = pattern.exec(trimmed);
      if (match?.index != null && match.index > 0 && match.index < cutAt) {
        cutAt = match.index;
      }
    }
    if (cutAt < trimmed.length) {
      const head = trimmed.slice(0, cutAt).trim();
      if (head) return head;
    }
  }

  const head = lines
    .slice(0, cutLine)
    .join("\n")
    .trim();
  if (head) return head;

  // Whole body was a quote of the McCoy template — do not surface the quoted staff text.
  if (looksLikeMcCoyAdminEmailTemplate(trimmed)) {
    return "(geen nieuwe tekst in dit antwoord)";
  }
  return trimmed;
}

/** Direction-aware display/persist body normalisation. */
export function normaliseThreadMessageBody(
  text: string,
  direction: "inbound" | "outbound" | "admin" | "customer" | "form",
): string {
  if (direction === "form") return prepareReplyBodyText(text);
  if (direction === "outbound" || direction === "admin") {
    return extractSimpleReplyBody(text);
  }
  return stripQuotedReplyBody(text);
}

export function isTemplatedWrapOf(simple: string, wrapped: string): boolean {
  const s = simple.replace(/\s+/g, " ").trim().toLowerCase();
  const w = wrapped.replace(/\s+/g, " ").trim().toLowerCase();
  if (!s || !w) return false;
  if (s === w) return true;
  if (!w.includes(s)) return false;
  return looksLikeMcCoyAdminEmailTemplate(wrapped) || w.length >= s.length + 40;
}

function sameMessageId(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normaliseInternetMessageId(a);
  const nb = normaliseInternetMessageId(b);
  return Boolean(na && nb && na === nb);
}

function withinSeconds(aIso: string, bIso: string, maxSeconds: number): boolean {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= maxSeconds * 1000;
}

export type ThreadDedupeItem = {
  id: string;
  direction: "form" | "customer" | "admin";
  textBody: string;
  date: string;
  messageId?: string | null;
  to?: string;
  from?: string;
  attachments?: unknown[];
};

/**
 * Drop duplicate same-direction bubbles. Never collapses admin↔customer.
 * Prefer the copy with more attachments when that field is present.
 * Admin: prefer plain typed body over HTML template text.
 */
export function dedupeInquiryThreadItems<T extends ThreadDedupeItem>(items: T[]): T[] {
  const kept: T[] = [];

  for (const item of items) {
    if (item.direction === "form") {
      kept.push(item);
      continue;
    }

    const plain = normaliseThreadMessageBody(item.textBody, item.direction);
    const candidate = plain !== item.textBody ? { ...item, textBody: plain } : item;

    const duplicateIndex = kept.findIndex((existing) => {
      if (existing.direction !== candidate.direction) return false;
      if (sameMessageId(existing.messageId, candidate.messageId)) return true;
      if (!withinSeconds(existing.date, candidate.date, 180)) return false;
      if (candidate.direction === "admin") {
        return (
          isTemplatedWrapOf(existing.textBody, candidate.textBody) ||
          isTemplatedWrapOf(candidate.textBody, existing.textBody) ||
          existing.textBody.trim().toLowerCase() ===
            candidate.textBody.trim().toLowerCase()
        );
      }
      return (
        existing.textBody.trim().toLowerCase() ===
        candidate.textBody.trim().toLowerCase()
      );
    });

    if (duplicateIndex < 0) {
      kept.push(candidate);
      continue;
    }

    const existing = kept[duplicateIndex]!;
    const existingAtt = existing.attachments?.length ?? 0;
    const candidateAtt = candidate.attachments?.length ?? 0;
    const eitherHasAttachments =
      existing.attachments != null || candidate.attachments != null;
    if (eitherHasAttachments && candidateAtt !== existingAtt) {
      if (candidateAtt > existingAtt) {
        kept[duplicateIndex] = candidate;
      }
      continue;
    }

    const preferCandidate =
      candidate.direction === "admin" &&
      (candidate.textBody.trim().length < existing.textBody.trim().length ||
        (looksLikeMcCoyAdminEmailTemplate(existing.textBody) &&
          !looksLikeMcCoyAdminEmailTemplate(candidate.textBody)));
    if (preferCandidate) {
      kept[duplicateIndex] = candidate;
    }
  }

  return kept;
}

/** True when an outbound Graph/mail row is already represented by a staff reply. */
export function outboundMailDuplicatesStaffReply(
  mail: {
    internet_message_id: string | null;
    body_text: string | null;
    occurred_at: string;
    recipient_addresses?: string[] | null;
  },
  replies: Array<{
    resendId?: string;
    body: string;
    sentAt: string;
    toEmail: string;
  }>,
): boolean {
  const mailBody = mail.body_text || "";
  for (const reply of replies) {
    if (sameMessageId(reply.resendId, mail.internet_message_id)) return true;
    if (!withinSeconds(reply.sentAt, mail.occurred_at, 180)) continue;
    const to = (mail.recipient_addresses ?? []).map((a) => a.toLowerCase());
    if (to.length > 0 && !to.includes(reply.toEmail.trim().toLowerCase())) continue;
    if (
      isTemplatedWrapOf(reply.body, mailBody) ||
      reply.body.trim().toLowerCase() === mailBody.trim().toLowerCase()
    ) {
      return true;
    }
  }
  return false;
}
