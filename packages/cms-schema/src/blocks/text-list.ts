import { z } from "zod";
import { createItemId } from "../ids";

export type TextListItem = {
  id: string;
  text: string;
};

export const textListItemSchema: z.ZodType<TextListItem> = z.object({
  id: z.string().min(1),
  text: z.string(),
});

export function createTextListItem(text = ""): TextListItem {
  return { id: createItemId("txt"), text };
}

/** Normalize legacy `string[]` or mixed values into stable TextListItem[]. */
export function normalizeTextList(value: unknown): TextListItem[] {
  if (!Array.isArray(value)) return [];
  const out: TextListItem[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      out.push(createTextListItem(entry));
      continue;
    }
    if (entry && typeof entry === "object") {
      const rec = entry as Record<string, unknown>;
      const text =
        typeof rec.text === "string"
          ? rec.text
          : typeof rec.label === "string"
            ? rec.label
            : "";
      const id = typeof rec.id === "string" && rec.id.length > 0 ? rec.id : createItemId("txt");
      out.push({ id, text });
    }
  }
  return out;
}

export function reorderByIds<T extends { id: string }>(items: T[], orderedIds: string[]): T[] {
  const byId = new Map(items.map((i) => [i.id, i] as const));
  const next: T[] = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (item) {
      next.push(item);
      byId.delete(id);
    }
  }
  for (const item of byId.values()) next.push(item);
  return next;
}
