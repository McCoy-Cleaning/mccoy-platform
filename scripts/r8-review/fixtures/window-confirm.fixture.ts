// @r8-path: packages/cms-editor/src/r8-fixture-confirm.ts
// Isolated R8 self-test fixture — not imported by production code.
export function confirmDelete() {
  return window.confirm("Delete?");
}
