/** Staff password strength rules (shared client + server). */

export const STAFF_PASSWORD_MIN_LENGTH = 10;
export const STAFF_PASSWORD_MAX_LENGTH = 200;

/**
 * Returns a Dutch error message when the password is too weak, otherwise null.
 * Rules: min 10 chars, at least one lowercase, one uppercase, one digit.
 */
export function staffPasswordStrengthError(password: string): string | null {
  if (typeof password !== "string" || password.length < STAFF_PASSWORD_MIN_LENGTH) {
    return `Wachtwoord moet minimaal ${STAFF_PASSWORD_MIN_LENGTH} tekens zijn.`;
  }
  if (password.length > STAFF_PASSWORD_MAX_LENGTH) {
    return `Wachtwoord mag maximaal ${STAFF_PASSWORD_MAX_LENGTH} tekens zijn.`;
  }
  if (!/[a-z]/.test(password)) {
    return "Wachtwoord moet minstens één kleine letter bevatten.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Wachtwoord moet minstens één hoofdletter bevatten.";
  }
  if (!/\d/.test(password)) {
    return "Wachtwoord moet minstens één cijfer bevatten.";
  }
  return null;
}

export function isStaffPasswordStrong(password: string): boolean {
  return staffPasswordStrengthError(password) === null;
}
