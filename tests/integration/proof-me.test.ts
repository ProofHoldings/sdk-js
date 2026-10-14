import { describe, it, expect } from 'vitest';
import { createClient, LIVE_MODE } from './helpers.js';

const itMockOnly = it.skipIf(LIVE_MODE);

const CIRCLE_ID = '0123456789abcdef01234567';
const MEMBER_ID = 'fedcba9876543210fedcba98';
const CHALLENGE_ID = 'aaaabbbbccccddddeeeeffff';

const CHALLENGE = {
  id: CHALLENGE_ID,
  status: 'pending',
  confirm_channel: 'whatsapp',
  single_channel_warning: false,
  created_at: '2026-06-23T00:00:00.000Z',
};

describe('Proof-Me resource round-trip (integration)', () => {
  itMockOnly('creates and retrieves an identity challenge', async () => {
    let sentBody: unknown;
    const client = createClient({
      handler: (url, init) => {
        if (url.endsWith('/api/v1/identity-challenges') && init?.method === 'POST') {
          sentBody = JSON.parse(String(init?.body ?? '{}'));
          return { status: 201, body: CHALLENGE };
        }
        if (url.endsWith(`/api/v1/identity-challenges/${CHALLENGE_ID}`) && init?.method === 'GET') {
          return { status: 200, body: { ...CHALLENGE, status: 'active' } };
        }
        return { status: 404, body: { error: { code: 'not_found', message: 'not found' } } };
      },
    });

    const created = await client.proofMe.createIdentityChallenge({
      circle_id: CIRCLE_ID,
      member_id: MEMBER_ID,
    });
    expect(sentBody).toEqual({ circle_id: CIRCLE_ID, member_id: MEMBER_ID });
    expect(created.id).toBe(CHALLENGE_ID);
    expect(created.confirm_channel).toBe('whatsapp');

    const fetched = await client.proofMe.getIdentityChallenge(CHALLENGE_ID);
    expect(fetched.status).toBe('active');
  });
});
