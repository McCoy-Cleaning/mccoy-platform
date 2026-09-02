/**
 * Phase 2.3-A integration: CSV/XLSX → mirror → sync → companies,
 * idempotency, no Auth users, memberships untouched.
 */
import { beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { createSupabaseServiceClient } from "../../supabase";
import {
  commitExistingCustomerImport,
  previewExistingCustomerImport,
} from "../existing-customer-import";
import { resolveCustomerPortalStatus } from "../portal-status";
import { listPortalCompanies } from "../list-portal-companies";
import { applyQualificationEnv, isQualificationDbReachable } from "./env";
import { seedQualificationCompanies, type QualificationCompanies } from "./seed";

const qualAvailable = await isQualificationDbReachable();

const FIXTURE_CSV = [
  "Klantnummer,Bedrijfsnaam,Email,Telefoon,KVK",
  "P23-ABC,ABC Facility Qual,abc-p23@qual.mccoy.test,+31600001001,",
  "P23-DELTA,Delta Cleaning Services Client,delta-p23@qual.mccoy.test,+31600001002,",
  "P23-NORTH,Northstar Offices,north-p23@qual.mccoy.test,+31600001003,",
  ",Missing Id Co,missing@qual.mccoy.test,,",
  "P23-DUP,Dup One,dup1@qual.mccoy.test,,",
  "P23-DUP,Dup Two Different,dup2@qual.mccoy.test,,",
].join("\n");

describe.skipIf(!qualAvailable)("Phase 2.3 existing-customer file import (qual DB)", () => {
  let fixture: QualificationCompanies;
  let suffix: string;

  beforeAll(async () => {
    applyQualificationEnv();
    fixture = await seedQualificationCompanies(applyQualificationEnv());
    suffix = fixture.suffix;
  }, 180_000);

  it("preview classifies NEW / INVALID / CONFLICT without mutating", async () => {
    const csv = FIXTURE_CSV.replaceAll("P23-", `P23-${suffix}-`);
    const before = await createSupabaseServiceClient()
      .from("commerce_legacy_service_clients")
      .select("external_customer_id", { count: "exact", head: true });

    const preview = await previewExistingCustomerImport({
      fileName: "existing-clients.csv",
      bytes: Buffer.from(csv, "utf8"),
    });
    expect("ok" in preview && preview.ok === false).toBe(false);
    if ("ok" in preview) throw new Error("unexpected");
    expect(preview.counts.new).toBeGreaterThanOrEqual(3);
    expect(preview.counts.invalid).toBeGreaterThanOrEqual(1);
    expect(preview.counts.conflict).toBeGreaterThanOrEqual(1);

    const after = await createSupabaseServiceClient()
      .from("commerce_legacy_service_clients")
      .select("external_customer_id", { count: "exact", head: true });
    expect(after.count).toBe(before.count);
  });

  it("commit → mirror → sync → one company; idempotent second import; no Auth users", async () => {
    const idAbc = `P23-${suffix}-ABC`;
    const idDelta = `P23-${suffix}-DELTA`;
    const idNorth = `P23-${suffix}-NORTH`;
    const csv = [
      "Klantnummer,Bedrijfsnaam,Email",
      `${idAbc},ABC Facility Qual,abc-${suffix}@qual.mccoy.test`,
      `${idDelta},Delta Cleaning Services Client,delta-${suffix}@qual.mccoy.test`,
      `${idNorth},Northstar Offices,north-${suffix}@qual.mccoy.test`,
    ].join("\n");

    const first = await commitExistingCustomerImport({
      fileName: "existing-clients.csv",
      bytes: Buffer.from(csv, "utf8"),
      actorUserId: fixture.staffActorId,
    });
    expect("ok" in first && first.ok === false).toBe(false);
    if ("ok" in first && first.ok === false) throw new Error(first.error);
    expect(first.mirrored).toBe(3);
    expect(first.sync.created + first.sync.updated).toBeGreaterThanOrEqual(3);

    const supabase = createSupabaseServiceClient();
    for (const id of [idAbc, idDelta, idNorth]) {
      const { count: mirrorCount } = await supabase
        .from("commerce_legacy_service_clients")
        .select("external_customer_id", { count: "exact", head: true })
        .eq("external_customer_id", id);
      expect(mirrorCount).toBe(1);

      const { data: companies } = await supabase
        .from("companies")
        .select("id, company_type, external_customer_id")
        .eq("external_customer_id", id);
      expect(companies?.length).toBe(1);
      expect(companies![0]!.company_type).toBe("service_client");

      const companyId = String(companies![0]!.id);
      const portal = await resolveCustomerPortalStatus(companyId);
      expect(portal).toBe("registration_required");

      const { count: memberCount } = await supabase
        .from("company_users")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      expect(memberCount ?? 0).toBe(0);
    }

    const listed = await listPortalCompanies({ q: "ABC Facility Qual", pageSize: 25 });
    expect(listed.items.some((i) => i.legalName.includes("ABC Facility Qual"))).toBe(true);

    const second = await commitExistingCustomerImport({
      fileName: "existing-clients.csv",
      bytes: Buffer.from(csv, "utf8"),
      actorUserId: fixture.staffActorId,
    });
    expect("ok" in second && second.ok === false).toBe(false);
    if ("ok" in second && second.ok === false) throw new Error(second.error);
    expect(second.mirrored).toBe(0);
    expect(second.unchanged).toBe(3);

    for (const id of [idAbc, idDelta, idNorth]) {
      const { count } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("external_customer_id", id);
      expect(count).toBe(1);
    }

    // Auth: no user for imported emails
    const { data: users } = await supabase
      .from("users")
      .select("id, email")
      .ilike("email", `%${suffix}@qual.mccoy.test`);
    const importedEmails = new Set([
      `abc-${suffix}@qual.mccoy.test`,
      `delta-${suffix}@qual.mccoy.test`,
      `north-${suffix}@qual.mccoy.test`,
    ]);
    expect((users ?? []).filter((u) => importedEmails.has(String(u.email).toLowerCase())).length).toBe(
      0,
    );
  });

  it("UPDATE changes source-owned fields and preserves memberships", async () => {
    const id = `P23-${suffix}-ABC`;
    const supabase = createSupabaseServiceClient();
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("external_customer_id", id)
      .single();
    expect(company?.id).toBeTruthy();

    // Attach a membership that must survive re-import.
    await supabase.from("company_users").upsert(
      {
        company_id: company!.id,
        user_id: fixture.userA.userId,
        role: "account_user",
        status: "active",
      },
      { onConflict: "company_id,user_id" },
    );

    const csv = [
      "Klantnummer,Bedrijfsnaam,Email,Telefoon",
      `${id},ABC Facility Qual Updated,abc-${suffix}@qual.mccoy.test,+31699998888`,
    ].join("\n");

    const result = await commitExistingCustomerImport({
      fileName: "existing-clients-update.csv",
      bytes: Buffer.from(csv, "utf8"),
      actorUserId: fixture.staffActorId,
    });
    expect("ok" in result && result.ok === false).toBe(false);
    if ("ok" in result && result.ok === false) throw new Error(result.error);
    expect(result.mirrored).toBe(1);

    const { data: updated } = await supabase
      .from("companies")
      .select("legal_name, phone")
      .eq("external_customer_id", id)
      .single();
    expect(updated?.legal_name).toContain("Updated");
    expect(updated?.phone).toBe("+31699998888");

    const { count: memberCount } = await supabase
      .from("company_users")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company!.id)
      .eq("user_id", fixture.userA.userId);
    expect(memberCount).toBe(1);
  });

  it("XLSX import shares the same pipeline", async () => {
    const id = `P23-${suffix}-XLSX`;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Import");
    ws.addRow(["Debiteurnummer", "Bedrijfsnaam", "E-mail"]);
    ws.addRow([id, "Xlsx Pipeline Co", `xlsx-${suffix}@qual.mccoy.test`]);
    const bytes = Buffer.from(await wb.xlsx.writeBuffer());

    const result = await commitExistingCustomerImport({
      fileName: "existing-clients.xlsx",
      bytes,
      actorUserId: fixture.staffActorId,
    });
    expect("ok" in result && result.ok === false).toBe(false);
    if ("ok" in result && result.ok === false) throw new Error(result.error);
    expect(result.mirrored).toBe(1);

    const { count } = await createSupabaseServiceClient()
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("external_customer_id", id);
    expect(count).toBe(1);

    const again = await commitExistingCustomerImport({
      fileName: "existing-clients.xlsx",
      bytes,
      actorUserId: fixture.staffActorId,
    });
    expect("ok" in again && again.ok === false).toBe(false);
    if ("ok" in again && again.ok === false) throw new Error(again.error);
    expect(again.unchanged).toBe(1);
  });
});
