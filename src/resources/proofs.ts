import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { HttpClient } from '../http.js';
import type { ProofValidation, RevocationList, RevokeResponse, OfflineVerificationResult } from '../types.js';

export class Proofs {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
  private jwksUrl: string;

  constructor(private readonly http: HttpClient) {
    this.jwksUrl = `${http.baseUrl}/.well-known/jwks.json`;
  }

  /** Validate a proof token online (checks revocation status) */
  validate(proofToken: string, identifier?: string): Promise<ProofValidation> {
    return this.http.post<ProofValidation>('/api/v1/proofs/validate', {
      proof_token: proofToken,
      ...(identifier ? { identifier } : {}),
    });
  }

  /** Revoke a proof by verification ID */
  revoke(id: string, reason?: string): Promise<RevokeResponse> {
    return this.http.post<RevokeResponse>(`/api/v1/proofs/${encodeURIComponent(id)}/revoke`, {
      ...(reason ? { reason } : {}),
    });
  }

  /** Get the revocation list */
  listRevoked(): Promise<RevocationList> {
    return this.http.get<RevocationList>('/api/v1/proofs/revoked');
  }

  /**
   * Verify a proof token offline using JWKS public keys.
   * No API call is made — the JWKS is fetched once and cached by the `jose` library.
   */
  async verifyOffline(token: string): Promise<OfflineVerificationResult> {
    try {
      if (!this.jwks) {
        this.jwks = createRemoteJWKSet(new URL(this.jwksUrl));
      }

      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: 'proof.holdings',
        clockTolerance: 5,
      });

      return {
        valid: true,
        payload: {
          iss: payload.iss as string,
          sub: payload.sub as string,
          iat: payload.iat as number,
          exp: payload.exp as number,
          type: payload.type as string,
          channel: payload.channel as string,
          identifier_hash: payload.identifier_hash as string,
          verified_at: payload.verified_at as string,
          user_id: payload.user_id as string,
        },
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token verification failed',
      };
    }
  }

  /** Force-refresh the cached JWKS (e.g. after key rotation) */
  refreshJWKS(): void {
    this.jwks = null;
  }
}
