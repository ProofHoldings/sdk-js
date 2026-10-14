import type { HttpClient } from '../http.js';
import type {
  Authorization,
  CreateAuthorizationParams,
  AuthorizationListParams,
  AuthorizationListResponse,
  CreateAuthorizationResponse,
  AuthorizationExportParams,
  AuthorizationExportResponse,
  BinaryResponse,
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
    return this.http.request<Authorization>(
      'DELETE',
      `/api/v1/authorizations/${encodeURIComponent(id)}`,
      { body: params },
    );
  }

  /** Export authorizations as CSV — served as text/csv, returned as the binary envelope */
  export(params: AuthorizationExportParams & { format: 'csv' }): Promise<BinaryResponse>;
  /** Export authorizations as JSON */
  export(params?: AuthorizationExportParams): Promise<AuthorizationExportResponse>;
  export(params?: AuthorizationExportParams): Promise<AuthorizationExportResponse | BinaryResponse> {
    return this.http.get<AuthorizationExportResponse | BinaryResponse>('/api/v1/authorizations/export', params as Record<string, string | number | boolean | undefined>);
  }
}
