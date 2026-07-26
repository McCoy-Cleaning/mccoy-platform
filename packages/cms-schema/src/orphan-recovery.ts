/**
 * Orphan CMS blocks (in `blocks` but not in `layout`) are retained — never auto-deleted.
 *
 * Follow-up admin UI:
 * - Panel label: "Niet-geplaatste paginasecties"
 * - Actions: Insert into layout / Delete / Export diagnostic
 * - Helper: `listOrphanBlocks(page)` from this package
 *
 * Interim recovery: `CmsPersistedState.migrationRecovery` snapshot, or manual re-add.
 */
export const ORPHAN_BLOCK_RECOVERY_NOTES =
  "Orphan blocks are retained; recovery UI is a documented follow-up.";
