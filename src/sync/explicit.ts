/**
 * Deterministic-id transactions (rec:<rule>:<date>) that the user is explicitly bringing back, e.g. from a JSON
 * backup or a legacy-data import. The sync layer uploads these as real upserts and clears their tombstones, instead
 * of treating them as auto-posts that must be skipped if the user deleted them before.
 * Kept in its own module so the store can mark ids without importing the sync engine.
 */
const explicit = new Set<string>();

export function markExplicitRestores(ids: Iterable<string>): void {
  for (const id of ids) if (id.startsWith('rec:')) explicit.add(id);
}

/** True (and forgets the id) if it was marked as an explicit restore. */
export function takeExplicitRestore(id: string): boolean {
  return explicit.delete(id);
}

export function clearExplicitRestores(): void {
  explicit.clear();
}
