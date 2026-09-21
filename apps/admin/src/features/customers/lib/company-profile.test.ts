import { describe, expect, it } from "vitest";

import {
  companyProfileDescription,
  companyStatusLabelNl,
  displayOnlyOrderCount,
  formatKlantSinds,
  formatLastActivityNl,
  lastActivityValueNl,
  memberAvatarInitials,
  memberRoleLabelNl,
  portalBadgeLabelNl,
  formatStaffNoteAuthor,
  prependCompanyNote,
  profileNotes,
  removeCompanyNote,
  replaceCompanyNote,
  stackedAvatarLines,
} from "./company-profile";

describe("company profile helpers", () => {
  it("stacks ABC Facility as avatar lines", () => {
    expect(stackedAvatarLines("ABC Facility")).toEqual(["ABC", "FACILITY"]);
    expect(stackedAvatarLines("ABC Facility BV")).toEqual(["ABC", "FACILITY"]);
  });

  it("maps identity badges and roles", () => {
    expect(companyStatusLabelNl("active")).toBe("Actief");
    expect(portalBadgeLabelNl("active")).toBe("Portaal geactiveerd");
    expect(memberRoleLabelNl("account_admin")).toBe("Accountbeheerder");
    expect(companyProfileDescription({ companyType: "service_client", portalStatus: "active" })).toContain(
      "Serviceklant",
    );
  });

  it("formats customer-since and same-day activity", () => {
    expect(formatKlantSinds("2022-01-12T10:00:00.000Z")).toMatch(/Klant sinds 12\s+jan\.?\s+2022/i);
    const now = new Date("2026-09-18T14:32:00.000Z");
    expect(formatLastActivityNl("2026-09-18T14:32:00.000Z", now)).toMatch(/Vandaag/);
    expect(lastActivityValueNl("2026-09-18T14:32:00.000Z", now)).toMatch(/^Vandaag,/);
  });

  it("builds member avatar initials and a stable display-only order count", () => {
    expect(memberAvatarInitials("Jan de Vries", "jan@abc.test")).toBe("JD");
    expect(memberAvatarInitials(null, "sanne@abc.test")).toBe("SA");
    expect(displayOnlyOrderCount("user-a")).toBe(displayOnlyOrderCount("user-a"));
    expect(displayOnlyOrderCount("user-a")).toBeGreaterThanOrEqual(0);
  });

  it("uses company notes when present and an empty list otherwise", () => {
    expect(profileNotes({ notes: "  Interne afspraak  ", updatedAt: "2026-01-12T00:00:00.000Z" })[0]).toMatchObject({
      source: "company",
      body: "Interne afspraak",
      author: "",
    });
    expect(profileNotes({ notes: null, updatedAt: "2026-01-12T00:00:00.000Z" })).toEqual([]);
  });

  it("splits timestamp-prefixed notes and hides the raw stamp from the body", () => {
    const notes = profileNotes({
      notes: "[18 sep 2026, 15:43]\ndsfsdfs\n\n[18 sep 2026, 15:43]\ndfsdfdsfsf",
      updatedAt: "2026-09-18T13:43:00.000Z",
    });
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatchObject({ body: "dsfsdfs", author: "" });
    expect(notes[1]).toMatchObject({ body: "dfsdfdsfsf", author: "" });
    expect(notes[0]?.dated.toLowerCase()).toMatch(/18\s+september\s+2026/);
    expect(notes[0]?.dated).toMatch(/15:43/);
    expect(notes.every((note) => !note.body.includes("["))).toBe(true);
  });

  it("formats staff usernames as a short note author", () => {
    expect(formatStaffNoteAuthor("marlieke.a@mccoy.nl")).toBe("Marlieke A.");
    expect(formatStaffNoteAuthor("Marlieke A.")).toBe("Marlieke A.");
    expect(formatStaffNoteAuthor("admin")).toBe("Admin");
  });

  it("prepends a structured note without baking the stamp into the body", () => {
    const next = prependCompanyNote("Oude notitie", "Nieuwe afspraak", {
      at: new Date("2026-09-18T12:00:00.000Z"),
      author: "Marlieke A.",
    });
    expect(next).toContain("Nieuwe afspraak");
    expect(next).toContain("Oude notitie");
    expect(next.startsWith("[2026-09-18T12:00:00.000Z|Marlieke A.]")).toBe(true);

    const parsed = profileNotes({ notes: next, updatedAt: "2026-09-18T12:00:00.000Z" });
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ body: "Nieuwe afspraak", author: "Marlieke A." });
    expect(parsed[1]).toMatchObject({ body: "Oude notitie", author: "" });
    expect(parsed.every((note) => !note.body.includes("["))).toBe(true);
  });

  it("edits one of two notes and leaves the other intact", () => {
    const existing = prependCompanyNote(
      prependCompanyNote(null, "Eerste notitie", {
        at: new Date("2026-09-18T10:00:00.000Z"),
        author: "Ada B.",
      }),
      "Tweede notitie",
      {
        at: new Date("2026-09-18T11:00:00.000Z"),
        author: "Ben C.",
      },
    );
    const next = replaceCompanyNote(existing, 0, "Tweede aangepast");
    const parsed = profileNotes({ notes: next, updatedAt: "2026-09-18T12:00:00.000Z" });
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      body: "Tweede aangepast",
      author: "Ben C.",
      at: "2026-09-18T11:00:00.000Z",
    });
    expect(parsed[1]).toMatchObject({
      body: "Eerste notitie",
      author: "Ada B.",
      at: "2026-09-18T10:00:00.000Z",
    });
    expect(replaceCompanyNote(existing, 0, "   ")).toBe(existing);
    expect(replaceCompanyNote(existing, 9, "Onbekend")).toBe(existing);

    const stamped = "[18 sep 2026, 15:43]\ndsfsdfs\n\n[18 sep 2026, 15:43]\ndfsdfdsfsf";
    const stampedNext = replaceCompanyNote(stamped, 1, "alleen de tweede");
    const stampedParsed = profileNotes({ notes: stampedNext, updatedAt: "2026-09-18T13:43:00.000Z" });
    expect(stampedParsed).toHaveLength(2);
    expect(stampedParsed[0]?.body).toBe("dsfsdfs");
    expect(stampedParsed[1]?.body).toBe("alleen de tweede");
  });

  it("deletes only the targeted note", () => {
    const existing = prependCompanyNote(
      prependCompanyNote(null, "Blijft staan", {
        at: new Date("2026-09-18T10:00:00.000Z"),
        author: "Ada B.",
      }),
      "Wordt verwijderd",
      {
        at: new Date("2026-09-18T11:00:00.000Z"),
        author: "Ben C.",
      },
    );
    const next = removeCompanyNote(existing, 0);
    const parsed = profileNotes({ notes: next, updatedAt: "2026-09-18T12:00:00.000Z" });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      body: "Blijft staan",
      author: "Ada B.",
      at: "2026-09-18T10:00:00.000Z",
    });
    expect(removeCompanyNote(existing, 4)).toBe(existing);
    expect(removeCompanyNote(next, 0)).toBe("");
  });
});
