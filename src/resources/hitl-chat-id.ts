import type { HttpClient } from '../http.js';
import { streamEndpoint, type StreamEvent, type StreamOptions } from '../streaming.js';
import type { ChatIdDiscoveryCreateResponse } from '../types.js';

/** HITL chat-ID discovery session response shape. */
export interface ChatIdDiscovery {
  token: string;
  status: string;
  chat_id?: string | null;
  [key: string]: unknown;
}

/** The `connected` frame of `hitlChatIdDiscovery.stream()`, written once when the connection opens. */
export interface ChatIdDiscoveryStreamConnected {
  token: string;
  status: string;
  chat_id?: string;
}

/** The `update` frame of `hitlChatIdDiscovery.stream()`: a status signal, not the discovery. */
export interface ChatIdDiscoveryStreamUpdate {
  status: string;
  timestamp: string;
  chat_id?: string;
}

export type ChatIdDiscoveryStreamEvent = StreamEvent<'update', ChatIdDiscoveryStreamConnected, ChatIdDiscoveryStreamUpdate, ChatIdDiscovery>;

const TERMINAL_STATES = ['completed', 'expired'] as const;

/**
 * HITL Telegram chat-ID discovery session stream. Tokens are short-lived
 * and scoped per-user. The polling fallback hits the poll endpoint
 * `/api/v1/hitl/chat-id-discovery/:token`.
 */
export class HitlChatIdDiscovery {
  constructor(private readonly http: HttpClient) {}

  /** Create a chat-ID discovery token (Telegram deeplink + QR code). */
  create(): Promise<ChatIdDiscoveryCreateResponse> {
    return this.http.post<ChatIdDiscoveryCreateResponse>('/api/v1/hitl/chat-id-discovery');
  }

  /** Retrieve chat-ID discovery status by token (polling fallback target). */
  retrieve(token: string): Promise<ChatIdDiscovery> {
    return this.http.get<ChatIdDiscovery>(
      `/api/v1/hitl/chat-id-discovery/${encodeURIComponent(token)}`,
    );
  }

  /**
   * Stream chat-ID discovery status via SSE (`connected` / `update` signals),
   * with a polling fallback that yields the discovery as `poll` / `terminal`.
   */
  stream(
    token: string,
    options?: StreamOptions,
  ): AsyncIterable<ChatIdDiscoveryStreamEvent> {
    return streamEndpoint<ChatIdDiscovery, ChatIdDiscoveryStreamEvent>(this.http, {
      path: `/api/v1/hitl/chat-id-discovery/${encodeURIComponent(token)}/events`,
      retrieve: () => this.retrieve(token),
      terminalStates: TERMINAL_STATES,
      label: `Chat ID discovery ${token}`,
    }, options);
  }
}
