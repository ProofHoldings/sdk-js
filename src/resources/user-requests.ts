import type { HttpClient } from '../http.js';
import type { SuccessResponse } from '../types.js';

export class UserRequests {
  constructor(private readonly http: HttpClient) {}

  /** List my verification requests. */
  list(): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>('/api/v1/me/verification-requests');
  }

  /** List incoming verification requests. */
  listIncoming(): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>('/api/v1/me/verification-requests/incoming');
  }

  /** Create a verification request. */
  create(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>('/api/v1/me/verification-requests', params);
  }

  /** Claim assets from a verification request. */
  claim(requestId: string): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(`/api/v1/me/verification-requests/${encodeURIComponent(requestId)}/claim`);
  }

  /** Cancel a verification request. */
  cancel(requestId: string): Promise<SuccessResponse> {
    return this.http.del<SuccessResponse>(`/api/v1/me/verification-requests/${encodeURIComponent(requestId)}`);
  }

  /** Extend a verification request. */
  extend(requestId: string): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(`/api/v1/me/verification-requests/${encodeURIComponent(requestId)}/extend`);
  }

  /** Share verification request via email. */
  shareEmail(requestId: string): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(`/api/v1/me/verification-requests/${encodeURIComponent(requestId)}/share-email`);
  }
}
