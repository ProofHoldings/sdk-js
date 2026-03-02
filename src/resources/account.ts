import type { HttpClient } from '../http.js';
import type {
  AccountDeletionSession,
  AccountDeletionStatus,
  VerifyAccountDeletionParams,
  DeleteAccountParams,
  SuccessResponse,
} from '../types.js';

export class Account {
  constructor(private readonly http: HttpClient) {}

  /** Initiate account deletion flow */
  initiateDeletion(): Promise<AccountDeletionSession> {
    return this.http.post<AccountDeletionSession>('/api/v1/me/account/delete', {});
  }

  /** Get account deletion session status */
  deletionStatus(sessionId: string): Promise<AccountDeletionStatus> {
    return this.http.get<AccountDeletionStatus>(
      `/api/v1/me/account/delete/${encodeURIComponent(sessionId)}`,
    );
  }

  /** Verify account deletion via email code */
  verifyDeletion(sessionId: string, params: VerifyAccountDeletionParams): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/account/delete/${encodeURIComponent(sessionId)}/verify`,
      params,
    );
  }

  /** Verify account deletion via magic link */
  verifyDeletionMagicLink(token: string): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/account/delete/magic/${encodeURIComponent(token)}`,
    );
  }

  /** Finalize account deletion (requires confirmed session_id) */
  delete(params: DeleteAccountParams): Promise<SuccessResponse> {
    return this.http.request<SuccessResponse>('DELETE', '/api/v1/me/account', { body: params });
  }
}
