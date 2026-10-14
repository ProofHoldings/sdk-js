import { describe, it, expect } from 'vitest';
import { Proof } from '../../src/index.js';
import { LIVE_MODE, mockFetch } from './helpers.js';

const itMockOnly = it.skipIf(LIVE_MODE);

describe('Retry logic (integration)', () => {
  itMockOnly('retries once on 503 and succeeds on the second attempt', async () => {
    let attempts = 0;
    const client = new Proof('pk_test_retry', {
      baseUrl: 'https://mock.proof.test',
      timeout: 5000,
      maxRetries: 1,
      fetch: mockFetch((_url) => {
        attempts += 1;
        if (attempts === 1) return { status: 503, body: { error: { code: 'service_unavailable', message: 'retry me' } } };
        return {
          status: 200,
          body: { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } },
        };
      }),
    });

    const page = await client.verifications.list();
    expect(page.data).toEqual([]);
    expect(attempts).toBe(2);
  });
});
