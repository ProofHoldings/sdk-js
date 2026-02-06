import type { HttpClient } from '../http.js';
import type { WebhookDelivery, WebhookDeliveryList, WebhookRetryResponse, ListWebhookDeliveriesParams } from '../types.js';

export class WebhookDeliveries {
  constructor(private readonly http: HttpClient) {}

  /** List webhook deliveries with optional filters */
  list(params?: ListWebhookDeliveriesParams): Promise<WebhookDeliveryList> {
    return this.http.get<WebhookDeliveryList>('/api/v1/webhook-deliveries', params as Record<string, string | number | boolean | undefined>);
  }

  /** Get a webhook delivery by ID */
  retrieve(id: string): Promise<WebhookDelivery> {
    return this.http.get<WebhookDelivery>(`/api/v1/webhook-deliveries/${encodeURIComponent(id)}`);
  }

  /** Retry a failed webhook delivery */
  retry(id: string): Promise<WebhookRetryResponse> {
    return this.http.post<WebhookRetryResponse>(`/api/v1/webhook-deliveries/${encodeURIComponent(id)}/retry`);
  }
}
