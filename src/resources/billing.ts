import type { HttpClient } from '../http.js';
import type {
  SubscriptionInfo,
  CheckoutParams,
  CheckoutResponse,
  PortalParams,
  PortalResponse,
} from '../types.js';

export class Billing {
  constructor(private readonly http: HttpClient) {}

  /** Get current subscription details */
  subscription(): Promise<SubscriptionInfo> {
    return this.http.get<SubscriptionInfo>('/api/v1/billing/subscription');
  }

  /** Create a Stripe checkout session for plan upgrade */
  checkout(params: CheckoutParams): Promise<CheckoutResponse> {
    return this.http.post<CheckoutResponse>('/api/v1/billing/checkout', params);
  }

  /** Create a Stripe customer portal session */
  portal(params: PortalParams): Promise<PortalResponse> {
    return this.http.post<PortalResponse>('/api/v1/billing/portal', params);
  }
}
