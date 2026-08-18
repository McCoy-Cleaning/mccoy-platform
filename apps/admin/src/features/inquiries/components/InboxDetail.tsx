import * as React from "react";
import { ArrowLeft, Pin, PinOff, Send, Trash2 } from "lucide-react";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { ErrorState } from "@/components/admin/ErrorState";
import { InlineLoader } from "@/components/admin/InlineLoader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FIELD_LABELS_NL, KIND_LABELS } from "@/lib/requests/labels";
import type { FormInboxMessage, FormInboxThreadItem } from "@mccoy/email/contracts";
import type { DetailState } from "../hooks/useInquiryDetailQuery";
import { useInquiryDetailDelete } from "../hooks/useInquiryDetailDelete";
import { useInquiryReply } from "../hooks/useInquiryReply";
import { isFullWidthFormField, isHeaderContactFormField } from "../lib/form-fields";
import {
  FORM_PHOTOS_FIELD_KEY,
  FORM_PHOTOS_FIELD_LABEL,
  partitionFormAttachments,
  shouldHideAttachmentFieldText,
} from "../lib/form-field-attachments";
import { formatWhen } from "../lib/format";
import { AttachmentImageThumbs } from "./AttachmentImageThumbs";
import { AttachmentsBlock } from "./AttachmentsBlock";
import { ConversationThread } from "./ConversationThread";
import { FormFieldValue } from "./FormFieldValue";

export function InboxDetail({
  detail,
  state,
  error,
  onBack,
  onDeleted,
  onAppendReply,
  onRemoveReply,
  onRefreshDetail,
  isPinned,
  onTogglePin,
}: {
  detail: FormInboxMessage | null;
  state: DetailState;
  error: string | null;
  onBack: () => void;
  onDeleted: () => void;
  onAppendReply: (item: FormInboxThreadItem) => void;
  onRemoveReply?: (id: string) => void;
  onRefreshDetail: () => void;
  isPinned: boolean;
  onTogglePin?: () => void;
}) {
  const [reply, setReply] = React.useState("");
  const replyMutation = useInquiryReply({
    detail,
    reply,
    setReply,
    onAppendReply,
    onRemoveReply,
    onRefreshDetail,
  });
  const deleteMutation = useInquiryDetailDelete({ detail, onDeleted });

  React.useEffect(() => {
    setReply("");
    replyMutation.resetForDetailChange();
    deleteMutation.resetForDetailChange();
    // Reset only when the open message changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: detail id gate
  }, [detail?.id]);

  const title =
    detail?.submitterName ??
    detail?.fields.find((f) => f.key === "name")?.value ??
    detail?.subject ??
    "Aanvraag";

  const bodyFieldsBase =
    detail?.fields.filter((field) => !isHeaderContactFormField(field.key)) ?? [];
  const attachmentPartition = detail
    ? partitionFormAttachments(detail.fields, detail.attachments)
    : {
        imagesByFieldKey: new Map(),
        unmappedImages: [] as FormInboxMessage["attachments"],
        fileAttachments: [] as FormInboxMessage["attachments"],
      };

  const bodyFields = (() => {
    const fields = [...bodyFieldsBase];
    const hasPhotosField = fields.some((field) => field.key === FORM_PHOTOS_FIELD_KEY);
    if (!hasPhotosField && attachmentPartition.unmappedImages.length > 0) {
      fields.push({
        key: FORM_PHOTOS_FIELD_KEY,
        label: FORM_PHOTOS_FIELD_LABEL,
        value: attachmentPartition.unmappedImages.map((item) => item.filename).join(", "),
      });
      attachmentPartition.imagesByFieldKey.set(
        FORM_PHOTOS_FIELD_KEY,
        attachmentPartition.unmappedImages,
      );
    } else if (hasPhotosField && attachmentPartition.unmappedImages.length > 0) {
      const current = attachmentPartition.imagesByFieldKey.get(FORM_PHOTOS_FIELD_KEY) ?? [];
      attachmentPartition.imagesByFieldKey.set(FORM_PHOTOS_FIELD_KEY, [
        ...current,
        ...attachmentPartition.unmappedImages,
      ]);
    }
    return fields;
  })();
  const submitterPhone =
    detail?.fields.find((f) => f.key === "phone")?.value?.trim() || null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="a-btn a-btn-secondary">
          <ArrowLeft className="h-4 w-4" />
          Terug naar overzicht
        </button>
        {detail && state !== "loading" ? (
          <div className="flex flex-wrap items-center gap-2">
            {onTogglePin ? (
              <Button
                type="button"
                variant="outline"
                aria-pressed={isPinned}
                className={cn(
                  "min-h-11 rounded-xl",
                  isPinned
                    ? "border-amber-400/35 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20 hover:text-white"
                    : "border-white/20 bg-white/5 text-white/85 hover:bg-white/10 hover:text-white",
                )}
                onClick={onTogglePin}
                disabled={deleteMutation.deleteBusy || replyMutation.busy}
              >
                {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {isPinned ? "Losmaken" : "Vastzetten"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-xl border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20 hover:text-white"
              onClick={() => {
                deleteMutation.setDeleteError(null);
                deleteMutation.setDeleteOpen(true);
              }}
              disabled={deleteMutation.deleteBusy || replyMutation.busy}
            >
              <Trash2 className="h-4 w-4" />
              Verwijderen
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmationDialog
        open={deleteMutation.deleteOpen}
        title="E-mail verwijderen"
        description="Dit verwijdert het formulierbericht uit de mailbox (Verwijderde items). Dit kan niet eenvoudig ongedaan worden gemaakt vanuit Aanvragen."
        confirmLabel="Verwijderen"
        tone="destructive"
        pending={deleteMutation.deleteBusy}
        error={deleteMutation.deleteError}
        onConfirm={deleteMutation.performDelete}
        onCancel={() => {
          if (deleteMutation.deleteBusy) return;
          deleteMutation.setDeleteOpen(false);
          deleteMutation.setDeleteError(null);
        }}
      />

      {state === "loading" && (
        <InlineLoader
          label="Bericht laden…"
          className="rounded-2xl border border-white/10 bg-[#0c1220] p-14"
        />
      )}

      {state === "error" && (
        <ErrorState
          message={error ?? "Kon details niet laden."}
          className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200"
        />
      )}

      {detail && state !== "loading" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
          <div className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1220]">
              <div className="border-b border-white/10 px-6 py-5">
                <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-white/40">
                  <span className="text-cyan-200/80">{KIND_LABELS[detail.kind]}</span>
                  {(detail.scopeLabel || detail.scopeKey) && (
                    <span className="rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[11px] normal-case tracking-normal text-cyan-100">
                      {detail.scopeLabel || detail.scopeKey}
                    </span>
                  )}
                  {detail.requestNumber ? (
                    <span className="font-mono normal-case tracking-normal text-white/45">
                      {detail.requestNumber}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white break-words">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-white/45">{formatWhen(detail.date)}</p>
              </div>

              <div
                className={cn(
                  "grid gap-px bg-white/10 sm:grid-cols-2",
                  submitterPhone ? "lg:grid-cols-3" : null,
                )}
              >
                <div className="bg-[#0c1220] px-6 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    Antwoord naar
                  </p>
                  <p className="mt-1 break-all text-[15px] text-white/90">
                    {detail.submitterEmail ?? "Niet gevonden"}
                  </p>
                </div>
                {submitterPhone ? (
                  <div className="bg-[#0c1220] px-6 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      Telefoon
                    </p>
                    <p className="mt-1 break-all text-[15px] text-white/90">{submitterPhone}</p>
                  </div>
                ) : null}
                <div className="bg-[#0c1220] px-6 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    Mailbox
                  </p>
                  <p className="mt-1 break-all text-[15px] text-white/70">{detail.to}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#0c1220]">
              <div className="border-b border-white/10 px-6 py-4">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  {bodyFields.length > 0 ? "Ingevulde gegevens" : "Inhoud"}
                </h3>
              </div>
              {bodyFields.length > 0 ? (
                <dl className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
                  {bodyFields.map((field) => {
                    const label = FIELD_LABELS_NL[field.key] ?? field.label;
                    const fullWidth = isFullWidthFormField(field.key);
                    const fieldImages =
                      attachmentPartition.imagesByFieldKey.get(field.key) ?? [];
                    const hideText = shouldHideAttachmentFieldText(field.value, fieldImages);

                    return (
                      <div
                        key={`${field.key}-${field.label}`}
                        className={cn(
                          "bg-[#0c1220]",
                          fullWidth || fieldImages.length > 0
                            ? "col-span-full grid gap-1 px-5 py-4 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-6 sm:px-6"
                            : "px-4 py-2.5 sm:px-5 sm:py-3",
                        )}
                      >
                        <dt
                          className={cn(
                            "text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40",
                            !fullWidth && fieldImages.length === 0 && "leading-snug",
                          )}
                        >
                          {label}
                        </dt>
                        <dd className={cn("min-w-0", !fullWidth && fieldImages.length === 0 && "mt-0.5")}>
                          {fieldImages.length > 0 ? (
                            <div className="space-y-3">
                              <AttachmentImageThumbs
                                messageId={detail?.id}
                                attachments={fieldImages}
                              />
                              {!hideText ? (
                                <FormFieldValue
                                  fieldKey={field.key}
                                  label={label}
                                  value={field.value}
                                />
                              ) : null}
                            </div>
                          ) : (
                            <FormFieldValue fieldKey={field.key} label={label} value={field.value} />
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              ) : (
                <div className="max-h-[22rem] overflow-auto px-6 py-5">
                  <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-white/85">
                    {detail.textBody || "(geen tekstinhoud)"}
                  </pre>
                </div>
              )}
            </section>

            <AttachmentsBlock
              messageId={detail.id}
              attachments={attachmentPartition.fileAttachments}
            />

            <ConversationThread
              thread={detail.thread}
              rootId={detail.id}
              hideRoot={detail.fields.length > 0}
            />
          </div>

          <section className="h-fit rounded-2xl border border-white/10 bg-[#0c1220] p-6 xl:sticky xl:top-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-[#1e88e5]/30 bg-[#1e88e5]/10">
                <Send className="h-4 w-4 text-[#90caf9]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-white">Antwoorden</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/50">
                  {detail.submitterEmail
                    ? `Verstuur een e-mail naar ${detail.submitterEmail}. Het antwoord verschijnt in het gesprek.`
                    : "Geen submitter-e-mail gevonden — antwoorden is niet mogelijk."}
                </p>
              </div>
            </div>

            <label className="mt-6 block">
              <span className="a-label">Uw bericht</span>
              <textarea
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value);
                  replyMutation.setReplySuccess(null);
                }}
                rows={9}
                maxLength={8000}
                disabled={!detail.submitterEmail}
                placeholder="Typ hier uw antwoord…"
                className="mt-1.5 w-full resize-y rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-base outline-none transition placeholder:text-white/30 focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/25 disabled:opacity-50"
              />
            </label>

            {replyMutation.replySuccess && (
              <div
                role="status"
                className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
              >
                {replyMutation.replySuccess}
              </div>
            )}

            <Button
              type="button"
              size="lg"
              className="mt-4 min-h-12 w-full rounded-xl text-base font-semibold"
              onClick={() => replyMutation.setConfirmOpen(true)}
              disabled={
                replyMutation.busy || !detail.submitterEmail || reply.trim().length < 2
              }
            >
              <Send className="h-4 w-4" />
              Verstuur antwoord
            </Button>

            <ConfirmationDialog
              open={replyMutation.confirmOpen}
              title="Antwoord versturen"
              description={
                detail.submitterEmail
                  ? `Verstuur dit antwoord naar ${detail.submitterEmail}? Dit kan niet ongedaan worden gemaakt.`
                  : "Geen afzender-e-mail gevonden — antwoorden is niet mogelijk."
              }
              confirmLabel="Versturen"
              pending={replyMutation.busy}
              error={replyMutation.replyError}
              onConfirm={replyMutation.performSend}
              onCancel={() => {
                if (replyMutation.busy) return;
                replyMutation.setConfirmOpen(false);
                replyMutation.setReplyError(null);
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
}
