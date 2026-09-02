import { createHash, randomBytes } from "node:crypto";

/** 256-bit entropy invitation token (base64url). */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
