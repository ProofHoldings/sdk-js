import type { HttpClient } from '../http.js';
import { pollUntilComplete } from '../polling.js';
import type {
  Verification,
  CreateVerificationParams,
  ListVerificationsParams,
  PaginatedList,
  WaitOptions,
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
