import { describe, it, expect } from 'vitest';
import { ProofHoldings } from '../client.js';

describe('ProofHoldings client', () => {
  it('throws on empty API key', () => {
    expect(() => new ProofHoldings('')).toThrow('API key is required');
  });

  it('creates client with valid key', () => {
    const client = new ProofHoldings('pk_test_123', { fetch: globalThis.fetch });
    expect(client.verifications).toBeDefined();
    expect(client.verificationRequests).toBeDefined();
    expect(client.proofs).toBeDefined();
    expect(client.sessions).toBeDefined();
    expect(client.webhookDeliveries).toBeDefined();
  });

  it('accepts custom options', () => {
    // Should not throw
    const client = new ProofHoldings('pk_test_123', {
      baseUrl: 'https://custom.api.com',
      timeout: 5000,
      maxRetries: 5,
      fetch: globalThis.fetch,
    });
    expect(client).toBeDefined();
  });
});
