import type { HttpClient } from '../http.js';
import type {
  AutoTopUpRequest,
  BalanceLedgerParams,
  BalanceResponse,
  CheckoutRequest,
  CheckoutResponse,
  LedgerListResponse,
  PortalRequest,
  PortalResponse,
  SubscriptionResponse,
  TopUpRequest,
  TopUpResponse,
} from '../types.js';

/**
 * Billing — the subscription, Stripe checkout and portal links, and the prepaid balance.
 *
 * Checkout, portal and top-up answer `503 billing_unavailable` (`BillingUnavailableError`) while
 * billing is not live; the reads keep answering. Their redirect URLs must be on `proof.holdings` (or
 * `localhost`): the API refuses any other host, so a flow that sends the payer back to your own site
 * cannot use them yet. The four writes are account-level, so a key bound to one sub-account is
 * refused `403 account_key_required`.
 */
export class Billing {
  constructor(private readonly http: HttpClient) {}

  /** The account's subscription, whatever its status; with none, the account's plan and `status: null`. */
  subscription(): Promise<SubscriptionResponse> {
    return this.http.get<SubscriptionResponse>('/api/v1/billing/subscription');
  }

  /**
   * Open a Stripe Checkout session for a plan and return its URL. Refused `409 subscription_exists`
   * while the account has a live subscription (change the plan in the portal instead), and
   * `409 company_details_required` until the account's company profile is complete. Its redirect URLs
   * must be on `proof.holdings` (or `localhost`): the API refuses any other host. A key bound to one
   * sub-account is refused `403 account_key_required`.
   */
  checkout(params: CheckoutRequest): Promise<CheckoutResponse> {
    return this.http.post<CheckoutResponse>('/api/v1/billing/checkout', params);
  }

  /**
   * Open a Stripe billing portal session for the account's subscription (`404 no_subscription` without
   * one). Its redirect URLs must be on `proof.holdings` (or `localhost`): the API refuses any other
   * host. A key bound to one sub-account is refused `403 account_key_required`.
   */
  portal(params: PortalRequest): Promise<PortalResponse> {
    return this.http.post<PortalResponse>('/api/v1/billing/portal', params);
  }

  /**
   * Open a Stripe Checkout session for a €10, €50 or €200 prepaid balance top-up. Nothing is credited
   * here: the balance grows once Stripe reports the payment. `auto_top_up: true` is refused to an API key
   * (`403 owner_session_required`): saving the card for automatic top-ups is the account owner's act on the
   * dashboard. Its redirect URLs must be on `proof.holdings` (or
   * `localhost`): the API refuses any other host. A key bound to one sub-account is refused
   * `403 account_key_required`.
   */
  topUp(params: TopUpRequest): Promise<TopUpResponse> {
    return this.http.post<TopUpResponse>('/api/v1/billing/top-up', params);
  }

  /** The prepaid balance, the low-balance threshold, the top-up amounts and the auto top-up setting. */
  balance(): Promise<BalanceResponse> {
    return this.http.get<BalanceResponse>('/api/v1/billing/balance');
  }

  /** The balance history, newest first: every top-up, refund and adjustment, and one usage row per month. */
  balanceLedger(params: BalanceLedgerParams = {}): Promise<LedgerListResponse> {
    return this.http.get<LedgerListResponse>('/api/v1/billing/balance/ledger', params as Record<string, string | number | boolean | undefined>);
  }

  /**
   * Switch auto top-up off (`{ enabled: false }`). An API key may not switch it on or change its amount
   * (`403 owner_session_required`): automatic top-ups charge the saved card with no one present, so the
   * account owner switches them on from the dashboard. A key bound to one sub-account is refused
   * `403 account_key_required`.
   */
  autoTopUp(params: AutoTopUpRequest): Promise<BalanceResponse> {
    return this.http.request<BalanceResponse>('PATCH', '/api/v1/billing/auto-top-up', { body: params });
  }
}
