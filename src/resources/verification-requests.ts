import type { HttpClient } from '../http.js';
import { pollUntilComplete } from '../polling.js';
import type {
  VerificationRequest,
  CreateVerificationRequestParams,
  ListVerificationRequestsParams,
  PaginatedList,
  WaitOptions,
} from '../types.js';

const TERMINAL_STATES = ['completed', 'expired', 'cancelled'] as const;

export class VerificationRequests {
  constructor(private readonly http: HttpClient) {}

  /** Create a multi-asset verification request */
  create(params: CreateVerificationRequestParams): Promise<VerificationRequest> {
    return this.http.post<VerificationRequest>('/api/v1/verification-requests', params);
  }

  /** Get a verification request by ID */
  retrieve(id: string): Promise<VerificationRequest> {
    return this.http.get<VerificationRequest>(`/api/v1/verification-requests/${encodeURIComponent(id)}`);
  }

  /** List verification requests with optional filters */
  list(params?: ListVerificationRequestsParams): Promise<PaginatedList<VerificationRequest>> {
    return this.http.get<PaginatedList<VerificationRequest>>('/api/v1/verification-requests', params as Record<string, string | number | boolean | undefined>);
  }

  /** Get a verification request by its reference ID */
  getByReference(referenceId: string): Promise<VerificationRequest> {
    return this.http.get<VerificationRequest>(`/api/v1/verification-requests/by-reference/${encodeURIComponent(referenceId)}`);
  }

  /** Cancel a pending verification request */
  cancel(id: string): Promise<VerificationRequest> {
    return this.http.del<VerificationRequest>(`/api/v1/verification-requests/${encodeURIComponent(id)}`);
  }

  /**
   * Poll until request reaches a terminal state (completed/expired/cancelled).
   */
  waitForCompletion(id: string, options?: WaitOptions): Promise<VerificationRequest> {
    return pollUntilComplete(
      () => this.retrieve(id),
      TERMINAL_STATES,
      `Verification request ${id}`,
      options,
    );
  }
}
