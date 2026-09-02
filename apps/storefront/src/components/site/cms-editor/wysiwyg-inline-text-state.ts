/**
 * Pure helpers for WysiwygInlineText — kept free of React so commit/display
 * rules can be unit-tested without a DOM environment.
 */

/** Show optimistic committed text until the live draft prop catches up. */
export function inlineTextDisplayValue(value: string, pendingCommit: string | null): string {
  return pendingCommit ?? value;
}

/**
 * While focused, never force DOM text from props — parent re-renders
 * (selection chrome, hover) must not wipe in-progress contentEditable input.
 */
export function shouldSyncInlineTextFromProps(opts: { focused: boolean }): boolean {
  return !opts.focused;
}
