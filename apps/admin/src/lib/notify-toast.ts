import { toast } from "sonner";

export type ToastKind = "success" | "info" | "warning" | "error";

export type NotifyToastInput = {
  kind: ToastKind;
  title: string;
  description?: string;
  dedupeKey?: string;
  durationMs?: number;
  action?: { label: string; onAction: () => void };
};

const recentDedupe = new Map<string, number>();
const DEDUPE_WINDOW_MS = 4_000;

export function notifyToast(input: NotifyToastInput): void {
  if (input.dedupeKey) {
    const last = recentDedupe.get(input.dedupeKey) ?? 0;
    if (Date.now() - last < DEDUPE_WINDOW_MS) return;
    recentDedupe.set(input.dedupeKey, Date.now());
  }

  const duration =
    input.durationMs ??
    (input.kind === "error" ? 12_000 : input.kind === "warning" ? 8_000 : 4_500);

  const opts = {
    id: input.dedupeKey,
    description: input.description,
    duration,
    action: input.action
      ? {
          label: input.action.label,
          onClick: input.action.onAction,
        }
      : undefined,
  };

  switch (input.kind) {
    case "success":
      toast.success(input.title, opts);
      break;
    case "warning":
      toast.warning(input.title, opts);
      break;
    case "error":
      toast.error(input.title, opts);
      break;
    default:
      toast.message(input.title, opts);
  }
}
