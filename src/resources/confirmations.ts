import type { HttpClient } from '../http.js';
import type {
  Confirmation,
  CreateConfirmationParams,
  ConfirmationListParams,
  ConfirmationListResponse,
} from '../types.js';

export class Confirmations {
  constructor(private readonly http: HttpClient) {}

  /** Create a new confirmation request */
  create(params: CreateConfirmationParams): Promise<Confirmation> {
    return this.http.post<Confirmation>('/api/v1/confirmations', params);
  }

  /** Get a confirmation by ID */
  retrieve(id: string): Promise<Confirmation> {
    return this.http.get<Confirmation>(`/api/v1/confirmations/${encodeURIComponent(id)}`);
  }

  /** List confirmations with optional filters */
  list(params?: ConfirmationListParams): Promise<ConfirmationListResponse> {
    return this.http.get<ConfirmationListResponse>('/api/v1/confirmations', params as Record<string, string | number | boolean | undefined>);
  }
}
