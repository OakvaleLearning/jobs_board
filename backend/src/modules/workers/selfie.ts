/**
 * Storage-key helper for the server-side blurred selfie variant. The blurred
 * thumbnail lives next to the original at `${storageKey}-blur` and is what browse
 * serves to employers who have not unlocked a worker (see CLAUDE.md §1 privacy
 * posture). Centralised here so the document-processing queue, browse search, and
 * the backfill script all agree on the key.
 */
export function blurredKeyFor(storageKey: string): string {
  return `${storageKey}-blur`;
}
