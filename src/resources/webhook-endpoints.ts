import type { HttpClient } from '../http.js';
import type {
  WebhookEndpoint,
  WebhookEndpointList,
  WebhookEndpointWithSecret,
  CreateWebhookEndpointParams,
  UpdateWebhookEndpointParams,
} from '../types.js';

/**
 * Webhook endpoints: the URLs your account's events are delivered to, each with its own
 * subscription (`events`), reach (`scope` — every sub-account or only `profile_ids`) and signing
 * secret. The signing secret is returned ONCE — by `create` and by `rotateSecret` — and never by
 * `list`/`retrieve`/`update` (those carry `secret_set` only). Store it when you receive it.
 */
export class WebhookEndpoints {
  constructor(private readonly http: HttpClient) {}

  /** List the account's webhook endpoints (no secrets) */
  list(): Promise<WebhookEndpointList> {
    return this.http.get<WebhookEndpointList>('/api/v1/webhook-endpoints');
  }

  /** Create a webhook endpoint. The response carries the signing secret — the only time it is returned besides `rotateSecret` */
  create(params: CreateWebhookEndpointParams): Promise<WebhookEndpointWithSecret> {
    return this.http.post<WebhookEndpointWithSecret>('/api/v1/webhook-endpoints', params);
  }

  /** Get a webhook endpoint by ID (no secret) */
  retrieve(id: string): Promise<WebhookEndpoint> {
    return this.http.get<WebhookEndpoint>(`/api/v1/webhook-endpoints/${encodeURIComponent(id)}`);
  }

  /** Update a webhook endpoint (partial; the secret is unchanged and not returned) */
  update(id: string, params: UpdateWebhookEndpointParams): Promise<WebhookEndpoint> {
    return this.http.request<WebhookEndpoint>(
      'PATCH',
      `/api/v1/webhook-endpoints/${encodeURIComponent(id)}`,
      { body: params },
    );
  }

  /** Delete a webhook endpoint (204, no body) */
  delete(id: string): Promise<void> {
    return this.http.del<void>(`/api/v1/webhook-endpoints/${encodeURIComponent(id)}`);
  }

  /**
   * Rotate an endpoint's signing secret. The new secret is returned in this response only — store
   * it now. New deliveries are signed with it; deliveries already queued keep the secret they were
   * queued with.
   */
  rotateSecret(id: string): Promise<WebhookEndpointWithSecret> {
    return this.http.post<WebhookEndpointWithSecret>(
      `/api/v1/webhook-endpoints/${encodeURIComponent(id)}/rotate-secret`,
    );
  }
}
