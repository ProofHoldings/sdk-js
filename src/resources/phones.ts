import type { HttpClient } from '../http.js';
import type {
  PhoneListResponse,
  SuccessResponse,
  StartAddPhoneParams,
  AddPhoneSession,
  AddPhoneStatus,
} from '../types.js';

export class Phones {
  constructor(private readonly http: HttpClient) {}

  /** List all phones for the authenticated user */
  list(): Promise<PhoneListResponse> {
    return this.http.get<PhoneListResponse>('/api/v1/me/phones');
  }

  /** Remove a phone by ID */
  remove(phoneId: string): Promise<SuccessResponse> {
    return this.http.del<SuccessResponse>(`/api/v1/me/phones/${encodeURIComponent(phoneId)}`);
  }

  /** Set a phone as the primary phone */
  setPrimary(phoneId: string): Promise<SuccessResponse> {
    return this.http.put<SuccessResponse>(
      `/api/v1/me/phones/${encodeURIComponent(phoneId)}/primary`,
    );
  }

  /** Start adding a new phone */
  startAdd(params: StartAddPhoneParams): Promise<AddPhoneSession> {
    return this.http.post<AddPhoneSession>('/api/v1/me/phones/add', params);
  }

  /** Get the status of a phone add session */
  getAddStatus(sessionId: string): Promise<AddPhoneStatus> {
    return this.http.get<AddPhoneStatus>(
      `/api/v1/me/phones/add/${encodeURIComponent(sessionId)}`,
    );
  }
}
