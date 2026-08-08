// @r8-path: apps/storefront/src/r8-fixture-a11y.tsx
// Isolated R8 self-test fixture for accessibility skill examples — not production.
export function BadForm() {
  return <input type="text" name="email" />;
}
