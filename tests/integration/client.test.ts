import { describe, it, expect } from 'vitest';
import { Proof } from '../../src/index.js';
import { createClient, LIVE_MODE, liveFetch } from './helpers.js';

const itLiveOnly = it.runIf(LIVE_MODE);

describe('Proof client (integration)', () => {
  it('exposes every resource surface the SDK advertises', () => {
    const client = createClient();
    expect(client.verifications).toBeDefined();
    expect(client.verificationRequests).toBeDefined();
    expect(client.proofs).toBeDefined();
    expect(client.sessions).toBeDefined();
    expect(client.webhookDeliveries).toBeDefined();
    expect(client.confirmations).toBeDefined();
    expect(client.authSessions).toBeDefined();
    expect(client.me).toBeDefined();
    expect(client.hitlChatIdDiscovery).toBeDefined();
    expect(client.hitlKeys).toBeDefined();
  });

  it('rejects an empty API key', () => {
    expect(() => new Proof('', { fetch: globalThis.fetch })).toThrow('API key is required');
  });

  it('honors custom base URL and timeout options', () => {
    const client = new Proof('pk_test_xyz', {
      baseUrl: 'https://example.test',
      timeout: 1234,
      maxRetries: 7,
      fetch: globalThis.fetch,
    });
    expect(client).toBeInstanceOf(Proof);
  });

  itLiveOnly('reaches the live API /health endpoint when PROOF_BASE_URL is set', async () => {
    const baseUrl = process.env.PROOF_BASE_URL!;
    // /health has no auth but staging fronts the origin with Cloudflare
    // Access — use `liveFetch` so service-token headers are applied.
    const response = await liveFetch(`${baseUrl.replace(/\/$/, '')}/health`);
    expect(response.status).toBe(200);
  });
});
