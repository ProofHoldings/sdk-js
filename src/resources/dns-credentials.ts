import type { HttpClient } from '../http.js';
import type {
  DnsCredentialListResponse,
  CreateDnsCredentialParams,
  DnsCredential,
  SuccessResponse,
} from '../types.js';

export class DnsCredentials {
  constructor(private readonly http: HttpClient) {}

  /** List all DNS credentials */
  list(): Promise<DnsCredentialListResponse> {
    return this.http.get<DnsCredentialListResponse>('/api/v1/me/dns-credentials');
  }

  /** Create a DNS credential */
  create(params: CreateDnsCredentialParams): Promise<DnsCredential> {
    return this.http.post<DnsCredential>('/api/v1/me/dns-credentials', params);
  }

  /** Delete a DNS credential */
  delete(credentialId: string): Promise<SuccessResponse> {
    return this.http.del<SuccessResponse>(
      `/api/v1/me/dns-credentials/${encodeURIComponent(credentialId)}`,
    );
  }
}
