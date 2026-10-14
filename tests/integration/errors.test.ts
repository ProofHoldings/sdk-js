import { describe, it, expect } from 'vitest';
import {
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServerError,
  ValidationError,
  ProofError,
} from '../../src/index.js';
import { createClient, LIVE_MODE, liveFetch } from './helpers.js';

const itMockOnly = it.skipIf(LIVE_MODE);
const itLiveOnly = it.runIf(LIVE_MODE);

function errorClient(status: number, body: unknown) {
  return createClient({
    handler: () => ({ status, body }),
  });
}

describe('Error taxonomy (integration)', () => {
  itMockOnly('throws ValidationError for 400 responses', async () => {
    const client = errorClient(400, { error: { code: 'invalid_request', message: 'bad' } });
    await expect(client.verifications.retrieve('v_bad')).rejects.toBeInstanceOf(ValidationError);
  });

  itMockOnly('throws AuthenticationError for 401 responses', async () => {
    const client = errorClient(401, { error: { code: 'invalid_api_key', message: 'bad key' } });
    await expect(client.verifications.retrieve('v_x')).rejects.toBeInstanceOf(AuthenticationError);
  });

  itMockOnly('throws ForbiddenError for 403 responses', async () => {
    const client = errorClient(403, { error: { code: 'forbidden', message: 'no' } });
    await expect(client.verifications.retrieve('v_x')).rejects.toBeInstanceOf(ForbiddenError);
  });

  itMockOnly('throws NotFoundError for 404 responses', async () => {
    const client = errorClient(404, { error: { code: 'not_found', message: 'gone' } });
    await expect(client.verifications.retrieve('v_x')).rejects.toBeInstanceOf(NotFoundError);
  });

  itMockOnly('throws ConflictError for 409 responses', async () => {
    const client = errorClient(409, { error: { code: 'conflict', message: 'dup' } });
    await expect(client.verifications.retrieve('v_x')).rejects.toBeInstanceOf(ConflictError);
  });

  itMockOnly('throws RateLimitError with retryAfter for 429 responses', async () => {
    const client = errorClient(429, {
      error: { code: 'rate_limited', message: 'slow', retryAfter: 12 },
    });
    try {
      await client.verifications.retrieve('v_x');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfter).toBe(12);
    }
  });

  itMockOnly('throws ServerError for 500 responses', async () => {
    const client = errorClient(500, { error: { code: 'internal_error', message: 'boom' } });
    await expect(client.verifications.retrieve('v_x')).rejects.toBeInstanceOf(ServerError);
  });

  itLiveOnly('returns AuthenticationError against live API with a bogus key', async () => {
    const { Proof } = await import('../../src/index.js');
    // `liveFetch` injects CF Access service-token headers so the request
    // actually reaches the API. Without it, Cloudflare Access returns 403
    // and the assertion would pass on a false positive (wrapped as a
    // generic `ProofError`) without the backend ever seeing the call.
    const bad = new Proof('pk_test_this_key_does_not_exist', {
      baseUrl: process.env.PROOF_BASE_URL!,
      fetch: liveFetch,
      maxRetries: 0,
    });
    await expect(bad.verifications.list()).rejects.toBeInstanceOf(AuthenticationError);
  });
});
