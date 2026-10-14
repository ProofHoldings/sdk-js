import type { HttpClient } from '../http.js';
import { streamEndpoint, type StreamEvent, type StreamOptions } from '../streaming.js';
import { pollUntilComplete } from '../polling.js';
import { encryptMessage } from '../crypto/hitl-crypto.js';
import { ConfirmationDeniedError } from '../errors.js';
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
  /** The approver's decision; null while pending. */
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
    /** The enrolled approver's Authorization that resolved it, verified server-side. */
    authorization_id?: string | null;
  } | null;
  timeout_at?: string | null;
  /** Signed proof of an approver's decision (approval or denial); null while pending and for a system denial. */
  proof_token?: string | null;
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

  /** Generate a fresh HMAC approval link for a pending confirmation */
  approvalLink(id: string): Promise<ApprovalLinkResponse> {
    return this.http.post<ApprovalLinkResponse>(
      `/api/v1/confirmations/${encodeURIComponent(id)}/approval-link`,
    );
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
   */
  async createAndWait(
    hitlId: string,
    message: string,
    options?: ConfirmAndWaitOptions,
  ): Promise<Confirmation> {
    const keys = await this.http.get<HitlKeysResponse>(
      `/api/v1/hitl/${encodeURIComponent(hitlId)}/keys`,
    );
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
