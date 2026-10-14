import type { HttpClient } from '../http.js';
import { pollUntilComplete } from '../polling.js';
import { streamEndpoint, type StreamEvent, type StreamOptions } from '../streaming.js';
import type {
  Verification,
  CreateVerificationParams,
  ListVerificationsParams,
  PaginatedList,
  WaitOptions,
  ResendResponse,
  TestVerifyResponse,
  StartDomainVerificationParams,
  DomainVerification,
  DomainCheckResponse,
  VerifiedUser,
  ListVerifiedUsersParams,
  CreateMultiChannelVerificationParams,
  MultiChannelVerificationResponse,
  MultiChannelGroupStatusResponse,
} from '../types.js';

/** The `connected` frame of `verifications.stream()`, written once when the connection opens. */
export interface VerificationStreamConnected {
  verificationId: string;
}

/** The `status_changed` frame of `verifications.stream()`: a status signal, not the verification. */
export interface VerificationStreamUpdate {
  status: Verification['status'];
  timestamp: string;
  data?: Record<string, unknown>;
}

export type VerificationStreamEvent = StreamEvent<'status_changed', VerificationStreamConnected, VerificationStreamUpdate, Verification>;

const TERMINAL_STATES = ['verified', 'failed', 'expired', 'revoked'] as const;

export class Verifications {
  constructor(private readonly http: HttpClient) {}

  /** Create a new verification */
  create(params: CreateVerificationParams): Promise<Verification> {
    return this.http.post<Verification>('/api/v1/verifications', params);
  }

  /** Get a verification by ID */
  retrieve(id: string): Promise<Verification> {
    return this.http.get<Verification>(`/api/v1/verifications/${encodeURIComponent(id)}`);
  }

  /** Create a multi-channel verification group (one phone offered across several channels; first completed channel wins) */
  createMultiChannel(params: CreateMultiChannelVerificationParams): Promise<MultiChannelVerificationResponse> {
    return this.http.post<MultiChannelVerificationResponse>('/api/v1/verifications/multi-channel', params);
  }

  /** Get multi-channel group status (poll until verified/expired; proof is present when verified) */
  getMultiChannelStatus(groupId: string): Promise<MultiChannelGroupStatusResponse> {
    return this.http.get<MultiChannelGroupStatusResponse>(`/api/v1/verifications/multi-channel/${encodeURIComponent(groupId)}/status`);
  }

  /** List verifications with optional filters */
  list(params?: ListVerificationsParams): Promise<PaginatedList<Verification>> {
    return this.http.get<PaginatedList<Verification>>('/api/v1/verifications', params as Record<string, string | number | boolean | undefined>);
  }

  /** Trigger a DNS/HTTP verification check */
  verify(id: string): Promise<Verification> {
    return this.http.post<Verification>(`/api/v1/verifications/${encodeURIComponent(id)}/verify`);
  }

  /** Submit an OTP/challenge code */
  submit(id: string, code: string): Promise<Verification> {
    return this.http.post<Verification>(`/api/v1/verifications/${encodeURIComponent(id)}/submit`, { code });
  }

  /** Resend a verification email (email channel only) */
  resend(id: string): Promise<ResendResponse> {
    return this.http.post<ResendResponse>(`/api/v1/verifications/${encodeURIComponent(id)}/resend`);
  }

  /** Auto-complete a verification in test mode (pk_test_* API keys only) */
  testVerify(id: string): Promise<TestVerifyResponse> {
    return this.http.post<TestVerifyResponse>(`/api/v1/verifications/${encodeURIComponent(id)}/test-verify`);
  }

  /** List verified users grouped by external_user_id */
  listVerifiedUsers(params?: ListVerifiedUsersParams): Promise<PaginatedList<VerifiedUser>> {
    return this.http.get<PaginatedList<VerifiedUser>>('/api/v1/verifications/users', params as Record<string, string | number | boolean | undefined>);
  }

  /** Get a single verified user's verifications by external user ID */
  getVerifiedUser(externalUserId: string): Promise<VerifiedUser> {
    return this.http.get<VerifiedUser>(`/api/v1/verifications/users/${encodeURIComponent(externalUserId)}`);
  }

  /** Start a B2B domain verification */
  startDomainVerification(params: StartDomainVerificationParams): Promise<DomainVerification> {
    return this.http.post<DomainVerification>('/api/v1/verifications/domain', params);
  }

  /** Check a pending domain verification (DNS/HTTP file) */
  checkDomainVerification(id: string): Promise<DomainCheckResponse> {
    return this.http.post<DomainCheckResponse>(`/api/v1/verifications/domain/${encodeURIComponent(id)}/check`);
  }

  /**
   * Delete a domain verification attempt that is not verified (pending, verifying or failed) —
   * nothing is revoked. A verified domain, or one that needs re-verification, is refused with 409
   * `domain_verified`: removing it revokes its proofs and every delegation issued from it, which
   * belongs to the signed-in owner (the dashboard, or the MCP `delete_domain` tool in a login session).
   */
  deleteDomainVerification(id: string): Promise<void> {
    return this.http.del<void>(`/api/v1/verifications/domain/${encodeURIComponent(id)}`);
  }

  /** Poll until the verification reaches a terminal state. */
  waitForCompletion(id: string, options?: WaitOptions): Promise<Verification> {
    return pollUntilComplete(
      () => this.retrieve(id),
      TERMINAL_STATES,
      `Verification ${id}`,
      options,
    );
  }

  /**
   * Stream verification status changes via SSE: a `connected` signal, then
   * `status_changed` signals, neither carrying the verification. The
   * polling fallback yields it as `poll` / `terminal` events.
   */
  stream(id: string, options?: StreamOptions): AsyncIterable<VerificationStreamEvent> {
    return streamEndpoint<Verification, VerificationStreamEvent>(this.http, {
      path: `/api/v1/verifications/${encodeURIComponent(id)}/events`,
      retrieve: () => this.retrieve(id),
      terminalStates: TERMINAL_STATES,
      label: `Verification ${id}`,
    }, options);
  }
}
