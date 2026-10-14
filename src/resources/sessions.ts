import type { HttpClient } from '../http.js';
import { pollUntilComplete } from '../polling.js';
import type { Session, CreateSessionParams, WaitOptions } from '../types.js';

const TERMINAL_STATES = ['verified', 'failed', 'expired'] as const;

export class Sessions {
  constructor(private readonly http: HttpClient) {}

  /** Create a new phone verification session */
  create(params: CreateSessionParams): Promise<Session> {
    return this.http.post<Session>('/api/v1/sessions', params);
  }

  /** Get session status by ID */
  retrieve(id: string): Promise<Session> {
    return this.http.get<Session>(`/api/v1/sessions/${encodeURIComponent(id)}`);
  }

  /**
   * Poll until session reaches a terminal state (verified/failed/expired).
   */
  waitForCompletion(id: string, options?: WaitOptions): Promise<Session> {
    return pollUntilComplete(
      () => this.retrieve(id),
      TERMINAL_STATES,
      `Session ${id}`,
      options,
    );
  }
}
