import type { HttpClient } from '../http.js';
import type { SuccessResponse, StartUserDomainVerifyParams } from '../types.js';

export class UserDomainVerify {
  constructor(private readonly http: HttpClient) {}

  /** Start domain verification (self-service). */
  start(params: StartUserDomainVerifyParams): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>('/api/v1/me/verify/domain', params);
  }

  /** Poll domain verification status. */
  status(sessionId: string): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`/api/v1/me/verify/domain/${encodeURIComponent(sessionId)}`);
  }

  /** Check domain verification. */
  check(sessionId: string): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(`/api/v1/me/verify/domain/${encodeURIComponent(sessionId)}/check`);
  }
}
