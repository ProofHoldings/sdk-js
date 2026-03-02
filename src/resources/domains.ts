import type { HttpClient } from '../http.js';
import type {
  Domain,
  DomainListResponse,
  AddDomainParams,
  OAuthUrlResponse,
  ConnectCloudflareParams,
  ConnectGoDaddyParams,
  ConnectProviderParams,
  DnsProviderMetadata,
  StartEmailVerificationParams,
  VerifyEmailCodeParams,
  SetupEmailSendingParams,
  SuccessResponse,
} from '../types.js';

export class Domains {
  constructor(private readonly http: HttpClient) {}

  /** List all domains */
  list(): Promise<DomainListResponse> {
    return this.http.get<DomainListResponse>('/api/v1/me/domains');
  }

  /** Add a domain */
  add(params: AddDomainParams): Promise<Domain> {
    return this.http.post<Domain>('/api/v1/me/domains', params);
  }

  /** Get a domain by ID */
  get(domainId: string): Promise<Domain> {
    return this.http.get<Domain>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}`,
    );
  }

  /** Delete a domain */
  delete(domainId: string): Promise<SuccessResponse> {
    return this.http.del<SuccessResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}`,
    );
  }

  /** Get OAuth URL for DNS provider authorization */
  oauthUrl(domainId: string): Promise<OAuthUrlResponse> {
    return this.http.post<OAuthUrlResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}/oauth-url`,
    );
  }

  /** Verify domain ownership */
  verify(domainId: string): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}/verify`,
    );
  }

  /** Connect Cloudflare to a domain */
  connectCloudflare(domainId: string, params: ConnectCloudflareParams): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}/connect/cloudflare`,
      params,
    );
  }

  /** Connect GoDaddy to a domain */
  connectGoDaddy(domainId: string, params: ConnectGoDaddyParams): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}/connect/godaddy`,
      params,
    );
  }

  /** Connect a DNS provider to a domain */
  connectProvider(domainId: string, provider: string, params: ConnectProviderParams): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}/connect/${encodeURIComponent(provider)}`,
      params,
    );
  }

  /** Add an additional verification provider to an already-verified domain */
  addProvider(domainId: string, provider: string, params: ConnectProviderParams): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}/add-provider/${encodeURIComponent(provider)}`,
      params,
    );
  }

  /** Get metadata for all supported DNS providers */
  getProviders(): Promise<DnsProviderMetadata> {
    return this.http.get<DnsProviderMetadata>('/api/v1/me/dns-providers');
  }

  /** Verify domain with existing credentials */
  verifyWithCredentials(domainId: string): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}/verify-with-credentials`,
    );
  }

  /** Check if credentials have access to domain */
  checkCredentials(domainId: string): Promise<SuccessResponse> {
    return this.http.get<SuccessResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}/check-credentials`,
    );
  }

  /** Start email verification for a domain */
  startEmailVerification(domainId: string, params?: StartEmailVerificationParams): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}/verify-email`,
      params ?? {},
    );
  }

  /** Confirm email verification code */
  confirmEmailCode(domainId: string, params: VerifyEmailCodeParams): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}/verify-email/confirm`,
      params,
    );
  }

  /** Resend email verification */
  resendEmail(domainId: string, params?: StartEmailVerificationParams): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}/verify-email/resend`,
      params ?? {},
    );
  }

  /** Setup email sending for a domain */
  emailSetup(domainId: string, params?: SetupEmailSendingParams): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}/email-setup`,
      params ?? {},
    );
  }

  /** Check email sending status for a domain */
  emailStatus(domainId: string): Promise<SuccessResponse> {
    return this.http.get<SuccessResponse>(
      `/api/v1/me/domains/${encodeURIComponent(domainId)}/email-status`,
    );
  }
}
