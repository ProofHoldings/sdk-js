import type { HttpClient } from '../http.js';
import type {
  EmailListResponse,
  SuccessResponse,
  StartAddEmailParams,
  AddEmailSession,
  AddEmailStatus,
  VerifyEmailOtpParams,
  EmailVerifiedResponse,
  EmailResendResponse,
} from '../types.js';

export class Emails {
  constructor(private readonly http: HttpClient) {}

  /** List all emails for the authenticated user */
  list(): Promise<EmailListResponse> {
    return this.http.get<EmailListResponse>('/api/v1/me/emails');
  }

  /** Remove an email by ID */
  remove(emailId: string): Promise<SuccessResponse> {
    return this.http.del<SuccessResponse>(`/api/v1/me/emails/${encodeURIComponent(emailId)}`);
  }

  /** Set an email as the primary email */
  setPrimary(emailId: string): Promise<SuccessResponse> {
    return this.http.put<SuccessResponse>(
      `/api/v1/me/emails/${encodeURIComponent(emailId)}/primary`,
    );
  }

  /** Start adding a new email */
  startAdd(params: StartAddEmailParams): Promise<AddEmailSession> {
    return this.http.post<AddEmailSession>('/api/v1/me/emails/add', params);
  }

  /** Get the status of an email add session */
  getAddStatus(sessionId: string): Promise<AddEmailStatus> {
    return this.http.get<AddEmailStatus>(
      `/api/v1/me/emails/add/${encodeURIComponent(sessionId)}`,
    );
  }

  /** Verify an email using an OTP code */
  verifyOtp(sessionId: string, params: VerifyEmailOtpParams): Promise<EmailVerifiedResponse> {
    return this.http.post<EmailVerifiedResponse>(
      `/api/v1/me/emails/add/${encodeURIComponent(sessionId)}/verify`,
      params,
    );
  }

  /** Resend the email OTP */
  resendOtp(sessionId: string): Promise<EmailResendResponse> {
    return this.http.post<EmailResendResponse>(
      `/api/v1/me/emails/add/${encodeURIComponent(sessionId)}/resend`,
    );
  }
}
