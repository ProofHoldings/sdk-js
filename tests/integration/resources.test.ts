import { describe, it, expect } from 'vitest';
import { createClient, LIVE_MODE } from './helpers.js';
import verificationFixture from '../../../shared/fixtures/verification.json' with { type: 'json' };
import verificationListFixture from '../../../shared/fixtures/verification_list.json' with { type: 'json' };

// Live mode hits a real staging API — mutating SMS tests and mock-dependent
// shape assertions are meaningless there, so skipIf them cleanly rather than
// silently `return`-ing (which vitest reports as passing).
const itMockOnly = it.skipIf(LIVE_MODE);

function stripMeta<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith('_')));
}

const VERIFICATION = stripMeta(verificationFixture as Record<string, unknown>);
const VERIFICATION_LIST = stripMeta(verificationListFixture as Record<string, unknown>);

describe('Resource round-trip (integration)', () => {
  itMockOnly('creates and retrieves a verification using the shared wire fixture', async () => {
    const client = createClient({
      handler: (url, init) => {
        if (url.endsWith('/api/v1/verifications') && init?.method === 'POST') {
          return { status: 201, body: VERIFICATION };
        }
        if (url.includes(`/api/v1/verifications/${VERIFICATION.id}`)) {
          return { status: 200, body: VERIFICATION };
        }
        return { status: 404, body: { error: { code: 'not_found', message: 'not found' } } };
      },
    });

    const created = await client.verifications.create({
      type: VERIFICATION.type as string,
      channel: VERIFICATION.channel as string,
      identifier: VERIFICATION.identifier as string,
    });
    expect(created.id).toBe(VERIFICATION.id);
    expect(created.status).toBe(VERIFICATION.status);

    const fetched = await client.verifications.retrieve(VERIFICATION.id as string);
    expect(fetched.id).toBe(VERIFICATION.id);
    expect(fetched.identifier).toBe(VERIFICATION.identifier);
    expect(fetched.created_at).toBe(VERIFICATION.created_at);
  });

  itMockOnly('lists verifications with pagination envelope using shared fixture', async () => {
    const client = createClient({
      handler: () => ({ status: 200, body: VERIFICATION_LIST }),
    });

    const page = await client.verifications.list();
    expect(Array.isArray(page.data)).toBe(true);
    expect(page.pagination.page).toBe(1);
    expect(page.pagination).toHaveProperty('total');
    expect(page.pagination).toHaveProperty('total_pages');
  });
});
