// Shared helpers for the JS SDK integration suite.
//
// Every spec imports `createClient()` so we can switch between a live staging
// API (when PROOF_BASE_URL + PROOF_API_KEY_TEST are set) and a deterministic
// mock fetch (otherwise). Test bodies call `isLiveMode()` to decide whether to
// assert on live-only guarantees (e.g. HTTP round-trip behavior) or to fall
// back to contract-level assertions.
//
// In live mode, when CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET are set,
// the shared `liveFetch` wrapper adds Cloudflare Access service-token headers
// to every outbound request — required to traverse the Access perimeter that
// fronts staging. SDK production code stays unaware of CF Access; the header
// injection is test-harness only.

import { Proof } from '../../src/index.js';
import type { ProofOptions } from '../../src/types.js';

export const LIVE_MODE = Boolean(
  process.env.PROOF_BASE_URL && process.env.PROOF_API_KEY_TEST,
);

export interface MockResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export type MockHandler = (
  url: string,
  init?: RequestInit,
) => MockResponse | Promise<MockResponse>;

export function cfAccessHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const id = process.env.CF_ACCESS_CLIENT_ID;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (id && secret) {
    headers['CF-Access-Client-Id'] = id;
    headers['CF-Access-Client-Secret'] = secret;
  }
  const visualSecret = process.env.VISUAL_TEST_SECRET;
  if (visualSecret) {
    headers['X-Visual-Test-Secret'] = visualSecret;
  }
  return headers;
}

export function mockFetch(handler: MockHandler): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const { status, body, headers } = await handler(url, init);
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(bodyStr, {
      status,
      headers: {
        'content-type': 'application/json',
        ...(headers ?? {}),
      },
    });
  }) as typeof fetch;
}

/**
 * `fetch` wrapper that injects CF Access service-token headers when present
 * in the environment. Use this everywhere a live-mode request is made so the
 * Access perimeter is traversed consistently. No-op when CF env vars aren't
 * set (e.g. running against a non-Access-gated origin).
 */
export const liveFetch: typeof fetch = async (input, init) => {
  const access = cfAccessHeaders();
  if (Object.keys(access).length === 0) {
    return globalThis.fetch(input as RequestInfo, init);
  }
  const mergedHeaders = new Headers(init?.headers);
  for (const [k, v] of Object.entries(access)) {
    mergedHeaders.set(k, v);
  }
  return globalThis.fetch(input as RequestInfo, { ...init, headers: mergedHeaders });
};

export function createClient(overrides: Partial<ProofOptions> & { handler?: MockHandler } = {}): Proof {
  const apiKey = process.env.PROOF_API_KEY_TEST ?? 'pk_test_integration';
  const baseUrl = process.env.PROOF_BASE_URL ?? 'https://mock.proof.test';

  let fetchImpl: typeof fetch;
  if (!LIVE_MODE && overrides.handler) {
    fetchImpl = mockFetch(overrides.handler);
  } else if (overrides.fetch) {
    fetchImpl = overrides.fetch;
  } else if (LIVE_MODE) {
    fetchImpl = liveFetch;
  } else {
    fetchImpl = globalThis.fetch;
  }

  return new Proof(apiKey, {
    baseUrl,
    timeout: overrides.timeout ?? 15_000,
    maxRetries: overrides.maxRetries ?? 0,
    fetch: fetchImpl,
  });
}
