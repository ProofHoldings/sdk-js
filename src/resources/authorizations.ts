import type { HttpClient } from '../http.js';
import type {
  Authorization,
  CreateAuthorizationParams,
  AuthorizationListParams,
  AuthorizationListResponse,
  CreateAuthorizationResponse,
  AuthorizationExportParams,
  AuthorizationExportResponse,
} from '../types.js';

export class Authorizations {
  constructor(private readonly http: HttpClient) {}

  /** Create a new authorization request */
  create(params: CreateAuthorizationParams): Promise<CreateAuthorizationResponse> {
    return this.http.post<CreateAuthorizationResponse>('/api/v1/authorizations', params);
  }

  /** Get an authorization by ID */
  retrieve(id: string): Promise<Authorization> {
    return this.http.get<Authorization>(`/api/v1/authorizations/${encodeURIComponent(id)}`);
  }

  /** List authorizations with optional filters */
  list(params?: AuthorizationListParams): Promise<AuthorizationListResponse> {
    return this.http.get<AuthorizationListResponse>('/api/v1/authorizations', params as Record<string, string | number | boolean | undefined>);
  }

  /** Revoke an authorization */
  revoke(id: string, params?: { reason?: string }): Promise<Authorization> {
    return this.http.del<Authorization>(`/api/v1/authorizations/${encodeURIComponent(id)}`, params);
  }

  /** Export authorizations as CSV or JSON */
  export(params?: AuthorizationExportParams): Promise<AuthorizationExportResponse> {
    return this.http.get<AuthorizationExportResponse>('/api/v1/authorizations/export', params as Record<string, string | number | boolean | undefined>);
  }
}
