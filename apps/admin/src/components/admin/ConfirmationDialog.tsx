import * as React from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmationTone = "default" | "warning" | "destructive";

export type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
  pending?: boolean;
  error?: string | null;
  /** When set, user must type this exact string to enable confirm. */
  requireText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Annuleren",
  tone = "default",
  pending = false,
  error = null,
  requireText,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const [typed, setTyped] = React.useState("");
  const inputId = React.useId();

  React.useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const requireOk = !requireText || typed.trim() === requireText;
  const canConfirm = !pending && requireOk;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
    >
      <AlertDialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-wrap">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {requireText ? (
          <div className="space-y-2">
            <label htmlFor={inputId} className="text-base font-medium">
              Typ <span className="font-mono">{requireText}</span> om te bevestigen
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={pending}
              autoComplete="off"
              className="flex min-h-12 w-full rounded-xl border border-input bg-background px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onCancel} className="min-h-12 rounded-xl px-5 text-[15px]">
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            type="button"
            size="lg"
            variant={tone === "destructive" ? "destructive" : tone === "warning" ? "outline" : "primary"}
            className={cn("min-h-12 rounded-xl px-5 text-[15px] font-semibold", tone === "warning" && "border-amber-500/50 text-amber-200")}
            loading={pending}
            disabled={!canConfirm}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DestructiveConfirmationDialog(props: Omit<ConfirmationDialogProps, "tone">) {
  return <ConfirmationDialog {...props} tone="destructive" />;
}
