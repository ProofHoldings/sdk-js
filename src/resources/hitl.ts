import type { HttpClient } from '../http.js';
import type {
  HitlConfig,
  CreateHitlParams,
  UpdateHitlParams,
  HitlListParams,
  HitlListResponse,
  HitlAuthorizationResponse,
  HitlFinalizeResponse,
  HitlApproverKeysResponse,
} from '../types.js';

/**
 * HITL config CRUD. Configs are created in `pending` status; upload an
 * encryption keypair (see `hitlKeys`) and call `finalize(id)` to activate.
 */
export class Hitl {
  constructor(private readonly http: HttpClient) {}

  /** Create a new HITL configuration (starts in `pending` status) */
  create(params: CreateHitlParams): Promise<HitlConfig> {
    return this.http.post<HitlConfig>('/api/v1/hitl', params);
  }

  /** List HITL configurations with optional filters */
  list(params?: HitlListParams): Promise<HitlListResponse> {
    return this.http.get<HitlListResponse>('/api/v1/hitl', params);
  }

  /** Get a HITL configuration by ID */
  retrieve(id: string): Promise<HitlConfig> {
    return this.http.get<HitlConfig>(`/api/v1/hitl/${encodeURIComponent(id)}`);
  }

  /** Update a HITL configuration's name, channels, or timeout */
  update(id: string, params: UpdateHitlParams): Promise<HitlConfig> {
    return this.http.request<HitlConfig>(
      'PATCH',
      `/api/v1/hitl/${encodeURIComponent(id)}`,
      { body: params },
    );
  }

  /** Archive a HITL configuration (soft delete; returns the archived config) */
  archive(id: string): Promise<HitlConfig> {
    return this.http.del<HitlConfig>(`/api/v1/hitl/${encodeURIComponent(id)}`);
  }

  /**
   * Finalize a pending HITL configuration (pending → active). Requires an
   * uploaded encryption keypair; dispatches authorization consent messages.
   */
  finalize(id: string): Promise<HitlFinalizeResponse> {
    return this.http.post<HitlFinalizeResponse>(
      `/api/v1/hitl/${encodeURIComponent(id)}/finalize`,
    );
  }

  /**
   * Request authorization consent for channels in an active HITL config
   * that don't have one yet.
   */
  requestAuthorization(id: string): Promise<HitlAuthorizationResponse> {
    return this.http.post<HitlAuthorizationResponse>(
      `/api/v1/hitl/${encodeURIComponent(id)}/authorize`,
    );
  }

  /**
   * List enrolled approver public keys for a config. Feed these into
   * `encryptMessageV2` to wrap a confirmation message for every approver.
   *
   * A key holding `confirmations:create` without `hitl:read` receives each entry as
   * `{ authorization_id, public_key, kid }` only — `recipient` and `channel` are omitted.
   */
  getApproverKeys(id: string): Promise<HitlApproverKeysResponse> {
    return this.http.get<HitlApproverKeysResponse>(
      `/api/v1/hitl/${encodeURIComponent(id)}/approver-keys`,
    );
  }
}
