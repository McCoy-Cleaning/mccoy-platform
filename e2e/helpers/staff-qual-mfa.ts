import { createClient } from "@supabase/supabase-js";

import { normalizeEmail } from "@mccoy/domain";

import { QUAL_PASSWORD } from "@mccoy/database/server";

import { totpCode } from "./totp";

/**
 * Enroll staff TOTP for qualification E2E and return the base32 secret for later AAL2 steps.
 */
export async function enrollStaffQualTotpSecret(input: {
  supabaseUrl: string;
  publishableKey: string;
  staffEmail: string;
  suffix: string;
}): Promise<string> {
  const email = normalizeEmail(input.staffEmail);
  const client = createClient(input.supabaseUrl, input.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signIn, error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: QUAL_PASSWORD,
  });
  if (signInErr || !signIn.session) {
    throw new Error(`staff qual sign-in failed: ${signInErr?.message ?? "no session"}`);
  }

  const { data: factors } = await client.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");
  if (verified) {
    throw new Error(
      "Staff MFA already enrolled without stored TOTP secret. Reset local Supabase auth or use a fresh qual suffix.",
    );
  }

  const { data: enroll, error: enrollErr } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `qual-${input.suffix}`,
  });
  if (enrollErr || !enroll?.id || !enroll.totp?.secret) {
    throw new Error(
      `staff MFA enroll failed: ${enrollErr?.message ?? "missing enroll payload"}. ` +
        "Ensure supabase/config.toml enables [auth.mfa.totp] and restart supabase.",
    );
  }

  const { data: challenge, error: challengeErr } = await client.auth.mfa.challenge({
    factorId: enroll.id,
  });
  if (challengeErr || !challenge?.id) {
    throw new Error(`staff MFA challenge failed: ${challengeErr?.message ?? "no challenge"}`);
  }

  const { error: verifyErr } = await client.auth.mfa.verify({
    factorId: enroll.id,
    challengeId: challenge.id,
    code: totpCode(enroll.totp.secret),
  });
  if (verifyErr) {
    throw new Error(`staff MFA verify failed: ${verifyErr.message}`);
  }

  return enroll.totp.secret;
}
