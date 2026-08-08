// @r8-path: apps/admin/src/lib/r8-fixture-persist.ts
// Isolated R8 self-test fixture — not imported by production code.
export const badAuth = {
  persistSession: true,
  autoRefreshToken: true,
};
