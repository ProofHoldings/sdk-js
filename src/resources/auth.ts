import type { HttpClient } from '../http.js';
import type {
  CurrentUser,
  AuthSessionListResponse,
  SuccessResponse,
} from '../types.js';

export class Auth {
  constructor(private readonly http: HttpClient) {}

  /** Get the current authenticated user */
  getMe(): Promise<CurrentUser> {
    return this.http.get<CurrentUser>('/api/v1/auth/me');
  }

  /** List all active sessions for the current user */
  listSessions(): Promise<AuthSessionListResponse> {
    return this.http.get<AuthSessionListResponse>('/api/v1/auth/sessions');
  }

  /** Revoke a specific session */
  revokeSession(sessionId: string): Promise<SuccessResponse> {
    return this.http.del<SuccessResponse>(
      `/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`,
    );
  }
}
