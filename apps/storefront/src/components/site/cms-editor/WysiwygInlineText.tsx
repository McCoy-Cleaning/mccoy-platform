import * as React from "react";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { useActiveCmsLocale } from "@/lib/cms/use-active-cms-locale";
import { cn } from "@/lib/utils";
import type { FixedSectionKey } from "@mccoy/cms-schema";
import {
  inlineTextDisplayValue,
  shouldSyncInlineTextFromProps,
} from "./wysiwyg-inline-text-state";

type TextCommitTarget =
  | { kind: "section"; sectionKey: FixedSectionKey; field: string }
  | { kind: "block"; blockId: string; field: string }
  | { kind: "enPath"; path: string }
  | { kind: "custom"; onCommit: (next: string) => void };

/**
 * In-place plain-text editing on the real website typography.
 * Does not introduce HTML — only constrained string fields.
 * When the canvas locale is EN and an enFieldPath is provided, commits to
 * enFieldDrafts so NL source values stay untouched.
 */
export function WysiwygInlineText({
  value,
  as = "span",
  className,
  multiline = false,
  label,
  enFieldPath,
  target,
}: {
  value: string;
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
  className?: string;
  multiline?: boolean;
  label?: string;
  /** Canonical EN draft path, e.g. `section:home.hero:heading`. */
  enFieldPath?: string;
  target: TextCommitTarget;
}) {
  const { showEditorChrome, sendMutation } = useLiveEditApi();
  const locale = useActiveCmsLocale();
  const [focused, setFocused] = React.useState(false);
  /** Keep committed text visible until the parent draft push catches up. */
  const [pendingCommit, setPendingCommit] = React.useState<string | null>(null);
  const elRef = React.useRef<HTMLElement | null>(null);
  const Tag = as;
  const displayValue = inlineTextDisplayValue(value, pendingCommit);

  React.useEffect(() => {
    if (pendingCommit === null) return;
    if (value === pendingCommit) setPendingCommit(null);
  }, [value, pendingCommit]);

  const commit = React.useCallback(
    (next: string) => {
      if (next === value) return;
      setPendingCommit(next);
      if (locale === "en" && enFieldPath) {
        sendMutation({ kind: "enField", path: enFieldPath, value: next });
        return;
      }
      if (target.kind === "custom") {
        target.onCommit(next);
        return;
      }
      if (target.kind === "enPath") {
        sendMutation({ kind: "enField", path: target.path, value: next });
        return;
      }
      if (target.kind === "section") {
        sendMutation({
          kind: "section",
          sectionKey: target.sectionKey,
          patch: { [target.field]: next },
        });
        return;
      }
      sendMutation({
        kind: "block",
        blockId: target.blockId,
        patch: { [target.field]: next },
      });
    },
    [enFieldPath, locale, sendMutation, target, value],
  );

  const setElRef = React.useCallback((el: HTMLElement | null) => {
    elRef.current = el;
  }, []);

  // Own DOM text outside React children so parent re-renders (section hover,
  // selection chrome, draft pushes) cannot rewrite an in-progress edit.
  React.useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (!shouldSyncInlineTextFromProps({ focused })) return;
    if (el.innerText !== displayValue) el.innerText = displayValue;
  }, [displayValue, focused]);

  if (!showEditorChrome) {
    return <Tag className={className}>{value}</Tag>;
  }

  // No layout wrapper — the real typography tag stays the box participant.
  // Label slot stays mounted (hidden when idle) so toggling focus never remounts
  // the contentEditable and wipes in-progress text.
  return (
    <>
      <span
        data-cms-editor-chrome
        aria-hidden={!focused}
        className={cn(
          "pointer-events-none absolute -top-7 left-0 z-40 inline-flex items-center gap-1 rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow",
          !focused && "invisible",
        )}
      >
        {label ? <span>{label}</span> : null}
        <span className="rounded bg-black/20 px-1">{locale.toUpperCase()}</span>
      </span>
      <Tag
        className={cn(
          className,
          "outline-none transition hover:ring-2 hover:ring-sky-400/50 focus:ring-2 focus:ring-sky-400",
          focused && "relative",
        )}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-cms-inline-edit=""
        onFocus={() => {
          setFocused(true);
        }}
        onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
          if (!multiline && e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLElement).blur();
          }
        }}
        onBlur={(e: React.FocusEvent<HTMLElement>) => {
          const next = e.currentTarget.innerText.trim();
          setFocused(false);
          commit(next);
        }}
        ref={setElRef}
      />
    </>
  );
}
