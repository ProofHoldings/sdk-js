/**
 * JavaScript SDK — Live API integration tests.
 *
 * Run against a real server using pk_test_* keys.
 * NOT included in the default test suite — use a separate vitest config.
 *
 * Prerequisites:
 *   PROOF_API_KEY_TEST — Required, must start with "pk_test_"
 *   PROOF_BASE_URL     — Optional, defaults to "https://api.proof.holdings"
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Proof } from '../../client.js';

const API_KEY = process.env.PROOF_API_KEY_TEST;
const BASE_URL = process.env.PROOF_BASE_URL || 'https://api.proof.holdings';

const describeIntegration = API_KEY?.startsWith('pk_test_') ? describe : describe.skip;
let counter = 0;
const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${++counter}@example.com`;

describeIntegration('JS SDK — Live API Integration', () => {
  let client: Proof;

  beforeAll(() => {
    client = new Proof(API_KEY!, { baseUrl: BASE_URL });
  });

  // ── Verification CRUD ─────────────────────────────────────────────

  it('should create a phone verification', async () => {
    const verification = await client.verifications.create({
      type: 'phone',
      channel: 'sms',
      identifier: '+14155550100',
    });
    expect(verification.id).toBeDefined();
    expect(verification.status).toBe('pending');
  });

  it('should list verifications', async () => {
    const result = await client.verifications.list({ limit: 5 });
    expect(result.data).toBeInstanceOf(Array);
    expect(result.pagination).toBeDefined();
  });

  it('should retrieve a verification by ID', async () => {
    const created = await client.verifications.create({
      type: 'email',
      channel: 'email',
      identifier: uniqueEmail('js-sdk-test'),
    });
    const retrieved = await client.verifications.retrieve(created.id);
    expect(retrieved.id).toBe(created.id);
  });

  // ── Test-Verify + Proof Round-Trip ────────────────────────────────

  it('should test-verify and validate proof token', async () => {
    const verification = await client.verifications.create({
      type: 'email',
      channel: 'email',
      identifier: uniqueEmail('js-sdk-proof'),
    });
    const verified = await client.verifications.testVerify(verification.id);
    expect(verified.proof_token).toBeDefined();

    const proof = await client.proofs.validate(verified.proof_token!);
    expect(proof.valid).toBe(true);
  });

  // ── Verification Requests ─────────────────────────────────────────

  it('should create and retrieve a verification request', async () => {
    const vr = await client.verificationRequests.create({
      assets: [{ type: 'email', identifier: uniqueEmail('js-sdk-vr') }],
    });
    expect(vr.id).toBeDefined();

    const retrieved = await client.verificationRequests.retrieve(vr.id);
    expect(retrieved.id).toBe(vr.id);
  });

  // ── Proofs ────────────────────────────────────────────────────────

  it('should list revoked proofs', async () => {
    const result = await client.proofs.listRevoked();
    expect(result.revoked).toBeInstanceOf(Array);
    expect(typeof result.count).toBe('number');
  });

  // ── Profiles ──────────────────────────────────────────────────────

  it('should list profiles', async () => {
    const result = await client.profiles.list();
    expect(Array.isArray(result)).toBe(true);
  });
});
