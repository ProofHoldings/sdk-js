import type { HttpClient } from '../http.js';
import type {
  StartTwoFAParams,
  TwoFASession,
  TwoFAStatus,
  VerifyTwoFAParams,
  SuccessResponse,
} from '../types.js';

export class TwoFA {
  constructor(private readonly http: HttpClient) {}

  /** Start a 2FA session */
  start(params: StartTwoFAParams): Promise<TwoFASession> {
    return this.http.post<TwoFASession>('/api/v1/me/2fa/start', params);
  }

  /** Poll 2FA session status */
  getStatus(sessionId: string): Promise<TwoFAStatus> {
    return this.http.get<TwoFAStatus>(
      `/api/v1/me/2fa/${encodeURIComponent(sessionId)}`,
    );
  }

  /** Verify 2FA code */
  verify(sessionId: string, params: VerifyTwoFAParams): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/2fa/${encodeURIComponent(sessionId)}/verify`,
      params,
    );
  }

  /** Verify 2FA via magic link */
  verifyMagicLink(token: string): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/2fa/magic/${encodeURIComponent(token)}`,
    );
  }
}
