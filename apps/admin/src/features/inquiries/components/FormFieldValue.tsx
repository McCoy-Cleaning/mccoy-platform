import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { shouldCollapseFormField, collapseFormFieldPreview } from "../lib/form-fields";

export function FormFieldValue({
  fieldKey,
  label,
  value,
}: {
  fieldKey: string;
  label: string;
  value: string;
}) {
  const [open, setOpen] = React.useState(false);
  const shouldCollapse = shouldCollapseFormField(fieldKey, value);

  if (!shouldCollapse) {
    return (
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/90">
        {value}
      </p>
    );
  }

  const preview = collapseFormFieldPreview(value);

  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/90">
        {preview}
        <span className="text-white/40">…</span>
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5]"
      >
        Alles lezen
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden border-white/10 bg-[#0f172a] text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">{label}</DialogTitle>
            <DialogDescription className="sr-only">Volledige tekst van {label}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(60vh,28rem)] overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-white/90">
              {value}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
