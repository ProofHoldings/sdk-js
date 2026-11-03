import type { HttpClient } from '../http.js';
import { streamEndpoint, type StreamEvent, type StreamOptions } from '../streaming.js';
import type {
  ApiKeyMetadata,
  ApiKeyUsage,
  MeEnvironmentParams,
  MeSearchParams,
  MeSearchResults,
  PlatformSummary,
} from '../types.js';

/** Dashboard-side add-phone session, as `GET /api/v1/me/phones/add/:sessionId` returns it. */
export interface PhoneAddSession {
  session_id: string;
  /**
   * @deprecated Never sent by the server (it reads `undefined`); use `session_id`. Kept as typed for 1.x
   * compatibility and removed in the next major (`sdks/shared/NEXT_MAJOR.md`).
   */
  id: string;
  /** The number the person proved; absent until they have. */
  phone_number?: string;
  channel: 'telegram' | 'whatsapp' | 'sms';
  /** `pending` or `verified`. */
  status: string;
  /** Present once `status` is `verified`. */
  verified_at?: string;
  [key: string]: unknown;
}

/** Dashboard-side add-email session, as `GET /api/v1/me/emails/add/:sessionId` returns it. */
export interface EmailAddSession {
  session_id: string;
  /**
   * @deprecated Never sent by the server (it reads `undefined`); use `session_id`. Kept as typed for 1.x
   * compatibility and removed in the next major (`sdks/shared/NEXT_MAJOR.md`).
   */
  id: string;
  email: string;
  channel: 'otp';
  /** `pending` or `verified`. */
  status: string;
  /** Present once `status` is `verified`. */
  verified_at?: string;
  [key: string]: unknown;
}

/** Dashboard-side 2FA challenge session, as `GET /api/v1/me/2fa/:sessionId` returns it. */
export interface TwoFASession {
  session_id: string;
  /**
   * @deprecated Never sent by the server (it reads `undefined`); use `session_id`. Kept as typed for 1.x
   * compatibility and removed in the next major (`sdks/shared/NEXT_MAJOR.md`).
   */
  id: string;
  /** `pending`, `verified` or `expired`. */
  status: string;
  /** The action the step-up authorizes. */
  action_type: string;
  /** Present once `status` is `verified`. */
  verified_at?: string;
  /** When the stored grant stops being accepted; present once `status` is `verified`. */
  grant_expires_at?: string;
  /** Whether the grant is spent by the first act it allows; present once `status` is `verified`. */
  grant_single_use?: boolean;
  [key: string]: unknown;
}

/** The `connected` frame of `me.streamPhoneAddSession()`, written once when the connection opens. */
export interface PhoneAddSessionStreamConnected {
  session_id: string;
  status: string;
  channel: string;
}

/** The `update` frame of `me.streamPhoneAddSession()`: a status signal, not the session. */
export interface PhoneAddSessionStreamUpdate {
  status: string;
  timestamp: string;
  phone_number?: string;
}

export type PhoneAddSessionStreamEvent = StreamEvent<'update', PhoneAddSessionStreamConnected, PhoneAddSessionStreamUpdate, PhoneAddSession>;

/** The `connected` frame of `me.streamEmailAddSession()`, written once when the connection opens. */
export interface EmailAddSessionStreamConnected {
  session_id: string;
  status: string;
  email: string;
  channel: string;
}

/** The `update` frame of `me.streamEmailAddSession()`: a status signal, not the session. */
export interface EmailAddSessionStreamUpdate {
  status: string;
  timestamp: string;
  email?: string;
}

export type EmailAddSessionStreamEvent = StreamEvent<'update', EmailAddSessionStreamConnected, EmailAddSessionStreamUpdate, EmailAddSession>;

/** The `connected` frame of `me.stream2FASession()`, written once when the connection opens. */
export interface TwoFASessionStreamConnected {
  session_id: string;
  status: string;
  action_type: string;
}

/** The `update` frame of `me.stream2FASession()`: a status signal, not the session. */
export interface TwoFASessionStreamUpdate {
  status: string;
  timestamp: string;
}

export type TwoFASessionStreamEvent = StreamEvent<'update', TwoFASessionStreamConnected, TwoFASessionStreamUpdate, TwoFASession>;

const SESSION_TERMINAL_STATES = ['verified', 'failed', 'expired'] as const;

/**
 * `/me` account-management resources: phone/email add flows and 2FA. All
 * endpoints are JWT-authenticated and scoped to the current user on the
 * backend, so the SDK just forwards the session ID.
 */
export class Me {
  constructor(private readonly http: HttpClient) {}

  /** Retrieve an add-phone session (polling fallback). */
  retrievePhoneAddSession(sessionId: string): Promise<PhoneAddSession> {
    return this.http.get<PhoneAddSession>(`/api/v1/me/phones/add/${encodeURIComponent(sessionId)}`);
  }

  /** Retrieve an add-email session (polling fallback). */
  retrieveEmailAddSession(sessionId: string): Promise<EmailAddSession> {
    return this.http.get<EmailAddSession>(`/api/v1/me/emails/add/${encodeURIComponent(sessionId)}`);
  }

  /** Retrieve a 2FA session (polling fallback). */
  retrieve2FASession(sessionId: string): Promise<TwoFASession> {
    return this.http.get<TwoFASession>(`/api/v1/me/2fa/${encodeURIComponent(sessionId)}`);
  }

  /**
   * Stream phone-add session status via SSE (`connected` / `update` signals),
   * with a polling fallback that yields the session as `poll` / `terminal`.
   */
  streamPhoneAddSession(
    sessionId: string,
    options?: StreamOptions,
  ): AsyncIterable<PhoneAddSessionStreamEvent> {
    return streamEndpoint<PhoneAddSession, PhoneAddSessionStreamEvent>(this.http, {
      path: `/api/v1/me/phones/add/${encodeURIComponent(sessionId)}/events`,
      retrieve: () => this.retrievePhoneAddSession(sessionId),
      terminalStates: SESSION_TERMINAL_STATES,
      label: `Phone-add session ${sessionId}`,
    }, options);
  }

  /**
   * Stream email-add session status via SSE (`connected` / `update` signals),
   * with a polling fallback that yields the session as `poll` / `terminal`.
   */
  streamEmailAddSession(
    sessionId: string,
    options?: StreamOptions,
  ): AsyncIterable<EmailAddSessionStreamEvent> {
    return streamEndpoint<EmailAddSession, EmailAddSessionStreamEvent>(this.http, {
      path: `/api/v1/me/emails/add/${encodeURIComponent(sessionId)}/events`,
      retrieve: () => this.retrieveEmailAddSession(sessionId),
      terminalStates: SESSION_TERMINAL_STATES,
      label: `Email-add session ${sessionId}`,
    }, options);
  }

  /**
   * Stream 2FA session status via SSE (`connected` / `update` signals), with a
   * polling fallback that yields the session as `poll` / `terminal`.
   */
  stream2FASession(
    sessionId: string,
    options?: StreamOptions,
  ): AsyncIterable<TwoFASessionStreamEvent> {
    return streamEndpoint<TwoFASession, TwoFASessionStreamEvent>(this.http, {
      path: `/api/v1/me/2fa/${encodeURIComponent(sessionId)}/events`,
      retrieve: () => this.retrieve2FASession(sessionId),
      terminalStates: SESSION_TERMINAL_STATES,
      label: `2FA session ${sessionId}`,
    }, options);
  }

  // --- Dashboard / agent data surface (dual-auth: JWT or API key) ---

  /** One-call account snapshot: quota + EoM projection, request health, channel stats, HITL counts, active keys. */
  summary(params?: MeEnvironmentParams): Promise<PlatformSummary> {
    return this.http.get<PlatformSummary>('/api/v1/me/summary', params as Record<string, string | number | boolean | undefined>);
  }

  /** Prefix-anchored global account search across six resource buckets. */
  search(params: MeSearchParams): Promise<MeSearchResults> {
    return this.http.get<MeSearchResults>('/api/v1/me/search', params as unknown as Record<string, string | number | boolean | undefined>);
  }

  /** Retrieve the calling API key's own redacted metadata (agent self-inspection). */
  apiKeySelf(): Promise<ApiKeyMetadata> {
    return this.http.get<ApiKeyMetadata>('/api/v1/me/api-key');
  }

  /**
   * Per-API-key usage counts (verifications/requests/confirmations/authorizations) plus attribution
   * context, for the key and every key it replaced (`api_key.replaced_key_ids`).
   */
  apiKeyUsage(id: string, params?: MeEnvironmentParams): Promise<ApiKeyUsage> {
    return this.http.get<ApiKeyUsage>(`/api/v1/me/api-keys/${encodeURIComponent(id)}/usage`, params as Record<string, string | number | boolean | undefined>);
  }
}
