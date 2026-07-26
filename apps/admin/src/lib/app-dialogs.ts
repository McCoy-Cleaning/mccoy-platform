import type { ConfirmationTone } from "@/components/admin/ConfirmationDialog";

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
  requireText?: string;
};

type PromptOptions = {
  title: string;
  description: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  required?: boolean;
  initialValue?: string;
};

type DialogBridge = {
  confirm: (options: ConfirmOptions) => Promise<"confirmed" | "cancelled">;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

let bridge: DialogBridge | null = null;

export function registerAppDialogBridge(next: DialogBridge | null): void {
  bridge = next;
}

export async function appConfirm(options: ConfirmOptions): Promise<boolean> {
  if (!bridge) {
    console.error("[app-dialogs] bridge not registered; denying confirm");
    return false;
  }
  const result = await bridge.confirm(options);
  return result === "confirmed";
}

export async function appPrompt(options: PromptOptions): Promise<string | null> {
  if (!bridge) {
    console.error("[app-dialogs] bridge not registered; denying prompt");
    return null;
  }
  return bridge.prompt(options);
}
