import { inflateSync } from 'node:zlib';

import {
  compactVerify,
  decodeJwt,
  decodeProtectedHeader,
  jwtVerify,
  errors as joseErrors,
  type JWTVerifyOptions,
} from 'jose';
import { readCapped, type HttpClient } from '../http.js';
import {
  DEFAULT_MAX_JWKS_AGE_MS,
  KeySetCache,
  assertMaxJwksAgeMs,
  isSupportedAlgorithm,
  nowWallMs,
  type KeyCandidate,
} from '../jwks/key-set-cache.js';
import { checkKeyPolicy, type KeyFamily } from '../jwks/keyset.js';
import type {
  ProofStatus,
  ProofValidation,
  RevocationList,
  RevokeResponse,
  OfflineFailureReason,
  OfflineVerificationOptions,
  OfflineVerificationResult,
} from '../types.js';

/** Clock skew tolerated on both the proof token and the status list, in seconds. */
const CLOCK_TOLERANCE_SECONDS = 5;

/** The only `iss` a proof token may carry. */
const PROOF_TOKEN_ISSUER = 'proof.holdings';

/** Ceiling on a fetched status list, mirroring `@proof-holdings/delegation-verifier`. */
const MAX_STATUS_LIST_BYTES = 512 * 1024;

const STATUS_LIST_TIMEOUT_MS = 5000;

/** The draft's 2-bit slot values (draft-ietf-oauth-status-list). */
const SLOT_VALID = 0b00;
const SLOT_REVOKED = 0b01;
const SLOT_SUSPENDED = 0b10;

interface StatusListClaim {
  idx: number;
  uri: string;
}

type StatusOutcome =
  | { state: 'valid' }
  | { state: 'revoked' }
  | { state: 'suspended' }
  | { state: 'unavailable'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The token's own slot reference, or null when it carries none. */
function readStatusListClaim(claims: Record<string, unknown>): StatusListClaim | null {
  const status = claims.status;
  if (!isRecord(status)) return null;
  const statusList = status.status_list;
  if (!isRecord(statusList)) return null;
  const { idx, uri } = statusList;
  if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0) return null;
  if (typeof uri !== 'string' || uri.length === 0) return null;
  return { idx, uri };
}

/**
 * Read one slot out of a decoded list: lowest index in the least significant bits, `bits`
 * statuses per byte — the draft's byte order, pinned across the four SDKs and the issuer by
 * `sdks/shared/fixtures/status_list_slots.json`.
 *
 * `null` means the array does not reach that index, which is "no answer", never "valid".
 */
function readStatusSlot(bytes: Uint8Array, index: number, bits: number): number | null {
  if (!Number.isInteger(index) || index < 0) return null;
  if (bits !== 1 && bits !== 2 && bits !== 4 && bits !== 8) return null;
  const perByte = 8 / bits;
  const byteIndex = Math.floor(index / perByte);
  if (byteIndex >= bytes.length) return null;
  return (bytes[byteIndex] >> ((index % perByte) * bits)) & ((1 << bits) - 1);
}

/**
 * Inflate the zlib-wrapped DEFLATE payload the issuer publishes.
 *
 * `node:zlib` rather than the web `DecompressionStream`: this SDK already targets Node (it uses
 * the `crypto` module and `Buffer` for the HITL envelope, and its tsconfig carries no DOM lib),
 * so a web-stream version would buy no portability and cost a type it cannot name.
 */
function inflate(bytes: Uint8Array): Uint8Array {
  return inflateSync(bytes);
}

/**
 * Why a token whose signature verified failed its own claims: `expired`, or `invalid` for every
 * other claim (`iss`, `typ`, `sub`, a missing `exp`).
 */
function claimFailureReason(error: unknown): OfflineFailureReason {
  return error instanceof joseErrors.JWTExpired ? 'expired' : 'invalid';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type KeyCheck =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; reason: OfflineFailureReason; message: string; cacheAgeSeconds?: number | null };

export class Proofs {
  private readonly keySet: KeySetCache;
  /** The last status list read, reusable until the issuer's own `ttl`/`exp` runs out. */
  private statusListCache: { uri: string; bytes: Uint8Array; bits: number; expiresAtMs: number } | null =
    null;

  constructor(
    private readonly http: HttpClient,
    options: { maxJwksAgeMs?: number } = {},
  ) {
    const maxJwksAgeMs = options.maxJwksAgeMs ?? DEFAULT_MAX_JWKS_AGE_MS;
    assertMaxJwksAgeMs(maxJwksAgeMs);
    this.keySet = new KeySetCache(http, `${http.baseUrl}/.well-known/jwks.json`, maxJwksAgeMs);
  }

  /**
   * Validate a proof token online (checks revocation status).
   *
   * Pass `identifier` to also bind the proof to the identifier you expect it to be about: a
   * proof about anything else answers `valid: false` with reason `identifier_mismatch`, and a
   * proof of an encrypted decision — whose hash is over ciphertext — answers
   * `identifier_unverifiable`. For a proof about a verified identifier any format is accepted
   * and canonicalized as it was at issuance; a proof of an approval decision binds only on the
   * exact recipient value it was issued for.
   */
  validate(proofToken: string, identifier?: string): Promise<ProofValidation> {
    return this.http.post<ProofValidation>('/api/v1/proofs/validate', {
      proof_token: proofToken,
      ...(identifier ? { identifier } : {}),
    });
  }

  /**
   * Revoke a proof by public handle (`ph_ctl_*`/`ph_dlg_*`) or verification id.
   *
   * Revoking a PROOF does not withdraw the asset, consent or delegation it is about — those have
   * their own surfaces.
   */
  revoke(id: string, reason?: string): Promise<RevokeResponse> {
    return this.http.post<RevokeResponse>(`/api/v1/proofs/${encodeURIComponent(id)}/revoke`, {
      ...(reason ? { reason } : {}),
    });
  }

  /** Get the status of a proof by public handle (`ph_ctl_*`/`ph_dlg_*`) or verification id. A live proof reads `active`. */
  status(id: string): Promise<ProofStatus> {
    return this.http.get<ProofStatus>(`/api/v1/proofs/${encodeURIComponent(id)}/status`);
  }

  /** Get the revocation list */
  listRevoked(): Promise<RevocationList> {
    return this.http.get<RevocationList>('/api/v1/proofs/revoked');
  }

  /**
   * Verify a proof token without calling the Proof API with your key.
   *
   * Two public documents are read, both cacheable and neither revealing which proof you are
   * checking: the JWKS (for the signature) and the issuer's Token Status List (for revocation).
   *
   * By default the proof's status-list slot IS checked, so a revoked or suspended proof answers
   * `valid: false` with `reason` `revoked`/`suspended`. A list that cannot be read — unreachable,
   * failing its own checks, or not covering this slot — answers `status_unavailable`: the refusal
   * to guess, not a claim that the proof is withdrawn. A token carrying no slot at all stays
   * valid with `revocation_checked: false`, which is exactly what the issuer's own
   * `POST /proofs/validate` answers for it.
   *
   * Pass `{ checkRevocation: false }` to check the signature alone; the result then reports
   * `revocation_checked: false`.
   *
   * The key set follows the issuer's key-rotation rules (`sdks/shared/fixtures/jwks_rotation/`): a
   * key the issuer revoked answers `key_revoked` with a `pull_hint` naming where a re-issued token
   * can be fetched; a key set that could not be refreshed for longer than `maxJwksAgeMs` answers
   * `jwks_stale` with its `cache_age_seconds`; a key of another family, a token signed outside its
   * key's window or living longer than the key allows answer `wrong_key_purpose`,
   * `outside_key_window` and `token_lifetime_exceeded`; a `kid` the issuer does not publish answers
   * `unknown_key`. A key set that could not be read at all answers `status_unavailable`.
   */
  async verifyOffline(
    token: string,
    options?: OfflineVerificationOptions,
  ): Promise<OfflineVerificationResult> {
    let unverified: Record<string, unknown>;
    try {
      unverified = decodeJwt(token) as Record<string, unknown>;
    } catch (error) {
      return { valid: false, error: errorMessage(error), reason: 'invalid', revocation_checked: false };
    }
    // The family only selects which key may answer; the signature still has to match that key.
    const family: KeyFamily = unverified.token_type === 'delegation' ? 'delegation' : 'proof';

    let checked: KeyCheck;
    try {
      checked = await this.verifyAgainstKeySet(token, family, { issuer: PROOF_TOKEN_ISSUER });
    } catch (error) {
      checked = { ok: false, reason: 'invalid', message: errorMessage(error) };
    }
    if (!checked.ok) {
      const handle = family === 'delegation' ? unverified.sub : unverified.proof_id;
      return {
        valid: false,
        error: checked.message,
        reason: checked.reason,
        revocation_checked: false,
        ...(checked.reason === 'key_revoked'
          ? {
              pull_hint: {
                issuer_origin: new URL(this.http.baseUrl).origin,
                handle: typeof handle === 'string' ? handle : null,
              },
            }
          : {}),
        ...(checked.reason === 'jwks_stale' ? { cache_age_seconds: checked.cacheAgeSeconds ?? null } : {}),
      };
    }
    const claims = checked.payload;

    const verified: OfflineVerificationResult = {
      valid: true,
      payload: {
        iss: claims.iss as string,
        sub: claims.sub as string,
        iat: claims.iat as number,
        exp: claims.exp as number,
        type: claims.type as string,
        channel: claims.channel as string,
        identifier_hash: claims.identifier_hash as string,
        verified_at: claims.verified_at as string,
        user_id: claims.user_id as string,
        decision: claims.decision as 'approve' | 'deny' | undefined,
      },
      revocation_checked: false,
    };

    if (options?.checkRevocation === false) return verified;

    const claim = readStatusListClaim(claims);
    if (!claim) return verified;

    const outcome = await this.checkStatusList(claim);
    switch (outcome.state) {
      case 'valid':
        return { ...verified, revocation_checked: true };
      case 'revoked':
      case 'suspended':
        return {
          valid: false,
          payload: verified.payload,
          reason: outcome.state as OfflineFailureReason,
          error: `This proof is ${outcome.state}`,
          revocation_checked: true,
        };
      case 'unavailable':
        return {
          valid: false,
          payload: verified.payload,
          reason: 'status_unavailable',
          error: outcome.message,
          revocation_checked: false,
        };
    }
  }

  /**
   * Make the next verification refetch the key set, ignoring its 10-minute reuse window and the
   * 30-second cooldowns, and drop the cached status list. A successful refetch resets the key
   * set's age — the remedy a `jwks_stale` answer names. What the verifier knows is kept: key
   * confirmations and tombstones survive (`clearTombstones()` is the separate, deliberate reset).
   */
  refreshJWKS(): void {
    this.keySet.forceRefresh();
    this.statusListCache = null;
  }

  /**
   * Forget every revoked-key tombstone this client has applied or is waiting to confirm. They are
   * held in memory only — a restart forgets them too — and otherwise kept until a year after the
   * revocation, whatever later key sets say.
   */
  clearTombstones(): void {
    this.keySet.clearTombstones();
  }

  /**
   * The signature against the issuer's key set, then the window and lifetime of the key that made
   * it, then the token's own claims — so a forgery reads as a bad signature, never as a policy
   * violation of a key it did not come from, and a policy violation outranks an expired token.
   */
  private async verifyAgainstKeySet(
    token: string,
    family: KeyFamily,
    claimOptions: JWTVerifyOptions,
  ): Promise<KeyCheck> {
    let alg: unknown;
    let kid: string | undefined;
    try {
      const header = decodeProtectedHeader(token);
      alg = header.alg;
      kid = typeof header.kid === 'string' ? header.kid : undefined;
    } catch (error) {
      return { ok: false, reason: 'invalid', message: errorMessage(error) };
    }
    // Chosen from the allow-list, never trusted from the header: `none` and HMAC die here.
    if (!isSupportedAlgorithm(alg)) {
      return { ok: false, reason: 'invalid', message: `token algorithm ${String(alg)} is not accepted` };
    }

    const resolution = await this.keySet.resolve(kid, alg, family);
    switch (resolution.kind) {
      case 'unavailable':
        return { ok: false, reason: 'status_unavailable', message: resolution.message };
      case 'stale':
        return {
          ok: false,
          reason: 'jwks_stale',
          message:
            'the issuer key set could not be refreshed and the cached copy is older than maxJwksAgeMs; call refreshJWKS() once the issuer is reachable',
          cacheAgeSeconds: resolution.cacheAgeSeconds,
        };
      case 'revoked':
        return { ok: false, reason: 'key_revoked', message: `the issuer revoked signing key "${resolution.kid}"` };
      case 'wrong_purpose':
        return {
          ok: false,
          reason: 'wrong_key_purpose',
          message: `signing key "${resolution.kid}" is not a ${family} key`,
        };
      case 'unknown':
        return { ok: false, reason: 'unknown_key', message: 'no key in the issuer key set matches this token' };
      case 'keys':
        break;
    }

    let matched: KeyCandidate | null = null;
    for (const candidate of resolution.candidates) {
      try {
        await compactVerify(token, candidate.key, { algorithms: [alg] });
        matched = candidate;
        break;
      } catch {
        // Not this key; a token matching none of them is a bad signature.
      }
    }
    if (!matched) return { ok: false, reason: 'invalid', message: 'signature verification failed' };

    const signed = decodeJwt(token);
    const violation = checkKeyPolicy(matched.record, { iat: signed.iat, exp: signed.exp }, resolution.registryLive);
    if (violation === 'outside_key_window') {
      return { ok: false, reason: violation, message: "token iat lies outside the signing key's window" };
    }
    if (violation === 'token_lifetime_exceeded') {
      return {
        ok: false,
        reason: violation,
        message: "token exp lies beyond iat plus the signing key's max_token_lifetime",
      };
    }

    try {
      const { payload } = await jwtVerify(token, matched.key, {
        ...claimOptions,
        algorithms: [alg],
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
        currentDate: new Date(nowWallMs()),
      });
      return { ok: true, payload: payload as Record<string, unknown> };
    } catch (error) {
      return { ok: false, reason: claimFailureReason(error), message: errorMessage(error) };
    }
  }

  /** Resolve one token's slot against the issuer's signed status list. */
  private async checkStatusList(claim: StatusListClaim): Promise<StatusOutcome> {
    let uri: URL;
    try {
      uri = new URL(claim.uri);
    } catch {
      return { state: 'unavailable', message: 'status list uri is not a valid URL' };
    }

    // The uri arrives INSIDE the artifact being verified, so fetching whatever it names would
    // hand a forged token both the status authority and a request from your network. Only the
    // origin this client is configured against is honoured.
    const configuredOrigin = new URL(this.http.baseUrl).origin;
    if (uri.origin !== configuredOrigin) {
      return {
        state: 'unavailable',
        message: `status list uri origin ${uri.origin} is not the configured issuer origin ${configuredOrigin}`,
      };
    }

    const list = await this.loadStatusList(uri.toString());
    if ('message' in list) return { state: 'unavailable', message: list.message };

    const slot = readStatusSlot(list.bytes, claim.idx, list.bits);
    if (slot === null) {
      return { state: 'unavailable', message: `status list has no slot ${claim.idx}` };
    }
    if (slot === SLOT_REVOKED) return { state: 'revoked' };
    if (slot === SLOT_SUSPENDED) return { state: 'suspended' };
    if (slot === SLOT_VALID) return { state: 'valid' };
    // `0b11` is reserved for application-specific use by the draft; the issuer packs it when it
    // could not resolve a delegation's control proof. It is an absence of an answer.
    return { state: 'unavailable', message: `status list slot carries unknown status ${slot}` };
  }

  private async loadStatusList(
    uri: string,
  ): Promise<{ bytes: Uint8Array; bits: number } | { message: string }> {
    const cached = this.statusListCache;
    if (cached && cached.uri === uri && cached.expiresAtMs > nowWallMs()) {
      return { bytes: cached.bytes, bits: cached.bits };
    }

    let response: Response;
    let read: string | null;
    try {
      response = await this.http.fetchPublic(uri, {
        timeoutMs: STATUS_LIST_TIMEOUT_MS,
        headers: { accept: 'application/statuslist+jwt, application/jwt, text/plain' },
      });

      if (response.status !== 200) {
        return { message: `status list fetch failed with HTTP ${response.status}` };
      }

      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_STATUS_LIST_BYTES) {
        return { message: 'status list response is too large' };
      }

      // Inside the SAME try as the fetch: a body that breaks AFTER the headers, or a deadline
      // that lands mid-read, rejects here — and the other three SDKs answer that with
      // `status_unavailable` rather than throwing out of verifyOffline.
      read = await readCapped(response, MAX_STATUS_LIST_BYTES);
    } catch (error) {
      return {
        message: `status list fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    if (read === null) {
      return { message: 'status list response is too large' };
    }
    const listToken = read.trim();

    // The list is held to its own key family (`status-list`) and that key's window. `typ` separates
    // a status list from every other token this issuer signs; `subject` is what stops a valid list
    // being replayed in place of another one; `exp` is REQUIRED because a freshness channel without
    // one would be honoured forever. `iss` is deliberately not required — the issuer does not put
    // one in the list.
    let checked: KeyCheck;
    try {
      checked = await this.verifyAgainstKeySet(listToken, 'status-list', {
        typ: 'statuslist+jwt',
        subject: uri,
        requiredClaims: ['exp'],
      });
    } catch (error) {
      checked = { ok: false, reason: 'invalid', message: errorMessage(error) };
    }
    if (!checked.ok) return { message: `status list did not verify: ${checked.message}` };
    const payload = checked.payload;

    const statusList = payload.status_list;
    if (!isRecord(statusList) || typeof statusList.lst !== 'string') {
      return { message: 'status list payload has no `lst`' };
    }
    const bits = typeof statusList.bits === 'number' ? statusList.bits : 2;

    let bytes: Uint8Array;
    try {
      bytes = inflate(Buffer.from(statusList.lst, 'base64url'));
    } catch (error) {
      return {
        message: `status list payload could not be decompressed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    // Honour the shorter of the issuer's published `ttl` and the token's own `exp`: `ttl` is the
    // window it asks consumers to cache for (55s today), `exp` the point past which the list must
    // not be used at all.
    const expSeconds = typeof payload.exp === 'number' ? payload.exp : 0;
    const ttlSeconds = typeof payload.ttl === 'number' ? payload.ttl : 0;
    const expiresAtMs = Math.min(
      expSeconds * 1000,
      ttlSeconds > 0 ? nowWallMs() + ttlSeconds * 1000 : Number.POSITIVE_INFINITY,
    );
    this.statusListCache = { uri, bytes, bits, expiresAtMs };

    return { bytes, bits };
  }
}
