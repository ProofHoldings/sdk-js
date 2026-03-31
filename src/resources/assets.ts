import type { HttpClient } from '../http.js';
import type {
  Asset,
  AssetListResponse,
  ListAssetsParams,
  SuccessResponse,
} from '../types.js';

export class Assets {
  constructor(private readonly http: HttpClient) {}

  /** List all verified assets for the authenticated user */
  list(params?: ListAssetsParams): Promise<AssetListResponse> {
    return this.http.get<AssetListResponse>('/api/v1/me/assets', params);
  }

  /** Get a specific asset by ID */
  get(assetId: string): Promise<Asset> {
    return this.http.get<Asset>(`/api/v1/me/assets/${encodeURIComponent(assetId)}`);
  }

  /** Revoke an asset by ID */
  revoke(assetId: string): Promise<SuccessResponse> {
    return this.http.del<SuccessResponse>(`/api/v1/me/assets/${encodeURIComponent(assetId)}`);
  }
}
