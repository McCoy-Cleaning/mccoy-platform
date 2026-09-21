import type { CustomerPortalStatus } from "@mccoy/domain";

import { companyInitials, formatCompanyAddress, formatNlDate, panelTypeLabel } from "./directory-view";

export type ProfileNote = {
  id: string;
  dated: string;
  author: string;
  body: string;
  at: string | null;
  source: "company";
};

export function stackedAvatarLines(name: string): [string, string] {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0 && !/^(bv|b\.v\.|nv|vof|cv)$/i.test(part));
  if (parts.length >= 2) {
    return [parts[0]!.toUpperCase(), parts[1]!.toUpperCase()];
  }
  const initials = companyInitials(name || "?");
  if (initials.length >= 4) {
    return [initials.slice(0, 3), initials.slice(3)];
  }
  return [initials, ""];
}

export function companyStatusLabelNl(status: string): string {
  if (status === "active") return "Actief";
  if (status === "pending") return "In afwachting";
  if (status === "blocked") return "Geblokkeerd";
  return status;
}

export function portalBadgeLabelNl(status: CustomerPortalStatus): string {
  if (status === "active") return "Portaal geactiveerd";
  if (status === "suspended") return "Portaal opgeschort";
  if (status === "invited") return "Portaal uitgenodigd";
  if (status === "reminder_sent") return "Portaalherinnering verstuurd";
  if (status === "invite_expired") return "Portaallink verlopen";
  return "Portaal niet geactiveerd";
}

export function memberRoleLabelNl(role: string): string {
  return role === "account_admin" ? "Accountbeheerder" : "Gebruiker";
}

export function memberStatusLabelNl(input: {
  membershipStatus: string;
  userStatus: string;
}): string {
  if (input.userStatus === "blocked") return "Geblokkeerd";
  if (input.membershipStatus === "suspended") return "Opgeschort";
  if (input.membershipStatus === "active") return "Actief";
  return input.membershipStatus;
}

export function formatKlantSinds(iso: string): string {
  return `Klant sinds ${formatNlDate(iso)}`;
}

export function lastActivityValueNl(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    const time = new Intl.DateTimeFormat("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
    return `Vandaag, ${time}`;
  }
  return formatNlDate(iso);
}

export function formatLastActivityNl(iso: string, now = new Date()): string {
  const value = lastActivityValueNl(iso, now);
  return value === "—" ? "Laatste activiteit —" : `Laatste activiteit ${value}`;
}

export function memberAvatarInitials(fullName: string | null, email: string): string {
  const parts = (fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase() || "?";
}

const AVATAR_TONES = [
  "bg-sky-500/20 text-sky-100",
  "bg-rose-500/20 text-rose-100",
  "bg-violet-500/20 text-violet-100",
  "bg-amber-500/20 text-amber-100",
] as const;

export function memberAvatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

/** Display-only table chrome. Not an order ledger. */
export function displayOnlyOrderCount(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 25;
}

export function formatLastSyncNl(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(date)
      .replace(/\./g, "");
  } catch {
    return formatNlDate(iso);
  }
}

export function companyProfileDescription(input: {
  companyType: string;
  portalStatus: CustomerPortalStatus;
}): string {
  const type = panelTypeLabel({ companyType: input.companyType });
  return `${type} in het McCoy-klantenoverzicht. Bekijk en beheer gegevens, gebruikers en favoriete producten van dit bedrijf.`;
}

const NL_MONTHS: Record<string, number> = {
  jan: 0,
  januari: 0,
  feb: 1,
  februari: 1,
  mrt: 2,
  maart: 2,
  apr: 3,
  april: 3,
  mei: 4,
  jun: 5,
  juni: 5,
  jul: 6,
  juli: 6,
  aug: 7,
  augustus: 7,
  sep: 8,
  sept: 8,
  september: 8,
  okt: 9,
  oktober: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

export function formatNoteDated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const day = new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
    const time = new Intl.DateTimeFormat("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
    return `${day}, ${time}`;
  } catch {
    return formatLastSyncNl(iso);
  }
}

export function formatStaffNoteAuthor(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return "";
  const local = trimmed.includes("@") ? (trimmed.split("@")[0] ?? trimmed) : trimmed;
  const parts = local.split(/[.\s_-]+/).filter((part) => part.length > 0);
  if (parts.length >= 2) {
    const first = capitalizeNoteWord(parts[0]!);
    const initial = parts[1]![0]?.toUpperCase() ?? "";
    return initial ? `${first} ${initial}.` : first;
  }
  return capitalizeNoteWord(local);
}

function capitalizeNoteWord(value: string): string {
  const lower = value.toLowerCase();
  return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
}

function sanitizeNoteAuthor(author: string): string {
  return author.replace(/[|\]]/g, "").trim().slice(0, 80);
}

function splitNoteAuthor(header: string): { stamp: string; author: string } {
  const pipe = header.indexOf("|");
  if (pipe >= 0) {
    return { stamp: header.slice(0, pipe).trim(), author: header.slice(pipe + 1).trim() };
  }
  const parts = header.split(" · ");
  if (parts.length >= 2) {
    return { stamp: parts[0]!.trim(), author: parts.slice(1).join(" · ").trim() };
  }
  return { stamp: header.trim(), author: "" };
}

function parseNlNoteStamp(stamp: string): Date | null {
  const match = stamp
    .replace(/\./g, "")
    .trim()
    .match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}),?\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const month = NL_MONTHS[match[2]!.toLowerCase()];
  if (month === undefined) return null;
  const date = new Date(
    Number(match[3]),
    month,
    Number(match[1]),
    Number(match[4]),
    Number(match[5]),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNoteStamp(stamp: string): { at: string | null; dated: string } {
  const isoLike = stamp.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(isoLike)) {
    const date = new Date(isoLike);
    if (!Number.isNaN(date.getTime())) {
      const iso = date.toISOString();
      return { at: iso, dated: formatNoteDated(iso) };
    }
  }
  const nl = parseNlNoteStamp(isoLike);
  if (nl) {
    return { at: nl.toISOString(), dated: formatNoteDated(nl.toISOString()) };
  }
  return { at: null, dated: isoLike };
}

type StoredCompanyNote = {
  dated: string;
  author: string;
  body: string;
  at: string | null;
  headerStamp: string | null;
};

function splitCompanyNoteBlocks(raw: string): StoredCompanyNote[] {
  const chunks = raw
    .split(/(?=^\[)/m)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
  const blocks: StoredCompanyNote[] = [];
  for (const chunk of chunks) {
    const match = chunk.match(/^\[([^\]]+)\]\s*/);
    if (!match) {
      blocks.push({ dated: "", author: "", body: chunk, at: null, headerStamp: null });
      continue;
    }
    const { stamp, author } = splitNoteAuthor(match[1]!);
    const { at, dated } = parseNoteStamp(stamp);
    const body = chunk.slice(match[0].length).trim();
    if (!body) continue;
    blocks.push({ dated, author, body, at, headerStamp: stamp });
  }
  return blocks;
}

function listStoredCompanyNotes(existing: string | null): StoredCompanyNote[] {
  const trimmed = existing?.trim() ?? "";
  return trimmed ? splitCompanyNoteBlocks(trimmed) : [];
}

function serializeStoredCompanyNote(note: StoredCompanyNote): string {
  const stamp = note.at?.trim() || note.headerStamp?.trim() || "";
  if (!stamp && !note.author) return note.body;
  return serializeCompanyNote({ at: stamp, author: note.author, body: note.body });
}

export function companyNoteIndex(noteId: string): number {
  const match = /^company-note-(\d+)$/.exec(noteId);
  return match ? Number(match[1]) : -1;
}

export function replaceCompanyNote(existing: string | null, index: number, body: string): string {
  const next = body.trim();
  const notes = listStoredCompanyNotes(existing);
  if (!next || index < 0 || index >= notes.length) return existing?.trim() ?? "";
  notes[index] = { ...notes[index]!, body: next };
  return notes.map(serializeStoredCompanyNote).join("\n\n");
}

export function removeCompanyNote(existing: string | null, index: number): string {
  const notes = listStoredCompanyNotes(existing);
  if (index < 0 || index >= notes.length) return existing?.trim() ?? "";
  return notes
    .filter((_, itemIndex) => itemIndex !== index)
    .map(serializeStoredCompanyNote)
    .join("\n\n");
}

export function profileNotes(input: { notes: string | null; updatedAt: string }): ProfileNote[] {
  const trimmed = input.notes?.trim() ?? "";
  if (!trimmed) return [];
  return splitCompanyNoteBlocks(trimmed).map((block, index) => ({
    id: `company-note-${index}`,
    dated: block.dated || formatNoteDated(input.updatedAt) || formatNlDate(input.updatedAt),
    author: block.author,
    body: block.body,
    at: block.at,
    source: "company" as const,
  }));
}

function serializeCompanyNote(note: { at: string; author: string; body: string }): string {
  const header = note.author ? `[${note.at}|${note.author}]` : `[${note.at}]`;
  return `${header}\n${note.body}`;
}

export function prependCompanyNote(
  existing: string | null,
  addition: string,
  input: { at?: Date; author?: string } = {},
): string {
  const next = addition.trim();
  if (!next) return existing?.trim() ?? "";
  const at = input.at ?? new Date();
  const iso = at.toISOString();
  const author = sanitizeNoteAuthor(input.author ?? "");
  const previous = profileNotes({ notes: existing, updatedAt: iso }).map((note) => ({
    at: note.at ?? iso,
    author: note.author,
    body: note.body,
  }));
  return [
    serializeCompanyNote({ at: iso, author, body: next }),
    ...previous.map(serializeCompanyNote),
  ].join("\n\n");
}

export function companyHeadAddress(input: {
  addressStreet: string | null;
  addressHouseNumber: string | null;
  addressHouseSuffix: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
}): string {
  return formatCompanyAddress(input);
}
