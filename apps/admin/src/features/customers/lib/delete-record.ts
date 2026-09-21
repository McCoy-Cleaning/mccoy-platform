/**
 * Klanten-directory delete copy and error mapping.
 * Uses the existing staff `deleteAdminPortalCompanies` policy:
 * only service_client companies without orders can be removed.
 */

export const DELETE_RECORD_LABEL = "Record verwijderen";

export type DeleteRecordFailureCode =
  | "not_found"
  | "not_service_client"
  | "has_orders"
  | "persist"
  | "permission";

export function deleteRecordRequest(companyId: string): { companyIds: [string] } {
  return { companyIds: [companyId] };
}

export function deleteRecordConfirmCopy(companyName: string): {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
} {
  const name = companyName.trim() || "dit bedrijf";
  return {
    title: "Record verwijderen?",
    description:
      `Je staat op het punt “${name}” te verwijderen uit het klantenoverzicht. ` +
      "Dit kan niet ongedaan worden gemaakt. Alleen serviceklanten zonder orders " +
      "kunnen worden verwijderd; bestaande orderhistorie blijft bewaard.",
    confirmLabel: "Verwijderen",
    cancelLabel: "Annuleren",
  };
}

export function deleteRecordSuccessMessage(companyName: string): string {
  const name = companyName.trim() || "Het record";
  return `${name} is verwijderd uit het overzicht.`;
}

function isPermissionError(error?: string | null): boolean {
  if (!error) return false;
  return /niet geautoriseerd|geen toegang|toestemming/i.test(error);
}

export function mapDeleteRecordError(input: {
  code?: string | null;
  error?: string | null;
}): string {
  switch (input.code) {
    case "not_found":
      return "Bedrijf niet gevonden.";
    case "not_service_client":
      return "Alleen serviceklanten zonder orderhistorie kunnen hier worden verwijderd.";
    case "has_orders":
      return "Dit bedrijf heeft orders. Verwijderen is geblokkeerd om de orderhistorie te bewaren.";
    case "permission":
      return "Je hebt geen toestemming om dit record te verwijderen.";
    case "persist":
      return "Verwijderen mislukt. Probeer het opnieuw.";
    default:
      if (isPermissionError(input.error)) {
        return "Je hebt geen toestemming om dit record te verwijderen.";
      }
      return "Verwijderen mislukt. Probeer het opnieuw.";
  }
}

export type DeleteRecordServerResult = {
  ok: boolean;
  error?: string;
  deleted?: number;
  failed?: number;
  results?: Array<{
    ok: boolean;
    companyId?: string;
    legalName?: string;
    error?: string;
    code?: string;
  }>;
};

export function interpretDeleteRecordResult(
  res: DeleteRecordServerResult,
): { ok: true; legalName?: string } | { ok: false; message: string } {
  if (!res.ok) {
    return { ok: false, message: mapDeleteRecordError({ error: res.error }) };
  }
  const failure = (res.results ?? []).find((row) => !row.ok);
  if (failure) {
    return {
      ok: false,
      message: mapDeleteRecordError({ code: failure.code, error: failure.error }),
    };
  }
  if ((res.deleted ?? 0) < 1) {
    return { ok: false, message: mapDeleteRecordError({ code: "persist" }) };
  }
  const success = (res.results ?? []).find((row) => row.ok);
  return {
    ok: true,
    legalName: success?.legalName,
  };
}

/** After a successful delete, pick the next directory row (or null to clear). */
export function nextDirectorySelectionAfterDelete<T extends { companyId: string }>(
  items: readonly T[],
  deletedId: string,
  selectedId: string | undefined | null,
): T | null {
  const remaining = items.filter((item) => item.companyId !== deletedId);
  if (remaining.length === 0) return null;
  if (selectedId && selectedId !== deletedId) {
    return remaining.find((item) => item.companyId === selectedId) ?? remaining[0] ?? null;
  }
  const deletedIndex = items.findIndex((item) => item.companyId === deletedId);
  if (deletedIndex < 0) return remaining[0] ?? null;
  return remaining[Math.min(deletedIndex, remaining.length - 1)] ?? remaining[0] ?? null;
}
