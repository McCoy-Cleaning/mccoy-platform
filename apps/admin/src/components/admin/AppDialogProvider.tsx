import * as React from "react";
import {
  ConfirmationDialog,
  type ConfirmationTone,
} from "@/components/admin/ConfirmationDialog";
import { FormDialog } from "@/components/admin/AppDialog";
import { registerAppDialogBridge } from "@/lib/app-dialogs";

type ConfirmRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
  requireText?: string;
  resolve: (result: "confirmed" | "cancelled") => void;
};

type PromptRequest = {
  title: string;
  description: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  required?: boolean;
  initialValue?: string;
  resolve: (value: string | null) => void;
};

type DialogApi = {
  confirm: (options: Omit<ConfirmRequest, "resolve">) => Promise<"confirmed" | "cancelled">;
  prompt: (options: Omit<PromptRequest, "resolve">) => Promise<string | null>;
};

const DialogApiCtx = React.createContext<DialogApi | null>(null);

export function useAppDialogs(): DialogApi {
  const ctx = React.useContext(DialogApiCtx);
  if (!ctx) throw new Error("useAppDialogs must be used within AppDialogProvider");
  return ctx;
}

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [confirmReq, setConfirmReq] = React.useState<ConfirmRequest | null>(null);
  const [promptReq, setPromptReq] = React.useState<PromptRequest | null>(null);

  const api = React.useMemo<DialogApi>(
    () => ({
      confirm: (options) =>
        new Promise((resolve) => {
          setConfirmReq({ ...options, resolve });
        }),
      prompt: (options) =>
        new Promise((resolve) => {
          setPromptReq({ ...options, resolve });
        }),
    }),
    [],
  );

  React.useEffect(() => {
    registerAppDialogBridge(api);
    return () => registerAppDialogBridge(null);
  }, [api]);

  return (
    <DialogApiCtx.Provider value={api}>
      {children}
      {confirmReq ? (
        <ConfirmationDialog
          open
          title={confirmReq.title}
          description={confirmReq.description}
          confirmLabel={confirmReq.confirmLabel}
          cancelLabel={confirmReq.cancelLabel}
          tone={confirmReq.tone}
          requireText={confirmReq.requireText}
          onCancel={() => {
            confirmReq.resolve("cancelled");
            setConfirmReq(null);
          }}
          onConfirm={() => {
            confirmReq.resolve("confirmed");
            setConfirmReq(null);
          }}
        />
      ) : null}
      {promptReq ? (
        <FormDialog
          open
          title={promptReq.title}
          description={promptReq.description}
          label={promptReq.label}
          placeholder={promptReq.placeholder}
          confirmLabel={promptReq.confirmLabel}
          cancelLabel={promptReq.cancelLabel}
          tone={promptReq.tone}
          required={promptReq.required}
          initialValue={promptReq.initialValue}
          onCancel={() => {
            promptReq.resolve(null);
            setPromptReq(null);
          }}
          onConfirm={(value) => {
            promptReq.resolve(value);
            setPromptReq(null);
          }}
        />
      ) : null}
    </DialogApiCtx.Provider>
  );
}
