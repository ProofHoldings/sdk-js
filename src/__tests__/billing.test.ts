import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '../http.js';
import { Billing } from '../resources/billing.js';
import { Proof } from '../client.js';
import { BalanceEmptyError, BillingUnavailableError, ProofError, ServerError } from '../errors.js';
import type { BalanceResponse } from '../types.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(here, '../../../shared/fixtures');

/** A shared fixture with its `_`-prefixed metadata keys dropped. */
function fixture(name: string): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(join(FIXTURES, name), 'utf-8')) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith('_')));
}

const BALANCE = fixture('balance.json') as unknown as BalanceResponse;
const BALANCE_EMPTY = fixture('error_balance_empty.json');

function mockHttp() {
  return {
    baseUrl: 'https://api.example.com',
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    request: vi.fn(),
  } as unknown as HttpClient;
}

/** A fetch answering each call from `responses` in turn (the last one repeats). */
function sequenceFetch(responses: Array<{ status: number; body: unknown }>) {
  let call = 0;
  return vi.fn(async () => {
    const resp = responses[Math.min(call++, responses.length - 1)];
    return {
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      headers: { get: () => 'application/json' },
      json: async () => resp.body,
    } as unknown as Response;
  });
}

function client(fetch: ReturnType<typeof sequenceFetch>, maxRetries = 2) {
  return new HttpClient({ apiKey: 'pk_test_123', baseUrl: 'https://api.example.com', timeout: 5000, maxRetries, fetch: fetch as unknown as typeof globalThis.fetch });
}

describe('Billing resource', () => {
  it('is wired into the client', () => {
    expect(new Proof('pk_test_123').billing).toBeInstanceOf(Billing);
  });

  it('subscription reads GET /api/v1/billing/subscription', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ plan: 'free', status: null, current_period_start: null, current_period_end: null, cancel_at_period_end: false });
    const result = await new Billing(http).subscription();
    expect(http.get).toHaveBeenCalledWith('/api/v1/billing/subscription');
    expect(result.status).toBeNull();
  });

  it('checkout posts the plan and both redirect URLs and returns checkout_url', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ checkout_url: 'https://checkout.stripe.com/c/pay/cs_test' });
    const params = { plan: 'pro' as const, success_url: 'https://proof.holdings/billing?ok=1', cancel_url: 'https://proof.holdings/billing' };
    const result = await new Billing(http).checkout(params);
    expect(http.post).toHaveBeenCalledWith('/api/v1/billing/checkout', params);
    expect(result.checkout_url).toBe('https://checkout.stripe.com/c/pay/cs_test');
  });

  it('portal posts the return URL and returns portal_url', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ portal_url: 'https://billing.stripe.com/p/session/test' });
    const result = await new Billing(http).portal({ return_url: 'https://proof.holdings/billing' });
    expect(http.post).toHaveBeenCalledWith('/api/v1/billing/portal', { return_url: 'https://proof.holdings/billing' });
    expect(result.portal_url).toBe('https://billing.stripe.com/p/session/test');
  });

  it('topUp posts a numeric amount', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ checkout_url: 'https://checkout.stripe.com/c/pay/cs_top_up' });
    const params = { amount: 50 as const, auto_top_up: true, success_url: 'https://proof.holdings/usage?top_up=success', cancel_url: 'https://proof.holdings/usage' };
    const result = await new Billing(http).topUp(params);
    expect(http.post).toHaveBeenCalledWith('/api/v1/billing/top-up', params);
    expect(result.checkout_url).toBe('https://checkout.stripe.com/c/pay/cs_top_up');
  });

  it('balance reads GET /api/v1/billing/balance into the shared fixture shape', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue(BALANCE);
    const result = await new Billing(http).balance();
    expect(http.get).toHaveBeenCalledWith('/api/v1/billing/balance');
    expect(result.balance.currency).toBe('eur');
    expect(result.auto_top_up.has_payment_method).toBe(true);
  });

  it('balanceLedger sends page and limit as the query, and none when omitted', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: [], pagination: { page: 2, limit: 10, total: 0, total_pages: 1 } });
    const billing = new Billing(http);
    await billing.balanceLedger({ page: 2, limit: 10 });
    expect(http.get).toHaveBeenCalledWith('/api/v1/billing/balance/ledger', { page: 2, limit: 10 });
    await billing.balanceLedger();
    expect(http.get).toHaveBeenLastCalledWith('/api/v1/billing/balance/ledger', {});
  });

  it('autoTopUp sends PATCH /api/v1/billing/auto-top-up and returns the balance', async () => {
    const http = mockHttp();
    vi.mocked(http.request).mockResolvedValue(BALANCE);
    const result = await new Billing(http).autoTopUp({ enabled: true, amount: 50 });
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/v1/billing/auto-top-up', { body: { enabled: true, amount: 50 } });
    expect(result.auto_top_up.amount).toBe(50);
  });
});

describe('billing refusals as typed errors', () => {
  it('a 402 raises BalanceEmptyError carrying the four fields of the shared fixture', async () => {
    const fetch = sequenceFetch([{ status: 402, body: BALANCE_EMPTY }]);
    const error = await client(fetch).post('/api/v1/verifications', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BalanceEmptyError);
    expect(error).toBeInstanceOf(ProofError);
    const empty = error as BalanceEmptyError;
    const sent = BALANCE_EMPTY.error as Record<string, unknown>;
    expect(empty.statusCode).toBe(402);
    expect(empty.code).toBe('balance_empty');
    expect(empty.topUpUrl).toBe(sent.top_up_url);
    expect(empty.used).toBe(sent.used);
    expect(empty.included).toBe(sent.included);
    expect(empty.balance).toBe(sent.balance);
    expect(empty.requestId).toBe(sent.request_id);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('503 billing_unavailable raises BillingUnavailableError, a ServerError, after one request', async () => {
    const fetch = sequenceFetch([{ status: 503, body: { error: { code: 'billing_unavailable', message: 'Billing is not configured' } } }]);
    const error = await client(fetch).post('/api/v1/billing/checkout', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BillingUnavailableError);
    expect(error).toBeInstanceOf(ServerError);
    expect((error as ServerError).statusCode).toBe(503);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('any other 503 keeps the retries (control)', async () => {
    const fetch = sequenceFetch([{ status: 503, body: { error: { code: 'service_unavailable', message: 'down' } } }]);
    const http = client(fetch);
    vi.spyOn(http as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep').mockResolvedValue();
    const error = await http.get('/api/v1/billing/balance').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServerError);
    expect(error).not.toBeInstanceOf(BillingUnavailableError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
