/**
 * The issuer's key set as offline verification holds it — the I/O half around `keyset.ts`, which
 * owns the rules. Mirrors `packages/delegation-verifier/src/jwks.ts`, minus persistence: this SDK
 * keeps tombstones in memory only.
 *
 * Replaces jose's `createRemoteJWKSet`, which hid the fetch time and the registry's own JWK members
 * and so could enforce neither tombstones, windows nor staleness. The behaviours it supplied are
 * kept: a 10-minute reuse window, one forced refetch per 30 s for an unknown `kid`, one fetch in
 * flight at a time. What it did not do, and this does:
 *
 *   - A fetch is MERGED into what the verifier knows (`mergeFetchedDocument`), never swapped in.
 *   - A failed refetch does not discard the cache. Within `maxJwksAgeMs` its CONFIRMED keys keep
 *     answering; beyond it the answer is `stale` — except an applied tombstone, which is `revoked`
 *     at any age. A set never fetched has nothing to fall back on and stays `unavailable`.
 *   - A failed refetch of a cached set is retried at most once per cooldown, so an outage does not
 *     turn every verification into an outbound request.
 *   - Age is measured on a monotonic clock; claim checks use the wall clock.
 */

import { importJWK, type JWK, type KeyLike } from 'jose';

import { readCapped, type HttpClient } from '../http.js';
import {
  emptyKeySetState,
  isRegistryLive,
  mergeFetchedDocument,
  selectKeys,
  withConfirmedKeysOnly,
  withoutTombstones,
} from './keyset.js';
import type { KeyFamily, KeyRecord, KeySetEvent, KeySetState } from './keyset.js';
import { isRecord } from './support.js';

export const SUPPORTED_ALGORITHMS = ['RS256', 'ES256'] as const;
export type SupportedAlgorithm = (typeof SUPPORTED_ALGORITHMS)[number];

/** How long a `kid` miss — or a failed refetch of a cached set — suppresses further fetches. */
export const KEY_MISS_COOLDOWN_MS = 30_000;
/** How long a fetched key set is reused without refetching (jose's default, kept). */
export const KEY_SET_TTL_MS = 10 * 60_000;
/** Default `maxJwksAgeMs`. */
export const DEFAULT_MAX_JWKS_AGE_MS = 24 * 60 * 60_000;
/** Largest accepted `maxJwksAgeMs` — below the issuer's ~30-day lead on its next key. */
export const MAX_JWKS_AGE_CAP_MS = 25 * 24 * 60 * 60_000;

const JWKS_TIMEOUT_MS = 5_000;
/** A key set is kilobytes; anything larger is not one. */
const MAX_JWKS_BYTES = 512 * 1024;

export interface JwksClock {
  monotonicMs(): number;
  wallMs(): number;
}

const systemClock: JwksClock = {
  monotonicMs: () => performance.now(),
  wallMs: () => Date.now(),
};

let clock: JwksClock = systemClock;
let eventListener: ((event: KeySetEvent) => void) | null = null;

/** Test seam — replaces both clocks; `null` restores the system clocks. Not exported from the package. */
export function setJwksClockForTests(replacement: JwksClock | null): void {
  clock = replacement ?? systemClock;
}

/** Test seam — receives every key-set event; `null` detaches. Not exported from the package. */
export function setJwksEventListenerForTests(listener: ((event: KeySetEvent) => void) | null): void {
  eventListener = listener;
}

export function nowWallMs(): number {
  return clock.wallMs();
}

/** Throws unless `value` is a usable `maxJwksAgeMs`: whole milliseconds, 1 … 25 days. */
export function assertMaxJwksAgeMs(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > MAX_JWKS_AGE_CAP_MS) {
    throw new Error(
      `maxJwksAgeMs must be a whole number of milliseconds between 1 and ${MAX_JWKS_AGE_CAP_MS} (25 days)`,
    );
  }
}

export function isSupportedAlgorithm(alg: unknown): alg is SupportedAlgorithm {
  return typeof alg === 'string' && (SUPPORTED_ALGORITHMS as readonly string[]).includes(alg);
}

export interface KeyCandidate {
  key: KeyLike | Uint8Array;
  record: KeyRecord;
}

export type KeyResolution =
  | { kind: 'keys'; candidates: KeyCandidate[]; registryLive: boolean }
  | { kind: 'revoked'; kid: string }
  | { kind: 'wrong_purpose'; kid: string }
  | { kind: 'unknown' }
  | { kind: 'stale'; cacheAgeSeconds: number | null }
  | { kind: 'unavailable'; message: string };

type FetchOutcome = { ok: true } | { ok: false; message: string };

export class KeySetCache {
  private state: KeySetState = emptyKeySetState();
  /** Imported keys by key material + algorithm; `null` records a JWK that failed to import. */
  private readonly imported = new Map<string, KeyLike | Uint8Array | null>();
  private lastMissAt: number | null = null;
  private lastFailedAt: number | null = null;
  private inFlight: Promise<FetchOutcome> | null = null;
  private forceNext = false;

  constructor(
    private readonly http: HttpClient,
    private readonly jwksUri: string,
    private readonly maxJwksAgeMs: number,
  ) {}

  /**
   * The keys that may verify a token of `family` carrying `kid` — or why none may. Fetches when the
   * set is older than the TTL, after `forceRefresh()`, or once per cooldown when `kid` is unknown.
   */
  async resolve(kid: string | undefined, alg: SupportedAlgorithm, family: KeyFamily): Promise<KeyResolution> {
    const now = clock.monotonicMs();
    const forced = this.forceNext;
    if (!forced && this.isFresh(now)) {
      const cached = await this.resolveFromState(this.state, kid, family, alg);
      if (cached.kind !== 'unknown') return cached;
      if (this.lastMissAt !== null && now - this.lastMissAt < KEY_MISS_COOLDOWN_MS) {
        // The kid may have been published since the last refetch: "could not check", not "no such key".
        return { kind: 'unavailable', message: 'unknown key; the key set is refetched again after the cooldown' };
      }
    }

    const recentlyFailed =
      !forced &&
      this.state.fetchedAt !== null &&
      this.lastFailedAt !== null &&
      now - this.lastFailedAt < KEY_MISS_COOLDOWN_MS;
    const outcome: FetchOutcome = recentlyFailed
      ? { ok: false, message: 'JWKS refetch failed recently; it is retried after the cooldown' }
      : await this.runFetch();

    if (!outcome.ok) {
      if (this.state.fetchedAt === null) return { kind: 'unavailable', message: outcome.message };
      // An applied tombstone is final whatever the cache's age: no refetch could lift it.
      const known = selectKeys(this.state, kid, family);
      if (known.kind === 'revoked') return known;
      const age = this.cacheAgeMs(clock.monotonicMs());
      if (age > this.maxJwksAgeMs) {
        return { kind: 'stale', cacheAgeSeconds: Number.isFinite(age) ? Math.floor(age / 1000) : null };
      }
      const fallback = withConfirmedKeysOnly(this.state);
      // A no-kid token tries every candidate: if the fallback lost one, a signature matching none of
      // the rest may still be that key's — "could not check", not a forgery.
      if (kid === undefined && candidateCount(fallback, family) < candidateCount(this.state, family)) {
        return { kind: 'unavailable', message: outcome.message };
      }
      const cached = await this.resolveFromState(fallback, kid, family, alg);
      return cached.kind === 'unknown' ? { kind: 'unavailable', message: outcome.message } : cached;
    }

    const resolved = await this.resolveFromState(this.state, kid, family, alg);
    if (resolved.kind === 'unknown') this.lastMissAt = clock.monotonicMs();
    return resolved;
  }

  /** Make the next resolution refetch, ignoring the TTL and both cooldowns. Keeps what is known. */
  forceRefresh(): void {
    this.forceNext = true;
  }

  /** Forget every applied and pending tombstone — the documented manual reset. */
  clearTombstones(): void {
    this.state = withoutTombstones(this.state);
  }

  /** What the cache holds, for tests. */
  diagnostics(): { cacheAgeSeconds: number | null; registryLive: boolean; vanishedKids: string[] } {
    const age = this.cacheAgeMs(clock.monotonicMs());
    return {
      cacheAgeSeconds: Number.isFinite(age) ? Math.floor(age / 1000) : null,
      registryLive: isRegistryLive(this.state),
      vanishedKids: [...this.state.keys.values()]
        .filter((record) => record.vanished && record.kid)
        .map((record) => record.kid as string),
    };
  }

  private cacheAgeMs(now: number): number {
    if (this.state.fetchedAt === null || this.state.fetchedAtUntrusted) return Number.POSITIVE_INFINITY;
    return now - this.state.fetchedAt.monotonicMs;
  }

  private isFresh(now: number): boolean {
    return this.cacheAgeMs(now) < KEY_SET_TTL_MS;
  }

  /**
   * One fetch at a time. The shared promise RESOLVES to the outcome rather than recording it on
   * the instance, so a waiter cannot be handed the result of the NEXT fetch.
   */
  private runFetch(): Promise<FetchOutcome> {
    if (this.inFlight) return this.inFlight;
    this.forceNext = false;
    const running = (async (): Promise<FetchOutcome> => {
      let failure: string;
      try {
        const body = await this.fetchDocument();
        const merged = mergeFetchedDocument(this.state, body, {
          monotonicMs: clock.monotonicMs(),
          wallMs: clock.wallMs(),
        });
        for (const event of merged.events) emit(event);
        if (merged.accepted) {
          this.state = merged.state;
          this.lastFailedAt = null;
          return { ok: true };
        }
        failure = merged.events[0]?.message ?? 'JWKS refused';
      } catch (error) {
        failure = error instanceof Error && error.message ? error.message : 'JWKS fetch failed';
      }
      // Only a set with a cache to fall back on is held back; one never fetched is retried every call.
      if (this.state.fetchedAt !== null) this.lastFailedAt = clock.monotonicMs();
      return { ok: false, message: failure };
    })();
    this.inFlight = running;
    void running.finally(() => {
      if (this.inFlight === running) this.inFlight = null;
    });
    return running;
  }

  private async fetchDocument(): Promise<Record<string, unknown>> {
    const response = await this.http.fetchPublic(this.jwksUri, {
      timeoutMs: JWKS_TIMEOUT_MS,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`JWKS fetch failed with HTTP ${response.status}`);

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_JWKS_BYTES) {
      throw new Error('JWKS response is too large');
    }
    const raw = await readCapped(response, MAX_JWKS_BYTES);
    if (raw === null) throw new Error('JWKS response is too large');

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new Error('JWKS response is not JSON');
    }
    if (!isRecord(body) || !Array.isArray(body.keys)) throw new Error('JWKS response has no `keys` array');
    return body;
  }

  private async resolveFromState(
    state: KeySetState,
    kid: string | undefined,
    family: KeyFamily,
    alg: SupportedAlgorithm,
  ): Promise<KeyResolution> {
    const selection = selectKeys(state, kid, family);
    if (selection.kind !== 'candidates') return selection;
    const candidates: KeyCandidate[] = [];
    for (const record of selection.records) {
      const key = await this.importRecord(record, alg);
      if (key) candidates.push({ key, record });
    }
    if (candidates.length === 0) return { kind: 'unknown' };
    return { kind: 'keys', candidates, registryLive: isRegistryLive(state) };
  }

  private async importRecord(record: KeyRecord, alg: SupportedAlgorithm): Promise<KeyLike | Uint8Array | null> {
    // A key declared for another algorithm, or for anything but signatures (RFC 7517 §4.2, §4.3), is
    // not a candidate. Checked before the import cache, which is keyed by material and shared across kids.
    if (typeof record.jwk.alg === 'string' && record.jwk.alg !== alg) return null;
    const { use, key_ops: keyOps } = record.jwk;
    if (use !== undefined && use !== 'sig') return null;
    if (keyOps !== undefined && !(Array.isArray(keyOps) && keyOps.includes('verify'))) return null;
    const cacheKey = `${record.fingerprint}|${alg}`;
    if (this.imported.has(cacheKey)) return this.imported.get(cacheKey) ?? null;
    let key: KeyLike | Uint8Array | null;
    try {
      const { kty, crv, x, y, n, e } = record.jwk;
      const material = Object.fromEntries(
        Object.entries({ kty, crv, x, y, n, e }).filter(([, value]) => value !== undefined),
      ) as unknown as JWK;
      key = await importJWK(material, alg);
    } catch {
      key = null;
    }
    this.imported.set(cacheKey, key);
    return key;
  }
}

function candidateCount(state: KeySetState, family: KeyFamily): number {
  const selection = selectKeys(state, undefined, family);
  return selection.kind === 'candidates' ? selection.records.length : 0;
}

function emit(event: KeySetEvent): void {
  if (!eventListener) return;
  try {
    eventListener(event);
  } catch {
    // A throwing listener must not turn into a verification failure.
  }
}
