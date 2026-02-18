import type { HttpClient } from '../http.js';
import { pollUntilComplete } from '../polling.js';
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
} from '../types.js';

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
   * Poll until verification reaches a terminal state (verified/failed/expired/revoked).
   *
   * @param id - Verification ID
   * @param options - Polling configuration
   * @returns The verification in its terminal state
   * @throws {PollingTimeoutError} if timeout is reached
   */
  waitForCompletion(id: string, options?: WaitOptions): Promise<Verification> {
    return pollUntilComplete(
      () => this.retrieve(id),
      TERMINAL_STATES,
      `Verification ${id}`,
      options,
    );
  }
}
