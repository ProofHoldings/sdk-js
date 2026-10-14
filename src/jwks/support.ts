/**
 * The two helpers `keyset.ts` imports. They live here, not in `types.ts`, because `keyset.ts` is a
 * lockstep copy of `packages/delegation-verifier/src/keyset.ts` and imports them under the same
 * names that package gives them.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** What a key-set merge can report. `store_error` belongs to the verifier's persistence, which this SDK has none of. */
export type JwksEventType =
  | 'tombstone_pending'
  | 'tombstone_applied'
  | 'tombstone_for_live_key'
  | 'window_narrowing_pending'
  | 'window_narrowing_applied'
  | 'window_widening_rejected'
  | 'key_material_changed'
  | 'kid_vanished'
  | 'store_error';
