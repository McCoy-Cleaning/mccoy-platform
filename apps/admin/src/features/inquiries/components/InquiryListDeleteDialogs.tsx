import type { FormInboxMessageSummary } from "@mccoy/email/contracts";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";

function emailDeleteNoun(count: number): string {
  return count === 1 ? "e-mail" : "e-mails";
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
  const bulkNoun = emailDeleteNoun(selectedCount);

  return (
    <>
      <ConfirmationDialog
        open={listDeleteTargetId !== null}
        title="E-mail verwijderen?"
        description={
          listDeleteTarget
            ? `Dit verwijdert het formulierbericht van ${listDeleteTarget.submitterName ?? listDeleteTarget.submitterEmail ?? listDeleteTarget.from} uit deze mailbox. Dit kan niet eenvoudig ongedaan worden gemaakt vanuit Aanvragen.`
            : "De geselecteerde e-mail wordt uit deze mailbox verwijderd."
        }
        confirmLabel="1 e-mail verwijderen"
        tone="destructive"
        pending={listDeleteBusy}
        error={listDeleteError}
        onConfirm={onConfirmSingle}
        onCancel={onCancelSingle}
      />

      <ConfirmationDialog
        open={bulkDeleteOpen}
        title={`${selectedCount} ${bulkNoun} verwijderen?`}
        description="De geselecteerde e-mails worden uit deze mailbox verwijderd."
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
