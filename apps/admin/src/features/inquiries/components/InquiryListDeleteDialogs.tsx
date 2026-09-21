import type { FormInboxMessageSummary } from "@mccoy/email/contracts";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";

function requestDeleteNoun(count: number): string {
  return count === 1 ? "aanvraag" : "aanvragen";
}

export function InquiryListDeleteDialogs({
  listDeleteTargetId,
  listDeleteTarget,
  bulkDeleteOpen,
  selectedCount,
  listDeleteBusy,
  listDeleteError,
  onConfirmSingle,
  onCancelSingle,
  onConfirmBulk,
  onCancelBulk,
}: {
  listDeleteTargetId: string | null;
  listDeleteTarget: FormInboxMessageSummary | null;
  bulkDeleteOpen: boolean;
  selectedCount: number;
  listDeleteBusy: boolean;
  listDeleteError: string | null;
  onConfirmSingle: () => void;
  onCancelSingle: () => void;
  onConfirmBulk: () => void;
  onCancelBulk: () => void;
}) {
  const bulkNoun = requestDeleteNoun(selectedCount);

  return (
    <>
      <ConfirmationDialog
        open={listDeleteTargetId !== null}
        title="Aanvraag verwijderen?"
        description={
          listDeleteTarget
            ? `Dit verwijdert de aanvraag van ${listDeleteTarget.submitterName ?? listDeleteTarget.submitterEmail ?? listDeleteTarget.from} uit Aanvragen en verwijdert waar mogelijk ook de mailboxkopie. Gebruik Afronden als u de aanvraag later wilt terugvinden.`
            : "De geselecteerde aanvraag wordt uit Aanvragen verwijderd."
        }
        confirmLabel="Aanvraag verwijderen"
        tone="destructive"
        pending={listDeleteBusy}
        error={listDeleteError}
        onConfirm={onConfirmSingle}
        onCancel={onCancelSingle}
      />

      <ConfirmationDialog
        open={bulkDeleteOpen}
        title={`${selectedCount} ${bulkNoun} verwijderen?`}
        description="De geselecteerde aanvragen worden uit Aanvragen verwijderd. Gebruik Afronden voor aanvragen die u later wilt kunnen terugvinden."
        confirmLabel={`${selectedCount} ${bulkNoun} verwijderen`}
        tone="destructive"
        pending={listDeleteBusy}
        error={listDeleteError}
        onConfirm={onConfirmBulk}
        onCancel={onCancelBulk}
      />
    </>
  );
}
