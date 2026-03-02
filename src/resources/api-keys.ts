import type { HttpClient } from '../http.js';
import type {
  ApiKeyListResponse,
  CreateApiKeyParams,
  CreateApiKeyResponse,
  SuccessResponse,
} from '../types.js';

export class ApiKeys {
  constructor(private readonly http: HttpClient) {}

  /** List all API keys */
  list(): Promise<ApiKeyListResponse> {
    return this.http.get<ApiKeyListResponse>('/api/v1/me/api-keys');
  }

  /** Create a new API key */
  create(params?: CreateApiKeyParams): Promise<CreateApiKeyResponse> {
    return this.http.post<CreateApiKeyResponse>('/api/v1/me/api-keys', params ?? {});
  }

  /** Revoke an API key */
  revoke(keyId: string): Promise<SuccessResponse> {
    return this.http.del<SuccessResponse>(
      `/api/v1/me/api-keys/${encodeURIComponent(keyId)}`,
    );
  }

  /** Regenerate an API key */
  regenerate(keyId: string): Promise<CreateApiKeyResponse> {
    return this.http.post<CreateApiKeyResponse>(
      `/api/v1/me/api-keys/${encodeURIComponent(keyId)}/regenerate`,
    );
  }
}
