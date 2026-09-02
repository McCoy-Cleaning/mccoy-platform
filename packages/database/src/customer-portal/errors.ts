export type CustomerPortalErrorCode =
  | "CUSTOMER_INVITE_EXPIRED"
  | "CUSTOMER_INVITE_REVOKED"
  | "CUSTOMER_INVITE_USED"
  | "CUSTOMER_INVITE_INVALID"
  | "CUSTOMER_ALREADY_ACTIVE"
  | "CUSTOMER_MEMBERSHIP_SUSPENDED"
  | "CUSTOMER_COMPANY_SUSPENDED"
  | "CUSTOMER_ADMIN_REQUIRED"
  | "CUSTOMER_CROSS_TENANT_DENIED"
  | "CUSTOMER_ADMIN_ALREADY_EXISTS"
  | "CUSTOMER_INVITE_RATE_LIMITED"
  | "CUSTOMER_STAFF_COLLISION"
  | "CUSTOMER_OTHER_COMPANY"
  | "CUSTOMER_AUTH_INVALID"
  | "CUSTOMER_NOT_AUTHORIZED";

export class CustomerPortalError extends Error {
  readonly code: CustomerPortalErrorCode;

  constructor(message: string, code: CustomerPortalErrorCode) {
    super(message);
    this.name = "CustomerPortalError";
    this.code = code;
  }
}

export function customerPortalErrorMessage(code: CustomerPortalErrorCode): string {
  switch (code) {
    case "CUSTOMER_INVITE_EXPIRED":
      return "Deze uitnodigingslink is verlopen. Vraag een nieuwe uitnodiging aan.";
    case "CUSTOMER_INVITE_REVOKED":
      return "Deze uitnodigingslink is niet meer geldig.";
    case "CUSTOMER_INVITE_USED":
      return "Deze uitnodigingslink is al gebruikt.";
    case "CUSTOMER_INVITE_INVALID":
      return "Deze uitnodigingslink is ongeldig.";
    case "CUSTOMER_ALREADY_ACTIVE":
      return "Dit account is al actief.";
    case "CUSTOMER_MEMBERSHIP_SUSPENDED":
      return "Je accounttoegang is tijdelijk opgeschort.";
    case "CUSTOMER_COMPANY_SUSPENDED":
      return "Het klantenportaal voor dit bedrijf is niet beschikbaar.";
    case "CUSTOMER_ADMIN_REQUIRED":
      return "Alleen een accountbeheerder kan deze actie uitvoeren.";
    case "CUSTOMER_CROSS_TENANT_DENIED":
      return "Geen toegang tot deze gegevens.";
    case "CUSTOMER_ADMIN_ALREADY_EXISTS":
      return "Er is al een accountbeheerder voor dit bedrijf.";
    case "CUSTOMER_INVITE_RATE_LIMITED":
      return "Te veel uitnodigingen. Probeer het later opnieuw.";
    case "CUSTOMER_STAFF_COLLISION":
      return "Dit e-mailadres hoort bij een medewerkeraccount.";
    case "CUSTOMER_OTHER_COMPANY":
      return "Dit e-mailadres is al gekoppeld aan een ander bedrijf.";
    case "CUSTOMER_AUTH_INVALID":
      return "Onjuist e-mailadres of wachtwoord.";
    case "CUSTOMER_NOT_AUTHORIZED":
      return "Niet geautoriseerd. Log opnieuw in.";
    default:
      return "Er ging iets mis. Probeer het opnieuw.";
  }
}
