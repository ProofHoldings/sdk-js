import { describe, it, expect } from 'vitest';
import { pollUntilComplete } from '../../src/polling.js';
import { PollingTimeoutError, ConfirmationDeniedError } from '../../src/index.js';
import { generateKeyPair } from '../../src/crypto/hitl-crypto.js';
import { createClient, LIVE_MODE } from './helpers.js';
import type { MockHandler } from './helpers.js';

const itMockOnly = it.skipIf(LIVE_MODE);

const FAST_POLL = { interval: 5, backoff: 1, jitter: 0, maxInterval: 5, timeout: 2000 };

describe('Polling helper (integration)', () => {
  itMockOnly('returns as soon as status enters the terminal set', async () => {
    let calls = 0;
    const result = await pollUntilComplete(
      async () => {
        calls += 1;
        return { status: calls < 3 ? 'pending' : 'verified' };
      },
      ['verified', 'failed'],
      'verification',
      { interval: 5, backoff: 1, jitter: 0, maxInterval: 5, timeout: 2000 },
    );
    expect(result.status).toBe('verified');
    expect(calls).toBe(3);
  });

  itMockOnly('throws PollingTimeoutError when the poll deadline passes', async () => {
    await expect(
      pollUntilComplete(
        async () => ({ status: 'pending' }),
        ['verified'],
        'verification',
        { interval: 5, backoff: 1, jitter: 0, maxInterval: 5, timeout: 20 },
      ),
    ).rejects.toBeInstanceOf(PollingTimeoutError);
  });

  itMockOnly('honors an external AbortSignal', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);
    await expect(
      pollUntilComplete(
        async () => ({ status: 'pending' }),
        ['verified'],
        'verification',
        { interval: 5, backoff: 1, jitter: 0, maxInterval: 5, timeout: 5000, signal: controller.signal },
      ),
    ).rejects.toThrow();
  });
});

describe('confirmations.waitForResolution (integration)', () => {
  itMockOnly('returns the confirmation once it reaches approved', async () => {
    let polls = 0;
    const handler: MockHandler = (url) => {
      if (url.includes('/api/v1/confirmations/conf_a')) {
        polls += 1;
        return { status: 200, body: { id: 'conf_a', status: polls < 2 ? 'pending' : 'approved' } };
      }
      return { status: 404, body: {} };
    };
    const result = await createClient({ handler }).confirmations.waitForResolution('conf_a', FAST_POLL);
    expect(result.status).toBe('approved');
    expect(polls).toBe(2);
  });

  itMockOnly('throws ConfirmationDeniedError on denial when throwOnDenial is true', async () => {
    const handler: MockHandler = () => ({ status: 200, body: { id: 'conf_b', status: 'denied' } });
    await expect(
      createClient({ handler }).confirmations.waitForResolution('conf_b', { ...FAST_POLL, throwOnDenial: true }),
    ).rejects.toBeInstanceOf(ConfirmationDeniedError);
  });

  itMockOnly('returns the denied confirmation when throwOnDenial is not set (default false)', async () => {
    const handler: MockHandler = () => ({ status: 200, body: { id: 'conf_c', status: 'denied' } });
    const result = await createClient({ handler }).confirmations.waitForResolution('conf_c', FAST_POLL);
    expect(result.status).toBe('denied');
  });
});

describe('confirmations.createAndWait (integration)', () => {
  const { publicKeyPem } = generateKeyPair();

  itMockOnly('fetches key, encrypts a v1 envelope, creates, and polls to approval', async () => {
    let created = false;
    let polls = 0;
    const handler: MockHandler = (url, init) => {
      if (url.includes('/api/v1/hitl/hitl_1/keys')) {
        return { status: 200, body: { public_key: publicKeyPem, encrypted_private_key: '', kdf_salt: '', kid: '' } };
      }
      if (url.endsWith('/api/v1/confirmations') && init?.method === 'POST') {
        created = true;
        const sent = JSON.parse(String(init?.body ?? '{}'));
        const envelope = JSON.parse(sent.message);
        expect(sent.hitl_id).toBe('hitl_1');
        expect(envelope.v).toBe(1);
        expect(typeof envelope.ek).toBe('string');
        return { status: 200, body: { id: 'conf_x', status: 'pending' } };
      }
      if (url.includes('/api/v1/confirmations/conf_x')) {
        polls += 1;
        return { status: 200, body: { id: 'conf_x', status: polls < 2 ? 'pending' : 'approved' } };
      }
      return { status: 404, body: {} };
    };
    const result = await createClient({ handler }).confirmations.createAndWait('hitl_1', 'Deploy to prod?', FAST_POLL);
    expect(created).toBe(true);
    expect(result.status).toBe('approved');
  });

  itMockOnly('throws ConfirmationDeniedError on denial (createAndWait default throwOnDenial true)', async () => {
    const handler: MockHandler = (url, init) => {
      if (url.includes('/api/v1/hitl/hitl_1/keys')) {
        return { status: 200, body: { public_key: publicKeyPem, encrypted_private_key: '', kdf_salt: '', kid: '' } };
      }
      if (url.endsWith('/api/v1/confirmations') && init?.method === 'POST') {
        return { status: 200, body: { id: 'conf_y', status: 'pending' } };
      }
      if (url.includes('/api/v1/confirmations/conf_y')) {
        return { status: 200, body: { id: 'conf_y', status: 'denied' } };
      }
      return { status: 404, body: {} };
    };
    await expect(
      createClient({ handler }).confirmations.createAndWait('hitl_1', 'Deploy?', FAST_POLL),
    ).rejects.toBeInstanceOf(ConfirmationDeniedError);
  });

  itMockOnly('throws on expired by default — a gate must not pass without approval', async () => {
    const handler: MockHandler = (url, init) => {
      if (url.includes('/api/v1/hitl/hitl_1/keys')) {
        return { status: 200, body: { public_key: publicKeyPem, encrypted_private_key: '', kdf_salt: '', kid: '' } };
      }
      if (url.endsWith('/api/v1/confirmations') && init?.method === 'POST') {
        return { status: 200, body: { id: 'conf_z', status: 'pending' } };
      }
      if (url.includes('/api/v1/confirmations/conf_z')) {
        return { status: 200, body: { id: 'conf_z', status: 'expired' } };
      }
      return { status: 404, body: {} };
    };
    await expect(
      createClient({ handler }).confirmations.createAndWait('hitl_1', 'Deploy?', FAST_POLL),
    ).rejects.toBeInstanceOf(ConfirmationDeniedError);
  });

  itMockOnly('returns the non-approved confirmation when throwOnDenial is explicitly false', async () => {
    const handler: MockHandler = (url, init) => {
      if (url.includes('/api/v1/hitl/hitl_1/keys')) {
        return { status: 200, body: { public_key: publicKeyPem, encrypted_private_key: '', kdf_salt: '', kid: '' } };
      }
      if (url.endsWith('/api/v1/confirmations') && init?.method === 'POST') {
        return { status: 200, body: { id: 'conf_w', status: 'pending' } };
      }
      if (url.includes('/api/v1/confirmations/conf_w')) {
        return { status: 200, body: { id: 'conf_w', status: 'denied' } };
      }
      return { status: 404, body: {} };
    };
    const result = await createClient({ handler }).confirmations.createAndWait('hitl_1', 'Deploy?', { ...FAST_POLL, throwOnDenial: false });
    expect(result.status).toBe('denied');
  });
});
