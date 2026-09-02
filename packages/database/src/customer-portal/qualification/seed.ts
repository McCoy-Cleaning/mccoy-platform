import { createClient } from "@supabase/supabase-js";

import { normalizeEmail } from "@mccoy/domain";

import { createCompany, insertCustomerProfile } from "../../commerce/core";
import { findAuthUserIdByEmail } from "../../staff";
import { createSupabaseServiceClient } from "../../supabase";
import type { QualificationSupabaseConfig } from "./env";

export const QUAL_PASSWORD = "QualTest-Password-123!";

export type QualificationUser = {
  userId: string;
  email: string;
  password: string;
  accessToken: string;
};

export type QualificationCompanies = {
  suffix: string;
  companyAId: string;
  companyBId: string;
  adminA: QualificationUser;
  userA: QualificationUser;
  adminB: QualificationUser;
  userB: QualificationUser;
  staffActorId: string;
};

async function ensureAuthCustomer(
  email: string,
  fullName: string,
  password: string,
): Promise<string> {
  const supabase = createSupabaseServiceClient();
  const normalized = normalizeEmail(email);
  let id = await findAuthUserIdByEmail(normalized);
  if (!id) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: normalized,
      password,
      email_confirm: true,
      user_metadata: { account_kind: "customer", full_name: fullName },
    });
    if (error || !data.user?.id) {
      id = await findAuthUserIdByEmail(normalized);
      if (!id) throw new Error(error?.message || "qual auth create failed");
    } else {
      id = data.user.id;
    }
  } else {
    await supabase.auth.admin.updateUserById(id, { password, email_confirm: true });
  }

  const { data: profile } = await supabase.from("users").select("id").eq("id", id).maybeSingle();
  if (!profile) {
    await insertCustomerProfile({
      id,
      email: normalized,
      fullName,
      phone: null,
      status: "active",
      createdBy: null,
    });
  }
  return id;
}

async function signInCustomer(
  config: QualificationSupabaseConfig,
  email: string,
  password: string,
): Promise<string> {
  const client = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
  if (error || !data.session?.access_token) {
    throw new Error(`qual sign-in failed for ${email}: ${error?.message ?? "no session"}`);
  }
  return data.session.access_token;
}

export async function seedQualificationCompanies(
  config: QualificationSupabaseConfig,
): Promise<QualificationCompanies> {
  const suffix = `${Date.now()}`;
  const companyA = await createCompany({
    legalName: `Qual Company A ${suffix}`,
    companyType: "service_client",
    status: "active",
    externalCustomerId: `qual-a-${suffix}`,
  });
  const companyB = await createCompany({
    legalName: `Qual Company B ${suffix}`,
    companyType: "service_client",
    status: "active",
    externalCustomerId: `qual-b-${suffix}`,
  });

  const adminAEmail = `admin-a-${suffix}@qual.mccoy.test`;
  const userAEmail = `user-a-${suffix}@qual.mccoy.test`;
  const adminBEmail = `admin-b-${suffix}@qual.mccoy.test`;
  const userBEmail = `user-b-${suffix}@qual.mccoy.test`;
  const staffEmail = `staff-qual-${suffix}@qual.mccoy.test`;

  const adminAId = await ensureAuthCustomer(adminAEmail, "Admin A", QUAL_PASSWORD);
  const userAId = await ensureAuthCustomer(userAEmail, "User A", QUAL_PASSWORD);
  const adminBId = await ensureAuthCustomer(adminBEmail, "Admin B", QUAL_PASSWORD);
  const userBId = await ensureAuthCustomer(userBEmail, "User B", QUAL_PASSWORD);
  const staffId = await ensureAuthCustomer(staffEmail, "Staff Qual", QUAL_PASSWORD);

  const supabase = createSupabaseServiceClient();
  await supabase.from("users").update({ account_kind: "staff", staff_role: "admin" }).eq("id", staffId);

  const memberships = [
    { company_id: companyA.id, user_id: adminAId, role: "account_admin", status: "active" },
    { company_id: companyA.id, user_id: userAId, role: "account_user", status: "active" },
    { company_id: companyB.id, user_id: adminBId, role: "account_admin", status: "active" },
    { company_id: companyB.id, user_id: userBId, role: "account_user", status: "active" },
  ];
  const { error: memberError } = await supabase.from("company_users").upsert(memberships, {
    onConflict: "company_id,user_id",
  });
  if (memberError) throw new Error(`qual memberships: ${memberError.message}`);

  const adminA: QualificationUser = {
    userId: adminAId,
    email: adminAEmail,
    password: QUAL_PASSWORD,
    accessToken: await signInCustomer(config, adminAEmail, QUAL_PASSWORD),
  };
  const userA: QualificationUser = {
    userId: userAId,
    email: userAEmail,
    password: QUAL_PASSWORD,
    accessToken: await signInCustomer(config, userAEmail, QUAL_PASSWORD),
  };
  const adminB: QualificationUser = {
    userId: adminBId,
    email: adminBEmail,
    password: QUAL_PASSWORD,
    accessToken: await signInCustomer(config, adminBEmail, QUAL_PASSWORD),
  };
  const userB: QualificationUser = {
    userId: userBId,
    email: userBEmail,
    password: QUAL_PASSWORD,
    accessToken: await signInCustomer(config, userBEmail, QUAL_PASSWORD),
  };

  return {
    suffix,
    companyAId: companyA.id,
    companyBId: companyB.id,
    adminA,
    userA,
    adminB,
    userB,
    staffActorId: staffId,
  };
}
