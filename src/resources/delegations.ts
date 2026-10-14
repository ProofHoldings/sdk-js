import type { HttpClient } from '../http.js';
import type {
  CreateDelegationParams,
  DelegationDetail,
  DelegationListItem,
  DelegationListParams,
  DelegationListResponse,
  RevokeDelegationParams,
} from '../types.js';

/**
 * Delegations — Proof of Delegation. A control-proven domain authorizes a typed
 * url/purl artifact for a set of capability scopes; the attestation is that the
 * domain's controller authorized the artifact, nothing more.
 */
export class Delegations {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a delegation from your active domain control proof (each mint is a billable proof).
   *
   * The result carries the publishable token AND the derived `effective_status`/`is_valid`,
   * the same pair the reads carry — the shape does not depend on the verb.
   */
  create(params: CreateDelegationParams): Promise<DelegationDetail> {
    return this.http.post<DelegationDetail>('/api/v1/delegations', params);
  }

  /**
   * List your own delegations (tokens are not included in the list).
   *
   * Each item carries the DERIVED `effective_status`/`is_valid` beside its stored `status` —
   * render the derived one. `params.status` filters the stored record only.
   */
  list(params?: DelegationListParams): Promise<DelegationListResponse> {
    return this.http.get<DelegationListResponse>('/api/v1/delegations', params as Record<string, string | number | boolean | undefined>);
  }

  /** Get a delegation by Mongo id or `ph_dlg_*` handle — returns the stored token and derived status */
  retrieve(id: string): Promise<DelegationDetail> {
    return this.http.get<DelegationDetail>(`/api/v1/delegations/${encodeURIComponent(id)}`);
  }

  /**
   * Revoke one delegation — the domain proof and sibling delegations stay valid.
   *
   * Idempotent: a repeat revoke answers 200 with the same body, here and on
   * `POST /proofs/{handle}/revoke`. (A PROOF differs deliberately — that one answers
   * `400 already_revoked`.) The result carries the derived `effective_status`/`is_valid`.
   */
  revoke(id: string, params?: RevokeDelegationParams): Promise<DelegationListItem> {
    return this.http.post<DelegationListItem>(`/api/v1/delegations/${encodeURIComponent(id)}/revoke`, params);
  }
}
