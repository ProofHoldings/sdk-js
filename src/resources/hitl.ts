import type { HttpClient } from '../http.js';
import type {
  Hitl,
  CreateHitlParams,
  UpdateHitlParams,
  HitlListParams,
  HitlListResponse,
  HitlAuthorizationResponse,
  ChatIdDiscovery,
  ChatIdDiscoveryResult,
} from '../types.js';

export class HitlConfigs {
  constructor(private readonly http: HttpClient) {}

  /** Create a new HITL config */
  create(params: CreateHitlParams): Promise<Hitl> {
    return this.http.post<Hitl>('/api/v1/hitl', params);
  }

  /** Get a HITL config by ID */
  retrieve(id: string): Promise<Hitl> {
    return this.http.get<Hitl>(`/api/v1/hitl/${encodeURIComponent(id)}`);
  }

  /** List HITL configs with optional filters */
  list(params?: HitlListParams): Promise<HitlListResponse> {
    return this.http.get<HitlListResponse>('/api/v1/hitl', params as Record<string, string | number | boolean | undefined>);
  }

  /** Update a HITL config */
  update(id: string, params: UpdateHitlParams): Promise<Hitl> {
    return this.http.patch<Hitl>(`/api/v1/hitl/${encodeURIComponent(id)}`, params);
  }

  /** Delete (archive) a HITL config */
  delete(id: string): Promise<Hitl> {
    return this.http.del<Hitl>(`/api/v1/hitl/${encodeURIComponent(id)}`);
  }

  /** Request authorization for a HITL config — sends consent requests to all configured channels */
  requestAuthorization(id: string): Promise<HitlAuthorizationResponse> {
    return this.http.post<HitlAuthorizationResponse>(`/api/v1/hitl/${encodeURIComponent(id)}/authorize`, {});
  }

  /** Create a Telegram chat ID discovery token — returns a deep link and QR code */
  createChatIdDiscovery(): Promise<ChatIdDiscovery> {
    return this.http.post<ChatIdDiscovery>('/api/v1/hitl/chat-id-discovery', {});
  }

  /** Poll a chat ID discovery token — returns the discovered chat ID when the user interacts with the bot */
  pollChatIdDiscovery(token: string): Promise<ChatIdDiscoveryResult> {
    return this.http.get<ChatIdDiscoveryResult>(`/api/v1/hitl/chat-id-discovery/${encodeURIComponent(token)}`);
  }
}
