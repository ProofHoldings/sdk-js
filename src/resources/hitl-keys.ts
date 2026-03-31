import type { HttpClient } from '../http.js';
import type { HitlKeysResponse, HitlKeysPutResponse, HitlKeysDeleteResponse, HitlKeysPutParams } from '../types.js';

export class HitlKeys {
  constructor(private readonly http: HttpClient) {}

  /** Get encryption keypair for a HITL config */
  get(hitlId: string): Promise<HitlKeysResponse> {
    return this.http.get<HitlKeysResponse>(`/api/v1/hitl/${encodeURIComponent(hitlId)}/keys`);
  }

  /** Upload encryption keypair for a HITL config */
  upload(hitlId: string, params: HitlKeysPutParams): Promise<HitlKeysPutResponse> {
    return this.http.put<HitlKeysPutResponse>(`/api/v1/hitl/${encodeURIComponent(hitlId)}/keys`, params);
  }

  /** Delete encryption keypair from a HITL config */
  delete(hitlId: string): Promise<HitlKeysDeleteResponse> {
    return this.http.del<HitlKeysDeleteResponse>(`/api/v1/hitl/${encodeURIComponent(hitlId)}/keys`);
  }
}
