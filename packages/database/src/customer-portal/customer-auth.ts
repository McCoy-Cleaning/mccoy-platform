import { createClient } from "@supabase/supabase-js";

import type { Company, CompanyMemberRole, CompanyMemberStatus } from "@mccoy/domain";
import {
  CustomerAuthError,
  readCustomerAccessToken,
  readCustomerRefreshToken,
  issueCustomerAuthCookies,
  clearCustomerAuthCookies,
  CUSTOMER_LOGIN_RATE,
} from "@mccoy/security";
import { assertRateLimit, RateLimitError } from "@mccoy/security";

import { mapCompany, getCustomerById } from "../commerce/core";
import { createSupabaseServiceClient, getSupabasePublicConfig, hasSupabasePublicConfig } from "../supabase";
import { CustomerPortalError } from "./errors";

export type CustomerMembership = {
  companyId: string;
  company: Company;
  role: CompanyMemberRole;
  membershipStatus: CompanyMemberStatus;
};

export type CustomerSessionView = {
  userId: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  membership: CustomerMembership;
};

async function refreshCustomerAccessTokenIfNeeded(): Promise<string | null> {
  const access = readCustomerAccessToken();
  if (access) return access;
  const refresh = readCustomerRefreshToken();
  if (!refresh || !hasSupabasePublicConfig()) return null;

  const { url, publishableKey } = getSupabasePublicConfig();
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.refreshSession({ refresh_token: refresh });
  if (error || !data.session) {
    clearCustomerAuthCookies();
    return null;
  }
  issueCustomerAuthCookies({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
  return data.session.access_token;
}

export async function resolveCustomerMembership(userId: string): Promise<CustomerMembership | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("company_users")
    .select("company_id, role, status, companies(*)")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(2);

  if (error) throw new Error(`resolveCustomerMembership: ${error.message}`);
  const rows = data ?? [];
  if (rows.length !== 1) return null;

  const row = rows[0] as {
    company_id: string;
    role: CompanyMemberRole;
    status: CompanyMemberStatus;
    companies: Record<string, unknown> | Record<string, unknown>[] | null;
  };

  const companyRow = Array.isArray(row.companies) ? row.companies[0] : row.companies;
  if (!companyRow || (companyRow as { status?: string }).status !== "active") return null;

  return {
    companyId: row.company_id,
    company: mapCompany(companyRow as Parameters<typeof mapCompany>[0]),
    role: row.role,
    membershipStatus: row.status,
  };
}

async function resolveCustomerPrincipal(accessToken: string): Promise<CustomerSessionView> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service.auth.getUser(accessToken);
  if (error || !data.user?.id) {
    throw new CustomerAuthError("Niet geautoriseerd. Log opnieuw in.", "customer_auth");
  }

  const profile = await getCustomerById(data.user.id);
  if (!profile) {
    throw new CustomerAuthError("Geen klantaccount.", "customer_auth");
  }
  const userRow = await service.from("users").select("account_kind").eq("id", profile.id).maybeSingle();
  if (userRow.data?.account_kind !== "customer") {
    throw new CustomerAuthError("Geen klantaccount.", "customer_auth");
  }
  if (profile.status === "blocked") {
    throw new CustomerPortalError("Account geblokkeerd.", "CUSTOMER_MEMBERSHIP_SUSPENDED");
  }

  const membership = await resolveCustomerMembership(profile.id);
  if (!membership) {
    throw new CustomerAuthError("Geen actieve bedrijfskoppeling.", "customer_auth");
  }
  if (membership.company.status !== "active") {
    throw new CustomerPortalError("Bedrijf niet beschikbaar.", "CUSTOMER_COMPANY_SUSPENDED");
  }

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    phone: profile.phone,
    membership,
  };
}

export async function requireCustomerSession(): Promise<CustomerSessionView> {
  const access = await refreshCustomerAccessTokenIfNeeded();
  if (!access) {
    throw new CustomerAuthError("Niet geautoriseerd. Log opnieuw in.", "customer_auth");
  }
  return resolveCustomerPrincipal(access);
}

export async function readCustomerSession(): Promise<CustomerSessionView | null> {
  try {
    const access = await refreshCustomerAccessTokenIfNeeded();
    if (!access) return null;
    return await resolveCustomerPrincipal(access);
  } catch {
    return null;
  }
}

export async function requireAccountAdmin(): Promise<CustomerSessionView> {
  const session = await requireCustomerSession();
  if (session.membership.role !== "account_admin") {
    throw new CustomerPortalError("Accountbeheerder vereist.", "CUSTOMER_ADMIN_REQUIRED");
  }
  return session;
}

export async function customerSignInWithPassword(input: {
  email: string;
  password: string;
  clientKey: string;
}): Promise<{ ok: true; session: CustomerSessionView } | { ok: false; error: string }> {
  try {
    assertRateLimit(
      `${CUSTOMER_LOGIN_RATE.keyPrefix}:${input.clientKey}`,
      CUSTOMER_LOGIN_RATE.maxAttempts,
      CUSTOMER_LOGIN_RATE.windowMs,
    );
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    if (error instanceof RateLimitError || code === "rate_limit") {
      return { ok: false, error: "Te veel inlogpogingen. Probeer het later opnieuw." };
    }
    throw error;
  }

  if (!hasSupabasePublicConfig()) {
    return { ok: false, error: "Inloggen is tijdelijk niet beschikbaar." };
  }

  const { url, publishableKey } = getSupabasePublicConfig();
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error || !data.session) {
    return { ok: false, error: "Onjuist e-mailadres of wachtwoord." };
  }

  issueCustomerAuthCookies({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });

  try {
    const session = await resolveCustomerPrincipal(data.session.access_token);
    return { ok: true, session };
  } catch (err) {
    clearCustomerAuthCookies();
    const message =
      err instanceof CustomerPortalError || err instanceof CustomerAuthError
        ? err.message
        : "Geen toegang tot het klantenportaal.";
    return { ok: false, error: message };
  }
}

export async function customerSignOut(): Promise<void> {
  clearCustomerAuthCookies();
}

export async function customerRequestPasswordReset(input: {
  email: string;
  clientKey: string;
}): Promise<{ ok: true }> {
  const { CUSTOMER_FORGOT_PASSWORD_RATE } = await import("@mccoy/security");
  try {
    assertRateLimit(
      `${CUSTOMER_FORGOT_PASSWORD_RATE.keyPrefix}:${input.clientKey}`,
      CUSTOMER_FORGOT_PASSWORD_RATE.maxAttempts,
      CUSTOMER_FORGOT_PASSWORD_RATE.windowMs,
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { ok: true };
    }
    throw error;
  }

  if (!hasSupabasePublicConfig()) return { ok: true };

  const email = input.email.trim().toLowerCase();
  const { customerPasswordResetUrl } = await import("./config");
  const redirectTo = customerPasswordResetUrl();

  const { url, publishableKey } = getSupabasePublicConfig();
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  await client.auth.resetPasswordForEmail(email, { redirectTo });
  return { ok: true };
}

export async function customerCompletePasswordReset(input: {
  password: string;
  clientKey: string;
  accessToken?: string;
  refreshToken?: string;
  tokenHash?: string;
  code?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { CUSTOMER_FORGOT_PASSWORD_RATE } = await import("@mccoy/security");
  try {
    assertRateLimit(
      `${CUSTOMER_FORGOT_PASSWORD_RATE.keyPrefix}:complete:${input.clientKey}`,
      CUSTOMER_FORGOT_PASSWORD_RATE.maxAttempts,
      CUSTOMER_FORGOT_PASSWORD_RATE.windowMs,
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { ok: false, error: "Te veel pogingen. Probeer het later opnieuw." };
    }
    throw error;
  }

  if (!hasSupabasePublicConfig()) {
    return { ok: false, error: "Wachtwoord reset is tijdelijk niet beschikbaar." };
  }

  const { url, publishableKey } = getSupabasePublicConfig();
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  let accessToken = input.accessToken?.trim() || "";
  let refreshToken = input.refreshToken?.trim() || "";

  if ((!accessToken || !refreshToken) && input.code) {
    const exchanged = await client.auth.exchangeCodeForSession(input.code.trim());
    if (exchanged.error || !exchanged.data.session) {
      return { ok: false, error: "Deze resetlink is ongeldig of verlopen." };
    }
    accessToken = exchanged.data.session.access_token;
    refreshToken = exchanged.data.session.refresh_token;
  } else if ((!accessToken || !refreshToken) && input.tokenHash) {
    const verified = await client.auth.verifyOtp({
      token_hash: input.tokenHash.trim(),
      type: "recovery",
    });
    if (verified.error || !verified.data.session) {
      return { ok: false, error: "Deze resetlink is ongeldig of verlopen." };
    }
    accessToken = verified.data.session.access_token;
    refreshToken = verified.data.session.refresh_token;
  }

  if (!accessToken || !refreshToken) {
    return { ok: false, error: "Ongeldige of incomplete resetlink." };
  }

  const service = createSupabaseServiceClient();
  const { data: userData, error: userError } = await service.auth.getUser(accessToken);
  if (userError || !userData.user?.id) {
    return { ok: false, error: "Deze resetlink is ongeldig of verlopen." };
  }

  const userId = userData.user.id;
  const profile = await getCustomerById(userId);
  if (!profile) {
    return { ok: false, error: "Geen klantaccount." };
  }

  const userRow = await service.from("users").select("account_kind, status").eq("id", userId).maybeSingle();
  if (userRow.data?.account_kind !== "customer") {
    return { ok: false, error: "Geen klantaccount." };
  }
  if (userRow.data?.status === "blocked") {
    return { ok: false, error: "Account geblokkeerd." };
  }

  const { data: membershipRows, error: membershipError } = await service
    .from("company_users")
    .select("company_id")
    .eq("user_id", userId)
    .limit(2);
  if (membershipError) {
    throw new Error(`customerCompletePasswordReset membership: ${membershipError.message}`);
  }
  if (!membershipRows || membershipRows.length !== 1) {
    return { ok: false, error: "Geen actieve bedrijfskoppeling." };
  }

  const { error: updateError } = await service.auth.admin.updateUserById(userId, {
    password: input.password,
  });
  if (updateError) {
    return { ok: false, error: "Wachtwoord kon niet worden gewijzigd. Probeer een sterker wachtwoord." };
  }

  clearCustomerAuthCookies();
  return { ok: true };
}
