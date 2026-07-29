import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AppDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function AppDialog({
  open,
  title,
  description,
  onOpenChange,
  children,
  footer,
  className,
  contentClassName,
}: AppDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[min(90vh,40rem)] overflow-y-auto", contentClassName, className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

export type FormDialogProps = {
  open: boolean;
  title: string;
  description: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  pending?: boolean;
  error?: string | null;
  initialValue?: string;
  required?: boolean;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
};

export function FormDialog({
  open,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  cancelLabel = "Annuleren",
  tone = "default",
  pending = false,
  error = null,
  initialValue = "",
  required = true,
  onConfirm,
  onCancel,
}: FormDialogProps) {
  const [value, setValue] = React.useState(initialValue);
  const inputId = React.useId();

  React.useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const canSubmit = !pending && (!required || value.trim().length > 0);

  return (
    <AppDialog
      open={open}
      title={title}
      description={description}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
      footer={
        <>
          <Button type="button" variant="outline" size="lg" className="min-h-12 rounded-xl px-5 text-[15px]" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="lg"
            variant={tone === "destructive" ? "destructive" : "primary"}
            className="min-h-12 rounded-xl px-5 text-[15px] font-semibold"
            loading={pending}
            disabled={!canSubmit}
            onClick={() => void onConfirm(value.trim())}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <label htmlFor={inputId} className="text-base font-medium text-foreground">
          {label}
        </label>
        <input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={pending}
          className="flex min-h-12 w-full rounded-xl border border-input bg-background px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </AppDialog>
  );
}
