export type InboxBulkDeleteFailure = { id: string; error: string };

/** Dutch operator-facing summary for partial/total bulk delete failures. */
export function bulkDeleteFailureMessage(
  deletedCount: number,
  failures: InboxBulkDeleteFailure[],
): string {
  if (failures.length === 0) {
    return deletedCount > 0 ? `${deletedCount} berichten verwijderd.` : "Verwijderen mislukt.";
  }

  const uniqueErrors = [...new Set(failures.map((failure) => failure.error.trim()).filter(Boolean))];

  if (deletedCount === 0) {
    if (failures.length === 1) {
      return failures[0]!.error;
    }
    if (uniqueErrors.length === 1) {
      return uniqueErrors[0]!;
    }
    const preview = uniqueErrors.slice(0, 2).join(" · ");
    const extra =
      uniqueErrors.length > 2
        ? ` (+${uniqueErrors.length - 2} andere fout${uniqueErrors.length > 3 ? "en" : ""})`
        : "";
    return `${failures.length} berichten konden niet worden verwijderd. ${preview}${extra}`;
  }

  if (uniqueErrors.length === 1) {
    return `${deletedCount} verwijderd, ${failures.length} mislukt: ${uniqueErrors[0]}`;
  }
  return `${deletedCount} verwijderd, ${failures.length} mislukt.`;
}
