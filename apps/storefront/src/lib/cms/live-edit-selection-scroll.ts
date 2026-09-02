/**
 * Canvas click selection must not scroll the iframe.
 * Parent-driven `cms-selection` messages still call scrollCanvasToSelection.
 */
export function shouldScrollOnLocalCanvasSelection(): boolean {
  return false;
}
