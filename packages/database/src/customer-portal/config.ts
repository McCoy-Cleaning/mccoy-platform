import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";

export function customerInviteTtlHours(): number {
  ensureMonorepoEnvLoaded();
  const raw = process.env.CUSTOMER_INVITE_TTL_HOURS;
  const parsed = raw ? Number(raw) : 72;
  if (!Number.isFinite(parsed) || parsed < 1) return 72;
  return Math.min(24 * 14, Math.trunc(parsed));
}

export function customerInviteMaxReminders(): number {
  ensureMonorepoEnvLoaded();
  const raw = process.env.CUSTOMER_INVITE_MAX_REMINDERS;
  const parsed = raw ? Number(raw) : 2;
  if (!Number.isFinite(parsed) || parsed < 0) return 2;
  return Math.min(5, Math.trunc(parsed));
}

export function storefrontOrigin(): string {
  ensureMonorepoEnvLoaded();
  const origin = (
    process.env.STOREFRONT_ORIGIN ||
    process.env.E2E_STOREFRONT_ORIGIN ||
    process.env.VITE_STOREFRONT_ORIGIN ||
    ""
  ).replace(/\/$/, "");
  if (origin) return origin;
  if (process.env.NODE_ENV === "production") return "https://www.mccoy.nl";
  return "http://localhost:5173";
}

export function customerActivationUrl(rawToken: string): string {
  return `${storefrontOrigin()}/account/activate?token=${encodeURIComponent(rawToken)}`;
}

export function customerPasswordResetUrl(): string {
  return `${storefrontOrigin()}/account/reset-password`;
}
