/**
 * Read invite/recovery Auth callback params from a URL into memory only.
 * Never persist token_hash / tokens in sessionStorage or localStorage.
 */

export type StaffAuthCallbackParams = {
  tokenHash?: string;
  type?: "invite" | "recovery" | "signup" | "magiclink" | "email";
  code?: string;
  accessToken?: string;
  refreshToken?: string;
};

function isOtpType(
  value: string,
): value is "invite" | "recovery" | "signup" | "magiclink" | "email" {
  return (
    value === "invite" ||
    value === "recovery" ||
    value === "signup" ||
    value === "magiclink" ||
    value === "email"
  );
}

export function parseStaffAuthCallbackParams(
  href: string = typeof window !== "undefined" ? window.location.href : "",
): StaffAuthCallbackParams | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  const out: StaffAuthCallbackParams = {};
  const code = url.searchParams.get("code");
  if (code) out.code = code;

  const tokenHash = url.searchParams.get("token_hash");
  const otpType = (url.searchParams.get("type") || "").toLowerCase();
  if (tokenHash && isOtpType(otpType)) {
    out.tokenHash = tokenHash;
    out.type = otpType;
  }

  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (hash) {
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (accessToken && refreshToken) {
      out.accessToken = accessToken;
      out.refreshToken = refreshToken;
      const hashType = (params.get("type") || "").toLowerCase();
      if (isOtpType(hashType)) out.type = hashType;
    }
  }

  if (!out.code && !out.tokenHash && !out.accessToken) return null;
  return out;
}

export function hasStaffAuthCallbackParams(params: StaffAuthCallbackParams | null): boolean {
  return Boolean(params?.code || params?.tokenHash || (params?.accessToken && params?.refreshToken));
}
