import type { HttpClient } from '../http.js';
import { streamEndpoint, type StreamEvent, type StreamOptions } from '../streaming.js';

/**
 * Auth session resource envelope, as `retrieve()` returns it; shape is left
 * open so callers can narrow to their dashboard/login flow's own type.
 */
export interface AuthSession {
  id: string;
  status: string;
  [key: string]: unknown;
}

/** The `connected` frame of `authSessions.stream()`, written once when the connection opens. */
export interface AuthSessionStreamConnected {
  session_id: string;
  status: string;
  channel: string;
}

/** The `update` frame of `authSessions.stream()`: a status signal, not the session. */
export interface AuthSessionStreamUpdate {
  status: string;
  timestamp: string;
}

export type AuthSessionStreamEvent = StreamEvent<'update', AuthSessionStreamConnected, AuthSessionStreamUpdate, AuthSession>;

const TERMINAL_STATES = ['verified', 'failed', 'expired'] as const;

/**
 * Dashboard-side authentication sessions (magic-link / QR login). The
 * session ID itself acts as the bearer secret — no API key required for the
 * SSE endpoint, but format is enforced server-side (`auth_[a-f0-9]{32}`).
 */
export class AuthSessions {
  constructor(private readonly http: HttpClient) {}

  /** Retrieve an auth session by ID (polling fallback target). */
  retrieve(id: string): Promise<AuthSession> {
    return this.http.get<AuthSession>(`/api/v1/auth/sessions/${encodeURIComponent(id)}`);
  }

  /**
   * Stream auth session status changes via Server-Sent Events: `connected` and
   * `update` signals, not the session. When SSE is unavailable it falls back to
   * polling `retrieve(id)` and yields the session as `poll` / `terminal` events.
   */
  stream(id: string, options?: StreamOptions): AsyncIterable<AuthSessionStreamEvent> {
    return streamEndpoint<AuthSession, AuthSessionStreamEvent>(this.http, {
      path: `/api/v1/auth/sessions/${encodeURIComponent(id)}/events`,
      retrieve: () => this.retrieve(id),
      terminalStates: TERMINAL_STATES,
      label: `Auth session ${id}`,
    }, options);
  }
}
