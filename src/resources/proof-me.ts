import type { HttpClient } from '../http.js';

/** Channel a Proof-Me identity challenge can run on. */
export type ProofMeChannel = 'telegram' | 'whatsapp';

export interface CreateIdentityChallengeParams {
  circle_id: string;
  member_id: string;
  /** Channel the suspicious contact reached the member on; defaults to the member's channel. */
  suspicious_channel?: ProofMeChannel;
  [key: string]: unknown;
}

/**
 * The one status every read reports: `cancelled` — whoever started the check withdrew it; `failed` — it
 * could not be delivered; `expired` — nobody answered; `revoked` / `suspended` — the confirmation's
 * proof was revoked or suspended, or (`revoked` only) the member being checked was removed while the
 * check was pending.
 */
export type IdentityChallengeStatus =
  | 'pending'
  | 'confirmed'
  | 'denied'
  | 'cancelled'
  | 'failed'
  | 'expired'
  | 'revoked'
  | 'suspended';

export interface IdentityChallenge {
  id: string;
  status: IdentityChallengeStatus;
  confirm_channel?: string;
  channel?: string;
  single_channel_warning?: boolean;
  circle_id?: string | null;
  is_drill?: boolean;
  /** Public handle of the decision's proof — what `proofs.revoke(proof_id)` takes. */
  proof_id?: string | null;
  proof_token?: string | null;
  created_at?: string;
  resolved_at?: string | null;
  expires_at?: string;
  [key: string]: unknown;
}

/**
 * Proof-Me — anti-impersonation reverse verification. A Circle member can trigger a
 * cross-channel CONFIRM (identity challenge) so the account holder approves on a
 * different channel than the suspicious contact reached them on. Member enrollment
 * and drills live on the `circles` resource (the Circle people-primitive).
 */
export class ProofMe {
  constructor(private readonly http: HttpClient) {}

  /** Create a cross-channel identity challenge (CONFIRM) for an enrolled Circle member. */
  createIdentityChallenge(params: CreateIdentityChallengeParams): Promise<IdentityChallenge> {
    return this.http.post<IdentityChallenge>('/api/v1/identity-challenges', params);
  }

  /** Get an identity challenge by ID (poll for resolution). */
  getIdentityChallenge(id: string): Promise<IdentityChallenge> {
    return this.http.get<IdentityChallenge>(
      `/api/v1/identity-challenges/${encodeURIComponent(id)}`,
    );
  }
}
