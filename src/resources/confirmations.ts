import crypto from 'crypto';
import type { HttpClient } from '../http.js';
import { streamEndpoint, type StreamEvent, type StreamOptions } from '../streaming.js';
import { pollUntilComplete } from '../polling.js';
import { encryptMessage } from '../crypto/hitl-crypto.js';
import { ConfirmationDeniedError, ProofError } from '../errors.js';
import type { ApprovalLinkResponse, ConfirmAndWaitOptions, HitlKeysResponse } from '../types.js';

/**
 * A HITL confirmation as the API returns it (the OpenAPI `Confirmation`
 * component). The live frames of `stream()` are content-free signals; read the
 * full confirmation via `retrieve(id)` when one arrives.
 */
export interface Confirmation {
  id: string;
  hitl_id: string;
  /** The stored ciphertext envelope, echoed back verbatim — never the plaintext sentence. */
  message: string;
  /** A timeout is `denied` with `response.channel` `'system'` and `response.text` `'timeout'`; there is no `expired` status. */
  status: 'pending' | 'approved' | 'denied';
  /** The decision and its evidence; null while pending. */
  response?: {
    action: 'approve' | 'deny';
    /**
     * The approver's optional comment, encrypted by the approval page: a ciphertext envelope (JSON).
     * When `channel` is `'system'` no approver acted and this is the plaintext reason instead
     * (`'timeout'`, `'key_rotated'`, `'config_archived'`).
     */
    text?: string | null;
    channel?: string | null;
    at: string;
    /** The enrolled approver's Authorization that signed the decision; null when the owner decided. */
    authorization_id?: string | null;
    /** Who signed the decision: an enrolled approver, or the owner with the config key. Null for a system denial. */
    decided_by?: 'approver' | 'owner' | null;
    /** Key id (sha256 hex of the DER SPKI) of the key that signed the decision. */
    kid?: string | null;
    /** The signing key (SPKI PEM), stored with the decision so it verifies after a key rotation. */
    public_key?: string | null;
    /** The exact bytes signed: `decision.<id>.<action>.<link nonce>.<sha256 hex of text, or ->`. */
    signed_input?: string | null;
    /** RSASSA-PKCS1-v1_5 / SHA-256 signature over `signed_input`, base64. */
    signature?: string | null;
  } | null;
  timeout_at?: string | null;
  /** Signed proof of the decision (approval or denial), naming who decided; null while pending and for a system denial. */
  proof_token?: string | null;
  /** Every "Send again", oldest first, the last 50 kept. Absent from an API that predates it. */
  resends?: Array<{
    at: string;
    /** A dashboard session of the owner, or an API key (`api_key_id`). */
    actor: { kind: 'session' | 'api_key'; api_key_id: string | null };
    /** Each channel a fresh link went to; `recipient` is an authorization id or `'owner'`. */
    channels: Array<{ type: string; recipient: string }>;
  }>;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateConfirmationParams {
  hitl_id: string;
  message: string;
  [key: string]: unknown;
}

export interface ConfirmationListParams {
  /** A stored status, or `'expired'`: the confirmations that timed out (system denials for `'timeout'`, and pending rows past `timeout_at`). */
  status?: 'pending' | 'approved' | 'denied' | 'expired';
  /** Only this sub-account's confirmations (sent through its HITL configs or created by its keys). */
  profile_id?: string;
  limit?: number;
  page?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface ConfirmationListResponse {
  data: Confirmation[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

/** The `connected` frame of `confirmations.stream()`, written once when the connection opens. */
export interface ConfirmationStreamConnected {
  confirmation_id: string;
  status: Confirmation['status'];
}

/** The `update` frame of `confirmations.stream()`: a resolution signal, not the confirmation. */
export interface ConfirmationStreamUpdate {
  type: 'resolved';
  status: Confirmation['status'];
  resolved_at?: string;
}

export type ConfirmationStreamEvent = StreamEvent<'update', ConfirmationStreamConnected, ConfirmationStreamUpdate, Confirmation>;

const TERMINAL_STATES = ['approved', 'denied', 'expired'] as const;

/**
 * What `verifyDecisionSignature` found, checked in this order:
 * - `unsigned` — no decision yet, or one recorded without signed evidence (older, or made by the system), or evidence fields that are not strings;
 * - `key_mismatch` — the key you passed is not the key the decision carries;
 * - `input_mismatch` — `signed_input` does not name this confirmation, its action and its comment, or `status` is not the signed action's;
 * - `signature_invalid` — the signature is not base64, or does not verify under your key;
 * - `verified` — it does.
 */
export type DecisionSignatureOutcome = 'verified' | 'unsigned' | 'key_mismatch' | 'input_mismatch' | 'signature_invalid';

/** The first DER element (a SEQUENCE) of `der`, whatever follows it ignored, as OpenSSL reads a key; null if there is none. */
function firstDerElement(der: Buffer): Buffer | null {
  if (der.length < 2 || der[0] !== 0x30) return null;
  let length = der[1];
  let start = 2;
  if (length & 0x80) {
    const n = length & 0x7f;
    if (n < 1 || n > 4 || der.length < 2 + n) return null;
    length = 0;
    for (let i = 0; i < n; i++) length = length * 256 + der[2 + i];
    start = 2 + n;
  }
  return start + length <= der.length ? der.subarray(0, start + length) : null;
}

/**
 * The RSA key in the first PEM block of `text`, read by the shared rule rather than by createPublicKey (which would
 * also read a certificate, or a block after the first): label `PUBLIC KEY` (SPKI) or `RSA PUBLIC KEY` (PKCS#1), a
 * base64 body, and a first DER element that is an rsaEncryption key re-encoding to itself, with a 4096- to 16384-bit
 * modulus and an odd public exponent from 3 to 2^31 - 1. Null for anything else.
 */
function rsaPublicKeyFromPem(text: string): crypto.KeyObject | null {
  const block = /-----BEGIN ([^\n-]*)-----([\s\S]*?)-----END \1-----/.exec(text);
  const type = block?.[1] === 'PUBLIC KEY' ? 'spki' : block?.[1] === 'RSA PUBLIC KEY' ? 'pkcs1' : null;
  const body = block?.[2].replace(/[ \t\r\n]/g, '') ?? '';
  if (!type || !/^[A-Za-z0-9+/]*={0,2}$/.test(body) || body.length % 4 !== 0) return null;
  const element = firstDerElement(Buffer.from(body, 'base64'));
  if (!element) return null;
  try {
    const key = crypto.createPublicKey({ key: element, format: 'der', type });
    if (key.asymmetricKeyType !== 'rsa' || !key.export({ format: 'der', type }).equals(element)) return null;
    // A key every SDK verifies with: a 4096- to 16384-bit modulus (OpenSSL, which Node uses, refuses larger; Go would
    // not) and an odd exponent from 3 to 2^31 - 1 (Go's crypto/rsa refuses larger).
    const bits = key.asymmetricKeyDetails?.modulusLength ?? 0;
    const e = key.asymmetricKeyDetails?.publicExponent ?? 0n;
    return bits >= 4096 && bits <= 16384 && e >= 3n && e <= 2147483647n && e % 2n === 1n ? key : null;
  } catch {
    return null;
  }
}

export class Confirmations {
  constructor(private readonly http: HttpClient) {}

  /** Create a new confirmation request */
  create(params: CreateConfirmationParams): Promise<Confirmation> {
    return this.http.post<Confirmation>('/api/v1/confirmations', params);
  }

  /** Get a confirmation by ID */
  retrieve(id: string): Promise<Confirmation> {
    return this.http.get<Confirmation>(`/api/v1/confirmations/${encodeURIComponent(id)}`);
  }

  /** List confirmations with optional filters */
  list(params?: ConfirmationListParams): Promise<ConfirmationListResponse> {
    return this.http.get<ConfirmationListResponse>('/api/v1/confirmations', params);
  }

  /**
   * Get the HMAC approval link for a pending confirmation — the HITL config owner's link, decided
   * with the config's own key. It is not an approver's link: an approver's goes only to their own
   * channel, and `POST /api/v1/confirmations/{id}/resend` ("Send again") is what sends it there again.
   * Every call returns the same owner link until "Send again" reaches the owner; "Send again" replaces
   * it, and the next call returns a new one.
   */
  approvalLink(id: string): Promise<ApprovalLinkResponse> {
    return this.http.post<ApprovalLinkResponse>(
      `/api/v1/confirmations/${encodeURIComponent(id)}/approval-link`,
    );
  }

  /**
   * Check the decider's own signature on a confirmation's decision, locally (no request is made).
   *
   * The proof token is Proof's signed word about the decision; this checks the approver's, against
   * `publicKey` — the key YOU hold (SPKI or PKCS#1 PEM): for an owner decision, your HITL config's
   * own public key; for an approver, the key you recorded from `hitl.getApproverKeys()` when they
   * enrolled. The key the response carries must be that key; `signed_input` must be
   * `decision.<id>.<action>.<nonce>.<sha256 hex of response.text, or ->` for this confirmation's
   * `id`, its `response.action` and its `response.text`, and `status` must be the signed action's
   * (`approved` for `approve`, `denied` for `deny`) — so a valid signature copied from another
   * decision, or a status that contradicts it, does not pass; and `signature` must be base64 (either
   * alphabet; padding and line breaks optional) of an RSASSA-PKCS1-v1_5 / SHA-256 signature that verifies under your key. Compare
   * `confirmation.id` with the id you asked for yourself. The key is required because a key the
   * server sent is no evidence against the server. Never throws for anything inside the
   * confirmation; the shared rule is `sdks/shared/fixtures/decision_signature/README.md`.
   */
  verifyDecisionSignature(confirmation: Confirmation, publicKey: string): DecisionSignatureOutcome {
    const fields = confirmation as unknown as Record<string, unknown>;
    const r = fields.response;
    if (typeof r !== 'object' || r === null || Array.isArray(r)) return 'unsigned';
    const { public_key: carried, signed_input: signedInput, signature, action, text } = r as Record<string, unknown>;
    if (typeof carried !== 'string' || typeof signedInput !== 'string' || typeof signature !== 'string') return 'unsigned';
    const bare = (pem: string) => pem.replace(/[ \t\r\n]/g, '');
    if (!bare(carried) || !signedInput || !signature) return 'unsigned';
    const callerKey = typeof publicKey === 'string' ? bare(publicKey) : '';
    if (!callerKey || callerKey !== bare(carried)) return 'key_mismatch';

    const { id, status } = fields;
    if (typeof id !== 'string' || typeof action !== 'string' || (text != null && typeof text !== 'string')) return 'input_mismatch';
    const signedStatus = action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : null;
    if (signedStatus === null || status !== signedStatus) return 'input_mismatch';
    const nonce = signedInput.split('.')[3] ?? '';
    const digest = text ? crypto.createHash('sha256').update(text, 'utf8').digest('hex') : '-';
    if (signedInput !== `decision.${id}.${action}.${nonce}.${digest}`) return 'input_mismatch';

    const b64 = signature.replace(/[ \t\r\n]/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/={1,2}$/, '');
    if (!/^[A-Za-z0-9+/]*$/.test(b64) || b64.length % 4 === 1) return 'signature_invalid';
    const raw = Buffer.from(b64, 'base64');
    const key = rsaPublicKeyFromPem(publicKey);
    if (!key) return 'signature_invalid';
    try {
      const ok = crypto.verify('sha256', Buffer.from(signedInput, 'utf8'), { key, padding: crypto.constants.RSA_PKCS1_PADDING }, raw);
      return ok ? 'verified' : 'signature_invalid';
    } catch {
      return 'signature_invalid';
    }
  }

  /**
   * Poll a confirmation until it reaches a terminal state (approved/denied/expired).
   * Mirrors `verifications.waitForCompletion`. When `throwOnDenial` is set and the
   * confirmation is denied, throws `ConfirmationDeniedError`; otherwise returns the
   * terminal confirmation.
   */
  async waitForResolution(id: string, options?: ConfirmAndWaitOptions): Promise<Confirmation> {
    const confirmation = await pollUntilComplete(
      () => this.retrieve(id),
      TERMINAL_STATES,
      `Confirmation ${id}`,
      options,
    );
    if (options?.throwOnDenial && confirmation.status === 'denied') {
      throw new ConfirmationDeniedError(id, confirmation.status);
    }
    return confirmation;
  }

  /**
   * Encrypt a message with the HITL config's public key, create a confirmation,
   * and poll until the approver resolves it — a one-call CI/CD approval gate.
   *
   * Uses the v1 (owner-key) envelope. If the HITL config has enrolled approvers,
   * they cannot decrypt a v1 envelope (see docs/ENCRYPTION_ENVELOPE.md §2.5);
   * v2 multi-recipient support is a planned follow-up.
   *
   * `throwOnDenial` defaults to `true` here (gate semantics): any terminal state
   * other than `approved` — `denied`, including a timeout (the server records an
   * unanswered confirmation as a system denial, `response.channel === 'system'`) —
   * throws `ConfirmationDeniedError` rather than returning silently, so a CI/CD
   * gate cannot pass on an un-approved confirmation. Pass `throwOnDenial: false`
   * to receive the terminal confirmation and inspect `status` yourself.
   *
   * Throws `ProofError` with code `hitl_public_key_unreadable`, creating nothing, when the config's
   * stored public key cannot be read (the keys read answers `public_key: null`).
   */
  async createAndWait(
    hitlId: string,
    message: string,
    options?: ConfirmAndWaitOptions,
  ): Promise<Confirmation> {
    const keys = await this.http.get<HitlKeysResponse>(
      `/api/v1/hitl/${encodeURIComponent(hitlId)}/keys`,
    );
    // The API answers `public_key: null` when the stored key material cannot be read (the 1.x type
    // still says `string`; sdks/shared/NEXT_MAJOR.md). Nothing can be sealed to it, so nothing is created.
    if (!keys.public_key) {
      throw new ProofError('this HITL config has no readable public key', 'hitl_public_key_unreadable', 0);
    }
    const envelope = encryptMessage(message, keys.public_key, hitlId);
    const created = await this.create({
      hitl_id: hitlId,
      message: JSON.stringify(envelope),
      ...(options?.proofExpiryDays !== undefined ? { proof_expiry_days: options.proofExpiryDays } : {}),
    });
    const resolved = await this.waitForResolution(created.id, { ...options, throwOnDenial: false });
    if ((options?.throwOnDenial ?? true) && resolved.status !== 'approved') {
      throw new ConfirmationDeniedError(created.id, resolved.status);
    }
    return resolved;
  }

  /**
   * Stream confirmation status changes via Server-Sent Events: a `connected`
   * signal, then `update` signals, neither carrying the confirmation. When SSE is unavailable it falls back to polling
   * `retrieve(id)` and yields the confirmation as `poll` / `terminal` events.
   */
  stream(id: string, options?: StreamOptions): AsyncIterable<ConfirmationStreamEvent> {
    return streamEndpoint<Confirmation, ConfirmationStreamEvent>(this.http, {
      path: `/api/v1/confirmations/${encodeURIComponent(id)}/events`,
      retrieve: () => this.retrieve(id),
      terminalStates: TERMINAL_STATES,
      label: `Confirmation ${id}`,
    }, options);
  }
}
