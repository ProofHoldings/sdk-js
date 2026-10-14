// Deep live-mode lifecycle coverage for the JS SDK.
//
// All tests here run only in live mode (PROOF_BASE_URL + PROOF_API_KEY_TEST
// set). In live mode they exercise the real verification lifecycle against
// staging (or production, for the production-branch pipeline) using a
// test-mode API key so /test-verify can auto-complete the verification
// without triggering real channel traffic.
//
// Created resources are tagged via client_metadata so the staging-data
// pruner can reclaim them later.

import { afterEach, describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '../../src/index.js';
import { createClient, LIVE_MODE } from './helpers.js';

const describeLive = LIVE_MODE ? describe : describe.skip;

function testRunID(): string {
  return (
    process.env.CI_PIPELINE_ID ??
    process.env.PROOF_TEST_RUN_ID ??
    `local-${process.env.USER ?? 'unknown'}-${Date.now()}`
  );
}

function tagMetadata(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    test_harness: 'sdk-integration',
    test_run_id: testRunID(),
    sdk: 'javascript',
    ...extra,
  };
}

// Real Proof-controlled phone number — staging SMS DID by default. The
// backend's phone validator rejects reserved/fictional ranges, so test
// fixtures must use real numbers we control. Reusing one number across
// concurrent tests is safe because the `pk_test_*` key path routes through
// `/test-verify` and never triggers real SMS dispatch — the number is
// effectively an opaque label, not a delivery target. Each
// `verifications.create` writes a fresh document, and tests key their
// state off the returned `id`, not off the phone.
const TEST_PHONE_IDENTIFIER: string =
  process.env.TEST_PHONE_IDENTIFIER ?? '+19295909022';

function externalUserId(): string {
  return `sdk_js_${testRunID()}`;
}

describeLive('Live lifecycle (integration)', () => {
  // Track test-scoped timers so stray `testVerify` nudges from the polling
  // and streaming tests don't fire after the test has already resolved.
  const pendingTimers: ReturnType<typeof setTimeout>[] = [];
  afterEach(() => {
    while (pendingTimers.length) clearTimeout(pendingTimers.pop()!);
  });

  it('creates, retrieves, lists, and test-verifies a verification', async () => {
    const client = createClient();
    const created = await client.verifications.create({
      type: 'phone',
      channel: 'sms',
      identifier: TEST_PHONE_IDENTIFIER,
      external_user_id: externalUserId(),
      client_metadata: tagMetadata({ stage: 'lifecycle' }),
    } as unknown as Parameters<typeof client.verifications.create>[0]);
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('pending');

    const fetched = await client.verifications.retrieve(created.id as string);
    expect(fetched.id).toBe(created.id);

    const listed = await client.verifications.list({ limit: 5 });
    expect(Array.isArray(listed.data)).toBe(true);
    expect(listed.pagination.page).toBeGreaterThanOrEqual(1);

    const verified = await client.verifications.testVerify(created.id as string);
    expect(verified.status).toBe('verified');
    expect(verified.test_mode).toBe(true);
    expect(verified.proof_token).toBeTruthy();
  });

  it('throws NotFoundError for an unknown verification id', async () => {
    const client = createClient();
    await expect(
      client.verifications.retrieve('000000000000000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError for an invalid create payload', async () => {
    const client = createClient();
    await expect(
      client.verifications.create({
        type: 'phone',
        channel: 'not_a_real_channel' as never,
        identifier: 'not-a-phone',
      } as Parameters<typeof client.verifications.create>[0]),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns a well-formed pagination envelope on list', async () => {
    const client = createClient();
    const page = await client.verifications.list({ page: 1, limit: 3 });
    expect(Array.isArray(page.data)).toBe(true);
    expect(page.pagination).toMatchObject({
      page: expect.any(Number),
      limit: expect.any(Number),
      total: expect.any(Number),
    });
  });

  it('lists verified users (read-only)', async () => {
    const client = createClient();
    const result = await client.verifications.listVerifiedUsers({ limit: 3 });
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('lists webhook deliveries (read-only)', async () => {
    const client = createClient();
    // NOTE: backend returns { deliveries: [...], pagination: {...} } — the
    // only endpoint in the surface that uses `deliveries` instead of the
    // standard `data` envelope. See src/controllers/webhookDeliveries.ts.
    const page = (await client.webhookDeliveries.list({ limit: 3 })) as {
      deliveries: unknown[];
      pagination: Record<string, unknown>;
    };
    expect(Array.isArray(page.deliveries)).toBe(true);
    expect(page.pagination).toBeDefined();
  });

  it('waits for completion via polling', async () => {
    const client = createClient();
    const created = await client.verifications.create({
      type: 'phone',
      channel: 'sms',
      identifier: TEST_PHONE_IDENTIFIER,
      external_user_id: externalUserId(),
      client_metadata: tagMetadata({ stage: 'polling' }),
    } as unknown as Parameters<typeof client.verifications.create>[0]);
    // Nudge the status from another tick so polling has something to
    // observe. Timer handle is tracked for teardown so a stray `testVerify`
    // doesn't fire into the next test case.
    pendingTimers.push(setTimeout(() => {
      client.verifications.testVerify(created.id as string).catch(() => {});
    }, 300));
    const final = await client.verifications.waitForCompletion(created.id as string, {
      interval: 500,
      timeout: 20_000,
      maxInterval: 1_000,
    });
    expect(final.status).toBe('verified');
  }, 30_000);

  it('streams verification events and observes at least one event', async () => {
    const client = createClient();
    const created = await client.verifications.create({
      type: 'phone',
      channel: 'sms',
      identifier: TEST_PHONE_IDENTIFIER,
      external_user_id: externalUserId(),
      client_metadata: tagMetadata({ stage: 'streaming' }),
    } as unknown as Parameters<typeof client.verifications.create>[0]);
    pendingTimers.push(setTimeout(() => {
      client.verifications.testVerify(created.id as string).catch(() => {});
    }, 500));
    // Abort signal lets us force-close the underlying SSE response after
    // the first event instead of relying on GC to unwind the long-lived
    // fetch. Without this, `break` inside the `for await` loop can leave
    // the connection hanging until the test runner exits.
    const abort = new AbortController();
    let first: unknown;
    try {
      for await (const ev of client.verifications.stream(created.id as string, { signal: abort.signal })) {
        first = ev;
        break;
      }
    } finally {
      abort.abort();
    }
    expect(first).toBeDefined();
  }, 30_000);
});

