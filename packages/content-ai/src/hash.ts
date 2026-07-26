/** Stable FNV-1a style hash for provenance / cache keys (no crypto dependency). */
export function hashSourcePayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  let h = 2166136261;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
