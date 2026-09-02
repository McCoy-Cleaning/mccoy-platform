/**
 * Qualification database environment — isolated Supabase only.
 * Set QUALIFICATION_SUPABASE_* (or SUPABASE_* via monorepo env) from `supabase status`.
 * Never commit secret or publishable keys.
 */

const LOCAL_URL = "http://127.0.0.1:54321";

export type QualificationSupabaseConfig = {
  url: string;
  publishableKey: string;
  secretKey: string;
};

function missingQualificationKeysError(): Error {
  return new Error(
    "Missing qualification Supabase keys. Set QUALIFICATION_SUPABASE_PUBLISHABLE_KEY and " +
      "QUALIFICATION_SUPABASE_SECRET_KEY (from `supabase status -o env`) or SUPABASE_PUBLISHABLE_KEY / " +
      "SUPABASE_SECRET_KEY in the monorepo env. Do not hardcode keys in source.",
  );
}

export function getQualificationSupabaseConfig(): QualificationSupabaseConfig {
  const url = process.env.QUALIFICATION_SUPABASE_URL?.trim() || LOCAL_URL;
  const publishableKey =
    process.env.QUALIFICATION_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    "";
  const secretKey =
    process.env.QUALIFICATION_SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    "";

  if (!publishableKey || !secretKey) {
    throw missingQualificationKeysError();
  }

  return { url, publishableKey, secretKey };
}

/** Apply qualification env to process for createSupabaseServiceClient(). */
export function applyQualificationEnv(): QualificationSupabaseConfig {
  const config = getQualificationSupabaseConfig();
  process.env.SUPABASE_URL = config.url;
  process.env.SUPABASE_PUBLISHABLE_KEY = config.publishableKey;
  process.env.SUPABASE_SECRET_KEY = config.secretKey;
  return config;
}

export async function isQualificationDbReachable(): Promise<boolean> {
  let url: string;
  let secretKey: string;
  try {
    ({ url, secretKey } = getQualificationSupabaseConfig());
  } catch {
    return false;
  }
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
